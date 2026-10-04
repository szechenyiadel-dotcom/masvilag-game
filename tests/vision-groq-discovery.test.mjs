import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createVisionRunner, DEFAULT_GROQ_VISION_MODEL, GROQ_VISION_LIKE, groqVisionRank } from "../server/vision.js";

/*
 * Groq vision with a stale / inaccessible model id.
 * Production log that started this: "[vision] groq vision disabled for an hour: The model
 * 'meta-llama/llama-4-scout-17b-16e-instruct' does not exist or you do not have access to it."
 * A stale hard-coded id must not take the whole Groq provider out for an hour.
 */

const NOW = 7_000_000;
const image = () => ({ mimeType: "image/jpeg", base64: "B".repeat(800), dataUrl: "data:image/jpeg;base64," + "B".repeat(800) });
const answer = (status, payload, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => payload, headers: { get: (name) => headers[name.toLowerCase()] ?? null } });
const groqOk = (text = "A girl posing in a dojo, smiling.") => answer(200, { choices: [{ message: { content: text } }], usage: { total_tokens: 1200 } });
const geminiOk = (text = "A street at night.") => answer(200, { candidates: [{ content: { parts: [{ text }] } }] });
const gone = (model = DEFAULT_GROQ_VISION_MODEL) => answer(404, { error: { message: `The model \`${model}\` does not exist or you do not have access to it.`, code: "model_not_found" } });
const noImages = () => answer(400, { error: { message: "This model does not support image input" } });
const quota = () => answer(429, { error: { message: "Rate limit reached. Please try again in 30s." } }, { "retry-after": "30" });
const MAVERICK = "meta-llama/llama-4-maverick-17b-128e-instruct";
const NEW_SCOUT = "meta-llama/llama-4-scout-17b-16e-instruct-2026";
const LIST = (ids) => answer(200, { data: ids.map((id) => ({ id, active: true })) });

function setup(handler, extra = {}) {
  const calls = [];
  const warnings = [];
  const clock = { t: NOW };
  const runner = createVisionRunner({
    fetchFn: async (url, options) => {
      const host = new URL(url).host;
      const key = (options.headers.Authorization || "").replace("Bearer ", "") || options.headers["x-goog-api-key"] || "";
      const entry = { url, host, key, method: options.method, body: options.body ? JSON.parse(options.body) : null };
      calls.push(entry);
      return handler(entry);
    },
    groqKeys: [{ slot: "groq", key: "g1" }, { slot: "groq2", key: "g2" }],
    geminiFreeKeys: ["f2", "f3"], geminiPaidKey: "paid", now: () => clock.t,
    log: { warn: (line) => warnings.push(String(line)) },
    ...extra,
  });
  const groqChats = () => calls.filter((c) => c.host === "api.groq.com" && c.method === "POST");
  return { runner, calls, clock, warnings, groqChats };
}

test("Stale default model: the Groq model list is fetched with the same key and the SAME picture is retried with a current vision model", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return LIST(["llama-3.3-70b-versatile", "whisper-large-v3", MAVERICK]);
    return c.body.model === DEFAULT_GROQ_VISION_MODEL ? gone() : groqOk();
  });
  const result = await t.runner.analyze({ image: image(), prompt: "Describe it." });
  assert.deepEqual([result.ok, result.provider, result.model], [true, "groq", MAVERICK]);
  const chats = t.groqChats();
  assert.equal(chats.length, 2, "one try with the stale model, one with the discovered model");
  assert.equal(chats[0].body.messages[0].content[1].image_url.url, chats[1].body.messages[0].content[1].image_url.url, "the same image is retried");
  assert.equal(t.calls.find((c) => c.method === "GET").key, "g1", "the model list is asked with the same key");
  assert.equal(t.runner.state().groqDisabledUntil, 0, "Groq vision is NOT disabled for an hour");
  assert.ok(!t.warnings.some((w) => /disabled for an hour/.test(w)));
  assert.equal(t.runner.state().discovered.model, MAVERICK, "the working model is cached");
});

test("The discovered model is used first next time, and the second key can use it too", async () => {
  let g1Quota = false;
  const t = setup((c) => {
    if (c.method === "GET") return LIST([NEW_SCOUT]);
    if (g1Quota && c.key === "g1") return quota();
    return c.body.model === DEFAULT_GROQ_VISION_MODEL ? gone() : groqOk();
  });
  assert.equal((await t.runner.analyze({ image: image(), prompt: "p" })).model, NEW_SCOUT);
  t.calls.length = 0;
  g1Quota = true;
  const second = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([second.provider, second.model], ["groq2", NEW_SCOUT], "GROQ_API_KEY_2 takes over with the discovered model");
  assert.deepEqual(t.groqChats().map((c) => [c.key, c.body.model]), [["g1", NEW_SCOUT], ["g2", NEW_SCOUT]]);
  assert.ok(!t.calls.some((c) => c.method === "GET"), "no new model search was needed");
});

test("If the first discovered candidate cannot read images either, the next candidate is tried", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return LIST([NEW_SCOUT, MAVERICK]);
    if (c.body.model === DEFAULT_GROQ_VISION_MODEL) return gone();
    if (c.body.model === NEW_SCOUT) return noImages();
    return groqOk();
  });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.provider, result.model], ["groq", MAVERICK]);
  assert.deepEqual(t.groqChats().map((c) => c.body.model), [DEFAULT_GROQ_VISION_MODEL, NEW_SCOUT, MAVERICK]);
  assert.equal(t.runner.state().groqDisabledUntil, 0);
});

test("Key 1 has no access to any vision model but key 2 does: key 2 reads the picture, Groq is not disabled", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return LIST(["llama-3.1-8b-instant"]);
    return c.key === "g1" ? gone() : groqOk();
  });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.provider, result.model], [true, "groq2", DEFAULT_GROQ_VISION_MODEL]);
  assert.equal(t.runner.state().groqDisabledUntil, 0);
});

test("A model problem on key 1 while key 2 is only rate-limited does not disable Groq; Gemini reads this picture", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return LIST(["llama-3.1-8b-instant"]);
    if (c.host === "api.groq.com") return c.key === "g1" ? gone() : quota();
    return geminiOk();
  });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(result.provider, "gemini");
  assert.equal(t.runner.state().groqDisabledUntil, 0, "a quota problem is not 'no vision model'");
});

test("Only when no key has ANY usable vision model does Groq stand down (and free Gemini keeps reading)", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return LIST(["llama-3.1-8b-instant", "whisper-large-v3"]);
    return c.host === "api.groq.com" ? gone() : geminiOk();
  });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(result.provider, "gemini");
  assert.ok(t.runner.state().groqDisabledUntil > NOW);
  assert.ok(t.warnings.some((w) => /no vision-capable Groq model is available to any key/.test(w)));
});

test("Both Groq keys rate-limited: the free Gemini fallback reads the post image", async () => {
  const t = setup((c) => (c.host === "api.groq.com" ? quota() : geminiOk("Two friends at a party.")));
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.provider, result.text], [true, "gemini", "Two friends at a party."]);
  assert.ok(!t.calls.some((c) => c.key === "paid"), "the paid key is not used");
});

test("Vision-capable ids are recognised and Llama 4 Scout / Maverick come first", () => {
  for (const id of [MAVERICK, NEW_SCOUT, "llama-3.2-90b-vision-preview", "qwen/qwen2.5-vl-32b-instruct"]) assert.ok(GROQ_VISION_LIKE.test(id), id);
  for (const id of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"]) assert.ok(!GROQ_VISION_LIKE.test(id), id);
  const sorted = ["llama-3.2-90b-vision-preview", MAVERICK, NEW_SCOUT].sort((a, b) => groqVisionRank(a) - groqVisionRank(b));
  assert.deepEqual(sorted, [NEW_SCOUT, MAVERICK, "llama-3.2-90b-vision-preview"]);
});

/* ---------- the PLAYER POST image takes this very path ---------- */

const APP = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const PROXY = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");

test("Post image path: upload/post → analyzeImageDataUrl → /ai/vision → Groq-first runner → imageDescription → post context", () => {
  /* the player's post reads its picture through analyzeImageDataUrl, patiently */
  assert.match(APP, /readImagePatiently\(\(\) => analyzeImageDataUrl\(/);
  assert.match(APP, /imageDescription = read\.text;/);
  assert.match(APP, /imageAnalysisPending = read\.pending && !read\.text;/);
  assert.match(APP, /imageDescription,\s*\n\s*\.\.\.\(imageAnalysisPending \? \{ imageAnalysisPending: true \} : \{\}\)/);
  /* analyzeImageDataUrl posts to /ai/vision */
  const analyze = APP.slice(APP.indexOf("async function analyzeImageDataUrl("), APP.indexOf("async function requestAiImageProxy("));
  assert.match(analyze, /apiJson\("\/ai\/vision"/);
  /* the server route runs the vision runner whose first provider is Groq key 1, then key 2 */
  assert.match(PROXY, /app\.post\("\/ai\/vision"/);
  assert.match(PROXY, /visionRunner\(\)\.analyze\(/);
  assert.match(PROXY, /\{ slot: "groq", key: GROQ_API_KEY \},\s*\n\s*\{ slot: "groq2", key: GROQ_API_KEY_2 \}/);
  assert.match(PROXY, /groqModel: String\(process\.env\.GROQ_VISION_MODEL \|\| DEFAULT_GROQ_VISION_MODEL\)\.trim\(\)/);
  /* the description feeds the post context the commenters see */
  const ctx = APP.slice(APP.indexOf("function playerPostCommentPostContext(w, post) {"));
  assert.match(ctx.slice(0, 2500), /const imageDescription = String\(\s*post && \(\s*post\.imageDescription/);
  assert.match(ctx.slice(0, 4000), /imageDescription,\s*\n\s*imageDescriptionStatus:/);
});

test("Post image that could not be read yet: pending flag, background retry, and a late description invalidates socialMeaning", () => {
  assert.match(APP, /nextPostToRead\(/);
  assert.match(APP, /scheduleVisionRetry\(visionErr/);
  const settle = APP.slice(APP.indexOf("const description = String(vision || \"\").trim();"));
  assert.match(settle.slice(0, 500), /target\.imageDescription = description;\s*\n\s*delete target\.socialMeaning;/);
  assert.match(settle.slice(0, 600), /delete target\.imageAnalysisPending;/);
});

/* ---------- regression acceptance: what must not change ---------- */

test("Regression: player post → feed refresh with 3–4 posts, queued at once next to the comments", () => {
  assert.match(APP, /FEED_MIN_POSTS: 3,/);
  assert.match(APP, /FEED_MAX_POSTS: 4,/);
  const signal = APP.slice(APP.indexOf('if (event.type === "player-post" && event.postId) {'));
  assert.match(signal.slice(0, 2500), /"player-post-comments-guarantee"/);
  assert.match(signal.slice(0, 6000), /`event-world-after-post:\$\{event\.postId\}`/);
});

test("Regression: public post / comment / reply are observable social events; AI↔AI jealousy, rivalry and defending stay", () => {
  assert.match(APP, /function simsSocialCanObserveEvent\(w, observerId, event\)/);
  assert.match(APP, /if \(visibility === "public"\) return true;/);
  assert.match(APP, /function applyObservedRomanticThirdPartyConsequences\(w, event\)/);
  assert.match(APP, /function applyObservedConflictThirdPartyConsequences\(w, event\)/);
  assert.match(APP, /if \(!\["comment", "reply", "post", "group-message"\]\.includes\(type\)\) return 0;/);
  assert.match(APP, /const REPLY_CONFLICT_DYNAMICS = \["jealous", "rival", "defend", "jealous-watch"/);
  /* AI→AI reply dynamics move both sides' relationship */
  assert.match(APP, /jealous: \[\[requestedTargetId, comment\.authorId, -6\]/);
  assert.match(APP, /defend: \[\[requestedTargetId, comment\.authorId, -4\], \[requestedTargetId, post\.authorId, 3\]\]/);
});

test("Regression: the English quality hard policy is still in the AI system prompt and survives comment/post requests", () => {
  const POLICY = fs.readFileSync(new URL("../src/socialWorldPolicy.js", import.meta.url), "utf8");
  assert.match(POLICY, /ENGLISH QUALITY:/);
  assert.match(POLICY, /fluent, idiomatic, coherent, high-level literary English/);
  assert.match(POLICY, /Literary quality does NOT mean purple prose/);
  assert.match(POLICY, /window\.fetch = async function masvilagPolicyFetch/);
  assert.match(APP, /Write polished, idiomatic, native-speaker English with a real writer's ear\. Posts, comments and DMs sound the way these characters actually text/);
});
