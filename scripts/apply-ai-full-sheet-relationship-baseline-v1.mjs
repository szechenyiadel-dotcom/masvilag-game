import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG AI FULL-SHEET RELATIONSHIP BASELINE v1";

function replaceExactlyOnce(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) {
    throw new Error(`AI relationship baseline patch aborted: ${label} expected exactly one anchor.`);
  }
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes(`/* ${MARKER} */`)) {
  const inferDecl = "function inferCanonicalRelationshipBaseline(w, actor, target) {";
  const legacyInferDecl = "function legacyAiFullSheetInferCanonicalRelationshipBaseline(w, actor, target) {";
  replaceExactlyOnce(inferDecl, legacyInferDecl, "relationship baseline function");

  const runnerAnchor = 'if (action.type === "npc-pair-reaction") {';
  const handler = `if (action.type === "relationship-sheet-read") {
    const actorId = String(action.payload && action.payload.actorId || "");
    const targetId = String(action.payload && action.payload.targetId || "");
    const expectedHash = String(action.payload && action.payload.evidenceHash || "");
    const pendingKey = actorId + ">" + targetId;
    const actor = actorId ? charById(view, actorId) : null;
    const target = targetId ? charById(view, targetId) : null;
    if (!actor || !target || actorId === targetId) {
      aiRelationshipClearPending(view, pendingKey);
      return null;
    }

    const evidence = aiRelationshipEvidence(view, actor, target);
    if (!evidence.relevant || (expectedHash && evidence.hash !== expectedHash)) {
      aiRelationshipClearPending(view, pendingKey);
      return null;
    }

    const before = getRel(view, actorId, targetId) || {};
    const beforeSignature = aiRelationshipLiveSignature(before);
    const out = await genAiFullSheetRelationship(view, actor, target, evidence);

    if (!out || out.skip) {
      update((n) => aiRelationshipClearPending(n, pendingKey));
      return null;
    }

    update((n) => {
      const liveActor = charById(n, actorId);
      const liveTarget = charById(n, targetId);
      if (!liveActor || !liveTarget) {
        aiRelationshipClearPending(n, pendingKey);
        return;
      }

      const currentEvidence = aiRelationshipEvidence(n, liveActor, liveTarget);
      if (expectedHash && currentEvidence.hash !== expectedHash) {
        aiRelationshipClearPending(n, pendingKey);
        return;
      }

      const current = getRel(n, actorId, targetId) || {};
      if (aiRelationshipLiveSignature(current) !== beforeSignature) {
        aiRelationshipClearPending(n, pendingKey);
        return;
      }

      const normalized = aiRelationshipNormalizeOutput(out, current);
      if (!normalized) {
        aiRelationshipClearPending(n, pendingKey);
        return;
      }

      setRel(n, actorId, targetId, normalized);
      aiRelationshipClearPending(n, pendingKey);
      console.info(
        "[relationship-sheet-read]",
        "applied",
        "pair=" + pendingKey,
        "layers=" + String(normalized.bond || "").slice(0, 220)
      );
    });

    return "relationship-sheet-read";
  }

`;
  replaceExactlyOnce(runnerAnchor, handler + runnerAnchor, "relationship action runner");

  next += `

/* ${MARKER} */
const AI_RELATIONSHIP_RUNTIME_SKIP_KEYS = /^(?:aiContextSummary|aiVoiceStyleCard|avatar|avatarUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories|relationships|rels|relationship|socialEvents|sim|notifications|invitations|following|followers)$/i;
const AI_RELATIONSHIP_STRUCTURAL_KEY = /(?:job|occupation|profession|school|university|college|role|faction|team|organization|organisation|affiliation|dojo|class|rank|title|department|workplace|employer|club|group|academy|teacher|student|mentor|sensei|coach)/i;
const AI_RELATIONSHIP_ROLE_WORDS = /\\b(?:sensei|student|diák|tanuló|teacher|tanár|mentor|mentee|coach|edző|boss|főnök|employee|alkalmazott|intern|gyakornok|member|tag|leader|vezető|captain|kapitány|master|mester|apprentice|tanonc|senpai|kohai|doctor|orvos|nurse|ápoló|assistant|asszisztens)\\b/giu;

function aiRelationshipValueText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try { return String(value); } catch { return ""; }
  }
}

function aiRelationshipStableHash(value) {
  const text = String(value || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function aiRelationshipIdentityTokens(c) {
  if (!c || typeof c !== "object") return [];
  const raw = [
    c.name, c.displayName, c.username, c.handle, c.nick, c.nickname,
    c.firstName, c.lastName, c.fullName
  ].filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  const out = [];
  for (const value of raw) {
    const low = value.toLocaleLowerCase();
    if (low.length >= 2 && !out.includes(low)) out.push(low);
    for (const piece of low.split(/[^\\p{L}\\p{N}_-]+/u)) {
      if (piece.length >= 3 && !out.includes(piece)) out.push(piece);
    }
  }
  return out;
}

function aiRelationshipTextMentionsCharacter(text, c) {
  const low = String(text || "").toLocaleLowerCase();
  if (!low) return false;
  return aiRelationshipIdentityTokens(c).some((token) => low.includes(token));
}

function aiRelationshipFieldRows(c, predicate) {
  if (!c || typeof c !== "object") return [];
  const rows = [];
  for (const [key, raw] of Object.entries(c)) {
    if (AI_RELATIONSHIP_RUNTIME_SKIP_KEYS.test(key)) continue;
    if (!predicate(key, raw)) continue;
    const value = aiRelationshipValueText(raw);
    if (!value) continue;
    rows.push(key + ": " + value);
  }
  return rows;
}

function aiRelationshipConnectionsText(c) {
  if (!c || typeof c !== "object") return "";
  const keys = Object.keys(c).filter((key) => /^(?:connections?|kapcsolatok?|relationshipsCanon|relationshipCanon)$/i.test(key));
  return keys.map((key) => key + ": " + aiRelationshipValueText(c[key])).filter(Boolean).join("\\n\\n");
}

function aiRelationshipMentionRows(c, other) {
  return aiRelationshipFieldRows(c, (key, raw) => {
    if (/^(?:connections?|kapcsolatok?|relationshipsCanon|relationshipCanon)$/i.test(key)) return false;
    return aiRelationshipTextMentionsCharacter(aiRelationshipValueText(raw), other);
  });
}

function aiRelationshipStructuralRows(c) {
  return aiRelationshipFieldRows(c, (key) => AI_RELATIONSHIP_STRUCTURAL_KEY.test(key));
}

function aiRelationshipAffiliationCores(rows) {
  const out = [];
  for (const row of rows || []) {
    const value = String(row || "")
      .toLocaleLowerCase()
      .replace(AI_RELATIONSHIP_ROLE_WORDS, " ")
      .replace(/[^\\p{L}\\p{N}]+/gu, " ")
      .replace(/\\s+/g, " ")
      .trim();
    if (value.length >= 4 && !out.includes(value)) out.push(value);
  }
  return out;
}

function aiRelationshipSharedStructure(actorRows, targetRows) {
  const a = aiRelationshipAffiliationCores(actorRows);
  const b = aiRelationshipAffiliationCores(targetRows);
  const shared = [];
  for (const left of a) {
    for (const right of b) {
      if (left === right || (left.length >= 6 && right.includes(left)) || (right.length >= 6 && left.includes(right))) {
        const value = left.length <= right.length ? left : right;
        if (value && !shared.includes(value)) shared.push(value);
      }
    }
  }
  return shared;
}

function aiRelationshipEvidence(w, actor, target) {
  const actorConnections = aiRelationshipConnectionsText(actor);
  const targetConnections = aiRelationshipConnectionsText(target);
  const actorMentions = aiRelationshipMentionRows(actor, target);
  const targetMentions = aiRelationshipMentionRows(target, actor);
  const actorStructural = aiRelationshipStructuralRows(actor);
  const targetStructural = aiRelationshipStructuralRows(target);
  const sharedStructure = aiRelationshipSharedStructure(actorStructural, targetStructural);

  const directMention =
    aiRelationshipTextMentionsCharacter(actorConnections, target) ||
    actorMentions.length > 0;
  const reverseMention =
    aiRelationshipTextMentionsCharacter(targetConnections, actor) ||
    targetMentions.length > 0;
  const structuralTie = sharedStructure.length > 0;

  const actorName = String(actor.name || actor.displayName || actor.id || "Actor");
  const targetName = String(target.name || target.displayName || target.id || "Target");
  const text = [
    "PAIR DIRECTION: " + actorName + " [" + String(actor.id || "") + "] → " + targetName + " [" + String(target.id || "") + "]",
    "",
    "ACTOR CONNECTIONS — FULL, UNTRUNCATED AUTHOR SOURCE:",
    actorConnections || "(none)",
    "",
    "ACTOR OTHER SHEET FIELDS THAT MENTION TARGET — FULL FIELD VALUES:",
    actorMentions.length ? actorMentions.join("\\n\\n") : "(none)",
    "",
    "ACTOR STRUCTURAL ROLE / JOB / SCHOOL / FACTION / TEAM / DOJO DATA:",
    actorStructural.length ? actorStructural.join("\\n") : "(none)",
    "",
    "TARGET STRUCTURAL ROLE / JOB / SCHOOL / FACTION / TEAM / DOJO DATA:",
    targetStructural.length ? targetStructural.join("\\n") : "(none)",
    "",
    "SHARED STRUCTURAL AFFILIATION CANDIDATES:",
    sharedStructure.length ? sharedStructure.join(" | ") : "(none)",
    "",
    "REVERSE-DIRECTION CONNECTIONS — FULL SOURCE, OBJECTIVE HISTORY/STRUCTURE ONLY:",
    targetConnections || "(none)",
    "",
    "TARGET OTHER SHEET FIELDS THAT MENTION ACTOR — OBJECTIVE SHARED FACTS ONLY:",
    targetMentions.length ? targetMentions.join("\\n\\n") : "(none)",
  ].join("\\n");

  return {
    relevant: Boolean(directMention || reverseMention || structuralTie),
    directMention,
    reverseMention,
    structuralTie,
    text,
    hash: aiRelationshipStableHash(text),
  };
}

function aiRelationshipPendingState(w) {
  if (!w || typeof w !== "object") return null;
  if (!w.sim || typeof w.sim !== "object" || Array.isArray(w.sim)) w.sim = {};
  if (!w.sim.aiRelationshipBaselinePending || typeof w.sim.aiRelationshipBaselinePending !== "object" || Array.isArray(w.sim.aiRelationshipBaselinePending)) {
    w.sim.aiRelationshipBaselinePending = {};
  }
  return w.sim.aiRelationshipBaselinePending;
}

function aiRelationshipClearPending(w, key) {
  const pending = aiRelationshipPendingState(w);
  if (pending && key) delete pending[key];
}

function aiRelationshipQueueRead(w, actor, target, evidence) {
  if (!w || !actor || !target || !evidence || !evidence.relevant) return;
  if (typeof simEnqueue !== "function" || typeof mkAction !== "function") return;
  const pending = aiRelationshipPendingState(w);
  if (!pending) return;
  const key = String(actor.id || "") + ">" + String(target.id || "");
  if (!key || key === ">") return;
  if (pending[key] === evidence.hash) return;

  pending[key] = evidence.hash;
  simEnqueue(w, mkAction(
    "relationship-sheet-read",
    "relationship-sheet-read:" + key + ":" + evidence.hash,
    {
      actorId: actor.id,
      targetId: target.id,
      evidenceHash: evidence.hash,
    },
    "memory"
  ));
}

function aiRelationshipChunkText(text, max = 16000) {
  const value = String(text || "");
  if (value.length <= max) return [value];
  const chunks = [];
  let at = 0;
  while (at < value.length) {
    let end = Math.min(value.length, at + max);
    if (end < value.length) {
      const newline = value.lastIndexOf("\\n", end);
      if (newline > at + Math.floor(max * 0.65)) end = newline + 1;
    }
    chunks.push(value.slice(at, end));
    at = end;
  }
  return chunks;
}

async function aiRelationshipExtractChunk(w, actor, target, chunk, index, total) {
  const prompt = [
    "RELATIONSHIP SHEET SOURCE PASS " + (index + 1) + "/" + total + ".",
    "Read the ENTIRE source block below. Extract EVERY fact in this block that can define " + String(actor.name || actor.id) + " → " + String(target.name || target.id) + ".",
    "Do not flatten multiple simultaneous relationships. Keep formal hierarchy, shared institution/faction/dojo, personal history, friendship, rivalry, hostility, romance, family, power imbalance, loyalty, distrust, secrecy and one-sided feelings as separate facts when present.",
    "Direction is hard: reverse-direction private feelings may NOT be copied into the actor. Reverse source may only supply objective shared history or structural facts.",
    "Never infer student/teacher/mentor/etc from age or stereotype. Structural roles require actual sheet evidence. If the same named dojo/team/school/workplace plus complementary roles establish a real relation (e.g. Sensei + student), record that structural relation.",
    "Do not quote distinctive source sentences. Preserve facts, not wording.",
    "SOURCE BLOCK:",
    chunk,
    "JSON ONLY:",
    '{"facts":["all relevant facts from this block"],"structural":["formal/organizational layers"],"personal":["personal/history/emotional layers"],"hidden":["actor awareness/secrecy facts"]}'
  ].join("\\n\\n");

  try {
    return await askWorldJSON(w, engineFor(w), prompt, {
      maxTokens: 1800,
      priority: 55,
      source: "relationship-sheet-read",
    });
  } catch {
    return null;
  }
}

function aiRelationshipExtractionText(rows) {
  const out = [];
  for (const row of rows || []) {
    if (!row || typeof row !== "object") continue;
    for (const key of ["facts", "structural", "personal", "hidden"]) {
      const values = Array.isArray(row[key]) ? row[key] : [];
      for (const value of values) {
        const text = String(value || "").trim();
        if (text && !out.includes(text)) out.push(text);
      }
    }
  }
  return out.join("\\n- ");
}

async function genAiFullSheetRelationship(w, actor, target, evidence) {
  if (!evidence || !evidence.relevant) return { skip: true };
  const chunks = aiRelationshipChunkText(evidence.text, 16000);
  let sourceForSynthesis = evidence.text;

  if (chunks.length > 1) {
    const extracted = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const row = await aiRelationshipExtractChunk(w, actor, target, chunks[i], i, chunks.length);
      if (!row || row.skip) return null;
      extracted.push(row);
    }
    sourceForSynthesis = "FACTS EXTRACTED FROM " + chunks.length + " COMPLETE SOURCE PASSES:\\n- " + aiRelationshipExtractionText(extracted);
  }

  const actorName = String(actor.name || actor.id || "Actor");
  const targetName = String(target.name || target.id || "Target");
  const prompt = [
    "FRESH-WORLD RELATIONSHIP BASELINE — FULL-SHEET AI INTERPRETATION.",
    "Build ONLY the directed relationship " + actorName + " → " + targetName + ".",
    "SOURCE PRIORITY: explicit ACTOR Connections and explicit actor-sheet statements are highest authority. Then objective shared history/structure. Derived structural ties may coexist with explicit personal ties unless the sheet directly contradicts them.",
    "MULTI-LAYER RULE — HARD: preserve EVERY relationship layer supported by the source. Never collapse mentor–student + rivalry into only rivalry, or same-dojo + friendship into only friendship. Formal/structural and personal/emotional relations can exist simultaneously.",
    "STRUCTURAL INFERENCE RULE: if actual sheet fields establish complementary roles inside the same named institution/faction/team/dojo/workplace — e.g. Iron Dragons Sensei + Iron Dragons student — include mentor–student / teacher–student as a relationship layer even if Connections does not spell it out. Similar logic applies to coach–athlete, boss–employee, senior–junior, supervisor–intern, etc. Do not infer any role from age or stereotype.",
    "DIRECTION RULE: do not copy the target's private feelings back into the actor. Reverse-direction Connections can support objective shared history/structure only.",
    "DETAIL RULE: description must be detailed enough to preserve how they know each other, formal hierarchy or shared affiliation, major history, current personal/emotional dynamic, conflict/loyalty/attraction if present, and important one-sided or hidden nuance. Aim for 3–6 substantive sentences when the source is rich.",
    "PARAPHRASE RULE — HARD: never copy the user's Connections sentences word-for-word and never reuse a distinctive long phrase. State the same meaning naturally in your own words.",
    "SCORE is only coarse affinity from -100 to 100. It must never erase structural layers. A mentor can also be hated; a rival can also be a friend; an ex can also be a coworker, etc.",
    "SOURCE MATERIAL:",
    sourceForSynthesis,
    "JSON ONLY:",
    '{"types":["EVERY applicable relationship layer, most important first"],"bond":"compact combined label preserving the important layers","description":"detailed 3–6 sentence paraphrased relationship description","score":0,"hidden":"actor-side secrecy/self-awareness nuance or empty","why":"concise paraphrased basis for this baseline"}'
  ].join("\\n\\n");

  try {
    return await askWorldJSON(w, engineFor(w), prompt, {
      maxTokens: 2200,
      priority: 55,
      source: "relationship-sheet-read",
    });
  } catch {
    return null;
  }
}

function aiRelationshipLiveSignature(rel) {
  const r = rel || {};
  return JSON.stringify({
    score: Number(r.score) || 0,
    bond: String(r.bond || r.type || ""),
    mood: String(r.mood || ""),
    hidden: String(r.hidden || ""),
    why: String(r.why || ""),
    source: String(r.source || ""),
    fixed: Boolean(r.fixed),
  });
}

function aiRelationshipNormalizeOutput(out, current) {
  if (!out || typeof out !== "object") return null;
  const types = (Array.isArray(out.types) ? out.types : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .slice(0, 12);

  let bond = String(out.bond || "").trim();
  if (!bond && types.length) bond = types.join(" + ");
  const description = String(out.description || "").trim();
  const hidden = String(out.hidden || "").trim();
  const why = String(out.why || "").trim();
  let score = Number(out.score);
  if (!Number.isFinite(score)) score = Number(current && current.score) || 0;
  score = Math.max(-100, Math.min(100, Math.round(score)));

  if (!bond && !description && !why) return null;

  const existingScore = Number(current && current.score) || 0;
  const existingBond = String(current && (current.bond || current.type) || "");
  if (existingScore <= -80 && score > -30) score = existingScore;
  if (existingScore <= -80 && /enemy|ellens/i.test(existingBond) && !/enemy|ellens/i.test(bond)) {
    bond = [existingBond, bond].filter(Boolean).join(" + ");
  }

  return {
    score,
    bond: (current && current.fixed && existingBond) ? existingBond : bond.slice(0, 500),
    mood: description.slice(0, 4000),
    hidden: hidden.slice(0, 1200),
    why: (why || description).slice(0, 2500),
    source: "sheet-ai-v1",
    fixed: Boolean(current && current.fixed),
  };
}

function inferCanonicalRelationshipBaseline(w, actor, target) {
  const base = legacyAiFullSheetInferCanonicalRelationshipBaseline(w, actor, target);
  if (!w || !actor || !target || actor.id === target.id) return base;

  const evidence = aiRelationshipEvidence(w, actor, target);
  if (evidence.relevant) {
    aiRelationshipQueueRead(w, actor, target, evidence);
  }
  return base;
}
`;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] ai-full-sheet-relationship-baseline=v1 applied; scope=relationship-baseline-only");
} else {
  console.log("[patch-status] ai-full-sheet-relationship-baseline=v1 already applied");
}
