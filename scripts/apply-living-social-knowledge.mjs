import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(root, "src", "socialWorldPolicy.js");
const appPath = path.join(root, "src", "App.jsx");

let policy = fs.readFileSync(policyPath, "utf8");
let app = fs.readFileSync(appPath, "utf8");

const POLICY_MARKER = "AUTHOR KNOWLEDGE / CHARACTER KNOWLEDGE FIREWALL — HARD CONTRACT";
const APP_MARKER = "MÁSVILÁG LIVING SOCIAL REALISM CADENCE v1";
const COMMENT_MARKER = "MÁSVILÁG NATURAL COMMENT REENTRY v1";

function replaceRequired(source, pattern, replacement, label) {
  if (typeof pattern === "string") {
    if (!source.includes(pattern)) throw new Error(`Living social realism patch aborted: ${label} anchor not found.`);
    return source.replace(pattern, replacement);
  }
  if (!pattern.test(source)) throw new Error(`Living social realism patch aborted: ${label} anchor not found.`);
  return source.replace(pattern, replacement);
}

if (!policy.includes(POLICY_MARKER)) {
  const anchor = "const COMMENT_POLICY = `";
  if (!policy.includes(anchor)) {
    throw new Error("Living social realism patch aborted: comment policy anchor not found.");
  }

  const block = `const KNOWLEDGE_AND_LIVING_SOCIAL_POLICY = \`
AUTHOR KNOWLEDGE / CHARACTER KNOWLEDGE FIREWALL — HARD CONTRACT
The AI engine may read every character-sheet field that is supplied so it can portray the whole cast accurately. That author-level knowledge NEVER means every in-world character knows the same information.

TWO SEPARATE LAYERS MUST EXIST AT ALL TIMES:
1. AUTHOR / ENGINE LAYER: use the full sheets to understand who each person really is, what drives them, how they speak, their private relationships, secrets, goals, fears, history, habits, orientation, loyalties, motives and contradictions.
2. CHARACTER / IN-WORLD LAYER: every speaking/acting character gets a separate knowledge lens. They may use only information THEY could know.

SELF-KNOWLEDGE:
- A character's own sheet is authoritative for portraying that character: personality, traits, speech/voice, goals, fears, likes, secrets, backstory, job/school, faction, relationships, habits, preferences and other relevant fields must all influence behavior when applicable.
- Do not reduce a character to only personality or one trait. Read the whole sheet before choosing behavior.
- If the sheet explicitly says a feeling/motive is subconscious, denied, repressed, confused, forgotten or unknown even to the character, use it to shape behavior but do NOT make the character consciously state it as known fact.

KNOWLEDGE ABOUT OTHER CHARACTERS:
- By default, another person's PRIVATE sheet is not in-world knowledge. Personality notes, hidden traits, private goals, fears, secrets, private backstory details, private Connections wording, hidden attraction, internal jealousy, private plans and inner thoughts are NOT automatically known just because the engine can read them.
- A character may normally know PUBLIC / SOCIALLY OBSERVABLE facts about another person: name, public age/birthday when established, username, public bio, visible appearance, publicly known job/school/city/role/affiliation and other facts explicitly presented as public.
- Additional knowledge must come from a real source: direct conversation, DM, shared Scene, group chat, witnessed event, public post/comment/Note, a rumor they plausibly received, a relationship history they personally lived, or a memory stored for that character.
- One character's directed Connections text does not reveal the OTHER person's reciprocal private feelings. A knows A→B; B's secret B→A state stays private until B reveals it or A plausibly learns it.
- Never let a character quote, expose, confront or react to another character's secret/internal field without a valid knowledge source.
- In multi-character generation, keep a separate mental knowledge boundary for EACH speaker. Do not transfer facts between speakers merely because they share one model call.
- Inference is allowed only from observable evidence and must remain an inference, not magically certain knowledge.

LIVING SOCIAL MEDIA — REAL HUMAN BEHAVIOR
Treat Feed, DM, Scene invitations, Notes and comments like one continuous social life rather than isolated AI features.

POSTS:
- Characters should post from their own lives when their personality/routine gives them a reason: a thought, joke, complaint, photo-worthy moment, hobby, work/school update, indirect relationship signal, achievement, frustration, invitation, meme-like thought or ordinary slice of life.
- Posts should not all concern the player. AI↔AI friendships, crushes, rivalries, routines and private lives can create posts too.
- Use existing cadence only; do not post filler just to satisfy a timer. But when a natural posting opportunity exists, do not skip merely because the player did nothing.

DM + SCENE INVITATIONS:
- Existing cooldowns remain authoritative, but when a character has a genuine relationship/personality reason, they should be willing to initiate rather than waiting for the player forever.
- A social friend may check in, a flirt may start a conversation, a rival may challenge, a protective person may reach out, and someone with a concrete plan may invite another person into a Scene/Event.
- No stranger-DM bypass, no fabricated shared history, no forced escalation.

NOTES:
- Notes are short, ephemeral, low-pressure social signals: moods, tiny thoughts, original lyric-like phrasing, jokes, complaints, plans, hints, questions or spontaneous updates that fit the character.
- AI characters may create Notes on their own when personality/current life supports it, even when the player did nothing.
- Other characters may react to a Note on their own only if visibility, relationship, personality and knowledge make the reaction plausible. Not everyone must react.
- A Note reaction can naturally lead to a reply/DM only through the existing grounded relationship rules; do not use Notes as a stranger-DM loophole.

COMMENTS / THREADS:
- On a post, a character normally contributes ONE natural top-level comment when they have something worth saying.
- The same character should speak again on that same post only after a fresh conversational reason: somebody replied to their comment, directly mentioned/tagged them, or explicitly pulled them back into the thread.
- When that happens, respond in the relevant reply chain instead of dropping another unrelated top-level comment.
- Do not repeatedly comment just because the post remains fresh. Other characters should get room to participate.
- Direct replies and mentions are meaningful conversational triggers; react when the character would realistically care, but stop again once that exchange naturally ends.

REALISM / LOAD SAFETY:
- Existing scheduler, cooldown, queue, retry and AI-call limits remain authoritative. This policy does not authorize extra loops, extra polling, parallel AI requests or per-character scans.
- Prefer a few motivated actions over constant noise. Silence is valid when nobody has a reason to act.
\`;

`;

  policy = policy.replace(anchor, block + anchor);

  const oldCombined = "const combinedPolicy = `${RELATIONSHIP_POLICY}\\n${CONVERSATION_REALITY_POLICY}\\n${DM_SCENE_INITIATIVE_POLICY}\\n${COMMENT_POLICY}\\n${SIMS_WORLD_POLICY}\\n${RHYTHM_POLICY}`;";
  const newCombined = "const combinedPolicy = `${RELATIONSHIP_POLICY}\\n${CONVERSATION_REALITY_POLICY}\\n${DM_SCENE_INITIATIVE_POLICY}\\n${KNOWLEDGE_AND_LIVING_SOCIAL_POLICY}\\n${COMMENT_POLICY}\\n${SIMS_WORLD_POLICY}\\n${RHYTHM_POLICY}`;";
  policy = replaceRequired(policy, oldCombined, newCombined, "combined social policy");
}

if (!app.includes(APP_MARKER)) {
  app = replaceRequired(
    app,
    "const LIVE_WORLD_DM_TARGET_MS = Math.max(7 * 60 * 1000, Math.min(30 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 10 * 60 * 1000));",
    `/* ${APP_MARKER} */\nconst LIVE_WORLD_DM_TARGET_MS = Math.max(6 * 60 * 1000, Math.min(25 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 8 * 60 * 1000));`,
    "DM target cadence"
  );

  app = replaceRequired(
    app,
    "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(10 * 60 * 1000, Math.min(40 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 15 * 60 * 1000));",
    "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(8 * 60 * 1000, Math.min(35 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 12 * 60 * 1000));",
    "Scene/Event target cadence"
  );

  app = replaceRequired(
    app,
    /const LIVE_WORLD_POST_TARGET_MS = Math\.max\(\s*90 \* 1000,\s*Math\.min\(\s*8 \* 60 \* 1000,\s*Number\(import\.meta\.env\.VITE_WORLD_POST_INTERVAL_MS\) \|\| 2 \* 60 \* 1000\s*\)\s*\);/,
    `const LIVE_WORLD_POST_TARGET_MS = Math.max(\n  75 * 1000,\n  Math.min(\n    6 * 60 * 1000,\n    Number(import.meta.env.VITE_WORLD_POST_INTERVAL_MS) || 100 * 1000\n  )\n);`,
    "post target cadence"
  );

  app = replaceRequired(
    app,
    "const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math.max(2 * 60 * 1000, Math.min(12 * 60 * 1000, Number(import.meta.env.VITE_WORLD_NOTE_REACTION_DEADLINE_MS) || 4 * 60 * 1000));",
    "const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math.max(90 * 1000, Math.min(10 * 60 * 1000, Number(import.meta.env.VITE_WORLD_NOTE_REACTION_DEADLINE_MS) || 150 * 1000));",
    "Note reaction cadence"
  );

  app = replaceRequired(
    app,
    "const LIVE_WORLD_NOTE_MULTIPLIER = Math.max(0.55, Math.min(2.75, Number(import.meta.env.VITE_WORLD_NOTE_MULTIPLIER) || 1.10));",
    "const LIVE_WORLD_NOTE_MULTIPLIER = Math.max(0.55, Math.min(2.75, Number(import.meta.env.VITE_WORLD_NOTE_MULTIPLIER) || 1.25));",
    "Note initiative multiplier"
  );

  const dmWatchdog = "Math.max(7 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))";
  if (!app.includes(dmWatchdog)) throw new Error("Living social realism patch aborted: DM watchdog anchor not found.");
  app = app.replaceAll(dmWatchdog, "Math.max(6 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))");

  const eventWatchdog = "Math.max(10 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))";
  if (!app.includes(eventWatchdog)) throw new Error("Living social realism patch aborted: Event watchdog anchor not found.");
  app = app.replaceAll(eventWatchdog, "Math.max(8 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))");
}

if (!app.includes(COMMENT_MARKER)) {
  const replyResolution = /if \(!parent && tag\) \{\r?\n\s*const mentionedAuthor = findChar\(n, tag\);\r?\n\s*if \(mentionedAuthor\) \{\r?\n\s*const candidates = p\.comments\r?\n\s*\.filter\(\(x\) => x && x\.authorId === mentionedAuthor\)\r?\n\s*\.sort\(\(a, b\) => \(Number\(b\.ts\) \|\| 0\) - \(Number\(a\.ts\) \|\| 0\)\);\r?\n\s*if \(candidates\[0\]\) parent = candidates\[0\]\.id;\r?\n\s*\}\r?\n\s*\}/;

  if (!replyResolution.test(app)) {
    throw new Error("Living social realism patch aborted: comment reply-resolution anchor not found.");
  }

  app = app.replace(
    replyResolution,
    (match) => `${match}\n\n/* ${COMMENT_MARKER} */\n{\n  const ownComments = p.comments\n    .filter((row) => row && row.authorId === who)\n    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));\n\n  if (ownComments.length) {\n    const lastOwnTs = Number(ownComments[0].ts) || 0;\n    const actorForThread = charById(n, who);\n    const handle = String((actorForThread && actorForThread.username) || \"\").trim().toLowerCase();\n    const fullName = String((actorForThread && actorForThread.name) || \"\").trim().toLowerCase();\n\n    const reentry = p.comments\n      .filter((row) => row && row.authorId !== who && (Number(row.ts) || 0) > lastOwnTs)\n      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))\n      .find((row) => {\n        const parentRow = row.parent\n          ? p.comments.find((candidate) => candidate && candidate.id === row.parent)\n          : null;\n        const repliedToActor = Boolean(parentRow && parentRow.authorId === who);\n        const text = String(row.text || \"\").toLowerCase();\n        const directlyMentioned =\n          (handle && text.includes(\"@\" + handle)) ||\n          (fullName && fullName.length >= 3 && text.includes(fullName));\n        return repliedToActor || directlyMentioned;\n      });\n\n    if (!reentry) return;\n    parent = reentry.id;\n  }\n}`
  );
}

if (policy !== fs.readFileSync(policyPath, "utf8")) {
  fs.writeFileSync(policyPath, policy, "utf8");
  console.log("Applied character knowledge firewall + living social-media policy.");
} else {
  console.log("Character knowledge firewall + living social-media policy already applied.");
}

if (app !== fs.readFileSync(appPath, "utf8")) {
  fs.writeFileSync(appPath, app, "utf8");
  console.log("Applied living social cadence + natural comment re-entry guard.");
} else {
  console.log("Living social cadence + comment re-entry guard already applied.");
}
