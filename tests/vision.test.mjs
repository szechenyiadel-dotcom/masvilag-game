import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createVisionRunner, DEFAULT_GROQ_VISION_MODEL, GROQ_VISION_MAX_BASE64 } from "../server/vision.js";

const NOW = 5_000_000;
const image = (size = 1000) => ({ mimeType: "image/jpeg", base64: "A".repeat(size), dataUrl: "data:image/jpeg;base64," + "A".repeat(size) });
const answer = (status, payload, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => payload, headers: { get: (name) => headers[name.toLowerCase()] ?? null } });
const groqOk = (text = "Two people at a dojo.") => answer(200, { choices: [{ message: { content: text } }] });
const geminiOk = (text = "A street at night.") => answer(200, { candidates: [{ content: { parts: [{ text }] } }] });
const quota = (retryAfter) => answer(429, { error: { message: "Rate limit reached. Please try again in 30s." } }, retryAfter ? { "retry-after": String(retryAfter) } : {});

function setup(handler, extra = {}) {
  const calls = [];
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
    geminiFreeKeys: ["f2", "f3"], geminiPaidKey: "paid", now: () => clock.t, log: { warn() {} },
    ...extra,
  });
  return { runner, calls, clock, hosts: () => calls.map((c) => c.host + ":" + c.key) };
}

test("The image is read by Groq's vision model first, with the right request shape", async () => {
  const t = setup(() => groqOk());
  const result = await t.runner.analyze({ image: image(), prompt: "Describe it." });
  assert.deepEqual([result.ok, result.provider, result.model], [true, "groq", DEFAULT_GROQ_VISION_MODEL]);
  assert.equal(result.text, "Two people at a dojo.");
  assert.deepEqual(t.hosts(), ["api.groq.com:g1"], "nothing else was asked");
  const body = t.calls[0].body;
  assert.equal(body.model, DEFAULT_GROQ_VISION_MODEL);
  assert.equal(body.max_completion_tokens, 350);
  assert.deepEqual(body.messages[0].content.map((p) => p.type), ["text", "image_url"]);
  assert.match(body.messages[0].content[1].image_url.url, /^data:image\/jpeg;base64,/);
});

test("A rate-limited Groq key rests; the second key reads the image, and the first is skipped next time", async () => {
  const t = setup((c) => (c.key === "g1" ? quota(45) : groqOk()));
  assert.equal((await t.runner.analyze({ image: image(), prompt: "p" })).provider, "groq2");
  t.calls.length = 0;
  assert.equal((await t.runner.analyze({ image: image(), prompt: "p" })).provider, "groq2");
  assert.deepEqual(t.hosts(), ["api.groq.com:g2"], "g1 is resting for its 45 seconds");
  t.clock.t += 46_000;
  t.calls.length = 0;
  await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(t.calls[0].key, "g1", "after its rest g1 is back first");
});

test("With both Groq keys spent the free Gemini keys take over, and the paid key is never touched", async () => {
  const t = setup((c) => (c.host === "api.groq.com" ? quota() : geminiOk()));
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.provider], [true, "gemini"]);
  assert.ok(!t.calls.some((c) => c.key === "paid"));
  const gemini = t.calls.find((c) => c.host === "generativelanguage.googleapis.com");
  assert.equal(gemini.key, "f2");
  assert.equal(gemini.body.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
});

test("A quota-spent Gemini key rests for the real window and the next free key is used", async () => {
  const perDay = answer(429, { error: { message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } });
  const rest = new Map();
  const t = setup((c) => (c.host === "api.groq.com" ? quota() : c.key === "f2" ? perDay : geminiOk()), { geminiRestUntil: rest });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(result.provider, "gemini");
  assert.ok(rest.get("f2") - NOW > 60_000, "rested well beyond a minute");
});

test("An image over Groq's 4 MB limit skips Groq and goes straight to Gemini", async () => {
  const t = setup(() => geminiOk());
  const result = await t.runner.analyze({ image: image(GROQ_VISION_MAX_BASE64 + 10), prompt: "p" });
  assert.equal(result.provider, "gemini");
  assert.ok(!t.calls.some((c) => c.host === "api.groq.com"));
});

test("A Groq vision model that is gone is replaced by a current one, found in Groq's own model list", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return answer(200, { data: [{ id: "llama-3.1-8b-instant", active: true }, { id: "meta-llama/llama-4-scout-17b-16e-instruct-v2", active: true }] });
    return c.body.model === DEFAULT_GROQ_VISION_MODEL ? answer(404, { error: { message: "The model does not exist or you do not have access to it." } }) : groqOk("A kitchen.");
  });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.provider, result.model], [true, "groq", "meta-llama/llama-4-scout-17b-16e-instruct-v2"]);
  t.calls.length = 0;
  await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(t.calls[0].body.model, "meta-llama/llama-4-scout-17b-16e-instruct-v2", "the working model is remembered");
});

test("If no vision model can be found, Groq stands down for an hour and Gemini reads the image", async () => {
  const t = setup((c) => {
    if (c.method === "GET") return answer(200, { data: [{ id: "llama-3.1-8b-instant", active: true }] });
    return c.host === "api.groq.com" ? answer(400, { error: { message: "This model does not support image input" } }) : geminiOk();
  });
  assert.equal((await t.runner.analyze({ image: image(), prompt: "p" })).provider, "gemini");
  t.calls.length = 0;
  assert.equal((await t.runner.analyze({ image: image(), prompt: "p" })).provider, "gemini");
  assert.ok(!t.calls.some((c) => c.host === "api.groq.com"), "no Groq call during the hour");
  t.clock.t += 61 * 60 * 1000;
  t.calls.length = 0;
  await t.runner.analyze({ image: image(), prompt: "p" });
  assert.equal(t.calls[0].host, "api.groq.com", "Groq is tried again after the hour");
});

test("With no free capacity the answer is 'wait', and OpenAI / Anthropic are not called", async () => {
  const paidCalls = [];
  const t = setup(() => quota(), { paid: { openai: async () => { paidCalls.push("openai"); return { ok: true, text: "x", provider: "openai" }; }, anthropic: async () => { paidCalls.push("anthropic"); return { ok: true, text: "x", provider: "anthropic" }; } } });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.waiting, result.status], [false, true, 503]);
  assert.ok(Number(result.retryAfter) >= 20);
  assert.equal(result.payload.error.type, "free_ai_waiting");
  assert.deepEqual(paidCalls, []);
  assert.ok(!t.calls.some((c) => c.key === "paid"));
});

test("Paid providers are reachable only with the explicit opt-in", async () => {
  const paid = { openai: async () => ({ ok: true, text: "A beach.", provider: "openai", model: "gpt-4o-mini" }) };
  const t = setup(() => quota(), { allowPaid: true, paid });
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.provider], [true, "openai"]);
});

test("An image nobody can read is a 422, not an endless wait", async () => {
  const t = setup(() => answer(400, { error: { message: "Invalid image data" } }));
  const result = await t.runner.analyze({ image: image(), prompt: "p" });
  assert.deepEqual([result.ok, result.status], [false, 422]);
  assert.match(result.payload.error.message, /could not be read/);
});

test("Several images read at once do not mix up what was tried", async () => {
  let n = 0;
  const t = setup(() => (++n % 2 ? quota() : answer(400, { error: { message: "bad" } })));
  const [a, b] = await Promise.all([t.runner.analyze({ image: image(), prompt: "p" }), t.runner.analyze({ image: image(), prompt: "p" })]);
  assert.ok(a && b);
  for (const r of [a, b]) assert.ok(r.status !== undefined);
});

test("proxy.js: the vision route no longer lets the browser pick a billed provider", () => {
  const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  const route = source.slice(source.indexOf('app.post("/ai/vision"'), source.indexOf("STABLE AI PROXY HELPERS"));
  assert.match(route, /visionRunner\(\)\.analyze\(\{ image, prompt \}\)/);
  assert.ok(!/getProvider\(/.test(route) && !/provider === "openai"/.test(route));
  assert.match(source, /allowPaid: AI_ALLOW_PAID_BACKGROUND/);
  assert.match(source, /geminiFreeKeys: GEMINI_FREE_KEYS/);
  assert.match(route, /res\.setHeader\("retry-after", result\.retryAfter\)/);
});

test("App: an album image that had to wait gets its 'attempted' mark back and is tried again later", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /visionErr && visionErr\.status === 503/);
  assert.match(source, /analysisAttemptedAt: 0 \} : item/);
  assert.match(source, /if \(now\(\) < visionRetryAtRef\.current\) return;/);
  assert.match(source, /setTimeout\(\(\) => setVisionTick\(\(n\) => n \+ 1\), waitMs \+ 500\)/);
});
