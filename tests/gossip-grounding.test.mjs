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

const chars = [
  { id: "tandy", name: "Tandy Bowen" }, { id: "brent", name: "Brent LaRusso" },
  { id: "ng", name: "Park Nam-gyu" }, { id: "niragi", name: "Suguru Niragi" }, { id: "eli", name: "Eli Moskowitz", nick: "Hawk" },
];
const groups = { brent: "Miyagi-Do", ng: "Iron Dragons", eli: "Cobra Kai", tandy: "", niragi: "" };
const rels = { "eli>tandy": { bond: "ex-boyfriend" } };
const w = { chars };
function sandbox() {
  const context = vm.createContext({
    String, Array, Set, RegExp, Object, console: { info() {}, warn() {} }, nicknameInfo,
    charById: (_w, id) => chars.find((c) => c.id === id) || null,
    namedPeopleInText: (_w, txt) => chars.filter((c) => [c.name, c.name.split(" ")[0], c.name.split(" ").slice(-1)[0], c.nick].filter(Boolean).some((n) => txt.includes(n))).map((c) => c.id),
    getRel: (_w, a, b) => rels[a + ">" + b] || {},
    fakeDatingBehaviorCard: (_w, a, b) => ((a === "tandy" && b === "brent") || (a === "brent" && b === "tandy") ? "FAKE DATING" : ""),
    identityCanonFor: (_w, id) => (groups[id] !== undefined ? { group: groups[id], affiliations: groups[id] ? [{ name: groups[id] }] : [] } : null),
  });
  vm.runInContext(pick(["keepFakeDatingSecretInPublic", "GOSSIP_FAKE_REVEAL_RE", "GOSSIP_EX_LABEL_RE", "gossipPairIsEx", "groundPublicGossip"]), context);
  return context;
}

test("R123: the gossip post from the screenshot keeps only what is true", () => {
  const c = sandbox();
  const post = "Tandy Bowen and Brent LaRusso were all over each other at the dojo party. Brent never left her side.\n\nTheir 'relationship' initially began as a ruse to keep Nam-gyu at bay. Shady ex-flame Suguru Niragi was watching Tandy all night. Iron Dragons member Brent LaRusso threw the first punch. Park Nam-gyu of the Iron Dragons looked furious. Eli, Tandy's ex, just laughed.";
  const out = c.groundPublicGossip(w, post, "Tandy's fake boyfriend snaps");
  assert.ok(out, "most of it stays, so it is published");
  assert.doesNotMatch(out.text, /ruse/, "the fake deal stays secret");
  assert.doesNotMatch(out.text, /ex-flame/, "Niragi was never her ex");
  assert.doesNotMatch(out.text, /Iron Dragons member Brent/, "Brent is Miyagi-Do");
  assert.match(out.text, /Park Nam-gyu of the Iron Dragons/, "Nam-gyu really is Iron Dragons");
  assert.match(out.text, /Eli, Tandy's ex/, "a real ex stays");
  assert.match(out.text, /\n\n/, "paragraphs kept");
  assert.equal(out.headline, "", "a headline that reveals the deal is dropped");
});

test("R123: a post that is mostly invented is not published", () => {
  const c = sandbox();
  assert.equal(c.groundPublicGossip(w, "It was all a ruse. Brent is a fake boyfriend. Niragi is her ex-flame. Tandy left early.", ""), null);
  assert.match(source, /const grounded = groundPublicGossip\(w, out\.text, out\.headline\);/);
});
