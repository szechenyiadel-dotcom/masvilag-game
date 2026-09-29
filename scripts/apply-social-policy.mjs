import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");

const original = fs.readFileSync(appPath, "utf8");

const oldFreshWindow = 'const LIVE_WORLD_FRESH_COMMENT_WINDOW_MS = Math.max(20 * 60000, Math.min(4 * 3600e3, Number(import.meta.env.VITE_WORLD_FRESH_COMMENT_WINDOW_MS) || 90 * 60000));';
const newFreshWindow = 'const LIVE_WORLD_FRESH_COMMENT_WINDOW_MS = 10 * 60 * 1000; // exact 10-minute live comment window';

const oldRelationshipCue = 'const snippet = connectionCanonSnippetAbout(w, actor, target, 1800);';
const newRelationshipCue = 'const snippet = connectionCanonSnippetAbout(w, actor, target, 12000); // read the full targeted relationship entry, not only its opening';

const originalRelationshipFunction = 'function relationshipBehaviorCard(';
const legacyRelationshipFunction = 'function legacyRelationshipBehaviorCard(';
const deepRelationshipMarker = '/* MÁSVILÁG DEEP DIRECTED RELATIONSHIP CANON v2 */';

const deepRelationshipWrapper = `

${deepRelationshipMarker}
/*
 * IMPORTANT:
 * The legacy relationship card is intentionally retained because other world
 * mechanics still use its compact score/bond/mood vocabulary. AI-facing
 * behavior, however, must receive the original directed relationship prose.
 *
 * A -> B and B -> A are separate source texts. The reverse side is included as
 * authorial continuity only and is protected by an explicit knowledge firewall,
 * so a secret on B's sheet never becomes knowledge in A's head by accident.
 */
function relationshipBehaviorCard(w, actorId, targetId) {
  const coarse = legacyRelationshipBehaviorCard(w, actorId, targetId);

  if (!w || !actorId || !targetId || actorId === targetId) {
    return coarse;
  }

  const actor = charById(w, actorId);
  const target = charById(w, targetId);

  if (!actor || !target) {
    return coarse;
  }

  const forward = connectionCanonSnippetAbout(w, actor, target, 12000);
  const reverse = connectionCanonSnippetAbout(w, target, actor, 12000);

  if (!forward && !reverse) {
    return coarse;
  }

  const actorName = String(actor.name || actorId);
  const targetName = String(target.name || targetId);
  const coarseText = String(coarse || '').trim();

  return [
    'DEEP DIRECTED RELATIONSHIP CANON — RAW PROSE IS AUTHORITATIVE',
    'PAIR: ' + actorName + ' [' + actorId + '] → ' + targetName + ' [' + targetId + ']',
    '',
    'A→B — ' + actorName + "'s OWN connection text about " + targetName + ':',
    forward || '(no explicit A→B connection text)',
    '',
    'B→A — ' + targetName + "'s OWN connection text about " + actorName + ':',
    reverse || '(no explicit B→A connection text)',
    '',
    'KNOWLEDGE FIREWALL — HARD RULE:',
    '- A→B governs A’s actual feelings, history, beliefs, self-awareness and intended behavior toward B.',
    '- B→A is AUTHORIAL COUNTERPART CANON. It preserves the true two-sided dynamic, but A does NOT automatically know B’s private thoughts, secrets, denied feelings or hidden motives.',
    '- If A→B says A does not know, has not realized, denies, suppresses or misunderstands something, write A from that exact awareness level. Do not make A consciously name information the sheet says is subconscious or unadmitted.',
    '- Never mirror B→A into A→B. One-sided attraction, asymmetric hatred, unequal loyalty, hidden jealousy, mistaken assumptions and mixed feelings must stay asymmetric.',
    '',
    'REQUIRED DEEP READ — DO NOT REDUCE THIS PAIR TO ONE LABEL:',
    '- Preserve the exact kind and intensity of feeling: affection, attachment, love, attraction, sexual tension, obsession, loyalty, resentment, fear, distrust, rivalry, protectiveness, jealousy, possessiveness, dependency, friendship, family-like attachment, or any combination actually written.',
    '- Preserve self-awareness: conscious, admitted privately, denied, rationalized, suppressed, confused, or not yet admitted even internally.',
    '- Preserve disclosure: public, private, secret from the target, secret from everyone, rumored, accidentally exposed, or known only by named people.',
    '- Preserve reciprocity and mismatch: mutual, one-sided, rejected, unknown, misunderstood, uneven in intensity, or changing over time.',
    '- Preserve history and timeline: current, past, unresolved, on-and-off, newly developing, long-standing, ended-but-lingering, betrayal, reconciliation, shared trauma/history, promises, boundaries and turning points.',
    '- Preserve contradictions. “Enemy” can coexist with attraction; “friend” can coexist with jealousy; “ex” can coexist with unresolved love; affection can coexist with fear or resentment. Do not delete one dimension because another label also matches.',
    '- Behavior must come from the prose above plus current context, not from a generic trope associated with a category word.',
    '',
    'COARSE MECHANICAL BASELINE — SECONDARY ROUTING METADATA ONLY:',
    coarseText || '(none)',
    'The coarse baseline may help routing/scoring, but it NEVER overrides or replaces the raw directed prose above.'
  ].join('\\n');
}
`;

let next = original;

if (next.includes(oldFreshWindow)) {
  next = next.replace(oldFreshWindow, newFreshWindow);
} else if (!next.includes(newFreshWindow)) {
  throw new Error("Social policy patch aborted: fresh-comment window source changed; refusing an unsafe broad replacement.");
}

if (next.includes(oldRelationshipCue)) {
  next = next.replace(oldRelationshipCue, newRelationshipCue);
} else if (!next.includes(newRelationshipCue)) {
  throw new Error("Social policy patch aborted: relationship cue source changed; refusing an unsafe broad replacement.");
}

if (!next.includes(deepRelationshipMarker)) {
  if (next.includes(legacyRelationshipFunction)) {
    // A previous partial application renamed the legacy function already.
  } else if (next.includes(originalRelationshipFunction)) {
    next = next.replace(originalRelationshipFunction, legacyRelationshipFunction);
  } else {
    throw new Error("Social policy patch aborted: relationshipBehaviorCard source changed; refusing an unsafe broad replacement.");
  }

  next += deepRelationshipWrapper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied Másvilág social policy: 10-minute comments + deep bidirectional relationship canon.");
} else {
  console.log("Másvilág social policy already applied.");
}
