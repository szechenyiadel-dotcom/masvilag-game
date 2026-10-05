import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module" });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const context = vm.createContext({ String, Number, Array, JSON, RegExp });
vm.runInContext(pick(["extractText", "buildGeminiPayload"]) + "\nthis.build = buildGeminiPayload;", context);
const body = (source, model, max_tokens) => ({ source, model, max_tokens, system: "s", messages: [{ role: "user", content: "hi" }] });

test("Gemini 3 comment requests think little and get room for the answer", () => {
  for (const src of ["comments", "player-post-comments", "comment-replies"]) {
    const cfg = context.build(body(src, "gemini-3.8-flash", 180)).generationConfig;
    assert.equal(cfg.thinkingConfig.thinkingLevel, "LOW", src);
    assert.equal(cfg.maxOutputTokens, 180 + 2048, src);
  }
});

test("Older Gemini models get the room but no Gemini 3 thinking setting", () => {
  const cfg = context.build(body("comments", "gemini-2.5-flash-lite", 900)).generationConfig;
  assert.equal(cfg.thinkingConfig, undefined);
  assert.equal(cfg.maxOutputTokens, 900 + 2048);
});

test("R91: every ordinary request gets the same thinking room; long-budget ones are sent as before", () => {
  for (const src of ["feed-post", "dm", "scene", ""]) {
    const cfg = context.build(body(src, "gemini-3.8-flash", 1500)).generationConfig;
    assert.deepEqual(JSON.parse(JSON.stringify(cfg)), { maxOutputTokens: 1500 + 2048, thinkingConfig: { thinkingLevel: "LOW" } }, src || "(none)");
  }
  const long = context.build(body("sheet-summary", "gemini-3.8-flash", 9000)).generationConfig;
  assert.deepEqual(JSON.parse(JSON.stringify(long)), { maxOutputTokens: 9000 });
});
