import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifyVisionError, visionRetryDelayMs, readImagePatiently, nextPostToRead,
  VISION_RETRY_MIN_MS, VISION_RETRY_MAX_MS, VISION_MAX_ATTEMPTS,
} from "../src/visionRetry.js";

const failure = (status, retryAfter = 0) => Object.assign(new Error("HTTP " + status), { status, retryAfter });
const clock = () => {
  const c = { t: 0, slept: [] };
  c.now = () => c.t;
  c.sleep = async (ms) => { c.slept.push(ms); c.t += ms; };
  return c;
};

test("A failure is 'waiting' (no free capacity), 'transient' (a hiccup) or 'hard' (this picture can never work)", () => {
  for (const status of [503, 429, 408]) assert.equal(classifyVisionError(failure(status)), "waiting", String(status));
  for (const status of [500, 502, 504]) assert.equal(classifyVisionError(failure(status)), "transient", String(status));
  assert.equal(classifyVisionError(new TypeError("Failed to fetch")), "transient", "no connection");
  for (const status of [400, 401, 403, 404, 413, 422]) assert.equal(classifyVisionError(failure(status)), "hard", String(status));
});

test("The server's Retry-After is respected (never sooner than 15 s, never later than 10 min); with none the wait doubles", () => {
  assert.equal(visionRetryDelayMs(failure(503, 90), 1), 90_000);
  assert.equal(visionRetryDelayMs(failure(503, 3), 1), VISION_RETRY_MIN_MS);
  assert.equal(visionRetryDelayMs(failure(503, 99999), 1), VISION_RETRY_MAX_MS);
  assert.deepEqual([1, 2, 3, 4].map((n) => visionRetryDelayMs(failure(502), n)), [15_000, 30_000, 60_000, 120_000]);
  assert.equal(visionRetryDelayMs(failure(502), 20), VISION_RETRY_MAX_MS);
});

test("A picture read at once costs one call and no waiting", async () => {
  const c = clock();
  let calls = 0;
  const read = await readImagePatiently(async () => { calls += 1; return "  Two friends at a cafe.  "; }, c);
  assert.deepEqual([read.text, read.pending, read.attempts, calls], ["Two friends at a cafe.", false, 1, 1]);
  assert.deepEqual(c.slept, []);
});

test("When the free AI is busy, a short wait and one more try is enough, and the player gets the description", async () => {
  const c = clock();
  const results = [failure(503, 20), "A dog on a beach."];
  const read = await readImagePatiently(async () => { const next = results.shift(); if (next instanceof Error) throw next; return next; }, { ...c, maxWaitMs: 25000 });
  assert.deepEqual([read.text, read.pending, read.attempts], ["A dog on a beach.", false, 2]);
  assert.deepEqual(c.slept, [20_000]);
});

test("When the server says to come back in ten minutes, the post is not held up: it is marked pending instead", async () => {
  const c = clock();
  let calls = 0;
  const read = await readImagePatiently(async () => { calls += 1; throw failure(503, 600); }, { ...c, maxWaitMs: 25000 });
  assert.deepEqual([read.text, read.pending, calls], ["", true, 1]);
  assert.deepEqual(c.slept, [], "no waiting for a hopeless wait");
});

test("A network hiccup is retried after a few seconds, but the total wait stays inside the limit", async () => {
  const c = clock();
  let calls = 0;
  const read = await readImagePatiently(async () => { calls += 1; throw new TypeError("Failed to fetch"); }, { ...c, maxWaitMs: 10000 });
  assert.equal(read.pending, true);
  assert.ok(c.t <= 10000, "waited " + c.t);
  assert.ok(calls >= 2 && calls <= 4, "calls " + calls);
});

test("A picture that can never be read is not retried and not pending", async () => {
  const c = clock();
  let calls = 0;
  const read = await readImagePatiently(async () => { calls += 1; throw failure(422); }, { ...c });
  assert.deepEqual([read.text, read.pending, calls], ["", false, 1]);
  assert.equal(read.error.status, 422);
});

test("An empty answer for a readable request is final, not a reason to ask again", async () => {
  let calls = 0;
  const read = await readImagePatiently(async () => { calls += 1; return ""; }, clock());
  assert.deepEqual([read.text, read.pending, calls], ["", false, 1]);
});

test("The background worker takes the newest post still waiting for its picture, one at a time", () => {
  const posts = [
    { id: "old", ts: 100, imageAnalysisPending: true, imageDescription: "" },
    { id: "new", ts: 300, imageAnalysisPending: true },
    { id: "read", ts: 400, imageAnalysisPending: true, imageDescription: "A tree." },
    { id: "plain", ts: 500 },
    { id: "spent", ts: 600, imageAnalysisPending: true, imageAnalysisAttempts: VISION_MAX_ATTEMPTS },
    { id: "nosrc", ts: 700, imageAnalysisPending: true, imageId: "gone" },
    null,
  ];
  const hasSource = (post) => post.imageId !== "gone";
  assert.equal(nextPostToRead(posts, { hasSource }).id, "new");
  assert.equal(nextPostToRead(posts, { hasSource, attempted: new Set(["new"]) }).id, "old");
  assert.equal(nextPostToRead(posts, { hasSource, attempted: new Set(["new", "old"]) }), null);
  assert.equal(nextPostToRead(undefined), null);
});

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("App: a posted picture is read patiently, and an unread one is marked for the background worker", () => {
  assert.match(app, /const read = await readImagePatiently\(\(\) => analyzeImageDataUrl\(/);
  assert.match(app, /imageAnalysisPending = read\.pending && !read\.text/);
  assert.match(app, /\.\.\.\(imageAnalysisPending \? \{ imageAnalysisPending: true \} : \{\}\)/);
  assert.match(app, /nextPostToRead\(world\.posts/, "the repair worker looks for posts that are still waiting");
  assert.match(app, /delete target\.socialMeaning/, "a post meaning built without the picture is dropped once the picture is known");
});

test("App: a chat photo is read patiently too, and the album worker retries what had to wait", () => {
  assert.match(app, /\(await readImagePatiently\(\(\) => analyzeImageDataUrl\(\s*imageData,/);
  assert.match(app, /albumVisionAttempted\.current\.delete\(itemKey\)/);
  assert.match(app, /scheduleVisionRetry\(visionErr, Math\.max\(1, tries\)\)/);
});

test("App: the 503 'wait' answer reaches the caller with its Retry-After", () => {
  assert.match(app, /err\.retryAfter =\s*Number\(res\.headers && res\.headers\.get && res\.headers\.get\("retry-after"\)\) \|\|\s*Number\(detail && detail\.retryAfterSeconds\)/);
});

test("App: utility calls carry the labels the server routes to Groq", () => {
  for (const label of ["meaning-analysis", "music-note", "relationship-impact", "display-translate"]) {
    assert.ok(app.includes(`source: "${label}"`), label);
  }
});
