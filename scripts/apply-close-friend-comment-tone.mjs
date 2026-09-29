import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "MÁSVILÁG CLOSE FRIEND PUBLIC TONE GUARD v1";

if (!next.includes(marker)) {
  const anchor = /function socialCommentContradictsRelationship\(\r?\n\s*w,\r?\n\s*actorId,\r?\n\s*targetId,\r?\n\s*text,\r?\n\s*contextText = ""\r?\n\s*\) \{/;
  const match = next.match(anchor);
  if (!match) {
    throw new Error("Close-friend comment patch aborted: relationship comment guard anchor not found.");
  }

  const legacyHeader = match[0].replace(
    "function socialCommentContradictsRelationship(",
    "function legacySocialCommentContradictsRelationship("
  );

  const helper = `/* ${marker} */
function closeFriendPublicPutdownMismatch(w, actorId, targetId, text, contextText = "") {
  if (!w || !actorId || !targetId || actorId === targetId) return false;

  const actor = charById(w, actorId);
  const target = charById(w, targetId);
  if (!actor || !target) return false;

  const rel = getRel(w, actorId, targetId) || {};
  const reverse = getRel(w, targetId, actorId) || {};
  const cue = connectionRelationshipCue(w, actor, target) || {};
  const reverseCue = connectionRelationshipCue(w, target, actor) || {};
  const tier = relationshipFilterTier(effectiveRelationshipForBehavior(w, actorId, targetId));
  const reverseTier = relationshipFilterTier(effectiveRelationshipForBehavior(w, targetId, actorId));

  const relText = [rel.bond, rel.type, rel.mood, rel.hidden, rel.why, cue.snippet]
    .filter(Boolean).join(" ").toLowerCase();
  const reverseText = [reverse.bond, reverse.type, reverse.mood, reverse.hidden, reverse.why, reverseCue.snippet]
    .filter(Boolean).join(" ").toLowerCase();

  const actorClose = Boolean(
    cue.close ||
    tier === "close" ||
    /best\\s*friend|close\\s*friend|ride\\s*or\\s*die|legjobb\\s+bar[aá]t|k[oö]zeli\\s+bar[aá]t|chosen\\s+(?:sister|brother|family)/i.test(relText)
  );
  const reversePositive = Boolean(
    reverseCue.close ||
    reverseTier === "close" ||
    reverseTier === "good" ||
    relationshipDeclaresFriendship(reverse) ||
    /best\\s*friend|close\\s*friend|ride\\s*or\\s*die|legjobb\\s+bar[aá]t|k[oö]zeli\\s+bar[aá]t/i.test(reverseText)
  );

  /* This hard guard is intentionally narrow: it protects close/best-friend
   * dynamics, while ordinary friends/rivals can still have sharper banter. */
  if (!actorClose || !reversePositive) return false;

  const liveConflictText = [rel.mood, rel.why, reverse.mood, reverse.why]
    .filter(Boolean).join(" ").toLowerCase();
  const explicitLiveConflict =
    Number(rel.score) <= -10 ||
    /\\b(?:angry|mad|furious|hurt|betray|betrayed|resent|hostile|fight|fighting|argument|arguing|conflict|jealous|jealousy|upset|harag|d[uü]h|s[eé]rtett|el[aá]rul|veszeked|vita|konflikt|f[eé]lt[eé]ken)\\b/i.test(liveConflictText);

  if (explicitLiveConflict) return false;

  const raw = String(text || "").replace(/\\s+/g, " ").trim().toLowerCase();
  const context = String(contextText || "").replace(/\\s+/g, " ").trim().toLowerCase();
  if (!raw) return false;

  /* Public best-friend teasing may be dry or sarcastic. What is NOT normal
   * without a real conflict is status/self-worth humiliation: implying the
   * friend is pathetic, desperate for validation, unattractive, embarrassing,
   * or publicly rejecting them on an appearance/validation post. */
  const directHumiliation = /\\b(?:desperate\\s+for\\s+(?:attention|validation)|begging\\s+for\\s+(?:attention|validation)|fishing\\s+for\\s+(?:compliments|validation|attention)|scrolling\\s+for\\s+validation|validation[- ]seeking|attention[- ]seeking|pathetic|embarrassing|delusional|needy|insecure)\\b/i.test(raw) ||
    /\\byou(?:'re|\\s+are)\\s+(?:desperate|pathetic|embarrassing|cringe|delusional|needy|insecure)\\b/i.test(raw);

  const appearanceOrValidationPost = /\\b(?:hot|hottest|pretty|prettiest|beautiful|gorgeous|sexy|attractive|attractiveness|who\\s+is\\s+the|who'?s\\s+the|validation|rate\\s+me|rating)\\b/i.test(context);
  const publicRejection = appearanceOrValidationPost && (
    /\\b(?:surely|definitely|obviously|clearly)\\s+not\\s+you\\b/i.test(raw) ||
    /(?:^|[.!?\\s])not\\s+you(?:$|[.!?\\s])/i.test(raw) ||
    /\\b(?:you\\s+wish|keep\\s+scrolling|try\\s+again|not\\s+even\\s+close|who\\s+told\\s+you|couldn['’]?t\\s+be\\s+you)\\b/i.test(raw) ||
    (/\\bvalidation\\b/i.test(raw) && /\\b(?:you|your|u|ur)\\b/i.test(raw))
  );

  return directHumiliation || publicRejection;
}

function socialCommentContradictsRelationship(w, actorId, targetId, text, contextText = "") {
  if (closeFriendPublicPutdownMismatch(w, actorId, targetId, text, contextText)) {
    return true;
  }
  return legacySocialCommentContradictsRelationship(w, actorId, targetId, text, contextText);
}

`;

  next = next.replace(match[0], helper + legacyHeader);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied close/best-friend public comment tone guard.");
} else {
  console.log("Close/best-friend public comment tone guard already applied.");
}
