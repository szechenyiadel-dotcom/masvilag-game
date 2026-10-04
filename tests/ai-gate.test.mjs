import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import {
  isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, FREE_WRITING_CHAIN, planGroqRequest,
  isGroqUtilitySource, groqCarriesWhole, estimateGroqTokens, groqPaceMaxWaitMs, createGroqPacer, groqRetryMs, GROQ_UTILITY_CHAIN, GROQ_UTILITY_SOURCES,
  createGeminiLedger, geminiModelConfig, geminiModelLadder, planGeminiAttempts, geminiBlockReason, looksLikeRefusal, requestExpectsJson,
  PAID_INPUT_PROVIDERS, paidMaxInputChars, paidCeilingFor, planCharBudget, createUsageMeter, createRefusalTracker, orderByRefusals,
} from "../server/aiPolicy.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

/* The real routing code of server/proxy.js, run against scripted providers. */
const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module" });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const NAMES = [
  "MISTRAL_API_KEY", "MISTRAL_API_KEY_2", "MISTRAL_MODEL", "GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_MODEL", "GROQ_MODEL_2",
  "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_MODEL_ENV", "GEMINI_PAID_KEY", "GEMINI_FREE_KEYS", "GEMINI_KEYS", "AI_ALLOW_PAID_BACKGROUND",
  "AI_GROQ_MAX_INPUT_CHARS", "AI_PROMPT_DEBUG", "AI_GATE", "AI_REFUSALS", "GEMINI_LEDGER", "GEMINI_MODELS", "groqRequestSize",
  "extractText", "proxyErrorMessage", "configuredAIProvider", "aiRequestText", "aiRequestChars", "inferAIRequestSource",
  "providerAllowedForBody", "taskProviderOrder", "healthyProvider", "providerCooldownMs", "providerModel", "parseRetryAfterMs",
  "safeProviderMessage", "markProviderFailure", "markProviderSuccess", "summarizeProviderFailures", "logFullAIPromptDebug",
  "shouldUseEmergencyOpenAIFallback", "answerText", "executeAITask",
];

function gate(env, scripted) {
  const calls = [];
  const context = vm.createContext({
    process: { env: { OPENROUTER_API_KEY: "or", OPENROUTER_API_KEY_2: "or2", OPENROUTER_MODEL_3: "nvidia/nemotron-3-ultra-550b-a55b:free", ...env } },
    console: { info() {}, warn() {}, error() {} },
    Date, Math, Number, String, Array, Set, Map, Object, JSON, RegExp, Error,
    isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, FREE_WRITING_CHAIN,
    isGroqUtilitySource, groqCarriesWhole, GROQ_UTILITY_CHAIN, groqRetryMs, createGeminiLedger, geminiModelConfig, geminiModelLadder, planGeminiAttempts, geminiBlockReason, looksLikeRefusal, requestExpectsJson, createRefusalTracker, orderByRefusals,
    callMessageProvider: async (provider, body) => { calls.push(provider); return scripted(provider, body); },
  });
  vm.runInContext(pick(NAMES), context);
  return { context, calls };
}

const ok = (provider) => ({ ok: true, payload: { content: [{ type: "text", text: "hi" }] }, provider });
const quota = (provider) => ({ ok: false, status: 429, payload: { error: { message: "rate limit" } }, retryAfter: "30", provider });
const ENV = {
  MISTRAL_API_KEY: "m1", MISTRAL_API_KEY_2: "m2", MISTRAL_MODEL: "mistral-small",
  GROQ_API_KEY: "g1", GROQ_API_KEY_2: "g2", GROQ_MODEL: "groq-model",
  GEMINI_API_KEY: "paid", GEMINI_API_KEY_2: "free2", GEMINI_MODEL: "gemini-x",
  OPENAI_API_KEY: "oa",
};
const task = (context, source, extra = {}) => ({ requestedProvider: "anthropic", source, body: { source, system: "s", messages: [{ role: "user", content: "hello" }], ...extra } });

test("DM uses Dolphin key 1, Venice key 2, then Mistral; Nemotron is reserved for Gemini fallback", () => {
  const { context } = gate(ENV, () => ok("x"));
  const order = (source, extra = {}) => Array.from(context.taskProviderOrder("anthropic", task(context, source, extra).body));
  for (const extra of [{}, { foreground: true }]) {
    assert.deepEqual(order("dm", extra), ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"], "dm " + JSON.stringify(extra));
    assert.deepEqual(order("scene", extra), ["mistral", "mistral2"], "scene " + JSON.stringify(extra));
  }
  assert.deepEqual(order("comments"), ["gemini", "groq", "groq2", "openrouter"]);
  assert.deepEqual(order("comments", { foreground: true }), ["mistral", "mistral2"]);
  for (const source of ["comments", "notes", "meaning-analysis", "autonomy-other", "group-chat", "ambient-popup"]) {
    const background = order(source);
    for (const billed of ["mistral", "mistral2", "openai", "anthropic"]) assert.ok(!background.includes(billed), `${source} must not list ${billed}`);
    assert.ok(!background.includes("openrouter3"), `${source} must not use Nemotron`);
  }
  assert.deepEqual(order("feed-post"), ["gemini", "openrouter3"]);
  assert.deepEqual(order("sheet-summary"), ["gemini", "openrouter3"]);
  assert.deepEqual(Array.from(FREE_WRITING_CHAIN), ["gemini", "groq", "groq2", "openrouter", "openrouter2"]);
});

test("Feed uses free Nemotron after Gemini and before OpenAI", () => {
  const withFree = gate(ENV, () => ok("x"));
  assert.deepEqual(Array.from(withFree.context.taskProviderOrder("anthropic", task(withFree.context, "feed-post").body)), ["gemini", "openrouter3"]);
  const paidGeminiOnly = gate({ ...ENV, GEMINI_API_KEY_2: "" }, () => ok("x"));
  assert.deepEqual(Array.from(paidGeminiOnly.context.taskProviderOrder("anthropic", task(paidGeminiOnly.context, "feed-post").body)), ["openrouter3"]);
  assert.deepEqual(Array.from(paidGeminiOnly.context.taskProviderOrder("anthropic", task(paidGeminiOnly.context, "feed-post", { foreground: true }).body)), ["gemini", "openrouter3", "openai"]);
});

test("Background request with every free provider rate-limited WAITS: a 503 with Retry-After, no paid call", async () => {
  const { context, calls } = gate(ENV, (provider) => quota(provider));
  const result = await context.executeAITask(task(context, "feed-post"));
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.waiting, true);
  assert.ok(Number(result.retryAfter) >= 20, "waits at least 20 s, got " + result.retryAfter);
  assert.equal(result.payload.error.type, "free_ai_waiting");
  assert.deepEqual(Array.from(calls), ["gemini", "openrouter3"]);
  assert.ok(!calls.includes("openai") && !calls.includes("anthropic") && !calls.includes("mistral"), "paid providers called: " + calls);
});

test("Background request with no free provider configured waits instead of failing hard", async () => {
  const { context, calls } = gate({ OPENAI_API_KEY: "oa", OPENROUTER_API_KEY: "", OPENROUTER_API_KEY_2: "", GEMINI_API_KEY: "", GEMINI_API_KEY_2: "" }, () => ok("openai"));
  const result = await context.executeAITask(task(context, "feed-post"));
  assert.equal(result.waiting, true);
  assert.equal(result.status, 503);
  assert.deepEqual(Array.from(calls), []);
});

test("A free provider that answers is used normally for background work, and Mistral is never called", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "gemini" ? quota(provider) : ok(provider)));
  const result = await context.executeAITask(task(context, "comments"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["gemini", "groq"]);
});

test("A background DM uses Dolphin key 1, Venice key 2, then Mistral 1 and 2", async () => {
  const first = gate(ENV, (provider) => ok(provider));
  const written = await first.context.executeAITask(task(first.context, "dm"));
  assert.equal(written.ok, true);
  assert.deepEqual(Array.from(first.calls), ["openrouter-dm-dolphin"], "Dolphin is the first DM provider");
  const down = gate(ENV, (provider) => quota(provider));
  const result = await down.context.executeAITask(task(down.context, "dm"));
  assert.equal(result.waiting, true);
  assert.equal(result.status, 503);
  assert.deepEqual(Array.from(down.calls), ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"]);
  assert.ok(!down.calls.some((provider) => ["openai", "gemini", "groq", "groq2", "openrouter3"].includes(provider)), "no other provider wrote the voice: " + down.calls);
});

test("A prose refusal from Dolphin falls through to Venice, and Venice refusal falls through to Mistral", async () => {
  const refusal = (provider) => ({ ok: true, payload: { content: [{ type: "text", text: "I'm sorry, I can't continue with that request." }] }, provider });
  const { context, calls } = gate(ENV, (provider) => (provider === "openrouter-dm-dolphin" || provider === "openrouter-dm-venice") ? refusal(provider) : ok(provider));
  const result = await context.executeAITask(task(context, "dm"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral"]);
});

test("The emergency OpenAI fallback is closed to background work and still open to a player who is waiting", () => {
  const { context } = gate(ENV, () => ok("x"));
  const aiGate = vm.runInContext("AI_GATE", context);
  for (const id of ["groq", "groq2"]) aiGate.providerCooldownUntil.set(id, Date.now() + 60000);
  const geminiDown = [{ provider: "gemini", status: 503 }];
  const feed = (extra) => ({ requestedProvider: "gemini", body: { source: "feed-post", system: "s", messages: [], ...extra } });
  assert.equal(context.shouldUseEmergencyOpenAIFallback(feed({ foreground: true }), geminiDown), true, "the same outage lets a waiting player through");
  assert.equal(context.shouldUseEmergencyOpenAIFallback(feed({}), geminiDown), false, "background work waits instead");
});

test("A player waiting on a DM still starts on Dolphin", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "openrouter-dm-dolphin" ? ok(provider) : quota(provider)));
  const result = await context.executeAITask(task(context, "dm", { foreground: true }));
  assert.equal(result.ok, true);
  assert.equal(calls[0], "openrouter-dm-dolphin");
});

test("AI_ALLOW_PAID_BACKGROUND=1 is the only way background work reaches paid providers", () => {
  const { context } = gate({ ...ENV, AI_ALLOW_PAID_BACKGROUND: "1" }, () => ok("x"));
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", task(context, "feed-post").body)), ["gemini", "openrouter3", "openai"]);
});

test("Gemini quota, credit and key errors never rest or switch off the whole provider: the ledger rests the exact pair", () => {
  const { context } = gate(ENV, () => ok("x"));
  const aiGate = vm.runInContext("AI_GATE", context);
  for (const [status, message] of [[402, "Your prepayment credits are depleted."], [429, "quota"], [403, "key blocked"], [401, "bad key"], [404, "models/x is not found"]]) {
    const rest = context.markProviderFailure("gemini", "gemini-x", { status, retryAfter: "7200", payload: { error: { message } } });
    assert.equal(rest, 0, String(status));
    assert.ok(!aiGate.providerConfigurationErrors.has("gemini"), status + " is not a broken configuration");
    assert.equal(context.providerCooldownMs("gemini"), 0, status + " does not rest Gemini as a whole");
  }
  /* a run of server errors still gives the provider a short rest, and every other provider keeps the strict rule */
  assert.ok(context.markProviderFailure("gemini", "gemini-x", { status: 503, payload: { error: { message: "overloaded" } } }) > 0);
  context.markProviderFailure("openai", "gpt", { status: 401, payload: { error: { message: "bad key" } } });
  assert.ok(aiGate.providerConfigurationErrors.has("openai"));
});

test("A Gemini 'come back at' still sets how long a waiting background request is told to wait", async () => {
  const spent = (provider) => (provider === "gemini"
    ? { ok: false, status: 429, retryAfter: "1800", payload: { error: { message: "All free Gemini keys are resting" } }, provider }
    : { ok: false, status: 503, payload: { error: { message: "unavailable" } }, provider });
  const { context } = gate({ ...ENV, GROQ_API_KEY: "", GROQ_API_KEY_2: "" }, spent);
  const result = await context.executeAITask(task(context, "feed-post"));
  assert.equal(result.waiting, true);
  assert.ok(Number(result.retryAfter) >= 600 && Number(result.retryAfter) <= 900, "uses Gemini's own time, capped at fifteen minutes: " + result.retryAfter);
});

test("proxy.js rests each Gemini (key, model) pair by the error it returned, including spent credit", () => {
  assert.match(source, /GEMINI_LEDGER\.fail\(key, model, \{ status, message: proxyErrorMessage\(result && result\.payload, ""\), payload: result && result\.payload \}\)/);
  assert.match(source, /out of quota \(" \+ outcome\.metric \+ \(outcome\.limit \? ", limit " \+ outcome\.limit : ""\)/, "the log says per-minute or per-day, and the limit Google reports");
  assert.match(source, /out of prepaid credit/);
});

/* The real Groq request path of proxy.js against a fake Groq. */
function groqPath({ env = {}, respond, pacer = createGroqPacer() } = {}) {
  const sent = [];
  respond = respond || (() => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: "hello" } }] }) }));
  const context = vm.createContext({
    process: { env }, console: { info() {}, warn() {}, error() {} },
    Date, Math, Number, String, Array, Set, Map, Object, JSON, RegExp, Error, AbortController, setTimeout, clearTimeout,
    planGroqRequest, isForegroundRequest, estimateGroqTokens, groqPaceMaxWaitMs,
    PAID_INPUT_PROVIDERS, paidMaxInputChars, paidCeilingFor, planCharBudget, createUsageMeter,
    GROQ_PACER: pacer,
    fetch: async (url, options) => {
      sent.push(JSON.parse(options.body));
      return respond({ url, options });
    },
  });
  vm.runInContext(pick(["AI_UPSTREAM_TIMEOUT_MS", "GROQ_API_KEY_2", "GROQ_MODEL", "GROQ_MODEL_2", "PAID_MAX_INPUT_CHARS", "AI_USAGE", "AI_GATE", "providerCooldownMs", "groqSiblingReady", "groqRequestSize", "extractText", "aiRequestText", "aiRequestChars", "preservePromptEdges", "buildCompatibleChatPayload", "normalizeOpenAIResponse", "upstreamTimeoutFor", "proxyCompatibleMessage"]), context);
  return { context, sent, pacer, usage: vm.runInContext("AI_USAGE", context) };
}
const chatBody = (extra = {}) => ({ source: "dm", system: "S".repeat(9000), messages: [{ role: "user", content: "U".repeat(30000) }], max_tokens: 1024, ...extra });
const textLength = (payload) => payload.messages.reduce((n, m) => n + m.content.length, 0);

test("Groq: a long chat request is shortened to its per-minute budget before it is sent", async () => {
  const { context, sent } = groqPath();
  const result = await context.proxyCompatibleMessage("groq", "key", "openai/gpt-oss-120b", "https://api.groq.com/openai/v1/chat/completions", chatBody());
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  const chars = textLength(sent[0]);
  assert.ok(chars <= planGroqRequest({ maxTokens: 1024, systemChars: 9000, messageChars: [30000] }).maxChars + 200, "sent " + chars + " chars");
  assert.equal(sent[0].max_tokens, 1024);
});

test("Groq: a short request goes out exactly as it is", async () => {
  const { context, sent } = groqPath();
  await context.proxyCompatibleMessage("groq2", "key", "m", "https://api.groq.com/x", chatBody({ system: "short system", messages: [{ role: "user", content: "short question" }] }));
  assert.equal(sent[0].messages[0].content, "short system");
  assert.equal(sent[0].messages[1].content, "short question");
});

test("Groq: a request with a huge output allowance is skipped at once, with no network call", async () => {
  const { context, sent } = groqPath();
  const result = await context.proxyCompatibleMessage("groq", "key", "m", "https://api.groq.com/x", chatBody({ max_tokens: 6500 }));
  assert.deepEqual([result.ok, result.status, result.skipped], [false, 413, true]);
  assert.match(result.payload.error.message, /skipped: output allowance/);
  assert.equal(sent.length, 0);
});

test("Other providers are not shortened by the Groq rule", async () => {
  const { context, sent } = groqPath();
  await context.proxyCompatibleMessage("mistral", "key", "m", "https://api.mistral.ai/x", chatBody());
  assert.equal(textLength(sent[0]), 9000 + 30000);
});

/* ---------- utility tasks on Groq, paced ---------- */

test("Utility tasks (meaning, translation, music note, relationship impact) go to Groq first, then free Gemini", () => {
  const { context } = gate(ENV, () => ok("x"));
  const order = (source, extra = {}) => Array.from(context.taskProviderOrder("anthropic", { ...task(context, source, extra).body, max_tokens: 600 }));
  for (const source of Array.from(GROQ_UTILITY_SOURCES)) {
    assert.deepEqual(order(source), ["groq", "groq2", "gemini"], source);
    assert.deepEqual(order(source, { foreground: true }), ["groq", "groq2", "gemini"], source + " (player waiting)");
  }
});

test("Everything that gives a character a voice keeps its own chain, Groq only as a free fallback after Gemini", () => {
  const { context } = gate(ENV, () => ok("x"));
  const order = (source, extra = {}) => Array.from(context.taskProviderOrder("anthropic", { ...task(context, source, extra).body, max_tokens: 600 }));
  assert.equal(order("dm")[0], "openrouter-dm-dolphin");
  assert.equal(order("scene")[0], "mistral");
  for (const source of ["comments", "player-post-comments-isolated"]) assert.equal(order(source)[0], "gemini", source);
  assert.deepEqual(order("feed-post"), ["gemini", "openrouter3"]);
  assert.deepEqual(order("sheet-summary"), ["gemini", "openrouter3"]);
  assert.deepEqual(order("character-bible"), ["gemini", "openrouter3"]);
  for (const source of ["group-chat", "notes", "autonomy-other", "scene-roleplay"]) assert.equal(order(source)[0], "gemini", source + " starts on Gemini");
});

test("A utility request too long for Groq goes to Gemini alone: a translation cut short would be wrong", () => {
  const { context } = gate(ENV, () => ok("x"));
  const long = { source: "display-translate", system: "s", messages: [{ role: "user", content: "x".repeat(15000) }], max_tokens: 3500 };
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", long)), ["gemini"]);
  const fits = { ...long, messages: [{ role: "user", content: "x".repeat(3000) }], max_tokens: 1500 };
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", fits)), ["groq", "groq2", "gemini"]);
});

test("A paced Groq answer is not a failure: no cooldown, the next provider takes the request", async () => {
  const paced = (provider) => ({ ok: false, status: 429, paced: true, retryAfter: "4", payload: { error: { message: provider + " is busy" } }, provider });
  const { context, calls } = gate(ENV, (provider) => (provider.startsWith("groq") ? paced(provider) : ok(provider)));
  const result = await context.executeAITask({ requestedProvider: "anthropic", source: "meaning-analysis", body: { source: "meaning-analysis", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 500 } });
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["groq", "groq2", "gemini"]);
  assert.equal(context.providerCooldownMs("groq"), 0, "Groq is not put to rest because it was busy");
  assert.equal(context.providerCooldownMs("groq2"), 0);
});

test("When every provider was only busy, a background request is told to come back soon, not given a paid answer", async () => {
  const busy = (provider) => ({ ok: false, status: 429, paced: true, retryAfter: "7", payload: { error: { message: provider + " is busy" } }, provider });
  const { context, calls } = gate(ENV, busy);
  const result = await context.executeAITask({ requestedProvider: "anthropic", source: "display-translate", body: { source: "display-translate", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 500 } });
  assert.equal(result.waiting, true);
  assert.equal(result.status, 503);
  assert.ok(Number(result.retryAfter) <= 30, "soon: " + result.retryAfter);
  assert.ok(!calls.some((provider) => ["openai", "mistral", "openrouter3"].includes(provider)));
});

test("A Groq 429 rests the key for as long as Groq says: seconds for the minute limit, the stated time for the daily one", () => {
  const { context } = gate(ENV, () => ok("x"));
  const minute = context.markProviderFailure("groq", "m", { status: 429, retryAfter: "37", payload: { error: { message: "Rate limit reached ... on tokens per minute (TPM)" } } });
  assert.ok(minute >= 37000 && minute <= 39000, "minute limit: " + minute);
  const daily = context.markProviderFailure("groq2", "m", { status: 429, payload: { error: { message: "Rate limit reached on tokens per day (TPD): Limit 200000. Please try again in 56m13.92s. Need more tokens?" } } });
  assert.ok(daily >= 3373000 && daily <= 3376000, "daily limit: " + daily);
  const huge = context.markProviderFailure("groq", "m", { status: 429, payload: { error: { message: "try again in 30h0m0s" } } });
  assert.equal(huge, 6 * 3600 * 1000, "never rests longer than six hours at a time");
});

function holdOpen() {
  const gates = [];
  const respond = () => new Promise((resolve) => gates.push(() => resolve({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: "done" } }], usage: { total_tokens: 900 } }) })));
  return { gates, respond };
}
const quickPacer = () => createGroqPacer({ sleep: () => new Promise((resolve) => setTimeout(resolve, 5)) });
const small = (extra = {}) => ({ source: "meaning-analysis", system: "s", messages: [{ role: "user", content: "hello" }], max_tokens: 500, ...extra });
const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
const callGroq = (context, provider, body) => context.proxyCompatibleMessage(provider, "key", "m", groqUrl, body);
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

test("Groq: two requests never run on one key at the same time; the second goes out only after the first came back", async () => {
  const { gates, respond } = holdOpen();
  const { context, sent } = groqPath({ respond, pacer: quickPacer() });   /* no second key, so the second request waits */
  const first = callGroq(context, "groq", small());
  const second = callGroq(context, "groq", small());
  await flush();
  assert.equal(sent.length, 1, "only the first is out");
  gates[0]();
  assert.equal((await first).ok, true);
  await flush();
  assert.equal(sent.length, 2, "the second went out once the key was free");
  gates[1]();
  assert.equal((await second).ok, true);
});

test("Groq: with a second key ready, a busy first key hands the request on at once instead of making it wait", async () => {
  const { gates, respond } = holdOpen();
  const { context, sent } = groqPath({ respond, pacer: quickPacer(), env: { GROQ_API_KEY_2: "k2", GROQ_MODEL: "m" } });
  const first = callGroq(context, "groq", small());
  await flush();
  const turnedAway = await callGroq(context, "groq", small());
  assert.deepEqual([turnedAway.ok, turnedAway.status, turnedAway.paced], [false, 429, true]);
  assert.equal(sent.length, 1, "no network call for the turned-away one");
  const other = callGroq(context, "groq2", small());
  await flush();
  assert.equal(sent.length, 2, "the second key took it");
  gates.forEach((open) => open());
  assert.equal((await first).ok && (await other).ok, true);
});

test("Groq: the tokens Groq reports are what counts against the minute, and a failed request still frees the key", async () => {
  const done = groqPath({ pacer: quickPacer(), respond: () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: "x" } }], usage: { total_tokens: 640 } }) }) });
  await callGroq(done.context, "groq", small());
  assert.deepEqual(done.pacer.state("groq"), { busy: false, spentTokens: 640 });

  const failed = groqPath({ pacer: quickPacer(), respond: () => ({ ok: false, status: 429, headers: { get: () => "10" }, text: async () => JSON.stringify({ error: { message: "rate limit" } }) }) });
  const result = await callGroq(failed.context, "groq", small());
  assert.equal(result.status, 429);
  assert.equal(result.paced, undefined, "a real Groq 429 is not a pacing answer");
  assert.equal(failed.pacer.state("groq").busy, false);
});

test("Groq: a request that cannot fit this minute's budget is turned away with the time to come back", async () => {
  const pacer = createGroqPacer({ sleep: () => Promise.resolve() });
  pacer.tryAcquire("groq", 7000).release();
  const { context, sent } = groqPath({ pacer, env: { GROQ_API_KEY_2: "k2", GROQ_MODEL: "m" } });
  const result = await callGroq(context, "groq", small());
  assert.deepEqual([result.status, result.paced], [429, true]);
  assert.ok(Number(result.retryAfter) > 40, "tells how long: " + result.retryAfter);
  assert.equal(sent.length, 0);
});

test("proxy.js wires the pacer into every Groq call and the vision runner shares it", () => {
  assert.match(source, /const GROQ_PACER = createGroqPacer\(\)/);
  assert.match(source, /GROQ_PACER\.acquire\(provider, estimateGroqTokens/);
  assert.match(source, /if \(lease\) lease\.release\(usedTokens\)/);
  assert.match(source, /pacer: GROQ_PACER/);
  assert.match(source, /if \(result\?\.paced\)/);
});

test("Groq: when the second key is resting, the first key waits for its own turn instead of handing on", async () => {
  const { gates, respond } = holdOpen();
  const { context, sent } = groqPath({ respond, pacer: quickPacer(), env: { GROQ_API_KEY_2: "k2", GROQ_MODEL: "m" } });
  vm.runInContext("AI_GATE.providerCooldownUntil.set('groq2', Date.now() + 600000)", context);
  const first = callGroq(context, "groq", small());
  const second = callGroq(context, "groq", small());
  await flush();
  assert.equal(sent.length, 1, "the second request is waiting for the key, not turned away");
  gates[0]();
  await first;
  await flush();
  assert.equal(sent.length, 2);
  gates[1]();
  assert.equal((await second).ok, true);
});

/* ---------- the real Gemini request path, against a scripted Gemini ---------- */

function geminiPath({ env = {}, respond }) {
  const requests = [];
  const logs = [];
  const context = vm.createContext({
    process: { env: { GEMINI_API_KEY_2: "f2", GEMINI_API_KEY_3: "f3", GEMINI_API_KEY_4: "f4", ...env } },
    console: { info() {}, warn: (...args) => logs.push(args.join(" ")), error() {} },
    Date, Math, Number, String, Array, Set, Map, Object, JSON, RegExp, Error, URL, AbortController, setTimeout, clearTimeout,
    isForegroundRequest, createGeminiLedger, geminiModelConfig, geminiModelLadder, planGeminiAttempts, geminiBlockReason,
    fetchWithTimeout: async (url) => {
      const key = url.searchParams.get("key");
      const model = decodeURIComponent(url.pathname.split("/models/")[1].split(":")[0]);
      requests.push({ key, model });
      const answer = await respond({ key, model, n: requests.length });
      return { ok: answer.status < 300, status: answer.status, headers: { get: (name) => (name === "retry-after" ? answer.retryAfter || null : null) }, text: async () => JSON.stringify(answer.payload) };
    },
  });
  vm.runInContext(pick(["AI_UPSTREAM_TIMEOUT_MS", "upstreamTimeoutFor", "extractText", "buildGeminiPayload", "normalizeGeminiResponse", "responseJsonSafe", "proxyErrorMessage",
    "GEMINI_PAID_KEY", "GEMINI_FREE_KEYS", "GEMINI_KEYS", "AI_ALLOW_PAID_BACKGROUND", "GEMINI_LEDGER", "GEMINI_MODELS", "proxyGeminiMessageWithKey", "proxyGeminiMessage"]), context);
  return { context, requests, logs, ledger: vm.runInContext("GEMINI_LEDGER", context) };
}
const geminiOk = (text = "hi") => ({ status: 200, payload: { candidates: [{ content: { parts: [{ text }] } }] } });
const geminiDayLimit = (model) => ({ status: 429, payload: { error: { message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250", quotaDimensions: { model } }] }] } } });
const geminiBody = (extra = {}) => ({ source: "dm", system: "s", messages: [{ role: "user", content: "hello" }], max_tokens: 200, ...extra });

test("Gemini: a model whose daily quota is spent on a key moves on to the next model on a free key, and the result says which model answered", async () => {
  const { context, requests, logs, ledger } = geminiPath({ respond: ({ model }) => (model === "gemini-3.8-flash" ? geminiDayLimit(model) : geminiOk("fallback answer")) });
  const result = await context.proxyGeminiMessage(geminiBody());
  assert.equal(result.ok, true);
  assert.equal(result.model, "gemini-3.7-flash", "the next full model answered");
  assert.deepEqual(requests.map((r) => r.model), ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.7-flash"]);
  assert.ok(ledger.restMs("f2", "gemini-3.8-flash") > 0 || ledger.restMs("f3", "gemini-3.8-flash") > 0);
  assert.ok(logs.some((line) => /out of quota \(per-day, limit 250, GenerateRequestsPerDay/.test(line)), "the log shows the limit Google reported: " + logs.join(" | "));
});

test("Gemini: each spent pair is probed once; after that requests go straight to what works", async () => {
  const { context, requests } = geminiPath({ respond: ({ model }) => (model === "gemini-3.8-flash" ? geminiDayLimit(model) : geminiOk()) });
  await context.proxyGeminiMessage(geminiBody());
  await context.proxyGeminiMessage(geminiBody());
  await context.proxyGeminiMessage(geminiBody());   /* all three keys now know the main model is spent */
  requests.length = 0;
  for (let i = 0; i < 4; i += 1) await context.proxyGeminiMessage(geminiBody());
  assert.equal(requests.length, 4, "one call per request, none wasted");
  assert.ok(requests.every((r) => r.model === "gemini-3.7-flash"), JSON.stringify(requests));
});

test("Gemini: a character's voice never lands on a lite model, light utility work starts there", async () => {
  const dm = geminiPath({ respond: () => geminiOk() });
  assert.equal((await dm.context.proxyGeminiMessage(geminiBody({ source: "dm" }))).model, "gemini-3.8-flash");
  const translate = geminiPath({ respond: () => geminiOk() });
  assert.equal((await translate.context.proxyGeminiMessage(geminiBody({ source: "display-translate" }))).model, "gemini-3.5-flash-lite");
  /* everything is spent except the lite models: a voice request waits, a translation is answered */
  const onlyLite = ({ model }) => (/lite/.test(model) ? geminiOk() : geminiDayLimit(model));
  const spent = geminiPath({ respond: onlyLite });
  for (const key of ["f2", "f3", "f4"]) for (const model of ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]) spent.ledger.fail(key, model, { status: 429, payload: geminiDayLimit(model).payload });
  const voice = await spent.context.proxyGeminiMessage(geminiBody({ source: "dm" }));
  assert.equal(voice.ok, false);
  assert.equal(voice.status, 429, "the voice waits rather than being given to a lite model");
  assert.equal(spent.requests.length, 0, "and nothing was even sent");
  assert.ok(Number(voice.retryAfter) > 3600, "told to come back at the reset: " + voice.retryAfter);
  assert.equal((await spent.context.proxyGeminiMessage(geminiBody({ source: "music-note" }))).ok, true);
});

test("Gemini: one request tries at most four (key, model) pairs", async () => {
  const { context, requests } = geminiPath({ env: { GEMINI_API_KEY_5: "f5", GEMINI_API_KEY_6: "f6" }, respond: () => ({ status: 500, payload: { error: { message: "internal" } } }) });
  const result = await context.proxyGeminiMessage(geminiBody());
  assert.equal(result.ok, false);
  assert.ok(requests.length <= 4, "tried " + requests.length);
  assert.ok(requests.length >= 3);
});

test("Gemini: a key that keeps timing out is left alone for a while instead of being tried by every request", async () => {
  const { context, requests } = geminiPath({ env: { GEMINI_API_KEY_3: "", GEMINI_API_KEY_4: "" }, respond: () => ({ status: 504, payload: { error: { message: "deadline" } } }) });
  await context.proxyGeminiMessage(geminiBody());
  await context.proxyGeminiMessage(geminiBody());
  const before = requests.length;
  const third = await context.proxyGeminiMessage(geminiBody());
  assert.ok(requests.length - before < before / 2 + 1, "later requests stop hammering: " + before + " then " + (requests.length - before));
  assert.equal(third.ok, false);
});

test("Gemini: the retry hint is short while untried pairs remain, and the real wait once everything rests", async () => {
  const { context, ledger } = geminiPath({ env: { GEMINI_API_KEY_5: "f5", GEMINI_API_KEY_6: "f6" }, respond: ({ model }) => geminiDayLimit(model) });
  const first = await context.proxyGeminiMessage(geminiBody());
  assert.equal(first.status, 429);
  assert.equal(first.retryAfter, "3", "pairs were left untried (the attempts are capped), so come back at once");
  let last = first;
  for (let i = 0; i < 8 && Number(last.retryAfter) <= 3; i += 1) last = await context.proxyGeminiMessage(geminiBody());
  assert.ok(Number(last.retryAfter) > 600, "everything rests: " + last.retryAfter);
  assert.equal(last.provider, "gemini");
});

test("Gemini: a model that does not exist is dropped for every key and the next model answers", async () => {
  const { context, requests, ledger } = geminiPath({ respond: ({ model }) => (model === "gemini-3.8-flash" ? { status: 404, payload: { error: { message: "models/gemini-3.8-flash is not found for API version v1beta, or is not supported for generateContent." } } } : geminiOk()) });
  const result = await context.proxyGeminiMessage(geminiBody());
  assert.equal(result.ok, true);
  assert.equal(result.model, "gemini-3.7-flash");
  assert.equal(requests.filter((r) => r.model === "gemini-3.8-flash").length, 1, "tried once, not on every key");
  assert.ok(ledger.restMs("f4", "gemini-3.8-flash") > 0);
});

test("Gemini: the paid key is used only by a player who is waiting, after the free keys and models", async () => {
  const spent = ({ model }) => geminiDayLimit(model);
  const env = { GEMINI_API_KEY: "paid" };
  const background = geminiPath({ env, respond: ({ key, model }) => (key === "paid" ? geminiOk() : spent({ model })) });
  const wait = await background.context.proxyGeminiMessage(geminiBody());
  assert.equal(wait.ok, false);
  assert.ok(!background.requests.some((r) => r.key === "paid"), "background work never reaches the paid key");
  const player = geminiPath({ env, respond: ({ key, model }) => (key === "paid" ? geminiOk() : spent({ model })) });
  const answer = await player.context.proxyGeminiMessage(geminiBody({ foreground: true }));
  assert.equal(answer.ok, true);
  assert.equal(player.requests[player.requests.length - 1].key, "paid");
  assert.ok(player.requests.slice(0, -1).every((r) => r.key !== "paid"), "free pairs first");
});

test("Gemini: the starting key rotates between requests", async () => {
  const { context, requests } = geminiPath({ respond: () => geminiOk() });
  for (let i = 0; i < 6; i += 1) await context.proxyGeminiMessage(geminiBody());
  assert.deepEqual(requests.map((r) => r.key), ["f2", "f3", "f4", "f2", "f3", "f4"]);
});

test("Gemini: a bad key is rested for every model", async () => {
  const { context, requests, ledger } = geminiPath({ respond: ({ key }) => (key === "f2" ? { status: 400, payload: { error: { message: "API key not valid. Please pass a valid API key." } } } : geminiOk()) });
  const result = await context.proxyGeminiMessage(geminiBody());
  assert.equal(result.ok, true);
  assert.ok(ledger.restMs("f2", "gemini-3.5-flash-lite") > 20 * 3600 * 1000);
  requests.length = 0;
  for (let i = 0; i < 4; i += 1) await context.proxyGeminiMessage(geminiBody());
  assert.ok(!requests.some((r) => r.key === "f2"));
});

/* ---------- blocked and refused answers move on without hurting anything ---------- */

const jsonBody = (source, extra = {}) => ({ source, system: "Return valid JSON only.", messages: [{ role: "user", content: "write it" }], max_tokens: 300, ...extra });
const jsonTask = (source, extra = {}) => ({ requestedProvider: "anthropic", source, body: jsonBody(source, extra) });
const text = (provider, value) => ({ ok: true, payload: { content: [{ type: "text", text: value }] }, provider });
const REFUSAL = "I'm sorry, but I can't continue with this request.";

test("A Dolphin refusal is not an answer: Venice gets the same DM next", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "openrouter-dm-dolphin" ? text(provider, REFUSAL) : text(provider, '{"reply":"hello"}')));
  const result = await context.executeAITask(jsonTask("dm"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["openrouter-dm-dolphin", "openrouter-dm-venice"]);
  assert.match(result.payload.content[0].text, /hello/);
  assert.equal(context.providerCooldownMs("openrouter-dm-dolphin"), 0, "a prose refusal does not rest the provider");
});

test("Plain-prose DM refusals from Dolphin and Venice fall through to Mistral", async () => {
  const { context, calls } = gate(ENV, (provider) =>
    provider === "openrouter-dm-dolphin" || provider === "openrouter-dm-venice"
      ? text(provider, REFUSAL)
      : text(provider, "Mistral answered.")
  );
  const plain = await context.executeAITask({ requestedProvider: "anthropic", source: "dm", body: { source: "dm", system: "You are a narrator.", messages: [{ role: "user", content: "Tell me about the weather" }] } });
  assert.equal(plain.ok, true);
  assert.deepEqual(Array.from(calls), ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral"]);
});

test("When every provider that answered refused, the result is a 422 that says so, not a 'wait' that would repeat it forever", async () => {
  const { context, calls } = gate(ENV, (provider) => text(provider, REFUSAL));
  const result = await context.executeAITask(jsonTask("dm"));
  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
  assert.notEqual(result.waiting, true);
  assert.equal(result.payload.error.type, "content_refused");
  assert.deepEqual(Array.from(calls), ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"]);
  for (const provider of ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"]) assert.equal(context.providerCooldownMs(provider), 0);
});

test("A Gemini safety block hands the request on without resting Gemini, and Gemini keeps serving the next request", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "gemini" ? { ok: false, status: 422, blocked: true, payload: { error: { message: "Gemini blocked the answer (SAFETY)." } }, provider } : text(provider, '{"ok":true}')));
  const result = await context.executeAITask(jsonTask("comments"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["gemini", "groq"]);
  assert.equal(context.providerCooldownMs("gemini"), 0);
  assert.equal(vm.runInContext("AI_GATE", context).providerConfigurationErrors.has("gemini"), false);
});

test("A refusal followed by real outages is a normal failure, not a 'refused' verdict", async () => {
  const { context } = gate(ENV, (provider) => (provider === "openrouter-dm-dolphin" ? text(provider, REFUSAL) : { ok: false, status: 503, payload: { error: { message: "overloaded" } }, provider }));
  const result = await context.executeAITask(jsonTask("dm"));
  assert.notEqual(result.payload?.error?.type, "content_refused");
  assert.ok(result.waiting === true || result.status === 503, JSON.stringify(result).slice(0, 200));
});

test("Gemini: a blocked prompt costs one request, is not held against the key, and is handed on at once", async () => {
  const blocked = { status: 200, payload: { promptFeedback: { blockReason: "PROHIBITED_CONTENT" }, candidates: [] } };
  const { context, requests, ledger, logs } = geminiPath({ respond: () => blocked });
  const result = await context.proxyGeminiMessage(geminiBody({ source: "comments" }));
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, 422);
  assert.equal(requests.length, 1, "no other key or model was asked the same thing");
  for (let i = 0; i < 4; i += 1) await context.proxyGeminiMessage(geminiBody({ source: "comments" }));
  assert.equal(ledger.restMs("f2", "gemini-3.8-flash"), 0);
  assert.equal(ledger.restMs("f3", "gemini-3.8-flash"), 0);
  assert.equal(ledger.restMs("f4", "gemini-3.8-flash"), 0, "five blocked prompts in a row rested no key");
  assert.ok(logs.some((line) => /blocked the answer \(PROHIBITED_CONTENT\)/.test(line)));
});

test("Gemini: a filtered answer (finishReason SAFETY) is a block too; a plain empty answer is still an outage", async () => {
  const filtered = geminiPath({ respond: () => ({ status: 200, payload: { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] } }) });
  assert.equal((await filtered.context.proxyGeminiMessage(geminiBody())).blocked, true);
  const empty = geminiPath({ respond: () => ({ status: 200, payload: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "" }] } }] } }) });
  const result = await empty.context.proxyGeminiMessage(geminiBody());
  assert.equal(result.blocked, undefined);
  assert.equal(result.status, 502);
  assert.ok(empty.requests.length > 1, "an empty answer still tries the next pair");
});

test("The model that actually answered is the one reported, not always the first on the ladder", async () => {
  const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  assert.match(source, /model: result\?\.model \|\| providerModel\("gemini", body\)/);
});

/* ---------- the paid providers: a ceiling on what they are sent, and a meter on what they use ---------- */

const paidUrl = { openrouter3: "https://openrouter.ai/api/v1/chat/completions", mistral: "https://api.mistral.ai/v1/chat/completions", mistral2: "https://api.mistral.ai/v1/chat/completions" };
const callPaid = (context, provider, body) => context.proxyCompatibleMessage(provider, "key", "m", paidUrl[provider], body);
const bigBody = (extra = {}) => ({
  source: "dm",
  system: "SYSTEM RULES ".repeat(2500),                       /* ~32k */
  messages: [{ role: "user", content: "WORLD " .repeat(4000) + "\n[[PROTECTED_TAIL]]\nThe player just wrote: hello" }],   /* ~24k + tail */
  max_tokens: 800,
  ...extra,
});
const sentChars = (payload) => payload.messages.reduce((n, m) => n + m.content.length, 0);

test("DeepSeek and Mistral are sent at most the ceiling, whatever the prompt grew to, and the protected tail survives", async () => {
  for (const provider of ["openrouter3", "mistral", "mistral2"]) {
    const { context, sent } = groqPath({ env: {} });
    const body = { ...bigBody(), source: "comments", system: "S".repeat(40000), messages: [{ role: "user", content: "W".repeat(80000) + "\n[[PROTECTED_TAIL]]\nThe player just wrote: hello" }] };
    await callPaid(context, provider, body);
    assert.equal(sent.length, 1);
    assert.ok(sentChars(sent[0]) <= 60000 + 200, provider + " sent " + sentChars(sent[0]));
    const last = sent[0].messages[sent[0].messages.length - 1].content;
    assert.match(last, /\[\[PROTECTED_TAIL\]\]\nThe player just wrote: hello$/, "what the player just said is never cut");
  }
});

test("A prompt under the ceiling goes out exactly as it is", async () => {
  const { context, sent } = groqPath({ env: {} });
  await callPaid(context, "mistral", { source: "dm", system: "short system", messages: [{ role: "user", content: "short question" }], max_tokens: 300 });
  assert.equal(sent[0].messages[0].content, "short system");
  assert.equal(sent[0].messages[1].content, "short question");
});

test("PAID_MAX_INPUT_CHARS moves the ceiling, and 0 switches it off", async () => {
  const body = { source: "comments", system: "S".repeat(10000), messages: [{ role: "user", content: "W".repeat(30000) }], max_tokens: 300 };
  const lowered = groqPath({ env: { PAID_MAX_INPUT_CHARS: "20000" } });
  await callPaid(lowered.context, "openrouter3", body);
  assert.ok(sentChars(lowered.sent[0]) <= 20200, "sent " + sentChars(lowered.sent[0]));
  const off = groqPath({ env: { PAID_MAX_INPUT_CHARS: "0" } });
  await callPaid(off.context, "openrouter3", { ...body, messages: [{ role: "user", content: "W".repeat(150000) }] });
  assert.equal(sentChars(off.sent[0]), 10000 + 150000, "no ceiling, nothing cut");
});

test("The paid ceiling does not touch the free providers (Groq has its own budget, other providers none)", async () => {
  const other = groqPath({ env: {} });
  await other.context.proxyCompatibleMessage("openrouter", "key", "m", "https://openrouter.ai/x", { ...bigBody(), system: "S".repeat(40000) });
  assert.equal(sentChars(other.sent[0]), 40000 + bigBody().messages[0].content.length, "the free OpenRouter route is left alone");
});

test("What a paid provider reports using is metered: prompt, answer, cached and reasoning tokens, per provider and per kind of request", async () => {
  const usage = { prompt_tokens: 12000, completion_tokens: 350, prompt_tokens_details: { cached_tokens: 9000 }, completion_tokens_details: { reasoning_tokens: 120 }, cost: 0.0012 };
  const reply = () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: "hello" } }], usage }) });
  const { context, usage: meter } = groqPath({ env: {}, respond: reply });
  await callPaid(context, "openrouter3", { source: "dm", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 300 });
  await callPaid(context, "mistral", { source: "scene", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 300 });
  await callPaid(context, "mistral", { source: "scene", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 300 });
  const snapshot = meter.snapshot();
  assert.equal(snapshot.calls, 3);
  assert.equal(snapshot.promptTokens, 36000);
  assert.equal(snapshot.completionTokens, 1050);
  assert.equal(snapshot.cachedTokens, 27000);
  assert.equal(snapshot.reasoningTokens, 360);
  assert.equal(snapshot.byProvider.mistral.calls, 2);
  assert.equal(snapshot.bySource.scene.promptTokens, 24000);
  assert.equal(snapshot.byProviderSource["openrouter3/dm"].calls, 1);
  assert.ok(Math.abs(snapshot.cost - 0.0036) < 1e-9);
});

test("A reply without a usage block costs nothing in the meter and breaks nothing", async () => {
  const { context, usage: meter } = groqPath({ env: {} });
  const result = await callPaid(context, "mistral", { source: "dm", system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 300 });
  assert.equal(result.ok, true);
  assert.equal(meter.snapshot().calls, 0);
});

test("proxy.js exposes the day's usage behind a session, and logs a line for every paid call", () => {
  assert.match(source, /app\.get\("\/ai\/usage", async \(req, res\) => \{\s*const session = await getSessionIdentity\(req\)\.catch\(\(\) => null\);\s*if \(!session\) return res\.status\(401\)/);
  assert.match(source, /console\.info\("\[ai-usage\]"/);
  assert.match(source, /\[ai-usage-day\]/);
});

/* ---------- a provider that keeps refusing is asked last ---------- */

test("DeepSeek keeps refusing DMs: after a few refusals Mistral is asked first, and DeepSeek is still there as the last resort", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "openrouter3" ? text(provider, REFUSAL) : text(provider, '{"reply":"hi"}')));
  const order = () => Array.from(context.taskProviderOrder("anthropic", jsonBody("dm")));
  assert.deepEqual(order(), ["openrouter3", "mistral", "mistral2"], "to begin with, DeepSeek is first");
  for (let i = 0; i < 4; i += 1) await context.executeAITask(jsonTask("dm", { messages: [{ role: "user", content: "write " + i }] }));
  assert.deepEqual(order(), ["mistral", "mistral2", "openrouter3"]);
  calls.length = 0;
  const result = await context.executeAITask(jsonTask("dm", { messages: [{ role: "user", content: "write again" }] }));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["mistral"], "the refusing provider was not paid for this time");
});

test("The record is per kind of request: DeepSeek refusing DMs does not demote it for comments", async () => {
  const { context } = gate(ENV, (provider) => (provider === "openrouter3" ? text(provider, REFUSAL) : text(provider, '{"reply":"hi"}')));
  for (let i = 0; i < 4; i += 1) await context.executeAITask(jsonTask("dm", { messages: [{ role: "user", content: "w" + i }] }));
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", jsonBody("comments", { foreground: true }))), ["openrouter3", "mistral", "mistral2"]);
});

test("A provider that refused only now and then stays first: two refusals among many good answers do not demote it", async () => {
  const script = ["refuse", "refuse", "ok", "ok", "ok", "ok", "ok", "ok"];
  let n = 0;
  const { context } = gate(ENV, (provider) => (provider === "openrouter3" && script[n] === "refuse" ? text(provider, REFUSAL) : text(provider, '{"reply":"hi"}')));
  for (; n < script.length; n += 1) await context.executeAITask(jsonTask("dm", { messages: [{ role: "user", content: "w" + n }] }));
  assert.equal(context.taskProviderOrder("anthropic", jsonBody("dm"))[0], "openrouter3");
  assert.equal(vm.runInContext("AI_REFUSALS.rate('openrouter3','dm')", context), 0.25);
});

test("A Gemini safety block counts against Gemini for that kind of request, a prose answer to a prose request counts for nothing", async () => {
  const blocked = gate(ENV, (provider) => (provider === "gemini" ? { ok: false, status: 422, blocked: true, payload: { error: { message: "blocked" } }, provider } : text(provider, '{"ok":true}')));
  for (let i = 0; i < 4; i += 1) await blocked.context.executeAITask(jsonTask("comments", { messages: [{ role: "user", content: "c" + i }] }));
  assert.equal(blocked.context.taskProviderOrder("anthropic", jsonBody("comments"))[0], "groq", "Gemini goes to the end for comments");
  const prose = gate(ENV, (provider) => text(provider, REFUSAL));
  for (let i = 0; i < 6; i += 1) await prose.context.executeAITask({ requestedProvider: "anthropic", source: "dm", body: { source: "dm", system: "narrator", messages: [{ role: "user", content: "p" + i }] } });
  assert.equal(prose.context.taskProviderOrder("anthropic", jsonBody("dm"))[0], "openrouter3", "nothing was recorded for requests that did not ask for JSON");
});

test("Gemini: an overloaded model is skipped on the other keys at once and the next model answers", async () => {
  const busy = { status: 503, payload: { error: { message: "This model is currently experiencing high demand. Spikes in demand are usually temporary." } } };
  const { context, requests } = geminiPath({ respond: ({ model }) => (model === "gemini-3.8-flash" ? busy : geminiOk("fine")) });
  const result = await context.proxyGeminiMessage(geminiBody());
  assert.equal(result.ok, true);
  assert.equal(result.model, "gemini-3.7-flash");
  assert.deepEqual(requests.map((r) => r.model), ["gemini-3.8-flash", "gemini-3.7-flash"], "the second key was not asked about the busy model");
});

/* ---------- a DM reply keeps the conversation it answers, even when the prompt is cut for a paid provider ---------- */

const dmBody = () => {
  const history = Array.from({ length: 14 }, (_, i) => (i % 2 ? "Tandy: " : "Brent: ") + "H" + String(i + 1).padStart(2, "0") + " " + "talk ".repeat(70)).join("\n");
  const tail = "\n\n[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]\nPROTECTED DIRECT-DM CONTEXT — NEVER OMIT THIS BLOCK.\n\nVOICE / WRITING-STYLE CARD:\n" + "voice ".repeat(300) +
    "\n\nLATEST 14 MESSAGES FROM THIS EXACT DM, BOTH SIDES, VERBATIM:\n" + history + "\n\nYOUR LAST 5 OWN DM MESSAGES:\n" + "own ".repeat(300) +
    "\n\nMANDATORY RESPONSE BEHAVIOR:\n" + "- rule ".repeat(600) + "\nAMIRE MOST VÁLASZOLNOD KELL (SZÓ SZERINT):\nyeah I'm here... \"boyfriend\"";
  const canon = "[[CHARACTER_FIDELITY]]\n" + "canon ".repeat(5000) + "\n[[/CHARACTER_FIDELITY]]";
  return {
    source: "dm",
    system: "SYS ".repeat(10000) + canon,
    messages: [{ role: "user", content: "CTX ".repeat(40000) + tail }],
    max_tokens: 650,
  };
};

test("A paid DM request keeps all 14 turns of the conversation, the rules and the player's newest line", async () => {
  const { context, sent } = groqPath();
  const result = await context.proxyCompatibleMessage("mistral2", "key", "m", "https://api.mistral.ai/x", dmBody());
  assert.equal(result.ok, true);
  const message = sent[0].messages.map((row) => row.content).join("\n");
  for (let i = 1; i <= 14; i += 1) assert.ok(message.includes("H" + String(i).padStart(2, "0") + " "), "turn " + i + " of the conversation is still there");
  assert.ok(message.includes("MANDATORY RESPONSE BEHAVIOR"), "the rules are still there");
  assert.ok(message.endsWith('yeah I\'m here... "boyfriend"'), "and the player's newest line is the very last thing");
  assert.ok(message.includes("VOICE / WRITING-STYLE CARD"), "with the voice card");
  assert.ok(textLength(sent[0]) <= 91000, "all of it still within the (player-facing) paid ceiling");
});

test("A paid DM request keeps the private bond context of the two people whole, before the tail, however much filler surrounds it", async () => {
  const bond = "\n[[FULL_BOND_CONTEXT]]\n" + JSON.stringify({
    rules: "r".repeat(1200),
    currentBonds: { "brent>tandy": { summary: "Brent and Tandy are FAKE BOYFRIEND and girlfriend: they pretend to date, and both of them know it is staged.", description: "d".repeat(3000), whoKnows: ["brent", "tandy"] } },
    profiles: { brent: { facts: "f".repeat(20000) } },
  }) + "\n[[/FULL_BOND_CONTEXT]]";
  const body = dmBody();
  const content = body.messages[0].content;
  const at = content.indexOf("\n\n[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]");
  body.messages[0].content = content.slice(0, at) + bond + content.slice(at);
  const { context, sent } = groqPath();
  const result = await context.proxyCompatibleMessage("mistral2", "key", "m", "https://api.mistral.ai/x", body);
  assert.equal(result.ok, true);
  const message = sent[0].messages.map((row) => row.content).join("\n");
  assert.ok(message.includes("FAKE BOYFRIEND and girlfriend: they pretend to date"), "the arrangement between the two is still there");
  assert.ok(message.includes("[[/FULL_BOND_CONTEXT]]"), "and the block is closed");
  assert.ok(message.indexOf("[[/FULL_BOND_CONTEXT]]") < message.indexOf("[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]"), "it sits before the tail");
  assert.ok(message.endsWith('yeah I\'m here... "boyfriend"'), "the newest line is still the very last thing");
  for (let i = 1; i <= 14; i += 1) assert.ok(message.includes("H" + String(i).padStart(2, "0") + " "), "turn " + i);
  assert.ok(textLength(sent[0]) <= 91000, "within the ceiling");
});

test("An oversized bond context is cut from its end (profiles go first), keeps its close, and never takes more than 40% of the room", () => {
  const { context } = groqPath();
  const block = "[[FULL_BOND_CONTEXT]]\n" + '{"rules":"R","currentBonds":{"a>b":"KEEP-ME"},"profiles":"' + "p".repeat(60000) + '"}\n[[/FULL_BOND_CONTEXT]]';
  const text = "BODY ".repeat(20000) + "\n" + block + "\n\n[[PROTECTED_TAIL]]\nnewest line";
  const out = context.preservePromptEdges(text, 20000);
  assert.ok(out.length <= 20000, "length " + out.length);
  assert.ok(out.includes("KEEP-ME") && out.includes("[[/FULL_BOND_CONTEXT]]"));
  assert.ok(out.endsWith("newest line"));
  const kept = out.slice(out.indexOf("[[FULL_BOND_CONTEXT]]"), out.indexOf("[[/FULL_BOND_CONTEXT]]") + 22);
  assert.ok(kept.length <= 8000, "bond share " + kept.length);
});

test("A reply the player reads gets half again as much room under the paid ceiling; other work keeps the base", async () => {
  assert.equal(paidCeilingFor("dm", 60000), 90000);
  assert.equal(paidCeilingFor("scene", 60000), 90000);
  assert.equal(paidCeilingFor("comments", 60000), 60000);
  assert.equal(paidCeilingFor("dm", 0), 0, "0 still switches the ceiling off");
  const dm = groqPath();
  await dm.context.proxyCompatibleMessage("mistral2", "key", "m", "https://api.mistral.ai/x", dmBody());
  const dmSize = textLength(dm.sent[0]);
  assert.ok(dmSize > 60500 && dmSize <= 91000, "dm: " + dmSize);
  const other = groqPath();
  await other.context.proxyCompatibleMessage("mistral2", "key", "m", "https://api.mistral.ai/x", { ...dmBody(), source: "comments" });
  assert.ok(textLength(other.sent[0]) <= 61000, "another source stays at the base ceiling");
});


test("GLHF is wired as the first DM provider through the configured OpenAI-compatible endpoint", () => {
  assert.match(source, /const GLHF_API_KEY = String\(process\.env\.GLHF_API_KEY/);
  assert.match(source, /const GLHF_BASE_URL = String\(process\.env\.GLHF_BASE_URL/);
  assert.match(source, /const GLHF_MODEL = String\(process\.env\.GLHF_MODEL/);
  assert.match(source, /provider === "glhf"\) return proxyCompatibleMessage\("glhf", GLHF_API_KEY, providerModel\("glhf", body\), `\$\{GLHF_BASE_URL\}\/chat\/completions`/);
  assert.match(source, /raw = \["glhf", "openrouter3", "mistral", "mistral2"\]/);
});
