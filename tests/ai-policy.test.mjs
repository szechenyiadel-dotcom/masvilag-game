import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PAID_PROVIDERS, isForegroundRequest, filterProvidersForBody, selectGeminiKeys,
  backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs,
  BACKGROUND_WAIT_MIN_SECONDS, BACKGROUND_WAIT_MAX_SECONDS, BACKGROUND_WAIT_DEFAULT_SECONDS,
} from "../server/aiPolicy.js";

test("Only an explicit foreground flag marks a request as player-waiting", () => {
  assert.equal(isForegroundRequest({ foreground: true }), true);
  for (const body of [{}, null, undefined, { foreground: "true" }, { foreground: 1 }, { priority: 100, source: "dm" }]) {
    assert.equal(isForegroundRequest(body), false);
  }
});

test("Background requests never get a paid provider; foreground ones keep the whole chain", () => {
  const chain = ["openrouter3", "mistral", "gemini", "openai", "anthropic", "groq"];
  assert.deepEqual(filterProvidersForBody(chain, { source: "feed-post" }, { freeGeminiKeyCount: 2 }), ["mistral", "gemini", "groq"]);
  assert.deepEqual(filterProvidersForBody(chain, { foreground: true }, { freeGeminiKeyCount: 0 }), chain);
  for (const paid of PAID_PROVIDERS) assert.ok(!filterProvidersForBody(chain, {}, { freeGeminiKeyCount: 1 }).includes(paid));
});

test("Gemini is dropped from a background chain when no free key exists", () => {
  assert.deepEqual(filterProvidersForBody(["gemini", "groq"], {}, { freeGeminiKeyCount: 0 }), ["groq"]);
  assert.deepEqual(filterProvidersForBody(["gemini", "groq"], {}), ["groq"]);
});

test("Paid background use is an explicit opt-in", () => {
  const chain = ["gemini", "openai"];
  assert.deepEqual(filterProvidersForBody(chain, {}, { allowPaidBackground: true }), chain);
  assert.deepEqual(filterProvidersForBody(chain, {}, { allowPaidBackground: false, freeGeminiKeyCount: 3 }), ["gemini"]);
});

test("Background Gemini selection uses free keys only and reports how long to wait", () => {
  const freeKeys = ["f2", "f3"], paidKey = "paid", now = 1000;
  const restUntil = new Map([["f2", 1000 + 40000], ["f3", 1000 + 25000]]);
  const background = selectGeminiKeys({ freeKeys, paidKey, restUntil, now, foreground: false });
  assert.deepEqual(background.keys, []);
  assert.equal(background.waitMs, 25000);

  const partlyRested = selectGeminiKeys({ freeKeys, paidKey, restUntil: new Map([["f2", 5000]]), now, foreground: false });
  assert.deepEqual(partlyRested.keys, ["f3"]);
  assert.equal(partlyRested.waitMs, 0);

  const noFreeKeys = selectGeminiKeys({ freeKeys: [], paidKey, restUntil: new Map(), now, foreground: false });
  assert.deepEqual(noFreeKeys.keys, []);
  assert.equal(noFreeKeys.waitMs, 0);
});

test("A waiting player may still reach the paid Gemini key, after the free ones", () => {
  const freeKeys = ["f2", "f3"], paidKey = "paid", now = 1000;
  assert.deepEqual(selectGeminiKeys({ freeKeys, paidKey, restUntil: new Map(), now, foreground: true }).keys, ["f2", "f3", "paid"]);
  const allResting = new Map([["f2", 99999], ["f3", 99999], ["paid", 99999]]);
  assert.deepEqual(selectGeminiKeys({ freeKeys, paidKey, restUntil: allResting, now, foreground: true }).keys, ["paid"]);
});

test("allowPaidBackground lets a background request use the paid Gemini key last", () => {
  const selection = selectGeminiKeys({ freeKeys: ["f2"], paidKey: "paid", restUntil: new Map([["f2", 99999]]), now: 1000, foreground: false, allowPaidBackground: true });
  assert.deepEqual(selection.keys, ["paid"]);
});

test("Wait time follows the soonest provider recovery within sane bounds", () => {
  assert.equal(backgroundWaitSeconds([]), BACKGROUND_WAIT_DEFAULT_SECONDS);
  assert.equal(backgroundWaitSeconds([0, -5]), BACKGROUND_WAIT_DEFAULT_SECONDS);
  assert.equal(backgroundWaitSeconds([90000, 45000]), 45);
  assert.equal(backgroundWaitSeconds([1500]), BACKGROUND_WAIT_MIN_SECONDS);
  assert.equal(backgroundWaitSeconds([60 * 60 * 1000]), BACKGROUND_WAIT_MAX_SECONDS);
});

test("The waiting answer is a 503 with Retry-After that the client treats as a rest, not as an error", () => {
  const result = buildWaitingResult({ retryAfterSeconds: 42.2, details: ["gemini/x: out of quota"] });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.waiting, true);
  assert.equal(result.retryAfter, "43");
  assert.equal(result.payload.error.type, "free_ai_waiting");
  assert.match(result.payload.error.message, /no usable/i);
  assert.match(result.payload.error.message, /gemini\/x: out of quota/);
});

test("proxy.js wires the policy: paid fallback, emergency OpenAI and the silent skip all respect it", () => {
  const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  assert.match(source, /filterProvidersForBody\(/);
  assert.match(source, /function shouldUseEmergencyOpenAIFallback[\s\S]*?!isForegroundRequest\(task\.body\)/);
  assert.match(source, /buildWaitingResult\(/);
  assert.match(source, /!result\?\.waiting && priority < 50/);
  assert.match(source, /foreground, \.\.\.rest/, "the flag must not be forwarded to Anthropic");
});

test("Gemini keys rest by what Google said: bad key a day, spent credit hours, spent quota half an hour", () => {
  const hour = 3600 * 1000;
  assert.equal(geminiKeyRestMs(401), 24 * hour);
  assert.equal(geminiKeyRestMs(403), 24 * hour);
  assert.equal(geminiKeyRestMs(400, "API key not valid. Please pass a valid API key."), 24 * hour);
  assert.equal(geminiKeyRestMs(400, "Invalid JSON payload"), 0, "a real request error is not the key's fault");
  assert.equal(geminiKeyRestMs(402, "Your prepayment credits are depleted."), 6 * hour);
  assert.equal(geminiKeyRestMs(429), hour / 2);
  assert.equal(geminiKeyRestMs(503), 0);
});
