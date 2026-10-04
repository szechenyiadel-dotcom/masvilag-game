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

const context = vm.createContext({ console: { info() {}, warn() {}, error() {} }, Math, Number, String, Array, Set, Object, JSON });
vm.runInContext(pick(["AI_GROUP_CHAT_SYSTEM_CAP", "AI_GROUP_CHAT_PROMPT_CAP", "extractText", "preservePromptEdges", "compactGroupChatSystem", "prepareAIRequestBody"]), context);
const prepare = (body, priority, source) => context.prepareAIRequestBody(body, priority, source);

const bond = "\n[[FULL_BOND_CONTEXT]]\n" + JSON.stringify({ rules: "r", currentBonds: { "a>b": "FAKE-DATING-ARRANGEMENT" }, profiles: "p".repeat(20000) }) + "\n[[/FULL_BOND_CONTEXT]]";
const request = (source) => ({
  source, system: "SYS ".repeat(18000),
  messages: [{ role: "user", content: "WORLD ".repeat(40000) + bond + "\n\n[[PROTECTED_TAIL]]\nwrite the replies now" }],
});
const size = (body) => body.system.length + body.messages.reduce((n, m) => n + m.content.length, 0);

test("A comment or a post that carries the bond context is shortened like any request, around the bond context and the newest beat", () => {
  for (const [source, priority] of [["comments", 100], ["feed-post", 60], ["comments", 20]]) {
    const out = prepare(request(source), priority, source);
    const text = out.messages.map((m) => m.content).join("\n");
    assert.ok(size(out) <= (priority >= 50 ? 102000 : 68000), source + "/" + priority + " is " + size(out));
    assert.ok(text.includes("FAKE-DATING-ARRANGEMENT") && text.includes("[[/FULL_BOND_CONTEXT]]"), source + ": the bond context survives");
    assert.ok(text.endsWith("write the replies now"), source + ": and so does the newest beat");
  }
});

test("A DM and a group chat with the bond context keep their whole prompt (the client budgets them); a scene keeps a roomy one", () => {
  for (const source of ["dm", "group-chat"]) {
    const body = request(source);
    assert.equal(prepare(body, 100, source), body, source + " is untouched");
  }
  const scene = prepare(request("scene"), 100, "scene");
  assert.ok(size(scene) > 100000 && size(scene) <= 180500, "scene: " + size(scene));
  assert.ok(scene.messages[0].content.includes("FAKE-DATING-ARRANGEMENT"));
});

test("Without the bond context nothing changes: the usual caps apply", () => {
  const plain = { source: "comments", system: "SYS ".repeat(18000), messages: [{ role: "user", content: "WORLD ".repeat(40000) + "\n\n[[PROTECTED_TAIL]]\nnow" }] };
  const out = prepare(plain, 100, "comments");
  assert.ok(out.system.length <= 22000 && out.messages[0].content.length <= 40000);
});
