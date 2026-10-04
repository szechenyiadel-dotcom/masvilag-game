import crypto from "node:crypto";
import fetch from "node-fetch";
import { geminiModelConfig } from "./aiPolicy.js";
import {
  BOND_ANALYSIS_VERSION, ProfileSchema, BondArraySchema, EXTRACT_PROMPT, BASELINE_PROMPT,
  validateProfile, validateBonds, sanitizeBonds, buildGroupIndex, reconcileFacts, resolveProfileReferences,
} from "../src/bondAnalysis.js";

export const sheetHash = (value) => crypto.createHash("sha256").update(value).digest("hex");

// A failure is worth retrying later only if it says nothing about the answer itself:
// rate limits, overload, or the connection dropping. An answer that was received
// but did not validate is NOT transient, however it is worded.
const TRANSIENT_STATUSES = [408, 429, 500, 502, 503, 504, 529];
const isTransient = (error) => error?.transient ?? TRANSIENT_STATUSES.includes(error?.status);

async function request(url, options = {}) {
  const { timeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(timeoutMs) > 0 ? Number(timeoutMs) : 600000);
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error("Analysis provider HTTP " + response.status + ": " + String(data.error?.message || data.message || "request failed"));
      error.status = response.status;
      error.payload = data;   /* the quota details (per day / per minute, the limit) come from here */
      error.invalidOutput = data.error?.code === "json_validate_failed" || response.status === 400 && /failed to validate json/i.test(data.error?.message || "");
      throw error;
    }
    return data;
  } catch (error) {
    // No HTTP status: the connection failed, timed out, or the body was not JSON.
    if (error.status === undefined && error.transient === undefined) error.transient = true;
    throw error;
  } finally { clearTimeout(timer); }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

// Sheet analysis is background work: it uses the free Gemini keys first. OpenAI is its one paid last resort (the
// owner chose it for this job): it is asked only after every free candidate has failed, and BOND_ANALYSIS_OPENAI=off
// switches it off. The paid Gemini key stays opt-in (AI_ALLOW_PAID_BACKGROUND=1). Groq is not used here: its free
// tier cannot carry a whole sheet, and its answers failed the verbatim-quote check.
const allowPaid = (env) => String(env.AI_ALLOW_PAID_BACKGROUND || "").trim() === "1";
const openaiFallback = (env) => Boolean(env.OPENAI_API_KEY) && !/^(0|off|false|no)$/i.test(String(env.BOND_ANALYSIS_OPENAI || "").trim());

const FREE_GEMINI_SLOTS = ["GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY_6", "GEMINI_API_KEY_7", "GEMINI_API_KEY_8"];

/* The free Gemini keys that exist, in order, without duplicates. */
function freeGeminiSlots(env) {
  const slots = [];
  const seen = new Set();
  for (const keySlot of FREE_GEMINI_SLOTS) {
    const key = env[keySlot];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    slots.push(keySlot);
  }
  return slots;
}

const rotated = (list, offset) => {
  const start = list.length ? ((Number(offset) || 0) % list.length + list.length) % list.length : 0;
  return [...list.slice(start), ...list.slice(0, start)];
};

/* The free keys are split in two groups so one model's load (and its daily quota) is not carried by every key: the
   first BOND_ANALYSIS_FLASH_KEYS keys (3 of the 7) are the home of the plain Flash models, the others (4 of the 7)
   the home of the light ones. The starting key of each group is rotated so jobs that run side by side do not all
   begin on the same one. The paid key (only on opt-in) is kept apart: it is asked after every free candidate. */
function geminiKeyGroups(env, semanticStartOffset = 0) {
  const free = freeGeminiSlots(env);
  const given = env.BOND_ANALYSIS_FLASH_KEYS;
  const flashCount = Math.min(free.length, Math.max(0, Number.isFinite(Number(given)) && given !== undefined && String(given).trim() !== "" ? Math.floor(Number(given)) : 3));
  return {
    flash: rotated(free.slice(0, flashCount), semanticStartOffset),
    lite: rotated(free.slice(flashCount), semanticStartOffset),
    paid: allowPaid(env) && env.GEMINI_API_KEY && !free.some((slot) => env[slot] === env.GEMINI_API_KEY) ? ["GEMINI_API_KEY"] : [],
  };
}

/* Model by model, each on every key of the group: the best model is tried on all of them before the next one is. A
   model that is overloaded or out of quota is skipped on the other keys by the shared ledger instead of being asked
   again. A (model, key) pair already listed is not listed twice. */
function geminiCandidates(env, groups, seen = new Set()) {
  const candidates = [];
  for (const [models, keySlots] of groups) {
    for (const model of models) {
      for (const keySlot of keySlots) {
        const id = model + "|" + keySlot;
        if (seen.has(id)) continue;
        seen.add(id);
        candidates.push({
          name: "gemini",
          model,
          key: env[keySlot],
          keySlot,
          contextWindow: Number(env.GEMINI_ANALYSIS_CONTEXT_WINDOW),
          outputLimit: Number(env.GEMINI_ANALYSIS_OUTPUT_LIMIT),
        });
      }
    }
  }
  return candidates;
}

/* The plain Flash models of a sheet reading: the owner's choice, gemini-3.5-flash, then the other full ones (when
   GEMINI_EXTRA_MODELS is "off" that is only the owner's choice). */
const BOND_FLASH_EXTRA = "gemini-3.5-flash";
function bondFlashModels(env, config) {
  const chosen = uniqueValues([env.GEMINI_ANALYSIS_MODEL, env.GEMINI_DEEP_MODEL, env.GEMINI_MODEL]);
  if (!chosen.length) return [];
  return uniqueValues([...chosen, ...(config.extra.length ? [BOND_FLASH_EXTRA] : []), ...config.extra]);
}

export function providerCandidates(env, mode = "semantic", semanticStartOffset = 0) {
  const candidates = [];

  if (mode === "schema") {
    /* Normalising an answer is light work: the light models first (on their own keys, then on the others), then the
       plain Flash ones, OpenAI last. */
    const config = geminiModelConfig(env);
    const groups = geminiKeyGroups(env, semanticStartOffset);
    const flash = uniqueValues([...(config.extra.length ? [BOND_FLASH_EXTRA] : []), ...config.extra]);
    candidates.push(...geminiCandidates(env, [[config.lite, groups.lite], [config.lite, groups.flash], [flash, groups.flash], [flash, groups.lite]]));

    if (openaiFallback(env)) {
      candidates.push({
        name: "openai",
        model: env.OPENAI_SCHEMA_MODEL || env.OPENAI_ANALYSIS_MODEL || env.OPENAI_MODEL || env.OPENAI_CHAT_MODEL || "gpt-6-luna",
        key: env.OPENAI_API_KEY,
        keySlot: "OPENAI_API_KEY",
      });
    }
    return candidates;
  }

  /* The models the owner chose, then the other full models (one of them is almost always up when another is
     overloaded: a 503 "high demand" is about a model, not a key), then the light ones. The validators check every
     answer, so a weaker model can only help, never slip a bad reading through. OpenAI comes only after all of them. */
  const config = geminiModelConfig(env);
  const flash = bondFlashModels(env, config);
  const lite = flash.length ? config.lite : [];
  const groups = geminiKeyGroups(env, semanticStartOffset);
  /* The split first (plain Flash on its 3 keys, the light models on their 4), then each group helps the other's
     models, and only then the paid Gemini key (opt-in) and OpenAI. */
  candidates.push(...geminiCandidates(env, [[flash, groups.flash], [lite, groups.lite], [flash, groups.lite], [lite, groups.flash], [flash, groups.paid]]));

  if (openaiFallback(env)) {
    candidates.push({
      name: "openai",
      model: env.OPENAI_ANALYSIS_MODEL || env.OPENAI_MODEL || env.OPENAI_CHAT_MODEL || "gpt-6.1-sol",
      key: env.OPENAI_API_KEY,
      keySlot: "OPENAI_API_KEY",
    });
  }
  return candidates;
}

async function modelCapabilities(candidate, prompt, schema, transport) {
  if (candidate.name === "gemini") {
    const root = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(candidate.model);
    const headers = { "x-goog-api-key": candidate.key, "Content-Type": "application/json" };
    const meta = await transport(root, { headers, timeoutMs: 60000 });
    if (!meta.supportedGenerationMethods?.includes("generateContent")) throw new Error("Configured Gemini model cannot generate content");
    const count = await transport(root + ":countTokens", {
      method: "POST",
      headers,
      timeoutMs: 60000,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt + "\nJSON SCHEMA:\n" + JSON.stringify(schema) }] }] }),
    });
    return {
      contextWindow: meta.inputTokenLimit,
      outputLimit: meta.outputTokenLimit,
      inputTokens: Number(count.totalTokens),
      verifiedLimits: true,
    };
  }

  if (candidate.name === "openai") {
    return {
      contextWindow: null,
      outputLimit: null,
      inputTokens: Buffer.byteLength(prompt + JSON.stringify(schema), "utf8"),
      verifiedLimits: false,
    };
  }

  throw new Error("Unknown analysis provider: " + candidate.name);
}

function assertCapacity(capability, outputTokens) {
  if (!Number.isFinite(capability.inputTokens)) throw new Error("Unverified input size; no truncation performed");
  if (capability.verifiedLimits === false) return;
  if (!Number.isFinite(capability.contextWindow) || !Number.isFinite(capability.outputLimit)) throw new Error("Unverified model capacity; configure analysis limits");
  if (capability.contextWindow < Math.ceil(capability.inputTokens * 1.3) + outputTokens || capability.outputLimit < outputTokens) throw new Error("Full input/output does not fit configured model; no truncation performed");
}

/* A reading of a few thousand characters (the Connections text) must not be allowed to hang for ten minutes on one
   unresponsive model: the next one is tried after four. Long sheets keep the full ten. */
export const generationTimeoutMs = (promptChars) => (Number(promptChars) <= 40000 ? 240000 : 600000);

/* How hard the model thinks: a careful relationship reading thinks as much as it can, a mechanical job (normalising an
   answer, extracting names and quotes from a short text) does not need to, and thinking is where the minutes go. */
const thinkingFor = (mode, thinkingLevel) => (["LOW", "MEDIUM", "HIGH"].includes(String(thinkingLevel).toUpperCase()) ? String(thinkingLevel).toUpperCase() : (mode === "schema" ? "LOW" : "HIGH"));

async function callStructuredCandidate(candidate, completePrompt, schema, outputTokens, transport, mode, thinkingLevel) {
  const timeoutMs = generationTimeoutMs(completePrompt.length);
  const level = thinkingFor(mode, thinkingLevel);
  if (candidate.name === "gemini") {
    const data = await transport("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(candidate.model) + ":generateContent", {
      method: "POST",
      timeoutMs,
      headers: { "Content-Type": "application/json", "x-goog-api-key": candidate.key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: completePrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: outputTokens,
          thinkingConfig: { thinkingLevel: level },
        },
      }),
    });
    if (data.candidates?.[0]?.finishReason !== "STOP") {
      throw new Error("Incomplete Gemini analysis: " + (data.candidates?.[0]?.finishReason || "no candidate"));
    }
    return (data.candidates[0].content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
  }

  if (candidate.name !== "openai") throw new Error("Unknown analysis provider: " + candidate.name);
  // The only paid call of a sheet reading: log what it costs in characters, never the key.
  console.info("[bond-analysis-paid] openai", candidate.model, "mode=" + mode, "promptChars=" + completePrompt.length);

  const body = {
    model: candidate.model,
    messages: [{ role: "user", content: completePrompt }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "sheet_analysis", strict: true, schema },
    },
    max_completion_tokens: outputTokens,
    reasoning_effort: level.toLowerCase(),
  };

  const data = await transport("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    timeoutMs,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + candidate.key },
    body: JSON.stringify(body),
  });

  if (data.choices?.[0]?.finish_reason !== "stop") {
    throw new Error("Incomplete OpenAI analysis: " + (data.choices?.[0]?.finish_reason || "no choice"));
  }
  return data.choices[0].message?.content;
}

/* What a Gemini failure says about the (key, model) pair goes to the shared ledger, and what Google actually said to
   the log, so "ran out", "has no free quota", "overloaded" and "gone" can be told apart. */
function reportGeminiFailure(ledger, candidate, error) {
  if (!ledger || candidate.name !== "gemini" || !(error.status || error.transient === true)) return;
  const outcome = ledger.fail(candidate.key, candidate.model, { status: error.status || 0, message: error.message, payload: error.payload });
  if (outcome && outcome.restMs > 0) {
    console.warn("[bond-analysis-gemini]", candidate.model, candidate.keySlot, "HTTP " + error.status, outcome.level + (outcome.metric ? "/" + outcome.metric : ""),
      outcome.limit !== undefined ? "limit=" + (outcome.level === "model-no-free-quota" || outcome.limit > 0 ? outcome.limit : "?") : "", outcome.quotaId || "", "rest=" + Math.round(outcome.restMs / 60000) + "min");
  }
}

/* A normalising pass that still fails with the same kind of answer on two different models will not be fixed by a
   third: it stops after two answers that did not validate, and after eight attempts at most. */
const REPAIR_MAX_ATTEMPTS = 8;
const REPAIR_MAX_UNFIXED = 2;

async function repairStructuredOutput(raw, originalPrompt, schema, validate, options, transport, validationError, failures, paidRepairs = { left: 1 }) {
  const env = options.env || process.env;
  const candidates = options.schemaCandidates || (options.candidates ? [] : providerCandidates(env, "schema"));
  if (!candidates.length || !String(raw || "").trim()) return null;

  const repairPrompt = [
    "STRICT JSON-SCHEMA NORMALIZATION ONLY.",
    "The semantic analysis below was produced by the character-sheet model. Preserve its factual interpretation, relationship meaning, prose, names and evidence. Do NOT add new story facts, feelings, events, relationships or motives.",
    "Fix only JSON/schema/type/enum/required-field problems and the stated validation error. If an exact source quote is required, copy it only from SOURCE PROMPT; never invent a quote.",
    "VALIDATION ERROR:",
    String(validationError || "invalid structured output"),
    "ORIGINAL MODEL OUTPUT:",
    String(raw),
    "SOURCE PROMPT — reference only, do not reinterpret:",
    originalPrompt,
    "Return ONLY the complete corrected schema JSON.",
  ].join("\n\n");

  const ledger = options.ledger || null;
  let attempts = 0, unfixed = 0;
  for (const candidate of candidates) {
    if (attempts >= REPAIR_MAX_ATTEMPTS || unfixed >= REPAIR_MAX_UNFIXED) break;
    if (ledger && candidate.name === "gemini" && ledger.restMs(candidate.key, candidate.model) > 0) continue;
    /* The paid repair is asked once per analysis, not once per semantic candidate: a reading that no repair can fix
       must not run up a paid call for every model and key it passes through. */
    if (candidate.name === "openai") {
      if (paidRepairs.left <= 0) {
        failures.push({ phase: "schema-repair", provider: candidate.name, model: candidate.model, keySlot: candidate.keySlot, status: null, transient: false, reason: "paid repair already tried once for this reading" });
        continue;
      }
      paidRepairs.left -= 1;
    }
    attempts += 1;
    try {
      const capability = await modelCapabilities(candidate, repairPrompt, schema, transport);
      const outputTokens = options.outputTokens || 64000;
      assertCapacity(capability, outputTokens);
      const repairedRaw = await callStructuredCandidate(candidate, repairPrompt, schema, outputTokens, transport, "schema");
      if (ledger && candidate.name === "gemini") ledger.succeed(candidate.key, candidate.model);
      const result = JSON.parse(repairedRaw);
      try { validate(result); } catch (invalid) { unfixed += 1; throw invalid; }
      return {
        result,
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        inputTokens: capability.inputTokens,
      };
    } catch (error) {
      reportGeminiFailure(ledger, candidate, error);
      console.warn("[bond-analysis-repair-failed]", candidate.name + "/" + candidate.model, "[" + candidate.keySlot + "]", String(error.message).slice(0, 300));
      failures.push({
        phase: "schema-repair",
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        status: error.status || null,
        transient: isTransient(error),
        reason: error.message,
      });
    }
  }

  return null;
}

export async function analyzeStructured(prompt, schema, validate, options = {}) {
  const transport = options.transport || request;
  const env = options.env || process.env;
  const mode = options.mode === "schema" ? "schema" : "semantic";
  const candidates = options.candidates || providerCandidates(env, mode, options.semanticStartOffset || 0);
  const failures = [];
  const clock = options.clock || Date.now;
  if (!candidates.length) {
    const error = new Error("No analysis provider is configured: set GEMINI_API_KEY_2..8 with a GEMINI_ANALYSIS_MODEL (or GEMINI_DEEP_MODEL / GEMINI_MODEL), or OPENAI_API_KEY. The paid GEMINI_API_KEY is used only with AI_ALLOW_PAID_BACKGROUND=1.");
    error.failures = [];
    throw error;
  }

  /* The server's shared view of which Gemini (key, model) pairs are resting: the chat, picture and memory
     code report what they learn, and this job does not knock on a spent door again (or make others do so). */
  const ledger = options.ledger || null;
  const paidRepairs = { left: Number.isFinite(Number(options.maxPaidRepairs)) ? Number(options.maxPaidRepairs) : 1 };
  const geminiLedgerOf = (candidate) => (ledger && candidate.name === "gemini" ? ledger : null);

  for (const candidate of candidates) {
    if (options.deadline && clock() > options.deadline) {
      failures.push({ phase: mode, provider: candidate.name, model: candidate.model, keySlot: candidate.keySlot, status: null, transient: false, reason: "analysis deadline exceeded" });
      break;
    }
    const resting = geminiLedgerOf(candidate) ? geminiLedgerOf(candidate).restMs(candidate.key, candidate.model) : 0;
    if (resting > 0) {
      failures.push({ phase: mode, provider: candidate.name, model: candidate.model, keySlot: candidate.keySlot, status: 429, transient: true, reason: "resting after its quota ran out (" + Math.ceil(resting / 60000) + " min left)" });
      continue;
    }
    let raw = "";
    try {
      const capability = await modelCapabilities(candidate, prompt, schema, transport);
      const outputTokens = options.outputTokens || 64000;
      assertCapacity(capability, outputTokens);
      raw = await callStructuredCandidate(candidate, prompt, schema, outputTokens, transport, mode, options.thinkingLevel);
      geminiLedgerOf(candidate)?.succeed(candidate.key, candidate.model);

      try {
        const result = JSON.parse(raw);
        validate(result);
        return {
          result,
          provider: candidate.name,
          model: candidate.model,
          keySlot: candidate.keySlot,
          inputTokens: capability.inputTokens,
        };
      } catch (validationError) {
        /* Without this a reading that keeps failing validation is invisible until the whole round ends. */
        console.warn("[bond-analysis-invalid]", candidate.name + "/" + candidate.model, "[" + candidate.keySlot + "]", String(validationError.message).slice(0, 300));
        if (mode === "semantic") {
          const repaired = await repairStructuredOutput(
            raw,
            prompt,
            schema,
            validate,
            options,
            transport,
            validationError.message,
            failures,
            paidRepairs
          );
          if (repaired) {
            return {
              result: repaired.result,
              provider: candidate.name,
              model: candidate.model,
              keySlot: candidate.keySlot,
              inputTokens: capability.inputTokens,
              formatterProvider: repaired.provider,
              formatterModel: repaired.model,
              formatterKeySlot: repaired.keySlot,
            };
          }
        }
        throw validationError;
      }
    } catch (error) {
      /* Only what says something about the provider (an HTTP error, a dropped connection) is reported; an
         answer that arrived but did not validate says nothing about the key or the model. */
      reportGeminiFailure(ledger, candidate, error);
      failures.push({
        phase: mode,
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        status: error.status || null,
        transient: isTransient(error),
        reason: error.message,
      });
    }
  }

  const error = new Error(
    "No analysis provider completed the full validated request. " +
    failures.map((failure) =>
      (failure.phase ? failure.phase + ":" : "") +
      failure.provider + "/" + failure.model +
      (failure.keySlot ? "[" + failure.keySlot + "]" : "") +
      ": " + failure.reason
    ).join("; ")
  );
  error.failures = failures;
  throw error;
}

const RETRY_COOLDOWN_MS = 60000;
const FAILURE_COOLDOWN_MS = 300000;
const MAX_RETRY_ROUNDS = 4;
const languageName = (language) => (language === "en" ? "English" : "Hungarian");
const text = (value, max) => String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);

// { id: { name, aliases } } from the browser, trimmed to what is safe to use. Only known cast ids count.
function cleanIdentities(raw, castIds) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of castIds) {
    const row = raw[id];
    if (!row || typeof row !== "object") continue;
    const name = text(row.name, 120);
    const aliases = [...new Set((Array.isArray(row.aliases) ? row.aliases : []).map((alias) => text(alias, 80)).filter((alias) => alias && alias !== name))].slice(0, 6);
    if (name || aliases.length) out[id] = { name, aliases };
  }
  return out;
}
const cacheKeyFor = (parts) => "bond-v" + BOND_ANALYSIS_VERSION + ":" + sheetHash(parts.join("\n"));

/* A pair that nothing connects needs no model: the owner's Connections text does not name the other person, no group
   fact joins them and no mention or fact was resolved to them. What the model would write for it is "no personal
   relationship", so it is written by rule: instantly, free, and the same every time. Whenever a name is too short to be
   sure of (under 3 characters, e.g. a nickname like "Jo"), the pair is left to the model. */
const foldText = (value) => String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mightBeNamed(foldedSheet, card) {
  const names = uniqueValues(card.names.flatMap((name) => [String(name), ...String(name).split(/\s+/)]).map((name) => foldText(name).trim()).filter(Boolean));
  if (!names.length || names.some((name) => name.length < 3)) return true;
  return names.some((name) => new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRegExp(name) + "($|[^\\p{L}\\p{N}])", "u").test(foldedSheet));
}
const STRANGER_TEXT = {
  Hungarian: {
    type: "semleges",
    summary: (owner, target) => owner + " és " + target + " nem állnak személyes kapcsolatban.",
    description: (owner, target) => owner + " Connections mezője nem említi " + target + " nevét, és közös csoportjuk sem ismert. Ezért nincs igazolt kapcsolat köztük.",
    publicFace: () => "Nincs ismert kapcsolatuk.",
  },
  English: {
    type: "neutral",
    summary: (owner, target) => owner + " and " + target + " have no personal relationship.",
    description: (owner, target) => owner + "'s Connections does not mention " + target + ", and no shared group is known. So there is no established bond between them.",
    publicFace: () => "No known relationship.",
  },
};
export function strangerBond(owner, target, ownerName, targetName, language) {
  const text = STRANGER_TEXT[language] || STRANGER_TEXT.Hungarian;
  return {
    from: owner, to: target, type: text.type, status: "semleges",
    levels: { sentiment: 0, trust: 0, attraction: 0, tension: 0 }, intensity: 0, confidence: 1,
    summary: text.summary(ownerName, targetName), description: text.description(ownerName, targetName), publicFace: text.publicFace(),
    hiddenFeelings: null, history: null, dynamics: null, wants: null, whoKnows: [],
    source: "logikai következtetés", evidence: [], fieldEvidence: [], factEvidence: [], layers: [],
  };
}

/* A reading is carried by the server, not by the open app: the browser only starts it and asks how it is going.
   A phone that went to sleep, or a restart of the server, must not leave a half-done reading waiting for the next poll.
   Every `resumeEveryMs` the server picks up the readings that are still pending (and were touched recently), whose
   retry time has come and that nobody is running, and runs them again. `resumeEveryMs: 0` switches that off. */
const RESUME_WINDOW_SECONDS = 30 * 60;

export function registerBondAnalysis(app, { pool, requireDb, getSessionIdentity, stringifyJsonbSafe, analyze = analyzeStructured, env = process.env, clock = Date.now, ledger = null, resumeEveryMs = 0 }) {
  // One scheduler for every job. The browser may submit all sheets at once; the
  // server decides how many heavy model calls really run together.
  const concurrency = Math.max(1, Number(env.BOND_ANALYSIS_CONCURRENCY) || 8);
  const deadlineMs = Math.max(60000, Number(env.BOND_ANALYSIS_DEADLINE_MS) || 1200000);
  const active = new Set();
  const waiting = [];
  let running = 0;
  let rotation = 0;

  const schedule = (task) => new Promise((resolve, reject) => {
    const start = () => {
      running += 1;
      task().then(resolve, reject).finally(() => {
        running -= 1;
        const next = waiting.shift();
        if (next) next();
      });
    };
    if (running < concurrency) start(); else waiting.push(start);
  });

  const readRows = async (keys) => {
    if (!keys.length) return new Map();
    const rows = await pool.query("SELECT cache_key, data FROM relationship_reading_cache WHERE cache_key = ANY($1::text[])", [keys]);
    return new Map(rows.rows.map((row) => [row.cache_key, row.data]));
  };
  const readRow = async (key) => (await readRows([key])).get(key) || null;
  const saveRow = (key, data) => pool.query(
    "INSERT INTO relationship_reading_cache (cache_key,data,updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT (cache_key) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()",
    [key, stringifyJsonbSafe(data, "bond-analysis")],
  );

  // Turns a request into: the validated pieces, the cache keys, and (for a baseline)
  // which targets are already known. Nothing here calls a model.
  async function prepare(session, body) {
    const { stage, owner, roster, ownSheet, profileKeys, language, force, fieldNames = [] } = body || {};
    if (!["profile", "baseline"].includes(stage) || typeof owner !== "string" || typeof ownSheet !== "string" || !Array.isArray(roster)) throw Object.assign(new Error("Invalid analysis request"), { status: 400 });
    const ids = new Set([owner, ...roster.map((entry) => entry.id)]);
    if (ids.size !== roster.length + 1) throw Object.assign(new Error("Duplicate roster IDs"), { status: 400 });
    const world = session.worldCode;
    const hash = sheetHash(ownSheet);
    const outputLanguage = languageName(language);
    const metadata = { stage, world, hash, version: BOND_ANALYSIS_VERSION, sourceChars: ownSheet.length, submittedChars: ownSheet.length };

    if (stage === "profile") {
      const prompt = EXTRACT_PROMPT + "\n" + JSON.stringify({ owner, ownSheet, fieldNames, outputLanguage });
      return {
        stage, metadata, body, owner, hash, schema: ProfileSchema, prompt,
        jobKey: cacheKeyFor([world, stage, prompt, String(force || "")]),
        validate: (value) => validateProfile(value, ownSheet, owner, ids, fieldNames),
      };
    }

    // The request names only this owner and one slice of targets, but group
    // facts are derived from EVERY profile, so every profile key must be present.
    if (!Array.isArray(profileKeys) || profileKeys.length < ids.size) throw Object.assign(new Error("All profiles are required before group inference"), { status: 400 });
    const stored = await readRows(profileKeys);
    const profiles = profileKeys.map((key) => stored.get(key)).filter((row) => row?.result && row.version === BOND_ANALYSIS_VERSION && row.world === world && row.stage === "profile");
    if (profiles.length !== profileKeys.length || new Set(profiles.map((row) => row.result.id)).size !== profiles.length || [...ids].some((id) => !profiles.some((row) => row.result.id === id))) throw Object.assign(new Error("Missing or mismatched cached profiles"), { notReady: true });
    const own = profiles.find((row) => row.result.id === owner);
    if (!own || own.hash !== hash) throw new Error("Owner sheet changed since profile analysis");
    const castIds = profiles.map((row) => row.result.id);
    const identities = cleanIdentities(body.identities, castIds);
    const allProfiles = resolveProfileReferences(profiles.map((row) => row.result), Object.fromEntries(Object.entries(identities).map(([id, row]) => [id, [row.name, ...row.aliases]])));
    const ownProfile = allProfiles.find((profile) => profile.id === owner);
    const groupIndex = buildGroupIndex(allProfiles);
    const cards = roster.map((target) => {
      const profile = allProfiles.find((candidate) => candidate.id === target.id);
      /* The full name first, then every other name the person is known by: the model matches Connections text to this. */
      const known = identities[target.id];
      return { id: target.id, fullName: known?.name || profile.names[0] || "", names: [...new Set([known?.name, ...(known?.aliases || []), ...profile.names].filter(Boolean))], groups: profile.groups, oneLine: target.oneLine || "" };
    });
    const facts = Object.fromEntries(cards.map((card) => [card.id, reconcileFacts(owner, card.id, allProfiles, groupIndex)]));

    // A bond depends only on the owner's sheet, the target's card and the objective
    // facts for this pair. The key therefore holds the owner's profile as extracted
    // (it does not change when someone joins) plus only those resolved references that
    // concern THIS target, so a new character never forces the bonds between everyone
    // else to be read again.
    const pairKeys = cards.map((card) => cacheKeyFor([world, "pair", owner, hash, JSON.stringify(own.result), JSON.stringify({
      mentions: ownProfile.mentions.filter((row) => row.targetId === card.id),
      facts: ownProfile.facts.filter((row) => row.targetId === card.id),
    }), JSON.stringify(card), JSON.stringify(facts[card.id]), outputLanguage, BASELINE_PROMPT, String(force || "")]));
    const known = await readRows(pairKeys);
    const bonds = new Map();
    cards.forEach((card, index) => {
      const row = known.get(pairKeys[index]);
      if (!row?.bond || row.version !== BOND_ANALYSIS_VERSION || row.world !== world) return;
      try {
        validateBonds({ bonds: [row.bond] }, owner, [card], ownSheet, { [card.id]: facts[card.id] }, castIds);
        bonds.set(card.id, row.bond);
      } catch { /* stale or corrupt entry: read this pair again */ }
    });
    // Pairs nothing connects are written by rule (and stored like any other pair), so only real relationships reach a model.
    const foldedSheet = foldText(ownSheet);
    const ownerName = identities[owner]?.name || ownProfile.names[0] || owner;
    const written = [];
    cards.forEach((card, index) => {
      if (bonds.has(card.id)) return;
      const connected = (facts[card.id] || []).length > 0
        || ownProfile.mentions.some((row) => row.targetId === card.id)
        || ownProfile.facts.some((row) => row.targetId === card.id)
        || mightBeNamed(foldedSheet, card);
      if (connected) return;
      const bond = strangerBond(owner, card.id, ownerName, card.fullName || card.names[0] || card.id, outputLanguage);
      bonds.set(card.id, bond);
      written.push(saveRow(pairKeys[index], { stage: "pair", world, version: BOND_ANALYSIS_VERSION, owner, hash, bond, provider: "rule", model: "no-mention", keySlot: null }));
    });
    await Promise.all(written);
    const missing = cards.filter((card) => !bonds.has(card.id));
    const prompt = BASELINE_PROMPT + "\n" + JSON.stringify({ owner, ownSheet, profile: ownProfile, roster: missing, objectiveFacts: Object.fromEntries(missing.map((card) => [card.id, facts[card.id]])), outputLanguage });
    return {
      stage, metadata, body, owner, hash, schema: BondArraySchema, prompt, cards, pairKeys, bonds, missing,
      jobKey: cacheKeyFor([world, stage, prompt, String(force || "")]),
      validate: (value) => {
        const factsByTarget = Object.fromEntries(missing.map((card) => [card.id, facts[card.id]]));
        sanitizeBonds(value, { ownSheet, factsByTarget, cast: new Set([...castIds, owner]) });
        return validateBonds(value, owner, missing, ownSheet, factsByTarget, castIds);
      },
    };
  }

  // A finished baseline job is completed from the per-pair rows it stored.
  async function assembleBaseline(job, jobKey) {
    const rows = await readRows(job.pairKeys);
    const bonds = job.pairKeys.map((key) => rows.get(key)?.bond);
    if (bonds.some((bond) => !bond)) return null;
    return { ...job, request: undefined, result: { bonds }, jobKey, cacheKey: jobKey, pending: false };
  }

  /* Bonds that a reading the server started ahead of the browser has already written, so the browser's own (cached)
     request can still tell how much work this run really was. Informational only; each pair is reported once. */
  const aheadComputed = new Map();
  function launch(prepared, previous, ahead = false) {
    const { jobKey, stage, owner, hash, prompt, schema, validate, metadata, body } = prepared;
    active.add(jobKey);
    const attempts = previous?.terminal ? 0 : Number(previous?.attempts || 0);
    const work = async () => {
      try {
        console.info("[bond-analysis-input]", JSON.stringify({ stage, owner, sheetHash: hash, sourceChars: metadata.sourceChars, promptChars: prompt.length, targets: prepared.missing?.length }));
        const startedAt = clock();
        // Reading the names and quotes out of a short Connections text is mechanical: it does not need the long thinking
        // that the relationship reading itself gets (72-118 s became tens of seconds).
        const analyzed = await analyze(prompt, schema, validate, { outputTokens: 64000, semanticStartOffset: rotation++, deadline: clock() + deadlineMs, clock, ledger, thinkingLevel: stage === "profile" ? "LOW" : "HIGH" });
        console.info("[bond-analysis-done]", stage, owner, analyzed.provider + "/" + analyzed.model, "[" + analyzed.keySlot + "]", analyzed.formatterModel ? "formatted by " + analyzed.formatterModel : "", "ms=" + (clock() - startedAt));
        if (stage === "baseline") {
          // Noted before the pairs become visible, so a request that finds them cached never misses the count.
          if (ahead) {
            const now = clock();
            for (const [key, at] of aheadComputed) if (now - at > 3600000) aheadComputed.delete(key);
            for (const bond of analyzed.result.bonds) aheadComputed.set(prepared.pairKeys[prepared.cards.findIndex((card) => card.id === bond.to)], now);
          }
          await Promise.all(analyzed.result.bonds.map((bond) => {
            const index = prepared.cards.findIndex((card) => card.id === bond.to);
            return saveRow(prepared.pairKeys[index], { stage: "pair", world: metadata.world, version: BOND_ANALYSIS_VERSION, owner, hash, bond, provider: analyzed.provider, model: analyzed.model, keySlot: analyzed.keySlot });
          }));
          await saveRow(jobKey, { ...metadata, ...analyzed, pairKeys: prepared.pairKeys, computed: analyzed.result.bonds.length });

        } else {
          await saveRow(jobKey, { ...metadata, ...analyzed });
          // A reading that was registered ahead of this profile can start right now.
          setImmediate(() => resumePending({ deferredOnly: true }).catch(() => {}));
        }
      } catch (error) {
        // Retry later only when the providers were unavailable (rate limit, overload,
        // connection). If models answered and the answers did not validate, repeating the
        // same sweep would only repeat the same cost: wait out the cooldown instead.
        const asked = (error.failures || []).filter((failure) => failure.phase !== "schema-repair");
        const unavailable = (failure) => failure.transient ?? TRANSIENT_STATUSES.includes(failure.status);
        const retryable = error.failures ? asked.length > 0 && asked.filter(unavailable).length * 2 > asked.length : true;
        const rounds = attempts + 1;
        const terminal = !retryable || rounds >= MAX_RETRY_ROUNDS;
        console.warn("[bond-analysis-failed]", stage, owner, "round " + rounds, terminal ? "(giving up for now)" : "(will retry)", error.message);
        await saveRow(jobKey, { ...metadata, request: body, pending: !terminal, terminal, attempts: rounds, error: error.message, retryAt: clock() + (terminal ? FAILURE_COOLDOWN_MS : RETRY_COOLDOWN_MS) });
      } finally {
        active.delete(jobKey);
      }
    };
    return saveRow(jobKey, { ...metadata, request: body, pending: true, attempts }).then(
      () => { schedule(work).catch((error) => console.warn("[bond-analysis-schedule]", error.message)); },
      (error) => { active.delete(jobKey); throw error; },
    );
  }

  /* Sweeps: pick up readings that nobody is running. A deferred baseline is a reading the browser registered before
     its profiles were ready (see the POST handler): it waits in the table and starts the moment they are. */
  let resuming = false;
  let again = null;
  async function sweepPending(deferredOnly) {
    const rows = await pool.query(
      "SELECT cache_key, data FROM relationship_reading_cache WHERE data->>'pending' = 'true' AND updated_at > NOW() - make_interval(secs => $1)",
      [RESUME_WINDOW_SECONDS],
    );
    let started = 0;
    for (const row of rows.rows) {
      const job = row.data;
      if (!job?.request || active.has(row.cache_key) || clock() < Number(job.retryAt || 0)) continue;
      if (deferredOnly && !job.deferred) continue;
      try {
        let prepared;
        try { prepared = await prepare({ worldCode: job.world }, job.request); } catch (error) {
          if (!job.deferred) throw error;
          // Still waiting for its profiles: leave it. Any other problem is final for this registration.
          if (!error.notReady) await saveRow(row.cache_key, { ...job, pending: false, error: error.message });
          continue;
        }
        if (job.deferred) {
          // Its profiles are ready: it becomes an ordinary reading under its own key.
          if (!(prepared.stage === "baseline" && !prepared.missing.length) && !active.has(prepared.jobKey)) {
            const previous = await readRow(prepared.jobKey);
            const cooling = (previous?.pending || previous?.terminal) && clock() < Number(previous.retryAt || 0);
            if (!cooling && !active.has(prepared.jobKey)) { await launch(prepared, previous, true); started += 1; }
          }
          await saveRow(row.cache_key, { ...job, pending: false, resolvedTo: prepared.jobKey });
          continue;
        }
        if (prepared.jobKey !== row.cache_key || (prepared.stage === "baseline" && !prepared.missing.length)) continue;
        await launch(prepared, job);
        started += 1;
      } catch (error) {
        console.warn("[bond-analysis-resume]", error.message);
      }
    }
    return started;
  }
  async function resumePending({ deferredOnly = false } = {}) {
    if (resuming) { again = { deferredOnly: (again ? again.deferredOnly : true) && deferredOnly }; return 0; }
    resuming = true;
    let started = 0;
    try {
      let round = { deferredOnly };
      do {
        again = null;
        try { started += await sweepPending(round.deferredOnly); } catch (error) { console.warn("[bond-analysis-resume]", error.message); }
        round = again;
      } while (round);
    } finally { resuming = false; }
    if (started) console.info("[bond-analysis-resume] picked up", started, "pending reading(s) without the app");
    return started;
  }
  if (resumeEveryMs > 0) {
    const first = setTimeout(resumePending, 5000);
    const timer = setInterval(resumePending, resumeEveryMs);
    first.unref?.(); timer.unref?.();
  }

  app.post("/ai/bond-analysis", async (req, res) => {
    try {
      if (!(await requireDb(res))) return;
      const session = await getSessionIdentity(req);
      if (!session) return res.status(401).json({ error: "Not authenticated." });
      let body = req.body || {};
      let deferredPoll = null;
      let deferring = false;

      // Polling sends only the job key, never the sheet again.
      if (typeof body.poll === "string") {
        const job = await readRow(body.poll);
        if (!job || job.world !== session.worldCode) return res.status(404).json({ error: "Unknown analysis job" });
        if (job.result) {
          const done = job.stage === "baseline" ? await assembleBaseline(job, body.poll) : { ...job, jobKey: body.poll, cacheKey: body.poll, pending: false };
          return done ? res.json(done) : res.status(404).json({ error: "Unknown analysis job" });
        }
        if (!job.request) return res.status(404).json({ error: "Unknown analysis job" });
        if (job.deferred) deferredPoll = body.poll;
        body = job.request;
      } else if (body.defer === true && body.stage === "baseline") {
        // The browser registers a baseline reading before its profiles are ready, so the server can carry on by
        // itself when the phone goes to sleep between the two stages.
        const { defer, ...request } = body;
        body = request;
        deferring = true;
      }

      let prepared;
      try {
        prepared = await prepare(session, body);
      } catch (error) {
        if (error.notReady && (deferredPoll || deferring)) {
          const key = deferredPoll || cacheKeyFor([session.worldCode, "deferred", body.owner, sheetHash(String(body.ownSheet)), JSON.stringify(body.profileKeys), JSON.stringify((body.roster || []).map((entry) => entry.id)), String(body.force || "")]);
          if (!deferredPoll) {
            const existing = await readRow(key);
            if (!existing?.pending) await saveRow(key, { stage: "baseline", world: session.worldCode, version: BOND_ANALYSIS_VERSION, hash: sheetHash(String(body.ownSheet)), deferred: true, request: body, pending: true, attempts: 0 });
          }
          return res.status(202).json({ stage: "baseline", world: session.worldCode, version: BOND_ANALYSIS_VERSION, jobKey: key, cacheKey: key, pending: true, deferred: true, missing: (body.roster || []).length, cached: false, error: null, retryAt: null });
        }
        throw error;
      }
      const { jobKey, stage, metadata } = prepared;

      if (stage === "baseline" && !prepared.missing.length) {
        // The job that wrote these pairs is still finishing (its own row is saved last): say so, the next poll has all of it.
        if (active.has(jobKey)) return res.status(202).json({ ...metadata, jobKey, cacheKey: jobKey, pending: true, missing: 0, cached: false, error: null, retryAt: null });
        // jobComputed: how many of these bonds the server read ahead of this request (reported once).
        const jobComputed = prepared.pairKeys.filter((key) => aheadComputed.delete(key)).length;
        return res.json({ ...metadata, result: { bonds: prepared.cards.map((card) => prepared.bonds.get(card.id)) }, computed: 0, jobComputed, jobKey, cacheKey: jobKey, pending: false, cached: true });
      }

      const previous = await readRow(jobKey);
      if (stage === "profile" && previous?.result) {
        try {
          prepared.validate(previous.result);
          return res.json({ ...previous, jobKey, cacheKey: jobKey, pending: false, cached: true });
        } catch { /* cached under older rules: read it again */ }
      }

      const waitingOn = { ...metadata, jobKey, cacheKey: jobKey, pending: true, missing: stage === "baseline" ? prepared.missing.length : 1, cached: false };
      if (!active.has(jobKey)) {
        const cooling = (previous?.pending || previous?.terminal) && clock() < Number(previous.retryAt || 0);
        if (cooling && previous.terminal) return res.status(422).json({ error: previous.error });
        if (!cooling) await launch(prepared, previous, deferring);
      }
      res.status(202).json({ ...waitingOn, error: previous?.error || null, retryAt: previous?.retryAt || null });
    } catch (error) {
      res.status(error.status || 503).json({ error: error.message });
    }
  });
  return { resumePending };
}
