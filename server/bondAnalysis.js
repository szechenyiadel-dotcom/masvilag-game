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

export function registerBondAnalysis(app, { pool, requireDb, getSessionIdentity, stringifyJsonbSafe }) {
  const active = new Set();
  let queue = Promise.resolve();

  // Restart World profiles are intentionally not queued: all profile reads may
  // start together. Only the much heavier baseline/relationship generation stays
  // capped. Normal/background/manual analysis still uses the original serial queue.
  const restartBaselineConcurrency = 4;
  let restartBaselineInFlight = 0;
  const restartBaselineWaiters = [];
  const runRestartBaselineTask = async (task) => {
    if (restartBaselineInFlight >= restartBaselineConcurrency) {
      await new Promise((resolve) => restartBaselineWaiters.push(resolve));
    }
    restartBaselineInFlight += 1;
    try {
      return await task();
    } finally {
      restartBaselineInFlight -= 1;
      const next = restartBaselineWaiters.shift();
      if (next) next();
    }
  };

  app.post("/ai/bond-analysis", async (req, res) => {
    try {
      if (!(await requireDb(res))) return;
      const session = await getSessionIdentity(req);
      if (!session) return res.status(401).json({ error: "Not authenticated." });
      const { stage, owner, roster, ownSheet, profileKeys, language, force, restartFast = false, restartProfileIndex = 0, fieldNames = [] } = req.body || {};
      if (!["profile", "baseline"].includes(stage) || typeof owner !== "string" || typeof ownSheet !== "string" || !Array.isArray(roster)) return res.status(400).json({ error: "Invalid analysis request" });
      const ids = new Set([owner, ...roster.map((entry) => entry.id)]);
      if (ids.size !== roster.length + 1) return res.status(400).json({ error: "Duplicate roster IDs" });
      const hash = sheetHash(ownSheet);
      let schema, prompt, validate;
      if (stage === "profile") {
        schema = ProfileSchema;
        prompt = EXTRACT_PROMPT + "\n" + JSON.stringify({ owner, ownSheet, fieldNames, outputLanguage: language === "en" ? "English" : "Hungarian" });
        validate = (value) => validateProfile(value, ownSheet, owner, ids, fieldNames);
      } else {
        if (!Array.isArray(profileKeys) || profileKeys.length !== ids.size) return res.status(400).json({ error: "All profiles are required before group inference" });
        const rows = await pool.query("SELECT data FROM relationship_reading_cache WHERE cache_key = ANY($1::text[])", [profileKeys]);
        const profiles = rows.rows.map((row) => row.data).filter((row) => row.version === BOND_ANALYSIS_VERSION && row.world === session.worldCode && row.stage === "profile");
        if (profiles.length !== ids.size || new Set(profiles.map((row) => row.result.id)).size !== ids.size || profiles.some((row) => !ids.has(row.result.id))) throw new Error("Missing or mismatched cached profiles");
        const own = profiles.find((row) => row.result.id === owner);
        if (!own || own.hash !== hash) throw new Error("Owner sheet changed since profile analysis");
        const allProfiles = resolveProfileReferences(profiles.map((row) => row.result));
        const groupIndex = buildGroupIndex(allProfiles);
        const objectiveFacts = Object.fromEntries(roster.map((target) => [target.id, reconcileFacts(owner, target.id, allProfiles, groupIndex)]));
        const cards = roster.map((target) => {
          const profile = allProfiles.find((p) => p.id === target.id);
          return { id: target.id, names: profile.names, groups: profile.groups, oneLine: target.oneLine || "" };
        });
        schema = BondArraySchema;
        prompt = BASELINE_PROMPT + "\n" + JSON.stringify({ owner, ownSheet, profile: own.result, roster: cards, groupIndex, objectiveFacts, outputLanguage: language === "en" ? "English" : "Hungarian" });
        validate = (value) => validateBonds(value, owner, cards, ownSheet, objectiveFacts);
      }
      const cacheKey = "bond-v" + BOND_ANALYSIS_VERSION + ":" + sheetHash(session.worldCode + "\n" + stage + "\n" + prompt + "\n" + String(force || ""));
      const cached = await pool.query("SELECT data FROM relationship_reading_cache WHERE cache_key = $1", [cacheKey]);
      const previous = cached.rows[0]?.data;
      if (previous?.result) {
        validate(previous.result);
        return res.json({ ...previous, cacheKey, cached: true });
      }
      if (previous?.fatal) return res.status(422).json({ error: previous.error });
      const metadata = { stage, world: session.worldCode, hash, version: BOND_ANALYSIS_VERSION, sourceChars: ownSheet.length, submittedChars: ownSheet.length };
      const save = (data) => pool.query("INSERT INTO relationship_reading_cache (cache_key,data,updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT (cache_key) DO UPDATE SET data=EXCLUDED.data, updated_at=NOW()", [cacheKey, stringifyJsonbSafe(data, "bond-analysis")]);
      if (!active.has(cacheKey) && Date.now() >= Number(previous?.retryAt || 0)) {
        // Claim first: a background reader and a Restart click can now overlap,
        // but the same cache key must still launch only one AI job.
        active.add(cacheKey);
        try {
          // Persist the full source before starting. A dropped browser request or a
          // server restart cannot lose a completed profile/baseline checkpoint.
          await save({ ...metadata, pending: true, request: req.body });
        } catch (error) {
          active.delete(cacheKey);
          throw error;
        }

        const work = async () => {
          try {
            console.info("[bond-analysis-input]", JSON.stringify({ stage, owner, restartFast: !!restartFast, sheetHash: hash, sourceChars: ownSheet.length, submittedChars: ownSheet.length, promptChars: prompt.length }));
            const analyzed = await analyzeStructured(prompt, schema, validate, {
              outputTokens: 64000,
              semanticStartOffset: restartFast && stage === "profile" ? Number(restartProfileIndex) || 0 : 0,
            });
            await save({ ...metadata, ...analyzed });
          } catch (error) {
            const retryable = error.failures?.some(failure => [429, 500, 502, 503, 504].includes(failure.status) || /abort|network|fetch|ECONN/i.test(failure.reason));
            await save({ ...metadata, request: req.body, pending: !!retryable, fatal: !retryable, error: error.message, retryAt: Date.now() + 60000 });
            console.warn("[bond-analysis-failed]", stage, owner, error.message);
          } finally {
            active.delete(cacheKey);
          }
        };

        if (restartFast && stage === "profile") {
          // All profile reads begin immediately during Restart World.
          void work();
        } else if (restartFast) {
          // Relationship baselines are larger, so keep them safely bounded.
          void runRestartBaselineTask(work);
        } else {
          queue = queue.catch(() => {}).then(work);
        }
      }
      res.status(202).json({ ...metadata, cacheKey, pending: true, error: previous?.error || null, retryAt: previous?.retryAt || null, cached: false });
    } catch (error) {
      res.status(503).json({ error: error.message });
    }
  });
}
