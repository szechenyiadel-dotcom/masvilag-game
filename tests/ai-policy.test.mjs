import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PAID_PROVIDERS, isForegroundRequest, filterProvidersForBody, selectGeminiKeys,
  backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, secondsUntilPacificMidnight, planGroqRequest, groqRetryMs, GROQ_FREE_TPM_BUDGET,
  BACKGROUND_WAIT_MIN_SECONDS, BACKGROUND_WAIT_MAX_SECONDS, BACKGROUND_WAIT_DEFAULT_SECONDS,
  GROQ_UTILITY_SOURCES, GROQ_UTILITY_CHAIN, isGroqUtilitySource, estimateGroqTokens, groqCarriesWhole, groqPaceMaxWaitMs, createGroqPacer, GROQ_WINDOW_MS,
} from "../server/aiPolicy.js";

test("Only an explicit foreground flag marks a request as player-waiting", () => {
  assert.equal(isForegroundRequest({ foreground: true }), true);
  for (const body of [{}, null, undefined, { foreground: "true" }, { foreground: 1 }, { priority: 100, source: "dm" }]) {
    assert.equal(isForegroundRequest(body), false);
  }
});

test("Background requests never get a paid provider; foreground ones keep the whole chain", () => {
  const chain = ["openrouter3", "mistral", "gemini", "openai", "anthropic", "groq"];
  assert.deepEqual(filterProvidersForBody(chain, { source: "feed-post" }, { freeGeminiKeyCount: 2 }), ["gemini", "groq"], "Mistral is billed per use too");
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

test("Google resets the daily free quota at midnight Pacific time", () => {
  assert.equal(secondsUntilPacificMidnight(Date.UTC(2026, 9, 3, 7, 0, 0)), 24 * 3600, "07:00 UTC is 00:00 PDT");
  assert.equal(secondsUntilPacificMidnight(Date.UTC(2026, 9, 3, 11, 18, 0)), (24 * 3600) - (4 * 3600 + 18 * 60));
  assert.equal(secondsUntilPacificMidnight(Date.UTC(2026, 9, 3, 6, 59, 59)), 1);
  /* in winter (PST, UTC-8) the reset is one hour later in UTC */
  assert.equal(secondsUntilPacificMidnight(Date.UTC(2026, 11, 3, 8, 0, 0)), 24 * 3600);
});

test("A Gemini 429 says which limit it was: per day comes back at midnight Pacific, per minute within the minute", () => {
  const now = Date.UTC(2026, 9, 3, 11, 18, 0);
  const quotaFailure = (quotaId) => ({ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] });
  const retry = (delay) => ({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay });
  const daily = geminiRateLimitInfo({ error: { details: [quotaFailure("GenerateRequestsPerDayPerProjectPerModel-FreeTier")] } }, now);
  assert.equal(daily.metric, "per-day");
  assert.equal(daily.restMs, (secondsUntilPacificMidnight(now) + 60) * 1000);
  const perMinute = geminiRateLimitInfo({ error: { details: [quotaFailure("GenerateContentInputTokensPerModelPerMinute-FreeTier"), retry("37s")] } }, now);
  assert.deepEqual([perMinute.metric, perMinute.restMs], ["per-minute", 39000]);
  assert.equal(geminiRateLimitInfo({ error: { details: [quotaFailure("RequestsPerMinute"), retry("0.2s")] } }, now).restMs, 15000, "never hammered sooner than 15 s");
  assert.equal(geminiRateLimitInfo({ error: { details: [quotaFailure("RequestsPerMinute"), retry("9000s")] } }, now).restMs, 5 * 60 * 1000, "a per-minute limit never rests longer than 5 min");
  const unknown = geminiRateLimitInfo({ error: { message: "You exceeded your current quota" } }, now);
  assert.deepEqual([unknown.metric, unknown.restMs], ["unknown", 30 * 60 * 1000]);
  assert.equal(geminiRateLimitInfo({ error: { details: [retry("20s")] } }, now).restMs, 22000, "a bare retryDelay is trusted");
  assert.equal(geminiRateLimitInfo(null, now).restMs, 30 * 60 * 1000);
  assert.equal(geminiKeyRestMs(429, "quota", { error: { details: [quotaFailure("GenerateRequestsPerDayPerProjectPerModel-FreeTier")] } }, now), daily.restMs);
});

test("Groq free tier: a request is shortened to fit 8,000 tokens a minute, prompt and output allowance together", () => {
  const small = planGroqRequest({ maxTokens: 700, systemChars: 2000, messageChars: [3000] });
  assert.deepEqual([small.fits, small.compact], [true, false]);

  const big = planGroqRequest({ maxTokens: 1024, systemChars: 9000, messageChars: [30000] });
  assert.deepEqual([big.fits, big.compact], [true, true]);
  assert.ok(big.systemCap + big.lastCap <= big.maxChars, "what stays fits the budget");
  assert.ok((big.maxChars / 3) + 1024 <= GROQ_FREE_TPM_BUDGET, "prompt tokens + output allowance stay under the limit");
  assert.ok(big.systemCap <= 0.35 * big.maxChars + 1 && big.lastCap > big.systemCap, "the system part gets a third, the latest message the most room");

  const several = planGroqRequest({ maxTokens: 1024, systemChars: 5000, messageChars: [4000, 4000, 30000] });
  assert.ok(several.lastCap > several.otherCap && several.otherCap > 0);
  assert.ok(several.systemCap + several.lastCap + 2 * several.otherCap <= several.maxChars);
});

test("Groq free tier: a request whose output allowance leaves no room is never sent", () => {
  const plan = planGroqRequest({ maxTokens: 7000, systemChars: 100, messageChars: [100] });
  assert.equal(plan.fits, false);
  assert.match(plan.reason, /no room/);
  assert.equal(planGroqRequest({ maxTokens: 64000, systemChars: 1, messageChars: [1] }).fits, false, "a 64k answer allowance can never fit");
  assert.equal(planGroqRequest({ maxTokens: GROQ_FREE_TPM_BUDGET - 1200, systemChars: 10, messageChars: [10] }).fits, true, "exactly the minimum prompt room still fits");
});

test("Groq says when to come back: header seconds, or hours/minutes/seconds in the message", () => {
  assert.equal(groqRetryMs("37", ""), 37000);
  assert.equal(groqRetryMs("", "Rate limit reached ... Please try again in 56m13.92s. Need more tokens?"), 3373920);
  assert.equal(groqRetryMs("", "try again in 37.3425s."), 37343);
  assert.equal(groqRetryMs("", "try again in 1h2m3s"), 3723000);
  assert.equal(groqRetryMs("", "try again in 250ms"), 0, "milliseconds are not minutes");
  assert.equal(groqRetryMs("", "nothing useful"), 0);
});

test("Utility work is a short, explicit list; nothing that speaks as a character is on it", () => {
  assert.deepEqual([...GROQ_UTILITY_SOURCES].sort(), ["display-translate", "meaning-analysis", "music-note", "relationship-impact"]);
  assert.deepEqual(Array.from(GROQ_UTILITY_CHAIN), ["groq", "groq2", "gemini"]);
  for (const source of ["meaning-analysis", "display-translate", " Music-Note ", "relationship-impact"]) assert.equal(isGroqUtilitySource(source), true, source);
  const personality = [
    "dm", "direct-chat", "autonomous-dm", "scene", "roleplay", "roleplay-event", "roleplay-invitation", "group-chat", "comments",
    "player-post-comments-isolated", "feed-post", "event-feed-batch", "notes", "ambient-popup", "gossip-propagation", "backchannel-gossip",
    "npc-pair-reaction", "ai-event-invite", "ai-roleplay-initiation", "sheet-summary", "character-bible", "askWorldJSON", "autonomy-other", "", undefined, null,
  ];
  for (const source of personality) assert.equal(isGroqUtilitySource(source), false, String(source));
});

test("Groq takes a utility request only when it fits whole, never when it would have to be cut down", () => {
  assert.equal(groqCarriesWhole({ maxTokens: 520, systemChars: 1500, messageChars: [6000] }), true);
  assert.equal(groqCarriesWhole({ maxTokens: 520, systemChars: 3000, messageChars: [40000] }), false, "too long: a bigger-window model reads it instead");
  assert.equal(groqCarriesWhole({ maxTokens: 7000, systemChars: 10, messageChars: [10] }), false, "no room for the answer");
  const tokens = estimateGroqTokens({ maxTokens: 500, systemChars: 3000, messageChars: [3000] });
  assert.equal(tokens, 2000 + 500);
  assert.equal(estimateGroqTokens({ maxTokens: 1024, systemChars: 90000, messageChars: [90000] }), 7500, "never more than a minute's budget");
});

test("A request may wait longer for Groq in the background than when a player is waiting", () => {
  assert.equal(groqPaceMaxWaitMs({ foreground: true }), 8000);
  assert.equal(groqPaceMaxWaitMs({ source: "meaning-analysis" }), 20000);
});

function fakeClock() {
  const clock = { t: 1_000_000, onSleep: null };
  clock.now = () => clock.t;
  clock.sleep = async (ms) => { clock.t += ms; if (clock.onSleep) clock.onSleep(ms); };
  return clock;
}

test("Groq pacer: a key serves one request at a time, the other key is independent", () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep });
  const first = pacer.tryAcquire("groq", 1000);
  assert.equal(first.ok, true);
  const second = pacer.tryAcquire("groq", 1000);
  assert.deepEqual([second.ok, second.reason], [false, "busy"]);
  assert.equal(pacer.tryAcquire("groq2", 1000).ok, true, "the second key has its own turn");
  first.release();
  assert.equal(pacer.tryAcquire("groq", 1000).ok, true, "free again once the first one is done");
});

test("Groq pacer: the tokens spent in the last minute never pass the budget", () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep, budgetTokens: 7500 });
  const a = pacer.tryAcquire("groq", 5000); a.release(5000);
  clock.t += 10_000;
  const blocked = pacer.tryAcquire("groq", 3000);
  assert.deepEqual([blocked.ok, blocked.reason], [false, "budget"]);
  assert.ok(blocked.waitMs > 49_000 && blocked.waitMs <= 51_000, "comes back when the first 5,000 leave the window: " + blocked.waitMs);
  assert.equal(pacer.tryAcquire("groq", 2500).ok, true, "what still fits goes right away");
});

test("Groq pacer: the real usage Groq reports replaces the estimate, so unused allowance is given back", () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep, budgetTokens: 7500 });
  const a = pacer.tryAcquire("groq", 7000);
  a.release(1200);
  assert.equal(pacer.state("groq").spentTokens, 1200);
  const b = pacer.tryAcquire("groq", 6000);
  assert.equal(b.ok, true);
  b.release(0);
  assert.equal(pacer.state("groq").spentTokens, 1200, "a request that consumed nothing costs nothing");
  a.release(7000);
  assert.equal(pacer.state("groq").spentTokens, 1200, "releasing twice changes nothing");
});

test("Groq pacer: the window slides, a minute later the budget is back", () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep, budgetTokens: 7500 });
  pacer.tryAcquire("groq", 7500).release();
  assert.equal(pacer.tryAcquire("groq", 100).ok, false);
  clock.t += GROQ_WINDOW_MS + 5;
  assert.equal(pacer.tryAcquire("groq", 7500).ok, true);
});

test("Groq pacer: acquire waits for the key to come free, and gives up after the longest wait it was allowed", async () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep });
  const running = pacer.tryAcquire("groq", 2000);
  clock.onSleep = () => { running.release(); clock.onSleep = null; };
  const waited = await pacer.acquire("groq", 2000, 5000);
  assert.equal(waited.ok, true, "got its turn after the first request finished");

  const stuck = createGroqPacer({ now: clock.now, sleep: clock.sleep });
  stuck.tryAcquire("groq", 2000);
  const started = clock.t;
  const refused = await stuck.acquire("groq", 2000, 3000);
  assert.deepEqual([refused.ok, refused.reason], [false, "busy"]);
  assert.ok(clock.t - started <= 3400, "never waits past the allowed time: " + (clock.t - started));
  assert.equal((await stuck.acquire("groq", 2000, 0)).ok, false, "no waiting at all when nothing may be waited");
});

test("Groq pacer: a budget wait longer than the allowed time is refused at once with the time to come back", async () => {
  const clock = fakeClock();
  const pacer = createGroqPacer({ now: clock.now, sleep: clock.sleep });
  pacer.tryAcquire("groq", 7000).release();
  const started = clock.t;
  const refused = await pacer.acquire("groq", 3000, 8000);
  assert.deepEqual([refused.ok, refused.reason], [false, "budget"]);
  assert.ok(refused.waitMs > 50_000, "tells the caller how long: " + refused.waitMs);
  assert.equal(clock.t, started, "it did not sit and wait for nothing");
});
