import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const serverPath = path.join(root, "server", "proxy.js");
const marker = "MÁSVILÁG AI 429 RESILIENCE v1";

function mustReplaceOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0 || text.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`AI 429 resilience aborted: ${label} anchor missing or ambiguous.`);
  }
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

function patchApp(original) {
  if (original.includes(marker)) return { changed: false, text: original };
  let next = original;

  next = mustReplaceOnce(
    next,
    "  maxConcurrent: Math.max(1, Math.min(2, Number(import.meta.env.VITE_AI_MAX_CONCURRENT) || 2)),",
    "  maxConcurrent: 1, // global server gate is also single-flight; keep each tab single-flight too",
    "client maxConcurrent"
  );

  const aiEnd = "  queueSeq: 0,\n};\nconst cooldownLeft = () => Math.max(0, AI.cooldownUntil - now());";
  const aiHelpers = `  queueSeq: 0,\n  lastError: \"\",\n};\n\n/* ${marker} */\nconst AI_CLIENT_INSTANCE_ID = (() => {\n  try {\n    const key = \"mv_ai_client_instance_v1\";\n    let id = sessionStorage.getItem(key);\n    if (!id) {\n      id = \`tab-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 10)}\`;\n      sessionStorage.setItem(key, id);\n    }\n    return id;\n  } catch (e) {\n    return \`tab-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 10)}\`;\n  }\n})();\n\nfunction aiBackgroundPaused() {\n  try { return localStorage.getItem(\"mv_ai_background_paused_v1\") === \"1\"; }\n  catch (e) { return false; }\n}\n\nfunction setAiBackgroundPaused(paused) {\n  try { localStorage.setItem(\"mv_ai_background_paused_v1\", paused ? \"1\" : \"0\"); }\n  catch (e) {}\n}\n\nfunction inferAiRequestSource(system, prompt, requestMeta = {}) {\n  const explicit = String(requestMeta.source || \"\").trim();\n  if (explicit) return explicit.slice(0, 80);\n  if (requestMeta.interactive) return \"interactive\";\n\n  const text = (String(system || \"\") + \"\\n\" + String(prompt || \"\")).toLowerCase();\n  if (text.includes(\"social-post meaning parser\") || text.includes(\"post meaning\") || text.includes(\"meaning analysis\")) return \"meaning-analysis\";\n  if (text.includes(\"recovery-queue\") || text.includes(\"relationship-auto-follow\") || text.includes(\"auto-follow backlog\")) return \"recovery-queue\";\n  if (text.includes(\"group chat\") || text.includes(\"groupchat\") || text.includes(\"csoportos chat\")) return \"group-chat\";\n  if (text.includes(\"roleplay\") || text.includes(\"jelenet\") || text.includes(\"scene\")) return \"scene\";\n  if (text.includes(\"direct message\") || text.includes(\"private message\") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return \"dm\";\n  if (text.includes(\"comment\") || text.includes(\"komment\") || text.includes(\"reply\") || text.includes(\"válaszkomment\")) return \"comments\";\n  if (text.includes(\"note\") || text.includes(\"jegyzet\")) return \"notes\";\n  if (text.includes(\"social post\") || text.includes(\"feed\") || text.includes(\"poszt\")) return \"feed-post\";\n  return \"autonomy-other\";\n}\n\nfunction ensureAiStatusWidget() {\n  if (typeof document === \"undefined\" || !document.body) return null;\n  let root = document.getElementById(\"mv-ai-status-v1\");\n  if (root) return root;\n\n  root = document.createElement(\"div\");\n  root.id = \"mv-ai-status-v1\";\n  root.style.cssText = \"position:fixed;right:10px;bottom:76px;z-index:2147483000;background:rgba(10,9,16,.94);color:#ECE4DA;border:1px solid #2C2740;border-radius:10px;padding:6px 8px;font:10px/1.35 JetBrains Mono,monospace;max-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.28)\";\n  root.innerHTML = \`<div data-ai-status>AI</div><button data-ai-toggle type=\"button\" style=\"margin-top:4px;border:1px solid #2C2740;background:#1E1A2C;color:#ECE4DA;border-radius:7px;padding:3px 6px;font:10px inherit;cursor:pointer\"></button>\`;\n  const button = root.querySelector(\"[data-ai-toggle]\");\n  button?.addEventListener(\"click\", () => {\n    setAiBackgroundPaused(!aiBackgroundPaused());\n    refreshAiStatusWidget();\n  });\n  document.body.appendChild(root);\n  return root;\n}\n\nfunction refreshAiStatusWidget() {\n  const root = ensureAiStatusWidget();\n  if (!root) return;\n  const left = Math.max(0, Math.ceil((Number(AI.cooldownUntil) - Date.now()) / 1000));\n  const status = root.querySelector(\"[data-ai-status]\");\n  const button = root.querySelector(\"[data-ai-toggle]\");\n  if (status) status.textContent = \`AI queue \${AI.queue.length} · active \${AI.activeWorkers} · cooldown \${left}s\${AI.lastError ? \` · \${String(AI.lastError).slice(0, 90)}\` : \"\"}\`;\n  if (button) button.textContent = aiBackgroundPaused() ? \"Autonóm AI: SZÜNET · indítás\" : \"Autonóm AI: AKTÍV · szünet\";\n}\n\nif (typeof window !== \"undefined\") {\n  setTimeout(refreshAiStatusWidget, 0);\n  setInterval(refreshAiStatusWidget, 1000);\n}\n\nconst cooldownLeft = () => Math.max(0, AI.cooldownUntil - now());`;
  next = mustReplaceOnce(next, aiEnd, aiHelpers, "AI helper insertion");

  const requestPayloadAnchor = `  messages: [{ role: "user", content: prompt }],\n}, ctrl.signal);`;
  const requestPayloadReplacement = `  messages: [{ role: "user", content: prompt }],\n  source: inferAiRequestSource(system, prompt, requestMeta),\n  priority: Number(requestMeta.priority) || (requestMeta.interactive ? 100 : 0),\n  client_instance_id: AI_CLIENT_INSTANCE_ID,\n}, ctrl.signal);`;
  next = mustReplaceOnce(next, requestPayloadAnchor, requestPayloadReplacement, "AI request metadata");

  const requestMetaAnchor = `            {\n              interactive: priority >= 50,\n              timeoutMs: Number(options.timeoutMs) || undefined,\n            }`;
  const requestMetaReplacement = `            {\n              interactive: priority >= 50,\n              priority,\n              source: String(options.source || \"\"),\n              timeoutMs: Number(options.timeoutMs) || undefined,\n            }`;
  next = mustReplaceOnce(next, requestMetaAnchor, requestMetaReplacement, "askJSON request metadata");

  const priorityAnchor = `    ) || 0;\n\n  const maxTries =`;
  const priorityReplacement = `    ) || 0;\n\n  if (priority < 50 && aiBackgroundPaused()) {\n    const paused = new Error(\"Autonomous AI background work is paused.\");\n    paused.backgroundPaused = true;\n    paused.retryable = false;\n    throw paused;\n  }\n\n  const maxTries =`;
  next = mustReplaceOnce(next, priorityAnchor, priorityReplacement, "background pause gate");

  const busyWaitAnchor = `      const maxBusyWaits =\n        priority >= 50\n          ? 4   // játékosi DM/group chat: több belső retry, látható banner nélkül\n          : 2;  // első busy + legfeljebb 1 újrapróbálás`;
  const busyWaitReplacement = `      const maxBusyWaits =\n        priority >= 50\n          ? 4   // direct player work may wait/retry\n          : 1;  // background work never creates a retry storm`;
  next = mustReplaceOnce(next, busyWaitAnchor, busyWaitReplacement, "busy retry count");

  const busyCatchAnchor = `          if (err && err.busy) {\n            busyWaits++;`;
  const busyCatchReplacement = `          if (err && err.busy) {\n            busyWaits++;\n            if (priority < 50) throw err;`;
  next = mustReplaceOnce(next, busyCatchAnchor, busyCatchReplacement, "background busy fast-fail");

  const busyErrorAnchor = `      const err = new Error(\`Az AI most nem győzi — \${Math.ceil(restMs / 1000)} másodperc pihenő.\`);\n      err.busy = true;\n      throw err;`;
  const busyErrorReplacement = `      const err = new Error(\`Az AI most nem győzi — \${Math.ceil(restMs / 1000)} másodperc pihenő.\`);\n      err.busy = true;\n      AI.lastError = err.message;\n      throw err;`;
  next = mustReplaceOnce(next, busyErrorAnchor, busyErrorReplacement, "last AI error");

  const successAnchor = `  if (!txt.trim()) throw new Error("Az AI üres választ adott.");\n  return txt;`;
  const successReplacement = `  if (!txt.trim()) throw new Error("Az AI üres választ adott.");\n  AI.lastError = \"\";\n  return txt;`;
  next = mustReplaceOnce(next, successAnchor, successReplacement, "AI success status");

  const tokenSafetyAnchor = `  if (!requestMeta.interactive && prompt.length > backgroundPromptCap) {\n    prompt = preserveEdges(prompt, backgroundPromptCap, "background prompt");\n  }`;
  const tokenSafetyReplacement = `  const backgroundSystemCap = 18000;\n  if (!requestMeta.interactive && system.length > backgroundSystemCap) {\n    system = preserveEdges(system, backgroundSystemCap, "background system");\n  }\n  if (!requestMeta.interactive && prompt.length > backgroundPromptCap) {\n    prompt = preserveEdges(prompt, backgroundPromptCap, "background prompt");\n  }`;
  next = mustReplaceOnce(next, tokenSafetyAnchor, tokenSafetyReplacement, "background system cap");

  const semanticStart = next.indexOf("async function analyzeSocialPostMeaning(");
  const semanticEnd = semanticStart >= 0 ? next.indexOf("function socialPostMeaningCard(", semanticStart) : -1;
  if (semanticStart < 0 || semanticEnd < 0) throw new Error("AI 429 resilience aborted: semantic helper boundary changed.");
  let semantic = next.slice(semanticStart, semanticEnd);

  const cacheAnchor = `  if (post.socialMeaning && typeof post.socialMeaning === "object" && Number(post.socialMeaning.version) >= 2) {\n    return normalizeSocialPostMeaning(w, post, post.socialMeaning);\n  }`;
  const cacheReplacement = `${cacheAnchor}\n\n  if (cooldownLeft() > 0 || aiBackgroundPaused()) {\n    const fallback = fallbackSocialPostMeaning(w, post);\n    post.socialMeaning = fallback;\n    return fallback;\n  }`;
  if (!semantic.includes(cacheAnchor)) throw new Error("AI 429 resilience aborted: post-meaning cache anchor changed.");
  semantic = semantic.replace(cacheAnchor, cacheReplacement);

  const semanticOptions = `{ maxTokens: 520, maxTries: 1 }`;
  if (!semantic.includes(semanticOptions)) throw new Error("AI 429 resilience aborted: post-meaning options anchor changed.");
  semantic = semantic.replace(semanticOptions, `{ maxTokens: 520, maxTries: 1, priority: -20, source: "meaning-analysis" }`);

  const semanticSuccess = `    return normalizeSocialPostMeaning(w, post, raw);`;
  if (!semantic.includes(semanticSuccess)) throw new Error("AI 429 resilience aborted: post-meaning success anchor changed.");
  semantic = semantic.replace(semanticSuccess, `    const normalized = normalizeSocialPostMeaning(w, post, raw);\n    post.socialMeaning = normalized;\n    return normalized;`);

  const semanticFallback = `    console.warn("Post meaning analysis failed; using grounded fallback:", err);\n    return fallbackSocialPostMeaning(w, post);`;
  if (!semantic.includes(semanticFallback)) throw new Error("AI 429 resilience aborted: post-meaning fallback anchor changed.");
  semantic = semantic.replace(semanticFallback, `    if (!(err && (err.busy || err.backgroundPaused))) {\n      console.warn("Post meaning analysis failed; using grounded fallback:", err);\n    }\n    const fallback = fallbackSocialPostMeaning(w, post);\n    post.socialMeaning = fallback;\n    return fallback;`);

  next = next.slice(0, semanticStart) + semantic + next.slice(semanticEnd);
  return { changed: next !== original, text: next };
}

function patchServer(original) {
  if (original.includes(marker)) return { changed: false, text: original };
  let next = original;

  const keyAnchor = `const OPENAI_API_KEY = process.env.OPENAI_API_KEY;`;
  const keyReplacement = `${keyAnchor}\nconst MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || \"\").trim();\nconst MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || \"\").trim();\nconst GROQ_API_KEY = String(process.env.GROQ_API_KEY || \"\").trim();\nconst GROQ_MODEL = String(process.env.GROQ_MODEL || \"\").trim();\n/* New exact name first; old Railway variable remains accepted for compatibility. */\nconst GEMINI_MODEL_ENV = String(process.env.GEMINI_MODEL || process.env.GEMINI_FALLBACK_MODEL || \"\").trim();\nconst AI_PROVIDER_ORDER_ENV = String(process.env.AI_PROVIDER_ORDER || \"\").trim();\nconst AI_AUTONOMY_INTERVAL_MINUTES = Math.max(0.1, Math.min(60, Number(process.env.AI_AUTONOMY_INTERVAL_MINUTES) || 1));\nconst AI_MIN_REQUEST_GAP_MS = Math.max(250, Math.min(30000, Number(process.env.AI_MIN_REQUEST_GAP_MS) || 2000));`;
  next = mustReplaceOnce(next, keyAnchor, keyReplacement, "server env constants");

  const geminiModelAnchor = `  return String(\n    process.env.GEMINI_MODEL ||\n      "gemini-3.6-flash"\n  ).trim();`;
  const geminiModelReplacement = `  return String(\n    GEMINI_MODEL_ENV ||\n      "gemini-3.6-flash"\n  ).trim();`;
  next = mustReplaceOnce(next, geminiModelAnchor, geminiModelReplacement, "Gemini model env compatibility");

  const getProviderAnchor = `  if (provider === "gemini") {\n    return "gemini";\n  }`;
  const getProviderReplacement = `  if (provider === "mistral" || provider === "groq") {\n    return provider;\n  }\n\n${getProviderAnchor}`;
  next = mustReplaceOnce(next, getProviderAnchor, getProviderReplacement, "new provider names");

  const callStart = next.indexOf("async function callMessageProvider(");
  const semanticMarker = `/* -------------------------------------------------------------------------\n   SEMANTIC CHARACTER MEMORY`;
  const callEnd = callStart >= 0 ? next.indexOf(semanticMarker, callStart) : -1;
  if (callStart < 0 || callEnd < 0) throw new Error("AI 429 resilience aborted: callMessageProvider boundary changed.");

  const providerLayer = `/* ${marker} */\nfunction compatiblePayload(body = {}, model) {\n  const messages = [];\n  if (body.system) messages.push({ role: \"system\", content: String(body.system) });\n  for (const item of Array.isArray(body.messages) ? body.messages : []) {\n    const text = extractText(item?.content || \"\");\n    if (!text) continue;\n    messages.push({ role: item?.role === \"assistant\" ? \"assistant\" : \"user\", content: text });\n  }\n  const payload = { model, messages, max_tokens: body.max_tokens ?? 1024 };\n  if (Number.isFinite(Number(body.temperature))) payload.temperature = Number(body.temperature);\n  return payload;\n}\n\nasync function proxyCompatibleMessage(provider, apiKey, model, url, body) {\n  if (!apiKey || !model) {\n    return { ok: false, status: 503, payload: { error: { message: \`\${provider} is not configured.\` } }, provider };\n  }\n\n  try {\n    const r = await fetch(url, {\n      method: \"POST\",\n      headers: { Authorization: \`Bearer \${apiKey}\`, \"Content-Type\": \"application/json\" },\n      body: JSON.stringify(compatiblePayload(body, model)),\n    });\n    const raw = await r.text();\n    let payload = {};\n    try { payload = raw ? JSON.parse(raw) : {}; } catch (e) { payload = { error: { message: raw || \`\${provider} returned invalid JSON.\` } }; }\n    const retryAfter = String(r.headers?.get?.(\"retry-after\") || \"\").trim();\n    if (!r.ok) return { ok: false, status: r.status, payload, retryAfter, provider };\n    return { ok: true, status: 200, payload: normalizeOpenAIResponse(payload), retryAfter, provider };\n  } catch (err) {\n    return { ok: false, status: 502, payload: { error: { message: String(err?.message || err || \`\${provider} request failed.\`) } }, provider };\n  }\n}\n\nfunction configuredMessageProvider(provider) {\n  if (provider === \"mistral\") return Boolean(MISTRAL_API_KEY && MISTRAL_MODEL);\n  if (provider === \"groq\") return Boolean(GROQ_API_KEY && GROQ_MODEL);\n  if (provider === \"gemini\") return Boolean(GEMINI_API_KEY);\n  if (provider === \"openai\") return Boolean(OPENAI_API_KEY);\n  if (provider === \"anthropic\") return Boolean(ANTHROPIC_API_KEY);\n  return false;\n}\n\nfunction parsedProviderOrder(requestedProvider) {\n  const configuredOrder = AI_PROVIDER_ORDER_ENV\n    .split(/[>,;|\\s]+/)\n    .map((value) => value.trim().toLowerCase())\n    .filter(Boolean);\n  const raw = configuredOrder.length\n    ? configuredOrder\n    : [requestedProvider, \"mistral\", \"groq\", \"gemini\", \"openai\", \"anthropic\"];\n  const out = [];\n  for (const provider of raw) {\n    if (!out.includes(provider) && configuredMessageProvider(provider)) out.push(provider);\n  }\n  return out;\n}\n\nfunction providerCooldownMs(provider) {\n  return Math.max(0, Number(AI_SERVER.providerCooldownUntil.get(provider) || 0) - Date.now());\n}\n\nfunction chooseHealthyMessageProvider(body = {}, requestedProvider = getProvider(body)) {\n  const ordered = parsedProviderOrder(requestedProvider);\n  return ordered.find((provider) => providerCooldownMs(provider) <= 0) || \"\";\n}\n\nfunction parseRetryAfterMs(value) {\n  const text = String(value || \"\").trim();\n  if (!text) return 0;\n  const numeric = Number(text);\n  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric * 1000);\n  const date = Date.parse(text);\n  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;\n}\n\nfunction providerErrorText(result) {\n  try { return proxyErrorMessage(result?.payload, \"\"); } catch (e) { return String(result?.payload?.error?.message || \"\"); }\n}\n\nfunction rememberProviderThrottle(provider, result) {\n  const status = Number(result?.status || 0);\n  if (![429, 529, 503].includes(status)) return;\n  const message = providerErrorText(result).toLowerCase();\n  const retryAfterMs = parseRetryAfterMs(result?.retryAfter);\n  const exhaustedQuota = /free[_ -]?tier|quota exceeded|current quota|no credits|resource exhausted|daily/.test(message);\n  const restMs = exhaustedQuota\n    ? Math.max(retryAfterMs, 15 * 60 * 1000)\n    : Math.max(retryAfterMs, status === 429 ? 5000 : 3000);\n  AI_SERVER.providerCooldownUntil.set(provider, Date.now() + Math.min(60 * 60 * 1000, restMs));\n  console.warn(\"[ai-gate] provider cooldown\", provider, \`status=\${status}\`, \`ms=\${restMs}\`, message.slice(0, 180));\n}\n\nfunction serverAiSource(body = {}) {\n  const explicit = String(body.source || \"\").trim();\n  if (explicit) return explicit.slice(0, 80);\n  const system = String(body.system || \"\");\n  const prompt = (Array.isArray(body.messages) ? body.messages : []).map((m) => extractText(m?.content || \"\")).join(\"\\n\");\n  const text = (system + \"\\n\" + prompt).toLowerCase();\n  if (text.includes(\"social-post meaning parser\") || text.includes(\"post meaning\")) return \"meaning-analysis\";\n  if (text.includes(\"recovery-queue\") || text.includes(\"relationship-auto-follow\")) return \"recovery-queue\";\n  if (text.includes(\"comment\") || text.includes(\"komment\") || text.includes(\"reply\")) return \"comments\";\n  if (text.includes(\"group chat\") || text.includes(\"groupchat\")) return \"group-chat\";\n  if (text.includes(\"roleplay\") || text.includes(\"scene\") || text.includes(\"jelenet\")) return \"scene\";\n  if (text.includes(\"direct message\") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return \"dm\";\n  if (text.includes(\"note\") || text.includes(\"jegyzet\")) return \"notes\";\n  if (text.includes(\"feed\") || text.includes(\"social post\") || text.includes(\"poszt\")) return \"feed-post\";\n  return \"autonomy-other\";\n}\n\nfunction serverAiPriority(body = {}, source = serverAiSource(body)) {\n  const supplied = Number(body.priority);\n  if (Number.isFinite(supplied) && supplied !== 0) return supplied;\n  if (source === \"interactive\" || source === \"scene\" || source === \"group-chat\" || source === \"dm\") return 100;\n  if (source === \"comments\") return 70;\n  if (source === \"feed-post\") return 20;\n  if (source === \"notes\") return 15;\n  if (source === \"meaning-analysis\") return -20;\n  if (source === \"recovery-queue\") return -30;\n  return 10;\n}\n\nfunction serverAiDedupeKey(body = {}, source = serverAiSource(body)) {\n  const prompt = (Array.isArray(body.messages) ? body.messages : []).map((m) => extractText(m?.content || \"\")).join(\"\\n\");\n  return crypto.createHash(\"sha256\").update(source + \"\\n\" + String(body.system || \"\") + \"\\n\" + prompt).digest(\"hex\");\n}\n\nfunction skipMessageResult(reason = \"duplicate-background-work\") {\n  return {\n    ok: true,\n    status: 200,\n    provider: \"server-gate\",\n    payload: {\n      model: \"masvilag-server-gate\", type: \"message\", role: \"assistant\",\n      content: [{ type: \"text\", text: JSON.stringify({ skip: true, reason }) }],\n      usage: { input_tokens: 0, output_tokens: 0 },\n    },\n  };\n}\n\nconst AI_SERVER = {\n  queue: [], active: false, seq: 0, lastStartAt: 0, wakeTimer: null,\n  pendingKeys: new Set(), providerCooldownUntil: new Map(),\n  leaderByWorld: new Map(), lastAutonomyAt: new Map(),\n};\n\nfunction isAutonomyWork(source, priority) {\n  return priority < 50 && ![\"meaning-analysis\", \"recovery-queue\"].includes(source);\n}\n\nfunction backgroundLeaderAllows(body, source, priority) {\n  if (!isAutonomyWork(source, priority)) return true;\n  const worldKey = String(body.__worldKey || \"anon\");\n  const clientId = String(body.client_instance_id || \"unknown\");\n  const current = AI_SERVER.leaderByWorld.get(worldKey);\n  const now = Date.now();\n  if (current && current.expiresAt > now && current.clientId !== clientId) return false;\n  AI_SERVER.leaderByWorld.set(worldKey, { clientId, expiresAt: now + 45 * 1000 });\n  return true;\n}\n\nfunction autonomyNotBefore(body, source, priority) {\n  if (!isAutonomyWork(source, priority)) return Date.now();\n  const worldKey = String(body.__worldKey || \"anon\");\n  const last = Number(AI_SERVER.lastAutonomyAt.get(worldKey) || 0);\n  return Math.max(Date.now(), last + AI_AUTONOMY_INTERVAL_MINUTES * 60 * 1000);\n}\n\nasync function directCallMessageProvider(provider, body) {\n  if (provider === \"mistral\") return proxyCompatibleMessage(\"mistral\", MISTRAL_API_KEY, MISTRAL_MODEL, \"https://api.mistral.ai/v1/chat/completions\", body);\n  if (provider === \"groq\") return proxyCompatibleMessage(\"groq\", GROQ_API_KEY, GROQ_MODEL, \"https://api.groq.com/openai/v1/chat/completions\", body);\n  if (provider === \"openai\") return proxyOpenAIMessage(body);\n  if (provider === \"gemini\") return proxyGeminiMessage({ ...body, model: GEMINI_MODEL_ENV || body.model });\n  return proxyAnthropicMessage(body);\n}\n\nfunction scheduleAiServerPump(delay = 0) {\n  if (AI_SERVER.wakeTimer) clearTimeout(AI_SERVER.wakeTimer);\n  AI_SERVER.wakeTimer = setTimeout(() => { AI_SERVER.wakeTimer = null; pumpAiServerQueue(); }, Math.max(0, delay));\n  AI_SERVER.wakeTimer.unref?.();\n}\n\nasync function pumpAiServerQueue() {\n  if (AI_SERVER.active || !AI_SERVER.queue.length) return;\n  const now = Date.now();\n  AI_SERVER.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);\n  let index = AI_SERVER.queue.findIndex((task) => task.notBefore <= now);\n  if (index < 0) {\n    const earliest = Math.min(...AI_SERVER.queue.map((task) => task.notBefore));\n    scheduleAiServerPump(Math.max(1, earliest - now));\n    return;\n  }\n\n  const gapLeft = Math.max(0, AI_MIN_REQUEST_GAP_MS - (now - AI_SERVER.lastStartAt));\n  if (gapLeft > 0) { scheduleAiServerPump(gapLeft); return; }\n\n  const task = AI_SERVER.queue.splice(index, 1)[0];\n  AI_SERVER.active = true;\n  AI_SERVER.lastStartAt = Date.now();\n  try {\n    const provider = chooseHealthyMessageProvider(task.body, task.requestedProvider);\n    if (!provider) {\n      const waits = parsedProviderOrder(task.requestedProvider).map((p) => providerCooldownMs(p)).filter((ms) => ms > 0);\n      const retryMs = waits.length ? Math.min(...waits) : 30000;\n      task.resolve({ ok: false, status: 429, retryAfter: String(Math.max(1, Math.ceil(retryMs / 1000))), provider: \"server-gate\", payload: { error: { message: \"All configured AI providers are cooling down or unavailable.\" } } });\n    } else {\n      console.info(\"[ai-gate] start\", new Date().toISOString(), \`source=\${task.source}\`, \`priority=\${task.priority}\`, \`provider=\${provider}\`, \`queued=\${AI_SERVER.queue.length}\`);\n      const result = await directCallMessageProvider(provider, task.body);\n      rememberProviderThrottle(provider, result);\n      if (isAutonomyWork(task.source, task.priority)) AI_SERVER.lastAutonomyAt.set(String(task.body.__worldKey || \"anon\"), Date.now());\n      task.resolve(result);\n    }\n  } catch (err) {\n    task.reject(err);\n  } finally {\n    AI_SERVER.pendingKeys.delete(task.key);\n    AI_SERVER.active = false;\n    if (AI_SERVER.queue.length) scheduleAiServerPump(0);\n  }\n}\n\nfunction callMessageProvider(requestedProvider, body = {}) {\n  const source = serverAiSource(body);\n  const priority = serverAiPriority(body, source);\n\n  /* Recovery follow repair is data migration only. Never spend an AI request on it. */\n  if (source === \"recovery-queue\") return Promise.resolve(skipMessageResult(\"recovery-is-data-only\"));\n\n  /* Meaning analysis is optional. If any real work is pending, use the client's grounded fallback immediately. */\n  if (source === \"meaning-analysis\" && (AI_SERVER.active || AI_SERVER.queue.length)) {\n    return Promise.resolve(skipMessageResult(\"meaning-analysis-yielded\"));\n  }\n\n  if (!backgroundLeaderAllows(body, source, priority)) {\n    return Promise.resolve(skipMessageResult(\"another-client-is-autonomy-leader\"));\n  }\n\n  const key = serverAiDedupeKey(body, source);\n  if (priority < 50 && AI_SERVER.pendingKeys.has(key)) {\n    return Promise.resolve(skipMessageResult(\"duplicate-background-request\"));\n  }\n\n  return new Promise((resolve, reject) => {\n    AI_SERVER.pendingKeys.add(key);\n    AI_SERVER.queue.push({\n      body, requestedProvider, source, priority, key, resolve, reject,\n      seq: ++AI_SERVER.seq,\n      notBefore: autonomyNotBefore(body, source, priority),\n    });\n    pumpAiServerQueue();\n  });\n}\n`;

  next = next.slice(0, callStart) + providerLayer + next.slice(callEnd);

  const routeHandlerAnchor = `  async (req, res) => {\n    const requestedProvider =`;
  const routeHandlerReplacement = `  async (req, res) => {\n    const aiSession = await getSessionIdentity(req).catch(() => null);\n    if (req.body && typeof req.body === \"object\") {\n      req.body.__worldKey = aiSession?.worldCode || \"anonymous\";\n    }\n    const requestedProvider =`;
  next = mustReplaceOnce(next, routeHandlerAnchor, routeHandlerReplacement, "AI route world identity");

  const fallbackStart = next.indexOf("    const configuredFallbacks =");
  const providerListStart = fallbackStart >= 0 ? next.indexOf("    const providers = [", fallbackStart) : -1;
  const providerListEnd = providerListStart >= 0 ? next.indexOf("    ];", providerListStart) : -1;
  if (fallbackStart < 0 || providerListStart < 0 || providerListEnd < 0) {
    throw new Error("AI 429 resilience aborted: provider fallback block changed.");
  }
  next = next.slice(0, fallbackStart) + `    /* Provider order and failover are handled by the single-flight gate.\n       One HTTP request triggers at most ONE upstream AI call. */\n    const providers = [requestedProvider];\n` + next.slice(providerListEnd + "    ];".length);

  return { changed: next !== original, text: next };
}

const appOriginal = fs.readFileSync(appPath, "utf8");
const serverOriginal = fs.readFileSync(serverPath, "utf8");
const appPatched = patchApp(appOriginal);
const serverPatched = patchServer(serverOriginal);

/* Validate both before writing either. */
if (appPatched.changed) fs.writeFileSync(appPath, appPatched.text, "utf8");
if (serverPatched.changed) fs.writeFileSync(serverPath, serverPatched.text, "utf8");

if (appPatched.changed || serverPatched.changed) {
  console.log("Applied isolated AI 429 resilience: global single-flight gate, provider order, background leadership and semantic fallback.");
} else {
  console.log("AI 429 resilience already applied.");
}
