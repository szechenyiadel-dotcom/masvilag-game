import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const serverPath = path.join(root, "server", "proxy.js");
const marker = "MÁSVILÁG AI 429 RESILIENCE v2";

function count(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}
function replaceOne(text, regex, replacement, label) {
  const matches = count(text, regex);
  if (matches !== 1) throw new Error(`AI 429 resilience v2 aborted: ${label} expected 1 match, found ${matches}.`);
  return text.replace(regex, replacement);
}
function eolFor(text) { return text.includes("\r\n") ? "\r\n" : "\n"; }
function withEol(text, value) { return String(value).replace(/\n/g, eolFor(text)); }

function patchApp(original) {
  if (original.includes(marker)) return { changed: false, text: original };
  let next = original;

  next = replaceOne(
    next,
    /maxConcurrent:\s*Math\.max\(1,\s*Math\.min\(2,\s*Number\(import\.meta\.env\.VITE_AI_MAX_CONCURRENT\)\s*\|\|\s*2\)\),/,
    "maxConcurrent: 1, // server-side gate is also single-flight",
    "client concurrency"
  );

  const helperRegex = /queueSeq:\s*0,\s*\r?\n};\s*\r?\nconst cooldownLeft = \(\) => Math\.max\(0, AI\.cooldownUntil - now\(\)\);/;
  const helper = `queueSeq: 0,
  lastError: "",
};

/* ${marker} */
const AI_CLIENT_INSTANCE_ID = (() => {
  try {
    const key = "mv_ai_client_instance_v1";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = \`tab-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 10)}\`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return \`tab-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 10)}\`;
  }
})();

function aiBackgroundPaused() {
  try { return localStorage.getItem("mv_ai_background_paused_v1") === "1"; }
  catch (e) { return false; }
}
function setAiBackgroundPaused(paused) {
  try { localStorage.setItem("mv_ai_background_paused_v1", paused ? "1" : "0"); }
  catch (e) {}
}
function inferAiRequestSource(system, prompt, requestMeta = {}) {
  const explicit = String(requestMeta.source || "").trim();
  if (explicit) return explicit.slice(0, 80);
  if (requestMeta.interactive) return "interactive";
  const text = (String(system || "") + "\n" + String(prompt || "")).toLowerCase();
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
function ensureAiStatusWidget() {
  if (typeof document === "undefined" || !document.body) return null;
  let root = document.getElementById("mv-ai-status-v1");
  if (root) return root;
  root = document.createElement("div");
  root.id = "mv-ai-status-v1";
  root.style.cssText = "position:fixed;right:10px;bottom:76px;z-index:2147483000;background:rgba(10,9,16,.94);color:#ECE4DA;border:1px solid #2C2740;border-radius:10px;padding:6px 8px;font:10px/1.35 JetBrains Mono,monospace;max-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.28)";
  root.innerHTML = '<div data-ai-status>AI</div><button data-ai-toggle type="button" style="margin-top:4px;border:1px solid #2C2740;background:#1E1A2C;color:#ECE4DA;border-radius:7px;padding:3px 6px;font:10px inherit;cursor:pointer"></button>';
  root.querySelector("[data-ai-toggle]")?.addEventListener("click", () => { setAiBackgroundPaused(!aiBackgroundPaused()); refreshAiStatusWidget(); });
  document.body.appendChild(root);
  return root;
}
function refreshAiStatusWidget() {
  const root = ensureAiStatusWidget();
  if (!root) return;
  const left = Math.max(0, Math.ceil((Number(AI.cooldownUntil) - Date.now()) / 1000));
  const status = root.querySelector("[data-ai-status]");
  const button = root.querySelector("[data-ai-toggle]");
  if (status) status.textContent = \`AI queue \${AI.queue.length} · active \${AI.activeWorkers} · cooldown \${left}s\${AI.lastError ? \` · \${String(AI.lastError).slice(0, 90)}\` : ""}\`;
  if (button) button.textContent = aiBackgroundPaused() ? "Autonóm AI: SZÜNET · indítás" : "Autonóm AI: AKTÍV · szünet";
}
if (typeof window !== "undefined") {
  setTimeout(refreshAiStatusWidget, 0);
  setInterval(refreshAiStatusWidget, 1000);
}

const cooldownLeft = () => Math.max(0, AI.cooldownUntil - now());`;
  next = replaceOne(next, helperRegex, withEol(next, helper), "AI helper insertion");

  next = replaceOne(
    next,
    /messages:\s*\[\{ role: "user", content: prompt \}\],\s*\r?\n}, ctrl\.signal\);/,
    withEol(next, `messages: [{ role: "user", content: prompt }],
  source: inferAiRequestSource(system, prompt, requestMeta),
  priority: Number(requestMeta.priority) || (requestMeta.interactive ? 100 : 0),
  client_instance_id: AI_CLIENT_INSTANCE_ID,
}, ctrl.signal);`),
    "request metadata"
  );

  next = replaceOne(
    next,
    /\{\s*\r?\n\s*interactive:\s*priority >= 50,\s*\r?\n\s*timeoutMs:\s*Number\(options\.timeoutMs\) \|\| undefined,\s*\r?\n\s*\}/,
    withEol(next, `{
              interactive: priority >= 50,
              priority,
              source: String(options.source || ""),
              timeoutMs: Number(options.timeoutMs) || undefined,
            }`),
    "askJSON metadata"
  );

  const askStart = next.indexOf("async function askJSON(");
  const askEnd = askStart >= 0 ? next.indexOf("async function askInteractiveWorldJSON(", askStart) : -1;
  if (askStart < 0 || askEnd < 0) throw new Error("AI 429 resilience v2 aborted: askJSON boundary changed.");
  let ask = next.slice(askStart, askEnd);
  ask = replaceOne(
    ask,
    /(const priority\s*=\s*[\s\S]*?\) \|\| 0;)/,
    `$1${withEol(ask, `

  if (priority < 50 && aiBackgroundPaused()) {
    const paused = new Error("Autonomous AI background work is paused.");
    paused.backgroundPaused = true;
    paused.retryable = false;
    throw paused;
  }`)}`,
    "background pause gate"
  );
  ask = replaceOne(ask, /const maxBusyWaits\s*=\s*priority >= 50\s*\? 4[\s\S]*?: 2;[^\r\n]*/, "const maxBusyWaits = priority >= 50 ? 4 : 1; // background never retries inside the same task", "busy retry cap");
  ask = replaceOne(ask, /(if \(err && err\.busy\) \{\s*\r?\n\s*busyWaits\+\+;)/, `$1${withEol(ask, `
            if (priority < 50) throw err;`)}`, "background fast fail");
  next = next.slice(0, askStart) + ask + next.slice(askEnd);

  next = replaceOne(
    next,
    /(const err = new Error\(`Az AI most nem győzi — \$\{Math\.ceil\(restMs \/ 1000\)\} másodperc pihenő\.`\);\s*\r?\n\s*err\.busy = true;)/,
    `$1${withEol(next, `
      AI.lastError = err.message;`)}`,
    "last busy error"
  );
  next = replaceOne(next, /if \(!txt\.trim\(\)\) throw new Error\("Az AI üres választ adott\."\);\s*\r?\n\s*return txt;/, withEol(next, `if (!txt.trim()) throw new Error("Az AI üres választ adott.");
  AI.lastError = "";
  return txt;`), "success status");

  next = replaceOne(
    next,
    /if \(!requestMeta\.interactive && prompt\.length > backgroundPromptCap\) \{\s*\r?\n\s*prompt = preserveEdges\(prompt, backgroundPromptCap, "background prompt"\);\s*\r?\n\s*\}/,
    withEol(next, `const backgroundSystemCap = 18000;
  if (!requestMeta.interactive && system.length > backgroundSystemCap) {
    system = preserveEdges(system, backgroundSystemCap, "background system");
  }
  if (!requestMeta.interactive && prompt.length > backgroundPromptCap) {
    prompt = preserveEdges(prompt, backgroundPromptCap, "background prompt");
  }`),
    "background context cap"
  );

  const semanticStart = next.indexOf("async function analyzeSocialPostMeaning(");
  const semanticEnd = semanticStart >= 0 ? next.indexOf("function socialPostMeaningCard(", semanticStart) : -1;
  if (semanticStart < 0 || semanticEnd < 0) throw new Error("AI 429 resilience v2 aborted: semantic boundary changed.");
  const semanticEol = eolFor(next);
  let semantic = next.slice(semanticStart, semanticEnd).replace(/\r\n/g, "\n");
  const cache = `  if (post.socialMeaning && typeof post.socialMeaning === "object" && Number(post.socialMeaning.version) >= 2) {\n    return normalizeSocialPostMeaning(w, post, post.socialMeaning);\n  }`;
  if (!semantic.includes(cache)) throw new Error("AI 429 resilience v2 aborted: semantic cache anchor changed.");
  semantic = semantic.replace(cache, `${cache}\n\n  if (cooldownLeft() > 0 || aiBackgroundPaused()) {\n    const fallback = fallbackSocialPostMeaning(w, post);\n    post.socialMeaning = fallback;\n    return fallback;\n  }`);
  semantic = semantic.replace("{ maxTokens: 520, maxTries: 1 }", "{ maxTokens: 520, maxTries: 1, priority: -20, source: \"meaning-analysis\" }");
  semantic = semantic.replace("    return normalizeSocialPostMeaning(w, post, raw);", "    const normalized = normalizeSocialPostMeaning(w, post, raw);\n    post.socialMeaning = normalized;\n    return normalized;");
  semantic = semantic.replace("    console.warn(\"Post meaning analysis failed; using grounded fallback:\", err);\n    return fallbackSocialPostMeaning(w, post);", "    if (!(err && (err.busy || err.backgroundPaused))) console.warn(\"Post meaning analysis failed; using grounded fallback:\", err);\n    const fallback = fallbackSocialPostMeaning(w, post);\n    post.socialMeaning = fallback;\n    return fallback;");
  next = next.slice(0, semanticStart) + semantic.replace(/\n/g, semanticEol) + next.slice(semanticEnd);
  return { changed: next !== original, text: next };
}

function patchServer(original) {
  if (original.includes(marker)) return { changed: false, text: original };
  let next = original;

  next = replaceOne(next, /const OPENAI_API_KEY = process\.env\.OPENAI_API_KEY;/, withEol(next, `const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || "").trim();
const MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || "").trim();
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || "").trim();
const GEMINI_MODEL_ENV = String(process.env.GEMINI_MODEL || process.env.GEMINI_FALLBACK_MODEL || "").trim();
const AI_PROVIDER_ORDER_ENV = String(process.env.AI_PROVIDER_ORDER || "").trim();
const AI_AUTONOMY_INTERVAL_MINUTES = Math.max(0.1, Math.min(60, Number(process.env.AI_AUTONOMY_INTERVAL_MINUTES) || 1));
const AI_MIN_REQUEST_GAP_MS = Math.max(250, Math.min(30000, Number(process.env.AI_MIN_REQUEST_GAP_MS) || 2000));`), "server envs");

  next = replaceOne(next, /process\.env\.GEMINI_MODEL \|\|\s*\r?\n\s*"gemini-3\.6-flash"/, `GEMINI_MODEL_ENV ||${eolFor(next)}      "gemini-3.6-flash"`, "Gemini model env");
  next = replaceOne(next, /if \(provider === "gemini"\) \{\s*\r?\n\s*return "gemini";\s*\r?\n\s*\}/, withEol(next, `if (provider === "mistral" || provider === "groq") return provider;

  if (provider === "gemini") {
    return "gemini";
  }`), "provider names");

  const callStart = next.indexOf("async function callMessageProvider(");
  const semanticStart = next.indexOf("/* -------------------------------------------------------------------------", callStart);
  if (callStart < 0 || semanticStart < 0 || !next.slice(semanticStart, semanticStart + 180).includes("SEMANTIC CHARACTER MEMORY")) throw new Error("AI 429 resilience v2 aborted: server provider boundary changed.");
  const layer = withEol(next, `/* ${marker} */
function compatiblePayload(body = {}, model) {
  const messages = [];
  if (body.system) messages.push({ role: "system", content: String(body.system) });
  for (const item of Array.isArray(body.messages) ? body.messages : []) {
    const text = extractText(item?.content || "");
    if (text) messages.push({ role: item?.role === "assistant" ? "assistant" : "user", content: text });
  }
  const payload = { model, messages, max_tokens: body.max_tokens ?? 1024 };
  if (Number.isFinite(Number(body.temperature))) payload.temperature = Number(body.temperature);
  return payload;
}
async function proxyCompatibleMessage(provider, apiKey, model, url, body) {
  if (!apiKey || !model) return { ok: false, status: 503, payload: { error: { message: \`${'${provider}'} is not configured.\` } }, provider };
  try {
    const r = await fetch(url, { method: "POST", headers: { Authorization: \`Bearer ${'${apiKey}'}\`, "Content-Type": "application/json" }, body: JSON.stringify(compatiblePayload(body, model)) });
    const raw = await r.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch (e) { payload = { error: { message: raw || \`${'${provider}'} returned invalid JSON.\` } }; }
    const retryAfter = String(r.headers?.get?.("retry-after") || "").trim();
    if (!r.ok) return { ok: false, status: r.status, payload, retryAfter, provider };
    return { ok: true, status: 200, payload: normalizeOpenAIResponse(payload), retryAfter, provider };
  } catch (err) {
    return { ok: false, status: 502, payload: { error: { message: String(err?.message || err || \`${'${provider}'} request failed.\`) } }, provider };
  }
}
function configuredMessageProvider(provider) {
  if (provider === "mistral") return Boolean(MISTRAL_API_KEY && MISTRAL_MODEL);
  if (provider === "groq") return Boolean(GROQ_API_KEY && GROQ_MODEL);
  if (provider === "gemini") return Boolean(GEMINI_API_KEY);
  if (provider === "openai") return Boolean(OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(ANTHROPIC_API_KEY);
  return false;
}
function parsedProviderOrder(requestedProvider) {
  const configuredOrder = AI_PROVIDER_ORDER_ENV.split(/[>,;|\\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const raw = configuredOrder.length ? configuredOrder : [requestedProvider, "mistral", "groq", "gemini", "openai", "anthropic"];
  return [...new Set(raw)].filter(configuredMessageProvider);
}
const AI_SERVER = { queue: [], active: false, seq: 0, lastStartAt: 0, timer: null, pendingKeys: new Set(), providerCooldownUntil: new Map(), leaderByWorld: new Map(), lastAutonomyAt: new Map() };
function providerCooldownMs(provider) { return Math.max(0, Number(AI_SERVER.providerCooldownUntil.get(provider) || 0) - Date.now()); }
function chooseHealthyMessageProvider(requestedProvider) { return parsedProviderOrder(requestedProvider).find((p) => providerCooldownMs(p) <= 0) || ""; }
function retryAfterMs(value) { const t = String(value || "").trim(); const n = Number(t); if (Number.isFinite(n) && n >= 0) return Math.ceil(n * 1000); const d = Date.parse(t); return Number.isFinite(d) ? Math.max(0, d - Date.now()) : 0; }
function rememberProviderThrottle(provider, result) {
  const status = Number(result?.status || 0);
  if (![429, 529, 503].includes(status)) return;
  const message = String(proxyErrorMessage(result?.payload, "") || "").toLowerCase();
  const exhausted = /free[_ -]?tier|quota exceeded|current quota|no credits|resource exhausted|daily/.test(message);
  const ms = exhausted ? Math.max(retryAfterMs(result?.retryAfter), 15 * 60 * 1000) : Math.max(retryAfterMs(result?.retryAfter), status === 429 ? 5000 : 3000);
  AI_SERVER.providerCooldownUntil.set(provider, Date.now() + Math.min(60 * 60 * 1000, ms));
  console.warn("[ai-gate] provider cooldown", provider, \`status=${'${status}'}\`, \`ms=${'${ms}'}\`, message.slice(0, 180));
}
function sourceOf(body = {}) {
  const explicit = String(body.source || "").trim(); if (explicit) return explicit.slice(0, 80);
  const prompt = (Array.isArray(body.messages) ? body.messages : []).map((m) => extractText(m?.content || "")).join("\n");
  const text = (String(body.system || "") + "\n" + prompt).toLowerCase();
  if (text.includes("post meaning") || text.includes("social-post meaning parser")) return "meaning-analysis";
  if (text.includes("recovery-queue") || text.includes("relationship-auto-follow")) return "recovery-queue";
  if (text.includes("comment") || text.includes("komment") || text.includes("reply")) return "comments";
  if (text.includes("group chat") || text.includes("groupchat")) return "group-chat";
  if (text.includes("roleplay") || text.includes("scene") || text.includes("jelenet")) return "scene";
  if (text.includes("direct message") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return "dm";
  if (text.includes("note") || text.includes("jegyzet")) return "notes";
  if (text.includes("feed") || text.includes("social post") || text.includes("poszt")) return "feed-post";
  return "autonomy-other";
}
function priorityOf(body, source) {
  const p = Number(body.priority); if (Number.isFinite(p) && p !== 0) return p;
  if (["interactive", "scene", "group-chat", "dm"].includes(source)) return 100;
  if (source === "comments") return 70;
  if (source === "feed-post") return 20;
  if (source === "notes") return 15;
  if (source === "meaning-analysis") return -20;
  if (source === "recovery-queue") return -30;
  return 10;
}
function dedupeKey(body, source) {
  const prompt = (Array.isArray(body.messages) ? body.messages : []).map((m) => extractText(m?.content || "")).join("\n");
  return crypto.createHash("sha256").update(source + "\n" + String(body.system || "") + "\n" + prompt).digest("hex");
}
function skipResult(reason) { return { ok: true, status: 200, provider: "server-gate", payload: { model: "masvilag-server-gate", type: "message", role: "assistant", content: [{ type: "text", text: JSON.stringify({ skip: true, reason }) }], usage: { input_tokens: 0, output_tokens: 0 } } }; }
function isAutonomy(source, priority) { return priority < 50 && !["meaning-analysis", "recovery-queue"].includes(source); }
function leaderAllows(body, source, priority) {
  if (!isAutonomy(source, priority)) return true;
  const world = String(body.__worldKey || "anon"), client = String(body.client_instance_id || "unknown"), current = AI_SERVER.leaderByWorld.get(world), now = Date.now();
  if (current && current.expiresAt > now && current.client !== client) return false;
  AI_SERVER.leaderByWorld.set(world, { client, expiresAt: now + 45000 }); return true;
}
function notBefore(body, source, priority) {
  if (!isAutonomy(source, priority)) return Date.now();
  const world = String(body.__worldKey || "anon"), last = Number(AI_SERVER.lastAutonomyAt.get(world) || 0);
  return Math.max(Date.now(), last + AI_AUTONOMY_INTERVAL_MINUTES * 60000);
}
async function directMessageProvider(provider, body) {
  if (provider === "mistral") return proxyCompatibleMessage("mistral", MISTRAL_API_KEY, MISTRAL_MODEL, "https://api.mistral.ai/v1/chat/completions", body);
  if (provider === "groq") return proxyCompatibleMessage("groq", GROQ_API_KEY, GROQ_MODEL, "https://api.groq.com/openai/v1/chat/completions", body);
  if (provider === "openai") return proxyOpenAIMessage(body);
  if (provider === "gemini") return proxyGeminiMessage({ ...body, model: GEMINI_MODEL_ENV || body.model });
  return proxyAnthropicMessage(body);
}
function wake(delay = 0) { if (AI_SERVER.timer) clearTimeout(AI_SERVER.timer); AI_SERVER.timer = setTimeout(() => { AI_SERVER.timer = null; pump(); }, Math.max(0, delay)); AI_SERVER.timer.unref?.(); }
async function pump() {
  if (AI_SERVER.active || !AI_SERVER.queue.length) return;
  const now = Date.now(); AI_SERVER.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
  const index = AI_SERVER.queue.findIndex((t) => t.notBefore <= now);
  if (index < 0) { wake(Math.max(1, Math.min(...AI_SERVER.queue.map((t) => t.notBefore)) - now)); return; }
  const gap = Math.max(0, AI_MIN_REQUEST_GAP_MS - (now - AI_SERVER.lastStartAt)); if (gap) { wake(gap); return; }
  const task = AI_SERVER.queue.splice(index, 1)[0]; AI_SERVER.active = true; AI_SERVER.lastStartAt = Date.now();
  try {
    const provider = chooseHealthyMessageProvider(task.requestedProvider);
    if (!provider) {
      const waits = parsedProviderOrder(task.requestedProvider).map(providerCooldownMs).filter((x) => x > 0); const ms = waits.length ? Math.min(...waits) : 30000;
      task.resolve({ ok: false, status: 429, retryAfter: String(Math.max(1, Math.ceil(ms / 1000))), provider: "server-gate", payload: { error: { message: "All configured AI providers are cooling down or unavailable." } } });
    } else {
      console.info("[ai-gate] start", new Date().toISOString(), \`source=${'${task.source}'}\`, \`priority=${'${task.priority}'}\`, \`provider=${'${provider}'}\`, \`queued=${'${AI_SERVER.queue.length}'}\`);
      const result = await directMessageProvider(provider, task.body); rememberProviderThrottle(provider, result);
      if (isAutonomy(task.source, task.priority)) AI_SERVER.lastAutonomyAt.set(String(task.body.__worldKey || "anon"), Date.now());
      task.resolve(result);
    }
  } catch (err) { task.reject(err); }
  finally { AI_SERVER.pendingKeys.delete(task.key); AI_SERVER.active = false; if (AI_SERVER.queue.length) wake(0); }
}
function callMessageProvider(requestedProvider, body = {}) {
  const source = sourceOf(body), priority = priorityOf(body, source);
  if (source === "recovery-queue") return Promise.resolve(skipResult("recovery-is-data-only"));
  if (source === "meaning-analysis" && (AI_SERVER.active || AI_SERVER.queue.length)) return Promise.resolve(skipResult("meaning-analysis-yielded"));
  if (!leaderAllows(body, source, priority)) return Promise.resolve(skipResult("another-client-is-autonomy-leader"));
  const key = dedupeKey(body, source); if (priority < 50 && AI_SERVER.pendingKeys.has(key)) return Promise.resolve(skipResult("duplicate-background-request"));
  return new Promise((resolve, reject) => { AI_SERVER.pendingKeys.add(key); AI_SERVER.queue.push({ body, requestedProvider, source, priority, key, resolve, reject, seq: ++AI_SERVER.seq, notBefore: notBefore(body, source, priority) }); pump(); });
}
`);
  next = next.slice(0, callStart) + layer + next.slice(semanticStart);

  next = replaceOne(next, /async \(req, res\) => \{\s*\r?\n\s*const requestedProvider =/, withEol(next, `async (req, res) => {
    const aiSession = await getSessionIdentity(req).catch(() => null);
    if (req.body && typeof req.body === "object") req.body.__worldKey = aiSession?.worldCode || "anonymous";
    const requestedProvider =`), "route world identity");

  next = replaceOne(next, /\s*const configuredFallbacks =[\s\S]*?const providers = \[\s*requestedProvider,\s*\.\.\.configuredFallbacks,\s*\];/, withEol(next, `
    /* One browser request -> at most one upstream provider call. Provider rotation happens between requests. */
    const providers = [requestedProvider];`), "remove same-request provider fanout");
  return { changed: next !== original, text: next };
}

const appOriginal = fs.readFileSync(appPath, "utf8");
const serverOriginal = fs.readFileSync(serverPath, "utf8");
const appPatched = patchApp(appOriginal);
const serverPatched = patchServer(serverOriginal);
if (appPatched.changed) fs.writeFileSync(appPath, appPatched.text, "utf8");
if (serverPatched.changed) fs.writeFileSync(serverPath, serverPatched.text, "utf8");
console.log(appPatched.changed || serverPatched.changed ? "Applied isolated AI 429 resilience v2." : "AI 429 resilience v2 already applied.");
