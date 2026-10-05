import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import {
  AMBIENT_TRIGGER_WINDOW_MS, AMBIENT_ACTIONS_PER_TRIGGER,
  latestPlayerTriggerAt, ambientGateOpen, ambientGateAfterRun,
} from "../src/ambientGate.js";
import { focusedScope, inScope, strongestTieIds, groupsForScope, relationshipInScope, eventInScope } from "../src/aiScope.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

const isMe = (id) => id === "me";
const NOW = 10_000_000;

test("The newest player-caused event is the trigger; AI-only activity is not", () => {
  const events = [
    { actorId: "rita", ts: NOW - 1000 },
    { actorId: "me", ts: NOW - 5000 },
    { actorId: "paul", ts: NOW - 6000 },
    { actorId: "me", ts: NOW - 90000 },
  ];
  assert.equal(latestPlayerTriggerAt(events, isMe), NOW - 5000);
  assert.equal(latestPlayerTriggerAt([{ actorId: "rita", ts: NOW }], isMe), 0);
  assert.equal(latestPlayerTriggerAt(null, isMe), 0);
  assert.equal(latestPlayerTriggerAt([null, {}, { actorId: "me" }], isMe), 0);
});

test("Without a recent player event the gate stays shut: no timer-driven AI", () => {
  assert.equal(ambientGateOpen({ triggerAt: 0, now: NOW, state: null }), false);
  assert.equal(ambientGateOpen({ triggerAt: NOW - AMBIENT_TRIGGER_WINDOW_MS - 1, now: NOW, state: null }), false);
});

test("A fresh player event allows a small number of extras, then the world rests", () => {
  const triggerAt = NOW - 60_000;
  let state = null;
  for (let i = 0; i < AMBIENT_ACTIONS_PER_TRIGGER; i += 1) {
    assert.equal(ambientGateOpen({ triggerAt, now: NOW, state }), true, "extra " + (i + 1));
    state = ambientGateAfterRun(state, triggerAt);
  }
  assert.deepEqual(state, { triggerAt, used: AMBIENT_ACTIONS_PER_TRIGGER });
  assert.equal(ambientGateOpen({ triggerAt, now: NOW, state }), false);
});

test("The next player event reopens the gate with a fresh budget", () => {
  const first = NOW - 120_000, second = NOW - 10_000;
  const spent = { triggerAt: first, used: AMBIENT_ACTIONS_PER_TRIGGER };
  assert.equal(ambientGateOpen({ triggerAt: first, now: NOW, state: spent }), false);
  assert.equal(ambientGateOpen({ triggerAt: second, now: NOW, state: spent }), true);
  assert.deepEqual(ambientGateAfterRun(spent, second), { triggerAt: second, used: 1 });
});

/* The real App.jsx functions, evaluated against fake worlds. */
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

function appContext(extra = {}) {
  const context = vm.createContext({
    latestPlayerTriggerAt, ambientGateOpen, ambientGateAfterRun, focusedScope, inScope, strongestTieIds, groupsForScope, relationshipInScope, eventInScope,
    AI_ACTIVITY_OPTIMIZATION: { EVENT_DRIVEN_AMBIENT_ONLY: true },
    now: () => NOW,
    isHuman: (w, id) => id === w.meId,
    ensureSimState: (w) => (w.sim ||= {}),
    ...extra,
  });
  vm.runInContext(pick(["AMBIENT_ACTION_TYPES", "ambientActivityOpen", "isAmbientAction", "ambientActivityConsume"]), context);
  return context;
}

test("App: ambientActivityOpen follows the player's recent events", () => {
  const context = appContext();
  assert.equal(context.ambientActivityOpen({ meId: "me", socialEvents: [] }), false);
  assert.equal(context.ambientActivityOpen({ meId: "me", socialEvents: [{ actorId: "rita", ts: NOW }] }), false);
  assert.equal(context.ambientActivityOpen({ meId: "me", socialEvents: [{ actorId: "me", ts: NOW - 1000 }] }), true);
  assert.equal(context.ambientActivityOpen({ meId: "me", socialEvents: [{ actorId: "me", ts: NOW - AMBIENT_TRIGGER_WINDOW_MS - 5 }] }), false);
  assert.equal(context.ambientActivityOpen(null), false);
});

test("App: the switch turns the gate off for everything", () => {
  const context = appContext({ AI_ACTIVITY_OPTIMIZATION: { EVENT_DRIVEN_AMBIENT_ONLY: false } });
  assert.equal(context.ambientActivityOpen({ meId: "me", socialEvents: [] }), true);
});

test("App: consuming the budget closes the gate after the allowed extras", () => {
  const context = appContext();
  const world = { meId: "me", socialEvents: [{ actorId: "me", ts: NOW - 1000 }], sim: {} };
  for (let i = 0; i < AMBIENT_ACTIONS_PER_TRIGGER; i += 1) {
    assert.equal(context.ambientActivityOpen(world), true);
    context.ambientActivityConsume(world);
  }
  assert.equal(context.ambientActivityOpen(world), false);
  world.socialEvents.unshift({ actorId: "me", ts: NOW - 500 });
  assert.equal(context.ambientActivityOpen(world), true);
});

test("App: only background extras use the budget; the player's own requests never do", () => {
  const context = appContext();
  for (const type of ["popup-event", "group-turn", "roleplay-initiate", "gossip-spread", "gossip-echo", "gossip-story", "gossip-reaction", "rumor-evolution"]) {
    assert.equal(context.isAmbientAction({ type, source: "event" }), true, type);
    assert.equal(context.isAmbientAction({ type, source: "manual" }), false, type + " manual");
    assert.equal(context.isAmbientAction({ type, source: "player-event" }), false, type + " player-event");
  }
  for (const type of ["comments", "reply", "dm", "world", "world-full", "note-react", "follow"]) assert.equal(context.isAmbientAction({ type, source: "event" }), false, type);
  assert.equal(context.isAmbientAction(null), false);
});

test("App: the timer-driven pickers are all behind the gate", () => {
  assert.match(source, /function popupOverdueByMs\(w\) \{[\s\S]{0,200}if \(!ambientActivityOpen\(w\)\) return -Infinity;/);
  assert.match(source, /function pickInitiativeWatchdogAction\(view, allowedChannels = null\) \{[\s\S]{0,200}if \(!ambientActivityOpen\(view\)\) return null;/);
  assert.match(source, /ambientOpen \? pickGossipPropagationAction\(view\)/);
  assert.match(source, /ambientOpen \? pickGossipNetworkEchoAction\(view\)/);
  assert.match(source, /ambientOpen \? gossipAutoCandidate\(view\)/);
  assert.match(source, /ambientOpen && Math\.random\(\) < 0\.72/);
  assert.match(source, /ambientOpen && Math\.random\(\) < 0\.18/);
  assert.match(source, /if \(isAmbientAction\(action\)\) ambientActivityConsume\(n\);/);
});

test("App: the two AI planner calls are gone and the player-post writer asks as a foreground call", () => {
  assert.ok(!source.includes("eventDrivenFeedRefreshPlan"));
  assert.ok(!source.includes("playerPostCommentReactionPlan"));
  assert.ok(!source.includes('source: "feed-refresh-plan"'));
  assert.ok(!source.includes('source: "player-post-comment-plan"'));
  assert.match(source, /source: "player-post-comments-isolated",\s*foreground: true,/);
  assert.match(source, /priority: 100,\s*foreground: true,/);
  assert.match(source, /foreground: requestMeta && requestMeta\.foreground === true \? true : undefined,/);
});

test("App: a free-AI waiting answer rests only the background lane, never the global cooldown", () => {
  const start = source.indexOf('data.error.type === "free_ai_waiting"');
  assert.ok(start > 0);
  const branch = source.slice(start, source.indexOf("throw waiting;", start));
  assert.ok(branch.includes("AI.backgroundWaitUntil"));
  assert.ok(!/setCooldown\(|bumpAiStrike\(/.test(branch), "the player's own lane must not be slowed down");
  assert.match(source, /if \(err && err\.waiting\) \{\s*throw err;\s*\}/, "no inline wait: the lane is freed at once");
  assert.match(source, /if \(!manualQueued && AI\.backgroundWaitUntil > now\(\)\) return;/, "autonomous work rests, player actions run");
  assert.match(source, /!\(e && e\.waiting\) && simBrakeNoteFailure\(\)/, "waiting is not a failure for the emergency brake");
});

test("App: a player-triggered action that hit 'no free capacity' stays queued and is retried later", () => {
  const context = vm.createContext({ now: () => NOW, ensureSimState: (w) => w.sim });
  vm.runInContext(pick(["simDropQueued", "simDeferQueued"]), context);
  const world = { sim: { queue: [{ id: "a" }, { id: "b" }] } };
  context.simDeferQueued(world, "a", NOW + 60_000);
  assert.equal(world.sim.queue.length, 2, "not dropped");
  assert.equal(world.sim.queue[0].retryAt, NOW + 60_000);
  assert.equal(world.sim.queue[1].retryAt, undefined);
  context.simDeferQueued(world, "b", 0);
  assert.equal(world.sim.queue[1].retryAt, NOW + 20_000, "never retried sooner than 20 s");
  context.simDropQueued(world, "a");
  assert.deepEqual(world.sim.queue.map((x) => x.id), ["b"]);
  assert.match(source, /if \(!ok && AI\.waitingAt >= actionStartedAt\) simDeferQueued\(n, queued\.id, AI\.backgroundWaitUntil\);\s*else if \(ok\) simDropQueued\(n, queued\.id\);/);
  assert.match(source, /if \(laneWaiting\) simDeferQueued\(n, laneAction\.id, AI\.backgroundWaitUntil\);\s*else if \(laneOk\) simDropQueued\(n, laneAction\.id\);/);
  assert.match(source, /!\(Number\(a\.retryAt\) > now\(\)\)/);
});
