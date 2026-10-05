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

function sanitizer(bible) {
  const people = { tandy: { id: "tandy", name: "Tandy Bowen" }, park: { id: "park", name: "Park Nam-gyu" } };
  const context = vm.createContext({
    Math, String, Set, RegExp, Array,
    charById: (w, id) => people[id],
    preferredDirectAddressForCharacter: () => "Tandy",
    directAddressAliasesForCharacter: (p) => p ? [p.name, p.name.split(" ")[0]] : [],
    allGossipMediaAccounts: () => [],
    characterBibleFor: (w, id) => id === "park" ? bible : null,
    nicknamesUsedBy: () => [],
    nicknameMatchesPerson: (name, person) => String(name || "").toLowerCase().includes(String(person.name).split(" ")[0].toLowerCase()),
    regexEscapeLiteral: (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  });
  vm.runInContext(pick(["sanitizeWrongCharacterVocative"]), context);
  return (text) => context.sanitizeWrongCharacterVocative({ player: people.tandy, chars: [people.park] }, "park", "tandy", text);
}

test("A pet name from the speaker's sheet that belongs to another girl is not used on the player", () => {
  const clean = sanitizer({ callsOthers: [{ person: "Lily", nickname: "Babydoll" }], people: [{ name: "Babydoll", is: "ex" }] });
  assert.equal(clean("Babydoll, you look good tonight."), "Tandy, you look good tonight.");
  assert.equal(clean("Hey babydoll, miss me?"), "Hey Tandy, miss me?");
  assert.equal(clean("You know, babydoll, I'm not done."), "You know, Tandy, I'm not done.");
  assert.equal(clean("Don't run, babydoll."), "Don't run, Tandy.");
  assert.equal(clean("Babydoll texted me again today."), "Babydoll texted me again today.", "a third-person mention stays");
});

test("A pet name the sheet gives to THIS target stays", () => {
  const clean = sanitizer({ callsOthers: [{ person: "Tandy", nickname: "Babydoll" }] });
  assert.equal(clean("Hey babydoll, miss me?"), "Hey babydoll, miss me?");
});

test("A friend summary saying 'relationship' / 'together' / 'partner' is not a romantic stake", () => {
  const body = pick(["romanticStakeForObserver"]);
  const re = new RegExp(body.match(/if \((\/\\b\(\?:wife[^\n]*?\/i)\.test\(corpus\)\)/)[1].slice(1, -2), "i");
  assert.equal(re.test("Their relationship is amicable, they train together, sparring partner"), false);
  assert.equal(re.test("they are in a relationship"), true);
  assert.equal(re.test("his girlfriend"), true);
  assert.match(source, /if \(!w\.falseJealousyMoodCleanupV1\)/, "old false jealousy moods are cleared once");
});

test("The player's post gets 5-8 comments instead of 3-6", () => {
  assert.match(source, /genComments\(view, post, \{ minComments: 5, maxComments: 8, playerPostContentIsolation: true \}\)/);
  assert.match(source, /requireHumanAuthor: true, minComments: 5, maxComments: 8, playerPostContentIsolation: true \}/);
  assert.match(pick(["isolatedPlayerPostComments"]), /Math\.min\(8, Math\.round\(Number\(options\.maxComments\) \|\| 8\)\)/);
});

test("R78: the stricter language retry does not use up a DM's only try", () => {
  assert.match(source, /if \(!strictMode\) \{\n\s+\/\*[\s\S]*?\*\/\n\s+strictMode = true;\n\s+continue;\n\s+\}/);
});

test("R87: in fake dating real feelings only leak; a player / fuckboy admits them much harder", () => {
  const body = pick(["fakeDatingBehaviorCard"]);
  assert.match(body, /only LEAK/);
  assert.match(body, /does not happen in an ordinary DM/);
  assert.match(body, /fuck \?boy/);
  assert.doesNotMatch(body, /your real feelings show"/);
});

test("hush: every old screen stays reachable (phone menu + Me links)", () => {
  assert.match(source, /\{\[\.\.\.SIDE_MAIN, \.\.\.SIDE_SUB\]\.map\(/);
  assert.match(source, /const SIDE_SUB = \[\["cast"[^\n]*\["bonds"[^\n]*\["world"/);
  assert.match(source, /onGo\("cast"\)/);
  assert.match(source, /onGo\("world"\)/);
  assert.match(source, /onGo\("bonds"\)/);
});
