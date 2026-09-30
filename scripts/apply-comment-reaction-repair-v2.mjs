import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG COMMENT REACTION REPAIR v2";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(regex, replacement, label) {
  const count = countMatches(next, regex);
  if (count !== 1) {
    throw new Error(`Comment reaction repair aborted: ${label} expected 1 match, found ${count}.`);
  }
  next = next.replace(regex, replacement);
}

if (!next.includes(`/* ${MARKER} */`)) {
  /* 1) Exact crash: socialScope intentionally leaves selfMem null, but the old
     timeline builder dereferenced it anyway during public-thread bystander repair. */
  replaceOne(
    /\(selfMem\.witnessedEvents \|\| \[\]\)\.concat\(selfMem\.knownFacts \|\| \[\]\)/,
    "((selfMem && selfMem.witnessedEvents) || []).concat((selfMem && selfMem.knownFacts) || [])",
    "social-scope selfMem null guard"
  );

  /* 2) Wrap memory normalization without changing the stored schema. */
  replaceOne(
    /function\s+ensureCharMemory\s*\(/,
    "function legacyCommentRepairEnsureCharMemory(",
    "ensureCharMemory"
  );

  /* The Sims social layer already owns event consequences. Wrap only that layer
     so score/memory/reaction failures are isolated from one another. */
  replaceOne(
    /function\s+simsSocialApplyEventConsequences\s*\(/,
    "function legacyCommentRepairSimsSocialApplyEventConsequences(",
    "simsSocialApplyEventConsequences"
  );
  replaceOne(
    /function\s+recordSocialEvent\s*\(/,
    "function legacyCommentRepairRecordSocialEvent(",
    "recordSocialEvent"
  );

  /* 3) Player comment/reply goes to the front of the EXISTING queue. We do not
     change simEnqueue, the gate, cadence, or scheduler rules. */
  {
    const signalStart = next.indexOf("const signalSimulation = useCallback((event) => {");
    const signalEnd = signalStart >= 0
      ? next.indexOf("}, [requestSimulationAction]);", signalStart)
      : -1;
    if (signalStart < 0 || signalEnd < 0) {
      throw new Error("Comment reaction repair aborted: signalSimulation boundary not found.");
    }
    let signal = next.slice(signalStart, signalEnd);
    const priorityPattern = /("reply",\s*`event-reply:\$\{event\.postId\}:\$\{event\.commentId\}:\$\{naturalTarget \? naturalTarget\.id : "cast"\}`,[\s\S]*?trigger:\s*"player-comment",[\s\S]*?\}\s*,\s*)"coverage"/m;
    if (!priorityPattern.test(signal)) {
      throw new Error("Comment reaction repair aborted: player-comment queue source anchor not found.");
    }
    signal = signal.replace(priorityPattern, `$1"manual"`);
    next = next.slice(0, signalStart) + signal + next.slice(signalEnd);
  }

  /* 4) The reply generator was still sending the complete post thread and up to
     eight character cards. Keep only the focused thread slice and four relevant
     speakers; other reply surfaces are untouched. */
  {
    const genStart = next.indexOf("async function genReply(");
    const genEnd = genStart >= 0 ? next.indexOf("\nfunction applyReplies(", genStart) : -1;
    if (genStart < 0 || genEnd < 0) {
      throw new Error("Comment reaction repair aborted: genReply boundary not found.");
    }
    let block = next.slice(genStart, genEnd);
    const castPattern = /(const cast = \[\s*\.\.\.priorityCast,[\s\S]*?\.\.\.fairCast\.filter\([\s\S]*?\),\s*\]\.slice\(0, )8(\);)/m;
    if (!castPattern.test(block)) {
      throw new Error("Comment reaction repair aborted: genReply cast cap anchor not found.");
    }
    block = block.replace(castPattern, "$14$2");

    const threadPattern = /const th = threadOf\(\s*w,\s*post\s*\);/m;
    if (!threadPattern.test(block)) {
      throw new Error("Comment reaction repair aborted: genReply thread anchor not found.");
    }
    block = block.replace(threadPattern, "const th = compactPlayerReplyThread(w, post, comment);");
    next = next.slice(0, genStart) + block + next.slice(genEnd);
  }

  const helper = String.raw`

/* ${MARKER} */
const COMMENT_MEMORY_REPAIR_LOGGED = new Set();

function commentRepairCharacterLabel(w, id) {
  const c = id ? charById(w, id) : null;
  const name = c && c.name
    ? c.name
    : (w && w.meId === id && w.player && w.player.name ? w.player.name : "ismeretlen karakter");
  return { name: String(name || "ismeretlen karakter"), id: String(id || "") };
}

function commentRepairLogMissingMemory(w, id, fields) {
  const list = [...new Set((fields || []).filter(Boolean))];
  if (!list.length) return;
  const key = String(id || "") + ":" + list.sort().join(",");
  if (COMMENT_MEMORY_REPAIR_LOGGED.has(key)) return;
  COMMENT_MEMORY_REPAIR_LOGGED.add(key);
  const label = commentRepairCharacterLabel(w, id);
  console.warn(
    "[memory-repair] hiányzó karakter-emlék inicializálva",
    "name=" + label.name,
    "id=" + label.id,
    "fields=" + list.join(",")
  );
}

function ensureCharMemory(w, observerId) {
  if (!w || typeof w !== "object") return defaultCharacterMemory();
  const missing = [];

  if (!w.charMemory || typeof w.charMemory !== "object" || Array.isArray(w.charMemory)) {
    w.charMemory = {};
    missing.push("charMemory");
  }

  let mem = w.charMemory[observerId];
  if (!mem || typeof mem !== "object" || Array.isArray(mem)) {
    mem = defaultCharacterMemory();
    w.charMemory[observerId] = mem;
    missing.push("characterMemory");
  } else {
    const base = defaultCharacterMemory();
    Object.entries(base).forEach(([key, fallback]) => {
      if (mem[key] !== null && mem[key] !== undefined) return;
      mem[key] = Array.isArray(fallback)
        ? []
        : (fallback && typeof fallback === "object" ? { ...fallback } : fallback);
      missing.push(key);
    });
  }

  commentRepairLogMissingMemory(w, observerId, missing);
  return legacyCommentRepairEnsureCharMemory(w, observerId);
}

function compactPlayerReplyThread(w, post, focusComment) {
  const all = safePostComments(post);
  const byId = new Map(all.filter(Boolean).map((row) => [row.id, row]));
  const keep = new Set();
  const add = (row) => {
    if (row && row.id) keep.add(row.id);
  };

  add(focusComment);
  let parent = focusComment && focusComment.parent ? byId.get(focusComment.parent) : null;
  let depth = 0;
  while (parent && depth < 4) {
    add(parent);
    parent = parent.parent ? byId.get(parent.parent) : null;
    depth += 1;
  }

  all.slice(-10).forEach((row) => add(row));
  all
    .filter((row) => row && focusComment && row.parent === focusComment.id)
    .slice(-6)
    .forEach((row) => add(row));

  const selected = all
    .filter((row) => row && keep.has(row.id))
    .slice(-16);
  const label = {};
  selected.forEach((row, index) => { label[row.id] = "k" + (index + 1); });

  return {
    label,
    text: selected.map((row) => {
      const parentLabel = row.parent && label[row.parent]
        ? " (válasz erre: " + label[row.parent] + ")"
        : "";
      const body = String(row.text || "").replace(/\s+/g, " ").trim().slice(0, 320);
      return "[" + label[row.id] + "]" + parentLabel + " " + nameOfIn(w, row.authorId) + ": " + body;
    }).join("\n"),
  };
}

function commentRepairDeterministicDelta(w, event) {
  const base = Number(simsSocialToneDelta(event)) || 0;
  if (base) return base;

  const actorId = String(event && event.actorId || "");
  const type = String(event && event.type || "").toLowerCase();
  const source = String(event && event.source || "").toLowerCase();
  if (!w || actorId !== String(w.meId || "")) return 0;
  if (!(type === "comment" || type === "reply")) return 0;
  if (source && source !== "player") return 0;

  const text = String(event.text || "").toLowerCase();
  if (/gyűlöl|utál|undor|szánal|idióta|hülye|hazug|rohadj|kapd be|fuck you|hate|disgust|pathetic|idiot|liar/.test(text)) return -2;
  if (/bunkó|idegesít|bosszant|gáz|cringe|nevetséges|loser|annoying|stupid|rude/.test(text)) return -1;
  if (/szeretlek|imádlak|büszke vagyok|gyönyörű|csodálatos|love you|adore|proud of|gorgeous|beautiful/.test(text)) return 2;
  if (/köszi|köszön|gratul|bocsánat|sajnálom|cuki|szép|dögös|thanks|thank you|congrats|sorry|cute|pretty|hot/.test(text)) return 1;

  /* A normál, közvetlen nyilvános interakció is kapcsolatépítő mikro-esemény.
     Csak a bot -> játékos irány változik; a játékos érzését soha nem írjuk. */
  return 1;
}

function simsSocialApplyEventConsequences(w, event) {
  if (!w || !event || typeof event !== "object") return;
  const intel = ensureSocialIntelligenceState(w);
  const key = simsSocialEventKey(event);
  if (!key || (intel && intel.eventEffectsSeen && intel.eventEffectsSeen[key])) return;

  if (intel) {
    intel.eventEffectsSeen[key] = now();
    intel.eventEffectsSeen = simsSocialTrimLedger(intel.eventEffectsSeen);
  }

  const actorId = String(event.actorId || "");
  if (!actorId) return;
  const targets = [...new Set([
    ...(Array.isArray(event.targetIds) ? event.targetIds : []),
    ...((event.meta && Array.isArray(event.meta.participantIds)) ? event.meta.participantIds : []),
  ].map(String).filter((id) => id && id !== actorId))].slice(0, 8);

  const delta = commentRepairDeterministicDelta(w, event);

  for (const targetId of targets) {
    if (!charById(w, targetId)) continue;

    try {
      if (delta) {
        const before = getRel(w, targetId, actorId) || {};
        const beforeScore = Number(before.score) || 0;
        simsSocialApplyScoreDelta(w, targetId, actorId, delta);
        const after = getRel(w, targetId, actorId) || {};
        const afterScore = Number(after.score) || 0;
        if (afterScore !== beforeScore) {
          console.info(
            "[comment-relation] deterministic",
            "event=" + String(event.type || "event"),
            "from=" + targetId,
            "toward=" + actorId,
            "delta=" + String(afterScore - beforeScore),
            "score=" + beforeScore + "->" + afterScore
          );
        }
        if (!isHuman(w, actorId) && !isHuman(w, targetId)) {
          simsSocialApplyScoreDelta(w, actorId, targetId, delta > 0 ? 1 : -1);
        }
      }
    } catch (scoreErr) {
      console.warn("[comment-pipeline] relationship update failed; continuing", scoreErr);
    }

    try {
      if (typeof rememberAboutTarget === "function" && !isHuman(w, targetId) && simsSocialCanObserveEvent(w, targetId, event)) {
        const actor = charById(w, actorId);
        rememberAboutTarget(w, targetId, actorId, {
          kind: "event",
          source: "social_intelligence",
          confidence: 1,
          text: (actor ? actor.name : actorId) + " — " + String(event.type || "event") + ": " + String(event.text || "").replace(/\s+/g, " ").trim().slice(0, 320),
        });
      }
    } catch (memoryErr) {
      console.warn("[comment-pipeline] memory update failed; continuing", memoryErr);
    }

    try {
      simsSocialScheduleDirectReaction(w, event, targetId);
    } catch (reactionErr) {
      console.warn("[comment-pipeline] direct reaction scheduling failed; continuing", reactionErr);
    }

    try {
      simsSocialScheduleAttentionRivalry(w, event, targetId);
    } catch (rivalryErr) {
      console.warn("[comment-pipeline] rivalry scheduling failed; continuing", rivalryErr);
    }
  }
}

function recordSocialEvent(w, event = {}) {
  let result = null;
  try {
    result = legacyCommentRepairRecordSocialEvent(w, event);
  } catch (ledgerErr) {
    console.warn("[comment-pipeline] social ledger step failed; continuing", ledgerErr);
  }

  /* Run independently as a repair-safe step. The dedupe ledger makes this a
     no-op if the legacy wrapper already completed it successfully. */
  try {
    simsSocialApplyEventConsequences(w, event);
  } catch (consequenceErr) {
    console.warn("[comment-pipeline] deterministic consequence step failed; continuing", consequenceErr);
  }
  return result;
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied urgent comment repair: null-safe memory, isolated deterministic relationship impact, priority replies, compact reply thread.");
} else {
  console.log("Urgent comment reaction repair already applied.");
}
