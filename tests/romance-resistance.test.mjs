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

const chars = [
  { id: "max", name: "Maxwell Rourke", personality: "principled, protective sensei, disciplined" },
  { id: "brent", name: "Brent LaRusso", personality: "cocky fuckboy, impulsive" },
  { id: "eli", name: "Eli Moskowitz", personality: "guarded, trust issues" },
  { id: "me", name: "Lennon Grant", human: true },
];
const rels = { "max>me": { score: 70, bond: "Sensei / Protector" }, "brent>me": { score: 40, bond: "fake dating" }, "eli>me": { score: -20, bond: "rival" } };
const flirts = { max: { allowed: true, crushActive: true, secretCrush: true }, brent: { allowed: true, crushActive: true, naturallyFlirty: true }, eli: { allowed: false } };
function sandbox() {
  const context = vm.createContext({ String, Array, Number, Object, RegExp,
    charById: (_w, id) => chars.find((c) => c.id === id) || null,
    isHuman: (_w, id) => id === "me",
    nameOfIn: (_w, id) => (chars.find((c) => c.id === id) || {}).name,
    getRel: (_w, a, b) => rels[a + ">" + b] || {}, EMPTY_REL: {},
    flirtPermissionState: (_w, a) => flirts[a],
    characterIsSenseiRank: (_w, c) => c.id === "max", speakerBelongsUnder: () => true,
    isPlayerType: (_w, c) => /fuckboy/.test(c.personality || ""),
  });
  vm.runInContext(pick(["RESIST_PRINCIPLED_RE", "RESIST_GUARDED_RE", "RESIST_EASY_RE", "RESIST_AUTHORITY_RE", "RESIST_TOGETHER_RE", "RESIST_INTOX_RE", "RESIST_ADVANCE_RE", "romanceResistanceLevel", "romanceResistanceCard", "roleplayResistanceBlock"]), context);
  return context;
}

test("R126: a principled sensei resists his drunk student; a fuckboy is easy; a rival is closed", () => {
  const c = sandbox();
  assert.equal(c.romanceResistanceLevel({}, "max", "me").level, "very high");
  assert.equal(c.romanceResistanceLevel({}, "brent", "me").level, "low");
  assert.equal(c.romanceResistanceLevel({}, "eli", "me").level, "closed");
  const card = c.romanceResistanceCard({}, "max", "me", ["She is drunk and stumbles."], ["*she kisses him*", "*pulls his shirt off*"]);
  assert.match(card, /VERY HIGH/);
  assert.match(card, /advances so far: 2/);
  assert.match(card, /DRUNK right now/);
  assert.match(c.romanceResistanceCard({}, "brent", "me", [], []), /ONE step at a time/);
});

test("R126: the scene and DM prompts carry the resistance lines", () => {
  const c = sandbox();
  const block = c.roleplayResistanceBlock({ meId: "me" }, { turns: [{ authorId: "me", text: "*kisses him*" }] }, [chars[0], chars[1]]);
  assert.match(block, /nobody gives themself too easily/);
  assert.match(block, /Maxwell Rourke toward Lennon Grant/);
  assert.match(block, /Brent LaRusso toward Lennon Grant/);
  assert.equal((source.match(/\$\{roleplayResistanceBlock\(w, promptScene, cast\)\}/g) || []).length, 2);
  assert.match(source, /return romanceResistanceCard\(requestWorld, c\.id, requestWorld\.meId/);
});
