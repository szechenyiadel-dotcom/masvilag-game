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

function app(lang = "en") {
  const context = vm.createContext({ String, Number, Array, Set, Object, RegExp, asLang: (x) => (x === "hu" ? "hu" : "en") });
  vm.runInContext("let CURRENT_LANG = " + JSON.stringify(lang) + ";\n" + pick([
    "HU_FUNCTION_WORDS", "EN_FUNCTION_WORDS", "stringLooksHungarian", "generatedStringsLookHungarian", "generatedVisibleStrings",
    "generatedTextLooksHungarian", "validateGeneratedLanguage", "activeLanguageHalf", "HU_STOPWORDS", "looksHungarianText",
  ]), context);
  return context;
}

test("A short Hungarian line inside an English answer is caught; English with names is not", () => {
  const c = app();
  for (const text of ["megint az a hely? kreatív vagy.", "dühös rá", "nem érek rá.", "ott leszek! hozok sütit 🧁", "kedves, apai, jóindulatú", "féltékeny lett"]) {
    assert.equal(c.stringLooksHungarian(text), true, text);
  }
  for (const text of ["See you at the mill, Ádám Kovács!", "Zsófi and Ádám are coming", "love this café", "@szécsényi.adél you up?", "José is the best", "ok", "Björk on repeat"]) {
    assert.equal(c.stringLooksHungarian(text), false, text);
  }
});

test("The first English answer with one Hungarian comment is sent back once; after the strict retry it is accepted", () => {
  const c = app();
  const answer = { comments: [{ id: "a", text: "love this" }, { id: "b", text: "megint az a hely? kreatív vagy." }] };
  assert.equal(c.validateGeneratedLanguage(answer, "en", false), false, "first answer goes back for one strict retry");
  assert.equal(c.validateGeneratedLanguage(answer, "en", true), true, "after that the display layer translates the line");
  assert.equal(c.validateGeneratedLanguage({ comments: [{ id: "a", text: "love this, see you there" }] }, "en", false), true);
  assert.equal(c.validateGeneratedLanguage({ comments: [{ id: "b", text: "megint az a hely?" }] }, "hu", false), true, "Hungarian worlds unchanged");
  assert.match(source, /validateGeneratedLanguage\(parsed, lang, strictMode\)/);
});

test("The display layer translates Hungarian chips and labels", () => {
  const c = app();
  assert.equal(c.looksHungarianText("kedves, apai, jóindulatú"), true);
  assert.equal(c.looksHungarianText("Nora új képet posztolt, Mia nem lájkolta."), true);
  assert.equal(c.looksHungarianText("Ryan Cole"), false);
  assert.equal(c.looksHungarianText("love this so much"), false);
});

test("Server notices written as 'English / magyar' show only the active half", () => {
  const msg = "No usable free AI provider right now; waiting instead of using paid capacity / Nincs használható ingyenes AI-szolgáltató, várunk.";
  assert.equal(app("en").activeLanguageHalf(msg), "No usable free AI provider right now; waiting instead of using paid capacity");
  assert.equal(app("hu").activeLanguageHalf(msg), "Nincs használható ingyenes AI-szolgáltató, várunk.");
  assert.equal(app("en").activeLanguageHalf("HTTP 500"), "HTTP 500");
});

test("Every AI request in an English app carries the English stamp at both ends of the system text", async () => {
  const policySource = fs.readFileSync(new URL("../src/socialWorldPolicy.js", import.meta.url), "utf8");
  const sent = [];
  const window = { location: { href: "https://example.test/" }, __MASVILAG_ACTIVE_LANG: "en", fetch: async (input, init) => { sent.push(JSON.parse(init.body)); return {}; } };
  const context = vm.createContext({ window, URL, Headers, JSON, String, Array, Object });
  vm.runInContext(policySource.replace(/^export .*$/gm, ""), context);
  await window.fetch("https://example.test/ai/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "Írj kommentet a posztra.", messages: [] }) });
  const system = sent[0].system;
  assert.ok(system.startsWith("[MASVILAG_ACTIVE_LANGUAGE_EN]"), "stamp at the start");
  assert.ok(system.trim().endsWith("not even one word or one line. Names, @handles, #tags and verbatim quotes stay as they are."), "stamp at the end");
  assert.match(system, /Írj kommentet a posztra\./);
  window.__MASVILAG_ACTIVE_LANG = "hu";
  await window.fetch("https://example.test/ai/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: "X", messages: [] }) });
  assert.doesNotMatch(sent[1].system, /MASVILAG_ACTIVE_LANGUAGE_EN/, "Hungarian app: no English stamp");
});

test("The app publishes its language to the request layer, and the character brief follows it", () => {
  assert.match(source, /CURRENT_LANG = lang;\n  try \{ if \(typeof window !== "undefined"\) window\.__MASVILAG_ACTIVE_LANG = lang; \}/);
  assert.match(source, /\{"brief":"\$\{CURRENT_LANG === "en" \? "the brief, written in English" : "a kivonat magyarul"\}"\}/);
});
