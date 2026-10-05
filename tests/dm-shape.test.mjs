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
  assert.match(source, /async function generateAiChatSnap\(character, snapPrompt, addImage, media\) \{\n  if \(Date\.now\(\) < CHAT_SNAP_OFF_UNTIL\) return null;\n  try \{\n    return await generateAiChatSnapUnsafe\(/);
  assert.match(source, /spontaneousImagePrompt && false\n/, "R86: unprompted DMs carry no picture");
  assert.match(source, /\(explicitImageRequest \|\| playerSentImage\)/, "R86: a picture only when the player sent or asked for one");
});

test("R89: comments / posts / DMs keep only the typed line, never roleplay narration", () => {
  const ctx = vm.createContext({ String, RegExp, Array, charById: (w, id) => ({ feng: { name: "Feng Xiao" } }[id]) });
  vm.runInContext(pick(["stripSocialRoleplayNarration"]), ctx);
  const s = (t) => ctx.stripSocialRoleplayNarration({}, "feng", t);
  assert.equal(s('Feng stares at the comment and smirks. "Typical. Can\'t even handle one without getting a response."'), "Typical. Can't even handle one without getting a response.");
  assert.equal(s("*leans back* You wish."), "You wish.");
  assert.equal(s("Feng smirks."), "");
  assert.equal(s('She said "no" and I believed her.'), 'She said "no" and I believed her.', "a quote inside an ordinary sentence stays");
  assert.equal(s("Typical. Can't even handle one."), "Typical. Can't even handle one.");
  assert.equal(s('"Maybe? Then you better start acting like one."'), "Maybe? Then you better start acting like one.", "R94: a wholly quoted DM loses its quotes");
  assert.match(source, /never push to make it real/, "R94: the fake-dating lane forbids pushing to make it real");
  assert.match(source, /casanova\|lothario/, "R94: broader player-type words");
  assert.match(source, /\/\\\*\[\^\*\]\+\\\*\/\.test\(String\(t \|\| ""\)\) \? requestedReplyRaw : stripSocialRoleplayNarration/);
});

test("R90: 'text me' DMs are queued even though the saved world has no meId", () => {
  const body = pick(["enqueueCommentAgreedDm"]);
  assert.match(body, /const meId = \(w && w\.meId\) \|\| \(info && info\.playerId\) \|\| "";/);
  assert.match(source, /enqueueCommentAgreedDm\(n, botId, \{ kind: "request", playerId: freshActorId,/);
  assert.match(source, /STAY IN THIS LANE — /);
});

test("R95: fake dating stays secret in public comments and posts", () => {
  const ctx = vm.createContext({ String, RegExp });
  vm.runInContext(pick(["keepFakeDatingSecretInPublic"]), ctx);
  const k = (t) => ctx.keepFakeDatingSecretInPublic(t);
  assert.equal(k("Well, well, if it isn't the fake girlfriend. How's that going for you, Tandy?"), "Well, well, if it isn't the girlfriend. How's that going for you, Tandy?");
  assert.equal(k("Still pretending to date him?"), "Still dating him?");
  assert.equal(k("Hogy megy a kamu barátnősködés?"), "Hogy megy a barátnősködés?");
  assert.equal(k("Nice shot, babe."), "Nice shot, babe.");
  assert.match(source, /keepFakeDatingSecretInPublic\(args\[2\]\)/);
  assert.match(source, /keepFakeDatingSecretInPublic\(stripSocialRoleplayNarration\(n, author, p\.text\)\)/);
});

test("R96: a scene answer with its lines under another key keeps them", () => {
  const ctx = vm.createContext({ String, Array, Object });
  vm.runInContext(pick(["normalizeSceneAnswerShape"]), ctx);
  const n = (o) => JSON.parse(JSON.stringify(ctx.normalizeSceneAnswerShape(o)));
  assert.deepEqual(n({ dialogue: [{ character: "Brent", line: "Took you long enough." }] }).turns.map((t) => [t.id, t.text]), [["Brent", "Took you long enough."]]);
  assert.deepEqual(n({ scene: { turns: [{ id: "narrator", text: "Rain on the glass." }] } }).turns.map((t) => t.id), ["narrator"]);
  assert.deepEqual(n([{ speaker: "Feng", content: "Sit." }]).turns.map((t) => t.text), ["Sit."]);
  assert.deepEqual(n({ turns: [{ name: "Feng", message: "Sit." }] }).turns.map((t) => [t.id, t.text]), [["Feng", "Sit."]]);
  const summary = { summary: "done", memories: [] };
  assert.deepEqual(n(summary), summary, "a scene-closing summary is untouched");
  assert.match(source, /reportClientDiag\("scene-stuck"/);
});
