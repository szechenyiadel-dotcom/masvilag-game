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

function tail(lang, turns, playerText) {
  const context = vm.createContext({
    String, Array, PROTECTED_TAIL_MARKER: "[[PROTECTED_TAIL]]",
    worldLanguage: () => lang, charById: (w, id) => ({ zoro: { name: "Roronoa Zoro" } }[id] || null),
  });
  vm.runInContext(pick(["roleplayLatestBeatTail", "roleplayReplyRules"]), context);
  return context.roleplayLatestBeatTail({ meId: "me", player: { name: "Tandy" } }, turns, playerText);
}

test("The newest moment of a scene is followed by the rules that make a turn answer the player and stay in the scene", () => {
  const text = tail("en", [{ authorId: "zoro", text: "Not games." }], "so if im not your type, why am i here?");
  assert.match(text, /^\n\n\[\[PROTECTED_TAIL\]\]/);
  assert.match(text, /Roronoa Zoro: Not games\./);
  assert.match(text, /answer exactly this/);
  assert.match(text, /MAKE SENSE — HARD RULES FOR THIS TURN/);
  assert.match(text, /Answer what the player just said or did, directly and in character/);
  assert.match(text, /Never bring in a person, a place or an event that is not there/);
  assert.match(text, /one to three sentences of speech/);
  assert.ok(text.trimEnd().endsWith("sentences of speech and at most one action beat, unless the player's line really calls for more. Every sentence must be something the other person can understand and respond to."), "the rules are the last thing the model reads");
  assert.ok(text.indexOf("so if im not your type") < text.indexOf("MAKE SENSE"), "after the player's line");
});

test("In a Hungarian world the rules are Hungarian", () => {
  const text = tail("hu", [], "mit keresek itt?");
  assert.match(text, /ÉRTELMES LEGYEN — KEMÉNY SZABÁLYOK/);
  assert.match(text, /Maradj ebben a jelenetben/);
  assert.ok(!/MAKE SENSE/.test(text));
});
