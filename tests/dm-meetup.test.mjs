import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const NOW = 1_000_000_000_000;
function check(thread, playerText, replyText, scenes = []) {
  const context = vm.createContext({
    Math, Number, String, Array, now: () => NOW, worldLanguage: () => "en", nameOfIn: () => "Tandy",
    roleplayInviteIsPending: () => true, roleplayInviteIsAccepted: () => false,
  });
  vm.runInContext(pick(["DM_MEET_PROPOSAL_RE", "DM_MEET_COMMIT_RE", "DM_MEET_PLACE_PROPOSAL_RE", "DM_MEET_TIME_RE", "DM_MEET_ACCEPT_RE", "agreedDmMeetupBridge", "recentDmBridgeScene"]), context);
  const chats = { ck: thread.map(([from, text], i) => ({ from, text, ts: NOW - (thread.length - i) * 60000 })) };
  const bridge = context.agreedDmMeetupBridge({ chats, scenes, meId: "me", player: { name: "Tandy" } }, { id: "zoro", name: "Zoro" }, "ck", playerText, replyText);
  return bridge ? JSON.parse(JSON.stringify(bridge)) : null;
}

test("A meetup settled in a few words makes an Event invitation: 'Fine. One hour.'", () => {
  const bridge = check([["me", "Come to the dock behind the gym."], ["them", "No. Not happening on my deck."], ["me", "Then meet me at the dock in one hour. Don't chicken out."]], "Be there.", "Fine. One hour.");
  assert.ok(bridge, "an invitation");
  assert.equal(bridge.activate, true);
  assert.equal(bridge.kind, "private_meet");
  assert.deepEqual(bridge.cast, ["zoro"]);
  assert.match(bridge.setting, /dock/);
});

test("Other short agreements count too: 'ok, 8', 'deal', Hungarian ones", () => {
  assert.ok(check([["me", "come over to my place tonight?"]], "8 then", "ok, 8"));
  assert.ok(check([["me", "Let's meet at the pier at 9pm"]], "see you there", "Deal."));
  assert.ok(check([["me", "Találkozzunk ma este nálam"]], "8-kor?", "Rendben, ott leszek."));
});

test("A yes without a place or a time, a time without a yes, and a refusal make no invitation", () => {
  assert.equal(check([["me", "you're annoying"]], "lol", "Fine."), null, "just 'fine'");
  assert.equal(check([["me", "meet me at the dock in an hour"]], "?", "No. Not happening."), null, "no yes");
  assert.equal(check([["me", "how was your day?"]], "tomorrow I have training", "Good for you."), null, "a time, but nobody proposed anything");
  assert.equal(check([["me", "let's meet someday"]], "sure", "Sure, someday."), null, "no time named");
});

test("Once an invitation is pending in this chat, nothing new is made", () => {
  const thread = [["me", "Then meet me at the dock in one hour."]];
  const pending = [{ id: "s1", archived: false, chatBridge: true, initiatedBy: "zoro", sourceChatKey: "ck" }];
  assert.equal(check(thread, "Be there.", "Fine. One hour.", pending), null);
});

test("The existing wording still works, and the DM prompt tells the model that a short yes is an agreement", () => {
  assert.ok(check([["me", "wanna meet?"], ["them", "where?"]], "now", "on my way"));
  assert.match(source, /A MEGEGYEZÉS RÖVIDEN IS MEGEGYEZÉS/);
});
