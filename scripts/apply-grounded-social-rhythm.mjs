import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const HELPER_MARKER = "MÁSVILÁG GROUNDED SOCIAL RHYTHM v2";
const PROMPT_MARKER = "AUTONOMOUS DM GROUNDING — HARD RULE:";
const CADENCE_MARKER = "MÁSVILÁG CALMER SOCIAL CADENCE v2";

function replaceOnce(pattern, replacement, label, required = true) {
  if (pattern.test(next)) {
    next = next.replace(pattern, replacement);
    return true;
  }
  if (required) {
    throw new Error(`Grounded social rhythm patch aborted: ${label} anchor not found.`);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 1) Deterministic eligibility: strangers cannot spontaneously DM.    */
/* ------------------------------------------------------------------ */
if (!next.includes(HELPER_MARKER)) {
  const helper = `/* ${HELPER_MARKER} */
function autonomousDmGroundingEvidence(w, c) {
  if (!w || !c || !w.meId || isHuman(w, c.id)) {
    return { eligible: false, reasons: [] };
  }

  const me = w.meId;
  const reasons = [];

  const chat = (w.chats && w.chats[chatKey(me, c.id)]) || [];
  if (chat.some((m) => m && (m.text || m.image || m.imageId || m.imageDescription))) {
    reasons.push("existing-dm");
  }

  const forward = getRel(w, c.id, me) || EMPTY_REL;
  const reverse = getRel(w, me, c.id) || EMPTY_REL;
  const relScore = Math.max(
    Math.abs(Number(forward.score) || 0),
    Math.abs(Number(reverse.score) || 0)
  );
  const relWords = [
    forward.bond, forward.type, forward.mood, forward.hidden,
    reverse.bond, reverse.type, reverse.mood, reverse.hidden,
  ].filter(Boolean).join(" ").toLowerCase();

  const meaningfulBond =
    /friend|bar[aá]t|best friend|közeli|testv[eé]r|sibling|parent|szül|family|rokon|coworker|munkat[aá]rs|classmate|oszt[aá]lyt[aá]rs|neighbor|szomsz[eé]d|mentor|tan[ií]tv[aá]ny|teacher|tan[aá]r|coach|edz[oő]|boss|f[oő]n[oö]k|teammate|csapatt[aá]rs|rival|riv[aá]l|enemy|ellens[eé]g|crush|dating|j[aá]rnak|partner|spouse|h[aá]zast[aá]rs|fianc|jegyes|ex\\b|titkos viszony|secret relationship|lover/.test(relWords);
  const meaningfulFeeling =
    /obsess|megsz[aá]ll|possess|birtokl|jealous|f[eé]lt[eé]keny|protect|v[eé]delmez|love|szeret|vonz|attract|crush|hate|gy[uű]l[oö]l|distrust|bizalmatlan|fear|resent|harag|rival|riv[aá]l/.test(relWords);

  if (meaningfulBond || meaningfulFeeling || relScore >= 15) {
    reasons.push("relationship");
  }

  const sharedScene = (w.scenes || []).some((scene) => {
    if (!scene || !(scene.cast || []).includes(c.id)) return false;
    const turns = mergeRoleplayTurnStreams(
      scene.turns || [],
      scene.playerTurnJournal || []
    ).slice(-50);
    return turns.some((turn) => turn && turn.authorId === me) &&
      turns.some((turn) => turn && turn.authorId === c.id);
  });
  if (sharedScene) reasons.push("shared-scene");

  const sharedGroup = (w.groups || []).some((group) => {
    if (!group || !(group.members || []).includes(c.id)) return false;
    const msgs = (group.msgs || []).slice(-80);
    return msgs.some((m) => m && m.from === me) &&
      msgs.some((m) => m && m.from === c.id);
  });
  if (sharedGroup) reasons.push("shared-group-chat");

  const directSocialInteraction = (w.posts || []).slice(0, 40).some((post) => {
    if (!post) return false;
    const comments = safePostComments(post);
    if (post.authorId === me && comments.some((cm) => cm && cm.authorId === c.id)) return true;
    if (post.authorId === c.id && comments.some((cm) => cm && cm.authorId === me)) return true;

    const byId = new Map(comments.filter(Boolean).map((cm) => [cm.id, cm]));
    return comments.some((cm) => {
      if (!cm || !cm.parent) return false;
      const parent = byId.get(cm.parent);
      if (!parent) return false;
      return (cm.authorId === me && parent.authorId === c.id) ||
        (cm.authorId === c.id && parent.authorId === me);
    });
  });
  if (directSocialInteraction) reasons.push("direct-public-interaction");

  return { eligible: reasons.length > 0, reasons };
}

function autonomousDmEligible(w, c) {
  return autonomousDmGroundingEvidence(w, c).eligible;
}

`;
  replaceOnce(
    /function pickInitiator\(w\) \{/,
    helper + "function pickInitiator(w) {",
    "pickInitiator helper"
  );
}

if (!next.includes("autonomousDmEligible(w, c));")) {
  replaceOnce(
    /const chars = \(w\.chars \|\| \[\]\)\.filter\(\(c\) => c && !isHuman\(w, c\.id\)\);/,
    "const chars = (w.chars || []).filter((c) => c && !isHuman(w, c.id) && autonomousDmEligible(w, c));",
    "pickInitiator candidate pool"
  );
}

/* AI-initiated private Events use the same grounding gate. */
{
  const rpStart = next.indexOf("function pickRoleplayInitiator(w) {");
  const rpEnd = rpStart >= 0 ? next.indexOf("\n}", rpStart) : -1;
  if (rpStart >= 0 && rpEnd > rpStart) {
    const block = next.slice(rpStart, rpEnd + 2);
    if (!block.includes("autonomousDmEligible(w, c)")) {
      const patched = block.replace(
        /\.filter\(\(c\) => c && !isHuman\(w, c\.id\)\)/,
        ".filter((c) => c && !isHuman(w, c.id) && autonomousDmEligible(w, c))"
      );
      if (patched === block) {
        throw new Error("Grounded social rhythm patch aborted: roleplay initiator pool changed.");
      }
      next = next.slice(0, rpStart) + patched + next.slice(rpEnd + 2);
    }
  }
}

/* genDM itself refuses an ungrounded actor, even if a stale queued action exists. */
if (!next.includes("if (!autonomousDmEligible(w, bot))")) {
  replaceOnce(
    /async function genDM\(w, bot\) \{\r?\n/,
    `async function genDM(w, bot) {
  if (!autonomousDmEligible(w, bot)) {
    return {
      skip: true,
      text: "",
      image: "",
      imagePrompt: "",
      changes: [],
      selfUpdates: [],
      relationshipUpdates: [],
    };
  }
`,
    "genDM eligibility"
  );
}

/* The earlier own-post patch must have run before this one. */
if (!next.includes("po.authorId === w.meId")) {
  throw new Error("Grounded social rhythm patch aborted: DM own-post filter is missing.");
}

/* Strong prompt grounding: public context from other people is not the player's history. */
if (!next.includes(PROMPT_MARKER)) {
  const genStart = next.indexOf("async function genDM(");
  const genEnd = genStart >= 0 ? next.indexOf("async function genForcedEverydayDM(", genStart) : -1;
  if (genStart < 0 || genEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: genDM boundaries not found.");
  }

  let gen = next.slice(genStart, genEnd);
  const anchor = /PRIVÁT ÜZENET SZABÁLYOK:\r?\n/;
  if (!anchor.test(gen)) {
    throw new Error("Grounded social rhythm patch aborted: DM rules anchor not found.");
  }

  const guard = `AUTONOMOUS DM GROUNDING — HARD RULE:
- Csak olyan konkrét dologra hivatkozhatsz, amelyet a PONTOS privát chat, \${w.player.name} SAJÁT fent felsorolt posztja, az ő tényleges aktív Note-ja, vagy egy ténylegesen közösen átélt/megfigyelt tárolt esemény bizonyít.
- Más karakter posztja, képe, kommentje, sztorija vagy eseménye NEM \${w.player.name} tartalma. Soha ne mondd rá, hogy "your post / your story / te posztoltad".
- Ne találj ki helyszínt, találkozást, korábbi beszélgetést, ígéretet, ruhát, cselekvést, randit, konfliktust vagy közös múltat csak azért, hogy legyen miről írni.
- Ha a valódi kapcsolat indokol egy DM-et, de nincs friss közös esemény, írj önmagában is értelmes, jelen idejű üzenetet; NE gyárts hozzá hamis előzményt.
- A worldContextban szereplő más emberek nyilvános történéseit nem sajátíthatod ki a játékosnak.
- Ha nem tudod biztosan, hogy egy konkrét esemény \${w.player.name} saját cselekvése/tartalma volt-e, NE hivatkozz rá úgy, mintha az lett volna.

`;

  gen = gen.replace(anchor, guard + "PRIVÁT ÜZENET SZABÁLYOK:\n");
  next = next.slice(0, genStart) + gen + next.slice(genEnd);
}

/* ------------------------------------------------------------------ */
/* 2) Natural skip is respected; forced/fallback stranger DMs stop.    */
/* ------------------------------------------------------------------ */
{
  const runStart = next.indexOf("async function runSimulationAction(");
  const runEnd = runStart >= 0 ? next.indexOf("export default function App()", runStart) : -1;
  if (runStart < 0 || runEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: simulation runner boundaries not found.");
  }

  let runner = next.slice(runStart, runEnd);
  const dmStart = runner.indexOf('if (action.type === "dm") {');
  const tailSearch = dmStart >= 0
    ? runner.slice(dmStart).search(/\r?\n\s*const out\s*=\s*\r?\n\s*action\.type === "world"/)
    : -1;
  const dmEnd = tailSearch >= 0 ? dmStart + tailSearch : -1;

  if (dmStart < 0 || dmEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: autonomous DM runner boundaries not found.");
  }

  let dm = runner.slice(dmStart, dmEnd);

  if (!dm.includes("autonomousDmEligible(view, bot)")) {
    const botGuard = /if \(\r?\n\s*!bot \|\|\r?\n\s*isHuman\(view, bot\.id\)\r?\n\s*\) \{\r?\n\s*return null;\r?\n\s*\}/;
    if (!botGuard.test(dm)) {
      throw new Error("Grounded social rhythm patch aborted: autonomous DM bot guard changed.");
    }
    dm = dm.replace(
      botGuard,
      (match) => match + `

    if (!autonomousDmEligible(view, bot)) {
      return null;
    }`
    );
  }

  if (dm.includes("genForcedEverydayDM(view, bot)") || dm.includes("out = fallbackAutonomousDmResponse(view, bot);")) {
    const forced = /let out =\r?\n\s*await genDM\(view, bot\);[\s\S]*?out = fallbackAutonomousDmResponse\(view, bot\);\r?\n\s*\}/;
    if (!forced.test(dm)) {
      throw new Error("Grounded social rhythm patch aborted: forced autonomous DM fallback block changed.");
    }
    dm = dm.replace(
      forced,
      `const out =
      await genDM(view, bot);

    if (
      !out ||
      out.skip === true ||
      (!String(out.text || "").trim() &&
        !String(out.imagePrompt || "").trim() &&
        !String(out.image || "").trim())
    ) {
      return null;
    }`
    );
  }

  /* Friendly fallback may repair hostile wording, but must never create an empty DM. */
  dm = dm.replace(
    /autonomousFriendly &&\r?\n\s*autonomousConflict === 0 &&\r?\n\s*\(!txt \|\| socialTextHostilityLevel\(txt\) > 0 \|\| DM_COLD_DISMISSAL_RE\.test\(txt\)\)/,
    `autonomousFriendly &&
      autonomousConflict === 0 &&
      txt &&
      (socialTextHostilityLevel(txt) > 0 || DM_COLD_DISMISSAL_RE.test(txt))`
  );

  runner = runner.slice(0, dmStart) + dm + runner.slice(dmEnd);
  next = next.slice(0, runStart) + runner + next.slice(runEnd);
}

/* Stale queued private Event initiation also cannot bypass the relation gate. */
replaceOnce(
  /if \(!bot \|\| isHuman\(view, bot\.id\) \|\| !canAiInitiateRoleplay\(view\)\) return null;/,
  "if (!bot || isHuman(view, bot.id) || !canAiInitiateRoleplay(view) || !autonomousDmEligible(view, bot)) return null;",
  "roleplay-initiate eligibility",
  false
);

/* Note reactions may be public, but a private DM reply still needs a real tie. */
{
  const noteStart = next.indexOf('if (action.type === "note-react") {');
  const noteEnd = noteStart >= 0 ? next.indexOf('if (action.type === "note") {', noteStart) : -1;
  if (noteStart < 0 || noteEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: note-react boundaries not found.");
  }

  let noteBlock = next.slice(noteStart, noteEnd);
  if (!noteBlock.includes("autonomousDmEligible(n, charById(n, who))")) {
    const noteDmGuard = /isHuman\(n, who\) \|\|\r?\n\s*hasReacted\(who\) \|\|/;
    if (!noteDmGuard.test(noteBlock)) {
      throw new Error("Grounded social rhythm patch aborted: Note DM guard anchor changed.");
    }
    noteBlock = noteBlock.replace(
      noteDmGuard,
      `isHuman(n, who) ||\n          !autonomousDmEligible(n, charById(n, who)) ||\n          hasReacted(who) ||`
    );
    next = next.slice(0, noteStart) + noteBlock + next.slice(noteEnd);
  }
}

/* Gossip can be public, but its optional private fallout must also be grounded. */
{
  const gossipStart = next.indexOf('if (action.type === "gossip-reaction") {');
  const gossipEnd = gossipStart >= 0 ? next.indexOf('if (action.type === "rumor-evolution") {', gossipStart) : -1;
  if (gossipStart < 0 || gossipEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: gossip-reaction boundaries not found.");
  }

  let gossipBlock = next.slice(gossipStart, gossipEnd);
  if (!gossipBlock.includes("GROUNDED GOSSIP DMS")) {
    const visibleAnchor = /\s*const hasVisibleReaction = Boolean\(out && \(/;
    if (!visibleAnchor.test(gossipBlock)) {
      throw new Error("Grounded social rhythm patch aborted: gossip DM filter anchor changed.");
    }
    gossipBlock = gossipBlock.replace(
      visibleAnchor,
      `\n    /* GROUNDED GOSSIP DMS: public gossip is not permission for a stranger DM. */\n    if (out && Array.isArray(out.dms)) {\n      out = {\n        ...out,\n        dms: out.dms.filter((row) => {\n          const who = findChar(view, row && (row.id !== undefined ? row.id : row.name));\n          const actor = who ? charById(view, who) : null;\n          return Boolean(actor && autonomousDmEligible(view, actor));\n        }),\n      };\n    }\n\n    const hasVisibleReaction = Boolean(out && (`
    );
    next = next.slice(0, gossipStart) + gossipBlock + next.slice(gossipEnd);
  }
}

/* ------------------------------------------------------------------ */
/* 3) Calmer background world, but a stronger public feed pulse.       */
/* ------------------------------------------------------------------ */
if (!next.includes(CADENCE_MARKER)) {
  replaceOnce(
    /const LIVE_WORLD_CONTENT_INTERVAL_MS = Math\.max\(12000, Math\.min\(60000, Number\(import\.meta\.env\.VITE_WORLD_CONTENT_INTERVAL_MS\) \|\| 15000\)\);/,
    `/* ${CADENCE_MARKER} */
const LIVE_WORLD_CONTENT_INTERVAL_MS = Math.max(
  20000,
  Math.min(90000, Number(import.meta.env.VITE_WORLD_CONTENT_INTERVAL_MS) || 30000)
);`,
    "content cadence"
  );

  replaceOnce(
    /const LIVE_WORLD_DM_TARGET_MS = Math\.max\(60 \* 1000, Math\.min\(10 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_DM_INTERVAL_MS\) \|\| 2\.5 \* 60 \* 1000\)\);/,
    "const LIVE_WORLD_DM_TARGET_MS = Math.max(8 * 60 * 1000, Math.min(30 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 12 * 60 * 1000));",
    "DM cadence"
  );

  replaceOnce(
    /const LIVE_WORLD_EVENT_TARGET_MS = Math\.max\(2\.5 \* 60 \* 1000, Math\.min\(15 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_EVENT_INTERVAL_MS\) \|\| 5 \* 60 \* 1000\)\);/,
    "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(12 * 60 * 1000, Math.min(45 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 20 * 60 * 1000));",
    "Event cadence"
  );

  replaceOnce(
    /const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math\.max\(30 \* 1000, Math\.min\(5 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_NOTE_REACTION_DEADLINE_MS\) \|\| 90 \* 1000\)\);/,
    "const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math.max(2 * 60 * 1000, Math.min(12 * 60 * 1000, Number(import.meta.env.VITE_WORLD_NOTE_REACTION_DEADLINE_MS) || 4 * 60 * 1000));",
    "Note reaction cadence"
  );

  replaceOnce(
    /const LIVE_WORLD_POST_TARGET_MS = Math\.max\(\s*2 \* 60 \* 1000,\s*Math\.min\(\s*12 \* 60 \* 1000,\s*Number\(import\.meta\.env\.VITE_WORLD_POST_INTERVAL_MS\) \|\| 3 \* 60 \* 1000\s*\)\s*\);/,
    `const LIVE_WORLD_POST_TARGET_MS = Math.max(
  90 * 1000,
  Math.min(
    8 * 60 * 1000,
    Number(import.meta.env.VITE_WORLD_POST_INTERVAL_MS) || 2 * 60 * 1000
  )
);`,
    "feed cadence"
  );

  replaceOnce(
    /\? Math\.min\(LIVE_WORLD_POST_TARGET_MS, 90 \* 1000\)/,
    "? Math.min(LIVE_WORLD_POST_TARGET_MS, 60 * 1000)",
    "feed catch-up cadence"
  );

  const dmWatchdogPattern = /Math\.max\(2\.5 \* 60 \* 1000, Math\.round\(LIVE_WORLD_DM_TARGET_MS \/ dmActivityFactor\)\)/g;
  const dmMatches = next.match(dmWatchdogPattern) || [];
  if (dmMatches.length < 2) {
    throw new Error("Grounded social rhythm patch aborted: DM watchdog targets changed.");
  }
  next = next.replace(
    dmWatchdogPattern,
    "Math.max(8 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))"
  );

  const roleplayWatchdogPattern = /Math\.max\(6 \* 60 \* 1000, Math\.round\(LIVE_WORLD_EVENT_TARGET_MS \/ rpActivityFactor\)\)/g;
  const roleplayMatches = next.match(roleplayWatchdogPattern) || [];
  if (roleplayMatches.length < 2) {
    throw new Error("Grounded social rhythm patch aborted: Event watchdog targets changed.");
  }
  next = next.replace(
    roleplayWatchdogPattern,
    "Math.max(12 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))"
  );

  replaceOnce(
    /const groupTarget = Math\.max\(210000, Math\.round\(290000 \/ groupPeak\)\);/,
    "const groupTarget = Math.max(8 * 60 * 1000, Math.round((12 * 60 * 1000) / groupPeak));",
    "group cadence"
  );

  replaceOnce(
    /if \(priorityNoteState && Math\.random\(\) < 0\.55\) \{/,
    "if (priorityNoteState && Math.random() < 0.25) {",
    "note priority chance"
  );

  replaceOnce(
    /if \(groupInitiative && Math\.random\(\) < 0\.45\) return groupInitiative;/,
    "if (groupInitiative && Math.random() < 0.20) return groupInitiative;",
    "group initiative chance"
  );

  replaceOnce(
    /if \(roll < 0\.36\) \{\r?\n\s*const bot =\r?\n\s*pickInitiator\(view\);/,
    `if (roll >= 0.18 && roll < 0.24) {
    const bot =
      pickInitiator(view);`,
    "spontaneous DM residual chance"
  );

  /* Backchannel/gossip remains alive but no longer fires on every spare cycle. */
  next = next.replace(
    /gossipSpread && Math\.random\(\) < \(String\(view\.gossipSettings && view\.gossipSettings\.frequency \|\| "normal"\) === "chaotic" \? 0\.52 : 0\.30\)/,
    'gossipSpread && Math.random() < (String(view.gossipSettings && view.gossipSettings.frequency || "normal") === "chaotic" ? 0.34 : 0.16)'
  );
  next = next.replace(
    /gossipEcho && Math\.random\(\) < 0\.22/,
    "gossipEcho && Math.random() < 0.10"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded DMs + calmer social rhythm + stronger feed pulse.");
} else {
  console.log("Grounded social rhythm already applied.");
}
