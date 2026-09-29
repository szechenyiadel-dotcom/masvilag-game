import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const discourseMarker = "MÁSVILÁG IMMEDIATE DISCOURSE MODEL v1";
const promptMarker = "MÁSVILÁG SCENE REALITY CARD v1";
const npcReactionMarker = "MÁSVILÁG NPC-PAIR REACTION v1";
const observerMarker = "MÁSVILÁG AI-AI JEALOUSY ROUTING v1";

if (!next.includes(discourseMarker)) {
  const anchor = /(function sceneRoleplayMemoryCard\(scene, w\) \{)/;
  if (!anchor.test(next)) throw new Error("Sims-world continuity patch aborted: sceneRoleplayMemoryCard anchor not found.");

  const helper = `/* ${discourseMarker} */
function roleplayImmediateDiscourseCard(w, turns) {
  const rows = (Array.isArray(turns) ? turns : [])
    .filter((turn) => turn && turn.text)
    .slice(-8);
  if (!rows.length) return "IMMEDIATE DISCOURSE STATE: no exact recent turns.";

  const nameOf = (id) => {
    if (id === "narrator") return "NARRATOR";
    const c = charById(w, id);
    return c ? c.name : String(id || "unknown");
  };
  const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const stripEdge = (value) => clean(value).replace(/^[*_'\"“”‘’\\s]+|[*_'\"“”‘’\\s]+$/g, "");
  const last = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const lastText = stripEdge(last.text);
  const previousText = previous ? stripEdge(previous.text) : "";
  const lastWords = lastText.toLowerCase().match(/[a-zÀ-ž0-9'-]+/gi) || [];
  const previousWords = previousText.toLowerCase().match(/[a-zÀ-ž0-9'-]+/gi) || [];
  const contentWords = lastWords.filter((word) => word.length >= 3);
  const echoed = contentWords.filter((word) => previousWords.includes(word));
  const isQuestion = /[?？]\\s*$/.test(lastText) || /^(?:who|what|when|where|why|how|which|whose|ki|mi|mikor|hol|miért|hogyan|melyik)\\b/i.test(lastText);
  const shortEchoQuestion = Boolean(
    previous &&
    last.authorId !== previous.authorId &&
    isQuestion &&
    lastWords.length > 0 &&
    lastWords.length <= 5 &&
    echoed.length > 0
  );

  const ledger = rows.map((turn, index) => {
    const speaker = nameOf(turn.authorId);
    const target = turn.to ? nameOf(turn.to) : "unspecified";
    const kind = turn.kind || (turn.authorId === "narrator" ? "narration" : "speech/action");
    return String(index + 1) + ") SPEAKER=" + speaker + " | TARGET=" + target + " | KIND=" + kind + " | EXACT=" + JSON.stringify(clean(turn.text));
  }).join("\\n");

  const obligations = [];
  if (isQuestion && last.authorId !== "narrator") {
    obligations.push("The newest turn is a QUESTION by " + nameOf(last.authorId) + ". Answer its actual meaning or deliberately acknowledge/refuse it; do not answer an older beat instead.");
  }
  if (shortEchoQuestion) {
    obligations.push("CRITICAL ECHO/CLARIFICATION: the newest short question repeats wording introduced by " + nameOf(previous.authorId) + " in the immediately previous turn (echoed term(s): " + echoed.join(", ") + "). The newest speaker is QUESTIONING/CLARIFYING that wording, NOT inventing, choosing, asserting or owning it. Never reply with a premise such as 'you call it X' / 'you want to call it X' unless they explicitly adopt the term later.");
  }
  if (last.kind === "action") {
    obligations.push("The newest turn is an ACTION. Treat only the visible action as fact; do not invent dialogue or motive behind it.");
  }

  return [
    "IMMEDIATE DISCOURSE STATE — deterministic ground truth, newest last:",
    ledger,
    obligations.length ? "CURRENT RESPONSE OBLIGATIONS:\\n- " + obligations.join("\\n- ") : "CURRENT RESPONSE OBLIGATION: continue causally from the newest exact turn.",
    "ATTRIBUTION RULE: every label/metaphor/accusation belongs to the speaker who introduced it until another speaker explicitly adopts it.",
    "REALITY RULE: do not invert speaker roles, turn clarification into assertion, or answer a line nobody said."
  ].join("\\n");
}

`;
  next = next.replace(anchor, helper + "$1");
}

if (!next.includes(promptMarker)) {
  const anchor = /(ROLEPLAY RÖVID TÁVÚ MEMÓRIA — EZ A KORÁBBI KÖRÖK TÖMÖRÍTETT FOLYTONOSSÁGA, NEM ÚJ TÖRTÉNÉS:\r?\n\$\{sceneRoleplayMemoryCard\(promptScene, w\)\}\r?\n)/;
  if (!anchor.test(next)) throw new Error("Sims-world continuity patch aborted: Scene memory prompt anchor not found.");
  next = next.replace(anchor, `$1\n${promptMarker}:\n\${roleplayImmediateDiscourseCard(w, promptTurns)}\n\n`);
}

if (!next.includes(npcReactionMarker)) {
  const anchor = /(\/\* Egy központi szimulációs akció futtatása\. Mindig pontosan egy AI-hívás\. \*\/\r?\nasync function runSimulationAction)/;
  if (!anchor.test(next)) throw new Error("Sims-world continuity patch aborted: runSimulationAction anchor not found.");

  const helper = `/* ${npcReactionMarker} */
async function genNpcPairReaction(w, actor, target, sourceEvent) {
  if (!w || !actor || !target || actor.id === target.id || isHuman(w, actor.id) || isHuman(w, target.id)) return { skip: true };
  const rel = getRel(w, actor.id, target.id) || {};
  const reverse = getRel(w, target.id, actor.id) || {};
  const eventText = sourceEvent ? String(sourceEvent.text || "") : "";
  const eventVisibility = sourceEvent ? String(sourceEvent.visibility || "limited") : "limited";
  const prompt = [
    worldContext(w, [actor.id, target.id], true, actor.id),
    "NPC→NPC AUTONOMOUS RELATIONSHIP REACTION.",
    "The PLAYER is not the target of this action. Do not redirect the interaction toward the player.",
    "ACTOR: " + actor.name + " [" + actor.id + "]",
    "TARGET: " + target.name + " [" + target.id + "]",
    "ACTOR→TARGET relationship: score=" + (Number(rel.score) || 0) + "; bond=" + (rel.bond || rel.type || "-") + "; mood=" + (rel.mood || "-") + "; hidden=" + (rel.hidden || "-"),
    "TARGET→ACTOR relationship: score=" + (Number(reverse.score) || 0) + "; bond=" + (reverse.bond || reverse.type || "-") + "; mood=" + (reverse.mood || "-"),
    "TRIGGER THEY ACTUALLY KNOW ABOUT:",
    "visibility=" + eventVisibility,
    eventText || "A witnessed relationship event created a real reaction.",
    voiceCard(actor),
    characterMemoryCard(w, actor),
    relationshipBehaviorCard(w, actor.id, target.id),
    "RULES:",
    "- This is between " + actor.name + " and " + target.name + ". The player is not automatically involved.",
    "- Preserve jealousy, possessiveness, rivalry, hostility, hurt, attraction or loyalty when canon + the trigger support them. Do not soften AI-AI conflict.",
    "- Do not invent a new trigger, secret knowledge, off-screen betrayal or fake quote.",
    "- Decide whether the reaction would plausibly become PUBLIC or stay PRIVATE/OFFSCREEN.",
    "- PUBLIC means the actor would genuinely post a short statement/callout/subtweet visible on the feed. Use it sparingly.",
    "- OFFSCREEN means the pair has a confrontation/reaction that becomes persistent relationship history but not a player-DM.",
    "- Keep the reaction concrete and do not resolve the whole relationship in one beat.",
    "JSON ONLY:",
    '{"skip":false,"mode":"public_post or offscreen","text":"short public post if mode=public_post, otherwise empty","summary":"one concrete sentence describing the AI-AI reaction/confrontation","tone":"jealous/hostile/hurt/protective/etc"}'
  ].join("\\n\\n");

  return askWorldJSON(w, engineFor(w), prompt, { maxTokens: 650, priority: 16 });
}

`;
  next = next.replace(anchor, helper + "$1");

  const handlerAnchor = /(if \(action\.type === "roleplay-initiate"\) \{)/;
  if (!handlerAnchor.test(next)) throw new Error("Sims-world continuity patch aborted: roleplay-initiate handler anchor not found.");

  const handler = `if (action.type === "npc-pair-reaction") {
    const actorId = action.payload && action.payload.actorId;
    const targetId = action.payload && action.payload.targetId;
    const eventId = action.payload && action.payload.eventId;
    const actor = actorId ? charById(view, actorId) : null;
    const target = targetId ? charById(view, targetId) : null;
    if (!actor || !target || actor.id === target.id || isHuman(view, actor.id) || isHuman(view, target.id)) return null;

    const sourceEvent = (view.socialEvents || []).find((row) => row && row.id === eventId) || null;
    const out = await genNpcPairReaction(view, actor, target, sourceEvent);
    if (!out || out.skip === true) return null;
    const mode = out.mode === "public_post" ? "public_post" : "offscreen";
    const summary = String(out.summary || "").trim().slice(0, 900);
    const rawText = String(out.text || "").trim();
    const publicText = rawText ? cleanGeneratedUtterance(view, actor.id, rawText, 1000) : "";
    if (!summary && !publicText) return null;

    update((n) => {
      const liveActor = charById(n, actor.id);
      const liveTarget = charById(n, target.id);
      if (!liveActor || !liveTarget) return;
      let createdPost = null;
      if (mode === "public_post" && publicText) {
        createdPost = {
          id: uid(), authorId: liveActor.id, ts: now(), likes: 0, likedBy: [], text: publicText,
          imageId: "", image: "", comments: [], language: worldLanguage(n, n.meId), npcPairReaction: true,
        };
        n.posts.unshift(createdPost);
        enqueueGuaranteedPostCommentCoverage(n, createdPost.id, "npc-pair-reaction");
      }

      const eventSummary = summary || (createdPost ? publicText : (liveActor.name + " reacted to " + liveTarget.name));
      recordSocialEvent(n, {
        type: createdPost ? "post" : "npc-pair-interaction",
        refId: createdPost ? createdPost.id : ("npc-pair:" + liveActor.id + ":" + liveTarget.id + ":" + now()),
        ts: now(), actorId: liveActor.id, targetIds: [liveTarget.id],
        visibility: createdPost ? "public" : "limited", factLevel: "observed",
        importance: createdPost ? 44 : 34,
        drama: /hostil|jealous|possess|angry|hurt|rival|félt|ellens|düh|sért/i.test(String(out.tone || "")) ? 52 : 26,
        romance: 0, embarrassment: 0, source: "npc-pair-reaction", text: eventSummary,
        tags: ["npc-pair", "relationship-reaction", String(out.tone || "").toLowerCase()].filter(Boolean),
        meta: { postId: createdPost ? createdPost.id : "", sourceEventId: eventId || "", participantIds: [liveActor.id, liveTarget.id], skipRomanticObserverConsequences: true },
      });
      rememberAboutTarget(n, liveActor.id, liveTarget.id, { kind: "event", source: "npc_pair_reaction", confidence: 1, text: eventSummary });
    });
    return "npc-pair-reaction";
  }

`;
  next = next.replace(handlerAnchor, handler + "$1");
}

if (!next.includes(observerMarker)) {
  const signature = /function scheduleRomanticObserverReaction\(w, event, observerId\) \{/;
  if (!signature.test(next)) throw new Error("Sims-world continuity patch aborted: romantic observer scheduler signature not found.");
  next = next.replace(signature, `function scheduleRomanticObserverReaction(w, event, observerId, subjectId) {\n  /* ${observerMarker} */`);

  const dmBlock = /\/\* For a witnessed scene \/ public post there may be no concrete comment[\s\S]*?simEnqueue\(w, mkAction\(\r?\n\s*"dm",[\s\S]*?\r?\n\s*\)\);/;
  if (!dmBlock.test(next)) throw new Error("Sims-world continuity patch aborted: romantic observer DM fallback block not found.");

  const replacement = `/* For a witnessed scene / public post there may be no concrete comment node.
     Route the consequence to the ACTUAL relationship target. AI→AI jealousy must
     never be silently converted into a DM to the player. */
  if (subjectId === w.meId) {
    simEnqueue(w, mkAction(
      "dm",
      keyBase + ":dm",
      { botId: observerId, trigger: "romantic-jealousy", eventId: event.id || "" },
      "event"
    ));
    return;
  }

  const subject = subjectId ? charById(w, subjectId) : null;
  if (subject && !isHuman(w, subject.id)) {
    simEnqueue(w, mkAction(
      "npc-pair-reaction",
      keyBase + ":npc:" + subject.id,
      { actorId: observerId, targetId: subject.id, trigger: "romantic-jealousy", eventId: event.id || "" },
      "event"
    ));
  }`;
  next = next.replace(dmBlock, replacement);

  const callAnchor = /scheduleRomanticObserverReaction\(w, event, observer\.id\);/;
  if (!callAnchor.test(next)) throw new Error("Sims-world continuity patch aborted: romantic observer scheduler call not found.");
  next = next.replace(callAnchor, `scheduleRomanticObserverReaction(w, event, observer.id, row.subjectId);`);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied Sims-like scene discourse + NPC pair reaction routing.");
} else {
  console.log("Sims-like scene discourse + NPC pair reaction routing already applied.");
}
