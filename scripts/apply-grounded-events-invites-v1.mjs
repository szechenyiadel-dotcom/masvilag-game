import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG GROUNDED EVENTS + INVITES v2";

function allMatches(regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...next.matchAll(new RegExp(regex.source, flags))];
}
function renameOne(regex, replacement, label, required = true) {
  const count = allMatches(regex).length;
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Grounded events/invites v2 aborted: ${label} expected 1 match, found ${count}.`);
}
function replaceOne(regex, replacement, label, required = true) {
  const count = allMatches(regex).length;
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Grounded events/invites v2 aborted: ${label} expected 1 match, found ${count}.`);
}

if (!next.includes(`/* ${MARKER} */`)) {
  next = next.replace(
    /genComments\(view,\s*post,\s*\{\s*minComments:\s*2,\s*maxComments:\s*4,\s*playerPostContentIsolation:\s*true\s*\}\)/,
    'genComments(view, post, { minComments: 3, maxComments: 6, playerPostContentIsolation: true })'
  );
  next = next.replace(
    /const minComments = Math\.max\(2,\s*Math\.min\(4,\s*Math\.round\(Number\(options\.minComments\) \|\| 2\)\)\);/,
    'const minComments = Math.max(3, Math.min(6, Math.round(Number(options.minComments) || 3)));'
  );
  next = next.replace(
    /const maxComments = Math\.max\(minComments,\s*Math\.min\(4,\s*Math\.round\(Number\(options\.maxComments\) \|\| 4\)\)\);/,
    'const maxComments = Math.max(minComments, Math.min(6, Math.round(Number(options.maxComments) || 6)));'
  );

  renameOne(/function\s+simsSocialPositiveAttentionEvent\s*\(/, "function legacyGroundedPositiveAttentionEvent(", "simsSocialPositiveAttentionEvent");
  renameOne(/function\s+simsSocialScheduleAttentionRivalry\s*\(/, "function legacyGroundedScheduleAttentionRivalry(", "simsSocialScheduleAttentionRivalry");
  renameOne(/async function\s+genNpcPairReaction\s*\(/, "async function legacyGroundedGenNpcPairReaction(", "genNpcPairReaction");
  renameOne(/function\s+recordSocialEvent\s*\(/, "function legacyGroundedRecordSocialEvent(", "recordSocialEvent");
  renameOne(/function\s+simsSocialApplyEventConsequences\s*\(/, "function legacyGroundedApplyEventConsequences(", "simsSocialApplyEventConsequences");
  renameOne(/function\s+pushNote\s*\(/, "function legacyGroundedPushNote(", "pushNote");
  renameOne(/function\s+setFollowState\s*\(/, "function legacyGroundedSetFollowState(", "setFollowState");
  renameOne(/function\s+planAutoAction\s*\(/, "function legacyGroundedPlanAutoAction(", "planAutoAction");
  renameOne(/async function\s+runSimulationAction\s*\(/, "async function legacyGroundedRunSimulationAction(", "runSimulationAction");
  renameOne(/function\s+Chat\s*\(/, "function LegacyGroundedChat(", "Chat");
  renameOne(/function\s+World\s*\(/, "function LegacyGroundedWorld(", "World");

  replaceOne(
    /<Icon size=\{19\} \/>\s*\{label\}/,
    `<span style={{ position: "relative", display: "inline-flex" }}>
                <Icon size={19} />
                {k === "chat" && groundedUnreadDmCount(view) > 0 ? (
                  <span style={{
                    position: "absolute", top: -7, right: -9, minWidth: 16, height: 16,
                    padding: "0 4px", borderRadius: 99, background: "var(--rose)",
                    color: "var(--ink)", fontSize: 9, fontWeight: 700,
                    display: "grid", placeItems: "center", lineHeight: 1
                  }}>{Math.min(99, groundedUnreadDmCount(view))}</span>
                ) : null}
              </span> {label}`,
    "messages unread badge"
  );

  replaceOne(
    /view\.activeSceneId = tab === "scene" && sceneId \? sceneId : "";/,
    `groundedRepairKnownFalseBrentIncident(view);
  view.activeSceneId = tab === "scene" && sceneId ? sceneId : "";`,
    "loaded-world correction hook"
  );

  const helper = String.raw`

/* ${MARKER} */
let GROUNDED_REL_EVENT_CONTEXT = null;

const GROUNDED_FALSE_BRENT_RE =
  /saw\s+Angela\s+Mallory\s+Silverman\s+act\s+romantically\/flirtatiously\s+with\s+Brent\s+LaRusso\s+in\s+public/i;

function groundedRuntime(w) {
  if (!w || typeof w !== "object") return null;
  if (!w.sim || typeof w.sim !== "object" || Array.isArray(w.sim)) w.sim = {};
  if (!w.sim.groundedEventsV2 || typeof w.sim.groundedEventsV2 !== "object" || Array.isArray(w.sim.groundedEventsV2)) {
    w.sim.groundedEventsV2 = {};
  }
  const s = w.sim.groundedEventsV2;
  if (!s.pendingFollowBack || typeof s.pendingFollowBack !== "object" || Array.isArray(s.pendingFollowBack)) s.pendingFollowBack = {};
  if (!s.dmUnread || typeof s.dmUnread !== "object" || Array.isArray(s.dmUnread)) s.dmUnread = {};
  if (!Array.isArray(w.eventLog)) w.eventLog = [];
  if (!Array.isArray(w.invitations)) w.invitations = [];
  return s;
}

function groundedEventLog(w, kind, status, message, sourceRef = "", meta = {}) {
  if (!w) return null;
  groundedRuntime(w);
  const row = {
    id: "elog_" + uid(),
    ts: now(),
    kind: String(kind || "event"),
    status: String(status || "info"),
    message: String(message || "").replace(/\s+/g, " ").trim().slice(0, 600),
    sourceRef: String(sourceRef || "").slice(0, 180),
    meta: meta && typeof meta === "object" ? { ...meta } : {},
  };
  w.eventLog.unshift(row);
  if (w.eventLog.length > 220) w.eventLog.length = 220;
  console.info(
    "[event-log]",
    "kind=" + row.kind,
    "status=" + row.status,
    "source=" + (row.sourceRef || "-"),
    "message=" + row.message
  );
  return row;
}

function groundedSourceRef(event) {
  if (!event) return "";
  const meta = event.meta && typeof event.meta === "object" ? event.meta : {};
  const type = String(event.type || "event");
  const ref = meta.commentId || meta.postId || meta.sceneId || meta.popupEventId || event.refId || event.id || "";
  return type + ":" + String(ref || "unknown");
}

function groundedFindComment(w, id) {
  if (!w || !id) return null;
  for (const post of w.posts || []) {
    const row = safePostComments(post).find((c) => c && String(c.id) === String(id));
    if (row) return { post, comment: row };
  }
  return null;
}

function groundedEventIsRecordedFact(w, event) {
  if (!w || !event) return false;
  const type = String(event.type || "").toLowerCase();
  const meta = event.meta && typeof event.meta === "object" ? event.meta : {};
  const ref = String(event.refId || event.id || "");

  if (type === "post") {
    const postId = String(meta.postId || ref);
    return Boolean((w.posts || []).find((p) => p && String(p.id) === postId));
  }
  if (type === "comment" || type === "reply") {
    const commentId = String(meta.commentId || ref);
    return Boolean(groundedFindComment(w, commentId));
  }
  if (type === "follow" || type === "unfollow") {
    const actor = String(event.actorId || "");
    const target = String((event.targetIds || [])[0] || "");
    if (!actor || !target || !charById(w, actor) || !charById(w, target)) return false;
    return type === "follow" ? isFollowing(w, actor, target) : !isFollowing(w, actor, target);
  }
  if (type === "popup-choice") {
    const popupId = String(meta.popupEventId || ref.split(":")[0] || "");
    return Boolean((w.popupEvents || []).find((e) => e && String(e.id) === popupId && e.resolvedAt));
  }
  if (/roleplay|scene/.test(type) || meta.sceneId) {
    const sceneId = String(meta.sceneId || ref);
    return Boolean((w.scenes || []).find((s) => s && String(s.id) === sceneId));
  }
  if (type === "dm-message") {
    const actor = String(event.actorId || "");
    const human = String((event.targetIds || []).find((id) => isHuman(w, id)) || "");
    if (!actor || !human) return false;
    const key = chatKey(actor, human);
    const rows = (w.chats && w.chats[key]) || [];
    return rows.some((m) => {
      if (!m) return false;
      if (ref && String(m.id || "") === ref) return true;
      return Math.abs((Number(m.ts) || 0) - (Number(event.ts) || 0)) < 5000 && String(m.text || "") === String(event.text || "");
    });
  }
  return false;
}

function groundedExplicitRomanticSignal(event) {
  if (!event) return false;
  if (event.meta && event.meta.romantic === true) return true;
  const text = String(event.text || "");
  return /\b(flirt|flirting|kiss|kissing|date|dating|romantic|love\s+you|hot|gorgeous|beautiful|crush|vonz|flört|csók|megcsókol|randi|randiz|szerelmes|dögös|gyönyörű)\b|[😘😍🥰❤️❤💕💖]/iu.test(text);
}

function groundedJealousyEligibility(w, charId, humanId) {
  const c = charById(w, charId);
  if (!c || isHuman(w, charId) || !humanId) return { allowed: false, strength: 0 };
  const rel = getRel(w, charId, humanId) || EMPTY_REL;
  const relationshipText = [rel.bond, rel.type, rel.mood, rel.hidden].filter(Boolean).join(" ").toLowerCase();
  const personalityText = [c.personality, c.traits, c.backstory, c.secrets].filter(Boolean).join(" ").toLowerCase();
  const score = Number(rel.score) || 0;
  const romantic = /love|szerel|crush|vonz|attract|dating|partner|boyfriend|girlfriend|pár|spouse|házastárs|obsess|megszáll/.test(relationshipText);
  const explicitlyJealousPersonality = /jealous|féltéken|possess|birtokl|territorial|obsess|megszáll/.test(personalityText);
  const allowed = romantic || (explicitlyJealousPersonality && score >= 20);
  const strength = allowed ? Math.max(1, Math.min(5, (romantic ? 2 : 0) + (explicitlyJealousPersonality ? 1 : 0) + (score >= 70 ? 2 : score >= 40 ? 1 : 0))) : 0;
  return { allowed, strength };
}

function simsSocialPositiveAttentionEvent(event) {
  const type = String(event && event.type || "").toLowerCase();
  if (type === "like" || type === "follow") return true;
  if (type === "comment" || type === "reply" || type === "post") return groundedExplicitRomanticSignal(event);
  return false;
}

function simsSocialScheduleAttentionRivalry(w, event, subjectId) {
  if (!w || !event || !w.meId || String(event.actorId || "") !== String(w.meId)) return;
  if (!subjectId || subjectId === w.meId || !simsSocialPositiveAttentionEvent(event)) return;
  if (!groundedEventIsRecordedFact(w, event)) {
    groundedEventLog(w, "relationship-trigger", "skipped", "Romantic/jealousy reaction blocked because the source event is not recorded in world state.", groundedSourceRef(event));
    return;
  }
  if (String(event.visibility || "public").toLowerCase() !== "public") return;
  const subject = charById(w, subjectId);
  if (!subject || isHuman(w, subjectId)) return;

  const candidates = (w.chars || [])
    .filter((c) => c && c.id !== subjectId && c.id !== w.meId && !isHuman(w, c.id))
    .map((c) => {
      const eligible = groundedJealousyEligibility(w, c.id, w.meId);
      if (!eligible.allowed) return null;
      if (typeof simsSocialCanObserveEvent === "function" && !simsSocialCanObserveEvent(w, c.id, event)) return null;
      return { c, eligible, score: Number((getRel(w, c.id, w.meId) || {}).score) || 0 };
    })
    .filter(Boolean)
    .sort((a, b) => (b.eligible.strength - a.eligible.strength) || (b.score - a.score));

  const chosen = candidates[0];
  if (!chosen) {
    groundedEventLog(w, "relationship-trigger", "no-reaction", "Public romantic attention had no jealousy-eligible observer.", groundedSourceRef(event));
    return;
  }

  const intel = ensureSocialIntelligenceState(w);
  const key = chosen.c.id + ":attention";
  const last = Number(intel.lastAttentionReaction[key]) || 0;
  if (now() - last < SIMS_SOCIAL_REACTION_COOLDOWN_MS) return;
  intel.lastAttentionReaction[key] = now();

  if (typeof simEnqueue === "function" && typeof mkAction === "function") {
    const queued = simEnqueue(w, mkAction(
      "npc-pair-reaction",
      "grounded-attention-rivalry:" + chosen.c.id + ":" + subjectId + ":" + simsSocialEventKey(event),
      { actorId: chosen.c.id, targetId: subjectId, trigger: "grounded-player-attention-rivalry", eventId: String(event.id || event.refId || ""), jealousyStrength: chosen.eligible.strength },
      "event"
    ));
    groundedEventLog(w, "relationship-trigger", queued ? "queued" : "skipped", chosen.c.name + " may react to a verified public romantic signal; strength=" + chosen.eligible.strength + ".", groundedSourceRef(event), { observerId: chosen.c.id, subjectId });
  }
}

async function genNpcPairReaction(w, actor, target, sourceEvent) {
  if (!sourceEvent || !groundedEventIsRecordedFact(w, sourceEvent)) {
    console.warn("[grounded-event] npc-pair reaction blocked: missing/unverified source event");
    return { skip: true };
  }
  const out = await legacyGroundedGenNpcPairReaction(w, actor, target, sourceEvent);
  if (!out || out.skip === true) return out;
  if (!groundedExplicitRomanticSignal(sourceEvent) && /flirt|romantic|kiss|date|szerel|flört|csók|randi/i.test(String(out.summary || "") + " " + String(out.tone || ""))) {
    console.warn("[grounded-event] rejected invented romantic interpretation", groundedSourceRef(sourceEvent));
    return { skip: true };
  }
  return out;
}

function groundedSanitizeNotificationText(text) {
  return String(text || "")
    .replace(/\bhidden\s*[:=][^•|\n]+/gi, "")
    .replace(/\bsecret(?:ly)?\s+(?:in love|crush|attracted|jealous|possessive)[^•|\n]*/gi, "private feeling")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pushNote(w, ownerId, note) {
  if (!note || typeof note !== "object") return legacyGroundedPushNote(w, ownerId, note);
  let nextNote = { ...note, text: groundedSanitizeNotificationText(note.text) };
  if (GROUNDED_REL_EVENT_CONTEXT && String(nextNote.text || "").match(/kapcsol|relationship|score|pont|bond|viszony/i)) {
    const suffix = worldLanguage(w, ownerId) === "en" ? " • Source: " + GROUNDED_REL_EVENT_CONTEXT : " • Forrás: " + GROUNDED_REL_EVENT_CONTEXT;
    if (!String(nextNote.text || "").includes(GROUNDED_REL_EVENT_CONTEXT)) nextNote.text = String(nextNote.text || "") + suffix;
  }
  return legacyGroundedPushNote(w, ownerId, nextNote);
}

function simsSocialApplyEventConsequences(w, event) {
  const sourceRef = groundedSourceRef(event);
  if (event && String(event.source || "") === "npc-pair-reaction") {
    const sourceId = String(event.meta && event.meta.sourceEventId || "");
    const sourceEvent = (w.socialEvents || []).find((row) => row && (String(row.id || "") === sourceId || String(row.refId || "") === sourceId));
    if (!sourceEvent || !groundedEventIsRecordedFact(w, sourceEvent)) {
      groundedEventLog(w, "relationship-change", "blocked", "AI-derived relationship consequence blocked because its concrete source event is missing.", sourceRef);
      return;
    }
  }
  const before = {};
  Object.entries((w && w.rels) || {}).forEach(([key, rel]) => { before[key] = Number(rel && rel.score) || 0; });
  const previous = GROUNDED_REL_EVENT_CONTEXT;
  GROUNDED_REL_EVENT_CONTEXT = sourceRef;
  try {
    return legacyGroundedApplyEventConsequences(w, event);
  } finally {
    GROUNDED_REL_EVENT_CONTEXT = previous;
    Object.entries((w && w.rels) || {}).forEach(([key, rel]) => {
      const oldScore = Object.prototype.hasOwnProperty.call(before, key) ? before[key] : Number(rel && rel.score) || 0;
      const newScore = Number(rel && rel.score) || 0;
      if (oldScore === newScore) return;
      groundedEventLog(w, "relationship-change", "applied", key + " " + (newScore - oldScore >= 0 ? "+" : "") + (newScore - oldScore) + " (" + oldScore + "→" + newScore + ")", sourceRef, { relationshipKey: key, delta: newScore - oldScore });
    });
  }
}

function groundedRepairKnownFalseBrentIncident(w) {
  if (!w) return;
  const state = groundedRuntime(w);
  if (state.falseBrentRollbackV1) return;
  const haystack = [...(w.socialEvents || []).map((e) => String(e && e.text || "")), ...Object.values(w.notify || {}).flat().map((n) => String(n && n.text || ""))].join("\n");
  if (!GROUNDED_FALSE_BRENT_RE.test(haystack)) return;
  const corrections = [["Harry Osborn", 10, true], ["Eli Moskowitz", 5, false], ["Terrance Silver", 5, false], ["Feng Xiao", 5, false], ["Daniel LaRusso", 5, false]];
  corrections.forEach(([name, amount, restoreRival]) => {
    const c = (w.chars || []).find((row) => row && String(row.name || "").toLowerCase() === String(name).toLowerCase());
    if (!c || !w.meId) return;
    const rel = getRel(w, c.id, w.meId);
    if (!rel) return;
    rel.score = Math.max(-100, Math.min(100, (Number(rel.score) || 0) + Number(amount)));
    if (restoreRival && !rel.fixed && /enemy|ellens/i.test(String(rel.bond || rel.type || ""))) {
      if ("bond" in rel || !("type" in rel)) rel.bond = "Rival";
      else rel.type = "Rival";
    }
    groundedEventLog(w, "repair", "applied", "Restored erroneous fabricated-Brent deduction for " + name + ": +" + amount + (restoreRival ? ", Enemy→Rival when applicable" : "") + ".", "repair:false-brent-romance");
  });
  state.falseBrentRollbackV1 = now();
  Object.values(w.notify || {}).flat().forEach((note) => {
    if (note && GROUNDED_FALSE_BRENT_RE.test(String(note.text || ""))) note.text = groundedSanitizeNotificationText(String(note.text || "") + " • [Hibás, kitalált esemény — automatikusan visszaállítva]");
  });
}

function recordSocialEvent(w, event = {}) {
  groundedRepairKnownFalseBrentIncident(w);
  const result = legacyGroundedRecordSocialEvent(w, event);
  try {
    const ref = groundedSourceRef(event);
    groundedEventLog(w, String(event.type || "social-event"), "recorded", String(event.text || event.type || "Social event recorded."), ref, { actorId: event.actorId || "", targetIds: event.targetIds || [] });
    if (String(event.type || "").toLowerCase() === "dm-message") groundedRegisterIncomingDm(w, event);
  } catch (error) {
    console.warn("[grounded-event] post-record hook failed; base event preserved", error);
  }
  return result;
}

function groundedFollowBackPersonalityEligible(w, botId, humanId) {
  const c = charById(w, botId);
  const rel = getRel(w, botId, humanId) || EMPTY_REL;
  if (!c) return false;
  const text = [c.personality, c.traits, c.backstory, c.secrets, rel.bond, rel.mood, rel.hidden].filter(Boolean).join(" ").toLowerCase();
  return /obsess|megszáll|possess|birtokl|jealous|féltéken|cling|ragaszkod|territorial|proud|büszke|sensitive|érzékeny|confront|konfront/.test(text);
}

function setFollowState(w, actorId, targetId, following, reason) {
  const before = isFollowing(w, actorId, targetId);
  const result = legacyGroundedSetFollowState(w, actorId, targetId, following, reason);
  const after = isFollowing(w, actorId, targetId);
  if (!before && after && !isHuman(w, actorId) && isHuman(w, targetId)) {
    const source = String(reason || "");
    if (!/bootstrap|startup|normalize|migration/i.test(source) && groundedFollowBackPersonalityEligible(w, actorId, targetId) && !isFollowing(w, targetId, actorId)) {
      const state = groundedRuntime(w);
      state.pendingFollowBack[actorId] = { botId: actorId, humanId: targetId, createdAt: now(), dueAt: now() + 3 * 60 * 1000, reason: source || "follow" };
      groundedEventLog(w, "follow-not-returned", "pending", nameOfIn(w, actorId) + " followed " + nameOfIn(w, targetId) + "; follow-back reaction armed.", "follow:" + actorId + ">" + targetId);
    }
  }
  if (after && isHuman(w, actorId) && !isHuman(w, targetId)) {
    const state = groundedRuntime(w);
    if (state.pendingFollowBack[targetId]) {
      delete state.pendingFollowBack[targetId];
      groundedEventLog(w, "follow-not-returned", "cancelled", "Follow-back arrived before the DM trigger.", "follow:" + targetId + ">" + actorId);
    }
  }
  return result;
}

function groundedDueFollowBackAction(w) {
  if (!w || eventDrivenAutonomousDmPauseReason(w)) return null;
  const state = groundedRuntime(w);
  const rows = Object.values(state.pendingFollowBack || {}).filter((row) => row && Number(row.dueAt || 0) <= now()).sort((a, b) => Number(a.dueAt || 0) - Number(b.dueAt || 0));
  for (const row of rows) {
    if (!charById(w, row.botId) || isHuman(w, row.botId)) { delete state.pendingFollowBack[row.botId]; continue; }
    if (!isFollowing(w, row.botId, row.humanId) || isFollowing(w, row.humanId, row.botId)) { delete state.pendingFollowBack[row.botId]; continue; }
    groundedEventLog(w, "follow-not-returned", "queued", "Unreturned-follow DM queued for " + nameOfIn(w, row.botId) + ".", "follow:" + row.botId + ">" + row.humanId);
    return mkAction("dm", "grounded-follow-not-returned:" + row.botId + ":" + row.createdAt, { botId: row.botId, trigger: "follow-not-returned", groundedFollowBackBotId: row.botId }, "event");
  }
  return null;
}

function planAutoAction(view) {
  const followBack = groundedDueFollowBackAction(view);
  if (followBack) return followBack;
  return legacyGroundedPlanAutoAction(view);
}

async function runSimulationAction(view, update, action, addImage) {
  if (action && action.type === "npc-pair-reaction") {
    const eventId = String(action.payload && action.payload.eventId || "");
    const sourceEvent = (view.socialEvents || []).find((row) => row && (String(row.id || "") === eventId || String(row.refId || "") === eventId));
    if (!sourceEvent || !groundedEventIsRecordedFact(view, sourceEvent)) {
      update((n) => groundedEventLog(n, "npc-pair-reaction", "blocked", "Reaction blocked: concrete source event not found.", "event:" + (eventId || "missing")));
      return null;
    }
  }
  const isPopup = action && action.type === "world-full" && String(action.payload && action.payload.trigger || "") === "popup-choice";
  const isFollowBack = action && action.type === "dm" && action.payload && action.payload.groundedFollowBackBotId;
  if (isPopup) update((n) => groundedEventLog(n, "popup-choice-followup", "started", "Popup follow-up started: relationship/feed/gossip pipeline.", "popup:" + String(action.payload.popupEventId || "")));
  let result;
  try {
    result = await legacyGroundedRunSimulationAction(view, update, action, addImage);
  } catch (error) {
    if (isPopup || isFollowBack) update((n) => groundedEventLog(n, isPopup ? "popup-choice-followup" : "follow-not-returned", "failed", String(error && error.message || error || "Unknown failure"), isPopup ? "popup:" + String(action.payload.popupEventId || "") : "follow:" + String(action.payload.groundedFollowBackBotId || "")));
    throw error;
  }
  if (isFollowBack) {
    update((n) => {
      const state = groundedRuntime(n);
      const botId = String(action.payload.groundedFollowBackBotId || "");
      if (result) delete state.pendingFollowBack[botId];
      groundedEventLog(n, "follow-not-returned", result ? "success" : "failed", result ? "Unreturned-follow DM generated." : "DM action returned no message; trigger kept for retry.", "follow:" + botId + ">" + String(n.meId || ""));
    });
  }
  if (isPopup) {
    update((n) => {
      const popupId = String(action.payload.popupEventId || "");
      const popup = (n.popupEvents || []).find((e) => e && String(e.id) === popupId);
      let gossip = null;
      try {
        if (popup && popup.gossipEligible !== false && typeof ensureEventDrivenGossipPost === "function") gossip = ensureEventDrivenGossipPost(n, "popup-choice", { popupEventId: popupId, choiceId: action.payload.choiceId || "" });
      } catch (error) { console.warn("[popup-followup] gossip safeguard failed", error); }
      const freshPosts = (n.posts || []).filter((p) => p && !isHuman(n, p.authorId) && now() - (Number(p.ts) || 0) < 2 * 60 * 1000).length;
      groundedEventLog(n, "popup-choice-followup", result ? "success" : "partial", "Popup follow-up finished; fresh AI posts=" + freshPosts + "; gossip=" + Boolean(gossip) + ".", "popup:" + popupId, { freshPosts, gossip: Boolean(gossip), actionResult: String(result || "") });
    });
  }
  return result;
}

function groundedRegisterIncomingDm(w, event) {
  const actorId = String(event && event.actorId || "");
  const humanId = String((event && event.targetIds || []).find((id) => isHuman(w, id)) || "");
  if (!actorId || !humanId || isHuman(w, actorId)) return;
  const state = groundedRuntime(w);
  state.dmUnread[actorId] = (Number(state.dmUnread[actorId]) || 0) + 1;
  const text = String(event.text || "");
  groundedEventLog(w, "dm", "received", nameOfIn(w, actorId) + " sent a DM.", groundedSourceRef(event), { actorId, humanId });
  if (groundedLooksLikeInvitation(text)) {
    const existing = (w.invitations || []).find((inv) => inv && inv.status === "pending" && inv.fromId === actorId && inv.sourceRef === groundedSourceRef(event));
    if (!existing) {
      w.invitations.unshift({ id: "inv_" + uid(), fromId: actorId, toId: humanId, createdAt: now(), when: groundedExtractInviteWhen(text), where: groundedExtractInviteWhere(text), context: text.slice(0, 800), sourceRef: groundedSourceRef(event), status: "pending" });
      groundedEventLog(w, "invitation", "received", "Invitation received from " + nameOfIn(w, actorId) + ".", groundedSourceRef(event));
    }
  }
}

function groundedLooksLikeInvitation(text) {
  return /\b(?:come\s+(?:with|to|over)|join\s+me|meet\s+me|want\s+to\s+(?:meet|come|go)|party|dinner|coffee|drinks?|hang\s*out|date|gyere|találkozz|találkozn|meghívlak|meghív|buli|vacsora|kávé|ital|találkozó|randi|edzés|dojo)\b/iu.test(String(text || ""));
}
function groundedExtractInviteWhen(text) {
  const m = String(text || "").match(/\b(?:tonight|tomorrow|today|this\s+(?:evening|afternoon|weekend)|at\s+\d{1,2}(?::\d{2})?|ma\s+este|holnap|ma|hétvégén|\d{1,2}:\d{2})\b/iu);
  return m ? m[0] : "";
}
function groundedExtractInviteWhere(text) {
  const m = String(text || "").match(/\b(?:at|to|in)\s+([A-ZÁÉÍÓÖŐÚÜŰ][^,.!?]{2,50})|(?:a|az)\s+([^,.!?]{3,50})(?:ba|be|ra|re|hoz|hez|höz)\b/u);
  return m ? String(m[1] || m[2] || "").trim() : "";
}

function groundedUnreadDmCount(w) {
  const state = groundedRuntime(w);
  return Object.values(state && state.dmUnread || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}

function GroundedInvitationsPanel({ w, update, onOpenScene }) {
  const pending = (w.invitations || []).filter((inv) => inv && inv.status === "pending");
  if (!pending.length) return null;
  const decide = (invite, accept) => {
    let createdSceneId = "";
    update((n) => {
      const live = (n.invitations || []).find((row) => row && row.id === invite.id);
      if (!live || live.status !== "pending") return;
      live.status = accept ? "accepted" : "declined";
      live.resolvedAt = now();
      if (accept) {
        const from = charById(n, live.fromId);
        const scene = { id: "scene_" + uid(), title: (from ? from.name + " — " : "") + (live.where || "Meghívás"), setting: live.where || live.context || "Invitation meetup", goal: live.context || "Continue the accepted invitation naturally.", cast: [live.fromId].filter(Boolean), turns: [], open: true, createdAt: now(), ts: now(), language: worldLanguage(n, n.meId), invitationId: live.id, invitationContext: live.context };
        n.scenes = Array.isArray(n.scenes) ? n.scenes : [];
        n.scenes.unshift(scene);
        createdSceneId = scene.id;
      }
      groundedEventLog(n, "invitation", accept ? "accepted" : "declined", (accept ? "Accepted" : "Declined") + " invitation from " + nameOfIn(n, live.fromId) + ".", live.sourceRef || ("invitation:" + live.id));
    });
    if (accept && createdSceneId && typeof onOpenScene === "function") onOpenScene(createdSceneId);
  };
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="between"><div><div className="name">Meghívások</div><div className="hint">{pending.length} függő meghívás</div></div><span className="mono" style={{ color: "var(--rose)" }}>{pending.length}</span></div>
      {pending.map((inv) => (
        <div key={inv.id} style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="name">{nameOfIn(w, inv.fromId)}</div>
          <div className="hint">{inv.where ? "Hova: " + inv.where : "Hova: a meghívásban megadott hely"}{" · "}{inv.when ? "Mikor: " + inv.when : "Mikor: nincs pontosítva"}</div>
          <div className="body" style={{ fontSize: 13 }}>{inv.context}</div>
          <div className="row" style={{ marginTop: 9 }}><button className="btn tiny primary" onClick={() => decide(inv, true)}>Elfogadom</button><button className="btn tiny" onClick={() => decide(inv, false)}>Elutasítom</button></div>
        </div>
      ))}
    </div>
  );
}

function Chat(props) {
  const { w, update, openId } = props;
  useEffect(() => {
    if (!openId) return;
    update((n) => { const state = groundedRuntime(n); if (state.dmUnread[openId]) state.dmUnread[openId] = 0; });
  }, [openId]);
  return (<>{!openId ? <GroundedInvitationsPanel w={w} update={update} onOpenScene={props.onOpenScene} /> : null}<LegacyGroundedChat {...props} /></>);
}

function GroundedEventLogPanel({ w }) {
  const rows = (w.eventLog || []).slice(0, 60);
  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="between"><div><div className="name">Eseménynapló</div><div className="hint">Trigger → reakció → eredmény, konkrét forrással</div></div><span className="mono">{rows.length}</span></div>
      {!rows.length ? <p className="hint">Még nincs naplózott esemény.</p> : null}
      {rows.map((row) => (<div key={row.id} style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--line)" }}><div className="between"><span className="mono" style={{ fontSize: 10 }}>{row.kind}</span><span className="hint">{row.status}</span></div><div style={{ marginTop: 3, fontSize: 12.5 }}>{row.message}</div>{row.sourceRef ? <div className="hint mono" style={{ marginTop: 3 }}>forrás: {row.sourceRef}</div> : null}</div>))}
    </div>
  );
}

function World(props) {
  return (<><GroundedEventLogPanel w={props.w} /><LegacyGroundedWorld {...props} /></>);
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded-events/invites v2: verified relationship triggers, jealousy gating, false-Brent rollback, 3–6 grounded comments, follow-back DM, popup event log, DM badge and invitations UI.");
} else {
  console.log("Grounded-events/invites v2 already applied.");
}
