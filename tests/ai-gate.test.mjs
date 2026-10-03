import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult } from "../server/aiPolicy.js";

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
  "AI_GROQ_MAX_INPUT_CHARS", "AI_PROMPT_DEBUG", "AI_GATE",
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
    isForegroundRequest, filterProvidersForBody, selectGeminiKeys, backgroundWaitSeconds, buildWaitingResult,
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

test("Background DM and comments skip the paid DeepSeek route; the player's own DM keeps it first", () => {
  const { context } = gate(ENV, () => ok("x"));
  const background = context.taskProviderOrder("anthropic", task(context, "dm").body);
  assert.deepEqual(Array.from(background), ["mistral", "mistral2"]);
  const foreground = context.taskProviderOrder("anthropic", task(context, "dm", { foreground: true }).body);
  assert.deepEqual(Array.from(foreground), ["openrouter3", "mistral", "mistral2"]);
  assert.deepEqual(Array.from(context.taskProviderOrder("anthropic", task(context, "comments").body)), ["mistral", "mistral2"]);
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

test("A free provider that answers is used normally for background work", async () => {
  const { context, calls } = gate(ENV, (provider) => (provider === "mistral" ? quota(provider) : ok(provider)));
  const result = await context.executeAITask(task(context, "dm"));
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(calls), ["mistral", "mistral2"]);
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
