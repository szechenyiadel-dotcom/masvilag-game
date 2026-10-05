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

function sandbox(t = 1000000) {
  const context = vm.createContext({ Math, Number, String, now: () => t, ensureSimState: (w) => (w.sim = w.sim || { queue: [] }) });
  vm.runInContext(pick(["simDropQueued", "simRetryOrDropQueued"]), context);
  return context;
}

test("A failed feed refresh after the player's post is retried (3 more times), not lost", () => {
  const c = sandbox();
  const action = { id: "a1", type: "world-full", source: "player-event", payload: { trigger: "player-post", postId: "p1" } };
  const w = { sim: { queue: [action] } };
  assert.equal(c.simRetryOrDropQueued(w, action), true);
  assert.equal(w.sim.queue.length, 1);
  assert.equal(action.failCount, 1);
  assert.equal(action.retryAt, 1000000 + 45000);
  c.simRetryOrDropQueued(w, action);
  c.simRetryOrDropQueued(w, action);
  assert.equal(action.failCount, 3);
  assert.equal(c.simRetryOrDropQueued(w, action), false, "gives up after 3 retries");
  assert.equal(w.sim.queue.length, 0);
});

test("Other failed actions are still dropped as before", () => {
  const c = sandbox();
  const dm = { id: "d1", type: "dm", source: "auto", payload: {} };
  const bgWorld = { id: "w1", type: "world-full", source: "auto", payload: {} };
  const w = { sim: { queue: [dm, bgWorld] } };
  assert.equal(c.simRetryOrDropQueued(w, dm), false);
  assert.equal(c.simRetryOrDropQueued(w, bgWorld), false);
  assert.equal(w.sim.queue.length, 0);
});

test("Both simulation lanes use the retry instead of a plain drop on failure", () => {
  assert.match(source, /else if \(laneOk\) simDropQueued\(n, laneAction\.id\);\s*else simRetryOrDropQueued\(n, laneAction\);/);
  assert.match(source, /else if \(ok\) simDropQueued\(n, queued\.id\);\s*else simRetryOrDropQueued\(n, queued\);/);
});
