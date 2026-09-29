import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const promptMarker = "ROLEPLAY PHYSICAL PRESUPPOSITION — HARD";
const helperMarker = "MÁSVILÁG ROLEPLAY PHYSICAL CONTINUITY GUARD v1";
const statusMarker = "MÁSVILÁG VERIFIED SCENE STATUS v1";
const switchMarker = "MÁSVILÁG SCENE JUMP STABILITY v1";

if (!next.includes(promptMarker)) {
  const anchor = /(ROLEPLAY FOLYTATÁS — FONTOS:\r?\n)/;
  if (!anchor.test(next)) {
    throw new Error("Scene coherence patch aborted: roleplay continuation anchor not found.");
  }

  const block = `\n${promptMarker}:\n- Folytonosságot feltételező szavakat (pl. „még mindig”, „továbbra is”, „nem engedi el”, „tovább fogja”, „keeps holding”, „doesn't let go”, „still grips”, „continues to hold”) CSAK akkor használj, ha egy KORÁBBI PONTOS turn ténylegesen létrehozta azt az állapotot.\n- Ha korábban senki nem fogta meg a másik csuklóját, kezét, karját, derekát stb., nem írhatod azt, hogy „nem engedi el” vagy „továbbra is fogja”. Ha karakterhű, új cselekvésként kezdeményezheti MOST — pl. „megfogja a csuklóját” — de ne találj ki hamis előzményt.\n- Minden action előtt végezz PRESUPPOZÍCIÓ-ELLENŐRZÉST: amit a mondat már fennálló tényként feltételez, szerepel-e valóban a pontos turn-naplóban? Ha nem, fogalmazd át új cselekvésre vagy válassz más reakciót.\n- A játékos direkt mondatára/kérdésére adott fizikai reakciónak is legyen szemantikai értelme. Ne helyettesítsd a választ egy random birtokló testtartással vagy olyan érintéssel, amelyhez nincs előzmény.\n\n`;
  next = next.replace(anchor, (match) => match + block);
}

if (!next.includes(helperMarker)) {
  const anchor = /(function sanitizeRoleplayAiOutput\(value\) \{)/;
  if (!anchor.test(next)) {
    throw new Error("Scene coherence patch aborted: roleplay sanitizer anchor not found.");
  }

  const helper = `/* ${helperMarker} */\nfunction roleplayHasUnsupportedPhysicalContinuation(actorId, text, priorTurns) {\n  const raw = String(text || "").trim();\n  if (!raw || !actorId) return false;\n\n  const continuationClaim = /\\b(?:does(?:n't| not)|won't)\\s+let\\s+go\\b|\\b(?:keeps?|kept|continues?|continued|still|remains?|remained)\\b.{0,42}\\b(?:hold|holding|held|grip|gripping|gripped|pin|pinning|pinned|press|pressing|pressed|trap|trapping|trapped|clasp|clasping|clasped)\\b/i;\n  if (!continuationClaim.test(raw)) return false;\n\n  const actorHistory = (Array.isArray(priorTurns) ? priorTurns : [])\n    .filter((turn) => turn && turn.authorId === actorId && turn.text)\n    .slice(-10)\n    .map((turn) => String(turn.text || ""))\n    .join(" ");\n\n  if (!actorHistory.trim()) return true;\n\n  const contactVerb = /\\b(?:grab|grabs|grabbed|grabbing|grip|grips|gripped|gripping|hold|holds|held|holding|seize|seizes|seized|seizing|pin|pins|pinned|pinning|clasp|clasps|clasped|clasping|catch|catches|caught|wrap|wraps|wrapped|wrapping|megfog|fogja|fogta|megragad|markol|szorít|szorítja|lefog|leszorít)\\b/i;\n  if (!contactVerb.test(actorHistory)) return true;\n\n  const bodyParts = [\n    ["wrist", /\\bwrists?\\b|csukl/i],\n    ["hand", /\\bhands?\\b|kéz|kezét|kezeit/i],\n    ["arm", /\\barms?\\b|karját|karjait|karjától/i],\n    ["waist", /\\bwaist\\b|derek/i],\n    ["neck", /\\bneck\\b|nyak/i],\n    ["shoulder", /\\bshoulders?\\b|váll/i],\n    ["hip", /\\bhips?\\b|csíp/i],\n    ["throat", /\\bthroat\\b|torok|tork/i],\n  ];\n\n  for (const [, re] of bodyParts) {\n    if (re.test(raw) && !re.test(actorHistory)) return true;\n  }\n\n  return false;\n}\n\n`;
  next = next.replace(anchor, helper + "$1");

  const resolverAnchor = /const roleplayText = stripRoleplayEmoji\(addressedText\);\r?\n\r?\n\s*return \{\r?\n\s*authorId: allowed \? resolvedId : null,/;
  if (!resolverAnchor.test(next)) {
    throw new Error("Scene coherence patch aborted: roleplay resolver anchor not found.");
  }
  next = next.replace(
    resolverAnchor,
    `const roleplayText = stripRoleplayEmoji(addressedText);\n            const unsupportedPhysicalContinuation =\n              !isNarr &&\n              allowed &&\n              roleplayHasUnsupportedPhysicalContinuation(\n                resolvedId,\n                roleplayText,\n                promptTurns\n              );\n\n            return {\n              authorId: allowed && !unsupportedPhysicalContinuation ? resolvedId : null,`
  );
}

if (!next.includes(statusMarker)) {
  const rowAnchor = /(function addSceneStatusUpdate\(n, scene, text, kind = "status", actorId = ""\) \{[\s\S]*?const row = \{\r?\n\s*id: uid\(\),\r?\n\s*ts: now\(\),)/;
  if (!rowAnchor.test(next)) {
    throw new Error("Scene coherence patch aborted: exact scene status row anchor not found.");
  }
  next = next.replace(rowAnchor, (match) => `${match}\n    source: "verified", /* ${statusMarker} */`);

  const moodAnchor = /if \(involvesPlayer && newMood && newMood !== old\.mood\) \{/;
  if (!moodAnchor.test(next)) {
    throw new Error("Scene coherence patch aborted: deterministic mood status anchor not found.");
  }
  next = next.replace(
    moodAnchor,
    `if (\n      involvesPlayer &&\n      newMood &&\n      newMood !== old.mood &&\n      Math.abs(Number(ch.delta) || 0) >= 8\n    ) {`
  );

  const aiStatusFn = /function applySceneAiStatusUpdates\(n, scene, out\) \{[\s\S]*?\r?\n\}/;
  if (!aiStatusFn.test(next)) {
    throw new Error("Scene coherence patch aborted: AI status function not found.");
  }
  next = next.replace(
    aiStatusFn,
    `function applySceneAiStatusUpdates(n, scene, out) {\n  /* ${statusMarker}: free-form model status text is intentionally ignored.\n   * Visible Scene status rows come only from code-verified state changes. */\n  return;\n}`
  );

  const eventLabelAnchor = /(const eventLimitLabel = sceneEventProgressText\(scene, eventLang, clockNow\);)/;
  if (!eventLabelAnchor.test(next)) {
    throw new Error("Scene coherence patch aborted: Scene status render setup anchor not found.");
  }
  next = next.replace(
    eventLabelAnchor,
    `$1\n  const verifiedStatusUpdates = Array.isArray(scene.statusUpdates)\n    ? scene.statusUpdates.filter((row) => row && row.source === "verified")\n    : [];`
  );

  const statusRenderOpen = /\{Array\.isArray\(scene\.statusUpdates\) && scene\.statusUpdates\.length \? \(/;
  const statusRenderList = /\{scene\.statusUpdates\.slice\(0, 6\)\.map\(\(row\) => \(/;
  if (!statusRenderOpen.test(next) || !statusRenderList.test(next)) {
    throw new Error("Scene coherence patch aborted: Scene status render anchor not found.");
  }
  next = next.replace(statusRenderOpen, `{verifiedStatusUpdates.length ? (`);
  next = next.replace(statusRenderList, `{verifiedStatusUpdates.slice(0, 6).map((row) => (`);
}

if (!next.includes(switchMarker)) {
  const switchEffect = /useEffect\(\(\) => \{\r?\n\s*if \(jump && jump\.type === "scene" && allScenes\.some\(\(s\) => s\.id === jump\.id\)\) setOpenId\(jump\.id\);\r?\n\s*\}, \[jump, allScenes\]\);/;
  if (!switchEffect.test(next)) {
    throw new Error("Scene coherence patch aborted: Scene jump effect anchor not found.");
  }
  next = next.replace(
    switchEffect,
    `/* ${switchMarker}: a persisted scene jump is consumed only when that jump itself changes.\n   * World/scene updates must never reopen an older scene over the one the player is viewing. */\n  useEffect(() => {\n    if (jump && jump.type === "scene" && allScenes.some((s) => s.id === jump.id)) {\n      setOpenId(jump.id);\n    }\n  }, [jump && jump.type, jump && jump.id, jump && jump.at]);`
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied Scene coherence + verified status + stable scene switching.");
} else {
  console.log("Scene coherence patch already applied.");
}
