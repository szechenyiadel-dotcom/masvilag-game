import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG FULL SPEC COMPLETION v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function renameOne(regex, replacement, label, required = true) {
  const count = countMatches(next, regex);
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Full spec completion aborted: ${label} expected 1 match, found ${count}.`);
}

function patchFunctionBlock(startNeedle, endNeedle, replacement, label) {
  const start = next.indexOf(startNeedle);
  const end = start >= 0 ? next.indexOf(endNeedle, start + startNeedle.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Full spec completion aborted: ${label} boundary not found.`);
  }
  next = next.slice(0, start) + replacement + "\n\n" + next.slice(end);
}

if (!next.includes(`/* ${MARKER} */`)) {
  /* -----------------------------------------------------------------------
     1) Make the event-feed refresh atomic at the requested 6-post minimum.
     The existing implementation still keeps the hard 2-call maximum.
     ----------------------------------------------------------------------- */
  {
    const start = next.indexOf('const eventFeedTrigger = String(action.payload && action.payload.trigger || "");');
    const end = start >= 0 ? next.indexOf('return visiblePostsCreated ||', start) : -1;
    if (start < 0 || end < 0) {
      throw new Error("Full spec completion aborted: event-feed handler boundary not found.");
    }
    let block = next.slice(start, end);
    const needle = "    out = merged;";
    if (!block.includes(needle)) {
      throw new Error("Full spec completion aborted: event-feed merged output anchor missing.");
    }
    block = block.replace(
      needle,
      `    if (merged.posts.length < AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS) {
      console.warn(
        "[feed-refresh]",
        "incomplete-batch-aborted",
        "trigger=" + eventFeedTrigger,
        "posts=" + String(merged.posts.length),
        "required=" + String(AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS),
        "aiCalls=" + String(feedAiCalls)
      );
      out = { ...merged, posts: [] };
    } else {
      out = merged;
    }`
    );
    next = next.slice(0, start) + block + next.slice(end);
  }

  /* -----------------------------------------------------------------------
     2) Direct DM protected context: compact ONLY the older background, from
     the oldest side first. The protected tail itself is never trimmed.
     ----------------------------------------------------------------------- */
  patchFunctionBlock(
    "function directDmPrebudgetPrompt(prompt, protectedTail) {",
    "function directDmPromptDebugLog(",
    String.raw`function directDmPrebudgetPrompt(prompt, protectedTail) {
  const base = String(prompt || "");
  const tail = String(protectedTail || "");
  const cap = Math.max(28000, Number(AI_MAX_PROMPT_CHARS) || 82000);

  if (!tail) {
    return base.length <= cap ? base : base.slice(Math.max(0, base.length - cap));
  }

  if (tail.length >= cap) {
    console.warn(
      "[dm-prompt-tail] protected context exceeds normal prompt cap; preserving it intact",
      "tailChars=" + tail.length,
      "cap=" + cap
    );
    return tail;
  }

  const marker = "\n\n[DM BACKGROUND COMPACTED OLDEST-FIRST]\n\n";
  const backgroundBudget = Math.max(0, cap - tail.length - marker.length);

  if (base.length <= backgroundBudget) {
    return base + tail;
  }

  /* The protected tail contains the current DM history + voice card + exact
     latest message. Everything before it is background. Drop the oldest
     background first and retain the newest suffix. */
  const background = backgroundBudget > 0
    ? base.slice(Math.max(0, base.length - backgroundBudget))
    : "";

  return marker + background + tail;
}`,
    "direct DM oldest-first prebudget"
  );

  /* -----------------------------------------------------------------------
     3) Wrap final generated functions. We do not rename source files or saved
     fields; these are build-time aliases only.
     ----------------------------------------------------------------------- */
  renameOne(/function\s+budgetAiRequest\s*\(/, "function legacyFullSpecBudgetAiRequest(", "budgetAiRequest");
  renameOne(/function\s+applyChannelRelationshipChanges\s*\(/, "function legacyFullSpecApplyChannelRelationshipChanges(", "applyChannelRelationshipChanges");
  renameOne(/function\s+applySceneChangesWithStatus\s*\(/, "function legacyFullSpecApplySceneChangesWithStatus(", "applySceneChangesWithStatus");
  renameOne(/function\s+recordSocialEvent\s*\(/, "function legacyFullSpecRecordSocialEvent(", "recordSocialEvent");
  renameOne(/function\s+simsSocialApplyEventConsequences\s*\(/, "function legacyFullSpecSimsSocialApplyEventConsequences(", "simsSocialApplyEventConsequences");
  renameOne(/function\s+applyComments\s*\(/, "function legacyFullSpecApplyComments(", "applyComments");
  renameOne(/function\s+noteComment\s*\(/, "function legacyFullSpecNoteComment(", "noteComment");
  renameOne(/function\s+planAutoAction\s*\(/, "function legacyFullSpecPlanAutoAction(", "planAutoAction");
  renameOne(/async function\s+runSimulationAction\s*\(/, "async function legacyFullSpecRunSimulationAction(", "runSimulationAction");
  renameOne(/function\s+enqueueNaturalThreadReply\s*\(/, "function legacyFullSpecEnqueueNaturalThreadReply(", "enqueueNaturalThreadReply");
  renameOne(/function\s+enqueueVisualCrushThreadFriction\s*\(/, "function legacyFullSpecEnqueueVisualCrushThreadFriction(", "enqueueVisualCrushThreadFriction", false);
  renameOne(/function\s+ensureEventDrivenGossipPost\s*\(/, "function legacyFullSpecEnsureEventDrivenGossipPost(", "ensureEventDrivenGossipPost");
  renameOne(/function\s+recordExplicitMutualRelationshipMilestones\s*\(/, "function legacyFullSpecRecordExplicitMutualRelationshipMilestones(", "recordExplicitMutualRelationshipMilestones");

  const helper = String.raw`

/* ${MARKER} */
const FULL_SPEC_COMPLETION_SETTINGS = Object.freeze({
  DEFERRED_DM_RETRY_MS: 5 * 60 * 1000,
  DEFERRED_DM_MAX_ATTEMPTS: 3,
  FOLLOW_BACK_GRACE_MS: 3 * 60 * 1000,
  EVENT_DM_MAX_CANDIDATES: 2,
  EVENT_DM_RECENT_DEDUPE_MS: 15 * 60 * 1000,
});

function fullSpecState(w) {
  if (!w || typeof w !== "object") return null;
  const sim = ensureSimState(w);
  if (!sim.fullSpecCompletion || typeof sim.fullSpecCompletion !== "object" || Array.isArray(sim.fullSpecCompletion)) {
    sim.fullSpecCompletion = {};
  }
  const state = sim.fullSpecCompletion;
  if (!state.dmFallbacks || typeof state.dmFallbacks !== "object" || Array.isArray(state.dmFallbacks)) state.dmFallbacks = {};
  if (!state.pendingDmTriggers || typeof state.pendingDmTriggers !== "object" || Array.isArray(state.pendingDmTriggers)) state.pendingDmTriggers = {};
  if (!state.roleplayAiSeen || typeof state.roleplayAiSeen !== "object" || Array.isArray(state.roleplayAiSeen)) state.roleplayAiSeen = {};
  if (!state.milestoneSeen || typeof state.milestoneSeen !== "object" || Array.isArray(state.milestoneSeen)) state.milestoneSeen = {};
  return state;
}

function fullSpecRelScore(w, a, b) {
  return Number((getRel(w, a, b) || {}).score) || 0;
}

function fullSpecLogRelationship(w, a, b, before, channel, reason) {
  const after = fullSpecRelScore(w, a, b);
  const delta = after - (Number(before) || 0);
  if (!delta) return 0;
  console.info(
    "[relationship-change]",
    "from=" + String(a || ""),
    "toward=" + String(b || ""),
    "delta=" + String(delta),
    "channel=" + String(channel || "unknown"),
    "reason=" + String(reason || "interaction").replace(/\s+/g, " ").slice(0, 180),
    "score=" + String(Number(before) || 0) + "->" + String(after)
  );
  return delta;
}

function fullSpecEventChannel(event) {
  const type = String(event && event.type || "").toLowerCase();
  const source = String(event && event.source || "").toLowerCase();
  if (type === "dm-message" || source === "direct-chat") return "dm";
  if (type.startsWith("roleplay") || source === "roleplay") return "roleplay";
  return "public";
}

function fullSpecRuleTone(channel, text, event = null) {
  const value = String(text || "");
  let tone = typeof channelTone === "function" ? channelTone(value) : 0;

  if (!tone && channel === "roleplay") {
    if (/megfogja a kez|holds? (?:his|her|their|your) hand|megölel|hugs?|megcsókol|kisses?|megvéd|protects?|segít|helps?|támogat|supports?|bocsánat|apolog|megment|saves?/i.test(value)) tone = 1;
    if (/megüti|slaps?|punch|kicks?|megaláz|humiliat|elárul|betray|fenyeget|threat|ellök|shoves?|visszautasít|reject/i.test(value)) tone = -1;
  }

  if (!tone && event) {
    const drama = Number(event.drama) || 0;
    const romance = Number(event.romance) || 0;
    const embarrassment = Number(event.embarrassment) || 0;
    if (romance >= 20 && drama < 35) tone = 1;
    else if (drama >= 45 || embarrassment >= 45) tone = -1;
  }

  return tone;
}

function fullSpecRuleDelta(channel, text, aiDelta = 0, event = null) {
  const tone = fullSpecRuleTone(channel, text, event);
  if (tone) return channelDelta(channel, text, tone > 0 ? Math.max(1, aiDelta || 1) : Math.min(-1, aiDelta || -1));
  return channelDelta(channel, text, aiDelta);
}

function fullSpecDmFallbackKey(botId, humanId) {
  return String(botId || "") + ">" + String(humanId || "");
}

function fullSpecApplyRawDelta(w, change, channel, reason) {
  if (!w || !change) return 0;
  const a = findChar(w, change.a);
  const b = findChar(w, change.b);
  if (!a || !b || a === b) return 0;
  const before = fullSpecRelScore(w, a, b);
  legacyChannelApplyChanges(w, [{
    ...change,
    a,
    b,
    delta: Number(change.delta) || 0,
    why: String(change.why || reason || "interaction"),
  }]);
  return fullSpecLogRelationship(w, a, b, before, channel, change.why || reason || "interaction");
}

function fullSpecRememberDmFallback(w, botId, humanId, event, appliedDelta) {
  const state = fullSpecState(w);
  if (!state || !botId || !humanId) return;
  state.dmFallbacks[fullSpecDmFallbackKey(botId, humanId)] = {
    botId: String(botId),
    humanId: String(humanId),
    eventId: String(event && (event.id || event.refId) || ""),
    text: String(event && event.text || ""),
    at: Number(event && event.ts) || now(),
    appliedDelta: Number(appliedDelta) || 0,
    resolved: false,
  };
}

function fullSpecRecentDmFallback(w, botId, humanId) {
  const state = fullSpecState(w);
  const row = state && state.dmFallbacks[fullSpecDmFallbackKey(botId, humanId)];
  if (!row || row.resolved) return null;
  if (now() - (Number(row.at) || 0) > 5 * 60 * 1000) return null;
  return row;
}

function fullSpecOfficialStatus(w, a, b) {
  try {
    return String(officialRelationshipStatusForPair(w, a, b, CURRENT_LANG) || "");
  } catch {
    return "";
  }
}

function fullSpecRecordMilestone(w, a, b, beforeStatus, afterStatus, channel, reason) {
  if (!w || !a || !b || !afterStatus || beforeStatus === afterStatus) return;
  const state = fullSpecState(w);
  const pair = [String(a), String(b)].sort().join("<>");
  const key = pair + "|" + afterStatus;
  const recent = Number(state.milestoneSeen[key]) || 0;
  if (recent && now() - recent < 10 * 60 * 1000) return;
  state.milestoneSeen[key] = now();

  console.info(
    "[relationship-milestone]",
    "pair=" + pair,
    "channel=" + String(channel || ""),
    "status=" + String(beforeStatus || "") + "->" + String(afterStatus || "")
  );

  try {
    recordSocialEvent(w, {
      type: "relationship-milestone",
      refId: "relationship-milestone:" + pair + ":" + now(),
      ts: now(),
      actorId: a,
      targetIds: [b],
      visibility: "limited",
      factLevel: "observed",
      importance: 36,
      drama: 8,
      romance: /rand|dating|pár|engaged|jegyes|married|házas/i.test(afterStatus) ? 28 : 0,
      embarrassment: 0,
      source: String(channel || "relationship"),
      text: "Official relationship status changed: " + String(beforeStatus || "—") + " → " + afterStatus,
      tags: ["relationship", "milestone", "official-status"],
      meta: {
        pairIds: [a, b],
        officialStatus: afterStatus,
        reason: String(reason || "").slice(0, 220),
      },
    });
  } catch (error) {
    console.warn("[relationship-milestone] social event failed; continuing", error);
  }
}

function applyChannelRelationshipChanges(w, changes, channel, ctx = {}) {
  const rows = Array.isArray(changes) ? changes.filter(Boolean) : [];
  if (!rows.length) return;

  const statusBefore = rows.map((row) => {
    const a = findChar(w, row.a);
    const b = findChar(w, row.b);
    return { a, b, status: a && b ? fullSpecOfficialStatus(w, a, b) : "" };
  });

  if (channel === "dm") {
    const normal = [];

    rows.forEach((row) => {
      const a = findChar(w, row.a);
      const b = findChar(w, row.b);
      const fallback = a && b ? fullSpecRecentDmFallback(w, a, b) : null;
      if (!fallback) {
        normal.push(row);
        return;
      }

      const text = [ctx.text, row.why, row.mood].filter(Boolean).join(" ");
      const desired = fullSpecRuleDelta("dm", text, Number(row.delta) || 0);
      const correction = desired - (Number(fallback.appliedDelta) || 0);
      const before = fullSpecRelScore(w, a, b);

      legacyChannelApplyChanges(w, [{
        ...row,
        a,
        b,
        delta: correction,
        why: String(row.why || ctx.reason || "direct-dm"),
      }]);

      fullSpecLogRelationship(w, a, b, before, "dm", row.why || ctx.reason || "direct-dm-ai-refinement");
      fallback.resolved = true;
      fallback.aiDesiredDelta = desired;
      fallback.resolvedAt = now();
    });

    if (normal.length) {
      legacyFullSpecApplyChannelRelationshipChanges(w, normal, channel, ctx);
    }
  } else {
    legacyFullSpecApplyChannelRelationshipChanges(w, rows, channel, ctx);
  }

  rows.forEach((row, index) => {
    const before = statusBefore[index];
    if (!before || !before.a || !before.b) return;
    const afterStatus = fullSpecOfficialStatus(w, before.a, before.b);
    fullSpecRecordMilestone(
      w,
      before.a,
      before.b,
      before.status,
      afterStatus,
      channel,
      row.why || ctx.reason || "relationship change"
    );
  });
}

function applySceneChangesWithStatus(...args) {
  const [world, scene, changes] = args;
  const state = world ? fullSpecState(world) : null;
  if (state && scene && scene.id && Array.isArray(changes) && changes.length) {
    state.roleplayAiSeen[String(scene.id)] = now();
  }
  return legacyFullSpecApplySceneChangesWithStatus(...args);
}

function recordExplicitMutualRelationshipMilestones(...args) {
  const [world, changes, source] = args;
  const before = world && Array.isArray(changes)
    ? changes.map((row) => {
        const a = row && findChar(world, row.a);
        const b = row && findChar(world, row.b);
        return { a, b, status: a && b ? fullSpecOfficialStatus(world, a, b) : "" };
      })
    : [];

  const result = legacyFullSpecRecordExplicitMutualRelationshipMilestones(...args);

  before.forEach((row) => {
    if (!row.a || !row.b) return;
    const after = fullSpecOfficialStatus(world, row.a, row.b);
    fullSpecRecordMilestone(world, row.a, row.b, row.status, after, "roleplay", source || "explicit roleplay milestone");
  });
  return result;
}

function fullSpecSnapshotScores(w) {
  const out = {};
  Object.entries((w && w.rels) || {}).forEach(([key, rel]) => {
    out[key] = Number(rel && rel.score) || 0;
  });
  return out;
}

function simsSocialApplyEventConsequences(w, event) {
  const before = fullSpecSnapshotScores(w);
  const result = legacyFullSpecSimsSocialApplyEventConsequences(w, event);
  const channel = fullSpecEventChannel(event);
  const after = fullSpecSnapshotScores(w);

  Object.keys({ ...before, ...after }).forEach((key) => {
    const a = Number(before[key]) || 0;
    const b = Number(after[key]) || 0;
    if (a === b) return;
    const parts = String(key).split(">");
    console.info(
      "[relationship-change]",
      "from=" + String(parts[0] || ""),
      "toward=" + String(parts[1] || ""),
      "delta=" + String(b - a),
      "channel=" + channel,
      "reason=" + String(event && event.type || "event") + ":" + String(event && event.text || "").replace(/\s+/g, " ").slice(0, 150),
      "score=" + a + "->" + b
    );
  });
  return result;
}

function fullSpecDmInitiativeText(w, botId, humanId) {
  const bot = charById(w, botId);
  const rel = getRel(w, botId, humanId) || EMPTY_REL;
  return [
    bot && bot.personality,
    bot && bot.traits,
    bot && bot.backstory,
    bot && bot.secrets,
    rel.bond,
    rel.mood,
    rel.hidden,
  ].filter(Boolean).join(" ").toLowerCase();
}

function fullSpecDmInitiativeScore(w, botId, humanId, event) {
  const bot = charById(w, botId);
  if (!bot || isHuman(w, botId) || !isHuman(w, humanId)) return -999;
  const rel = getRel(w, botId, humanId) || EMPTY_REL;
  const text = fullSpecDmInitiativeText(w, botId, humanId);
  let score = Math.min(35, Math.abs(Number(rel.score) || 0) * 0.35);
  score += Math.min(30, Number(event && event.importance) || 0) * 0.35;
  score += Math.min(28, (Number(event && event.drama) || 0) * 0.35);
  score += Math.min(24, (Number(event && event.romance) || 0) * 0.35);
  if (/obsess|megszáll|possess|birtokl|jealous|féltéken|resent|sértőd|cling|ragaszkod|proud|büszke|sensitive|érzékeny|confront|konfront|impuls|direct|egyenes/.test(text)) score += 24;
  if (/detached|közömbös|unbothered|aloof|távolságtartó/.test(text)) score -= 22;
  return score;
}

function fullSpecPendingKey(event, botId, kind = "") {
  return [
    String(kind || event && event.type || "event"),
    String(botId || ""),
    String(event && (event.id || event.refId) || ""),
  ].join(":");
}

function fullSpecQueuePendingDmTrigger(w, botId, event, trigger, options = {}) {
  if (!w || !botId || !event || isHuman(w, botId)) return false;
  const state = fullSpecState(w);
  const eventId = String(event.id || event.refId || "");
  const key = fullSpecPendingKey(event, botId, trigger);

  const existingQueue = ((w.sim && w.sim.queue) || []).some((action) =>
    action &&
    action.type === "dm" &&
    String(action.payload && action.payload.botId || "") === String(botId) &&
    eventId &&
    String(action.payload && action.payload.eventId || "") === eventId
  );
  if (existingQueue || state.pendingDmTriggers[key]) return false;

  state.pendingDmTriggers[key] = {
    key,
    botId: String(botId),
    humanId: String(options.humanId || w.meId || ""),
    trigger: String(trigger || event.type || "event"),
    eventId,
    eventType: String(event.type || ""),
    causeText: String(event.text || "").slice(0, 500),
    at: now(),
    nextAt: now() + Math.max(0, Number(options.delayMs) || 0),
    attempts: 0,
    requireNoFollowBack: Boolean(options.requireNoFollowBack),
  };
  return true;
}

function fullSpecScheduleEventDms(w, event) {
  if (!w || !event || typeof event !== "object") return;
  const type = String(event.type || "").toLowerCase();
  if (type === "dm-message" || type === "follow" || type === "unfollow") return;

  const actorId = String(event.actorId || "");
  const targets = Array.isArray(event.targetIds) ? event.targetIds.map(String) : [];
  const humanIds = [...new Set([
    ...(actorId && isHuman(w, actorId) ? [actorId] : []),
    ...targets.filter((id) => isHuman(w, id)),
  ])];
  if (!humanIds.length) return;

  const relevant =
    ["comment", "reply", "gossip-story", "roleplay-summary", "roleplay-event", "relationship-milestone"].includes(type) ||
    /note|jealous|féltéken|gossip|pletyka|scene|roleplay|comment|reply/i.test(
      [type, event.source, ...(event.tags || [])].join(" ")
    );
  if (!relevant) return;

  const candidates = new Map();
  humanIds.forEach((humanId) => {
    if (actorId && !isHuman(w, actorId) && actorId !== humanId) candidates.set(actorId, humanId);
    targets.forEach((id) => {
      if (id && !isHuman(w, id) && id !== humanId) candidates.set(id, humanId);
    });

    if (type === "gossip-story" || type.startsWith("roleplay")) {
      (w.chars || []).forEach((c) => {
        if (!c || isHuman(w, c.id)) return;
        const rel = getRel(w, c.id, humanId) || EMPTY_REL;
        if (Math.abs(Number(rel.score) || 0) >= 55) candidates.set(c.id, humanId);
      });
    }
  });

  [...candidates.entries()]
    .map(([botId, humanId]) => ({
      botId,
      humanId,
      score: fullSpecDmInitiativeScore(w, botId, humanId, event),
    }))
    .filter((row) => row.score >= 38)
    .sort((a, b) => b.score - a.score)
    .slice(0, FULL_SPEC_COMPLETION_SETTINGS.EVENT_DM_MAX_CANDIDATES)
    .forEach((row) => {
      fullSpecQueuePendingDmTrigger(
        w,
        row.botId,
        event,
        type + "-reaction",
        { humanId: row.humanId }
      );
    });
}

function fullSpecScheduleFollowBackDm(w, event) {
  if (!w || !event || String(event.type || "").toLowerCase() !== "follow") return;
  const botId = String(event.actorId || "");
  const humanId = String((event.targetIds || []).find((id) => isHuman(w, id)) || "");
  if (!botId || !humanId || isHuman(w, botId)) return;
  if (!isFollowing(w, botId, humanId) || isFollowing(w, humanId, botId)) return;

  const initiative = fullSpecDmInitiativeText(w, botId, humanId);
  if (!/obsess|megszáll|possess|birtokl|jealous|féltéken|resent|sértőd|cling|ragaszkod|proud|büszke|sensitive|érzékeny|confront|konfront/.test(initiative)) return;

  fullSpecQueuePendingDmTrigger(
    w,
    botId,
    event,
    "follow-not-returned",
    {
      humanId,
      delayMs: FULL_SPEC_COMPLETION_SETTINGS.FOLLOW_BACK_GRACE_MS,
      requireNoFollowBack: true,
    }
  );
}

function fullSpecApplyDmEventFallback(w, event, beforeScores) {
  if (!w || !event || String(event.type || "").toLowerCase() !== "dm-message") return;
  const actorId = String(event.actorId || "");
  if (!actorId || !isHuman(w, actorId)) return;
  const botId = String((event.targetIds || []).find((id) => id && !isHuman(w, id)) || "");
  if (!botId) return;

  const scoreKey = botId + ">" + actorId;
  const before = Object.prototype.hasOwnProperty.call(beforeScores, scoreKey)
    ? Number(beforeScores[scoreKey]) || 0
    : 0;
  const afterLegacy = fullSpecRelScore(w, botId, actorId);
  const legacyDelta = afterLegacy - before;
  const desired = fullSpecRuleDelta("dm", event.text, legacyDelta, event);

  if (desired !== legacyDelta) {
    fullSpecApplyRawDelta(
      w,
      { a: botId, b: actorId, delta: desired - legacyDelta, why: "deterministic direct-DM fallback" },
      "dm",
      "direct-dm-rule-fallback"
    );
  }

  fullSpecRememberDmFallback(w, botId, actorId, event, desired);
}

function fullSpecApplyRoleplayFallback(w, event, beforeScores) {
  if (!w || !event || String(event.type || "").toLowerCase() !== "roleplay-summary") return;
  const sceneId = String(event.meta && event.meta.sceneId || "");
  const state = fullSpecState(w);
  if (sceneId && Number(state.roleplayAiSeen[sceneId])) return;

  const humanId = String((event.targetIds || []).find((id) => isHuman(w, id)) || w.meId || "");
  if (!humanId) return;
  const bots = [...new Set((event.targetIds || []).filter((id) => id && !isHuman(w, id) && charById(w, id)))];
  if (!bots.length) return;

  bots.forEach((botId) => {
    const scoreKey = botId + ">" + humanId;
    const before = Object.prototype.hasOwnProperty.call(beforeScores, scoreKey)
      ? Number(beforeScores[scoreKey]) || 0
      : fullSpecRelScore(w, botId, humanId);
    const existingAfter = fullSpecRelScore(w, botId, humanId);
    if (existingAfter !== before) return;

    const delta = fullSpecRuleDelta("roleplay", event.text, 0, event);
    if (!delta) return;

    fullSpecApplyRawDelta(
      w,
      { a: botId, b: humanId, delta, why: "scene-end deterministic fallback" },
      "roleplay",
      "scene-end deterministic fallback"
    );
  });
}

function fullSpecCleanupFollowBackPending(w, event) {
  if (!w || !event) return;
  const type = String(event.type || "").toLowerCase();
  if (type !== "follow" && type !== "unfollow") return;
  const actorId = String(event.actorId || "");
  const targets = Array.isArray(event.targetIds) ? event.targetIds.map(String) : [];
  const state = fullSpecState(w);

  Object.entries(state.pendingDmTriggers || {}).forEach(([key, row]) => {
    if (!row || !row.requireNoFollowBack) return;
    const botId = String(row.botId || "");
    const humanId = String(row.humanId || "");
    const followBackHappened =
      type === "follow" &&
      actorId === humanId &&
      targets.includes(botId);
    const botUnfollowed =
      type === "unfollow" &&
      actorId === botId &&
      targets.includes(humanId);

    if (followBackHappened || botUnfollowed) {
      delete state.pendingDmTriggers[key];
      console.info(
        "[event-dm]",
        "cancelled=follow-back-condition-cleared",
        "bot=" + botId,
        "human=" + humanId
      );
    }
  });
}

function recordSocialEvent(w, event = {}) {
  const beforeScores = fullSpecSnapshotScores(w);
  let result = null;
  try {
    result = legacyFullSpecRecordSocialEvent(w, event);
  } catch (error) {
    console.warn("[social-event] ledger/consequence step failed; completion hooks continue", error);
  }

  try {
    fullSpecApplyDmEventFallback(w, event, beforeScores);
  } catch (error) {
    console.warn("[relationship-fallback] DM fallback failed; continuing", error);
  }

  try {
    fullSpecApplyRoleplayFallback(w, event, beforeScores);
  } catch (error) {
    console.warn("[relationship-fallback] roleplay fallback failed; continuing", error);
  }

  try {
    fullSpecCleanupFollowBackPending(w, event);
    fullSpecScheduleFollowBackDm(w, event);
    fullSpecScheduleEventDms(w, event);
  } catch (error) {
    console.warn("[event-dm] scheduling failed; continuing", error);
  }

  return result;
}

function fullSpecSafeCommentRowApply(n, postId, row, label) {
  if (!row || typeof row !== "object") return 0;
  try {
    return Number(legacyFullSpecApplyComments(n, postId, { comments: [row] }, label) || 0);
  } catch (error) {
    console.warn(
      "[comment-pipeline] comment row failed; skipped only this row",
      "post=" + String(postId || ""),
      "character=" + String(row.id !== undefined ? row.id : (row.authorId !== undefined ? row.authorId : row.name || "")),
      error
    );
    return 0;
  }
}

function applyComments(n, postId, out, label) {
  const payload = out && typeof out === "object" ? out : {};
  let applied = 0;

  safeAiComments(payload).forEach((row) => {
    applied += fullSpecSafeCommentRowApply(n, postId, row, label);
  });

  const remainder = { ...payload, comments: [] };
  try {
    applied += Number(legacyFullSpecApplyComments(n, postId, remainder, label) || 0);
  } catch (error) {
    console.warn("[comment-pipeline] non-comment apply step failed; comments already preserved", error);
  }
  return applied;
}

function noteComment(...args) {
  try {
    return legacyFullSpecNoteComment(...args);
  } catch (error) {
    console.warn("[comment-pipeline] notification failed; comment/relation pipeline continues", error);
    return null;
  }
}

function fullSpecHumanRootComment(w, post, commentId) {
  if (!post || !commentId) return null;
  const rows = safePostComments(post);
  const byId = new Map(rows.filter(Boolean).map((row) => [row.id, row]));
  let current = byId.get(commentId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (isHuman(w, current.authorId)) return current;
    current = current.parent ? byId.get(current.parent) : null;
  }
  return null;
}

function fullSpecIsDescendantOf(post, comment, ancestorId) {
  if (!post || !comment || !ancestorId) return false;
  const rows = safePostComments(post);
  const byId = new Map(rows.filter(Boolean).map((row) => [row.id, row]));
  let current = comment;
  const seen = new Set();
  while (current && current.parent && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parent === ancestorId) return true;
    current = byId.get(current.parent);
  }
  return false;
}

function fullSpecPlayerThreadReplyCapReached(w, postId, commentIds) {
  const post = (w && w.posts || []).find((row) => row && row.id === postId);
  if (!post) return false;
  const ids = Array.isArray(commentIds) ? commentIds : [commentIds];

  return ids.some((commentId) => {
    const root = fullSpecHumanRootComment(w, post, commentId);
    if (!root) return false;
    const aiReplies = safePostComments(post).filter((row) =>
      row &&
      !isHuman(w, row.authorId) &&
      fullSpecIsDescendantOf(post, row, root.id)
    ).length;
    return aiReplies >= AI_ACTIVITY_OPTIMIZATION.PLAYER_COMMENT_MAX_AI_REPLIES;
  });
}

function enqueueNaturalThreadReply(...args) {
  if (fullSpecPlayerThreadReplyCapReached(args[0], args[1], args[2])) {
    console.info("[comment-thread] stopped=max-player-replies", "post=" + String(args[1] || ""));
    return false;
  }
  return legacyFullSpecEnqueueNaturalThreadReply(...args);
}

function enqueueVisualCrushThreadFriction(...args) {
  if (typeof legacyFullSpecEnqueueVisualCrushThreadFriction !== "function") return false;
  if (fullSpecPlayerThreadReplyCapReached(args[0], args[1], args[2])) return false;
  return legacyFullSpecEnqueueVisualCrushThreadFriction(...args);
}

function ensureEventDrivenGossipPost(w, trigger, payload) {
  const info = eventDrivenGossipSource(w, trigger, payload);
  if (!info || !info.source || !gossipPrivacyEligible(info.source)) {
    console.info(
      "[gossip-event]",
      "skipped=no-public-or-leaked-source",
      "trigger=" + String(trigger || "")
    );
    return null;
  }
  return legacyFullSpecEnsureEventDrivenGossipPost(w, trigger, payload);
}

function budgetAiRequest(system, prompt) {
  const text = String(prompt || "");
  const marker = "[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]";
  const at = text.indexOf(marker);

  if (at < 0) {
    return legacyFullSpecBudgetAiRequest(system, prompt);
  }

  const systemText = String(system || "");
  const compactSystem = preserveEdges(systemText, AI_MAX_SYSTEM_CHARS, "system");
  const protectedTail = text.slice(at);
  const prefix = text.slice(0, at);
  const promptCap = Math.max(28000, Number(AI_MAX_PROMPT_CHARS) || 82000);

  let compactPrompt = "";
  if (protectedTail.length >= promptCap) {
    compactPrompt = protectedTail;
    console.warn(
      "[dm-prompt-tail]",
      "protected tail kept above global cap",
      "tailChars=" + protectedTail.length,
      "cap=" + promptCap
    );
  } else {
    const omission = "\n\n[OLDER DM BACKGROUND OMITTED BEFORE PROVIDER CALL]\n\n";
    const prefixBudget = Math.max(0, promptCap - protectedTail.length - omission.length);
    const compactPrefix = prefix.length <= prefixBudget
      ? prefix
      : prefix.slice(Math.max(0, prefix.length - prefixBudget));
    compactPrompt = (prefix.length > prefixBudget ? omission : "") + compactPrefix + protectedTail;
  }

  return {
    system: compactSystem,
    prompt: compactPrompt,
    wasCompacted:
      compactSystem.length !== systemText.length ||
      compactPrompt.length !== text.length,
  };
}

function fullSpecPendingStillValid(w, row) {
  if (!w || !row || !row.botId || !charById(w, row.botId) || isHuman(w, row.botId)) return false;
  const humanId = String(row.humanId || w.meId || "");
  if (!humanId || !isHuman(w, humanId)) return false;
  if (row.requireNoFollowBack) {
    if (!isFollowing(w, row.botId, humanId)) return false;
    if (isFollowing(w, humanId, row.botId)) return false;
  }
  return true;
}

function fullSpecNextAutonomousDmAction(view) {
  if (!view || eventDrivenAutonomousDmPauseReason(view)) return null;
  const sim = ensureSimState(view);
  const state = fullSpecState(view);
  const nowTs = now();

  const deferred = Object.values(sim.deferredAutonomousDms || {})
    .filter((row) => row && row.botId && (!row.nextAt || Number(row.nextAt) <= nowTs))
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));

  for (const row of deferred) {
    if (!charById(view, row.botId) || isHuman(view, row.botId)) {
      delete sim.deferredAutonomousDms[row.botId];
      continue;
    }
    return mkAction(
      "dm",
      "deferred-dm:" + String(row.botId) + ":" + String(row.eventId || row.at || nowTs),
      {
        botId: row.botId,
        trigger: row.trigger || "deferred-event",
        eventId: row.eventId || "",
        fullSpecDeferredKey: String(row.botId),
      },
      "event"
    );
  }

  const pending = Object.values(state.pendingDmTriggers || {})
    .filter((row) => row && Number(row.nextAt || 0) <= nowTs)
    .sort((a, b) => (Number(a.nextAt) || 0) - (Number(b.nextAt) || 0));

  for (const row of pending) {
    if (!fullSpecPendingStillValid(view, row)) {
      delete state.pendingDmTriggers[row.key];
      continue;
    }
    return mkAction(
      "dm",
      "event-dm:" + row.key,
      {
        botId: row.botId,
        trigger: row.trigger || "social-event",
        eventId: row.eventId || "",
        fullSpecPendingKey: row.key,
      },
      "event"
    );
  }

  return null;
}

function planAutoAction(view) {
  const deferredOrEventDm = fullSpecNextAutonomousDmAction(view);
  if (deferredOrEventDm) return deferredOrEventDm;
  return legacyFullSpecPlanAutoAction(view);
}

function fullSpecFinishDmTrigger(w, action, result, error = null) {
  if (!w || !action || action.type !== "dm") return;
  const sim = ensureSimState(w);
  const state = fullSpecState(w);
  const deferredKey = String(action.payload && action.payload.fullSpecDeferredKey || "");
  const pendingKey = String(action.payload && action.payload.fullSpecPendingKey || "");

  if (result === "dm-deferred") {
    if (pendingKey) delete state.pendingDmTriggers[pendingKey];
    return;
  }

  if (result) {
    if (deferredKey && sim.deferredAutonomousDms) delete sim.deferredAutonomousDms[deferredKey];
    if (pendingKey) delete state.pendingDmTriggers[pendingKey];
    return;
  }

  const retry = (row, drop) => {
    if (!row) return;
    row.attempts = (Number(row.attempts) || 0) + 1;
    row.lastError = String(error && error.message || error || "generation returned no DM").slice(0, 220);
    row.nextAt = now() + FULL_SPEC_COMPLETION_SETTINGS.DEFERRED_DM_RETRY_MS;
    if (row.attempts >= FULL_SPEC_COMPLETION_SETTINGS.DEFERRED_DM_MAX_ATTEMPTS) drop();
  };

  if (deferredKey && sim.deferredAutonomousDms && sim.deferredAutonomousDms[deferredKey]) {
    retry(sim.deferredAutonomousDms[deferredKey], () => delete sim.deferredAutonomousDms[deferredKey]);
  }
  if (pendingKey && state.pendingDmTriggers[pendingKey]) {
    retry(state.pendingDmTriggers[pendingKey], () => delete state.pendingDmTriggers[pendingKey]);
  }
}

async function runSimulationAction(view, update, action, addImage) {
  let result = null;
  try {
    result = await legacyFullSpecRunSimulationAction(view, update, action, addImage);
  } catch (error) {
    if (action && action.type === "dm" && action.payload && (action.payload.fullSpecDeferredKey || action.payload.fullSpecPendingKey)) {
      update((n) => fullSpecFinishDmTrigger(n, action, null, error));
    }
    throw error;
  }

  if (action && action.type === "dm" && action.payload && (action.payload.fullSpecDeferredKey || action.payload.fullSpecPendingKey)) {
    update((n) => fullSpecFinishDmTrigger(n, action, result, null));
  }
  return result;
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied full-spec completion: deterministic channel fallbacks, strict DM context, atomic feed, fault-isolated comments, bounded threads, privacy-safe gossip, milestone reactions, and deferred/event DMs.");
} else {
  console.log("Full spec completion v1 already applied.");
}
