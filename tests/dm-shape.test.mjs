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
const context = vm.createContext({ Array, String });
vm.runInContext(pick(["normalizeDmAnswerShape"]), context);
const norm = (src, out) => JSON.parse(JSON.stringify(context.normalizeDmAnswerShape(src, out)));

test("R83: a DM written as {DM:{content}} / {type,content} / {message:{text}} keeps its line", () => {
  assert.equal(norm("dm", { language: "en", DM: { from: "a", to: "b", content: "You didn't follow me back." } }).text, "You didn't follow me back.");
  assert.equal(norm("dm", { type: "DM", from: "a", content: "Stop playing games." }).reply, "Stop playing games.");
  assert.equal(norm("dm", { message: { text: "hey" } }).text, "hey");
  assert.deepEqual(norm("dm", { text: "same", skip: false }), { text: "same", skip: false, reply: "same" });
  assert.deepEqual(norm("feed-post", { content: "x" }), { content: "x" }, "other sources untouched");
  assert.deepEqual(norm("dm", { skip: true }), { skip: true }, "a skip stays a skip");
});

test("R84: a COMMENT written by mistake is not turned into a DM; single comment replies under odd keys keep their line", () => {
  assert.equal(norm("dm", { type: "COMMENT", author: "a", target: "b", content: "x" }).text, undefined);
  assert.equal(norm("comments", { language: "en", response: "So what?" }).reply, "So what?");
  assert.equal(norm("comments", { language: "en", content: "Come on." }).comment, "Come on.");
  assert.equal(norm("comments", { language: "en", tandy_bowen_comments_reply: ["Come here."] }).reply, "Come here.");
  assert.equal(norm("comments", { language: "en", authorization: "REDACTED", session_id: "9a", response: "fire" }).reply, "fire");
  assert.deepEqual(norm("comments", { comments: [{ id: "a", text: "hi" }] }), { comments: [{ id: "a", text: "hi" }] });
});

test("R84: a DM the player asked for ('text me') is not held back by an open scene", () => {
  assert.match(source, /commentAgreedDm \? "" :/);
  assert.match(source, /if\(pausedFor&&!\/\^comment-dm-\/\.test\(String\(row\.trigger\|\|""\)\)\)continue;/);
});

test("R85: a failed picture never takes the DM text down with it", () => {
  assert.match(source, /async function generateAiChatSnap\(character, snapPrompt, addImage, media\) \{\n  try \{\n    return await generateAiChatSnapUnsafe\(/);
});
