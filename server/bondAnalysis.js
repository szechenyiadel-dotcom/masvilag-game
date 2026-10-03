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
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}

function providerCandidates(env) {
  const candidates = [];
  for (const name of ["gemini", "groq"]) {
    const prefix = name.toUpperCase();
    const models = [...new Set([env[prefix + "_ANALYSIS_MODEL"], env[prefix + "_DEEP_MODEL"]].filter(Boolean))];
    if (!models.length) continue;
    const keys = Object.keys(env).filter((key) => key === prefix + "_API_KEY" || key.startsWith(prefix + "_API_KEY_")).sort();
    for (const [modelIndex, model] of models.entries()) {
    const unique = new Set();
    for (const key of keys) {
      if (!env[key] || unique.has(env[key])) continue;
      unique.add(env[key]);
      candidates.push({ name, model, key: env[key], priority: Number(env[prefix + "_ANALYSIS_PRIORITY"] || (name === "gemini" ? 100 : 80)) - modelIndex * 10, contextWindow: Number(env[prefix + "_ANALYSIS_CONTEXT_WINDOW"]), outputLimit: Number(env[prefix + "_ANALYSIS_OUTPUT_LIMIT"]) });
    }
    }
  }
  return candidates.sort((a, b) => b.priority - a.priority);
}

async function modelCapabilities(candidate, prompt, schema, transport) {
  if (candidate.name === "gemini") {
    const root = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(candidate.model);
    const headers = { "x-goog-api-key": candidate.key, "Content-Type": "application/json" };
    const meta = await transport(root, { headers });
    if (!meta.supportedGenerationMethods?.includes("generateContent")) throw new Error("Configured Gemini model cannot generate content");
    const count = await transport(root + ":countTokens", { method: "POST", headers, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt + "\nJSON SCHEMA:\n" + JSON.stringify(schema) }] }] }) });
    return { contextWindow: meta.inputTokenLimit, outputLimit: meta.outputTokenLimit, inputTokens: Number(count.totalTokens) };
  }
  const meta = await transport("https://api.groq.com/openai/v1/models/" + encodeURIComponent(candidate.model), { headers: { Authorization: "Bearer " + candidate.key } });
  if (meta.active === false) throw new Error("Configured Groq model is inactive");
  // A UTF-8 byte is an upper bound for a byte-level token; never underestimate
  // when this provider has no token-counting endpoint.
  return {
    contextWindow: Number(meta.context_window || candidate.contextWindow),
    outputLimit: Number(meta.max_completion_tokens || candidate.outputLimit),
    inputTokens: Buffer.byteLength(prompt + JSON.stringify(schema), "utf8"),
  };
}

export async function analyzeStructured(prompt, schema, validate, options = {}) {
  const transport = options.transport || request;
  const candidates = options.candidates || providerCandidates(options.env || process.env);
  const failures = [];
  const invalidProviders = new Set();
  // Fail over to the other provider before trying another key on the same one.
  const first = candidates.filter((candidate, index) => candidates.findIndex((other) => other.name === candidate.name) === index);
  const ordered = [...first, ...candidates.filter((candidate) => !first.includes(candidate))];
  for (const candidate of ordered) {
    if (invalidProviders.has(candidate.name)) continue;
    try {
      const capability = await modelCapabilities(candidate, prompt, schema, transport);
      const outputTokens = options.outputTokens || 16000;
      if (!Number.isFinite(capability.inputTokens) || !Number.isFinite(capability.contextWindow) || !Number.isFinite(capability.outputLimit)) throw new Error("Unverified model capacity; configure analysis limits");
      if (capability.contextWindow < Math.ceil(capability.inputTokens * 1.3) + outputTokens || capability.outputLimit < outputTokens) throw new Error("Full input/output does not fit configured model; no truncation performed");
      let validationError = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const completePrompt = validationError ? prompt + "\nPrevious output failed validation: " + validationError + ". Return the complete corrected JSON, not a patch." : prompt;
        if (validationError) {
          const retryCapacity = await modelCapabilities(candidate, completePrompt, schema, transport);
          if (retryCapacity.contextWindow < Math.ceil(retryCapacity.inputTokens * 1.3) + outputTokens) throw new Error("Full repair request does not fit; no truncation performed");
        }
        let raw;
        if (candidate.name === "gemini") {
          const data = await transport("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(candidate.model) + ":generateContent", {
            method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": candidate.key },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: completePrompt }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: outputTokens } }),
          });
          if (data.candidates?.[0]?.finishReason !== "STOP") throw new Error("Incomplete Gemini analysis: " + (data.candidates?.[0]?.finishReason || "no candidate"));
          raw = (data.candidates[0].content?.parts || []).filter((part) => !part.thought).map((part) => part.text || "").join("");
        } else {
          const data = await transport("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + candidate.key },
            body: JSON.stringify({ model: candidate.model, messages: [{ role: "user", content: completePrompt }], response_format: { type: "json_schema", json_schema: { name: "sheet_analysis", strict: true, schema } }, max_completion_tokens: outputTokens, reasoning_effort: "high" }),
          });
          if (data.choices?.[0]?.finish_reason !== "stop") throw new Error("Incomplete Groq analysis: " + (data.choices?.[0]?.finish_reason || "no choice"));
          raw = data.choices[0].message?.content;
        }
        try {
          const result = JSON.parse(raw);
          validate(result);
          return { result, provider: candidate.name, model: candidate.model, inputTokens: capability.inputTokens };
        } catch (error) {
          validationError = error.message;
          if (attempt === 1) {
            invalidProviders.add(candidate.name);
            throw new Error("Two invalid schema/evidence outputs: " + validationError);
          }
        }
      }
    } catch (error) {
      failures.push({ provider: candidate.name, model: candidate.model, status: error.status || null, reason: error.message });
    }
  }
  const error = new Error("No analysis provider completed the full validated request. " + failures.map((failure) => failure.provider + "/" + failure.model + ": " + failure.reason).join("; "));
  error.failures = failures;
  throw error;
}

export function registerBondAnalysis(app, { pool, requireDb, getSessionIdentity, stringifyJsonbSafe }) {
  const active = new Set();
  let queue = Promise.resolve();
  app.post("/ai/bond-analysis", async (req, res) => {
    try {
      if (!(await requireDb(res))) return;
      const session = await getSessionIdentity(req);
      if (!session) return res.status(401).json({ error: "Not authenticated." });
      const { stage, owner, roster, ownSheet, profileKeys, language, force, fieldNames = [] } = req.body || {};
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
        // Persist the full source before starting. A dropped browser request or a
        // server restart cannot lose a completed profile/baseline checkpoint.
        await save({ ...metadata, pending: true, request: req.body });
        active.add(cacheKey);
        queue = queue.catch(() => {}).then(async () => {
          try {
            console.info("[bond-analysis-input]", JSON.stringify({ stage, owner, sheetHash: hash, sourceChars: ownSheet.length, submittedChars: ownSheet.length, promptChars: prompt.length }));
            const analyzed = await analyzeStructured(prompt, schema, validate, { outputTokens: stage === "profile" ? 32000 : Math.max(12000, roster.length * 1600) });
            await save({ ...metadata, ...analyzed });
          } catch (error) {
            const retryable = error.failures?.some(failure => [429, 500, 502, 503, 504].includes(failure.status) || /abort|network|fetch|ECONN/i.test(failure.reason));
            await save({ ...metadata, request: req.body, pending: !!retryable, fatal: !retryable, error: error.message, retryAt: Date.now() + 60000 });
            console.warn("[bond-analysis-failed]", stage, owner, error.message);
          } finally { active.delete(cacheKey); }
        });
      }
      res.status(202).json({ ...metadata, cacheKey, pending: true, error: previous?.error || null, retryAt: previous?.retryAt || null, cached: false });
    } catch (error) {
      res.status(503).json({ error: error.message });
    }
  });
}
