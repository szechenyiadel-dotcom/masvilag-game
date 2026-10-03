import crypto from "node:crypto";
import fetch from "node-fetch";
import {
  BOND_ANALYSIS_VERSION, ProfileSchema, BondArraySchema, EXTRACT_PROMPT, BASELINE_PROMPT,
  validateProfile, validateBonds, buildGroupIndex, reconcileFacts, resolveProfileReferences,
} from "../src/bondAnalysis.js";

export const sheetHash = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error("Analysis provider HTTP " + response.status + ": " + String(data.error?.message || data.message || "request failed"));
      error.status = response.status;
      error.invalidOutput = data.error?.code === "json_validate_failed" || response.status === 400 && /failed to validate json/i.test(data.error?.message || "");
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function providerCandidates(env, mode = "semantic", semanticStartOffset = 0) {
  const candidates = [];

  if (mode === "schema") {
    const models = uniqueValues([env.GROQ_ANALYSIS_MODEL, env.GROQ_MODEL]);
    const keySlots = ["GROQ_API_KEY", "GROQ_API_KEY_2"];
    const seenKeys = new Set();

    for (const keySlot of keySlots) {
      const key = env[keySlot];
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      for (const model of models) {
        candidates.push({
          name: "groq",
          model,
          key,
          keySlot,
          contextWindow: Number(env.GROQ_ANALYSIS_CONTEXT_WINDOW),
          outputLimit: Number(env.GROQ_ANALYSIS_OUTPUT_LIMIT),
        });
      }
    }

    if (env.OPENAI_API_KEY) {
      candidates.push({
        name: "openai",
        model: env.OPENAI_SCHEMA_MODEL || env.OPENAI_ANALYSIS_MODEL || env.OPENAI_MODEL || env.OPENAI_CHAT_MODEL || "gpt-6-luna",
        key: env.OPENAI_API_KEY,
        keySlot: "OPENAI_API_KEY",
      });
    }
    return candidates;
  }

  const models = uniqueValues([env.GEMINI_ANALYSIS_MODEL, env.GEMINI_DEEP_MODEL, env.GEMINI_MODEL]);
  const freeSlots = [
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4",
    "GEMINI_API_KEY_5",
    "GEMINI_API_KEY_6",
    "GEMINI_API_KEY_7",
    "GEMINI_API_KEY_8",
  ];
  const configuredFreeSlots = [];
  const configuredFreeKeys = new Set();

  for (const keySlot of freeSlots) {
    const key = env[keySlot];
    if (!key || configuredFreeKeys.has(key)) continue;
    configuredFreeKeys.add(key);
    configuredFreeSlots.push(keySlot);
  }

  const offset = configuredFreeSlots.length
    ? ((Number(semanticStartOffset) || 0) % configuredFreeSlots.length + configuredFreeSlots.length) % configuredFreeSlots.length
    : 0;
  const rotatedFreeSlots = configuredFreeSlots.length
    ? [...configuredFreeSlots.slice(offset), ...configuredFreeSlots.slice(0, offset)]
    : [];
  const keySlots = [...rotatedFreeSlots, "GEMINI_API_KEY"];
  const seenKeys = new Set();

  for (const keySlot of keySlots) {
    const key = env[keySlot];
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    for (const model of models) {
      candidates.push({
        name: "gemini",
        model,
        key,
        keySlot,
        contextWindow: Number(env.GEMINI_ANALYSIS_CONTEXT_WINDOW),
        outputLimit: Number(env.GEMINI_ANALYSIS_OUTPUT_LIMIT),
      });
    }
  }

  if (env.OPENAI_API_KEY) {
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
    const meta = await transport(root, { headers });
    if (!meta.supportedGenerationMethods?.includes("generateContent")) throw new Error("Configured Gemini model cannot generate content");
    const count = await transport(root + ":countTokens", {
      method: "POST",
      headers,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt + "\nJSON SCHEMA:\n" + JSON.stringify(schema) }] }] }),
    });
    return {
      contextWindow: meta.inputTokenLimit,
      outputLimit: meta.outputTokenLimit,
      inputTokens: Number(count.totalTokens),
      verifiedLimits: true,
    };
  }

  if (candidate.name === "groq") {
    const listing = await transport("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: "Bearer " + candidate.key },
    });
    const meta = listing.data?.find((model) => model.id === candidate.model);
    if (!meta) throw new Error("Configured Groq model is not available for this key");
    if (meta.active === false) throw new Error("Configured Groq model is inactive");
    return {
      contextWindow: Number(meta.context_window || candidate.contextWindow),
      outputLimit: Number(meta.max_completion_tokens || candidate.outputLimit),
      inputTokens: Buffer.byteLength(prompt + JSON.stringify(schema), "utf8"),
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

async function callStructuredCandidate(candidate, completePrompt, schema, outputTokens, transport, mode) {
  if (candidate.name === "gemini") {
    const data = await transport("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(candidate.model) + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": candidate.key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: completePrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: outputTokens,
          thinkingConfig: { thinkingLevel: "HIGH" },
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

  const endpoint = candidate.name === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const body = {
    model: candidate.model,
    messages: [{ role: "user", content: completePrompt }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "sheet_analysis", strict: true, schema },
    },
    max_completion_tokens: outputTokens,
    reasoning_effort: mode === "schema" ? "low" : "high",
  };

  const data = await transport(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + candidate.key },
    body: JSON.stringify(body),
  });

  if (data.choices?.[0]?.finish_reason !== "stop") {
    throw new Error(
      "Incomplete " + (candidate.name === "groq" ? "Groq" : "OpenAI") +
      " analysis: " + (data.choices?.[0]?.finish_reason || "no choice")
    );
  }
  return data.choices[0].message?.content;
}

async function repairStructuredOutput(raw, originalPrompt, schema, validate, options, transport, validationError, failures) {
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

  for (const candidate of candidates) {
    try {
      const capability = await modelCapabilities(candidate, repairPrompt, schema, transport);
      const outputTokens = options.outputTokens || 64000;
      assertCapacity(capability, outputTokens);
      const repairedRaw = await callStructuredCandidate(candidate, repairPrompt, schema, outputTokens, transport, "schema");
      const result = JSON.parse(repairedRaw);
      validate(result);
      return {
        result,
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        inputTokens: capability.inputTokens,
      };
    } catch (error) {
      failures.push({
        phase: "schema-repair",
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        status: error.status || null,
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

  for (const candidate of candidates) {
    let raw = "";
    try {
      const capability = await modelCapabilities(candidate, prompt, schema, transport);
      const outputTokens = options.outputTokens || 64000;
      assertCapacity(capability, outputTokens);
      raw = await callStructuredCandidate(candidate, prompt, schema, outputTokens, transport, mode);

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
        if (mode === "semantic") {
          const repaired = await repairStructuredOutput(
            raw,
            prompt,
            schema,
            validate,
            options,
            transport,
            validationError.message,
            failures
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
      failures.push({
        phase: mode,
        provider: candidate.name,
        model: candidate.model,
        keySlot: candidate.keySlot,
        status: error.status || null,
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
const cacheKeyFor = (parts) => "bond-v" + BOND_ANALYSIS_VERSION + ":" + sheetHash(parts.join("\n"));

export function registerBondAnalysis(app, { pool, requireDb, getSessionIdentity, stringifyJsonbSafe, analyze = analyzeStructured, env = process.env, clock = Date.now }) {
  // One scheduler for every job. The browser may submit all sheets at once; the
  // server decides how many heavy model calls really run together.
  const concurrency = Math.max(1, Number(env.BOND_ANALYSIS_CONCURRENCY) || 8);
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
    if (profiles.length !== profileKeys.length || new Set(profiles.map((row) => row.result.id)).size !== profiles.length || [...ids].some((id) => !profiles.some((row) => row.result.id === id))) throw new Error("Missing or mismatched cached profiles");
    const own = profiles.find((row) => row.result.id === owner);
    if (!own || own.hash !== hash) throw new Error("Owner sheet changed since profile analysis");
    const allProfiles = resolveProfileReferences(profiles.map((row) => row.result));
    const ownProfile = allProfiles.find((profile) => profile.id === owner);
    const groupIndex = buildGroupIndex(allProfiles);
    const cards = roster.map((target) => {
      const profile = allProfiles.find((candidate) => candidate.id === target.id);
      return { id: target.id, names: profile.names, groups: profile.groups, oneLine: target.oneLine || "" };
    });
    const facts = Object.fromEntries(cards.map((card) => [card.id, reconcileFacts(owner, card.id, allProfiles, groupIndex)]));

    // A bond depends only on the owner's sheet/profile, the target's card and the
    // objective facts for this pair. A new character therefore never forces the
    // bonds between everyone else to be read again.
    const pairKeys = cards.map((card) => cacheKeyFor([world, "pair", owner, hash, JSON.stringify(ownProfile), JSON.stringify(card), JSON.stringify(facts[card.id]), outputLanguage, BASELINE_PROMPT, String(force || "")]));
    const known = await readRows(pairKeys);
    const bonds = new Map();
    cards.forEach((card, index) => {
      const row = known.get(pairKeys[index]);
      if (!row?.bond || row.version !== BOND_ANALYSIS_VERSION || row.world !== world) return;
      try {
        validateBonds({ bonds: [row.bond] }, owner, [card], ownSheet, { [card.id]: facts[card.id] });
        bonds.set(card.id, row.bond);
      } catch { /* stale or corrupt entry: read this pair again */ }
    });
    const missing = cards.filter((card) => !bonds.has(card.id));
    const prompt = BASELINE_PROMPT + "\n" + JSON.stringify({ owner, ownSheet, profile: ownProfile, roster: missing, objectiveFacts: Object.fromEntries(missing.map((card) => [card.id, facts[card.id]])), outputLanguage });
    return {
      stage, metadata, body, owner, hash, schema: BondArraySchema, prompt, cards, pairKeys, bonds, missing,
      jobKey: cacheKeyFor([world, stage, prompt, String(force || "")]),
      validate: (value) => validateBonds(value, owner, missing, ownSheet, Object.fromEntries(missing.map((card) => [card.id, facts[card.id]]))),
    };
  }

  // A finished baseline job is completed from the per-pair rows it stored.
  async function assembleBaseline(job, jobKey) {
    const rows = await readRows(job.pairKeys);
    const bonds = job.pairKeys.map((key) => rows.get(key)?.bond);
    if (bonds.some((bond) => !bond)) return null;
    return { ...job, request: undefined, result: { bonds }, jobKey, cacheKey: jobKey, pending: false };
  }

  function launch(prepared, previous) {
    const { jobKey, stage, owner, hash, prompt, schema, validate, metadata, body } = prepared;
    active.add(jobKey);
    const attempts = previous?.terminal ? 0 : Number(previous?.attempts || 0);
    const work = async () => {
      try {
        console.info("[bond-analysis-input]", JSON.stringify({ stage, owner, sheetHash: hash, sourceChars: metadata.sourceChars, promptChars: prompt.length, targets: prepared.missing?.length }));
        const analyzed = await analyze(prompt, schema, validate, { outputTokens: 64000, semanticStartOffset: rotation++ });
        if (stage === "baseline") {
          await Promise.all(analyzed.result.bonds.map((bond) => {
            const index = prepared.cards.findIndex((card) => card.id === bond.to);
            return saveRow(prepared.pairKeys[index], { stage: "pair", world: metadata.world, version: BOND_ANALYSIS_VERSION, owner, hash, bond, provider: analyzed.provider, model: analyzed.model, keySlot: analyzed.keySlot });
          }));
          await saveRow(jobKey, { ...metadata, ...analyzed, pairKeys: prepared.pairKeys, computed: analyzed.result.bonds.length });
        } else {
          await saveRow(jobKey, { ...metadata, ...analyzed });
        }
      } catch (error) {
        const retryable = error.failures?.some((failure) => [429, 500, 502, 503, 504].includes(failure.status) || /abort|network|fetch|ECONN/i.test(failure.reason)) || !error.failures;
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

  app.post("/ai/bond-analysis", async (req, res) => {
    try {
      if (!(await requireDb(res))) return;
      const session = await getSessionIdentity(req);
      if (!session) return res.status(401).json({ error: "Not authenticated." });
      let body = req.body || {};

      // Polling sends only the job key, never the sheet again.
      if (typeof body.poll === "string") {
        const job = await readRow(body.poll);
        if (!job || job.world !== session.worldCode) return res.status(404).json({ error: "Unknown analysis job" });
        if (job.result) {
          const done = job.stage === "baseline" ? await assembleBaseline(job, body.poll) : { ...job, jobKey: body.poll, cacheKey: body.poll, pending: false };
          return done ? res.json(done) : res.status(404).json({ error: "Unknown analysis job" });
        }
        if (!job.request) return res.status(404).json({ error: "Unknown analysis job" });
        body = job.request;
      }

      const prepared = await prepare(session, body);
      const { jobKey, stage, metadata } = prepared;

      if (stage === "baseline" && !prepared.missing.length) {
        return res.json({ ...metadata, result: { bonds: prepared.cards.map((card) => prepared.bonds.get(card.id)) }, computed: 0, jobKey, cacheKey: jobKey, pending: false, cached: true });
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
        if (!cooling) await launch(prepared, previous);
      }
      res.status(202).json({ ...waitingOn, error: previous?.error || null, retryAt: previous?.retryAt || null });
    } catch (error) {
      res.status(error.status || 503).json({ error: error.message });
    }
  });
}
