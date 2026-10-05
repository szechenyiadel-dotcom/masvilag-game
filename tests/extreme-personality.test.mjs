import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const policy = fs.readFileSync(new URL("../src/socialWorldPolicy.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

function harness(chars, rels = {}, bibles = {}) {
  const context = vm.createContext({
    String, Number, Array, Object, RegExp,
    EMPTY_REL: { score: 0 },
    isHuman: (w, id) => id === "me",
    getRel: (w, a, b) => (rels[a] && rels[a][b]) || null,
    nameOfIn: (w, id) => ({ me: "Adél", tandy: "Tandy" }[id] || id),
    characterBibleFor: (w, id) => bibles[id] || null,
  });
  vm.runInContext(pick(["EXTREME_NATURES", "extremeNatureText", "extremeNatureDirective"]), context);
  const w = { meId: "me", chars };
  return (c) => context.extremeNatureDirective(w, c);
}

test("A psychopath / obsessed character gets a named FULL-strength order on their own card", () => {
  const wolf = { id: "wolf", name: "Feng Wolf", personality: "Cold-blooded psychopath, manipulative, enjoys control." };
  const ian = { id: "ian", name: "Ian", personality: "Obsessed with Tandy, possessive and jealous to the extreme." };
  const directive = harness([wolf, ian, { id: "tandy", name: "Tandy" }], { ian: { tandy: { bond: "obsession", obsession: 90 } } });
  const w1 = directive(wolf);
  assert.match(w1, /EXTREME NATURE OF FENG WOLF/);
  assert.match(w1, /a psychopath: no real empathy/);
  assert.match(w1, /manipulative:/);
  assert.match(w1, /FULL strength in every DM, comment, post, group chat and scene/);
  assert.match(w1, /never make them suddenly nice/);
  const w2 = directive(ian);
  assert.match(w2, /obsessed: fixated/);
  assert.match(w2, /possessive:/);
  assert.match(w2, /Their fixation: Tandy\./);
});

test("Hungarian sheets and the character bible count too; ordinary people get nothing", () => {
  const directive = harness([], {}, { zoe: { core: "kedves lány", extremes: [{ trait: "megszállott", toward: "Brent", shows: "minden posztját figyeli" }] } });
  assert.match(directive({ id: "r", name: "Rex", personality: "kegyetlen, szadista, veszélyes" }), /cruel:[\s\S]*dangerous:/);
  assert.match(directive({ id: "zoe", name: "Zoe", personality: "vidám" }), /obsessed: fixated/);
  assert.equal(directive({ id: "m", name: "Mia", personality: "kedves, kíváncsi, konfliktuskerülő", traits: "empátia magas" }), "");
  assert.equal(directive({ id: "ry", name: "Ryan", personality: "arrogáns, éles nyelvű", traits: "IQ magas, empátia alacsony" }), "", "low empathy alone is not a psychopath");
  assert.equal(directive({ id: "me", name: "Player", personality: "psychopath" }), "", "never for the player");
});

test("The order sits on every speaker card and in the global policy of every AI request", () => {
  assert.match(source, /try \{ extreme = extremeNatureDirective\(w, c\); \} catch \(error\) \{ extreme = ""; \}\n      return \[owner, extreme, style, personaBlock, bible\]/);
  assert.match(policy, /EXTREME PERSONALITIES — HARD CONTRACT/);
  assert.match(policy, /does NOT dilute these characters/);
  assert.match(policy, /\$\{ACTIVE_LANGUAGE_POLICY\}\\n\$\{EXTREME_PERSONALITY_POLICY\}/);
});
