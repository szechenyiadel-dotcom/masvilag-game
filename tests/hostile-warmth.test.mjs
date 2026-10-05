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

/* rel[a][b] = what a feels toward b */
function harness(rels, romance = {}) {
  const context = vm.createContext({
    String, Number, Array, Set, Object, RegExp, console: { info() {}, warn() {} },
    EMPTY_REL: { score: 0, bond: "", type: "", mood: "" },
    getRel: (w, a, b) => (rels[a] && rels[a][b]) || null,
    isHuman: (w, id) => id === "me",
    charById: (w, id) => ({ id, name: { me: "Adél", ryan: "Ryan", manon: "Manon", tandy: "Tandy", grant: "Grant" }[id] || id }),
    identityCanonFor: () => null, identityNameMatches: () => false,
    romanticStakeForObserver: (w, a, b) => romance[a + ">" + b] || null,
    socialFriendHostilitySignal: (t) => (/who asked|for once/i.test(t) ? 1 : 0),
    aiVoice: (w, id) => id,
    disrespectsAuthority: () => false,
    reportClientDiag: () => {},
  });
  vm.runInContext(pick(["relationshipIsHostile", "WARM_COMMENT_RE", "SARCASM_MARK_RE", "cannotStandForComments", "warmLineToSomeoneTheyCannotStand", "hostileCommentPairsInstruction", "nameOfIn", "filterDisrespectToAuthority"]), context);
  return context;
}
const w = { meId: "me" };
const RELS = {
  ryan: { me: { score: -40, bond: "enemy" }, tandy: { score: -20 } },
  manon: { tandy: { score: 60, bond: "best friend" }, me: { score: 10 } },
  grant: { manon: { score: -30, bond: "rival" } },
};

test("Someone who can't stand the author does not leave a sweet comment", () => {
  const c = harness(RELS);
  for (const text of ["You look amazing ❤️", "So proud of you!", "congrats, you deserve it", "gyönyörű vagy", "love this 😍"]) {
    assert.equal(c.warmLineToSomeoneTheyCannotStand(w, "ryan", "me", text), true, text);
  }
});

test("Cold, sarcastic or hostile lines from them stay; sweet lines between friends stay", () => {
  const c = harness(RELS);
  for (const text of ["Cute. 🙄", "Wow, congrats for once.", "Nobody asked.", "who asked lol", "Gorgeous… said no one."]) {
    assert.equal(c.warmLineToSomeoneTheyCannotStand(w, "ryan", "me", text), false, text);
  }
  assert.equal(c.warmLineToSomeoneTheyCannotStand(w, "manon", "tandy", "You look amazing ❤️"), false, "friends may be sweet");
  assert.equal(c.warmLineToSomeoneTheyCannotStand(w, "manon", "me", "love this 😍"), false, "neutral-positive may be sweet");
});

test("A love-hate pair with real romantic stake may still be sweet", () => {
  const c = harness(RELS, { "ryan>me": { stake: 4, label: "secret-crush" } });
  assert.equal(c.warmLineToSomeoneTheyCannotStand(w, "ryan", "me", "You look amazing ❤️"), false);
});

test("The filter drops only the sweet line to the person they can't stand", () => {
  const c = harness(RELS);
  const rows = [
    { id: "ryan", text: "You look amazing ❤️" },
    { id: "manon", text: "obsessed with this 😍" },
    { id: "ryan", text: "Cute. 🙄" },
  ];
  const kept = Array.from(c.filterDisrespectToAuthority(w, rows, () => "me")).map((r) => r.text);
  assert.deepEqual(kept, ["obsessed with this 😍", "Cute. 🙄"]);
});

test("The comment prompt names who can't stand whom and forbids warmth toward them", () => {
  const c = harness(RELS);
  const text = c.hostileCommentPairsInstruction(w, ["me", "ryan", "manon", "tandy", "grant"], ["ryan", "manon", "grant"]);
  assert.match(text, /Ryan can't stand Adél/);
  assert.match(text, /Ryan can't stand Tandy/);
  assert.match(text, /Grant can't stand Manon/);
  assert.doesNotMatch(text, /Manon can't stand/);
  assert.match(text, /never warm, sweet, supportive, flattering or complimentary/);
  assert.equal(c.hostileCommentPairsInstruction(w, ["me", "manon", "tandy"], ["manon"]), "");
});

test("withCommentTone adds the who-can't-stand-whom block to comment prompts", () => {
  assert.match(source, /hostileCommentPairsInstruction\(w, participants \|\| \[\], commenters \|\| null\)/);
  assert.match(source, /matureCommentInstruction\(w, participants \|\| \[\], commenters \|\| null\) \+ hostile/);
});
