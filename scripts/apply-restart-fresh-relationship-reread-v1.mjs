import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG RESTART FRESH RELATIONSHIP REREAD v1";

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) {
    throw new Error("Restart relationship reread patch aborted: " + label + " anchor mismatch.");
  }
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes("/* " + MARKER + " */")) {
  const helperAnchor = "function restartWorldHistoryInPlace(w) {";
  const helper = `
/* ${MARKER} */
function prepareRelationshipsForTrueFreshRestart(w, at = now()) {
  if (!w || typeof w !== "object") return;

  /* The user explicitly requested a CHARACTER-SHEET fresh restart.
     Do not carry any previous relationship baseline — including legacy rows that
     were accidentally promoted to "manual" by simply saving a character form.
     The retained sheets / Connections become the fresh source of truth. */
  ensureRelationshipBaselineStore(w);
  w.relationshipBaselines = {};

  /* A restart is a new interpretation pass too, not only a new social timeline. */
  w.sim = freshSimulationRuntime(at);
  w.sim.relationshipReadingForceFresh = true;
  w.sim.relationshipReadingRestartEpoch = Number(w.historyEpoch || 0);

  /* Module-local memoization must not make the new run look already analyzed. */
  try { RELATIONSHIP_READING_CHECKED.clear(); } catch (_) {}
  try { READING_CACHE_CHECKED.clear(); } catch (_) {}
  try { READING_CACHE_HITS.clear(); } catch (_) {}
  try { SHEET_PASSAGES_CACHE.clear(); } catch (_) {}
  try { RELATIONSHIP_READING_PROGRESS_CACHE = { at: 0, key: "", value: null }; } catch (_) {}

  /* Identity + character bible + relationshipReading intentionally do NOT
     survive. Their due-actions will reconstruct them from the kept sheets. */
  delete w.sim.identityCanon;
  delete w.sim.characterBible;
  delete w.sim.relationshipReading;
}

`;
  if (!next.includes(helperAnchor)) throw new Error("Restart relationship reread patch aborted: restart handler anchor missing.");
  next = next.replace(helperAnchor, helper + helperAnchor);

  const historyAnchor = `  /* Private conversations + all learned/observed memory. */
  w.chats = {};
  w.groups = [];
  w.mems = {};
  w.charMemory = {};

  /*
   * Restore the actual fresh-run relationship graph:
   * - manual relationship-editor starting values return;
   * - active character names in Connections/backstory seed relationships;
   * - rival factions/dojos default negative unless personal canon overrides;
   * - live score/bond drift from the previous run does NOT become the new start.
   */
  restoreRelationshipBaselinesForFreshRun(w, at);`;

  const historyReplacement = `  /* Private conversations + all learned/observed memory. */
  w.chats = {};
  w.groups = [];
  w.mems = {};
  w.charMemory = {};

  /*
   * TRUE FRESH RELATIONSHIP RESTART:
   * retain the character sheets, but discard every previous relationship baseline and
   * AI/sheet-derived baseline and every previous AI interpretation. This must
   * happen BEFORE restoreRelationshipBaselinesForFreshRun(), otherwise stale
   * relationship rows can be copied straight into the new run.
   */
  prepareRelationshipsForTrueFreshRestart(w, at);

  /*
   * Rebuild the immediate deterministic starting graph from the retained
   * character sheets + manual baselines. The deep AI relationship reader then
   * rereads every applicable pair from zero in the new simulation runtime.
   */
  restoreRelationshipBaselinesForFreshRun(w, at);`;
  replaceExact(historyAnchor, historyReplacement, "fresh-run baseline ordering");

  const runtimeAnchor = `  /* New autonomous runtime starts cleanly instead of replaying queued old work. */
  w.autoAt = 0;
  /* CLAUDE FIX R37: the sheet readings (who is who, character bible) are kept —
     they re-read themselves when a sheet changes — but EVERY relationship is
     read again from the sheets on each restart. */
  const keptIdentity = w.sim && w.sim.identityCanon;
  const keptBible = w.sim && w.sim.characterBible;
  /* R40: relationship readings are kept too — the fresh run starts EXACTLY from
     them at once; a pair is only read again if its sheet passages changed. */
  const keptReadings = w.sim && w.sim.relationshipReading;
  w.sim = freshSimulationRuntime(at);
  if (keptIdentity) w.sim.identityCanon = keptIdentity;
  if (keptBible) w.sim.characterBible = keptBible;
  if (keptReadings) w.sim.relationshipReading = keptReadings;
  try { RELATIONSHIP_READING_CHECKED.clear(); READING_CACHE_CHECKED.clear(); } catch (error) { /* first load */ }
  w.activeSceneId = "";`;

  const runtimeReplacement = `  /* New autonomous runtime was already created by
     prepareRelationshipsForTrueFreshRestart(). Do NOT restore identity canon,
     character bible or relationshipReading from the previous run here. */
  w.autoAt = 0;
  if (!w.sim || typeof w.sim !== "object") w.sim = freshSimulationRuntime(at);
  w.sim.relationshipReadingForceFresh = true;
  w.sim.relationshipReadingRestartEpoch = Number(w.historyEpoch || 0);
  try { RELATIONSHIP_READING_CHECKED.clear(); READING_CACHE_CHECKED.clear(); READING_CACHE_HITS.clear(); } catch (error) { /* first load */ }
  w.activeSceneId = "";`;
  replaceExact(runtimeAnchor, runtimeReplacement, "stale reading preservation");

  const cacheAnchor = `function relationshipReadingCacheDueAction(w) {
  if (!w || !w.meId) return null;`;
  const cacheReplacement = `function relationshipReadingCacheDueAction(w) {
  if (!w || !w.meId) return null;
  /* Restart-world means RE-READ, not restore an earlier server reading. */
  if (w.sim && w.sim.relationshipReadingForceFresh) return null;`;
  replaceExact(cacheAnchor, cacheReplacement, "shared reading-cache bypass");

  const planAnchor = `function planAutoAction(view) {
  const followBack = groundedDueFollowBackAction(view);
  if (followBack) return followBack;
  const cached = relationshipReadingCacheDueAction(view);
  if (cached) return cached;
  const playerReading = relationshipReadingDueAction(view, { playerOnly: true });
  if (playerReading) return playerReading;
  const identity = identityCanonDueAction(view);
  if (identity) return identity;`;

  const planReplacement = `function planAutoAction(view) {
  const followBack = groundedDueFollowBackAction(view);
  if (followBack) return followBack;

  /* On an explicit keep-characters restart, rebuild WHO-IS-WHO first so dojo,
     team, school and hierarchy facts exist before any relationship judgment. */
  if (view && view.sim && view.sim.relationshipReadingForceFresh) {
    const freshIdentity = identityCanonDueAction(view);
    if (freshIdentity) return freshIdentity;
  }

  const cached = relationshipReadingCacheDueAction(view);
  if (cached) return cached;
  const playerReading = relationshipReadingDueAction(view, { playerOnly: true });
  if (playerReading) return playerReading;
  const identity = identityCanonDueAction(view);
  if (identity) return identity;`;
  replaceExact(planAnchor, planReplacement, "restart identity-before-relationships order");

  const msgHu = "A világ új játékmenetet kezdett. A karakterek megmaradtak, a kapcsolatok pedig a kézzel beállított + karakterlap/Connections alapján felépített kiinduló baseline-ra álltak vissza. A rivális dojo/frakciók explicit személyes kivétel nélkül negatív viszonnyal indulnak. A napi poszt-, képesposzt- és popup-kvóták újraindultak, a korábban kiposztolt AI-albumképek visszakerültek az albumokba.";
  const msgHuNew = "A világ új játékmenetet kezdett. A karakterek és karakterlapok megmaradtak, de az összes korábbi AI-kapcsolatértelmezés és AI-ból származó kapcsolati baseline törlődött. A rendszer most újraolvassa az identity/dojo/szervezet adatokat és utána minden kapcsolatot frissen épít fel a karakterlapok/Connections alapján.";
  replaceExact(msgHu, msgHuNew, "restart success copy hu");

  const msgEn = "The world started a fresh run. Characters were kept, while relationships were restored to the starting baseline built from manual settings plus character-sheet/Connections canon. Rival dojos/factions start negative unless explicit personal canon overrides that. Daily post, image-post and popup quotas restarted, and previously posted AI album images returned to their albums.";
  const msgEnNew = "The world started a fresh run. Characters and their sheets were kept, but every previous AI relationship interpretation and AI-derived relationship baseline was cleared. The system is now rereading identity/dojo/organization facts first and then rebuilding every relationship fresh from character sheets/Connections.";
  replaceExact(msgEn, msgEnNew, "restart success copy en");

  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] restart-fresh-relationship-reread=v1 applied; old-ai-baselines=cleared; shared-reading-cache=bypassed");
} else {
  console.log("[patch-status] restart-fresh-relationship-reread=v1 already applied");
}
