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

/* Mistral and the paid Venice DM route are billed per use; Dolphin3.0 :free and Nemotron :free stay
   available to background work. The paid Gemini key is handled separately by selectGeminiKeys. */
export const PAID_PROVIDERS = Object.freeze(new Set(["openai", "anthropic", "openrouter-dm-venice", "mistral", "mistral2"]));

/* What a request that nobody is waiting for may use for roleplay-style writing (DMs, scenes,
   comments): free providers only, best first. */
export const FREE_WRITING_CHAIN = Object.freeze(["gemini", "groq", "groq2", "openrouter", "openrouter2"]);

export const BACKGROUND_WAIT_MIN_SECONDS = 20;
export const BACKGROUND_WAIT_MAX_SECONDS = 15 * 60;
export const BACKGROUND_WAIT_DEFAULT_SECONDS = 60;

export function isForegroundRequest(body) {
  return Boolean(body) && body.foreground === true;
}

/* What the world may write on its own when every free provider is spent or busy: Gemini, then OpenRouter, and OpenAI
   as the very last one (the owner's rule). Not for popups and invitations (never paid), nor for the analysis and
   translation chores that run constantly and have free chains of their own. */
export const PAID_LAST_RESORT_PROVIDERS = Object.freeze(["openai"]);
export function mayUsePaidLastResort(source, isUtility = false) {
  const kind = String(source || "").trim().toLowerCase();
  if (isUtility) return false;
  return !/popup|invite/.test(kind) && kind !== "dm" && kind !== "scene";
}

export function filterProvidersForBody(providers, body, options = {}) {
  const list = Array.isArray(providers) ? providers : [];
  if (isForegroundRequest(body) || options.allowPaidBackground === true) return list.slice();
  const freeGeminiKeys = Number(options.freeGeminiKeyCount) || 0;
  const paidAllowed = new Set(Array.isArray(options.paidAllowed) ? options.paidAllowed : []);
  return list.filter((provider) =>
    (!PAID_PROVIDERS.has(provider) || paidAllowed.has(provider)) && (provider !== "gemini" || freeGeminiKeys > 0)
  );
}

/* One request walks a chain of providers, but the app that asked gives up after its own timeout. The chain gets that
   time as ONE budget: each provider, while others follow it, may take a share of what is left (never less than the
   floor), so the next provider is reached before the app stops listening. The last one gets all that is left. */
export function providerTimeBudget({ budgetMs, elapsedMs, providersLeft, isFirst, floorMs = 12000, middleCapMs = 15000 }) {
  const budget = Number(budgetMs) || 0;
  if (!(budget > 0)) return 0;   /* no budget (a careful reading, or the caller did not say): the provider keeps its own timeout */
  const remaining = Math.max(0, budget - Math.max(0, Number(elapsedMs) || 0));
  if (!(providersLeft > 0)) return Math.max(floorMs, remaining);
  /* The free models in the middle of a chain either answer within a few seconds or hang until their timeout: none of
     them is given more than the cap, so a chain of three slow ones does not eat the whole budget. */
  const share = Math.floor(remaining * (isFirst ? 0.45 : 0.6));
  return Math.max(floorMs, Math.min(remaining, share, isFirst ? Infinity : middleCapMs));
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
  const violations = details.flatMap((detail) => (Array.isArray(detail?.violations) ? detail.violations : []));
  const quotaIds = violations.map((v) => String(v?.quotaId || v?.quotaMetric || ""));
  const retry = details.find((detail) => /RetryInfo$/.test(String(detail?.["@type"] || "")));
  const delaySeconds = Number.parseFloat(String(retry?.retryDelay || ""));
  const retryDelayMs = Number.isFinite(delaySeconds) ? Math.ceil(delaySeconds * 1000) : 0;
  const flat = (id) => id.replace(/[_\s]/g, "");
  const perDay = quotaIds.some((id) => /perday/i.test(flat(id)));
  const perMinute = quotaIds.some((id) => /perminute/i.test(flat(id)));
  /* What Google says the limit is (quotaValue) and which model it counted on, so the real size of the
     free quota shows up in the log instead of being guessed. */
  const pickIndex = Math.max(0, quotaIds.findIndex((id) => (perDay ? /perday/i : /perminute/i).test(flat(id))));
  const violation = violations[pickIndex] || {};
  const extra = {
    retryDelayMs,
    limit: Number(violation.quotaValue) || 0,
    limitKnown: violation.quotaValue !== undefined && String(violation.quotaValue).trim() !== "",
    quotaId: String(violation.quotaId || violation.quotaMetric || ""),
    quotaModel: String(violation.quotaDimensions?.model || ""),
  };
  if (perDay) return { metric: "per-day", restMs: (secondsUntilPacificMidnight(nowMs) + 60) * 1000, ...extra };
  if (perMinute) return { metric: "per-minute", restMs: Math.min(5 * 60 * 1000, Math.max(retryDelayMs + 2000, 15000)), ...extra };
  return { metric: "unknown", restMs: retryDelayMs ? Math.min(30 * 60 * 1000, retryDelayMs + 2000) : 30 * 60 * 1000, ...extra };
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

/* ---------- Gemini: which models, and which (key, model) pairs are resting ---------- */

/* The free tier counts quota per project AND per model, so one key has several independent daily
   buckets. The ladder uses them in turn instead of declaring a whole key spent. */
export const DEFAULT_GEMINI_PRIMARY_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_EXTRA_MODELS = Object.freeze(["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]);
export const DEFAULT_GEMINI_LITE_MODELS = Object.freeze(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]);

const unique = (values) => [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || "").trim()).filter(Boolean))];
const listFrom = (value, fallback) => {
  const text = String(value || "").trim();
  if (/^(off|none|-)$/i.test(text)) return [];
  const rows = unique(text.split(/[\s,;]+/));
  return rows.length ? rows : [...fallback];
};

/* GEMINI_MODEL: the main writing model (GEMINI_FALLBACK_MODEL is the old name for it).
   GEMINI_DEEP_MODEL: careful readings. GEMINI_EXTRA_MODELS / GEMINI_LITE_MODELS: comma lists,
   "off" switches a list off. GEMINI_VISION_MODEL, if set, is tried first for pictures. */
export function geminiModelConfig(env = {}) {
  const primary = String(env.GEMINI_MODEL || env.GEMINI_FALLBACK_MODEL || DEFAULT_GEMINI_PRIMARY_MODEL).trim();
  const deep = String(env.GEMINI_DEEP_MODEL || primary).trim();
  const extra = listFrom(env.GEMINI_EXTRA_MODELS, DEFAULT_GEMINI_EXTRA_MODELS).filter((m) => m !== primary);
  const lite = listFrom(env.GEMINI_LITE_MODELS, DEFAULT_GEMINI_LITE_MODELS);
  const visionFirst = String(env.GEMINI_VISION_MODEL || "").trim();
  const vision = unique([visionFirst, ...lite, primary, ...extra]);
  return { primary, deep, extra, lite, vision };
}

/* Models for one request, best first. Careful readings use the full models only (a whole-sheet reading adds the light
   ones at the very end). Everything that
   speaks as a character uses the full models only too (a lite model would change the voice). Light
   utility work (the same short list that goes to Groq first) uses the lite buckets first, so the
   full models' daily quota is left for the writing. */
export const SHEET_READING_SOURCES = Object.freeze(["character-bible", "sheet-summary"]);
export function geminiModelLadder(config, body) {
  const source = String(body?.source || "").trim().toLowerCase();
  const deep = String(body?.quality || "") === "deep";
  const light = !deep && isGroqUtilitySource(source);
  /* Reading a whole sheet once (the digest every later reply leans on) must not stay undone just because the full
     models are overloaded: the light models, which take as long a text, come after all of them. */
  const sheetReading = deep && SHEET_READING_SOURCES.includes(source);
  const list = sheetReading
    ? [config.deep, config.primary, ...config.extra, ...config.lite]
    : deep
    ? [config.deep, config.primary, ...config.extra]
    : light
      ? [...config.lite, config.primary, ...config.extra]
      : [config.primary, ...config.extra];
  return unique(list);
}

/* After a run of timeouts / 5xx a (key, model) pair rests a little instead of being tried by every
   request: 30 s after the second failure in a row, doubling, never more than 10 minutes. */
export function geminiStreakRestMs(streak) {
  const n = Number(streak) || 0;
  return n < 2 ? 0 : Math.min(10 * 60 * 1000, 30000 * Math.pow(2, n - 2));
}

const GEMINI_RETRYABLE = [0, 408, 500, 502, 503, 504, 529];

export function createGeminiLedger({ now = Date.now } = {}) {
  const keyRest = new Map();     /* key -> until: a bad key or spent credit, whatever the model */
  const pairRest = new Map();    /* model|key -> until: that model's quota is spent on that key */
  const modelRest = new Map();   /* model -> until: the model does not exist / is not offered */
  const streaks = new Map();
  let rotation = 0;
  const pairId = (key, model) => model + "\u0000" + key;
  const untilFor = (key, model) => Math.max(keyRest.get(key) || 0, pairRest.get(pairId(key, model)) || 0, modelRest.get(model) || 0);
  const restMs = (key, model) => Math.max(0, untilFor(key, model) - now());
  const extend = (map, id, until) => { if (until > (map.get(id) || 0)) map.set(id, until); };

  /* A Map-like window onto one model's rest times, for code that only needs get(key) / set(key, until). */
  const view = (model) => ({
    get: (key) => untilFor(key, model),
    set: (key, until) => { extend(pairRest, pairId(key, model), Number(until) || 0); },
  });

  function fail(key, model, { status, message = "", payload = null } = {}) {
    const code = Number(status) || 0;
    const text = String(message || "");
    const at = now();
    if ([401, 403].includes(code) || (code === 400 && /api key/i.test(text))) {
      extend(keyRest, key, at + 24 * 3600 * 1000);
      return { level: "key", restMs: 24 * 3600 * 1000, metric: "invalid-key" };
    }
    if (code === 402) {
      extend(keyRest, key, at + 6 * 3600 * 1000);
      return { level: "key", restMs: 6 * 3600 * 1000, metric: "no-credit" };
    }
    if (code === 429) {
      const info = geminiRateLimitInfo(payload, at);
      streaks.delete(pairId(key, model));
      /* Google says the daily limit is ZERO: the model has no free quota at all, so no key will ever have any
         (it is not "used up"). It rests until the quota day turns over, on every key, instead of being probed
         on each key in turn. */
      if (info.metric === "per-day" && info.limitKnown && info.limit === 0) {
        extend(modelRest, model, at + info.restMs);
        return { level: "model-no-free-quota", restMs: info.restMs, metric: info.metric, limit: 0, quotaId: info.quotaId, quotaModel: info.quotaModel };
      }
      extend(pairRest, pairId(key, model), at + info.restMs);
      return { level: "model", restMs: info.restMs, metric: info.metric, limit: info.limit, quotaId: info.quotaId, quotaModel: info.quotaModel };
    }
    if (code === 404 && /models\/\S+ is not found|is not found for api version|not supported for generatecontent|model[^.]*does not exist|no longer available|model[^.]*is not available/i.test(text)) {
      extend(modelRest, model, at + 6 * 3600 * 1000);
      return { level: "model-gone", restMs: 6 * 3600 * 1000, metric: "model-not-available" };
    }
    /* "This model is currently experiencing high demand": the model is overloaded for everyone, whatever the key.
       It rests a minute on every key, so the next model is tried instead of this one on each key in turn. */
    if (code === 503 && /high demand|overloaded|experiencing high/i.test(text)) {
      extend(modelRest, model, at + 60000);
      return { level: "model-busy", restMs: 60000, metric: "busy", retryable: true };
    }
    if (GEMINI_RETRYABLE.includes(code)) {
      const streak = (streaks.get(pairId(key, model)) || 0) + 1;
      streaks.set(pairId(key, model), streak);
      const rest = geminiStreakRestMs(streak);
      if (rest > 0) extend(pairRest, pairId(key, model), at + rest);
      return { level: rest > 0 ? "model" : "none", restMs: rest, metric: "unavailable", streak, retryable: true };
    }
    return { level: "none", restMs: 0, metric: "request-error" };
  }

  const succeed = (key, model) => { streaks.delete(pairId(key, model)); };

  return { restMs, view, fail, succeed, nextRotation: () => rotation++, state: () => ({ keys: keyRest.size, pairs: pairRest.size, models: modelRest.size }) };
}

/* The (key, model) pairs one request will try, in order, and how long to wait when there are none.
   Free keys only, model by model (the best model on every free key before the next model), at most
   perModel keys per model and maxAttempts in all, with the starting key rotated so no key takes every
   request. A player who is waiting (or an explicit opt-in) gets the paid key as the very last step. */
export function planGeminiAttempts({ freeKeys, paidKey = "", models, ledger, foreground = false, allowPaidBackground = false, rotation = 0, perModel = 2, maxAttempts = 4 }) {
  const free = unique(freeKeys);
  const ladder = unique(models);
  const attempts = [];
  for (const model of ladder) {
    const usable = free.filter((key) => ledger.restMs(key, model) <= 0);
    if (!usable.length) continue;
    const start = ((Number(rotation) || 0) % usable.length + usable.length) % usable.length;
    for (let i = 0; i < Math.min(perModel, usable.length); i += 1) attempts.push({ key: usable[(start + i) % usable.length], model });
  }
  const chosen = attempts.slice(0, maxAttempts);
  const mayUsePaid = Boolean(paidKey) && (foreground === true || allowPaidBackground === true);
  if (mayUsePaid && ladder.length) {
    const model = ladder.find((m) => ledger.restMs(paidKey, m) <= 0) || ladder[0];
    chosen.push({ key: paidKey, model, paid: true, forced: ledger.restMs(paidKey, model) > 0 });
  }
  if (!chosen.length && foreground === true && free.length && ladder.length) {
    /* every free pair is resting but somebody is waiting: try the last one anyway */
    chosen.push({ key: free[free.length - 1], model: ladder[0], forced: true });
  }
  if (chosen.length) return { attempts: chosen, waitMs: 0 };
  const pool = [...free, ...(allowPaidBackground && paidKey ? [paidKey] : [])];
  if (!pool.length || !ladder.length) return { attempts: [], waitMs: 0 };
  return { attempts: [], waitMs: Math.min(...pool.flatMap((key) => ladder.map((model) => ledger.restMs(key, model)))) };
}

/* ---------- blocked and refused answers ---------- */

/* Gemini says why it gave no text: the prompt or the answer tripped a safety filter. Such a prompt
   would be blocked again on every other key and model, so it is handed on to the next provider. */
const GEMINI_BLOCK_REASONS = /^(SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII|IMAGE_SAFETY|IMAGE_PROHIBITED_CONTENT|OTHER)$/i;
export function geminiBlockReason(payload) {
  const feedback = String(payload?.promptFeedback?.blockReason || "").trim();
  if (feedback) return feedback;
  const finish = String(payload?.candidates?.[0]?.finishReason || "").trim();
  return GEMINI_BLOCK_REASONS.test(finish) ? finish : "";
}

/* Does the request ask for JSON (as every game request does)? Only then is plain prose an answer that
   was not given. */
export function requestExpectsJson(body) {
  const rows = Array.isArray(body?.messages) ? body.messages : [];
  const last = rows.length ? rows[rows.length - 1] : null;
  const lastText = typeof last?.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((p) => p?.text || "").join(" ") : "";
  return /valid JSON|érvényes JSON|JSON only|csak JSON|return json/i.test(String(body?.system || "") + " " + lastText.slice(-4000));
}

/* R80: a single-line comment request ({"reply": "..."} / {"comment": "..."}) answered as plain prose
   ("Language: en\n\n\"Nice try...\"") is wrapped into the one-field JSON the prompt asked for, instead of
   throwing a usable line away. Only for a prompt whose answer schema is that single text field. */
export function salvageSingleFieldJson(body, text) {
  const answer = String(text || "").trim();
  if (!answer || answer.length > 700 || answer.includes("{")) return "";
  const rows = Array.isArray(body?.messages) ? body.messages : [];
  const last = rows.length ? rows[rows.length - 1] : null;
  const lastText = typeof last?.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((p) => p?.text || "").join(" ") : "";
  const tail = lastText.slice(-6000);
  const schema = tail.match(/\{\s*(?:\\?"language\\?"\s*:\s*\\?"[a-z]{2}\\?"\s*,\s*)?\\?"(reply|comment|text)\\?"\s*:\s*\\?"[^"\\{}]{0,80}\\?"\s*(?:,\s*\\?"language\\?"\s*:\s*\\?"[a-z]{2}\\?"\s*)?\}/);
  if (!schema) return "";
  const lang = (answer.match(/^\s*language\s*:\s*([a-z]{2})\b/i) || [])[1] || ((tail.match(/"language"\s*:\s*"([a-z]{2})"/) || [])[1]) || "";
  let line = answer
    .replace(/^\s*language\s*:\s*[a-z]{2}\s*/i, "")
    .replace(/^\s*(?:reply|comment|text|answer)\s*:\s*/i, "")
    .trim();
  line = line.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  if (!line || line.length < 2 || /\n\s*\n/.test(line)) return "";
  const out = { [schema[1]]: line };
  if (lang) out.language = lang.toLowerCase();
  return JSON.stringify(out);
}

const REFUSAL_START = /^["'“”‘’\s]*(?:i['’]?m sorry|i am sorry|sorry[,.! ]|i apologi[sz]e|i['’]?m afraid|i can(?:['’]t|not)|i could(?:n['’]t| not)|i['’]?m (?:unable|not able)|i am (?:unable|not able)|i won['’]?t|i will not|i must (?:decline|refuse)|as an ai|unfortunately,? i|sajn[aá]lom|nem tudok|nem seg[ií]thetek|nem fogok|elnézést,? de)/i;
const REFUSAL_TOPIC = /assist|help|comply|fulfil|continue|generat|writ|provid|creat|content|request|explicit|sexual|policy|guideline|appropriate|seg[ií]t|teljes[ií]t|folytat|tartalom|k[ée]r[ée]s|szab[aá]ly|ir[aá]nyelv|nem megfelel/i;

/* A short piece of prose that starts like an apology/refusal and speaks about the request, in answer to a
   request for JSON. JSON (even fenced) or anything long is an answer, never a refusal. */
export function looksLikeRefusal(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 700) return false;
  if (/^[\[{`]/.test(t) || /\{[\s\S]*"[\s\S]*\}/.test(t)) return false;
  return REFUSAL_START.test(t) && REFUSAL_TOPIC.test(t.slice(0, 400));
}

/* ---------- what the paid providers are sent, and what they cost ---------- */

/* The two 33K-context DM OpenRouter routes keep the same prompt ceiling as Mistral so a huge DM cannot
   overflow them. Nemotron is deliberately absent: its free route has a 1M context and is used as Gemini fallback. */
export const PAID_INPUT_PROVIDERS = Object.freeze(new Set(["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"]));
export const DEFAULT_PAID_MAX_INPUT_CHARS = 60000;   /* roughly 15-20k tokens */

/* PAID_MAX_INPUT_CHARS in the environment; 0 switches the ceiling off. */
export function paidMaxInputChars(env = {}) {
  const raw = env.PAID_MAX_INPUT_CHARS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_PAID_MAX_INPUT_CHARS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_PAID_MAX_INPUT_CHARS;
}

/* A reply the player reads (a DM, a scene turn) gets half again as much room under the paid ceiling: it has to carry
   the conversation and the relationship it answers. Everything else keeps the base ceiling. */
export const PAID_PLAYER_FACING_SOURCES = Object.freeze(["dm", "scene"]);
export function paidCeilingFor(source, base) {
  return base > 0 && PAID_PLAYER_FACING_SOURCES.includes(String(source || "").trim().toLowerCase()) ? Math.floor(base * 1.5) : base;
}

/* How much of each part of a prompt may stay when the whole must fit maxChars: the system part gets up to
   systemShare of it, the latest message the most of the rest. Nothing is cut that already fits. */
export function planCharBudget({ maxChars, systemChars = 0, messageChars = [], systemShare = 0.5 }) {
  const total = systemChars + messageChars.reduce((sum, n) => sum + n, 0);
  if (!(maxChars > 0) || total <= maxChars) return { compact: false, maxChars };
  const systemCap = Math.min(systemChars, Math.floor(maxChars * systemShare));
  const rest = maxChars - systemCap;
  const many = messageChars.length > 1;
  const lastCap = Math.floor(many ? rest * 0.7 : rest);
  const otherCap = many ? Math.floor((rest - lastCap) / (messageChars.length - 1)) : 0;
  return { compact: true, maxChars, systemCap, lastCap, otherCap };
}

/* What each provider and each kind of request used today (tokens as the provider reports them), so the
   heavy consumers can be seen instead of guessed. Resets with the UTC day; yesterday stays visible. */
export function createUsageMeter({ now = Date.now } = {}) {
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const fresh = () => ({ calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0, byProvider: {}, bySource: {}, byProviderSource: {} });
  let day = dayOf(now());
  let bucket = fresh();
  let previous = null;
  const num = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0);
  const roll = () => {
    const today = dayOf(now());
    if (today !== day) { previous = { day, ...bucket }; day = today; bucket = fresh(); }
  };
  const add = (target, row) => {
    target.calls += 1;
    target.promptTokens += row.promptTokens;
    target.completionTokens += row.completionTokens;
    target.cachedTokens += row.cachedTokens;
    target.reasoningTokens += row.reasoningTokens;
    target.cost += row.cost;
  };
  const slot = (map, key) => (map[key] || (map[key] = { calls: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, reasoningTokens: 0, cost: 0 }));

  return {
    record({ provider = "unknown", model = "", source = "unknown", promptTokens, completionTokens, cachedTokens, reasoningTokens, cost } = {}) {
      roll();
      const row = { promptTokens: num(promptTokens), completionTokens: num(completionTokens), cachedTokens: num(cachedTokens), reasoningTokens: num(reasoningTokens), cost: num(cost) };
      const name = String(source || "unknown").slice(0, 60);
      add(bucket, row);
      add(slot(bucket.byProvider, String(provider)), row);
      add(slot(bucket.bySource, name), row);
      add(slot(bucket.byProviderSource, `${provider}/${name}`), row);
      return row;
    },
    snapshot() {
      roll();
      return JSON.parse(JSON.stringify({ day, ...bucket, previous }));
    },
  };
}

/* ---------- a provider that keeps refusing is not asked first ---------- */

/* Every refused (or blocked) answer from a paid provider is a charge for nothing, and the next provider is
   then charged too. When one provider refuses most of what it gets for a kind of request, it moves to the end
   of that chain until its record (the last 20 minutes) improves or ages out; it is never dropped, only asked last.
   Once asked last it is rarely asked at all, so the window is short: after 20 minutes it is simply asked first again. */
export function createRefusalTracker({ now = Date.now, windowMs = 20 * 60 * 1000, minSamples = 4, threshold = 0.6, keep = 50 } = {}) {
  const rows = new Map();
  const keyOf = (provider, source) => `${provider}|${String(source || "").trim().toLowerCase()}`;
  const live = (key) => {
    const cutoff = now() - windowMs;
    const list = (rows.get(key) || []).filter((row) => row.at > cutoff);
    rows.set(key, list);
    return list;
  };
  return {
    record(provider, source, refused) {
      const key = keyOf(provider, source);
      const list = live(key);
      list.push({ at: now(), refused: Boolean(refused) });
      while (list.length > keep) list.shift();
    },
    rate(provider, source) {
      const list = live(keyOf(provider, source));
      return list.length ? list.filter((row) => row.refused).length / list.length : 0;
    },
    demoted(provider, source) {
      const list = live(keyOf(provider, source));
      return list.length >= minSamples && list.filter((row) => row.refused).length / list.length >= threshold;
    },
  };
}

/* The chain with the providers that keep refusing moved to the end; unchanged when all of them do. */
export function orderByRefusals(providers, source, tracker) {
  const list = Array.isArray(providers) ? providers : [];
  if (!tracker) return list.slice();
  const first = list.filter((provider) => !tracker.demoted(provider, source));
  return first.length ? [...first, ...list.filter((provider) => tracker.demoted(provider, source))] : list.slice();
}
