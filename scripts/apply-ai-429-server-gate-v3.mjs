import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "server", "proxy.js");
const original = fs.readFileSync(serverPath, "utf8");
const marker = "MÁSVILÁG AI 429 SERVER GATE v3";

if (original.includes(marker)) {
  console.log("AI 429 server gate v3 already applied.");
  process.exit(0);
}

const eol = original.includes("\r\n") ? "\r\n" : "\n";
const nl = (s) => String(s).replace(/\n/g, eol);

function count(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(text, regex, replacement, label) {
  const n = count(text, regex);
  if (n !== 1) throw new Error(`AI server gate v3 aborted: ${label} expected 1 match, found ${n}.`);
  return text.replace(regex, replacement);
}

let next = original;

next = replaceOne(
  next,
  /const OPENAI_API_KEY = process\.env\.OPENAI_API_KEY;/,
  nl(`const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || "").trim();
const MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || "").trim();
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || "").trim();
/* New exact name first; historical Gemini fallback name remains accepted. */
const GEMINI_MODEL_ENV = String(process.env.GEMINI_MODEL || process.env.GEMINI_FALLBACK_MODEL || "").trim();
const AI_PROVIDER_ORDER_ENV = String(process.env.AI_PROVIDER_ORDER || "").trim();
const AI_AUTONOMY_INTERVAL_MINUTES = Math.max(0.05, Math.min(60, Number(process.env.AI_AUTONOMY_INTERVAL_MINUTES) || 1));
const AI_MIN_REQUEST_GAP_MS = Math.max(250, Math.min(30000, Number(process.env.AI_MIN_REQUEST_GAP_MS) || 2000));`),
  "environment constants"
);

next = replaceOne(
  next,
  /if \(provider === "gemini"\) \{\s*return "gemini";\s*\}/,
  nl(`if (provider === "mistral" || provider === "groq") return provider;

  if (provider === "gemini") {
    return "gemini";
  }`),
  "getProvider extension"
);

/* Remove internal Gemini retry/model fan-out. Central gate owns retry + provider rotation. */
const geminiStart = next.indexOf("async function proxyGeminiMessage(");
const anthropicStart = next.indexOf("async function proxyAnthropicMessage(", geminiStart);
if (geminiStart < 0 || anthropicStart < 0) throw new Error("AI server gate v3 aborted: Gemini/Anthropic function boundary changed.");
const geminiReplacement = nl(`async function proxyGeminiMessage(body) {
  if (!GEMINI_API_KEY) return { unavailable: true, provider: "gemini" };

  const requested = String(body?.model || "").trim();
  const model = requested.startsWith("gemini")
    ? requested
    : (GEMINI_MODEL_ENV || "gemini-3.5-flash");

  const url = new URL(
    \`https://generativelanguage.googleapis.com/v1beta/models/\${encodeURIComponent(model)}:generateContent\`
  );
  url.searchParams.set("key", GEMINI_API_KEY);

  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiPayload({ ...body, model })),
  });
  const payload = await responseJsonSafe(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      payload,
      retryAfter: r.headers.get("retry-after"),
      provider: "gemini",
    };
  }

  const normalized = normalizeGeminiResponse(payload);
  const hasText = Array.isArray(normalized?.content) && normalized.content.some((x) => String(x?.text || "").trim());
  return hasText
    ? { ok: true, payload: normalized, provider: "gemini" }
    : { ok: false, status: 502, payload: { error: { message: "Gemini returned empty content." } }, provider: "gemini" };
}

`);
next = next.slice(0, geminiStart) + geminiReplacement + next.slice(anthropicStart);

/* Remove internal Anthropic retry/model fan-out too. */
const anthStart2 = next.indexOf("async function proxyAnthropicMessage(");
const callProviderStart = next.indexOf("async function callMessageProvider(", anthStart2);
if (anthStart2 < 0 || callProviderStart < 0) throw new Error("AI server gate v3 aborted: Anthropic/call provider boundary changed.");
const anthropicReplacement = nl(`async function proxyAnthropicMessage(body) {
  if (!ANTHROPIC_API_KEY) return { unavailable: true, provider: "anthropic" };

  const requested = String(body?.model || "").trim();
  const model = requested.startsWith("claude")
    ? requested
    : String(process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_FALLBACK_MODEL || "claude-sonnet-4-6").trim();

  const { provider, source, priority, client_instance_id, __worldKey, ...rest } = body || {};
  const outboundBody = { ...rest, model, max_tokens: body?.max_tokens ?? 1024 };
  const r = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      "Accept": "application/json",
    },
    body: JSON.stringify(outboundBody),
  });
  const payload = await responseJsonSafe(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      payload,
      retryAfter: r.headers.get("retry-after"),
      provider: "anthropic",
    };
  }

  const hasText = Array.isArray(payload?.content) && payload.content.some((x) => x?.type === "text" && String(x?.text || "").trim());
  return hasText
    ? { ok: true, payload, provider: "anthropic" }
    : { ok: false, status: 502, payload: { error: { message: "Anthropic returned empty content." } }, provider: "anthropic" };
}

`);
next = next.slice(0, anthStart2) + anthropicReplacement + next.slice(callProviderStart);

/* Replace the provider dispatcher and insert the isolated single-flight gate. */
const callStart = next.indexOf("async function callMessageProvider(");
const semanticStart = next.indexOf("/* -------------------------------------------------------------------------", callStart);
if (callStart < 0 || semanticStart < 0 || !next.slice(semanticStart, semanticStart + 220).includes("SEMANTIC CHARACTER MEMORY")) {
  throw new Error("AI server gate v3 aborted: provider dispatcher boundary changed.");
}

const gate = nl(`/* ${marker} */
function buildCompatibleChatPayload(body = {}, model) {
  const messages = [];
  if (body.system) messages.push({ role: "system", content: String(body.system) });
  for (const item of Array.isArray(body.messages) ? body.messages : []) {
    const text = extractText(item?.content || "");
    if (!text) continue;
    messages.push({ role: item?.role === "assistant" ? "assistant" : "user", content: text });
  }
  const payload = { model, messages, max_tokens: body.max_tokens ?? 1024 };
  if (Number.isFinite(Number(body.temperature))) payload.temperature = Number(body.temperature);
  return payload;
}

async function proxyCompatibleMessage(provider, apiKey, model, endpoint, body) {
  if (!apiKey || !model) return { unavailable: true, provider };
  const r = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${apiKey}\` },
    body: JSON.stringify(buildCompatibleChatPayload(body, model)),
  });
  const payload = await responseJsonSafe(r);
  if (!r.ok) {
    return { ok: false, status: r.status, payload, retryAfter: r.headers.get("retry-after"), provider };
  }
  const normalized = normalizeOpenAIResponse(payload);
  const hasText = Array.isArray(normalized?.content) && normalized.content.some((x) => String(x?.text || "").trim());
  return hasText
    ? { ok: true, payload: normalized, provider }
    : { ok: false, status: 502, payload: { error: { message: \`\${provider} returned empty content.\` } }, provider };
}

async function callMessageProvider(provider, body) {
  if (provider === "mistral") return proxyCompatibleMessage("mistral", MISTRAL_API_KEY, MISTRAL_MODEL, "https://api.mistral.ai/v1/chat/completions", body);
  if (provider === "groq") return proxyCompatibleMessage("groq", GROQ_API_KEY, GROQ_MODEL, "https://api.groq.com/openai/v1/chat/completions", body);
  if (provider === "openai") return proxyOpenAIMessage(body);
  if (provider === "gemini") return proxyGeminiMessage(body);
  return proxyAnthropicMessage(body);
}

function configuredAIProvider(provider) {
  if (provider === "mistral") return Boolean(MISTRAL_API_KEY && MISTRAL_MODEL);
  if (provider === "groq") return Boolean(GROQ_API_KEY && GROQ_MODEL);
  if (provider === "gemini") return Boolean(GEMINI_API_KEY && (GEMINI_MODEL_ENV || true));
  if (provider === "openai") return Boolean(OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(ANTHROPIC_API_KEY);
  return false;
}

function providerOrder(requestedProvider) {
  const configured = AI_PROVIDER_ORDER_ENV
    .split(/[>,;|\\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const raw = configured.length
    ? configured
    : [requestedProvider, "mistral", "groq", "gemini", "openai", "anthropic"];
  const ordered = [];
  for (const provider of raw) {
    if (!ordered.includes(provider) && configuredAIProvider(provider)) ordered.push(provider);
  }
  if (configuredAIProvider(requestedProvider) && !ordered.includes(requestedProvider)) ordered.unshift(requestedProvider);
  return ordered;
}

function aiRequestText(body = {}) {
  return (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => extractText(m?.content || ""))
    .filter(Boolean)
    .join("\n");
}

function inferAIRequestSource(body = {}) {
  const explicit = String(body.source || "").trim();
  if (explicit) return explicit.slice(0, 80);
  const text = (String(body.system || "") + "\n" + aiRequestText(body)).toLowerCase();
  if (text.includes("social-post meaning parser") || text.includes("post meaning") || text.includes("meaning analysis")) return "meaning-analysis";
  if (text.includes("recovery-queue") || text.includes("relationship-auto-follow") || text.includes("auto-follow backlog")) return "recovery-queue";
  if (text.includes("group chat") || text.includes("groupchat") || text.includes("csoportos chat")) return "group-chat";
  if (text.includes("roleplay") || text.includes("jelenet") || text.includes("scene")) return "scene";
  if (text.includes("direct message") || text.includes("private message") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return "dm";
  if (text.includes("comment") || text.includes("komment") || text.includes("reply") || text.includes("válaszkomment")) return "comments";
  if (text.includes("note") || text.includes("jegyzet")) return "notes";
  if (text.includes("social post") || text.includes("feed") || text.includes("poszt")) return "feed-post";
  return "autonomy-other";
}

function aiRequestPriority(body = {}, source = inferAIRequestSource(body)) {
  const supplied = Number(body.priority);
  if (Number.isFinite(supplied) && supplied !== 0) return supplied;
  if (["interactive", "dm", "group-chat", "scene"].includes(source)) return 100;
  if (source === "comments") return 70;
  if (source === "feed-post") return 30;
  if (source === "notes") return 25;
  if (source === "meaning-analysis") return -20;
  if (source === "recovery-queue") return -30;
  return 20;
}

function preservePromptEdges(text, max) {
  const value = String(text || "");
  if (value.length <= max) return value;
  const head = Math.floor(max * 0.72);
  const tail = Math.max(0, max - head - 80);
  return value.slice(0, head) + "\n...[context compacted by AI gate]...\n" + value.slice(-tail);
}

function prepareAIRequestBody(body, priority) {
  const systemCap = priority >= 50 ? 30000 : 18000;
  const promptCap = priority >= 50 ? 52000 : 28000;
  let left = promptCap;
  const messages = [];
  for (const item of Array.isArray(body?.messages) ? body.messages : []) {
    if (left <= 0) break;
    const text = extractText(item?.content || "");
    if (!text) continue;
    const clipped = preservePromptEdges(text, left);
    left -= clipped.length;
    messages.push({ ...item, content: clipped });
  }
  return { ...body, system: preservePromptEdges(body?.system || "", systemCap), messages };
}

function parseRetryAfterMs(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const at = Date.parse(text);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

const AI_GATE = {
  queue: [], active: false, seq: 0, lastStartAt: 0, wakeTimer: null,
  pendingKeys: new Set(), recentKeys: new Map(), providerCooldownUntil: new Map(), providerFailures: new Map(),
  leaderByWorld: new Map(), lastAutonomyAt: new Map(),
  minute: "", minuteTotal: 0, minuteSources: Object.create(null), lastError: "",
};

function aiMinuteTrace(source, body) {
  const stamp = new Date().toISOString();
  const minute = stamp.slice(0, 16);
  if (AI_GATE.minute && AI_GATE.minute !== minute) {
    console.info("[ai-trace-minute]", AI_GATE.minute, \`total=\${AI_GATE.minuteTotal}\`, \`sources=\${JSON.stringify(AI_GATE.minuteSources)}\`);
    AI_GATE.minuteTotal = 0;
    AI_GATE.minuteSources = Object.create(null);
  }
  AI_GATE.minute = minute;
  AI_GATE.minuteTotal += 1;
  AI_GATE.minuteSources[source] = (AI_GATE.minuteSources[source] || 0) + 1;
  const prompt = aiRequestText(body);
  console.info("[ai-trace]", stamp, \`source=\${source}\`, \`systemChars=\${String(body.system || "").length}\`, \`promptChars=\${prompt.length}\`, \`totalChars=\${String(body.system || "").length + prompt.length}\`);
}
setInterval(() => {
  if (AI_GATE.minuteTotal) {
    console.info("[ai-trace-minute]", AI_GATE.minute || new Date().toISOString().slice(0,16), \`total=\${AI_GATE.minuteTotal}\`, \`sources=\${JSON.stringify(AI_GATE.minuteSources)}\`);
    AI_GATE.minuteTotal = 0;
    AI_GATE.minuteSources = Object.create(null);
  }
}, 60000).unref?.();

function providerCooldownMs(provider) {
  return Math.max(0, Number(AI_GATE.providerCooldownUntil.get(provider) || 0) - Date.now());
}

function markProviderFailure(provider, result) {
  const status = Number(result?.status || 0);
  if (![429, 503, 529].includes(status)) return 0;
  const previous = Number(AI_GATE.providerFailures.get(provider) || 0);
  const failures = Math.min(4, previous + 1);
  AI_GATE.providerFailures.set(provider, failures);
  const retryHeader = parseRetryAfterMs(result?.retryAfter);
  const message = String(proxyErrorMessage(result?.payload, "") || "").toLowerCase();
  const hardQuota = /free[_ -]?tier|quota exceeded|current quota|resource exhausted|no credits|daily limit/.test(message);
  const exponential = Math.min(60000, 5000 * Math.pow(2, failures - 1));
  const jitter = Math.floor(Math.random() * Math.min(2500, Math.max(500, exponential * 0.2)));
  const rest = hardQuota ? Math.max(retryHeader, 15 * 60 * 1000) : Math.max(retryHeader, exponential + jitter);
  AI_GATE.providerCooldownUntil.set(provider, Date.now() + rest);
  AI_GATE.lastError = \`\${provider} HTTP \${status}: \${message.slice(0, 180)}\`;
  console.warn("[ai-gate] provider-cooldown", provider, \`status=\${status}\`, \`ms=\${rest}\`, message.slice(0, 180));
  return rest;
}

function markProviderSuccess(provider) {
  AI_GATE.providerFailures.set(provider, 0);
  AI_GATE.providerCooldownUntil.delete(provider);
  AI_GATE.lastError = "";
}

function healthyProvider(requestedProvider, excluded = new Set()) {
  return providerOrder(requestedProvider).find((p) => !excluded.has(p) && providerCooldownMs(p) <= 0) || "";
}

function dedupeKey(body, source) {
  return crypto.createHash("sha256")
    .update(source + "\n" + String(body.system || "") + "\n" + aiRequestText(body))
    .digest("hex");
}

function quietSkip(reason) {
  return {
    ok: true,
    status: 200,
    provider: "server-gate",
    payload: {
      model: "masvilag-server-gate", type: "message", role: "assistant",
      content: [{ type: "text", text: JSON.stringify({ skip: true, reason }) }],
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  };
}

function isAutonomySource(source) {
  return ["feed-post", "notes", "autonomy-other"].includes(source);
}

function leaderAllows(worldKey, clientId, source, priority) {
  if (priority >= 50 || !isAutonomySource(source)) return true;
  const now = Date.now();
  const current = AI_GATE.leaderByWorld.get(worldKey);
  if (current && current.expiresAt > now && current.clientId !== clientId) return false;
  AI_GATE.leaderByWorld.set(worldKey, { clientId, expiresAt: now + 45000 });
  return true;
}

function autonomyNotBefore(worldKey, source) {
  if (!isAutonomySource(source)) return Date.now();
  const last = Number(AI_GATE.lastAutonomyAt.get(worldKey) || 0);
  return Math.max(Date.now(), last + AI_AUTONOMY_INTERVAL_MINUTES * 60000);
}

function scheduleAIGate(delay = 0) {
  if (AI_GATE.wakeTimer) clearTimeout(AI_GATE.wakeTimer);
  AI_GATE.wakeTimer = setTimeout(() => { AI_GATE.wakeTimer = null; pumpAIGate(); }, Math.max(0, delay));
  AI_GATE.wakeTimer.unref?.();
}

async function executeAITask(task) {
  const attempted = new Set();
  let last = null;
  const maxAttempts = task.priority >= 50 ? 4 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const provider = healthyProvider(task.requestedProvider, attempted);
    if (!provider) break;
    attempted.add(provider);

    console.info("[ai-gate] start", new Date().toISOString(), \`source=\${task.source}\`, \`priority=\${task.priority}\`, \`provider=\${provider}\`, \`queued=\${AI_GATE.queue.length}\`);
    const result = await callMessageProvider(provider, task.body);
    last = result;

    if (result?.ok) {
      markProviderSuccess(provider);
      return result;
    }
    if (result?.unavailable) continue;

    const status = Number(result?.status || 0);
    if ([429, 503, 529].includes(status)) {
      markProviderFailure(provider, result);
      /* Another configured healthy provider may be used immediately. */
      continue;
    }

    return result;
  }

  if (last) return last;
  const waits = providerOrder(task.requestedProvider).map(providerCooldownMs).filter((ms) => ms > 0);
  const retryMs = waits.length ? Math.min(...waits) : 30000;
  return {
    ok: false, status: 429, provider: "server-gate", retryAfter: String(Math.max(1, Math.ceil(retryMs / 1000))),
    payload: { error: { message: "All configured AI providers are cooling down or unavailable." } },
  };
}

async function pumpAIGate() {
  if (AI_GATE.active || !AI_GATE.queue.length) return;
  const now = Date.now();
  AI_GATE.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
  const index = AI_GATE.queue.findIndex((t) => t.notBefore <= now);
  if (index < 0) {
    scheduleAIGate(Math.max(1, Math.min(...AI_GATE.queue.map((t) => t.notBefore)) - now));
    return;
  }
  const gap = Math.max(0, AI_MIN_REQUEST_GAP_MS - (now - AI_GATE.lastStartAt));
  if (gap > 0) { scheduleAIGate(gap); return; }

  const task = AI_GATE.queue.splice(index, 1)[0];
  AI_GATE.active = true;
  AI_GATE.lastStartAt = Date.now();
  try {
    const result = await executeAITask(task);
    if (isAutonomySource(task.source)) AI_GATE.lastAutonomyAt.set(task.worldKey, Date.now());
    AI_GATE.recentKeys.set(task.key, Date.now());
    task.resolve(result);
  } catch (err) {
    AI_GATE.lastError = String(err?.message || err || "AI gate error").slice(0, 240);
    task.reject(err);
  } finally {
    AI_GATE.pendingKeys.delete(task.key);
    AI_GATE.active = false;
    const cutoff = Date.now() - 60000;
    for (const [key, at] of AI_GATE.recentKeys) if (at < cutoff) AI_GATE.recentKeys.delete(key);
    if (AI_GATE.queue.length) scheduleAIGate(0);
  }
}

function enqueueAIMessage(body, session) {
  const source = inferAIRequestSource(body);
  const priority = aiRequestPriority(body, source);
  const prepared = prepareAIRequestBody(body, priority);
  const worldKey = String(session?.worldCode || "anonymous");
  const clientId = String(body?.client_instance_id || body?.clientInstanceId || session?.accountId || "unknown");
  aiMinuteTrace(source, prepared);

  /* Confirmed by diagnosis: relationship auto-follow repair is data-only. */
  if (source === "recovery-queue") return Promise.resolve(quietSkip("recovery-is-data-only"));

  /* Optional semantic analysis yields instantly when real work is pending. */
  if (source === "meaning-analysis" && (AI_GATE.active || AI_GATE.queue.length)) return Promise.resolve(quietSkip("meaning-analysis-yielded"));

  if (!leaderAllows(worldKey, clientId, source, priority)) return Promise.resolve(quietSkip("another-client-is-autonomy-leader"));

  const key = dedupeKey(prepared, source);
  const recent = Number(AI_GATE.recentKeys.get(key) || 0);
  if (priority < 50 && (AI_GATE.pendingKeys.has(key) || (recent && Date.now() - recent < 30000))) {
    return Promise.resolve(quietSkip("duplicate-background-request"));
  }

  return new Promise((resolve, reject) => {
    AI_GATE.pendingKeys.add(key);
    AI_GATE.queue.push({
      body: prepared,
      requestedProvider: getProvider(prepared),
      source, priority, key, resolve, reject, worldKey,
      seq: ++AI_GATE.seq,
      notBefore: autonomyNotBefore(worldKey, source),
    });
    pumpAIGate();
  });
}

`);
next = next.slice(0, callStart) + gate + next.slice(semanticStart);

/* Replace only the message route. No feed/social/save code is touched. */
const routeRegex = /app\.post\(\s*\[\s*"\/ai\/messages",\s*"\/ai\/chat",\s*"\/ai\/respond",\s*\],\s*async \(req, res\) => \{[\s\S]*?\n\s*\}\s*\n\);\s*\n\s*\/\/ Serve the built React\/Vite app in production\./;
const routeReplacement = nl(`app.post(
  ["/ai/messages", "/ai/chat", "/ai/respond"],
  async (req, res) => {
    const session = await getSessionIdentity(req).catch(() => null);
    const requestedProvider = getProvider(req.body || {});
    try {
      const result = await enqueueAIMessage(req.body || {}, session);
      if (result?.ok) {
        res.setHeader("x-masvilag-ai-provider", result.provider || requestedProvider);
        return res.json(result.payload);
      }

      const upstreamStatus = Number(result?.status) || 503;
      if (result?.retryAfter) res.setHeader("retry-after", result.retryAfter);
      res.setHeader("x-masvilag-ai-provider", result?.provider || requestedProvider);
      res.setHeader("x-masvilag-ai-upstream-status", String(upstreamStatus));

      const source = inferAIRequestSource(req.body || {});
      const priority = aiRequestPriority(req.body || {}, source);
      const message = proxyErrorMessage(result?.payload, "No configured AI provider returned a usable response.");
      console.error("AI message unavailable:", source, requestedProvider, \`upstream=\${upstreamStatus}\`, message);

      /* Background work must not create browser retry storms. */
      if (priority < 50 && [429, 503, 529].includes(upstreamStatus)) {
        return res.status(200).json({
          model: "masvilag-server-gate", type: "message", role: "assistant",
          content: [{ type: "text", text: JSON.stringify({ skip: true, reason: "background-provider-busy" }) }],
          usage: { input_tokens: 0, output_tokens: 0 },
        });
      }

      return res.status(upstreamStatus === 404 ? 502 : upstreamStatus).json(result?.payload || { error: { message } });
    } catch (err) {
      console.error("AI gate error:", err);
      return res.status(502).json({ error: { message: err?.message || "AI gate failed." } });
    }
  }
);

// Serve the built React/Vite app in production.`);
next = replaceOne(next, routeRegex, routeReplacement, "message route");

fs.writeFileSync(serverPath, next, "utf8");
console.log("Applied server-only AI 429 gate v3: one global queue, provider order, diagnostics, dedupe, cooldowns and prompt caps.");
