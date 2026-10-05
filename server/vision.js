/*
 * MÁSVILÁG IMAGE UNDERSTANDING
 *
 * Reading an image (album upload, post, chat photo) is background work and uses FREE capacity only:
 *   1. Groq vision model, key 1 then key 2
 *   2. OpenRouter :free vision models on the funded key (R82: Qwen 3.8 VL, Gemma 4) — Groq has no vision model now
 *   3. the free Gemini keys (2-8)
 *   3. nothing else: with no free capacity the answer is "wait" (503 + Retry-After) and the caller
 *      tries again later. OpenAI / Anthropic / the paid Gemini key are used only with
 *      AI_ALLOW_PAID_BACKGROUND=1.
 *
 * Everything the outside world provides (fetch, keys, clock) is injected, so the routing is testable.
 */
import { selectGeminiKeys, groqRetryMs, buildWaitingResult, createGeminiLedger, geminiModelConfig, BACKGROUND_WAIT_MIN_SECONDS } from "./aiPolicy.js";

export const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
/* R82: free OpenRouter models that take images (override with OPENROUTER_VISION_MODELS, comma-separated) */
export const DEFAULT_OPENROUTER_VISION_MODELS = ["qwen/qwen3.8-27b:free", "google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it:free", "openrouter/free"];
export const GROQ_VISION_MAX_BASE64 = 3_900_000;   /* Groq accepts about 4 MB of base64 per image */
export const VISION_MAX_OUTPUT_TOKENS = 350;
/* What one picture costs on a Groq key before Groq reports the real figure (image + prompt + answer). */
export const GROQ_VISION_TOKEN_ESTIMATE = 5000;
export const GROQ_VISION_MAX_WAIT_MS = 15000;
export const GEMINI_VISION_MAX_ATTEMPTS = 6;   /* calls to Gemini for ONE picture, however many keys and models exist */
const GROQ_VISION_DISABLED_MS = 60 * 60 * 1000;
const GROQ_MODEL_CACHE_MS = 6 * 60 * 60 * 1000;
const GROQ_MODEL_LIST_CACHE_MS = 10 * 60 * 1000;
const GROQ_DISCOVERY_MAX_TRIES = 3;
/* Model ids that can take images on Groq (Llama 4 is multimodal), and ids that are never chat models. */
export const GROQ_VISION_LIKE = /llama-4|scout|maverick|vision|(?:^|[-_/.])vl(?:[-_/.]|$)|multimodal|pixtral|llava|gemma-?3|omni/i;
const GROQ_NOT_CHAT = /whisper|tts|guard|embed|playai|orpheus|distil|compound|transcri|speech/i;
export function groqVisionRank(id) {
  const v = String(id || "").toLowerCase();
  if (/llama-4-scout/.test(v)) return 0;
  if (/llama-4-maverick/.test(v)) return 1;
  if (/llama-4/.test(v)) return 2;
  if (/llama.*vision/.test(v)) return 3;
  if (/vision|multimodal|(?:^|[-_/.])vl(?:[-_/.]|$)/.test(v)) return 4;
  return 5;
}
/* Errors that say the MODEL is the problem (gone, no access, cannot take images), not this picture. */
const MODEL_PROBLEM = /model[^.]*(?:not found|does not exist|do not have access|decommission|deprecated|not supported|unavailable)|(?:does not|doesn't) support (?:image|vision)|not (?:a )?(?:vision|multimodal)|(?:image|vision) (?:input )?is not supported|content[^.]*must be a string/i;

const message = (payload, fallback = "") => String(payload?.error?.message || payload?.error || payload?.message || fallback);

export function createVisionRunner({
  fetchFn, groqKeys = [], groqModel = DEFAULT_GROQ_VISION_MODEL, geminiFreeKeys = [], geminiPaidKey = "",
  now = Date.now, geminiModels = geminiModelConfig({}).vision, ledger = createGeminiLedger({ now }), allowPaid = false, paid = {}, pacer = null, log = console,
  openRouter = { key: "", models: [] },
}) {
  const openRouterRestUntil = new Map();
  const groqRestUntil = new Map();
  let groqDisabledUntil = 0;
  let discovered = { model: "", at: 0 };
  /* "slot|model" pairs that answered "this model is unusable" — skipped for a while, per key,
     because one key may have access to a model the other does not. */
  const badModelUntil = new Map();
  let modelList = { ids: [], at: 0 };

  /* Groq's own list of models this key can use (cached for 10 minutes). */
  async function listGroqModels(key) {
    if (modelList.ids.length && now() - modelList.at < GROQ_MODEL_LIST_CACHE_MS) return modelList.ids;
    try {
      const response = await fetchFn("https://api.groq.com/openai/v1/models", { method: "GET", headers: { Authorization: `Bearer ${key}` }, timeoutMs: 10000 });
      if (!response.ok) return [];
      const payload = await response.json().catch(() => ({}));
      const ids = (Array.isArray(payload?.data) ? payload.data : []).filter((row) => row && row.active !== false).map((row) => String(row.id || "")).filter(Boolean);
      if (ids.length) modelList = { ids, at: now() };
      return ids;
    } catch (error) {
      return [];
    }
  }

  /* If the configured model is gone or cannot see images, find the current vision-capable ones:
     Llama 4 (Scout, then Maverick) first, then any other Llama vision / multimodal model. */
  async function discoverGroqModels(key, slot, exclude) {
    const ids = await listGroqModels(key);
    return ids
      .filter((id) => GROQ_VISION_LIKE.test(id) && !GROQ_NOT_CHAT.test(id) && !exclude.has(id) && (badModelUntil.get(slot + "|" + id) || 0) <= now())
      .sort((a, b) => groqVisionRank(a) - groqVisionRank(b) || a.localeCompare(b))
      .slice(0, GROQ_DISCOVERY_MAX_TRIES);
  }

  async function viaGroq(image, prompt, note) {
    if (now() < groqDisabledUntil) { note("groq", 0, "vision model unavailable, waiting for the next hour"); return null; }
    if (image.base64.length > GROQ_VISION_MAX_BASE64) { note("groq", 413, "image is over Groq's 4 MB limit"); return null; }
    let keysTried = 0;
    let keysWithOnlyModelProblems = 0;
    for (const { slot, key } of groqKeys) {
      if ((groqRestUntil.get(slot) || 0) > now()) { note(slot, 429, "resting"); continue; }
      /* Shares the key's one-request-at-a-time turn and minute budget with the chat traffic. */
      let lease = null;
      if (pacer) {
        const grant = await pacer.acquire(slot, GROQ_VISION_TOKEN_ESTIMATE, GROQ_VISION_MAX_WAIT_MS);
        if (!grant.ok) { note(slot, 429, `busy (${grant.reason})`, Math.max(3000, grant.waitMs || 0)); continue; }
        lease = grant;
      }
      keysTried += 1;
      let usedTokens;
      let modelProblem = false;
      let otherOutcome = false;
      try {
        const remembered = discovered.model && now() - discovered.at < GROQ_MODEL_CACHE_MS ? discovered.model : "";
        const queue = [remembered, groqModel].filter((m, i, a) => m && a.indexOf(m) === i && (badModelUntil.get(slot + "|" + m) || 0) <= now());
        const tried = new Set();
        let searched = false;
        while (tried.size < GROQ_DISCOVERY_MAX_TRIES + 2) {
          if (!queue.length) {
            if (searched) break;
            searched = true;
            const found = await discoverGroqModels(key, slot, tried);
            if (!found.length) break;
            log.warn?.(`[vision] ${slot}: looking for a working vision model — trying ${found.join(", ")}`);
            queue.push(...found);
            continue;
          }
          const model = queue.shift();
          if (tried.has(model)) continue;
          tried.add(model);
          let response, payload;
          try {
            response = await fetchFn("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body: JSON.stringify({
                model, max_completion_tokens: VISION_MAX_OUTPUT_TOKENS, temperature: 0.2,
                messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image.dataUrl } }] }],
              }),
              timeoutMs: 40000,
            });
            payload = await response.json().catch(() => ({}));
          } catch (error) {
            note(slot, 504, error?.message || "request failed");
            otherOutcome = true;
            break;
          }
          if (response.ok) {
            const reported = Number(payload?.usage?.total_tokens);
            if (Number.isFinite(reported) && reported >= 0) usedTokens = reported;
            const text = String(payload?.choices?.[0]?.message?.content || "").trim();
            if (text) {
              /* a working model other than the configured one is remembered for both keys */
              if (model !== groqModel && discovered.model !== model) log.warn?.(`[vision] groq vision now uses ${model} (set GROQ_VISION_MODEL=${model} to make it the default)`);
              if (model !== groqModel) discovered = { model, at: now() };
              return { ok: true, text, provider: slot, model };
            }
            note(slot, 502, "empty description");
            otherOutcome = true;
            break;
          }
          const text = message(payload, `HTTP ${response.status}`);
          note(slot, response.status, text);
          if (response.status === 429) {
            const wait = Math.max(15000, groqRetryMs(response.headers?.get?.("retry-after"), text) || 60000);
            groqRestUntil.set(slot, now() + Math.min(wait, 6 * 3600 * 1000));
            otherOutcome = true;
            break;
          }
          if ([401, 403].includes(response.status) && !MODEL_PROBLEM.test(text)) { groqRestUntil.set(slot, now() + 24 * 3600 * 1000); otherOutcome = true; break; }
          if (response.status === 413) return null;
          if ([400, 403, 404, 422].includes(response.status) && MODEL_PROBLEM.test(text)) {
            /* This model is gone / not allowed / cannot read images on this key: remember that, try the
               next candidate (a discovered current vision model) with the SAME picture. */
            badModelUntil.set(slot + "|" + model, now() + GROQ_MODEL_CACHE_MS);
            if (discovered.model === model) discovered = { model: "", at: 0 };
            modelProblem = true;
            continue;
          }
          otherOutcome = true;
          break;
        }
      } finally {
        if (lease) lease.release(usedTokens);
      }
      if (modelProblem && !otherOutcome) keysWithOnlyModelProblems += 1;
    }
    /* Only when EVERY key that was asked found no usable vision model does Groq stand down. */
    if (keysTried > 0 && keysWithOnlyModelProblems === keysTried) {
      groqDisabledUntil = now() + GROQ_VISION_DISABLED_MS;
      log.warn?.(`[vision] groq vision disabled for an hour: no vision-capable Groq model is available to any key (set GROQ_VISION_MODEL to a current vision model)`);
    }
    return null;
  }

  /* Light models first (reading what is on a picture is easy work), then the full ones; each model has
     its own free quota on a key, so a spent one only moves on to the next. */
  async function viaGemini(image, prompt, note) {
    let calls = 0;
    for (const model of geminiModels) {
      const selection = selectGeminiKeys({ freeKeys: geminiFreeKeys, paidKey: geminiPaidKey, restUntil: ledger.view(model), now: now(), foreground: false, allowPaidBackground: allowPaid });
      if (!selection.keys.length) { note("gemini", 429, `every free key is resting for ${model}`, selection.waitMs); continue; }
      for (const key of selection.keys) {
        /* an earlier try for this very picture may just have shown the model is gone */
        if (ledger.restMs(key, model) > 0) continue;
        if (calls >= GEMINI_VISION_MAX_ATTEMPTS) return null;
        calls += 1;
        let response, payload;
        try {
          response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }],
              generationConfig: { maxOutputTokens: VISION_MAX_OUTPUT_TOKENS },
            }),
            timeoutMs: 40000,
          });
          payload = await response.json().catch(() => ({}));
        } catch (error) {
          note("gemini", 504, error?.message || "request failed");
          ledger.fail(key, model, { status: 504 });
          continue;
        }
        if (response.ok) {
          const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || "").join("").trim();
          if (text) { ledger.succeed(key, model); return { ok: true, text, provider: "gemini", model }; }
          note("gemini", 502, "empty description");
          continue;
        }
        const text = message(payload, `HTTP ${response.status}`);
        note("gemini", response.status, text);
        ledger.fail(key, model, { status: response.status, message: text, payload });
      }
    }
    return null;
  }

  /* R82: OpenRouter's free vision models, one after the other; a busy (429) or missing model rests a while. */
  async function viaOpenRouter(image, prompt, note) {
    const key = String(openRouter?.key || "");
    const models = Array.isArray(openRouter?.models) ? openRouter.models.filter(Boolean) : [];
    if (!key || !models.length) return null;
    for (const model of models) {
      if ((openRouterRestUntil.get(model) || 0) > now()) { note("openrouter", 429, `${model} resting`); continue; }
      let response, payload;
      try {
        response = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model, max_tokens: VISION_MAX_OUTPUT_TOKENS, temperature: 0.2,
            reasoning: { enabled: false, exclude: true },
            messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image.dataUrl } }] }],
          }),
          timeoutMs: 40000,
        });
        payload = await response.json().catch(() => ({}));
      } catch (error) {
        note("openrouter", 504, `${model}: ${error?.message || "request failed"}`);
        continue;
      }
      if (response.ok) {
        const text = String(payload?.choices?.[0]?.message?.content || "").trim();
        if (text) return { ok: true, text, provider: "openrouter", model: String(payload?.model || model) };
        note("openrouter", 502, `${model}: empty description`);
        continue;
      }
      const text = message(payload, `HTTP ${response.status}`);
      note("openrouter", response.status, `${model}: ${text}`);
      if (response.status === 429) openRouterRestUntil.set(model, now() + 60000);
      else if ([400, 404, 422].includes(response.status) && MODEL_PROBLEM.test(text)) openRouterRestUntil.set(model, now() + GROQ_MODEL_CACHE_MS);
    }
    return null;
  }

  /* Billed providers: only when switched on explicitly. */
  async function viaPaid(image, prompt, note) {
    for (const name of ["openai", "anthropic"]) {
      if (typeof paid[name] !== "function") continue;
      try {
        const result = await paid[name](image, prompt);
        if (result && result.ok) return result;
        note(name, result?.status || 502, message(result?.payload, "failed"));
      } catch (error) {
        note(name, 502, error?.message || "failed");
      }
    }
    return null;
  }

  async function analyze({ image, prompt }) {
    /* What was tried for THIS image; several images can be read at the same time. */
    const attempts = [];
    const note = (provider, status, text, retryMs = 0) => attempts.push({ provider, status, message: String(text || "").slice(0, 200), retryMs });
    const result = (await viaGroq(image, prompt, note)) || (await viaOpenRouter(image, prompt, note)) || (await viaGemini(image, prompt, note)) || (allowPaid ? await viaPaid(image, prompt, note) : null);
    if (result) return result;

    const details = attempts.map((a) => `${a.provider}: ${a.status || "-"} ${a.message}`.trim());
    /* Nothing is broken for good unless every try was a request-level error (bad image, bad request). */
    const hard = attempts.length > 0 && attempts.every((a) => [400, 415, 422].includes(a.status) && !MODEL_PROBLEM.test(a.message));
    if (hard) return { ok: false, status: 422, payload: { error: { message: "The image could not be read: " + details.join(" | ") } } };

    const waits = [
      ...groqKeys.map(({ slot }) => (groqRestUntil.get(slot) || 0) - now()),
      ...geminiFreeKeys.flatMap((key) => geminiModels.map((model) => ledger.restMs(key, model))),
      ...attempts.map((a) => a.retryMs || 0),
    ].filter((ms) => ms > 0);
    const seconds = waits.length ? Math.max(BACKGROUND_WAIT_MIN_SECONDS, Math.min(900, Math.ceil(Math.min(...waits) / 1000))) : 60;
    return buildWaitingResult({ retryAfterSeconds: seconds, details });
  }

  return { analyze, state: () => ({ groqDisabledUntil, groqRestUntil: new Map(groqRestUntil), discovered: { ...discovered } }) };
}
