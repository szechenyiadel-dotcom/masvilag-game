import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const policyPath = path.join(root, "src", "socialWorldPolicy.js");
const marker = "MÁSVILÁG SIMS SOCIAL INTELLIGENCE v1";
const policyMarker = "SIMS SOCIAL CONTEXT + ATTENTION CONSEQUENCES — HARD CONTRACT";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(text, regex, replacement, label) {
  const n = countMatches(text, regex);
  if (n !== 1) {
    throw new Error(`Sims social intelligence patch aborted: ${label} expected 1 match, found ${n}.`);
  }
  return text.replace(regex, replacement);
}

function patchPolicy(original) {
  if (original.includes(policyMarker)) return { changed: false, text: original };
  let next = original;
  const anchor = "const COMMENT_POLICY = `";
  if (!next.includes(anchor)) {
    throw new Error("Sims social intelligence patch aborted: COMMENT_POLICY anchor not found.");
  }

  const block = `const SIMS_SOCIAL_CONTEXT_POLICY = \`
${policyMarker}
Every social action must be chosen from the CURRENT world state, not from a generic trope.

CONTEXT ORDER — RESOLVE ALL OF THESE BEFORE ACTING:
1. WORLD: obey the active world's rules, era/year, tone, social norms, technology level and current public timeline.
2. PLAYER PUBLIC PROFILE: characters may use only the player's public profile/bio facts plus things personally learned in-world. Public profile is not permission to read the player's private author notes.
3. SELF: the acting character may use their own complete character sheet, including private goals, fears, preferences, secrets, denied feelings and hidden motives; if a feeling is explicitly subconscious, it may shape behavior without becoming conscious dialogue.
4. DIRECTIONAL RELATIONSHIP: A→B and B→A are separate. Never infer reciprocity. Use current live score/state first once the story has evolved, with source canon as baseline history.
5. PERSONALITY EXPRESSION: the same trigger must look different in different people. A calm/private character may withdraw, go quiet or ask privately; an impulsive/proud character may confront; a playful person may tease; a detached person may genuinely not care. Drama is never mandatory.
6. KNOWLEDGE: act only on public/witnessed/received/stored facts. Private DMs belong only to participants. Do not transfer one speaker's secret knowledge to another speaker in a shared model call.

PLAYER ACTION AWARENESS:
- Public likes, comments, replies, follows, unfollows, tags/mentions and visible patterns of repeated attention may become social evidence when the character could actually see them.
- A character may notice that the player repeatedly gives another person attention and react according to personality + live relationship: curiosity, jealousy, protectiveness, teasing, hurt, withdrawal, confrontation, a private question, an indirect post, or no reaction.
- Not replying to a private message may be noticed by the sender after meaningful time has passed, but silence is NOT proof of motive. Do not invent why the player has not replied.
- Do not treat the absence of a like/comment as a major insult by default. It matters only when the relationship/personality/history makes that omission salient.
- Severe public conflict may lead to a public callout/cancel-style escalation only when the actor is the sort of person who would do that AND there is a concrete, proportionate public trigger. Never manufacture pile-ons for filler.

AI↔AI SOCIAL LIFE:
- AI characters share the same public timeline and may react to each other's posts, comments, follows/unfollows and witnessed interactions without centering the player.
- AI↔AI interactions may change BOTH directional relationships independently, create persistent memories, alter later tone, produce support/rivalry/reconciliation, and remain relevant in later posts/DMs/groups/scenes.
- Attention rivalry is allowed when multiple characters have a strong, current attachment to the same person and a concrete visible trigger exists. Rivalry is never automatic merely because two characters have positive scores.
- Friends/allies may defend each other; rivals may needle or undermine each other; enemies may openly clash; reserved people may avoid public spectacle.
- Reconciliation is as real as conflict. Repeated positive contact can soften hostility; apologies and repair can matter; one event does not instantly erase deep history.

FOLLOW / UNFOLLOW:
- Follow state is meaningful social evidence and may affect live relationship scores in small, bounded steps.
- Following/following back can be pleasant or meaningful; being unfollowed can sting, anger or not matter at all depending on personality and current relationship.
- A character may react in DM/post/comment only when that reaction is plausible for them. Do not force a message for every follow event.
- AI characters may follow/unfollow one another from relationship evolution, but startup/bootstrap auto-follow normalization is not an in-world dramatic event.

CHARACTER SHEET SUMMARY CACHE:
- Treat the stored public summary as what can safely represent public/profile facts about that person.
- Treat the stored private summary as self/author-level context for portraying that character only.
- Prefer the summary + relevant current memories/relationship/event context over re-sending a giant raw sheet on every request.
- If a sheet changed, the summary is stale and must refresh; until refresh completes, use the deterministic fallback digest without inventing missing facts.

HUNGARIAN OUTPUT:
- When the active language is Hungarian, use natural, grammatically correct Hungarian.
- Address the player's character in second-person singular (te/neked/veled), and let the speaking character refer to themself in first-person singular (én/nekem/velem).
- Avoid malformed forms such as "nekedet". Do not translate mechanically if a natural Hungarian phrasing exists.
\`;

`;

  next = next.replace(anchor, block + anchor);

  const oldCombined = /const combinedPolicy = `\$\{RELATIONSHIP_POLICY\}\\n\$\{CONVERSATION_REALITY_POLICY\}\\n(?:\$\{DM_SCENE_INITIATIVE_POLICY\}\\n)?(?:\$\{KNOWLEDGE_AND_LIVING_SOCIAL_POLICY\}\\n)?\$\{COMMENT_POLICY\}\\n\$\{SIMS_WORLD_POLICY\}\\n\$\{RHYTHM_POLICY\}`;/;
  const match = next.match(oldCombined);
  if (!match) {
    throw new Error("Sims social intelligence patch aborted: combinedPolicy anchor not found.");
  }
  const combined = match[0].replace("${COMMENT_POLICY}", "${SIMS_SOCIAL_CONTEXT_POLICY}\\n${COMMENT_POLICY}");
  next = next.replace(oldCombined, combined);
  return { changed: next !== original, text: next };
}

function patchApp(original) {
  if (original.includes(`/* ${marker} */`)) return { changed: false, text: original };
  let next = original;

  const renames = [
    [/function\s+worldContext\s*\(/, "function legacySimsSocialWorldContext(", "worldContext"],
    [/function\s+voiceCard\s*\(/, "function legacySimsSocialVoiceCard(", "voiceCard"],
    [/function\s+relationshipBehaviorCard\s*\(/, "function legacySimsSocialRelationshipBehaviorCard(", "relationshipBehaviorCard"],
    [/function\s+recordSocialEvent\s*\(/, "function legacySimsSocialRecordSocialEvent(", "recordSocialEvent"],
    [/function\s+setFollowState\s*\(/, "function legacySimsSocialSetFollowState(", "setFollowState"],
  ];

  for (const [regex, replacement, label] of renames) {
    next = replaceOne(next, regex, replacement, label);
  }

  const runnerAnchor = /if \(action\.type === "npc-pair-reaction"\) \{/;
  if (!runnerAnchor.test(next)) {
    throw new Error("Sims social intelligence patch aborted: npc-pair-reaction handler anchor not found.");
  }

  const summaryHandler = `if (action.type === "sheet-summary-refresh") {
    const charId = action.payload && action.payload.charId;
    const expectedHash = action.payload && action.payload.sourceHash;
    const c = charId ? charById(view, charId) : null;
    if (!c) return null;

    const before = ensureCharacterContextSummary(c);
    if (expectedHash && before.sourceHash !== expectedHash) return null;

    const out = await genCharacterSheetSummary(view, c);
    if (!out) return null;

    update((n) => {
      const live = charById(n, charId);
      if (!live) return;
      const current = ensureCharacterContextSummary(live);
      if (expectedHash && current.sourceHash !== expectedHash) return;

      const publicSummary = String(out.publicSummary || "").trim().slice(0, 5000);
      const privateSummary = String(out.privateSummary || "").trim().slice(0, 7000);
      live.aiContextSummary = {
        version: 1,
        sourceHash: current.sourceHash,
        public: publicSummary || current.public,
        private: privateSummary || current.private,
        updatedAt: now(),
        generatedBy: publicSummary || privateSummary ? "ai" : current.generatedBy,
        pending: false,
      };

      const intel = ensureSocialIntelligenceState(n);
      intel.summaryJobs[charId] = {
        hash: current.sourceHash,
        lastFinishedAt: now(),
        pending: false,
      };
    });
    return "sheet-summary-refresh";
  }

`;
  next = next.replace(runnerAnchor, summaryHandler + 'if (action.type === "npc-pair-reaction") {');

  const helper = `

/* ${marker} */
const SIMS_SOCIAL_WORLD_CONTEXT_CAP = 22000;
const SIMS_SOCIAL_SUMMARY_PUBLIC_CAP = 5000;
const SIMS_SOCIAL_SUMMARY_PRIVATE_CAP = 7000;
const SIMS_SOCIAL_SUMMARY_INPUT_CAP = 24000;
const SIMS_SOCIAL_REACTION_COOLDOWN_MS = 12 * 60 * 1000;

function ensureSocialIntelligenceState(w) {
  if (!w || typeof w !== "object") return null;
  if (!w.sim || typeof w.sim !== "object" || Array.isArray(w.sim)) w.sim = {};
  if (!w.sim.socialIntelligence || typeof w.sim.socialIntelligence !== "object" || Array.isArray(w.sim.socialIntelligence)) {
    w.sim.socialIntelligence = {};
  }
  const s = w.sim.socialIntelligence;
  if (!s.version) s.version = 1;
  if (!s.eventEffectsSeen || typeof s.eventEffectsSeen !== "object" || Array.isArray(s.eventEffectsSeen)) s.eventEffectsSeen = {};
  if (!s.summaryJobs || typeof s.summaryJobs !== "object" || Array.isArray(s.summaryJobs)) s.summaryJobs = {};
  if (!s.lastDirectReaction || typeof s.lastDirectReaction !== "object" || Array.isArray(s.lastDirectReaction)) s.lastDirectReaction = {};
  if (!s.lastAttentionReaction || typeof s.lastAttentionReaction !== "object" || Array.isArray(s.lastAttentionReaction)) s.lastAttentionReaction = {};
  return s;
}

function simsSocialStableHash(value) {
  const text = String(value || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function simsSocialStringify(value, depth = 0) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (depth >= 2) return "";
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => simsSocialStringify(item, depth + 1)).filter(Boolean).join(" | ");
  }
  if (typeof value === "object") {
    return Object.entries(value).slice(0, 120).map(([key, item]) => {
      const txt = simsSocialStringify(item, depth + 1);
      return txt ? key + ": " + txt : "";
    }).filter(Boolean).join("\n");
  }
  return "";
}

function simsSocialSectionDigest(text, max = SIMS_SOCIAL_SUMMARY_INPUT_CAP) {
  const value = String(text || "").replace(/\r\n/g, "\n").trim();
  if (value.length <= max) return value;

  const pieces = value.split(/(?=^\s*(?:#{1,6}\s+|[A-ZÁÉÍÓÖŐÚÜŰ][A-ZÁÉÍÓÖŐÚÜŰ0-9 _/()'-]{2,}:)\s*)/gmi)
    .map((x) => x.trim()).filter(Boolean);
  if (pieces.length <= 1) {
    const chunk = Math.max(700, Math.floor(max / 8));
    const starts = [0, .14, .28, .42, .56, .70, .84, 1].map((ratio) => Math.max(0, Math.floor((value.length - chunk) * ratio)));
    return starts.map((at) => value.slice(at, at + chunk)).join("\n...[sampled]...\n").slice(0, max);
  }

  const per = Math.max(420, Math.floor(max / Math.min(24, pieces.length)));
  const selected = pieces.slice(0, 24).map((part) => {
    if (part.length <= per) return part;
    const head = Math.floor(per * .7);
    const tail = per - head - 30;
    return part.slice(0, head) + "\n...[section compacted]...\n" + part.slice(-Math.max(0, tail));
  });
  return selected.join("\n\n").slice(0, max);
}

function characterSheetSourceParts(c) {
  if (!c || typeof c !== "object") return { publicText: "", privateText: "" };
  const skip = /^(?:aiContextSummary|avatar|avatarUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories)$/i;
  const publicKey = /^(?:id|name|username|handle|bio|publicBio|displayName|age|birthday|birthDate|gender|pronouns|city|location|job|occupation|school|university|role|faction|team|public|appearance|height|nationality)$/i;
  const rowsPublic = [];
  const rowsPrivate = [];

  for (const [key, raw] of Object.entries(c)) {
    if (skip.test(key)) continue;
    const value = simsSocialStringify(raw);
    if (!value) continue;
    const row = key + ": " + value;
    if (publicKey.test(key)) rowsPublic.push(row);
    else rowsPrivate.push(row);
  }

  return {
    publicText: rowsPublic.join("\n"),
    privateText: rowsPrivate.join("\n"),
  };
}

function ensureCharacterContextSummary(c) {
  const parts = characterSheetSourceParts(c);
  const publicDigest = simsSocialSectionDigest(parts.publicText, SIMS_SOCIAL_SUMMARY_PUBLIC_CAP);
  const privateDigest = simsSocialSectionDigest(parts.privateText, SIMS_SOCIAL_SUMMARY_PRIVATE_CAP);
  const sourceHash = simsSocialStableHash(parts.publicText + "\n---PRIVATE---\n" + parts.privateText);
  const current = c && c.aiContextSummary && typeof c.aiContextSummary === "object" ? c.aiContextSummary : null;

  if (current && current.version === 1 && current.sourceHash === sourceHash && current.public && current.private) {
    return current;
  }

  const fallback = {
    version: 1,
    sourceHash,
    public: publicDigest,
    private: [publicDigest, privateDigest].filter(Boolean).join("\n\n").slice(0, SIMS_SOCIAL_SUMMARY_PRIVATE_CAP),
    updatedAt: now(),
    generatedBy: "deterministic-fallback",
    pending: true,
  };
  if (c && typeof c === "object") c.aiContextSummary = fallback;
  return fallback;
}

function maybeQueueCharacterSummary(w, c) {
  if (!w || !c || !c.id) return;
  const summary = ensureCharacterContextSummary(c);
  if (!summary.pending && summary.generatedBy === "ai") return;
  const intel = ensureSocialIntelligenceState(w);
  if (!intel) return;
  const previous = intel.summaryJobs[c.id] || {};
  const sameHash = previous.hash === summary.sourceHash;
  const recent = sameHash && (now() - (Number(previous.lastQueuedAt) || 0) < 10 * 60 * 1000);
  if (recent || previous.pending) return;
  if (typeof simEnqueue !== "function" || typeof mkAction !== "function") return;

  intel.summaryJobs[c.id] = {
    hash: summary.sourceHash,
    lastQueuedAt: now(),
    pending: true,
  };
  simEnqueue(w, mkAction(
    "sheet-summary-refresh",
    "sheet-summary:" + c.id + ":" + summary.sourceHash,
    { charId: c.id, sourceHash: summary.sourceHash },
    "memory"
  ));
}

async function genCharacterSheetSummary(w, c) {
  const parts = characterSheetSourceParts(c);
  const publicInput = simsSocialSectionDigest(parts.publicText, 8000);
  const privateInput = simsSocialSectionDigest(parts.privateText, 16000);
  const prompt = [
    "CHARACTER SHEET ONE-TIME SUMMARY REFRESH.",
    "Summarize only supplied facts. Never invent. Preserve contradictions, relationship nuance, family, goals, fears, values, speech style, habits, hobbies, preferences, secrets and important history when present.",
    "PUBLIC SUMMARY contains only facts safe as public/profile/background-visible information.",
    "PRIVATE SUMMARY is for portraying THIS CHARACTER and may include their private/hidden author-level facts. Do not turn another person's secrets into this character's knowledge.",
    "Write compact Hungarian if the source is mainly Hungarian; otherwise keep the source language naturally.",
    "PUBLIC SOURCE DIGEST:\n" + (publicInput || "(none)"),
    "PRIVATE SOURCE DIGEST:\n" + (privateInput || "(none)"),
    "JSON ONLY:",
    '{"publicSummary":"max ~3500 chars","privateSummary":"max ~5500 chars"}'
  ].join("\n\n");

  try {
    return await askWorldJSON(w, engineFor(w), prompt, {
      maxTokens: 1500,
      priority: -15,
      source: "sheet-summary",
    });
  } catch (err) {
    return null;
  }
}

function simsSocialRelevantIds(w, focusIds, actorId) {
  const out = [];
  const add = (id) => {
    const value = String(id || "").trim();
    if (value && !out.includes(value)) out.push(value);
  };
  add(actorId);
  if (Array.isArray(focusIds)) focusIds.forEach(add);
  else add(focusIds);
  if (w && w.meId) add(w.meId);
  return out.slice(0, 8);
}

function simsSocialSummaryLens(w, focusIds, actorId) {
  if (!w) return "";
  const ids = simsSocialRelevantIds(w, focusIds, actorId);
  const rows = [];
  for (const id of ids) {
    const c = charById(w, id);
    if (!c) continue;
    const summary = ensureCharacterContextSummary(c);
    maybeQueueCharacterSummary(w, c);
    const mayUsePrivate = id === actorId;
    rows.push(
      "CHARACTER " + String(c.name || id) + " [" + id + "] — " + (mayUsePrivate ? "SELF/PRIVATE SUMMARY" : "PUBLIC SUMMARY") + ":\n" +
      String(mayUsePrivate ? summary.private : summary.public || "(none)")
    );
  }
  return rows.length ? "CHARACTER SUMMARY LENS — STORED, RELEVANT ONLY:\n" + rows.join("\n\n") : "";
}

function simsSocialCompactWorldContext(w, text, focusIds, actorId) {
  const value = String(text || "");
  const lens = simsSocialSummaryLens(w, focusIds, actorId);
  const lensRoom = lens ? Math.min(8500, lens.length + 120) : 0;
  const mainCap = Math.max(9000, SIMS_SOCIAL_WORLD_CONTEXT_CAP - lensRoom);
  let main = value;

  if (value.length > mainCap) {
    const relevantIds = simsSocialRelevantIds(w, focusIds, actorId);
    const names = relevantIds.map((id) => {
      const c = charById(w, id);
      return c ? String(c.name || "") : "";
    }).filter(Boolean);
    const important = new RegExp(
      ["world", "világ", "rule", "szabály", "era", "korszak", "year", "év", "current", "jelen", "recent", "legutóbbi", "memory", "emlék", "relationship", "kapcsolat", "public", "nyilvános", "group", "csoport", "scene", "jelenet", "event", "esemény"]
        .concat(relevantIds, names)
        .filter(Boolean)
        .map((x) => String(x).replace(/[.*+?^$()|{}[\]\\]/g, "\\$&"))
        .join("|"),
      "i"
    );

    const blocks = value.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    const selected = [];
    let used = 0;
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (!(i < 4 || important.test(block))) continue;
      const room = mainCap - used;
      if (room <= 0) break;
      const clipped = block.length > room ? block.slice(0, Math.max(0, room - 40)) + "\n...[context compacted]..." : block;
      selected.push(clipped);
      used += clipped.length + 2;
    }
    if (used < Math.min(6000, mainCap * .45)) {
      const room = Math.max(0, mainCap - used - 70);
      selected.push("RECENT CONTEXT TAIL:\n" + value.slice(-Math.min(room, 4500)));
    }
    main = selected.join("\n\n").slice(0, mainCap);
  }

  return [main, lens].filter(Boolean).join("\n\n").slice(0, SIMS_SOCIAL_WORLD_CONTEXT_CAP + 1500);
}

function worldContext(...args) {
  const out = legacySimsSocialWorldContext(...args);
  const w = args[0];
  const focusIds = args[1];
  const actorId = args.length >= 4 ? args[3] : "";
  return simsSocialCompactWorldContext(w, out, focusIds, actorId);
}

function voiceCard(...args) {
  const base = String(legacySimsSocialVoiceCard(...args) || "");
  const c = args[0];
  if (!c || typeof c !== "object") return base;
  const summary = ensureCharacterContextSummary(c);
  const privateSummary = String(summary.private || "").slice(0, 5200);
  if (!privateSummary) return base;
  return [
    base,
    "SELF CHARACTER SHEET SUMMARY — PRIVATE PORTRAYAL CONTEXT, DO NOT LEAK AS OTHER PEOPLE'S KNOWLEDGE:",
    privateSummary,
  ].filter(Boolean).join("\n\n");
}

function simsSocialCanObserveEvent(w, observerId, event) {
  if (!w || !observerId || !event) return false;
  if (String(event.actorId || "") === String(observerId)) return true;
  const visibility = String(event.visibility || "public").toLowerCase();
  if (visibility === "public") return true;
  const targets = Array.isArray(event.targetIds) ? event.targetIds.map(String) : [];
  if (targets.includes(String(observerId))) return true;
  const participants = event.meta && Array.isArray(event.meta.participantIds) ? event.meta.participantIds.map(String) : [];
  return participants.includes(String(observerId));
}

function simsSocialUnansweredPrivateCard(w, actorId, targetId) {
  if (!w || !actorId || !targetId || typeof chatKey !== "function") return "";
  const rows = w.chats && w.chats[chatKey(actorId, targetId)];
  if (!Array.isArray(rows) || !rows.length) return "";
  const ordered = rows.filter(Boolean).slice(-40);
  let latestActorIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (String(ordered[i].from || ordered[i].authorId || "") === String(actorId)) {
      latestActorIndex = i;
      break;
    }
  }
  if (latestActorIndex < 0) return "";
  const laterReply = ordered.slice(latestActorIndex + 1).some((row) => String(row.from || row.authorId || "") === String(targetId));
  if (laterReply) return "";
  const ts = Number(ordered[latestActorIndex].ts) || 0;
  if (ts && now() - ts < 8 * 60 * 1000) return "";
  return "PRIVATE RESPONSE STATUS: your latest private message to this person has not received a later reply yet. You may notice the silence if your personality/relationship makes it salient, but you do NOT know the reason and must not invent one.";
}

function simsSocialPlayerActivityCard(w, observerId) {
  if (!w || !w.meId || !observerId) return "";
  const events = (w.socialEvents || [])
    .filter((event) => event && String(event.actorId || "") === String(w.meId) && simsSocialCanObserveEvent(w, observerId, event))
    .slice(-60)
    .reverse()
    .slice(0, 10)
    .map((event) => {
      const targets = (event.targetIds || []).map((id) => {
        const c = charById(w, id);
        return c ? c.name : id;
      }).filter(Boolean).join(", ");
      return "- " + String(event.type || "event") + (targets ? " → " + targets : "") + ": " + String(event.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    });
  return events.length ? "VISIBLE RECENT PLAYER ACTIVITY — evidence only, newest first:\n" + events.join("\n") : "";
}

function simsSocialRivalryCard(w, actorId) {
  if (!w || !w.meId || !actorId || actorId === w.meId) return "";
  const actorRel = getRel(w, actorId, w.meId) || {};
  const actorText = [actorRel.bond, actorRel.type, actorRel.mood, actorRel.hidden].filter(Boolean).join(" ").toLowerCase();
  const actorScore = Number(actorRel.score) || 0;
  const attached = actorScore >= 55 || /love|szerel|crush|vonz|attract|jealous|féltéken|possess|birtokl|obsess|megszáll/.test(actorText);
  if (!attached) return "";

  const rivals = (w.chars || []).filter((c) => c && c.id !== actorId && c.id !== w.meId && !isHuman(w, c.id)).map((c) => {
    const rel = getRel(w, c.id, w.meId) || {};
    const txt = [rel.bond, rel.type, rel.mood, rel.hidden].filter(Boolean).join(" ").toLowerCase();
    const score = Number(rel.score) || 0;
    const strong = score >= 55 || /love|szerel|crush|vonz|attract|obsess|megszáll/.test(txt);
    return strong ? { id: c.id, name: c.name, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);
  if (!rivals.length) return "";
  return "POTENTIAL ATTENTION RIVALS — not automatic enemies, react only to a concrete known trigger and according to personality:\n" + rivals.map((r) => "- " + r.name + " (attachment score " + r.score + ")").join("\n");
}

function simsSocialReactionStyle(c) {
  if (!c) return "";
  const summary = ensureCharacterContextSummary(c);
  const text = String(summary.private || "").toLowerCase();
  if (/calm|nyugodt|reserved|visszafogott|stoic|sztoikus|private|zárkózott|shy|félénk/.test(text)) {
    return "REACTION STYLE: this character tends toward quiet/private/contained reactions. Do not force public drama.";
  }
  if (/impulsive|impulzív|hot[- ]?headed|lobbanékony|confront|konfront|aggressive|agressz|dramatic|drámai|proud|büszke/.test(text)) {
    return "REACTION STYLE: this character may confront or react visibly when a real trigger exists, but must not invent one.";
  }
  if (/playful|játékos|teasing|csipkelőd|sarcastic|szarkaszt|humor/.test(text)) {
    return "REACTION STYLE: teasing, humor or indirect remarks may fit better than melodrama when context supports it.";
  }
  return "REACTION STYLE: choose intensity from this character's actual personality; silence/no reaction is valid.";
}

function simsSocialRelationshipContextCard(w, actorId, targetId) {
  if (!w || !actorId || !targetId) return "";
  const actor = charById(w, actorId);
  const target = charById(w, targetId);
  if (!actor || !target) return "";
  const forward = getRel(w, actorId, targetId) || {};
  const reverse = getRel(w, targetId, actorId) || {};
  const pieces = [
    "CONTEXT-SENSITIVE SOCIAL BEHAVIOR — CURRENT LENS:",
    "DIRECTIONAL LIVE STATE: " + actor.name + "→" + target.name + " score=" + (Number(forward.score) || 0) + "; " + target.name + "→" + actor.name + " score=" + (Number(reverse.score) || 0) + ". Never infer reciprocity.",
    simsSocialReactionStyle(actor),
  ];

  if (targetId === w.meId) {
    pieces.push(simsSocialPlayerActivityCard(w, actorId));
    pieces.push(simsSocialUnansweredPrivateCard(w, actorId, targetId));
    pieces.push(simsSocialRivalryCard(w, actorId));
    const player = charById(w, w.meId) || w.player;
    if (player) {
      const summary = ensureCharacterContextSummary(player);
      pieces.push("PLAYER PUBLIC PROFILE SUMMARY — only public/profile facts:\n" + String(summary.public || "").slice(0, 4200));
    }
  }

  return pieces.filter(Boolean).join("\n\n");
}

function relationshipBehaviorCard(...args) {
  const base = String(legacySimsSocialRelationshipBehaviorCard(...args) || "");
  const w = args[0];
  const actorId = args[1];
  const targetId = args[2];
  const extra = simsSocialRelationshipContextCard(w, actorId, targetId);
  return [base, extra].filter(Boolean).join("\n\n");
}

function simsSocialEventKey(event) {
  if (!event || typeof event !== "object") return "";
  const ref = String(event.id || event.refId || "").trim();
  if (ref) return String(event.type || "event") + ":" + ref;
  return [event.type || "event", event.actorId || "", Number(event.ts) || 0, String(event.text || "").slice(0, 180)].join(":");
}

function simsSocialTrimLedger(obj, max = 260) {
  const entries = Object.entries(obj || {}).sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  return entries.length > max ? Object.fromEntries(entries.slice(0, Math.floor(max * .75))) : obj;
}

function simsSocialToneDelta(event) {
  const type = String(event && event.type || "").toLowerCase();
  const text = String(event && event.text || "").toLowerCase();
  if (type === "unfollow") return -2;
  if (type === "follow") return 1;
  if (type === "like") return 1;
  if (/hate|gyűlöl|utál|disgust|undor|pathetic|szánal|idiot|idióta|liar|hazug|fuck you|kapd be/.test(text)) return -2;
  if (/love|szeretlek|imádlak|adore|proud|büszke|beautiful|gyönyör|gorgeous|csodálatos/.test(text)) return 2;
  if (/sorry|bocsánat|sajnálom|thank|köszön|congrats|gratul/.test(text)) return 1;
  return 0;
}

function simsSocialApplyScoreDelta(w, fromId, towardId, delta) {
  if (!w || !fromId || !towardId || !delta || fromId === towardId) return;
  if (isHuman(w, fromId)) return;
  const current = getRel(w, fromId, towardId) || {};
  const oldScore = Number(current.score) || 0;
  const nextScore = Math.max(-100, Math.min(100, oldScore + delta));
  if (nextScore !== oldScore) setRel(w, fromId, towardId, { score: nextScore });
}

function simsSocialFollowReactionPropensity(c, rel) {
  if (!c) return 0;
  const summary = ensureCharacterContextSummary(c);
  const text = [summary.private, rel && rel.bond, rel && rel.type, rel && rel.mood, rel && rel.hidden].filter(Boolean).join(" ").toLowerCase();
  if (/detached|közömbös|unbothered|nem érdekli|aloof|távolságtartó/.test(text)) return 0;
  if (/jealous|féltéken|possess|birtokl|proud|büszke|sensitive|érzékeny|social|társas|curious|kíváncsi|direct|egyenes|confront|konfront/.test(text)) return 2;
  return Math.abs(Number(rel && rel.score) || 0) >= 35 ? 1 : 0;
}

function simsSocialScheduleDirectReaction(w, event, targetId) {
  if (!w || !event || !targetId || isHuman(w, targetId)) return;
  const type = String(event.type || "").toLowerCase();
  if (!(type === "follow" || type === "unfollow")) return;
  const actorId = String(event.actorId || "");
  if (!actorId || actorId === targetId) return;
  const target = charById(w, targetId);
  const rel = getRel(w, targetId, actorId) || {};
  if (!simsSocialFollowReactionPropensity(target, rel)) return;

  const intel = ensureSocialIntelligenceState(w);
  const key = targetId + ":" + actorId + ":" + type;
  const last = Number(intel.lastDirectReaction[key]) || 0;
  if (now() - last < SIMS_SOCIAL_REACTION_COOLDOWN_MS) return;
  intel.lastDirectReaction[key] = now();

  if (typeof simEnqueue !== "function" || typeof mkAction !== "function") return;
  if (isHuman(w, actorId)) {
    simEnqueue(w, mkAction(
      "dm",
      "follow-reaction:" + type + ":" + targetId + ":" + actorId + ":" + simsSocialEventKey(event),
      { botId: targetId, trigger: type + "-reaction", eventId: String(event.id || event.refId || "") },
      "event"
    ));
  } else {
    simEnqueue(w, mkAction(
      "npc-pair-reaction",
      "follow-pair-reaction:" + type + ":" + targetId + ":" + actorId + ":" + simsSocialEventKey(event),
      { actorId: targetId, targetId: actorId, trigger: type + "-reaction", eventId: String(event.id || event.refId || "") },
      "event"
    ));
  }
}

function simsSocialPositiveAttentionEvent(event) {
  const type = String(event && event.type || "").toLowerCase();
  if (type === "like" || type === "follow") return true;
  if (!(type === "comment" || type === "reply" || type === "post")) return false;
  const text = String(event.text || "").toLowerCase();
  if (/hate|utál|gyűlöl|idiot|idióta|pathetic|szánal|liar|hazug/.test(text)) return false;
  return /love|szeret|imád|cute|cuki|hot|dögös|pretty|szép|beautiful|gyönyör|❤️|❤|🥰|😍|🔥|😉|😘/.test(text) || type === "comment" || type === "reply";
}

function simsSocialScheduleAttentionRivalry(w, event, subjectId) {
  if (!w || !event || !w.meId || String(event.actorId || "") !== String(w.meId)) return;
  if (!subjectId || subjectId === w.meId || !simsSocialPositiveAttentionEvent(event)) return;
  const visibility = String(event.visibility || "public").toLowerCase();
  if (visibility !== "public") return;
  const subject = charById(w, subjectId);
  if (!subject || isHuman(w, subjectId)) return;

  const candidates = (w.chars || []).filter((c) => c && c.id !== subjectId && c.id !== w.meId && !isHuman(w, c.id)).map((c) => {
    const rel = getRel(w, c.id, w.meId) || {};
    const summary = ensureCharacterContextSummary(c);
    const text = [summary.private, rel.bond, rel.type, rel.mood, rel.hidden].filter(Boolean).join(" ").toLowerCase();
    const score = Number(rel.score) || 0;
    const attachment = score >= 60 || /love|szerel|crush|vonz|attract|obsess|megszáll/.test(text);
    const jealousyCapable = /jealous|féltéken|possess|birtokl|territorial|rival|rivális|competitive|verseng/.test(text);
    return attachment && jealousyCapable && simsSocialCanObserveEvent(w, c.id, event) ? { c, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const chosen = candidates[0];
  if (!chosen) return;
  const intel = ensureSocialIntelligenceState(w);
  const key = chosen.c.id + ":attention";
  const last = Number(intel.lastAttentionReaction[key]) || 0;
  if (now() - last < SIMS_SOCIAL_REACTION_COOLDOWN_MS) return;
  intel.lastAttentionReaction[key] = now();

  if (typeof simEnqueue === "function" && typeof mkAction === "function") {
    simEnqueue(w, mkAction(
      "npc-pair-reaction",
      "attention-rivalry:" + chosen.c.id + ":" + subjectId + ":" + simsSocialEventKey(event),
      { actorId: chosen.c.id, targetId: subjectId, trigger: "player-attention-rivalry", eventId: String(event.id || event.refId || "") },
      "event"
    ));
  }
}

function simsSocialApplyEventConsequences(w, event) {
  if (!w || !event || typeof event !== "object") return;
  const intel = ensureSocialIntelligenceState(w);
  const key = simsSocialEventKey(event);
  if (!key || intel.eventEffectsSeen[key]) return;
  intel.eventEffectsSeen[key] = now();
  intel.eventEffectsSeen = simsSocialTrimLedger(intel.eventEffectsSeen);

  const actorId = String(event.actorId || "");
  if (!actorId) return;
  const targets = [...new Set([
    ...(Array.isArray(event.targetIds) ? event.targetIds : []),
    ...((event.meta && Array.isArray(event.meta.participantIds)) ? event.meta.participantIds : []),
  ].map(String).filter((id) => id && id !== actorId))].slice(0, 8);
  const delta = simsSocialToneDelta(event);

  for (const targetId of targets) {
    if (!charById(w, targetId)) continue;
    if (delta) {
      simsSocialApplyScoreDelta(w, targetId, actorId, delta);
      if (!isHuman(w, actorId) && !isHuman(w, targetId)) {
        simsSocialApplyScoreDelta(w, actorId, targetId, delta > 0 ? 1 : -1);
      }
    }

    if (typeof rememberAboutTarget === "function" && !isHuman(w, targetId) && simsSocialCanObserveEvent(w, targetId, event)) {
      const actor = charById(w, actorId);
      rememberAboutTarget(w, targetId, actorId, {
        kind: "event",
        source: "social_intelligence",
        confidence: 1,
        text: (actor ? actor.name : actorId) + " — " + String(event.type || "event") + ": " + String(event.text || "").replace(/\s+/g, " ").trim().slice(0, 320),
      });
    }

    simsSocialScheduleDirectReaction(w, event, targetId);
    simsSocialScheduleAttentionRivalry(w, event, targetId);
  }
}

function recordSocialEvent(w, event = {}) {
  const result = legacySimsSocialRecordSocialEvent(w, event);
  simsSocialApplyEventConsequences(w, event);
  return result;
}

function setFollowState(...args) {
  const w = args[0];
  const actorId = args[1];
  const targetId = args[2];
  const requested = Boolean(args[3]);
  const reason = String(args[4] || "");
  const before = w && actorId && targetId && typeof isFollowing === "function" ? Boolean(isFollowing(w, actorId, targetId)) : null;
  const result = legacySimsSocialSetFollowState(...args);
  const after = w && actorId && targetId && typeof isFollowing === "function" ? Boolean(isFollowing(w, actorId, targetId)) : requested;

  if (
    w && actorId && targetId && actorId !== targetId &&
    before !== after &&
    reason !== "relationship-auto-follow" &&
    !/bootstrap|initial|normalize|migration/i.test(reason)
  ) {
    const actor = charById(w, actorId);
    const target = charById(w, targetId);
    const type = after ? "follow" : "unfollow";
    recordSocialEvent(w, {
      type,
      refId: type + ":" + actorId + ":" + targetId + ":" + now(),
      ts: now(),
      actorId,
      targetIds: [targetId],
      visibility: "public",
      factLevel: "observed",
      importance: after ? 18 : 34,
      drama: after ? 4 : 24,
      romance: 0,
      embarrassment: 0,
      source: reason || "follow-state",
      text: (actor ? actor.name : actorId) + (after ? " followed " : " unfollowed ") + (target ? target.name : targetId) + ".",
      tags: [type, "follow-system"],
      meta: { participantIds: [actorId, targetId] },
    });
  }
  return result;
}
`;

  next += helper;
  return { changed: next !== original, text: next };
}

const policyOriginal = fs.readFileSync(policyPath, "utf8");
const appOriginal = fs.readFileSync(appPath, "utf8");

const policyPatch = patchPolicy(policyOriginal);
const appPatch = patchApp(appOriginal);

if (policyPatch.changed) fs.writeFileSync(policyPath, policyPatch.text, "utf8");
if (appPatch.changed) fs.writeFileSync(appPath, appPatch.text, "utf8");

if (policyPatch.changed || appPatch.changed) {
  console.log("Applied Sims social intelligence v1: contextual reactions, AI-AI consequences, follow reactions, rivalry, and stored sheet summaries.");
} else {
  console.log("Sims social intelligence v1 already applied.");
}
