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
        retryAfterSeconds: seconds,
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

/* ---------- Groq's free tier: 8,000 tokens per minute per key ---------- */

export const GROQ_FREE_TPM_BUDGET = 7500;     /* a little under the 8,000 limit */
export const GROQ_CHARS_PER_TOKEN = 3;        /* conservative: Hungarian and mixed text */
export const GROQ_MIN_PROMPT_TOKENS = 1200;   /* below this a roleplay prompt is meaningless */

/* Does a request fit Groq's per-minute limit, and if it has to be shortened, how much of each part
   may stay? The answer counts the prompt AND the output allowance (max_tokens). A request that
   cannot fit is never sent: it fails at once and the next provider takes it. */
export function planGroqRequest({ maxTokens = 1024, systemChars = 0, messageChars = [], budgetTokens = GROQ_FREE_TPM_BUDGET }) {
  const allowance = Math.max(1, Math.ceil(Number(maxTokens) || 1024));
  const room = budgetTokens - allowance;
  if (room < GROQ_MIN_PROMPT_TOKENS) {
    return { fits: false, reason: `output allowance of ${allowance} tokens leaves no room for a prompt within ${budgetTokens} tokens per minute` };
  }
  const maxChars = room * GROQ_CHARS_PER_TOKEN;
  const total = systemChars + messageChars.reduce((sum, n) => sum + n, 0);
  if (total <= maxChars) return { fits: true, compact: false, maxChars };
  const systemCap = Math.min(systemChars, Math.floor(maxChars * 0.35));
  const rest = maxChars - systemCap;
  const many = messageChars.length > 1;
  const lastCap = Math.floor(many ? rest * 0.7 : rest);
  const otherCap = many ? Math.floor((rest - lastCap) / (messageChars.length - 1)) : 0;
  return { fits: true, compact: true, maxChars, systemCap, lastCap, otherCap };
}

/* When Groq says to come back: the retry-after header (seconds), or "try again in 1h2m3.4s" in the message. */
export function groqRetryMs(headerValue, message = "") {
  const seconds = Number.parseFloat(String(headerValue || ""));
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  const match = /try again in\s+(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:(\d+(?:\.\d+)?)s)?/i.exec(String(message));
  if (!match) return 0;
  const total = (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000;
  return Math.ceil(total);
}

/* ---------- Groq as the workhorse for utility tasks ---------- */

/* Work that analyses, classifies, translates or summarises. None of it gives a character its voice,
   so a model other than the usual writing chain may answer it. Everything that speaks as a
   character (DMs, scenes, group chats, comments, posts, notes, popups, gossip, sheet summaries,
   character bibles) keeps its own chain on purpose. */
export const GROQ_UTILITY_SOURCES = Object.freeze(new Set([
  "meaning-analysis",      /* what a post says/shows, before anyone reacts to it */
  "display-translate",     /* showing the player's text in the other language */
  "music-note",            /* the theme of a song picked for a note */
  "relationship-impact",   /* how much a comment moved a relationship */
]));

export const GROQ_UTILITY_CHAIN = Object.freeze(["groq", "groq2", "gemini"]);

export function isGroqUtilitySource(source) {
  return GROQ_UTILITY_SOURCES.has(String(source || "").trim().toLowerCase());
}

/* Prompt and output allowance, in Groq tokens, never more than one minute's budget. */
export function estimateGroqTokens({ maxTokens = 1024, systemChars = 0, messageChars = [], budgetTokens = GROQ_FREE_TPM_BUDGET }) {
  const chars = systemChars + messageChars.reduce((sum, n) => sum + n, 0);
  const output = Math.max(1, Math.ceil(Number(maxTokens) || 1024));
  return Math.min(budgetTokens, Math.ceil(chars / GROQ_CHARS_PER_TOKEN) + output);
}

/* A utility task goes to Groq first only when Groq can take it WHOLE: a request that would have to
   be cut down to fit is better read by a model with a bigger window. */
export function groqCarriesWhole({ maxTokens, systemChars, messageChars }) {
  const plan = planGroqRequest({ maxTokens, systemChars, messageChars });
  return plan.fits && !plan.compact;
}

/* How long a request may wait for its turn on a Groq key before the next provider takes it. */
export function groqPaceMaxWaitMs(body) {
  return isForegroundRequest(body) ? 8000 : 20000;
}

export const GROQ_WINDOW_MS = 60 * 1000;

/* Groq requests are spaced out, never piled up: each key runs ONE request at a time and the tokens
   spent in the last minute (prompt + output allowance, corrected by what Groq reports afterwards)
   never pass the free tier's budget. A request that does not fit right now either waits a little
   (acquire) or is turned away with the time to come back (tryAcquire). */
export function createGroqPacer({ budgetTokens = GROQ_FREE_TPM_BUDGET, windowMs = GROQ_WINDOW_MS, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const slots = new Map();
  const stateOf = (slot) => {
    if (!slots.has(slot)) slots.set(slot, { busy: false, spent: [] });
    return slots.get(slot);
  };
  const total = (rows) => rows.reduce((sum, row) => sum + row.tokens, 0);

  function budgetWaitMs(state, tokens, at) {
    state.spent = state.spent.filter((row) => row.at > at - windowMs);
    let used = total(state.spent);
    if (used + tokens <= budgetTokens) return 0;
    for (const row of [...state.spent].sort((a, b) => a.at - b.at)) {
      used -= row.tokens;
      if (used + tokens <= budgetTokens) return Math.max(1, row.at + windowMs - at + 1);
    }
    return windowMs;
  }

  function tryAcquire(slot, tokens) {
    const state = stateOf(slot);
    const at = now();
    if (state.busy) return { ok: false, reason: "busy", waitMs: 0 };
    const claim = Math.min(budgetTokens, Math.max(1, Math.ceil(Number(tokens) || 1)));
    const wait = budgetWaitMs(state, claim, at);
    if (wait > 0) return { ok: false, reason: "budget", waitMs: wait };
    const row = { at, tokens: claim };
    state.busy = true;
    state.spent.push(row);
    let released = false;
    return {
      ok: true,
      /* actualTokens: what Groq reported (0 when nothing was consumed); omitted = keep the estimate */
      release(actualTokens) {
        if (released) return;
        released = true;
        state.busy = false;
        if (Number.isFinite(actualTokens) && actualTokens >= 0) row.tokens = Math.ceil(actualTokens);
      },
    };
  }

  async function acquire(slot, tokens, maxWaitMs = 0) {
    const deadline = now() + Math.max(0, maxWaitMs);
    for (;;) {
      const attempt = tryAcquire(slot, tokens);
      if (attempt.ok) return attempt;
      const remaining = deadline - now();
      const pause = attempt.reason === "busy" ? 400 : attempt.waitMs;
      if (remaining <= 0 || pause > remaining) return attempt;
      await sleep(Math.max(1, pause));
    }
  }

  return {
    tryAcquire,
    acquire,
    state: (slot) => {
      const state = stateOf(slot);
      const at = now();
      return { busy: state.busy, spentTokens: total(state.spent.filter((row) => row.at > at - windowMs)) };
    },
  };
}
