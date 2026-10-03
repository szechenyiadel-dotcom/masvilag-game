import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import {
  isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, FREE_WRITING_CHAIN, planGroqRequest,
  isGroqUtilitySource, groqCarriesWhole, estimateGroqTokens, groqPaceMaxWaitMs, createGroqPacer, groqRetryMs, GROQ_UTILITY_CHAIN, GROQ_UTILITY_SOURCES,
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
  "AI_GROQ_MAX_INPUT_CHARS", "AI_PROMPT_DEBUG", "AI_GATE", "groqRequestSize",
  "extractText", "proxyErrorMessage", "configuredAIProvider", "aiRequestText", "aiRequestChars", "inferAIRequestSource",
  "providerAllowedForBody", "taskProviderOrder", "healthyProvider", "providerCooldownMs", "providerModel", "parseRetryAfterMs",
  "safeProviderMessage", "markProviderFailure", "markProviderSuccess", "summarizeProviderFailures", "logFullAIPromptDebug",
  "shouldUseEmergencyOpenAIFallback", "executeAITask",
];

function gate(env, scripted) {
  const calls = [];
  const context = vm.createContext({
    process: { env: { OPENROUTER_API_KEY: "or", OPENROUTER_MODEL_3: "deepseek", ...env } },
    console: { info() {}, warn() {}, error() {} },
    Date, Math, Number, String, Array, Set, Map, Object, JSON, RegExp, Error,
    isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult, geminiKeyRestMs, geminiRateLimitInfo, FREE_WRITING_CHAIN,
    isGroqUtilitySource, groqCarriesWhole, GROQ_UTILITY_CHAIN, groqRetryMs,
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

test("Background DM, scene and comments use only the free chain; the player's own exchange keeps the billed providers", () => {
  const { context } = gate(ENV, () => ok("x"));
  const order = (source, extra = {}) => Array.from(context.taskProviderOrder("anthropic", task(context, source, extra).body));
  /* gemini (free keys), groq, groq2, openrouter: openrouter2 has no key in this world */
  for (const source of ["dm", "scene", "comments"]) assert.deepEqual(order(source), ["gemini", "groq", "groq2", "openrouter"], source);
  assert.deepEqual(order("dm", { foreground: true }), ["openrouter3", "mistral", "mistral2"]);
  assert.deepEqual(order("scene", { foreground: true }), ["mistral", "mistral2"]);
  assert.deepEqual(order("comments", { foreground: true }), ["openrouter3", "mistral", "mistral2"]);
  for (const source of ["dm", "scene", "comments", "feed-post", "notes", "meaning-analysis", "autonomy-other"]) {
    const background = order(source);
    for (const billed of ["mistral", "mistral2", "openrouter3", "openai", "anthropic"]) assert.ok(!background.includes(billed), `${source} must not list ${billed}`);
  }
  assert.deepEqual(Array.from(FREE_WRITING_CHAIN), ["gemini", "groq", "groq2", "openrouter", "openrouter2"]);
});

test("Background feed never lists OpenAI, and a world with no free Gemini key has no Gemini for background", () => {
  const withFree = gate(ENV, () => ok("x"));
  assert.deepEqual(Array.from(withFree.context.taskProviderOrder("anthropic", task(withFree.context, "feed-post").body)), ["gemini"]);
  const paidOnly = gate({ ...ENV, GEMINI_API_KEY_2: "" }, () => ok("x"));
  assert.deepEqual(Array.from(paidOnly.context.taskProviderOrder("anthropic", task(paidOnly.context, "feed-post").body)), []);
  assert.deepEqual(Array.from(paidOnly.context.taskProviderOrder("anthropic", task(paidOnly.context, "feed-post", { foreground: true }).body)), ["gemini", "openai"]);
});

test("Background request with every free provider rate-limited WAITS: a 503 with Retry-After, no paid call", async () => {
  const { context, calls } = gate(ENV, (provider) => quota(provider));
  const result = await context.executeAITask(task(context, "feed-post"));
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.waiting, true);
  assert.ok(Number(result.retryAfter) >= 20, "waits at least 20 s, got " + result.retryAfter);
  assert.equal(result.payload.error.type, "free_ai_waiting");
  assert.ok(!calls.includes("openai") && !calls.includes("anthropic") && !calls.includes("openrouter3"), "paid providers called: " + calls);
});

test("Background request with no free provider configured waits instead of failing hard", async () => {
  const { context, calls } = gate({ OPENAI_API_KEY: "oa" }, () => ok("openai"));
  const result = await context.executeAITask(task(context, "feed-post"));
  assert.equal(result.waiting, true);
  assert.equal(result.status, 503);
  assert.deepEqual(Array.from(calls), []);
});

test("A free provider that answers is used normally for background work, and Mistral is never called", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "gemini" ? quota(provider) : ok(provider)));
  const result = await context.executeAITask(task(context, "dm"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["gemini", "groq"]);
});

test("A background DM with every free provider rate-limited waits instead of paying for Mistral", async () => {
  const { context, calls } = gate(ENV, (provider) => quota(provider));
  const result = await context.executeAITask(task(context, "dm"));
  assert.equal(result.waiting, true);
  assert.equal(result.status, 503);
  assert.ok(!calls.some((provider) => ["mistral", "mistral2", "openrouter3", "openai"].includes(provider)), "billed providers called: " + calls);
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

test("A player waiting on a scene may still use the paid DeepSeek route when the free ones fail", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "openrouter3" ? ok(provider) : quota(provider)));
  const result = await context.executeAITask(task(context, "dm", { foreground: true }));
  assert.equal(result.ok, true);
  assert.equal(calls[0], "openrouter3");
});

test("AI_ALLOW_PAID_BACKGROUND=1 is the only way background work reaches paid providers", () => {
  const { context } = gate({ ...ENV, AI_ALLOW_PAID_BACKGROUND: "1" }, () => ok("x"));
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", task(context, "feed-post").body)), ["gemini", "openai"]);
});

test("A Gemini key running out of prepaid credit (402) does not switch Gemini off for good", () => {
  const { context } = gate(ENV, () => ok("x"));
  const aiGate = vm.runInContext("AI_GATE", context);
  const result = { status: 402, payload: { error: { message: "Your prepayment credits are depleted." } } };
  const rest = context.markProviderFailure("gemini", "gemini-x", result);
  assert.equal(rest, 10 * 60 * 1000);
  assert.ok(!aiGate.providerConfigurationErrors.has("gemini"), "not marked as a broken configuration");
  assert.ok(context.providerCooldownMs("gemini") > 0, "but it rests for a while");
  /* every other provider keeps the strict rule: 402/401/403 means the configuration is wrong */
  context.markProviderFailure("openai", "gpt", { status: 401, payload: { error: { message: "bad key" } } });
  assert.ok(aiGate.providerConfigurationErrors.has("openai"));
});

test("proxy.js rests each Gemini key by the error it returned, including spent credit", () => {
  assert.match(source, /geminiKeyRestMs\(status, proxyErrorMessage\(result && result\.payload, ""\), result && result\.payload\)/);
  assert.match(source, /out of quota \(" \+ limit\.metric \+ "\)/, "the log says whether it was a per-minute or a per-day limit");
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
    GROQ_PACER: pacer,
    fetch: async (url, options) => {
      sent.push(JSON.parse(options.body));
      return respond({ url, options });
    },
  });
  vm.runInContext(pick(["AI_UPSTREAM_TIMEOUT_MS", "GROQ_API_KEY_2", "GROQ_MODEL", "GROQ_MODEL_2", "AI_GATE", "providerCooldownMs", "groqSiblingReady", "groqRequestSize", "extractText", "aiRequestText", "aiRequestChars", "preservePromptEdges", "buildCompatibleChatPayload", "normalizeOpenAIResponse", "upstreamTimeoutFor", "proxyCompatibleMessage"]), context);
  return { context, sent, pacer };
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
  for (const source of ["dm", "scene", "comments", "player-post-comments-isolated"]) assert.equal(order(source)[0], "gemini", source);
  assert.deepEqual(order("feed-post"), ["gemini"]);
  assert.deepEqual(order("sheet-summary"), ["gemini"]);
  assert.deepEqual(order("character-bible"), ["gemini"]);
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
