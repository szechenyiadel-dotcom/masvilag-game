import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PAID_PROVIDERS, isForegroundRequest, filterProvidersForBody, selectGeminiKeys,
  backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, secondsUntilPacificMidnight, planGroqRequest, groqRetryMs, GROQ_FREE_TPM_BUDGET,
  BACKGROUND_WAIT_MIN_SECONDS, BACKGROUND_WAIT_MAX_SECONDS, BACKGROUND_WAIT_DEFAULT_SECONDS,
  GROQ_UTILITY_SOURCES, GROQ_UTILITY_CHAIN, isGroqUtilitySource, estimateGroqTokens, groqCarriesWhole, groqPaceMaxWaitMs, createGroqPacer, GROQ_WINDOW_MS,
  geminiModelConfig, geminiModelLadder, geminiStreakRestMs, createGeminiLedger, planGeminiAttempts,
  DEFAULT_GEMINI_EXTRA_MODELS, DEFAULT_GEMINI_LITE_MODELS, DEFAULT_GEMINI_PRIMARY_MODEL,
  geminiBlockReason, looksLikeRefusal, requestExpectsJson,
  PAID_INPUT_PROVIDERS, DEFAULT_PAID_MAX_INPUT_CHARS, paidMaxInputChars, planCharBudget, createUsageMeter,
  createRefusalTracker, orderByRefusals,
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

/* ---------- Gemini models and the (key, model) ledger ---------- */

test("Models come from the free list: the writing model, two more flash models, three lite ones", () => {
  const config = geminiModelConfig({});
  assert.equal(config.primary, DEFAULT_GEMINI_PRIMARY_MODEL);
  assert.deepEqual(config.extra, ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]);
  assert.deepEqual(config.lite, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]);
  assert.deepEqual(Array.from(DEFAULT_GEMINI_EXTRA_MODELS).concat(Array.from(DEFAULT_GEMINI_LITE_MODELS), DEFAULT_GEMINI_PRIMARY_MODEL).sort(),
    ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]);
});

test("The environment can change every list, and 'off' switches one off", () => {
  const config = geminiModelConfig({ GEMINI_MODEL: "gemini-3.7-flash", GEMINI_DEEP_MODEL: "gemini-3.8-flash", GEMINI_EXTRA_MODELS: "a, b;c", GEMINI_LITE_MODELS: "off", GEMINI_VISION_MODEL: "v" });
  assert.deepEqual([config.primary, config.deep, config.extra, config.lite], ["gemini-3.7-flash", "gemini-3.8-flash", ["a", "b", "c"], []]);
  assert.deepEqual(config.vision, ["v", "gemini-3.7-flash", "a", "b", "c"]);
  assert.equal(geminiModelConfig({ GEMINI_FALLBACK_MODEL: "old-name" }).primary, "old-name", "the old variable name still works");
  assert.deepEqual(geminiModelConfig({ GEMINI_MODEL: "gemini-3.6-flash" }).extra, ["gemini-3.7-flash", "gemini-3.5-flash"], "the main model is not listed twice");
});

test("Characters' voices and careful readings use the full models only; light utility work starts on the lite ones", () => {
  const config = geminiModelConfig({});
  const full = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];
  for (const source of ["dm", "scene", "comments", "feed-post", "group-chat", "notes", "ambient-popup", "gossip-propagation", "sheet-summary", "character-bible", "askWorldJSON", ""]) {
    assert.deepEqual(geminiModelLadder(config, { source }), full, source);
  }
  assert.deepEqual(geminiModelLadder(config, { source: "character-bible", quality: "deep" }), [...full, ...config.lite], "a whole-sheet reading falls back to the light models after every full one");
  assert.deepEqual(geminiModelLadder(config, { source: "sheet-summary", quality: "deep" }), [...full, ...config.lite]);
  assert.deepEqual(geminiModelLadder(config, { source: "meaning-analysis", quality: "deep" }), full, "a careful reading is never given to a lite model");
  for (const source of ["meaning-analysis", "display-translate", "music-note", "relationship-impact"]) {
    assert.deepEqual(geminiModelLadder(config, { source }), [...config.lite, ...full], source);
  }
  assert.deepEqual(geminiModelLadder(geminiModelConfig({ GEMINI_DEEP_MODEL: "gemini-3.7-flash" }), { quality: "deep" }), ["gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"]);
});

test("A 429 reports the real size of the quota, the model it counted on, and when it comes back", () => {
  const now = Date.UTC(2026, 9, 3, 11, 0, 0);
  const violation = { quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250", quotaDimensions: { model: "gemini-3.8-flash", location: "global" } };
  const info = geminiRateLimitInfo({ error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [violation] }] } }, now);
  assert.deepEqual([info.metric, info.limit, info.quotaModel, info.quotaId], ["per-day", 250, "gemini-3.8-flash", violation.quotaId]);
  const minute = geminiRateLimitInfo({ error: { details: [{ violations: [{ quotaId: "x", quotaValue: "9" }, { quotaId: "GenerateContentInputTokensPerModelPerMinute-FreeTier", quotaValue: "250000" }] }] } }, now);
  assert.deepEqual([minute.metric, minute.limit], ["per-minute", 250000], "the figure of the limit that was hit, not just the first one");
  assert.equal(geminiRateLimitInfo(null, now).limit, 0);
});

test("A key that timed out twice in a row rests a little, and the rest doubles up to ten minutes", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(geminiStreakRestMs), [0, 0, 30000, 60000, 120000, 240000, 600000]);
});

function ledgerAt(start = 1_000_000) {
  const clock = { t: start };
  return { clock, ledger: createGeminiLedger({ now: () => clock.t }) };
}
const dayLimit = { error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250" }] }] } };

test("A spent daily quota rests ONE model on that key; the key's other models stay open", () => {
  const { ledger } = ledgerAt(Date.UTC(2026, 9, 3, 11, 0, 0));
  const outcome = ledger.fail("k2", "gemini-3.8-flash", { status: 429, payload: dayLimit });
  assert.deepEqual([outcome.level, outcome.metric, outcome.limit], ["model", "per-day", 250]);
  assert.ok(ledger.restMs("k2", "gemini-3.8-flash") > 3600 * 1000);
  assert.equal(ledger.restMs("k2", "gemini-3.7-flash"), 0, "same key, other model");
  assert.equal(ledger.restMs("k3", "gemini-3.8-flash"), 0, "other key, same model");
});

test("A bad key rests for every model; spent credit too; a model that does not exist rests for every key", () => {
  const { ledger } = ledgerAt();
  assert.equal(ledger.fail("bad", "m1", { status: 400, message: "API key not valid. Please pass a valid API key." }).level, "key");
  assert.ok(ledger.restMs("bad", "m2") > 20 * 3600 * 1000);
  assert.equal(ledger.fail("broke", "m1", { status: 402, message: "credits are depleted" }).metric, "no-credit");
  assert.ok(ledger.restMs("broke", "m3") > 0);
  const gone = ledger.fail("any", "gemini-9", { status: 404, message: "models/gemini-9 is not found for API version v1beta" });
  assert.equal(gone.level, "model-gone");
  assert.ok(ledger.restMs("other-key", "gemini-9") > 0);
  assert.equal(ledger.fail("any", "m1", { status: 404, message: "Not Found" }).level, "none", "a bare 404 says nothing about the model");
  assert.equal(ledger.fail("any", "m1", { status: 400, message: "Invalid JSON payload" }).level, "none", "a request error is not the key's fault");
});

test("Timeouts and 5xx only rest a pair after a second failure in a row, and a success clears the count", () => {
  const { ledger, clock } = ledgerAt();
  assert.equal(ledger.fail("k", "m", { status: 504 }).restMs, 0);
  assert.equal(ledger.restMs("k", "m"), 0, "one hiccup is not held against it");
  assert.equal(ledger.fail("k", "m", { status: 503 }).restMs, 30000);
  assert.equal(ledger.restMs("k", "m"), 30000);
  clock.t += 31000;
  assert.equal(ledger.restMs("k", "m"), 0);
  ledger.succeed("k", "m");
  assert.equal(ledger.fail("k", "m", { status: 504 }).restMs, 0, "the streak started over");
  assert.equal(ledger.fail("k2", "m", { status: 0 }).restMs, 0, "a dropped connection counts as a hiccup too");
});

test("The ledger's Map-like view lets older code rest one model's key", () => {
  const { ledger, clock } = ledgerAt();
  const view = ledger.view("emb");
  view.set("k", clock.t + 5000);
  assert.equal(view.get("k"), clock.t + 5000);
  assert.equal(ledger.restMs("k", "emb"), 5000);
  assert.equal(ledger.restMs("k", "other"), 0);
  view.set("k", clock.t + 1000);
  assert.equal(view.get("k"), clock.t + 5000, "a rest is never shortened");
});

test("Attempts go model by model, two keys each, never more than four, and never to a resting pair", () => {
  const { ledger } = ledgerAt();
  const models = ["m1", "m2", "m3"];
  const plan = planGeminiAttempts({ freeKeys: ["a", "b", "c", "d"], models, ledger, rotation: 0 });
  assert.deepEqual(plan.attempts.map((x) => x.key + x.model), ["am1", "bm1", "am2", "bm2"]);
  ledger.fail("a", "m1", { status: 429, payload: dayLimit });
  ledger.fail("b", "m1", { status: 429, payload: dayLimit });
  assert.deepEqual(planGeminiAttempts({ freeKeys: ["a", "b", "c", "d"], models, ledger, rotation: 0 }).attempts.map((x) => x.key + x.model), ["cm1", "dm1", "am2", "bm2"]);
  for (const key of ["a", "b", "c", "d"]) ledger.fail(key, "m1", { status: 429, payload: dayLimit });
  assert.deepEqual(planGeminiAttempts({ freeKeys: ["a", "b", "c", "d"], models, ledger, rotation: 0 }).attempts.map((x) => x.key + x.model), ["am2", "bm2", "am3", "bm3"], "a spent model is skipped on every key");
});

test("The starting key rotates, so no key takes every request", () => {
  const { ledger } = ledgerAt();
  const starts = [0, 1, 2, 3, 4].map((rotation) => planGeminiAttempts({ freeKeys: ["a", "b", "c"], models: ["m"], ledger, rotation }).attempts[0].key);
  assert.deepEqual(starts, ["a", "b", "c", "a", "b"]);
  const counter = createGeminiLedger();
  assert.deepEqual([counter.nextRotation(), counter.nextRotation(), counter.nextRotation()], [0, 1, 2]);
});

test("Nothing usable: a background request gets the wait, a waiting player may still use the paid key", () => {
  const { ledger, clock } = ledgerAt();
  for (const model of ["m1", "m2"]) for (const key of ["a", "b"]) ledger.fail(key, model, { status: 429, payload: { error: { details: [{ violations: [{ quotaId: "RequestsPerMinute" }] }, { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "40s" }] } } });
  const background = planGeminiAttempts({ freeKeys: ["a", "b"], paidKey: "paid", models: ["m1", "m2"], ledger });
  assert.equal(background.attempts.length, 0);
  assert.equal(background.waitMs, 42000);
  clock.t += 10000;
  assert.equal(planGeminiAttempts({ freeKeys: ["a", "b"], paidKey: "paid", models: ["m1", "m2"], ledger }).waitMs, 32000);
  const player = planGeminiAttempts({ freeKeys: ["a", "b"], paidKey: "paid", models: ["m1", "m2"], ledger, foreground: true });
  assert.deepEqual(player.attempts.map((x) => x.key), ["paid"]);
  assert.equal(player.attempts[0].paid, true);
  const optIn = planGeminiAttempts({ freeKeys: ["a"], paidKey: "paid", models: ["m1"], ledger, allowPaidBackground: true });
  assert.deepEqual(optIn.attempts.map((x) => x.key), ["paid"]);
  assert.deepEqual(planGeminiAttempts({ freeKeys: [], paidKey: "", models: ["m1"], ledger }), { attempts: [], waitMs: 0 }, "nothing configured is not a wait");
});

test("A waiting player with free keys that all rest is still given the last one to try, and free keys come before the paid one", () => {
  const { ledger } = ledgerAt();
  ledger.fail("a", "m1", { status: 429, payload: dayLimit });
  const onlyFree = planGeminiAttempts({ freeKeys: ["a"], models: ["m1"], ledger, foreground: true });
  assert.deepEqual(onlyFree.attempts.map((x) => x.key), ["a"]);
  const both = planGeminiAttempts({ freeKeys: ["a", "b"], paidKey: "paid", models: ["m1"], ledger, foreground: true });
  assert.deepEqual(both.attempts.map((x) => x.key), ["b", "paid"]);
});

/* ---------- blocked and refused answers ---------- */

test("Gemini says why it gave no text: a blocked prompt or a filtered answer", () => {
  assert.equal(geminiBlockReason({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" }, candidates: [] }), "PROHIBITED_CONTENT");
  assert.equal(geminiBlockReason({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }), "SAFETY");
  assert.equal(geminiBlockReason({ candidates: [{ finishReason: "BLOCKLIST" }] }), "BLOCKLIST");
  for (const finishReason of ["STOP", "MAX_TOKENS", "RECITATION", ""]) assert.equal(geminiBlockReason({ candidates: [{ finishReason }] }), "", finishReason);
  assert.equal(geminiBlockReason(null), "");
  assert.equal(geminiBlockReason({}), "");
});

test("A request counts as asking for JSON when the system prompt or the last message says so, as the game's do", () => {
  assert.equal(requestExpectsJson({ system: "Return valid JSON only. Add a top-level language field", messages: [] }), true);
  assert.equal(requestExpectsJson({ system: "KIZÁRÓLAG érvényes JSON-t adj vissza.", messages: [] }), true);
  assert.equal(requestExpectsJson({ system: "s", messages: [{ role: "user", content: "Write the scene.\nCsak JSON:\n{\"a\":1}" }] }), true);
  assert.equal(requestExpectsJson({ system: "You are a friendly narrator.", messages: [{ role: "user", content: "Tell me a story." }] }), false);
  assert.equal(requestExpectsJson({}), false);
});

test("A polite refusal to a request for JSON is recognised, in English and Hungarian", () => {
  for (const text of [
    "I'm sorry, but I can't continue with this request.",
    "I can't help with that.",
    "Sorry, I cannot assist with explicit sexual content.",
    "I'm unable to write this scene as it goes against the content guidelines.",
    "As an AI, I can't generate that kind of content.",
    "Unfortunately, I won't be able to continue with this request.",
    "Sajnálom, de ebben a tartalomban nem tudok segíteni.",
    "Nem tudok ilyen jelenetet írni, mert nem megfelelő a tartalom.",
    "Elnézést, de ezt a kérést nem teljesíthetem.",
    "\"I'm sorry, I can't help with this request.\"",
  ]) assert.equal(looksLikeRefusal(text), true, text);
});

test("An answer is never mistaken for a refusal: JSON, fenced JSON, long prose, or prose that is just a character talking", () => {
  for (const text of [
    '{"reply":"I\'m sorry, I can\'t come tonight."}',
    '```json\n{"messages":[{"text":"Sorry, I can\'t help you move."}]}\n```',
    '[{"text":"I can\'t believe you did that"}]',
    "Sorry, I was late. The traffic was awful and the bus broke down, so I walked the last two miles. Anyway, shall we start?",
    "I'm sorry I missed your call last night, it was a long shift.",
    "Rendben, megyek. Hozom a kabátod.",
    "",
    "x".repeat(900),
    'I cannot tell you how happy I am, here you go: {"ok":"yes"}',
  ]) assert.equal(looksLikeRefusal(text), false, text.slice(0, 60));
});

/* ---------- the paid providers' ceiling and the usage meter ---------- */

test("The paid providers are DeepSeek and the two Mistral keys, and the ceiling defaults to 60,000 characters", () => {
  assert.deepEqual([...PAID_INPUT_PROVIDERS].sort(), ["mistral", "mistral2", "openrouter3"]);
  assert.equal(DEFAULT_PAID_MAX_INPUT_CHARS, 60000);
  assert.equal(paidMaxInputChars({}), 60000);
  assert.equal(paidMaxInputChars({ PAID_MAX_INPUT_CHARS: "" }), 60000);
  assert.equal(paidMaxInputChars({ PAID_MAX_INPUT_CHARS: "30000" }), 30000);
  assert.equal(paidMaxInputChars({ PAID_MAX_INPUT_CHARS: "0" }), 0, "0 switches it off");
  assert.equal(paidMaxInputChars({ PAID_MAX_INPUT_CHARS: "lots" }), 60000);
  assert.equal(paidMaxInputChars({ PAID_MAX_INPUT_CHARS: "-5" }), 60000);
});

test("A prompt that fits is left alone; one that does not is cut to the ceiling with the latest message getting the most room", () => {
  assert.deepEqual(planCharBudget({ maxChars: 60000, systemChars: 20000, messageChars: [30000] }), { compact: false, maxChars: 60000 });
  assert.equal(planCharBudget({ maxChars: 0, systemChars: 1e6, messageChars: [1e6] }).compact, false, "no ceiling, nothing to do");
  const plan = planCharBudget({ maxChars: 60000, systemChars: 40000, messageChars: [80000] });
  assert.equal(plan.compact, true);
  assert.equal(plan.systemCap, 30000, "the system part may keep half");
  assert.equal(plan.lastCap, 30000);
  assert.ok(plan.systemCap + plan.lastCap <= plan.maxChars);
  const small = planCharBudget({ maxChars: 60000, systemChars: 5000, messageChars: [100000] });
  assert.equal(small.systemCap, 5000, "a short system part is never cut");
  assert.equal(small.lastCap, 55000);
  const several = planCharBudget({ maxChars: 60000, systemChars: 10000, messageChars: [20000, 20000, 60000] });
  assert.ok(several.lastCap > several.otherCap && several.otherCap > 0);
  assert.ok(several.systemCap + several.lastCap + 2 * several.otherCap <= 60000);
});

test("The usage meter adds up calls and tokens per provider and per kind of request", () => {
  const meter = createUsageMeter({ now: () => Date.UTC(2026, 9, 3, 12, 0, 0) });
  meter.record({ provider: "mistral", source: "dm", promptTokens: 1000, completionTokens: 100, cachedTokens: 400, reasoningTokens: 10, cost: 0.001 });
  meter.record({ provider: "mistral", source: "scene", promptTokens: 2000, completionTokens: 300 });
  meter.record({ provider: "openrouter3", source: "dm", promptTokens: 500, completionTokens: 50 });
  const snapshot = meter.snapshot();
  assert.equal(snapshot.day, "2026-10-03");
  assert.deepEqual([snapshot.calls, snapshot.promptTokens, snapshot.completionTokens, snapshot.cachedTokens, snapshot.reasoningTokens], [3, 3500, 450, 400, 10]);
  assert.deepEqual([snapshot.byProvider.mistral.calls, snapshot.byProvider.mistral.promptTokens], [2, 3000]);
  assert.deepEqual([snapshot.bySource.dm.calls, snapshot.bySource.dm.promptTokens], [2, 1500]);
  assert.equal(snapshot.byProviderSource["mistral/scene"].completionTokens, 300);
  assert.equal(snapshot.cost, 0.001);
  assert.equal(snapshot.previous, null);
});

test("The meter ignores nonsense numbers, starts a new day at midnight UTC and keeps yesterday to look at", () => {
  const clock = { t: Date.UTC(2026, 9, 3, 23, 59, 0) };
  const meter = createUsageMeter({ now: () => clock.t });
  meter.record({ provider: "mistral", source: "dm", promptTokens: "x", completionTokens: -4, cachedTokens: undefined, cost: NaN });
  assert.deepEqual([meter.snapshot().calls, meter.snapshot().promptTokens, meter.snapshot().completionTokens, meter.snapshot().cost], [1, 0, 0, 0]);
  meter.record({ provider: "mistral", source: "dm", promptTokens: 700, completionTokens: 70 });
  clock.t += 2 * 60 * 1000;
  meter.record({ provider: "mistral", source: "dm", promptTokens: 100, completionTokens: 10 });
  const snapshot = meter.snapshot();
  assert.equal(snapshot.day, "2026-10-04");
  assert.deepEqual([snapshot.calls, snapshot.promptTokens], [1, 100]);
  assert.deepEqual([snapshot.previous.day, snapshot.previous.calls, snapshot.previous.promptTokens], ["2026-10-03", 2, 700]);
  snapshot.calls = 99;
  assert.equal(meter.snapshot().calls, 1, "a snapshot is a copy");
});

test("A provider is demoted only after enough samples and a high refusal share, and is asked first again 20 minutes later", () => {
  const clock = { t: 1_000_000 };
  const tracker = createRefusalTracker({ now: () => clock.t });
  for (let i = 0; i < 3; i += 1) tracker.record("openrouter3", "dm", true);
  assert.equal(tracker.demoted("openrouter3", "dm"), false, "three samples are not enough");
  tracker.record("openrouter3", "dm", true);
  assert.equal(tracker.demoted("openrouter3", "dm"), true);
  assert.equal(tracker.rate("openrouter3", "dm"), 1);
  assert.equal(tracker.demoted("openrouter3", "scene"), false, "per kind of request");
  assert.equal(tracker.demoted("mistral", "dm"), false, "per provider");
  assert.equal(tracker.demoted("openrouter3", " DM "), true, "the kind is compared case-insensitively");
  clock.t += 19 * 60 * 1000;
  assert.equal(tracker.demoted("openrouter3", "dm"), true, "still demoted after 19 minutes");
  clock.t += 2 * 60 * 1000;
  assert.equal(tracker.demoted("openrouter3", "dm"), false, "21 minutes later it is asked first again");
  assert.equal(tracker.rate("openrouter3", "dm"), 0);
});

test("Three refusals in four is demotion, half is not; a run of good answers clears it", () => {
  const tracker = createRefusalTracker({ now: () => 5000 });
  [true, true, false, true].forEach((refused) => tracker.record("p", "dm", refused));
  assert.equal(tracker.demoted("p", "dm"), true);
  const half = createRefusalTracker({ now: () => 5000 });
  [true, false, true, false].forEach((refused) => half.record("p", "dm", refused));
  assert.equal(half.demoted("p", "dm"), false);
  for (let i = 0; i < 6; i += 1) tracker.record("p", "dm", false);
  assert.equal(tracker.demoted("p", "dm"), false);
});

test("The chain keeps its order except that refusers go to the end; if all refuse, nothing changes", () => {
  const tracker = createRefusalTracker({ now: () => 5000 });
  const refuse = (provider) => { for (let i = 0; i < 5; i += 1) tracker.record(provider, "dm", true); };
  refuse("openrouter3");
  assert.deepEqual(orderByRefusals(["openrouter3", "mistral", "mistral2"], "dm", tracker), ["mistral", "mistral2", "openrouter3"]);
  assert.deepEqual(orderByRefusals(["openrouter3", "mistral", "mistral2"], "scene", tracker), ["openrouter3", "mistral", "mistral2"]);
  refuse("mistral"); refuse("mistral2");
  assert.deepEqual(orderByRefusals(["openrouter3", "mistral", "mistral2"], "dm", tracker), ["openrouter3", "mistral", "mistral2"]);
  assert.deepEqual(orderByRefusals(["a", "b"], "dm", null), ["a", "b"]);
  assert.deepEqual(orderByRefusals(undefined, "dm", tracker), []);
});

test("A 503 'high demand' is about the model, not the key: it rests that model on every key for a minute", () => {
  const clock = { t: 1_000_000 };
  const ledger = createGeminiLedger({ now: () => clock.t });
  const outcome = ledger.fail("k1", "gemini-3.8-flash", { status: 503, message: "This model is currently experiencing high demand. Spikes in demand are usually temporary." });
  assert.deepEqual([outcome.level, outcome.metric, outcome.restMs, outcome.retryable], ["model-busy", "busy", 60000, true]);
  assert.equal(ledger.restMs("k2", "gemini-3.8-flash"), 60000, "another key, same model");
  assert.equal(ledger.restMs("k1", "gemini-3.7-flash"), 0, "another model");
  clock.t += 61000;
  assert.equal(ledger.restMs("k2", "gemini-3.8-flash"), 0, "a minute later it is tried again");
  assert.equal(ledger.fail("k1", "m", { status: 503, message: "Service Unavailable" }).metric, "unavailable", "a plain 503 keeps the run-of-failures rule");
});

test("A daily limit of ZERO means the model has no free quota at all: it rests on every key at once, it is not 'used up'", () => {
  const now = Date.UTC(2026, 9, 4, 12, 30, 0);
  const zero = { error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "0", quotaDimensions: { model: "gemini-3.1-pro-preview" } }] }] } };
  const info = geminiRateLimitInfo(zero, now);
  assert.deepEqual([info.metric, info.limit, info.limitKnown], ["per-day", 0, true]);
  const ledger = createGeminiLedger({ now: () => now });
  const outcome = ledger.fail("k2", "gemini-3.1-pro-preview", { status: 429, payload: zero });
  assert.equal(outcome.level, "model-no-free-quota");
  assert.ok(ledger.restMs("k5", "gemini-3.1-pro-preview") > 3600 * 1000, "every other key rests too, without being asked");
  assert.equal(ledger.restMs("k2", "gemini-3.8-flash"), 0, "other models are untouched");
  /* a real limit that was reached is still per key and per model */
  const reached = { error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250" }] }] } };
  const other = createGeminiLedger({ now: () => now });
  assert.equal(other.fail("k2", "gemini-3.8-flash", { status: 429, payload: reached }).level, "model");
  assert.equal(other.restMs("k3", "gemini-3.8-flash"), 0, "the other key still has its own 250");
  /* no quotaValue at all: not taken for zero */
  const unknown = geminiRateLimitInfo({ error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } }, now);
  assert.deepEqual([unknown.limit, unknown.limitKnown], [0, false]);
  assert.equal(createGeminiLedger({ now: () => now }).fail("k", "m", { status: 429, payload: { error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } } }).level, "model");
});


test("Active app language is authoritative across every generated user-visible AI surface", () => {
  const social = fs.readFileSync(new URL("../src/socialWorldPolicy.js", import.meta.url), "utf8");
  assert.match(social, /ACTIVE APP LANGUAGE — HARD CONTRACT/);
  assert.match(social, /If the active language is English: DMs, Scenes, posts, captions, Notes, comments, replies, group-chat lines, gossip, notifications, summaries, relationship prose/);
  assert.match(social, /Do NOT switch languages merely because the newest player message/);
  assert.match(social, /const combinedPolicy = `\$\{ACTIVE_LANGUAGE_POLICY\}/);
});
