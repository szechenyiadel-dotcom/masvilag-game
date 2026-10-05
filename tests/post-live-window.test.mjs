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

test("A post is live for 6 minutes, then quiet", () => {
  const t = 1e12;
  const context = vm.createContext({ Number, Boolean, now: () => t });
  vm.runInContext(pick(["LIVE_WORLD_FRESH_COMMENT_WINDOW_MS", "postStillLive"]), context);
  assert.equal(context.postStillLive({ ts: t - 5 * 60e3 }), true);
  assert.equal(context.postStillLive({ ts: t - 6 * 60e3 }), true);
  assert.equal(context.postStillLive({ ts: t - 6 * 60e3 - 1000 }), false);
  assert.equal(context.postStillLive(null), false);
});

test("Comments, replies, the player's open threads and coverage retries all stop with the post's live window", () => {
  assert.match(source, /if \(now\(\) - \(Number\(comment\.ts\) \|\| 0\) > LIVE_WORLD_REPLY_WINDOW_MS\) continue;\n      \/\* R76[^\n]*\n      if \(!postStillLive\(post\)\) continue;/);
  assert.match(source, /\/\* R76: no reply once the post's 6 live minutes are over \*\/\n    if \(!postStillLive\(post\)\) \{\n      return null;/);
  assert.match(pick(["findUnanswered"]), /if \(!postStillLive\(po, tsNow\)\) \{\n        continue;/);
  assert.match(pick(["guaranteedCommentCoverageCandidate"]), /if \(!postStillLive\(post, ts\)\) return false;/);
  assert.match(source, /return !postCommentCoverageState\(w, post\)\.complete && postStillLive\(post\);/);
});

test("A comment is a repeat of the character's DM/scene line only when it is (nearly) the same sentence", () => {
  const lines = { ian: ["See you there, Tandy, don't be late tonight.", "I keep things professional, you know that."] };
  const context = vm.createContext({ String, Number, Array, Set, Math,
    recentUtterancesFor: (w, id) => lines[id] || [],
  });
  vm.runInContext(pick(["REP_WORD_MIN", "REP_STOPWORDS", "normUtterance", "wordSet", "jaccard", "isRepeatedUtteranceForComment"]), context);
  assert.equal(context.isRepeatedUtteranceForComment({}, "ian", "Party time? I'm all for it. See you there, Tandy."), false);
  assert.equal(context.isRepeatedUtteranceForComment({}, "ian", "See you there, Tandy, don't be late tonight!"), true);
  assert.match(source, /if \(isRepeatedUtteranceForComment\(w, id, t\)\) \{ reportClientDiag\("comment-drop"/);
  assert.match(source, /app\.post|client-diag/);
});
