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

function sandbox() {
  const chars = [{ id: "brent", name: "Brent LaRusso" }, { id: "me", name: "Tandy Bowen" }];
  const context = vm.createContext({ String, Array, Set, RegExp, Boolean,
    worldLanguage: () => "en", identityPronouns: () => "she/her",
    charById: (_w, id) => chars.find((c) => c.id === id) || null });
  vm.runInContext(pick(["splitQuotedSpeech", "repairRoleplayNarrationPov"]), context);
  return context;
}

test("R131: speech in single quotes keeps its own 'me' — Brent's line from the screenshot", () => {
  const c = sandbox();
  const line = "Brent's grip on Tandy's arms tightens painfully at her tears. 'Tears? You think I give a fuck about your tears?' He spits the words. 'You fucking used me, Tandy. And now you think you can just throw me away like some piece of trash?'";
  const out = c.repairRoleplayNarrationPov({ meId: "me" }, "brent", line);
  assert.match(out, /You fucking used me, Tandy\. And now you think you can just throw me away/);
  assert.match(out, /^Brent's grip on Tandy's arms/, "apostrophes in narration are not quotes");
});

test("R131: narration is still repaired; contractions inside speech do not end it", () => {
  const c = sandbox();
  assert.equal(c.repairRoleplayNarrationPov({ meId: "me" }, "brent", "He pulls me closer. 'Don't you dare leave me.'"), "He pulls her closer. 'Don't you dare leave me.'");
  assert.equal(c.repairRoleplayNarrationPov({ meId: "me" }, "brent", "He grabs my wrist. \"Stay with me.\""), "He grabs her wrist. \"Stay with me.\"");
  assert.deepEqual([...c.splitQuotedSpeech("a 'b c' d")], ["a ", "'b c'", " d"]);
  assert.deepEqual([...c.splitQuotedSpeech("the boys' bikes and Tandy's car")], ["the boys' bikes and Tandy's car"]);
});
