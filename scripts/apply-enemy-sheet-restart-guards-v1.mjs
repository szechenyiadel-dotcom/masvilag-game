import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG ENEMY + SHEET RESTART GUARDS v1";

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) {
    throw new Error(`Enemy/sheet guard aborted: ${label} expected exactly one anchor.`);
  }
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

function replaceBlock(startText, endText, replacement, label) {
  const start = next.indexOf(startText);
  const secondStart = start >= 0 ? next.indexOf(startText, start + startText.length) : -1;
  const end = start >= 0 ? next.indexOf(endText, start + startText.length) : -1;
  if (start < 0 || secondStart >= 0 || end < 0) {
    throw new Error(`Enemy/sheet guard aborted: ${label} block anchor mismatch.`);
  }
  next = next.slice(0, start) + replacement + "\n\n" + next.slice(end);
}

function replaceInsideBlock(startText, endText, oldText, newText, label) {
  const start = next.indexOf(startText);
  const end = start >= 0 ? next.indexOf(endText, start + startText.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Enemy/sheet guard aborted: ${label} function boundaries not found.`);
  }
  const block = next.slice(start, end);
  const first = block.indexOf(oldText);
  const second = first >= 0 ? block.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) {
    throw new Error(`Enemy/sheet guard aborted: ${label} expected exactly one inner anchor.`);
  }
  const patched = block.slice(0, first) + newText + block.slice(first + oldText.length);
  next = next.slice(0, start) + patched + next.slice(end);
}

if (!next.includes(`/* ${MARKER} */`)) {
  const enemyHelperAnchor = "function playerPostCommentGeneratedTone(text) {";
  const enemyGuard = `/* ${MARKER} */
const PLAYER_POST_COMMENT_ENEMY_SUPPORT_RE =
  /\\b(?:you\\s+got\\s+this|you(?:'ve| have)\\s+got\\s+this|keep\\s+(?:going|grinding|pushing|it\\s+up)|stay\\s+(?:focused|strong)|good\\s+luck|rooting\\s+for\\s+you|believe\\s+in\\s+you|proud\\s+of\\s+you|don['’]?t\\s+let\\s+.*\\s+get\\s+to\\s+you|show\\s+them|go\\s+get\\s+it|nice\\s+work|great\\s+work|well\\s+done|congrats?|respect|hajrá|csak\\s+így\\s+tovább|ügyes\\s+vagy|büszke\\s+vagyok\\s+rád|szurkolok\\s+neked|menni\\s+fog|ne\\s+hagyd,?\\s+hogy.*letörjön)\\b|[🔥💪👏🙌]/iu;

function playerPostCommentIsEnemyCard(card) {
  const rel = card && card.relationshipToPostAuthor || {};
  const labels = [rel.type, rel.officialStatus].filter(Boolean).join(" ").toLowerCase();
  return /enemy|ellens/.test(labels) || Number(rel.score) <= -70;
}

${enemyHelperAnchor}`;
  replaceExact(enemyHelperAnchor, enemyGuard, "enemy support guard helper");

  const enemySeenAnchor = `      seen.add(actorId);`;
  const enemySeenGuard = `      const commenterCard = cards.find((card) => card && card.id === actorId);
      if (
        playerPostCommentIsEnemyCard(commenterCard) &&
        (PLAYER_POST_COMMENT_POSITIVE_RE.test(text) || PLAYER_POST_COMMENT_ENEMY_SUPPORT_RE.test(text))
      ) {
        console.warn("[player-post-comments] rejected=enemy-support-hype", "character=" + actorId, "text=" + text.slice(0, 180));
        return;
      }

      seen.add(actorId);`;
  replaceInsideBlock(
    "function playerPostCommentRowsFromOutput(w, out, cards, postContext) {",
    "function playerPostCommentBatchProblems(",
    enemySeenAnchor,
    enemySeenGuard,
    "enemy output rejection"
  );

  replaceExact(
    `        "Positive/friendly relationships should read warm, supportive, playful or naturally flirty when appropriate; hostile relationships may be sharp; jealous relationships may be pointed; neutral relationships may be brief and neutral.",`,
    `        "Positive/friendly relationships should read warm, supportive, playful or naturally flirty when appropriate; ENEMY relationships are hard-adversarial: enemies must NEVER praise, encourage, motivate, congratulate, protect, compliment, admire or hype each other. Enemy comments should be hostile, cold, mocking, dismissive, confrontational, competitive or silent according to character; jealous relationships may be pointed; neutral relationships may be brief and neutral.",`,
    "English enemy prompt contract"
  );
  replaceExact(
    `        "Pozitív/baráti kapcsolatnál legyen meleg, támogató, játékos vagy indokoltan flörtös; ellenségesnél lehet éles; féltékenynél célzós; semlegesnél rövid és semleges.",`,
    `        "Pozitív/baráti kapcsolatnál legyen meleg, támogató, játékos vagy indokoltan flörtös; ELLENSÉG kapcsolatnál kemény szabály, hogy SOHA ne dicsérje, biztassa, motiválja, gratuláljon, védje, bókolja, csodálja vagy hype-olja az ellenségét. Az ellenséges komment legyen a karakterhez illően ellenséges, hideg, gúnyos, lekezelő, konfrontatív, versengő vagy maradjon csendben; féltékenynél célzós; semlegesnél rövid és semleges.",`,
    "Hungarian enemy prompt contract"
  );

  const deterministicSummary = `function ensureCharacterContextSummary(c) {
  const parts = characterSheetSourceParts(c);
  const sourceHash = simsSocialStableHash(parts.publicText + "\\n---PRIVATE---\\n" + parts.privateText);
  const publicDigest = simsSocialSectionDigest(parts.publicText, 9000);
  const privateDigest = simsSocialSectionDigest(parts.privateText, 18000);
  const sheetSummary = {
    version: 2,
    sourceHash,
    public: publicDigest,
    private: [publicDigest, privateDigest].filter(Boolean).join("\\n\\n").slice(0, 24000),
    updatedAt: now(),
    generatedBy: "deterministic-sheet",
    pending: false,
  };
  if (c && typeof c === "object") c.aiContextSummary = sheetSummary;
  return sheetSummary;
}`;
  replaceBlock(
    "function ensureCharacterContextSummary(c) {",
    "function maybeQueueCharacterSummary(w, c) {",
    deterministicSummary,
    "deterministic character-sheet summary"
  );

  replaceExact(
    `  if (!summary.pending && summary.generatedBy === "ai") return;`,
    `  if (!summary.pending && (summary.generatedBy === "ai" || summary.generatedBy === "deterministic-sheet")) return;`,
    "disable AI re-summary for authoritative sheet context"
  );

  const lensReturn = `  return rows.length ? "CHARACTER SUMMARY LENS — STORED, RELEVANT ONLY:\\n" + rows.join("\\n\\n") : "";`;
  const strictLensReturn = `  return rows.length ? "CHARACTER SHEET LENS — CURRENT RAW-SHEET DERIVED FACTS, RELEVANT ONLY:\\nFACT FIDELITY — HARD: job, occupation, school, university, role, faction and relationships are literal sheet facts. Never infer that someone is a student (or any other role/job) from age, setting or stereotype when the sheet does not say so. Never replace an explicit hate/enemy relationship with obsession, attraction or affection unless that exact contradiction is actually present in the current sheet.\\n" + rows.join("\\n\\n") : "";`;
  replaceExact(lensReturn, strictLensReturn, "sheet fact-fidelity lens");

  replaceExact(
    `  if (/resent|neheztel|harag|angry at/.test(low)) push("resentment");
  if (/hate|gy[uű]l[oö]l/.test(low)) push("hatred");`,
    `  if (/resent|neheztel|harag|angry at/.test(low)) push("resentment");
  if (/\\benemy\\b|ellens[eé]g|hate|gy[uű]l[oö]l|ut[aá]l|despis|loath|detest/.test(low)) push("hatred");`,
    "hatred signal coverage"
  );

  const baselineSignalAnchor = `  const signals = directedRelationshipSignals(direct);
  const low = String(direct).toLowerCase();`;
  const baselineSignalGuard = `  const signals = directedRelationshipSignals(direct);
  const low = String(direct).toLowerCase();
  const explicitEnemy = /\\benemy\\b|ellens[eé]g|hate|gy[uű]l[oö]l|ut[aá]l|despis|loath|detest/.test(low);`;
  replaceExact(baselineSignalAnchor, baselineSignalGuard, "explicit enemy baseline detector");

  const hiddenAnchor = `  base.mood = signals.length ? signals.join(", ") : (base.mood || "complex directed relationship");
  base.hidden = directedHiddenCanon(direct);`;
  const hiddenWithEnemy = `  base.mood = signals.length ? signals.join(", ") : (base.mood || "complex directed relationship");
  base.hidden = directedHiddenCanon(direct);

  /* On a fresh world, explicit current sheet hatred/enemy canon must beat any stale/coarse cached reading. */
  if (explicitEnemy) {
    base.bond = "Enemy";
    base.score = Math.min(Number(base.score) || 0, -85);
    if (!signals.includes("hatred")) base.mood = [base.mood, "hatred"].filter(Boolean).join(", ");
  }`;
  replaceExact(hiddenAnchor, hiddenWithEnemy, "fresh-world enemy baseline override");


}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] enemy-sheet-restart-guards=v1 applied; scope=enemy-comments+sheet-fidelity+fresh-baseline");
} else {
  console.log("[patch-status] enemy-sheet-restart-guards=v1 already applied");
}
