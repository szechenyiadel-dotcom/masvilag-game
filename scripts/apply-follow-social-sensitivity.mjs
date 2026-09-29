import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG PERSONALITY-SENSITIVE FOLLOW DM v1";
const PROMPT_MARKER = "FOLLOW / UNFOLLOW SOCIAL TRIGGER — HARD CONTEXT";

function fail(message) {
  throw new Error(`Follow-social DM patch aborted: ${message}`);
}

if (!next.includes(MARKER)) {
  const groundingAnchor = "function autonomousDmGroundingEvidence(w, c) {";
  const followStateAnchor = "function setFollowState(";
  const addAccountAnchor = "async function addAccount(";

  if (!next.includes(groundingAnchor)) fail("autonomous DM grounding anchor not found");
  if (!next.includes(followStateAnchor)) fail("setFollowState anchor not found");
  if (!next.includes(addAccountAnchor)) fail("setFollowState end anchor not found");

  const helper = `/* ${MARKER} */
function personalityFollowDmSensitivity(w, actorId, playerId) {
  if (!w || !actorId || !playerId || actorId === playerId || isHuman(w, actorId)) return 0;
  const actor = charById(w, actorId);
  if (!actor) return 0;

  const obsession = relationshipObsessionLevel(w, actorId, playerId);
  if (obsession >= 3) return 4;

  const rel = getRel(w, actorId, playerId) || {};
  const lore = [
    characterLoreCorpus(actor),
    rel.bond,
    rel.type,
    rel.mood,
    rel.hidden,
    rel.why,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/obsess|fixat|megszáll|máni|possess|birtokl|clingy|ragaszkod|controll?ing|kontrolláló|territorial|territoriális/.test(lore)) return 4;
  if (/jealous|jealousy|féltéken|needy|igényli a figyelmet|attention[- ]?seeking|validation[- ]?seeking|visszaigazolás|insecure|bizonytalan|status[- ]?conscious|státuszérzékeny|narciss|nárcis/.test(lore)) return 3;
  if (/proud|büszke|competitive|versengő|image[- ]?conscious|imázs|social status|social-media/.test(lore)) return 2;
  return 0;
}

function recentPersonalityFollowSignal(w, actorId, playerId, maxAgeMs = 24 * 3600e3) {
  if (!w || !actorId || !playerId) return null;
  const sensitivity = personalityFollowDmSensitivity(w, actorId, playerId);
  if (sensitivity < 2) return null;

  const cutoff = now() - Math.max(60000, Number(maxAgeMs) || 0);
  const events = (Array.isArray(w.socialEvents) ? w.socialEvents : [])
    .filter((event) => {
      if (!event || !["follow", "unfollow"].includes(String(event.type || ""))) return false;
      if ((Number(event.ts) || 0) < cutoff) return false;
      const targets = Array.isArray(event.targetIds) ? event.targetIds.map(String) : [];
      const actor = String(event.actorId || "");
      return (
        (actor === String(playerId) && targets.includes(String(actorId))) ||
        (actor === String(actorId) && targets.includes(String(playerId)))
      );
    })
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0));

  const latest = events[0] || null;
  if (!latest) return null;

  const latestActor = String(latest.actorId || "");
  let signal = "";
  if (latestActor === String(playerId)) {
    signal = latest.type === "unfollow" ? "player-unfollowed-you" : "player-followed-you";
  } else if (
    latestActor === String(actorId) &&
    latest.type === "follow" &&
    isFollowing(w, actorId, playerId) &&
    !isFollowing(w, playerId, actorId)
  ) {
    signal = "you-follow-player-no-followback";
  }

  if (!signal) return null;
  return { signal, sensitivity, ts: Number(latest.ts) || now(), event: latest };
}

function personalityFollowDmPromptContext(w, bot, dmContext = {}) {
  if (!w || !bot || !w.meId) return "";
  const requestedSignal = dmContext && dmContext.trigger === "follow-social-signal"
    ? String(dmContext.followSignal || "")
    : "";
  if (!requestedSignal) return "";

  const sensitivity = personalityFollowDmSensitivity(w, bot.id, w.meId);
  if (sensitivity < 2) return "";

  const stillPlayerFollows = isFollowing(w, w.meId, bot.id);
  const stillBotFollows = isFollowing(w, bot.id, w.meId);
  if (requestedSignal === "player-followed-you" && !stillPlayerFollows) return "";
  if (requestedSignal === "player-unfollowed-you" && stillPlayerFollows) return "";
  if (requestedSignal === "you-follow-player-no-followback" && (!stillBotFollows || stillPlayerFollows)) return "";

  const en = worldLanguage(w, w.meId) === "en";
  const fact = requestedSignal === "player-followed-you"
    ? (en ? "The player just followed your profile." : "A játékos most bekövette a profilodat.")
    : requestedSignal === "player-unfollowed-you"
      ? (en ? "The player just unfollowed your profile." : "A játékos most kikövette a profilodat.")
      : (en ? "You follow the player, but they are not following you back." : "Te követed a játékost, de ő nem követ vissza.");

  return [
    "",
    "FOLLOW / UNFOLLOW SOCIAL TRIGGER — HARD CONTEXT:",
    "- GROUND TRUTH: " + fact,
    "- This DM exists ONLY because your own personality + exact relationship make this social signal emotionally noticeable to you. A normal, secure or indifferent character would not send this DM.",
    "- React in YOUR own established voice. Obsessive/possessive/clingy characters may be more intense; jealous/insecure/status-sensitive characters may tease, probe, complain, challenge or seek reassurance; a proud image-conscious character may be dry or pointed.",
    "- Do not use a generic social-media customer-service tone and do not explain the mechanic. Write what this person would actually text.",
    "- You may directly mention the follow/unfollow/follow-back issue, but do not invent a notification the platform never gave you. For an unfollow, frame it as something you noticed/checked if that fits your personality.",
    "- Keep it proportional. This is a social cue, not automatically a breakup, threat or major betrayal. Existing relationship canon still controls severity.",
    "- Do not invent any other event or shared history to justify the message.",
    "",
  ].join("\\n");
}

function maybeQueuePersonalityFollowDm(w, actorId, playerId, signal) {
  if (!w || !actorId || !playerId || actorId === playerId || isHuman(w, actorId)) return false;
  const actor = charById(w, actorId);
  if (!actor) return false;

  const level = personalityFollowDmSensitivity(w, actorId, playerId);
  if (level < 2) return false;

  if (signal === "player-followed-you" && !isFollowing(w, playerId, actorId)) return false;
  if (signal === "player-unfollowed-you" && isFollowing(w, playerId, actorId)) return false;
  if (signal === "you-follow-player-no-followback" && (!isFollowing(w, actorId, playerId) || isFollowing(w, playerId, actorId))) return false;

  const chanceBySignal = {
    "player-followed-you": level >= 4 ? 0.72 : level >= 3 ? 0.46 : 0.24,
    "player-unfollowed-you": level >= 4 ? 0.98 : level >= 3 ? 0.78 : 0.48,
    "you-follow-player-no-followback": level >= 4 ? 0.88 : level >= 3 ? 0.62 : 0.34,
  };
  const chance = Number(chanceBySignal[signal]) || 0;
  if (!chance || Math.random() > chance) return false;

  const sim = ensureSimState(w);
  const pending = Array.isArray(sim.queue)
    ? sim.queue.find((action) => action && action.type === "dm" && action.payload && action.payload.botId === actorId && action.payload.trigger === "follow-social-signal")
    : null;
  if (pending) {
    pending.payload.followSignal = signal;
    pending.payload.followSignalAt = now();
    return true;
  }

  const eventText = signal === "player-followed-you"
    ? "The player followed your profile."
    : signal === "player-unfollowed-you"
      ? "The player unfollowed your profile."
      : "You follow the player, but they have not followed you back.";

  rememberAboutTarget(w, actorId, playerId, {
    kind: "social",
    source: "follow-state",
    confidence: 1,
    timestamp: now(),
    text: eventText,
  });
  recordCharacterAgentPerception(w, actorId, {
    surface: "dm",
    targetId: playerId,
    refId: "follow-social:" + signal + ":" + now(),
    text: eventText,
    ts: now(),
  });

  return simEnqueue(
    w,
    mkAction(
      "dm",
      "follow-social-dm:" + actorId + ":" + playerId + ":" + Math.floor(now() / 600000),
      {
        botId: actorId,
        trigger: "follow-social-signal",
        followSignal: signal,
        followSignalAt: now(),
      },
      "event"
    )
  );
}

`;

  next = next.replace(groundingAnchor, helper + groundingAnchor);

  const groundingStart = next.indexOf(groundingAnchor);
  const groundingNextFn = groundingStart >= 0 ? next.indexOf("function autonomousDmEligible", groundingStart) : -1;
  if (groundingStart < 0 || groundingNextFn < 0) fail("autonomous DM grounding function boundaries changed");
  const groundingPrefix = next.slice(groundingStart, groundingNextFn);
  const groundingCloseMatch = groundingPrefix.match(/}\s*$/);
  if (!groundingCloseMatch) fail("autonomous DM grounding closing brace changed");
  const groundingEnd = groundingStart + groundingCloseMatch.index + 1;
  let grounding = next.slice(groundingStart, groundingEnd);
  if (!grounding.includes("personality-follow-event")) {
    const returnAnchor = "  return { eligible: reasons.length > 0, reasons };";
    if (!grounding.includes(returnAnchor)) fail("autonomous DM grounding return anchor changed");
    grounding = grounding.replace(
      returnAnchor,
      `  const followSignal = recentPersonalityFollowSignal(w, c.id, me);\n  if (followSignal) reasons.push("personality-follow-event");\n\n${returnAnchor}`
    );
    next = next.slice(0, groundingStart) + grounding + next.slice(groundingEnd);
  }

  const genStart = next.indexOf("async function genDM(");
  const genEnd = genStart >= 0 ? next.indexOf("async function genForcedEverydayDM(", genStart) : -1;
  if (genStart < 0 || genEnd < 0) fail("genDM boundaries not found");
  let gen = next.slice(genStart, genEnd);

  if (!gen.startsWith("async function genDM(w, bot, dmContext = {})")) {
    const signature = /async function genDM\(w, bot\) \{/;
    if (!signature.test(gen)) fail("genDM signature changed");
    gen = gen.replace(signature, "async function genDM(w, bot, dmContext = {}) {");
  }

  if (!gen.includes(PROMPT_MARKER)) {
    const promptAnchor = /PRIVÁT ÜZENET SZABÁLYOK:\r?\n/;
    if (!promptAnchor.test(gen)) fail("genDM prompt anchor not found");
    gen = gen.replace(
      promptAnchor,
      '${personalityFollowDmPromptContext(w, bot, dmContext)}\nPRIVÁT ÜZENET SZABÁLYOK:\n'
    );
  }
  next = next.slice(0, genStart) + gen + next.slice(genEnd);

  const runnerStart = next.indexOf("async function runSimulationAction(");
  const runnerEnd = runnerStart >= 0 ? next.indexOf("export default function App()", runnerStart) : -1;
  if (runnerStart < 0 || runnerEnd < 0) fail("simulation runner boundaries not found");
  let runner = next.slice(runnerStart, runnerEnd);
  if (!runner.includes("await genDM(view, bot, action && action.payload ? action.payload : {});")) {
    const callAnchor = /await genDM\(view, bot\);/;
    if (!callAnchor.test(runner)) fail("autonomous genDM call anchor not found");
    runner = runner.replace(callAnchor, "await genDM(view, bot, action && action.payload ? action.payload : {});");
  }
  next = next.slice(0, runnerStart) + runner + next.slice(runnerEnd);

  const followStart = next.indexOf(followStateAnchor);
  const followEnd = followStart >= 0 ? next.indexOf(addAccountAnchor, followStart) : -1;
  if (followStart < 0 || followEnd < 0) fail("setFollowState function boundaries not found");
  let followBlock = next.slice(followStart, followEnd);

  if (!followBlock.includes("PERSONALITY-SENSITIVE FOLLOW DM EVENT HOOK")) {
    const returnIndex = followBlock.lastIndexOf("  return true;");
    if (returnIndex < 0) fail("setFollowState final return anchor not found");
    const hook = `  /* PERSONALITY-SENSITIVE FOLLOW DM EVENT HOOK
   * No timer/polling: this runs only on a real follow-state transition and
   * hands one optional DM to the existing queue when personality supports it. */
  if (source === "player" && isHuman(w, follower.id) && !isHuman(w, target.id)) {
    maybeQueuePersonalityFollowDm(
      w,
      target.id,
      follower.id,
      shouldFollow ? "player-followed-you" : "player-unfollowed-you"
    );
  } else if (
    shouldFollow &&
    !isHuman(w, follower.id) &&
    isHuman(w, target.id) &&
    !isFollowing(w, target.id, follower.id)
  ) {
    maybeQueuePersonalityFollowDm(
      w,
      follower.id,
      target.id,
      "you-follow-player-no-followback"
    );
  }

`;
    followBlock = followBlock.slice(0, returnIndex) + hook + followBlock.slice(returnIndex);
  }
  next = next.slice(0, followStart) + followBlock + next.slice(followEnd);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied personality-sensitive follow/unfollow DM initiation.");
} else {
  console.log("Personality-sensitive follow/unfollow DM initiation already applied.");
}
