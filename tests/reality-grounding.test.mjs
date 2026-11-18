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

const T = 1_800_000_000_000;
const chars = [{ id: "brent", name: "Brent LaRusso", personality: "cocky fuckboy, karate" }, { id: "me", name: "Tandy Bowen" }, { id: "ng", name: "Park Nam-gyu" }];
function world(extra = {}) {
  return { meId: "me", chars, posts: [], socialEvents: [], groups: [], scenes: [], chats: { "brent|me": [{ from: "me", text: "lol you wish", ts: T - 3600e3 }] }, ...extra };
}
function sandbox() {
  const context = vm.createContext({ String, Array, Set, Object, Math, Number, RegExp, console: { info() {} }, now: () => T,
    charById: (w, id) => w.chars.find((c) => c.id === id) || null, sharedPastEvidence: () => true });
  vm.runInContext(pick(["INVENTED_PAST_EN_RE", "INVENTED_PAST_HU_RE", "CLAIMED_OBSERVATION_RE", "CLAIM_STOPWORDS", "claimContentWords", "recordedRealityText", "claimGroundedIn", "stripInventedSharedPast"]), context);
  return context;
}

test("R124: an invented memory or sighting goes, the rest of the DM stays", () => {
  const c = sandbox();
  const w = world();
  assert.equal(c.stripInventedSharedPast(w, "brent", "That's not what your body language said last night when I had you pinned against the locker. But sure, keep telling yourself it's all fake. 😏", ["me"]), "But sure, keep telling yourself it's all fake. 😏");
  assert.equal(c.stripInventedSharedPast(w, "brent", "Then why do I keep catching Nam-gyu staring at your ass when you're not looking? 😏", ["me"]), "");
  assert.equal(c.stripInventedSharedPast(w, "brent", "Oh please, like anyone would believe that.", ["me"]), "Oh please, like anyone would believe that.", "no claim, untouched");
});

test("R124: a claim whose details really happened stays", () => {
  const c = sandbox();
  const w = world({ scenes: [{ cast: ["brent", "me"], title: "After practice", turns: [{ text: "He pins her against the locker, grinning." }, { text: "Her body language says stay." }] }] });
  const line = "That's not what your body language said last night when I had you pinned against the locker.";
  assert.equal(c.stripInventedSharedPast(w, "brent", line, ["me"]), line);
  const seen = world({ chats: { "brent|me": [{ from: "me", text: "Nam-gyu keeps staring at me in class", ts: T - 600e3 }] } });
  const q = "Then why do I keep catching Nam-gyu staring at you?";
  assert.equal(c.stripInventedSharedPast(seen, "brent", q, ["me"]), q, "the player said it herself");
});
