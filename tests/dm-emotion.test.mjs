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

function harness(rel, selfState) {
  const context = vm.createContext({
    String, Number, Math, Object,
    EMPTY_REL: { score: 0, hidden: "", type: "", bond: "", fixed: false, mood: "", why: "" },
    getRel: () => rel,
    localizedBond: (value) => value,
    worldLanguage: () => "en",
  });
  vm.runInContext(pick(["directDmFeelingBlock", "DIRECT_DM_EMOTION_RULES"]), context);
  const w = { meId: "me", player: { name: "Tandy" }, charMemory: { nam: { selfState } } };
  return { block: () => context.directDmFeelingBlock(w, { id: "nam", name: "Park Nam-gyu" }), rules: vm.runInContext("DIRECT_DM_EMOTION_RULES", context), w, context };
}

test("A DM reply is told how the character feels about the player right now, from the real record", () => {
  const { block } = harness({ score: 42, trust: 20, attraction: 70, tension: 55, bond: "rivals with chemistry", mood: "teasing, a bit possessive", hiddenFeelings: "Terrified she will pick someone else." },
    { mood: "relieved and smug" });
  const text = block();
  assert.match(text, /HOW YOU FEEL ABOUT TANDY RIGHT NOW/);
  for (const part of ["your mood: relieved and smug", "bond: rivals with chemistry", "warmth +42", "trust 20", "attraction 70", "tension 55", "how it shows: teasing, a bit possessive", "What you keep hidden from Tandy: Terrified she will pick someone else."]) assert.ok(text.includes(part), part);
});

test("The newer bond shape (levels, hiddenFeelings) is read too, and a character with no record adds nothing", () => {
  const { block } = harness({ levels: { sentiment: -10, trust: 5, attraction: 0, tension: 80 }, hiddenFeelings: "Still hurt." }, {});
  const text = block();
  assert.ok(text.includes("warmth -10") && text.includes("tension 80") && text.includes("Still hurt."), text);
  assert.equal(harness({ score: 0, hidden: "", type: "", bond: "", mood: "" }, {}).block().includes("hidden"), false);
  assert.equal(harness({}, {}).block(), "");
});

test("The emotional rules say what a flat reply is, to read the subtext of short answers, and that length follows the feeling", () => {
  const { rules } = harness({}, {});
  assert.match(rules, /EMOTIONAL TRUTH/);
  assert.match(rules, /only states a fact, throws a quip with nothing behind it/);
  assert.match(rules, /SUBTEXT[\s\S]*"ok", "what xd"/);
  assert.match(rules, /does not give speeches about feelings/, "a guarded type keeps its way of showing it");
  assert.match(rules, /Length follows the feeling/);
});

test("Both go into the protected tail of every DM reply, right before the player's line; and the DM is not told to shorten its feeling", () => {
  assert.match(source, /directDmLastExchangeBlock\(w, c, ck, latest\) \+\n    directDmFeelingBlock\(w, c\) \+\n    DIRECT_DM_EMOTION_RULES \+\n    "AMIRE MOST VÁLASZOLNOD KELL/);
  assert.match(source, /options && options\.source === "dm"\n\s+\? "PERFORMANCE: no text outside the requested JSON/);
});
