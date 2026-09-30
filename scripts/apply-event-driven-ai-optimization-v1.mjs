import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG EVENT-DRIVEN AI OPTIMIZATION v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(regex, replacement, label, required = true) {
  const count = countMatches(next, regex);
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Event-driven AI optimization patch aborted: ${label} expected 1 match, found ${count}.`);
}

function replaceInBlock(startAnchor, endAnchor, transform, label) {
  const start = next.indexOf(startAnchor);
  const end = start >= 0 ? next.indexOf(endAnchor, start + startAnchor.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Event-driven AI optimization patch aborted: ${label} block boundary not found.`);
  }
  const block = next.slice(start, end);
  const patched = transform(block);
  if (patched === block) {
    throw new Error(`Event-driven AI optimization patch aborted: ${label} block did not change.`);
  }
  next = next.slice(0, start) + patched + next.slice(end);
}

if (!next.includes(`/* ${MARKER} */`)) {
  replaceOne(/function\s+feedNeedsFreshPost\s*\(/, "function legacyEventDrivenFeedNeedsFreshPost(", "feedNeedsFreshPost");
  replaceOne(/function\s+autonomousDmOverdueByMs\s*\(/, "function legacyEventDrivenAutonomousDmOverdueByMs(", "autonomousDmOverdueByMs");
  replaceOne(/function\s+worldContext\s*\(/, "function legacyEventDrivenWorldContext(", "worldContext");
  replaceOne(/function\s+freshFeedPostCommentCandidate\s*\(/, "function legacyEventDrivenFreshFeedPostCommentCandidate(", "freshFeedPostCommentCandidate");
  replaceOne(/function\s+enqueueNaturalThreadReply\s*\(/, "function legacyEventDrivenEnqueueNaturalThreadReply(", "enqueueNaturalThreadReply");
  replaceOne(/function\s+enqueueVisualCrushThreadFriction\s*\(/, "function legacyEventDrivenEnqueueVisualCrushThreadFriction(", "enqueueVisualCrushThreadFriction", false);

  const helper = String.raw`
/* ${MARKER} */
const AI_ACTIVITY_OPTIMIZATION = Object.freeze({
  EVENT_DRIVEN_FEED_ONLY: true,
  EVENT_DRIVEN_UNSOLICITED_DM_ONLY: true,
  FEED_MIN_POSTS: 6,
  FEED_MAX_POSTS: 7,
  PLAYER_COMMENT_MAX_AI_REPLIES: 4,
  AI_THREAD_MAX_ROUNDS: 3,
  RECENT_DM_WINDOW_MS: 10 * 60 * 1000,
  RECENT_DM_THREAD_LIMIT: 2,
  UNSOLICITED_DM_BURST_MAX: 2,
  UNSOLICITED_DM_BURST_WINDOW_MS: 90 * 1000,
});

let EVENT_DRIVEN_FEED_BATCH_CONTEXT = null;
let EVENT_DRIVEN_FEED_APPLYING = false;

function eventDrivenRecentPlayerDmThreads(w) {
  const cutoff = now() - AI_ACTIVITY_OPTIMIZATION.RECENT_DM_WINDOW_MS;
  return [...new Set(Object.entries((w && w.chats) || {})
    .filter(([, rows]) => Array.isArray(rows) && rows.some((m) =>
      m && m.from === "me" && Number(m.ts || 0) >= cutoff
    ))
    .map(([key]) => key))];
}

function eventDrivenAutonomousDmPauseReason(w) {
  if (!w) return "no-world";
  const inScene = Boolean(
    String(w.activeSceneId || "") ||
    (typeof playerInsideActiveEvent === "function" && playerInsideActiveEvent(w))
  );
  if (inScene) return "scene-active";

  const activeDmThreads = eventDrivenRecentPlayerDmThreads(w);
  if (activeDmThreads.length >= AI_ACTIVITY_OPTIMIZATION.RECENT_DM_THREAD_LIMIT) {
    return "parallel-dms";
  }

  const cutoff = now() - AI_ACTIVITY_OPTIMIZATION.UNSOLICITED_DM_BURST_WINDOW_MS;
  const recentIncoming = ((w && w.socialEvents) || []).filter((event) =>
    event &&
    event.type === "dm-message" &&
    Number(event.ts || 0) >= cutoff &&
    event.actorId &&
    !isHuman(w, event.actorId) &&
    Array.isArray(event.targetIds) &&
    event.targetIds.includes(w.meId)
  ).length;
  if (recentIncoming >= AI_ACTIVITY_OPTIMIZATION.UNSOLICITED_DM_BURST_MAX) {
    return "unsolicited-burst-limit";
  }
  return "";
}

function eventDrivenRememberDeferredDm(w, action, reason) {
  if (!w || !action) return;
  const botId = String(action.payload && action.payload.botId || "");
  if (!botId) return;

  const sim = ensureSimState(w);
  if (!sim.deferredAutonomousDms || typeof sim.deferredAutonomousDms !== "object" || Array.isArray(sim.deferredAutonomousDms)) {
    sim.deferredAutonomousDms = {};
  }

  const latestCause = ((w.socialEvents || []).slice().reverse().find((event) => {
    if (!event) return false;
    const ids = [String(event.actorId || ""), ...((event.targetIds || []).map(String))];
    return ids.includes(botId) && ids.includes(String(w.meId || ""));
  })) || null;

  const previous = sim.deferredAutonomousDms[botId];
  sim.deferredAutonomousDms[botId] = {
    ...(previous && typeof previous === "object" ? previous : {}),
    botId,
    at: now(),
    reason: String(reason || "busy"),
    trigger: String(action.payload && action.payload.trigger || "event"),
    eventId: String(action.payload && action.payload.eventId || ""),
    causeText: latestCause ? String(latestCause.text || "").slice(0, 500) : String(previous && previous.causeText || ""),
  };

  try {
    if (typeof rememberKnowledge === "function" && charById(w, botId)) {
      const cause = latestCause && latestCause.text
        ? String(latestCause.text).replace(/\s+/g, " ").trim().slice(0, 420)
        : String(action.payload && action.payload.trigger || "egy korábbi social esemény");
      rememberKnowledge(w, botId, {
        kind: "event",
        source: "deferred_dm",
        confidence: 1,
        text: "Ezt később még természetesen szóba hozhatom " + nameOfIn(w, w.meId) + " karakterrel: " + cause,
      });
    }
  } catch (memoryErr) {
    console.warn("[dm-deferred] memory note failed", memoryErr);
  }

  console.info(
    "[dm-deferred] skipped-before-generation",
    "bot=" + botId,
    "reason=" + String(reason || "busy"),
    "trigger=" + String(action.payload && action.payload.trigger || "event")
  );
}

function eventDrivenCommentDepth(post, commentId) {
  if (!post || !commentId) return 0;
  const rows = safePostComments(post);
  const byId = new Map(rows.filter(Boolean).map((row) => [row.id, row]));
  let cur = byId.get(commentId);
  let depth = 0;
  const seen = new Set();
  while (cur && cur.parent && !seen.has(cur.id) && depth < 20) {
    seen.add(cur.id);
    depth += 1;
    cur = byId.get(cur.parent);
  }
  return depth;
}

function eventDrivenAiThreadMaxed(w, postId, commentIds) {
  const post = (w && w.posts || []).find((row) => row && row.id === postId);
  if (!post) return false;
  const ids = Array.isArray(commentIds) ? commentIds : [commentIds];
  return ids.some((id) =>
    eventDrivenCommentDepth(post, id) >= AI_ACTIVITY_OPTIMIZATION.AI_THREAD_MAX_ROUNDS
  );
}

function eventDrivenFeedDirective() {
  const ctx = EVENT_DRIVEN_FEED_BATCH_CONTEXT;
  if (!ctx || !ctx.enabled) return "";
  const triggerName = String(ctx.trigger || "event");
  const triggerPostIds = Array.isArray(ctx.triggerPostIds) ? ctx.triggerPostIds.filter(Boolean) : [];
  const excluded = Array.isArray(ctx.excludeAuthorIds) ? ctx.excludeAuthorIds.filter(Boolean) : [];
  const needed = Math.max(
    1,
    Math.min(
      AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS,
      Number(ctx.neededPosts) || AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS
    )
  );

  return "EVENT-DRIVEN FEED BATCH — HARD CONTRACT:\n" +
    "Trigger: " + triggerName + ". This is the ONLY feed refresh for this event.\n" +
    "Return " + needed + " NEW feed posts by " + needed + " DIFFERENT AI characters in the existing top-level posts JSON array. Never use the player or a gossip-media account as one of these character posts.\n" +
    "Every new post MUST already contain 2-5 meaningful comments/replies in that post's existing comments array, from different plausible characters. Do not leave a new post commentless.\n" +
    "Use each author's personality, current relationship state, stored summary, voice/style card, recent public events and current world state. Some posts may react to the trigger or gossip; others may naturally be about their own life. Do not make all posts about the player.\n" +
    "Do not create near-duplicate captions or give multiple characters the same wording.\n" +
    (excluded.length
      ? "Do NOT choose these authors again in this batch retry: " + excluded.join(", ") + ".\n"
      : "") +
    (triggerPostIds.length
      ? "Also return a top-level JSON array named triggerComments. It must contain 2-4 comments for EACH of these already-existing trigger posts: " + triggerPostIds.join(", ") + ". Each row: {\"postId\":\"EXACT_POST_ID\",\"id\":\"CHARACTER_ID_OR_NAME\",\"text\":\"comment\",\"reply_to\":\"optional\"}. These comments must react to that exact post and must not create replacement posts.\n"
      : "") +
    "Use the EXISTING response JSON schema for everything else. This batch must be usable in one provider response.";
}

function eventDrivenFeedRawAuthor(w, post) {
  if (!post) return "";
  try {
    return String(aiVoice(w, post.id !== undefined ? post.id : post.name) || "");
  } catch {
    return "";
  }
}

function eventDrivenUsableBatchPosts(w, out) {
  const rows = out && Array.isArray(out.posts) ? out.posts : [];
  const seen = new Set();
  const selected = [];
  for (const post of rows) {
    const authorId = eventDrivenFeedRawAuthor(w, post);
    if (!authorId || isHuman(w, authorId) || isMediaAccount(w, authorId) || seen.has(authorId)) continue;
    if (!Array.isArray(post && post.comments) || !post.comments.length) continue;
    seen.add(authorId);
    selected.push(post);
    if (selected.length >= AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS) break;
  }
  return selected;
}

function eventDrivenMergeBatchOutputs(w, first, second) {
  const merged = { ...(first || {}) };
  const candidates = [
    ...eventDrivenUsableBatchPosts(w, first),
    ...eventDrivenUsableBatchPosts(w, second),
  ];
  const seen = new Set();
  merged.posts = [];
  candidates.forEach((post) => {
    const authorId = eventDrivenFeedRawAuthor(w, post);
    if (!authorId || seen.has(authorId) || merged.posts.length >= AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS) return;
    seen.add(authorId);
    merged.posts.push(post);
  });
  merged.triggerComments = [
    ...((first && Array.isArray(first.triggerComments)) ? first.triggerComments : []),
    ...((second && Array.isArray(second.triggerComments)) ? second.triggerComments : []),
  ];
  ["changes", "selfUpdates", "relationshipUpdates"].forEach((key) => {
    merged[key] = [
      ...((first && Array.isArray(first[key])) ? first[key] : []),
      ...((second && Array.isArray(second[key])) ? second[key] : []),
    ];
  });
  return merged;
}

function eventDrivenTriggerCommentsCovered(out, postIds) {
  if (!Array.isArray(postIds) || !postIds.length) return true;
  const rows = out && Array.isArray(out.triggerComments) ? out.triggerComments : [];
  return postIds.every((postId) =>
    rows.filter((row) => row && String(row.postId || row.post_id || "") === String(postId)).length >= 2
  );
}

function eventDrivenApplyTriggerComments(w, out, postIds) {
  if (!w || !out || !Array.isArray(out.triggerComments)) return 0;
  let total = 0;
  (postIds || []).forEach((postId) => {
    const comments = out.triggerComments
      .filter((row) => row && String(row.postId || row.post_id || "") === String(postId))
      .slice(0, AI_ACTIVITY_OPTIMIZATION.PLAYER_COMMENT_MAX_AI_REPLIES);
    if (!comments.length) return;
    total += Number(applyComments(w, postId, { comments }, {}) || 0);
  });
  return total;
}

function eventDrivenGossipSource(w, trigger, payload) {
  const events = (w && w.socialEvents || []).slice().reverse();

  if (trigger === "roleplay-ended") {
    const sceneId = String(payload && payload.sceneId || "");
    const scene = (w.scenes || []).find((row) => row && String(row.id) === sceneId);
    const aiIds = scene
      ? (scene.cast || []).filter((id) => id && !isHuman(w, id) && charById(w, id))
      : [];
    if (!scene || aiIds.length < 2) return null;

    const source = events.find((event) =>
      event &&
      event.meta &&
      String(event.meta.sceneId || "") === sceneId &&
      gossipPrivacyEligible(event)
    );

    return {
      key: "scene:" + sceneId,
      source,
      title: String(scene.title || "").trim(),
      targetIds: [w.meId, ...aiIds].filter(Boolean),
      sceneId,
    };
  }

  if (trigger === "popup-choice") {
    const popupId = String(payload && payload.popupEventId || "");
    const source = events.find((event) => {
      if (!event || !gossipPrivacyEligible(event)) return false;
      if (popupId && (
        String(event.refId || "") === popupId ||
        String(event.id || "") === popupId ||
        String(event.meta && event.meta.popupEventId || "") === popupId
      )) return true;
      return event.source === "popup-event" ||
        (Array.isArray(event.tags) && event.tags.includes("popup-event"));
    });

    return {
      key: "popup:" + (popupId || String(source && (source.id || source.refId) || "latest")),
      source,
      title: String(source && source.meta && (source.meta.title || source.meta.eventTitle) || "").trim(),
      targetIds: [...new Set([
        String(source && source.actorId || ""),
        ...((source && source.targetIds) || []).map(String),
      ].filter((id) => id && !isMediaAccount(w, id)))],
      popupEventId: popupId,
    };
  }

  return null;
}

function ensureEventDrivenGossipPost(w, trigger, payload) {
  if (!w) return null;
  const info = eventDrivenGossipSource(w, trigger, payload);
  if (!info) return null;

  ensureGossipMediaState(w);
  if (!w.gossipSettings || (w.gossipSettings.mediaMode !== "local" && w.gossipSettings.mediaMode !== "global")) {
    w.gossipSettings.mediaMode = "local";
    ensureGossipMediaState(w);
  }

  const media = activeGossipMediaAccount(w);
  if (!media) return null;

  const candidateId = "event-driven:" + info.key;
  const existing = (w.posts || []).find((post) =>
    post && post.gossipStory && post.gossipStory.candidateId === candidateId
  );
  if (existing) return existing;

  const sourceText = String(info.source && info.source.text || "").replace(/\s+/g, " ").trim();
  const names = info.targetIds.map((id) => nameOfIn(w, id)).filter(Boolean);
  const title = info.title || (trigger === "popup-choice" ? "what just happened" : "event aftermath");
  const en = worldLanguage(w, w.meId) === "en";
  const headline = "👀 " + title;
  const body = sourceText
    ? headline + "\n\n" + cut(sourceText, 650) + "\n\n" +
      (en
        ? "People saw it. Now everyone has an opinion."
        : "Látták. Most már mindenkinek van róla véleménye.")
    : headline + "\n\n" +
      (names.length ? names.join(", ") + " — " : "") +
      (en
        ? "the public aftermath is already making rounds."
        : "a nyilvános utóélet már körbejár.");

  const stable = typeof simsSocialStableHash === "function"
    ? simsSocialStableHash(candidateId)
    : String(uid());

  const post = {
    id: "gossip_evt_" + stable,
    authorId: media.id,
    ts: now(),
    likes: 0,
    likedBy: [],
    text: body,
    imageId: "",
    image: "",
    comments: [],
    language: worldLanguage(w, w.meId),
    gossipStory: {
      id: "gs_evt_" + stable,
      candidateId,
      mediaMode: w.gossipSettings.mediaMode,
      format: "recap",
      headline,
      factLevel: String(info.source && info.source.factLevel || "observed"),
      eventIds: info.source
        ? [String(info.source.id || info.source.refId || "")].filter(Boolean)
        : [],
      mentionedIds: info.targetIds,
      roleplayBased: trigger === "roleplay-ended",
      witnessCount: trigger === "roleplay-ended"
        ? Math.max(2, info.targetIds.length - 1)
        : 1,
      eventRecap: true,
      eventTitle: title,
      attendeeIds: info.targetIds,
      reactedBy: [],
      reactionRounds: 0,
      rumorEvolvedAt: 0,
      eventDrivenKey: info.key,
    },
  };

  if (!Array.isArray(w.posts)) w.posts = [];
  w.posts.unshift(post);

  recordSocialEvent(w, {
    type: "gossip-story",
    refId: post.gossipStory.id,
    ts: post.ts,
    actorId: media.id,
    targetIds: info.targetIds,
    visibility: "public",
    factLevel: post.gossipStory.factLevel,
    importance: 70,
    drama: 55,
    romance: 0,
    embarrassment: 25,
    source: "gossip-media",
    text: cut(body, 300),
    tags: ["social", "gossip-media", "event-driven", trigger],
    meta: {
      postId: post.id,
      gossipStoryId: post.gossipStory.id,
      mediaId: media.id,
      sceneId: info.sceneId || "",
      popupEventId: info.popupEventId || "",
    },
  });

  return post;
}

function feedNeedsFreshPost() {
  return false;
}

function autonomousDmOverdueByMs() {
  return AI_ACTIVITY_OPTIMIZATION.EVENT_DRIVEN_UNSOLICITED_DM_ONLY
    ? -Infinity
    : legacyEventDrivenAutonomousDmOverdueByMs(...arguments);
}

function freshFeedPostCommentCandidate() {
  return null;
}

function worldContext(...args) {
  const base = String(legacyEventDrivenWorldContext(...args) || "");
  const directive = eventDrivenFeedDirective();
  return directive ? base + "\n\n" + directive : base;
}

function enqueueNaturalThreadReply(...args) {
  const w = args[0];
  const postId = args[1];
  const commentIds = args[2];
  if (eventDrivenAiThreadMaxed(w, postId, commentIds)) return false;
  return legacyEventDrivenEnqueueNaturalThreadReply(...args);
}

function enqueueVisualCrushThreadFriction(...args) {
  if (typeof legacyEventDrivenEnqueueVisualCrushThreadFriction !== "function") return false;
  const w = args[0];
  const postId = args[1];
  const commentIds = args[2];
  if (eventDrivenAiThreadMaxed(w, postId, commentIds)) return false;
  return legacyEventDrivenEnqueueVisualCrushThreadFriction(...args);
}
`;

  replaceOne(
    /function\s+autonomousDmOverdueByMs\s*\(/,
    helper + "\nfunction autonomousDmOverdueByMs(",
    "helper insertion via renamed autonomousDmOverdueByMs",
    false
  );

  if (!next.includes(`/* ${MARKER} */`)) {
    replaceOne(
      /function\s+legacyEventDrivenAutonomousDmOverdueByMs\s*\(/,
      helper + "\nfunction legacyEventDrivenAutonomousDmOverdueByMs(",
      "helper insertion"
    );
  }

  replaceOne(
    /if \(permits\("feed"\) && feedElapsed >= feedTarget\) \{/,
    'if (!AI_ACTIVITY_OPTIMIZATION.EVENT_DRIVEN_FEED_ONLY && permits("feed") && feedElapsed >= feedTarget) {',
    "timed feed candidate"
  );

  replaceOne(
    /if\s*\(\s*permits\("dm"\)\s*&&/,
    'if (!AI_ACTIVITY_OPTIMIZATION.EVENT_DRIVEN_UNSOLICITED_DM_ONLY && permits("dm") &&',
    "timed DM candidate",
    false
  );

  replaceOne(
    /if \(roll >= 0\.18 && roll < 0\.24\) \{\s*const bot =\s*pickInitiator\(view\);/,
    'if (!AI_ACTIVITY_OPTIMIZATION.EVENT_DRIVEN_UNSOLICITED_DM_ONLY && roll >= 0.18 && roll < 0.24) {\n    const bot =\n      pickInitiator(view);',
    "residual timed DM chance",
    false
  );

  replaceOne(
    /if \(\s*!isGuaranteedCoverage &&\s*now\(\) - \(Number\(post\.ts\) \|\| 0\) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS\s*\) \{/,
    'if (now() - (Number(post.ts) || 0) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS) {',
    "old-post automatic comment guard"
  );

  replaceOne(
    /enqueueGuaranteedPostCommentCoverage\(n, fresh\.id, "ai-post-created"\);/,
    'if (!EVENT_DRIVEN_FEED_APPLYING || !made.length) enqueueGuaranteedPostCommentCoverage(n, fresh.id, "ai-post-created");',
    "event batch comment coverage suppression"
  );

  replaceInBlock(
    "const signalSimulation = useCallback((event) => {",
    "}, [requestSimulationAction]);",
    (block) => {
      let out = block;
      out = out.replace(
        /\s*queuedAny = requestSimulationAction\(\s*mkAction\(\s*"comments",\s*`event-post:\$\{event\.postId\}`,\s*\{[\s\S]*?\}\s*,\s*"(?:event|coverage)"\s*\)\s*\) \|\| queuedAny;\s*/m,
        "\n"
      );
      out = out.replace(
        /\s*if \(gossipOn && aiCount >= 2\) \{[\s\S]*?\n\s*\}\s*\n\s*queuedAny = requestSimulationAction\(/m,
        "\n      /* Gossip is created inside the same event-driven feed refresh without another provider call. */\n\n      queuedAny = requestSimulationAction("
      );
      return out;
    },
    "signalSimulation event batching"
  );

  replaceOne(
    /\s*if \(p\) \{\s*try \{\s*simEnqueue\([\s\S]*?Popup comment queue failed:[\s\S]*?\}\s*\}\s*/m,
    "\n            /* event-driven feed batch attaches the comments to this fresh popup post */\n",
    "popup choice comment batching"
  );

  replaceInBlock(
    'if (action.type === "reply") {',
    'if (action.type === "comments") {',
    (block) => block.replace(
      /const out = requestedTargetId[\s\S]*?: rawOut;/m,
      `const targetFilteredOut = requestedTargetId
      ? {
          ...(rawOut || {}),
          comments: safeAiComments(rawOut).filter((row) => {
            const who = row && (row.id !== undefined ? row.id : row.name);
            const resolved = aiVoice(view, who);
            return resolved === requestedTargetId;
          }),
        }
      : rawOut;

    const out = {
      ...(targetFilteredOut || {}),
      comments: safeAiComments(targetFilteredOut).slice(
        0,
        requestedTargetId ? 1 : AI_ACTIVITY_OPTIMIZATION.PLAYER_COMMENT_MAX_AI_REPLIES
      ),
    };`
    ),
    "player comment reply cap"
  );

  replaceOne(
    /\n\s*const out =\s*\n\s*await genDM\(view, bot\);/m,
    `

    const dmPauseReason = eventDrivenAutonomousDmPauseReason(view);
    if (dmPauseReason) {
      update((n) => eventDrivenRememberDeferredDm(n, action, dmPauseReason));
      return "dm-deferred";
    }

    const out =
      await genDM(view, bot);`,
    "autonomous DM pre-generation guard"
  );

  replaceOne(
    /const out =\s*action\.type === "world"[\s\S]*?return visiblePostsCreated\s*\? "world"\s*:\s*null;/m,
    `const eventFeedTrigger = String(action.payload && action.payload.trigger || "");
  const isEventFeedRefresh = ["player-post", "roleplay-ended", "popup-choice"].includes(eventFeedTrigger);

  if (!isEventFeedRefresh && action.type === "world-full") {
    return null;
  }

  let out = null;
  let feedAiCalls = 0;
  let generationView = view;
  let eventGossipPreview = null;
  let eventTriggerPostIds = [];

  if (isEventFeedRefresh) {
    generationView = JSON.parse(JSON.stringify(view));
    eventGossipPreview = ensureEventDrivenGossipPost(generationView, eventFeedTrigger, action.payload || {});
    eventTriggerPostIds = [
      String(action.payload && action.payload.postId || ""),
      eventGossipPreview && eventGossipPreview.id ? String(eventGossipPreview.id) : "",
    ].filter(Boolean);

    const callWorldBatch = async (neededPosts, excludeAuthorIds) => {
      EVENT_DRIVEN_FEED_BATCH_CONTEXT = {
        enabled: true,
        trigger: eventFeedTrigger,
        neededPosts,
        excludeAuthorIds,
        triggerPostIds: eventTriggerPostIds,
      };
      try {
        feedAiCalls += 1;
        return typeof legacyVoiceStyleGenWorldStep === "function"
          ? await legacyVoiceStyleGenWorldStep(generationView, false)
          : await genWorldStep(generationView, false);
      } finally {
        EVENT_DRIVEN_FEED_BATCH_CONTEXT = null;
      }
    };

    const first = await callWorldBatch(AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS, []);
    let merged = eventDrivenMergeBatchOutputs(generationView, first, null);
    const selectedAuthors = eventDrivenUsableBatchPosts(generationView, merged)
      .map((post) => eventDrivenFeedRawAuthor(generationView, post))
      .filter(Boolean);

    const needsSecond =
      merged.posts.length < AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS ||
      !eventDrivenTriggerCommentsCovered(merged, eventTriggerPostIds);

    if (needsSecond && feedAiCalls < 2) {
      const missing = Math.max(
        1,
        AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS - merged.posts.length
      );
      const second = await callWorldBatch(missing, selectedAuthors);
      merged = eventDrivenMergeBatchOutputs(generationView, merged, second);
    }

    out = merged;
  } else {
    out = action.type === "world"
      ? await genFocusedWorldStep(view)
      : await genWorldStep(view, false);
  }

  if (!out || !Array.isArray(out.posts) || !out.posts.length) return null;

  let visiblePostsCreated = 0;
  let generatedCommentCount = 0;

  update((n) => {
    const beforePostIds = new Set((n.posts || []).map((p) => p && p.id).filter(Boolean));

    let liveGossip = null;
    if (isEventFeedRefresh) {
      liveGossip = ensureEventDrivenGossipPost(n, eventFeedTrigger, action.payload || {});
    }

    EVENT_DRIVEN_FEED_APPLYING = isEventFeedRefresh;
    try {
      visiblePostsCreated = applyWorldStep(n, out);
    } finally {
      EVENT_DRIVEN_FEED_APPLYING = false;
    }

    const triggerIds = [
      String(action.payload && action.payload.postId || ""),
      liveGossip && liveGossip.id ? String(liveGossip.id) : "",
    ].filter(Boolean);

    generatedCommentCount += eventDrivenApplyTriggerComments(n, out, triggerIds);

    const freshPosts = (n.posts || []).filter((p) =>
      p &&
      !beforePostIds.has(p.id) &&
      !isHuman(n, p.authorId) &&
      !isMediaAccount(n, p.authorId)
    );

    freshPosts.forEach((freshPost) => {
      const inlineCount = safePostComments(freshPost)
        .filter((c) => c && !isHuman(n, c.authorId))
        .length;
      generatedCommentCount += inlineCount;

      if (isEventFeedRefresh && inlineCount > 0) {
        freshPost.autoCommentedAt = now();
        freshPost.autoCommentRounds = Math.max(
          1,
          Math.round(Number(freshPost.autoCommentRounds) || 0)
        );
      }
    });
  });

  if (isEventFeedRefresh) {
    console.info(
      "[feed-refresh]",
      "trigger=" + eventFeedTrigger,
      "posts=" + String(visiblePostsCreated),
      "comments=" + String(generatedCommentCount),
      "aiCalls=" + String(feedAiCalls)
    );
  }

  return visiblePostsCreated || (isEventFeedRefresh && eventTriggerPostIds.length)
    ? "world"
    : null;`,
    "event-driven world batch handler"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied event-driven feed/comment/unsolicited-DM optimization.");
} else {
  console.log("Event-driven AI optimization already applied.");
}
