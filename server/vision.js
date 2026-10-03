/*
 * MÁSVILÁG IMAGE UNDERSTANDING
 *
 * Reading an image (album upload, post, chat photo) is background work and uses FREE capacity only:
 *   1. Groq vision model, key 1 then key 2
 *   2. the free Gemini keys (2-8)
 *   3. nothing else: with no free capacity the answer is "wait" (503 + Retry-After) and the caller
 *      tries again later. OpenAI / Anthropic / the paid Gemini key are used only with
 *      AI_ALLOW_PAID_BACKGROUND=1.
 *
 * Everything the outside world provides (fetch, keys, clock) is injected, so the routing is testable.
 */
import { selectGeminiKeys, geminiKeyRestMs, groqRetryMs, buildWaitingResult, BACKGROUND_WAIT_MIN_SECONDS } from "./aiPolicy.js";

export const DEFAULT_GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const GROQ_VISION_MAX_BASE64 = 3_900_000;   /* Groq accepts about 4 MB of base64 per image */
export const VISION_MAX_OUTPUT_TOKENS = 350;
const GROQ_VISION_DISABLED_MS = 60 * 60 * 1000;
const GROQ_MODEL_CACHE_MS = 6 * 60 * 60 * 1000;
/* Errors that say the MODEL is the problem (gone, no access, cannot take images), not this picture. */
const MODEL_PROBLEM = /model[^.]*(?:not found|does not exist|do not have access|decommission|deprecated|not supported|unavailable)|(?:does not|doesn't) support (?:image|vision)|not (?:a )?(?:vision|multimodal)|(?:image|vision) (?:input )?is not supported|content[^.]*must be a string/i;

const message = (payload, fallback = "") => String(payload?.error?.message || payload?.error || payload?.message || fallback);

export function createVisionRunner({
  fetchFn, groqKeys = [], groqModel = DEFAULT_GROQ_VISION_MODEL, geminiFreeKeys = [], geminiPaidKey = "",
  geminiModel = "gemini-3.5-flash", geminiRestUntil = new Map(), allowPaid = false, paid = {}, now = Date.now, log = console,
}) {
  const groqRestUntil = new Map();
  let groqDisabledUntil = 0;
  let discovered = { model: "", at: 0 };

  /* If the configured model is gone or cannot see images, look for a current vision-capable one. */
  async function discoverGroqModel(key) {
    if (discovered.model && now() - discovered.at < GROQ_MODEL_CACHE_MS) return discovered.model;
    try {
      const response = await fetchFn("https://api.groq.com/openai/v1/models", { method: "GET", headers: { Authorization: `Bearer ${key}` }, timeoutMs: 10000 });
      const payload = await response.json().catch(() => ({}));
      const ids = (Array.isArray(payload?.data) ? payload.data : []).filter((row) => row && row.active !== false).map((row) => String(row.id || ""));
      const found = ids.find((id) => /llama-4-scout/i.test(id)) || ids.find((id) => /llama-4-maverick/i.test(id)) || ids.find((id) => /vision/i.test(id)) || "";
      if (found) discovered = { model: found, at: now() };
      return found;
    } catch (error) {
      return "";
    }
  }

  async function viaGroq(image, prompt, note) {
    if (now() < groqDisabledUntil) { note("groq", 0, "vision model unavailable, waiting for the next hour"); return null; }
    if (image.base64.length > GROQ_VISION_MAX_BASE64) { note("groq", 413, "image is over Groq's 4 MB limit"); return null; }
    for (const { slot, key } of groqKeys) {
      if ((groqRestUntil.get(slot) || 0) > now()) { note(slot, 429, "resting"); continue; }
      let model = discovered.model || groqModel;
      for (let tryNumber = 0; tryNumber < 2; tryNumber += 1) {
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
          break;
        }
        if (response.ok) {
          const text = String(payload?.choices?.[0]?.message?.content || "").trim();
          if (text) return { ok: true, text, provider: slot, model };
          note(slot, 502, "empty description");
          break;
        }
        const text = message(payload, `HTTP ${response.status}`);
        note(slot, response.status, text);
        if (response.status === 429) {
          const wait = Math.max(15000, groqRetryMs(response.headers?.get?.("retry-after"), text) || 60000);
          groqRestUntil.set(slot, now() + Math.min(wait, 6 * 3600 * 1000));
          break;
        }
        if ([401, 403].includes(response.status)) { groqRestUntil.set(slot, now() + 24 * 3600 * 1000); break; }
        if (response.status === 413) return null;
        if ([400, 404, 422].includes(response.status) && MODEL_PROBLEM.test(text)) {
          /* The model is gone or cannot read images: try a discovered one once, otherwise stand down for an hour. */
          if (tryNumber === 0) {
            const other = await discoverGroqModel(key);
            if (other && other !== model) { log.warn?.(`[vision] groq model ${model} unusable (${text.slice(0, 120)}); trying ${other}`); model = other; continue; }
          }
          groqDisabledUntil = now() + GROQ_VISION_DISABLED_MS;
          log.warn?.(`[vision] groq vision disabled for an hour: ${text.slice(0, 160)} (set GROQ_VISION_MODEL to a current vision model)`);
          return null;
        }
        break;
      }
    }
    return null;
  }

  async function viaGemini(image, prompt, note) {
    const selection = selectGeminiKeys({ freeKeys: geminiFreeKeys, paidKey: geminiPaidKey, restUntil: geminiRestUntil, now: now(), foreground: false, allowPaidBackground: allowPaid });
    if (!selection.keys.length) { note("gemini", 429, "every free key is resting"); return null; }
    for (const key of selection.keys) {
      let response, payload;
      try {
        response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
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
        continue;
      }
      if (response.ok) {
        const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || "").join("").trim();
        if (text) return { ok: true, text, provider: "gemini", model: geminiModel };
        note("gemini", 502, "empty description");
        continue;
      }
      const text = message(payload, `HTTP ${response.status}`);
      note("gemini", response.status, text);
      const rest = geminiKeyRestMs(response.status, text, payload, now());
      if (rest > 0) geminiRestUntil.set(key, now() + rest);
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
    const note = (provider, status, text) => attempts.push({ provider, status, message: String(text || "").slice(0, 200) });
    const result = (await viaGroq(image, prompt, note)) || (await viaGemini(image, prompt, note)) || (allowPaid ? await viaPaid(image, prompt, note) : null);
    if (result) return result;

    const details = attempts.map((a) => `${a.provider}: ${a.status || "-"} ${a.message}`.trim());
    /* Nothing is broken for good unless every try was a request-level error (bad image, bad request). */
    const hard = attempts.length > 0 && attempts.every((a) => [400, 415, 422].includes(a.status) && !MODEL_PROBLEM.test(a.message));
    if (hard) return { ok: false, status: 422, payload: { error: { message: "The image could not be read: " + details.join(" | ") } } };

    const waits = [...groqKeys.map(({ slot }) => (groqRestUntil.get(slot) || 0) - now()), ...geminiFreeKeys.map((key) => (geminiRestUntil.get(key) || 0) - now())].filter((ms) => ms > 0);
    const seconds = waits.length ? Math.max(BACKGROUND_WAIT_MIN_SECONDS, Math.min(900, Math.ceil(Math.min(...waits) / 1000))) : 60;
    return buildWaitingResult({ retryAfterSeconds: seconds, details });
  }

  return { analyze, state: () => ({ groqDisabledUntil, groqRestUntil: new Map(groqRestUntil), discovered: { ...discovered } }) };
}
