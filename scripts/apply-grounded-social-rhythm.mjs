import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "MÁSVILÁG GROUNDED SOCIAL RHYTHM v1";

if (!next.includes(marker)) {
  const initiatorAnchor = /function pickInitiator\(w\) \{/;
  if (!initiatorAnchor.test(next)) {
    throw new Error("Grounded social rhythm patch aborted: pickInitiator anchor not found.");
  }

  const helper = `/* ${marker} */
function autonomousDmGroundingEvidence(w, c) {
  if (!w || !c || !w.meId || isHuman(w, c.id)) {
    return { eligible: false, reasons: [] };
  }

  const me = w.meId;
  const reasons = [];
  const chat = (w.chats && w.chats[chatKey(me, c.id)]) || [];
  const hasExistingChat = chat.some((m) => m && (m.text || m.image || m.imageId || m.imageDescription));
  if (hasExistingChat) reasons.push("existing-dm");

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

  const meaningfulBond = /friend|bar[aá]t|best friend|közeli|testv[eé]r|sibling|parent|szül|family|rokon|coworker|munkat[aá]rs|classmate|oszt[aá]lyt[aá]rs|neighbor|szomsz[eé]d|mentor|tan[ií]tv[aá]ny|teacher|tan[aá]r|coach|edz[oő]|boss|f[oő]n[oö]k|teammate|csapatt[aá]rs|rival|riv[aá]l|enemy|ellens[eé]g|crush|dating|j[aá]rnak|partner|spouse|h[aá]zast[aá]rs|fianc|jegyes|ex\b|titkos viszony|secret relationship|lover/.test(relWords);
  const meaningfulFeeling = /obsess|megsz[aá]ll|possess|birtokl|jealous|f[eé]lt[eé]keny|protect|v[eé]delmez|love|szeret|vonz|attract|crush|hate|gy[uű]l[oö]l|distrust|bizalmatlan|fear|f[eé]l t[oő]le|resent|harag|rival|riv[aá]l/.test(relWords);
  if (meaningfulBond || meaningfulFeeling || relScore >= 15) reasons.push("relationship");

  const sharedScene = (w.scenes || []).some((scene) => {
    if (!scene || !(scene.cast || []).includes(c.id)) return false;
    const turns = mergeRoleplayTurnStreams(scene.turns || [], scene.playerTurnJournal || []).slice(-50);
    return turns.some((turn) => turn && turn.authorId === me) &&
      turns.some((turn) => turn && turn.authorId === c.id);
  });
  if (sharedScene) reasons.push("shared-scene");

  const sharedGroup = (w.groups || []).some((group) => {
    if (!group || !(group.members || []).includes(c.id)) return false;
    const msgs = (group.msgs || []).slice(-80);
    return msgs.some((m) => m && m.from === me) && msgs.some((m) => m && m.from === c.id);
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

  next = next.replace(initiatorAnchor, helper + "function pickInitiator(w) {");

  const pickStart = next.indexOf("function pickInitiator(w) {");
  const pickEnd = pickStart >= 0 ? next.indexOf("/* Van-e olyan, amit tőled láttak", pickStart) : -1;
  if (pickStart < 0 || pickEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: pickInitiator boundaries not found.");
  }
  let pickBlock = next.slice(pickStart, pickEnd);
  const charsLine = "const chars = (w.chars || []).filter((c) => c && !isHuman(w, c.id));";
  if (!pickBlock.includes(charsLine)) {
    throw new Error("Grounded social rhythm patch aborted: pickInitiator character pool changed.");
  }
  pickBlock = pickBlock.replace(
    charsLine,
    "const chars = (w.chars || []).filter((c) => c && !isHuman(w, c.id) && autonomousDmEligible(w, c));"
  );
  next = next.slice(0, pickStart) + pickBlock + next.slice(pickEnd);

  const genDmStart = next.indexOf("async function genDM(");
  const genDmEnd = genDmStart >= 0 ? next.indexOf("async function genForcedEverydayDM(", genDmStart) : -1;
  if (genDmStart < 0 || genDmEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: genDM boundaries not found.");
  }
  let genDm = next.slice(genDmStart, genDmEnd);

  if (!genDm.includes("autonomousDmEligible(w, bot)")) {
    genDm = genDm.replace(
      /async function genDM\(w, bot\) \{\r?\n/,
      `async function genDM(w, bot) {\n  if (!autonomousDmEligible(w, bot)) {\n    return { skip: true, text: "", image: "", imagePrompt: "", changes: [], selfUpdates: [], relationshipUpdates: [] };\n  }\n`
    );
  }

  if (!genDm.includes("AUTONOMOUS DM GROUNDING — HARD RULE:")) {
    const rulesAnchor = /PRIVÁT ÜZENET SZABÁLYOK:\r?\n/;
    if (!rulesAnchor.test(genDm)) {
      throw new Error("Grounded social rhythm patch aborted: DM rules anchor not found.");
    }
    const groundingRules = `AUTONOMOUS DM GROUNDING — HARD RULE:\n- Csak olyan konkrét dologra hivatkozhatsz, amelyet a PONTOS privát chat, ${w.player.name} SAJÁT fent felsorolt posztja, az ő tényleges aktív Note-ja, vagy egy ténylegesen közösen átélt/megfigyelt tárolt esemény bizonyít.\n- Más karakter posztja, képe, kommentje, sztorija vagy eseménye NEM ${w.player.name} tartalma. Soha ne mondd rá, hogy \"your post / your story / te posztoltad\".\n- Ne találj ki helyszínt, találkozást, korábbi beszélgetést, ígéretet, ruhát, cselekvést, randit, konfliktust vagy közös múltat csak azért, hogy legyen miről írni.\n- Ha a valódi kapcsolat indokol egy DM-et, de nincs friss közös esemény, írj önmagában is értelmes, jelen idejű üzenetet; NE gyárts hozzá hamis előzményt.\n- A worldContextban szereplő más emberek nyilvános történéseit nem sajátíthatod ki a játékosnak.\n\n`;
    genDm = genDm.replace(rulesAnchor, groundingRules + "PRIVÁT ÜZENET SZABÁLYOK:\n");
  }

  next = next.slice(0, genDmStart) + genDm + next.slice(genDmEnd);

  const runStart = next.indexOf("async function runSimulationAction(");
  const runEnd = runStart >= 0 ? next.indexOf("/* ============================================================\r\n   Váz", runStart) : -1;
  if (runStart < 0 || runEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: simulation runner boundaries not found.");
  }
  let runner = next.slice(runStart, runEnd);
  const dmActionStart = runner.indexOf('if (action.type === "dm") {');
  const dmActionEnd = dmActionStart >= 0 ? runner.indexOf('const out =\r\n    action.type === "world"', dmActionStart) : -1;
  if (dmActionStart < 0 || dmActionEnd < 0) {
    throw new Error("Grounded social rhythm patch aborted: DM runner block not found.");
  }
  let dmRunner = runner.slice(dmActionStart, dmActionEnd);

  const botGuard = /if \(\r?\n\s*!bot \|\|\r?\n\s*isHuman\(view, bot\.id\)\r?\n\s*\) \{\r?\n\s*return null;\r?\n\s*\}/;
  if (!botGuard.test(dmRunner)) {
    throw new Error("Grounded social rhythm patch aborted: autonomous DM bot guard changed.");
  }
  dmRunner = dmRunner.replace(
    botGuard,
    (match) => match + `\n\n    if (!autonomousDmEligible(view, bot)) {\n      return null;\n    }`
  );

  const forcedBlock = /let out =\r?\n\s*await genDM\(view, bot\);[\s\S]*?out = fallbackAutonomousDmResponse\(view, bot\);\r?\n\s*\}/;
  if (!forcedBlock.test(dmRunner)) {
    throw new Error("Grounded social rhythm patch aborted: forced autonomous DM fallback block changed.");
  }
  dmRunner = dmRunner.replace(
    forcedBlock,
    `const out =\n      await genDM(view, bot);\n\n    if (\n      !out ||\n      out.skip === true ||\n      (!String(out.text || "").trim() && !String(out.imagePrompt || "").trim() && !String(out.image || "").trim())\n    ) {\n      return null;\n    }`
  );

  const friendlyFallback = /autonomousFriendly &&\r?\n\s*autonomousConflict === 0 &&\r?\n\s*\(!txt \|\| socialTextHostilityLevel\(txt\) > 0 \|\| DM_COLD_DISMISSAL_RE\.test\(txt\)\)/;
  if (friendlyFallback.test(dmRunner)) {
    dmRunner = dmRunner.replace(
      friendlyFallback,
      `autonomousFriendly &&\n      autonomousConflict === 0 &&\n      txt &&\n      (socialTextHostilityLevel(txt) > 0 || DM_COLD_DISMISSAL_RE.test(txt))`
    );
  }

  runner = runner.slice(0, dmActionStart) + dmRunner + runner.slice(dmActionEnd);
  next = next.slice(0, runStart) + runner + next.slice(runEnd);

  /* Less simultaneous background churn; public feed becomes the main visible pulse. */
  const cadenceReplacements = [
    [
      /const LIVE_WORLD_CONTENT_INTERVAL_MS = Math\.max\(12000, Math\.min\(60000, Number\(import\.meta\.env\.VITE_WORLD_CONTENT_INTERVAL_MS\) \|\| 15000\)\);/,
      "const LIVE_WORLD_CONTENT_INTERVAL_MS = Math.max(20000, Math.min(90000, Number(import.meta.env.VITE_WORLD_CONTENT_INTERVAL_MS) || 30000));"
    ],
    [
      /const LIVE_WORLD_DM_TARGET_MS = Math\.max\(60 \* 1000, Math\.min\(10 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_DM_INTERVAL_MS\) \|\| 2\.5 \* 60 \* 1000\)\);/,
      "const LIVE_WORLD_DM_TARGET_MS = Math.max(8 * 60 * 1000, Math.min(30 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 12 * 60 * 1000));"
    ],
    [
      /const LIVE_WORLD_EVENT_TARGET_MS = Math\.max\(2\.5 \* 60 \* 1000, Math\.min\(15 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_EVENT_INTERVAL_MS\) \|\| 5 \* 60 \* 1000\)\);/,
      "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(12 * 60 * 1000, Math.min(45 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 20 * 60 * 1000));"
    ],
    [
      /const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math\.max\(30 \* 1000, Math\.min\(5 \* 60 \* 1000, Number\(import\.meta\.env\.VITE_WORLD_NOTE_REACTION_DEADLINE_MS\) \|\| 90 \* 1000\)\);/,
      "const LIVE_WORLD_NOTE_REACTION_DEADLINE_MS = Math.max(2 * 60 * 1000, Math.min(12 * 60 * 1000, Number(import.meta.env.VITE_WORLD_NOTE_REACTION_DEADLINE_MS) || 4 * 60 * 1000));"
    ],
  ];
  cadenceReplacements.forEach(([pattern, replacement]) => {
    if (!pattern.test(next)) throw new Error("Grounded social rhythm patch aborted: cadence constant changed.");
    next = next.replace(pattern, replacement);
  });

  const postConstant = /const LIVE_WORLD_POST_TARGET_MS = Math\.max\([\s\S]*?Number\(import\.meta\.env\.VITE_WORLD_POST_INTERVAL_MS\) \|\| 3 \* 60 \* 1000[\s\S]*?\);/;
  if (!postConstant.test(next)) {
    throw new Error("Grounded social rhythm patch aborted: feed cadence constant changed.");
  }
  next = next.replace(
    postConstant,
    `const LIVE_WORLD_POST_TARGET_MS = Math.max(\n  90 * 1000,\n  Math.min(\n    8 * 60 * 1000,\n    Number(import.meta.env.VITE_WORLD_POST_INTERVAL_MS) || 2 * 60 * 1000\n  )\n);`
  );

  const belowMinTarget = /\? Math\.min\(LIVE_WORLD_POST_TARGET_MS, 90 \* 1000\)/;
  if (!belowMinTarget.test(next)) {
    throw new Error("Grounded social rhythm patch aborted: under-minimum feed target changed.");
  }
  next = next.replace(belowMinTarget, "? Math.min(LIVE_WORLD_POST_TARGET_MS, 60 * 1000)");

  const dmMinTarget = /Math\.max\(2\.5 \* 60 \* 1000, Math\.round\(LIVE_WORLD_DM_TARGET_MS \/ dmActivityFactor\)\)/g;
  if ((next.match(dmMinTarget) || []).length < 2) {
    throw new Error("Grounded social rhythm patch aborted: DM watchdog targets changed.");
  }
  next = next.replace(dmMinTarget, "Math.max(8 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))");

  const groupTarget = /const groupTarget = Math\.max\(210000, Math\.round\(290000 \/ groupPeak\)\);/;
  if (!groupTarget.test(next)) {
    throw new Error("Grounded social rhythm patch aborted: group cadence target changed.");
  }
  next = next.replace(groupTarget, "const groupTarget = Math.max(8 * 60 * 1000, Math.round((12 * 60 * 1000) / groupPeak));");

  const noteChance = /if \(priorityNoteState && Math\.random\(\) < 0\.55\) \{/;
  if (!noteChance.test(next)) throw new Error("Grounded social rhythm patch aborted: note priority chance changed.");
  next = next.replace(noteChance, "if (priorityNoteState && Math.random() < 0.25) {");

  const groupChance = /if \(groupInitiative && Math\.random\(\) < 0\.45\) return groupInitiative;/;
  if (!groupChance.test(next)) throw new Error("Grounded social rhythm patch aborted: group initiative chance changed.");
  next = next.replace(groupChance, "if (groupInitiative && Math.random() < 0.20) return groupInitiative;");

  const spontaneousDmChance = /if \(roll < 0\.36\) \{\r?\n\s*const bot =\r?\n\s*pickInitiator\(view\);/;
  if (!spontaneousDmChance.test(next)) throw new Error("Grounded social rhythm patch aborted: spontaneous DM chance changed.");
  next = next.replace(spontaneousDmChance, `if (roll >= 0.18 && roll < 0.24) {\n    const bot =\n      pickInitiator(view);`);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded autonomous DMs + calmer background rhythm + faster feed pulse.");
} else {
  console.log("Grounded social rhythm already applied.");
}
