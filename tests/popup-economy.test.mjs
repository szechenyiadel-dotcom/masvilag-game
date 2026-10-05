import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const proxy = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

test("Popups ask for their own 'popup' source, not the paid Scene chain", () => {
  for (const fn of ["genPopupEvent", "genPopupEventReroll", "genPopupCustomOutcome"]) {
    const body = pick([fn]);
    assert.match(body, /askWorldWritingJSON\("popup"/, fn);
    assert.doesNotMatch(body, /askWorldWritingJSON\("scene"/, fn);
  }
  assert.match(pick(["genPopupEventReroll"]), /foreground:true/);
  assert.match(pick(["genPopupCustomOutcome"]), /foreground:true/);
  assert.match(proxy, /source === "popup" \|\| source === "invite"\) \{[\s\S]{0,260}raw = \["gemini", "groq", "groq2", "openrouter3", "openrouter-dm-venice"\]/);
  assert.match(proxy, /allowPaidBackground: AI_ALLOW_PAID_BACKGROUND \|\| \(source === "dm" && playerWaiting\) \|\| source === "scene" \|\| isComment \}/, "background popups never get paid capacity");
});

function cadence() {
  const context = vm.createContext({ Math, Number, String, storySettingsOf: (w) => ({ dramaLevel: w.level }), LIVE_WORLD_POPUP_CADENCE_MULTIPLIER: 1, LIVE_WORLD_POPUP_RETRY_MS: 25000 });
  vm.runInContext(pick(["popupCadenceMs", "popupRetryWaitMs", "POPUP_DAILY_HARD_MAX"]) + "\nthis.cap = POPUP_DAILY_HARD_MAX;", context);
  return context;
}

test("Popups come about half as often, at most six a day", () => {
  const c = cadence();
  assert.equal(c.popupCadenceMs({ level: "balanced" }), 15 * 60 * 1000);
  assert.equal(c.popupCadenceMs({ level: "low" }), 20 * 60 * 1000);
  assert.equal(c.popupCadenceMs({ level: "high" }), 10 * 60 * 1000);
  assert.equal(c.popupCadenceMs({ level: "chaotic" }), 8 * 60 * 1000);
  assert.equal(c.cap, 6);
});

test("A failed popup generation waits longer each time instead of retrying every 25 s", () => {
  const c = cadence();
  const wait = (n) => c.popupRetryWaitMs({ sim: { popupFailedAttempts: n } });
  assert.equal(wait(0), 25000);
  assert.equal(wait(1), 25000);
  assert.equal(wait(2), 50000);
  assert.equal(wait(3), 100000);
  assert.equal(wait(6), 800000);
  assert.equal(wait(20), 15 * 60 * 1000);
  assert.match(source, /popupSim\.popupFailedAttempts = Math\.max\(0, Math\.round\(Number\(popupSim\.popupFailedAttempts\) \|\| 0\)\) \+ 1;/);
  assert.match(source, /sim\.lastPopupSuccessAt = ts; sim\.popupFailedAttempts = 0;/);
  assert.match(source, /if \(lastAttemptAt && now\(\) - lastAttemptAt < popupRetryWaitMs\(w\)\) return false;/);
});

test("Unprompted DMs: 'text me', no follow-back and unfollow always come; any other reason at most one an hour", () => {
  const context = vm.createContext({ Math, Number, Array, String, RegExp, now: () => 10 * 3600e3 });
  vm.runInContext(pick(["DM_ALWAYS_ALLOWED_TRIGGER_RE", "OTHER_DM_HOURLY_MAX", "dmTriggerAlwaysAllowed", "otherDmBudgetOpen"]), context);
  const t = 10 * 3600e3;
  for (const trigger of ["comment-dm-text-me", "follow-not-returned", "player-unfollowed", "popup-choice"]) assert.equal(context.dmTriggerAlwaysAllowed(trigger), true, trigger);
  for (const trigger of ["gossip-story-reaction", "ignored-dm", "player-tagged", "romantic-jealousy", "relationship", "", undefined]) assert.equal(context.dmTriggerAlwaysAllowed(trigger), false, String(trigger));
  assert.equal(context.otherDmBudgetOpen({}, t), true);
  assert.equal(context.otherDmBudgetOpen({ otherDmTimes: [t - 20 * 60e3] }, t), false, "one other DM 20 minutes ago");
  assert.equal(context.otherDmBudgetOpen({ otherDmTimes: [t - 61 * 60e3] }, t), true, "more than an hour ago");
  const planner = pick(["fullSpecNextAutonomousDmAction"]);
  assert.match(planner, /if\(!budgetOpen&&!dmTriggerAlwaysAllowed\(row\.trigger\)\)\{delete sim\.deferredAutonomousDms\[row\.botId\];continue;\}/);
  assert.match(planner, /if\(!budgetOpen&&!dmTriggerAlwaysAllowed\(row\.trigger\)\)\{delete state\.pendingDmTriggers\[row\.key\];continue;\}/);
  assert.match(source, /if \(!dmTriggerAlwaysAllowed\(action\.payload && action\.payload\.trigger\)\) \{\n      sim\.otherDmTimes/);
  assert.match(proxy, /source === "dm" && !playerWaiting\) \{[\s\S]{0,220}raw = \["openrouter-dm-dolphin", "openrouter3", "gemini", "groq", "groq2"\]/);
});

test("A spontaneous Event invitation comes at most once a day and is written on free capacity", () => {
  const context = vm.createContext({ Math, Number, String, Date, now: () => new Date(2026, 9, 5, 12).getTime() });
  vm.runInContext(pick(["popupLocalDayKey", "AI_SPONTANEOUS_INVITE_DAILY_MAX", "aiSpontaneousInviteDailyCapReached"]), context);
  const t = new Date(2026, 9, 5, 12).getTime();
  assert.equal(context.aiSpontaneousInviteDailyCapReached({ sim: {} }, t), false);
  assert.equal(context.aiSpontaneousInviteDailyCapReached({ sim: { spontaneousInviteDay: "2026-10-05", spontaneousInviteCount: 1 } }, t), true);
  assert.equal(context.aiSpontaneousInviteDailyCapReached({ sim: { spontaneousInviteDay: "2026-10-04", spontaneousInviteCount: 3 } }, t), false, "a new day");
  assert.match(pick(["canAiInitiateRoleplay"]), /if \(aiSpontaneousInviteDailyCapReached\(w\)\) return false;/);
  assert.match(source, /sim\.spontaneousInviteCount = sim\.spontaneousInviteDay === today \?/);
  for (const fn of ["genRoleplayInitiation", "genForcedEverydayRoleplayInvitation"]) {
    assert.match(pick([fn]), /askWorldWritingJSON\("invite"/, fn);
    assert.doesNotMatch(pick([fn]), /askWorldWritingJSON\("scene"/, fn);
  }
  assert.match(proxy, /source === "popup" \|\| source === "invite"\) \{/);
});
