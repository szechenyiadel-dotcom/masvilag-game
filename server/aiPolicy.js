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

/* openrouter3 is the paid DeepSeek route; the paid Gemini key is handled by selectGeminiKeys. */
export const PAID_PROVIDERS = Object.freeze(new Set(["openai", "anthropic", "openrouter3"]));

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
