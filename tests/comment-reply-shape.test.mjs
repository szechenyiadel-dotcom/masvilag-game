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

const people = { brent: "Brent LaRusso", manon: "Manon Cartier", richie: "Richie Tozier", me: "Tandy Bowen" };
const w = {};
function sandbox() {
  const context = vm.createContext({
    String, Array, Object,
    findChar: (_w, key) => {
      const k = String(key || "").trim().toLowerCase();
      if (!k) return "";
      return Object.keys(people).find((id) => id === k || people[id].toLowerCase() === k || people[id].split(" ")[0].toLowerCase() === k) || "";
    },
    isHuman: (_w, id) => id === "me",
  });
  vm.runInContext(pick(["commentReplyAnswerAsComments"]), context);
  return context;
}
const rows = (out) => JSON.parse(JSON.stringify(out.comments || []));

test("R118: a one-line reply answer becomes the expected responder's reply", () => {
  const c = sandbox();
  for (const out of [
    { language: "en", reply: "Stay out of Tandy's business, Tozier." },
    { language: "en", comment: "Stay out of Tandy's business, Tozier." },
    { language: "en", content: "Stay out of Tandy's business, Tozier." },
    { language: "en", text: "Stay out of Tandy's business, Tozier." },
  ]) assert.deepEqual(rows(c.commentReplyAnswerAsComments(w, out, "brent")), [{ id: "brent", text: "Stay out of Tandy's business, Tozier." }], Object.keys(out)[1]);
});

test("R118: 'Name: \"…\"' gives the line to the named character, without the name", () => {
  const c = sandbox();
  assert.deepEqual(rows(c.commentReplyAnswerAsComments(w, { response: "Manon Cartier: \"You're doing the thing with your hands again.\"" }, "brent")), [{ id: "manon", text: "You're doing the thing with your hands again." }]);
  assert.deepEqual(rows(c.commentReplyAnswerAsComments(w, { comment: "Note: you're cute" }, "brent")), [{ id: "brent", text: "Note: you're cute" }], "a prefix that is nobody stays part of the line");
  assert.equal(c.commentReplyAnswerAsComments(w, { comment: "Tandy Bowen: \"hi\"" }, "brent").comments, undefined, "never a line for the player");
});

test("R118: rows naming their writer under author get an id; good rows stay", () => {
  const c = sandbox();
  const out = c.commentReplyAnswerAsComments(w, { comments: [
    { comment_id: "x", author: "Richie Tozier", target: "Tandy Bowen", text: "lookin hot" },
    { id: "brent", text: "back off" },
  ] }, "manon");
  assert.equal(rows(out)[0].id, "richie");
  assert.equal(rows(out)[1].id, "brent");
  assert.match(source, /out = commentReplyAnswerAsComments\(w, out, \(forcedResponder \|\| directResponder \|\| cast\[0\] \|\| \{\}\)\.id \|\| ""\);/);
});
