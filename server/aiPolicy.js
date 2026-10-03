/*
 * MÁSVILÁG AI COST POLICY
 *
 * Pure helpers (no I/O) that decide which providers a request may use.
 *
 * - FOREGROUND request: the player is waiting for the answer right now (DM reply,
 *   scene turn, reactions to their own post). It may use paid capacity as a last resort.
 * - BACKGROUND request: everything the world does on its own (feed, notes, analysis,
 *   gossip, popups...). It uses FREE providers only. If none is available it WAITS
 *   (503 + Retry-After) instead of falling back to a paid provider.
 */

/* openrouter3 is the paid DeepSeek route and Mistral is billed per use; the paid Gemini key is
   handled by selectGeminiKeys. Free: Gemini keys 2-8, Groq, and the OpenRouter free router. */
export const PAID_PROVIDERS = Object.freeze(new Set(["openai", "anthropic", "openrouter3", "mistral", "mistral2"]));

/* What a request that nobody is waiting for may use for roleplay-style writing (DMs, scenes,
   comments): free providers only, best first. */
export const FREE_WRITING_CHAIN = Object.freeze(["gemini", "groq", "groq2", "openrouter", "openrouter2"]);

export const BACKGROUND_WAIT_MIN_SECONDS = 20;
export const BACKGROUND_WAIT_MAX_SECONDS = 15 * 60;
export const BACKGROUND_WAIT_DEFAULT_SECONDS = 60;

export function isForegroundRequest(body) {
  return Boolean(body) && body.foreground === true;
}

export function filterProvidersForBody(providers, body, options = {}) {
  const list = Array.isArray(providers) ? providers : [];
  if (isForegroundRequest(body) || options.allowPaidBackground === true) return list.slice();
  const freeGeminiKeys = Number(options.freeGeminiKeyCount) || 0;
  return list.filter((provider) =>
    !PAID_PROVIDERS.has(provider) && (provider !== "gemini" || freeGeminiKeys > 0)
  );
}

/* Which Gemini keys a request may try, in order, and how long to wait if none is usable. */
export function selectGeminiKeys({ freeKeys, paidKey, restUntil, now, foreground, allowPaidBackground = false }) {
  const free = (Array.isArray(freeKeys) ? freeKeys : []).filter(Boolean);
  const paid = paidKey ? [paidKey] : [];
  const mayUsePaid = foreground === true || allowPaidBackground === true;
  const pool = mayUsePaid ? [...free, ...paid] : free;
  const restingFor = (key) => Math.max(0, Number(restUntil && restUntil.get(key) || 0) - now);
  const usable = pool.filter((key) => restingFor(key) <= 0);
  if (usable.length) return { keys: usable, waitMs: 0 };
  if (!pool.length) return { keys: [], waitMs: 0 };
  /* Every allowed key is resting: a player waiting on the answer may still try the last key. */
  if (foreground === true) return { keys: pool.slice(-1), waitMs: 0 };
  return { keys: [], waitMs: Math.min(...pool.map(restingFor)) };
}

export function backgroundWaitSeconds(cooldownsMs) {
  const waits = (Array.isArray(cooldownsMs) ? cooldownsMs : []).map(Number).filter((ms) => Number.isFinite(ms) && ms > 0);
  if (!waits.length) return BACKGROUND_WAIT_DEFAULT_SECONDS;
  const seconds = Math.ceil(Math.min(...waits) / 1000);
  return Math.max(BACKGROUND_WAIT_MIN_SECONDS, Math.min(BACKGROUND_WAIT_MAX_SECONDS, seconds));
}

/* The answer for a background request that found no free capacity. */
export function buildWaitingResult({ retryAfterSeconds, details = [] }) {
  const seconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || BACKGROUND_WAIT_DEFAULT_SECONDS));
  return {
    ok: false,
    status: 503,
    waiting: true,
    provider: "server-gate",
    model: "free-ai-wait",
    retryAfter: String(seconds),
    payload: {
      error: {
        type: "free_ai_waiting",
        message:
          "No usable free AI provider right now (all providers are out of quota or busy); waiting instead of using paid capacity / " +
          "Nincs használható ingyenes AI-szolgáltató, várunk, fizetős tartalékot nem használunk." +
          (details.length ? " " + details.join(" | ") : ""),
        providers: details,
      },
    },
  };
}

/* Seconds until the next midnight in Pacific time, when Google resets the daily free-tier quotas. */
export function secondsUntilPacificMidnight(nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(nowMs)).reduce((out, part) => ({ ...out, [part.type]: Number(part.value) }), {});
  const spent = (parts.hour % 24) * 3600 + parts.minute * 60 + parts.second;
  return 24 * 3600 - spent;
}

/* What a Gemini 429 says: which limit was hit and when it comes back. The body lists the violated
   quotas (…PerDay… / …PerMinute…) and, usually, a retryDelay such as "37s". */
export function geminiRateLimitInfo(payload, nowMs = Date.now()) {
  const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
  const quotaIds = details.flatMap((detail) => (Array.isArray(detail?.violations) ? detail.violations : []).map((v) => String(v?.quotaId || v?.quotaMetric || "")));
  const retry = details.find((detail) => /RetryInfo$/.test(String(detail?.["@type"] || "")));
  const delaySeconds = Number.parseFloat(String(retry?.retryDelay || ""));
  const retryDelayMs = Number.isFinite(delaySeconds) ? Math.ceil(delaySeconds * 1000) : 0;
  if (quotaIds.some((id) => /perday/i.test(id.replace(/[_\s]/g, "")))) {
    return { metric: "per-day", restMs: (secondsUntilPacificMidnight(nowMs) + 60) * 1000, retryDelayMs };
  }
  if (quotaIds.some((id) => /perminute/i.test(id.replace(/[_\s]/g, "")))) {
    return { metric: "per-minute", restMs: Math.min(5 * 60 * 1000, Math.max(retryDelayMs + 2000, 15000)), retryDelayMs };
  }
  return { metric: "unknown", restMs: retryDelayMs ? Math.min(30 * 60 * 1000, retryDelayMs + 2000) : 30 * 60 * 1000, retryDelayMs };
}

/* How long a Gemini key rests after an error, in ms (0 = it does not rest). Google reports a bad or
   expired key as HTTP 400 "API key not valid", exhausted prepaid credit as 402, a spent quota as 429
   (a per-minute limit comes back in under a minute, a per-day one at midnight Pacific time). */
export function geminiKeyRestMs(status, message = "", payload = null, nowMs = Date.now()) {
  const code = Number(status);
  if ([401, 403].includes(code) || (code === 400 && /api key/i.test(String(message)))) return 24 * 3600 * 1000;
  if (code === 402) return 6 * 3600 * 1000;
  if (code === 429) return geminiRateLimitInfo(payload, nowMs).restMs;
  return 0;
}
