import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { nicknameInfo } from "../src/nicknames.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const chars = [{ id: "brent", name: "Brent LaRusso", personality: "fuckboy" }, { id: "me", name: "Tandy Bowen" }, { id: "manon", name: "Manon Cartier" }, { id: "zoro", name: "Roronoa Zoro" }];
const w = { meId: "me", chars };
function sandbox() {
  const context = vm.createContext({ String, Array, RegExp, Object, console: { info() {} }, nicknameInfo,
    charById: (_w, id) => chars.find((c) => c.id === id) || null,
    isPlayerType: (_w, c) => /fuckboy/.test(c.personality || ""),
    stripInventedSharedPast: (_w, _id, text) => text });
  vm.runInContext(pick(["SCENE_PLAYER_TYPE_JEALOUSY_RE", "SCENE_VAGUE_REF_RE", "sceneKeepToThisStory"]), context);
  return context;
}
const LINE = "Brent freezes, his hand still on the doorknob. His knuckles turn white with the force of his grip. Slowly, he turns back to face Tandy, his eyes blazing with raw, unfiltered emotion. \"You... you think I'd let you go running after HER? After what she DID?\" His voice cracks, betraying the vulnerability beneath the fury. \"You're MINE, Tandy. Mine. And I won't fucking tolerate any other man putting his hands on you. Especially not that piece of shit.\"";

test("R128: the doorknob line from the screenshot keeps only what belongs to this scene", () => {
  const c = sandbox();
  const out = c.sceneKeepToThisStory(w, { turns: [{ text: "I'm leaving." }] }, "brent", LINE, null);
  assert.doesNotMatch(out, /HER\?|what she DID|piece of shit/, "nobody named — the jabs go");
  assert.doesNotMatch(out, /MINE|any other man/, "a fuckboy makes no 'mine' claims");
  assert.match(out, /^Brent freezes, his hand still on the doorknob\./);
  assert.match(out, /His voice cracks, betraying the vulnerability beneath the fury\.$/);
  assert.equal((out.match(/"/g) || []).length % 2, 0, "no half-open quote");
});

test("R128: a named third person anchors 'her'; someone else may say 'you're mine'", () => {
  const c = sandbox();
  const named = c.sceneKeepToThisStory(w, { turns: [{ text: "I'm going after Manon." }] }, "brent", "\"You think I'd let you go running after HER? After what she DID?\"", null);
  assert.match(named, /running after HER/);
  assert.match(c.sceneKeepToThisStory(w, { turns: [] }, "zoro", "\"You're mine now.\" He kisses her.", null), /You're mine now/);
  assert.match(source, /keptText = sceneKeepToThisStory\(w, scene, resolvedId, keptText, promptTurns\)/);
});
