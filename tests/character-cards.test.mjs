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

/* The card of each speaker in a prompt carries the digest of their WHOLE sheet, not just its first lines. */
function harness(people, bibles) {
  const context = vm.createContext({
    Array, Object, String, Math, Number,
    charById: (w, id) => people.find((c) => c.id === id) || null,
    isHuman: (w, id) => id === "me",
    worldLanguage: () => "en",
    identityCanonLine: (w, c) => "PUBLIC " + c.name,
    characterPersonaBrief: () => "persona ".repeat(300), characterCoreSheet: () => "",
    characterVoiceStyleCard: () => "voice ".repeat(500),
    characterNicknameLines: () => "",
  });
  vm.runInContext(pick(["CHARACTER_FIDELITY_MARKER", "CHARACTER_FIDELITY_END_MARKER", "characterBibleFor", "characterBibleCard", "voiceStyleCardsForIds"]), context);
  const w = { meId: "me", sim: { characterBible: Object.fromEntries(Object.entries(bibles).map(([id, data]) => [id, { data }])) } };
  return { cards: (ids, actor) => context.voiceStyleCardsForIds(w, ids, actor) };
}

const bible = (name, partner) => ({
  core: name + " is a hot-headed fighter.",
  extremes: [{ trait: "possessive", toward: partner, shows: "stands too close and answers for them" }],
  history: Array.from({ length: 24 }, (_, i) => "Event " + (i + 1) + " of " + name + "'s life, with enough words to count as a real sentence about it."),
  people: [{ name: partner, is: "FAKE BOYFRIEND/GIRLFRIEND (staged)", feels: "plays along in public, privately annoyed and secretly fond" }],
  never: ["apologise first"], phrases: ["you wish"],
});

const people = [{ id: "brent", name: "Brent" }, { id: "tandy", name: "Tandy" }, { id: "ian", name: "Ian" }, { id: "eva", name: "Eva" }];

test("A DM speaker's card holds the whole sheet digest: history in order and the people who matter, the fake relationship included", () => {
  const { cards } = harness(people, { brent: bible("Brent", "Tandy") });
  const text = cards(["brent"], "brent");
  assert.ok(text.includes("FAKE BOYFRIEND/GIRLFRIEND (staged)"), "the arrangement is on the card");
  assert.ok(text.includes("Event 24 of Brent"), "and so is the last event of the history, not just the first few");
  assert.ok(text.length < 22000, "the whole prefix stays bounded: " + text.length);
});

test("With several speakers the prefix stays bounded, every speaker keeps a digest, and the card of one is not the card of another", () => {
  const { cards } = harness(people, { brent: bible("Brent", "Tandy"), tandy: bible("Tandy", "Brent"), ian: bible("Ian", "Eva"), eva: bible("Eva", "Ian") });
  const text = cards(["brent", "tandy", "ian", "eva"], "");
  assert.ok(text.length < 26000, "bounded: " + text.length);
  for (const name of ["Brent", "Tandy", "Ian", "Eva"]) assert.ok(text.includes("Event 1 of " + name), name + " keeps their digest");
});
