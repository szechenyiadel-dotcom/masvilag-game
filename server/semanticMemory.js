/*
 * MÁSVILÁG SEMANTIC CHARACTER MEMORY
 *
 * What a character remembers, retrievable by meaning:
 *  - their OWN SHEET, cut into chunks (memory_type "self_sheet"), so a conversation gets
 *    the parts of the sheet that matter for it instead of the whole sheet;
 *  - the important things that happened to them in the game (memory_type "event").
 *
 * Cost rules: embeddings use the FREE Gemini keys only (rotating, resting on quota) and a
 * sheet is embedded once; an unchanged chunk is never embedded again. When no free key is
 * available, writes wait and retry later and reads fall back to a keyword match computed
 * in code. Nothing here ever blocks a conversation.
 */
import crypto from "node:crypto";
import { selectGeminiKeys } from "./aiPolicy.js";

export const SELF_SHEET_TYPE = "self_sheet";
export const EVENT_TYPE = "event";

export const MAX_CHUNK_CHARS = 1200;
export const MAX_SHEET_CHUNKS = 60;
export const MAX_EVENT_BATCH = 24;
export const MAX_RECALL_CHARACTERS = 4;
export const DEFAULT_RECALL_TOP_K = 5;
export const MIN_SEMANTIC_SCORE = 0.4;

const clip = (value, max) => String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);

export function memoryHash(characterId, memoryType, text) {
  return crypto.createHash("sha256").update([characterId, memoryType, text].join("\u0000")).digest("hex").slice(0, 32);
}

/* Which stored sheet chunks to drop and which wanted ones still have to be embedded. */
export function planSheetSync(existingRows, wantedChunks) {
  const wantedHashes = new Set(wantedChunks.map((chunk) => chunk.hash));
  const seen = new Set();
  const remove = [];
  for (const row of existingRows) {
    if (!wantedHashes.has(row.hash) || seen.has(row.hash)) remove.push(row.id);
    else seen.add(row.hash);
  }
  const add = wantedChunks.filter((chunk, index, all) => !seen.has(chunk.hash) && all.findIndex((other) => other.hash === chunk.hash) === index);
  return { remove, add, keep: seen.size };
}

/* Same weights the original /memory/search used: meaning first, then importance, confidence, recency. */
export function scoreMemory({ semantic, importance, confidence, ageDays }) {
  const imp = Math.min(1, Math.max(0, Number(importance) / 100 || 0));
  const conf = Math.min(1, Math.max(0, Number.isFinite(Number(confidence)) ? Number(confidence) : 1));
  const recency = Math.exp(-Math.max(0, Number(ageDays) || 0) / 90);
  return semantic * 0.72 + imp * 0.16 + conf * 0.07 + recency * 0.05;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return -1;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]), y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
    dot += x * y; aa += x * x; bb += y * y;
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : -1;
}

const tokenize = (text) => new Set(
  String(text || "").toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 4)
);

/* Keyword overlap, computed in code. The fallback when no embedding is available. */
export function lexicalScore(query, text) {
  const wanted = tokenize(query);
  if (!wanted.size) return 0;
  const have = tokenize(text);
  let hits = 0;
  for (const token of wanted) if (have.has(token)) hits += 1;
  return hits / Math.sqrt(wanted.size * Math.max(1, have.size));
}

export function rankRows(rows, { queryEmbedding = null, query = "", now = Date.now(), topK = DEFAULT_RECALL_TOP_K }) {
  const scored = [];
  for (const row of rows) {
    const ageDays = Math.max(0, (now - new Date(row.created_at).getTime()) / 86400000);
    let semantic;
    if (queryEmbedding) {
      if (!Array.isArray(row.embedding) || row.embedding.length !== queryEmbedding.length) continue;
      semantic = cosineSimilarity(queryEmbedding, row.embedding);
      if (!Number.isFinite(semantic) || semantic < MIN_SEMANTIC_SCORE) continue;
    } else {
      semantic = lexicalScore(query, row.memory_text);
      if (semantic <= 0) continue;
    }
    scored.push({ row, semantic, score: scoreMemory({ semantic, importance: row.importance, confidence: row.confidence, ageDays }) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK));
}

/* ---------- embeddings on the free Gemini keys ---------- */

const mapLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

export function createEmbedder({
  freeKeys, paidKey = "", allowPaid = false, fetchFn, model, dimensions, normalize = (v) => v,
  now = Date.now, timeoutMs = 30000, restUntil = new Map(),
}) {
  const unavailable = (waitMs) => {
    const error = new Error("No free embedding capacity right now; try again later.");
    error.status = 503;
    error.waiting = true;
    error.retryAfter = Math.max(20, Math.ceil((waitMs || 60000) / 1000));
    return error;
  };

  async function embed(text, taskType = "RETRIEVAL_DOCUMENT", title = "") {
    const clean = clip(text, 7000);
    if (!clean) throw Object.assign(new Error("Memory embedding text is empty."), { status: 400 });
    const selection = selectGeminiKeys({ freeKeys, paidKey, restUntil, now: now(), foreground: false, allowPaidBackground: allowPaid });
    if (!selection.keys.length) throw unavailable(selection.waitMs);

    let lastError = null;
    for (const key of selection.keys) {
      const config = { taskType, outputDimensionality: dimensions, autoTruncate: true };
      if (taskType === "RETRIEVAL_DOCUMENT" && title) config.title = clip(title, 220);
      const response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text: clean }] }, embedContentConfig: config }),
        timeoutMs,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const values = normalize(payload?.embedding?.values || []);
        if (!values.length) throw Object.assign(new Error("Gemini embedding returned no vector values."), { status: 502 });
        return values;
      }
      const message = String(payload?.error?.message || payload?.error || "");
      lastError = Object.assign(new Error(message || `Gemini embedding failed with HTTP ${response.status}.`), { status: response.status });
      /* Google answers an invalid or expired key with HTTP 400 "API key not valid", not 401/403:
         rest that key for a day and move on to the next free one. */
      const badKey = [401, 403].includes(response.status) || (response.status === 400 && /api key/i.test(message));
      if (badKey) restUntil.set(key, now() + 24 * 3600 * 1000);
      else if (response.status === 429) restUntil.set(key, now() + (/day|daily|quota/i.test(message) ? 30 * 60 * 1000 : 90 * 1000));
      else if (![408, 500, 502, 503, 504, 529].includes(response.status)) throw lastError;
    }
    throw Object.assign(unavailable(60000), { cause: lastError });
  }

  return { embed, restUntil };
}

/* ---------- routes ---------- */

const rowForClient = (row, score) => ({
  id: Number(row.id), characterId: row.character_id, memoryType: row.memory_type, source: row.source || "",
  text: row.memory_text, importance: Number(row.importance) || 0, createdAt: row.created_at,
  score: Number(Number(score).toFixed(6)),
});

const waitingBody = (error) => ({ ok: false, waiting: true, retryAfter: Number(error.retryAfter) || 60 });

export function registerSemanticMemory(app, { pool, requireDb, getSession, clearSessionCookie = () => {}, embedder, model, now = Date.now }) {
  const guard = (handler) => async (req, res) => {
    try {
      if (!(await requireDb(res))) return;
      const session = await getSession(req);
      if (!session) { clearSessionCookie(res); return res.status(401).json({ error: "Not authenticated." }); }
      await handler(req, res, session);
    } catch (error) {
      console.error("Semantic memory error:", error);
      res.status(Number(error?.status) || 500).json({ error: error?.message || "Semantic memory failed." });
    }
  };

  const insertMemory = (session, row, embedding) => pool.query(
    `INSERT INTO character_memories
       (world_code, character_id, subject_ids, memory_type, source, memory_text, importance, confidence,
        knowledge_type, visibility, metadata, embedding, embedding_model)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)`,
    [session.worldCode, row.characterId, JSON.stringify(row.subjectIds), row.memoryType, row.source, row.text, row.importance,
      row.confidence, row.knowledgeType, row.visibility, JSON.stringify(row.metadata), JSON.stringify(embedding), model],
  );

  /* One character's own sheet. Only changed chunks cost an embedding. */
  app.post("/memory/sync-sheet", guard(async (req, res, session) => {
    const characterId = clip(req.body?.characterId, 120);
    const incoming = Array.isArray(req.body?.chunks) ? req.body.chunks.slice(0, MAX_SHEET_CHUNKS) : [];
    if (!characterId) return res.status(400).json({ error: "characterId is required." });
    const wanted = incoming
      .map((chunk) => ({ key: clip(chunk?.key, 80), text: clip(chunk?.text, MAX_CHUNK_CHARS), importance: Math.round(Math.min(100, Math.max(0, Number(chunk?.importance) || 50))) }))
      .filter((chunk) => chunk.text)
      .map((chunk) => ({ ...chunk, hash: memoryHash(characterId, SELF_SHEET_TYPE, chunk.text) }));

    const existing = await pool.query(
      "SELECT id, metadata->>'hash' AS hash FROM character_memories WHERE world_code = $1 AND character_id = $2 AND memory_type = $3",
      [session.worldCode, characterId, SELF_SHEET_TYPE],
    );
    const plan = planSheetSync(existing.rows, wanted);
    if (plan.remove.length) await pool.query("DELETE FROM character_memories WHERE world_code = $1 AND id = ANY($2::int[])", [session.worldCode, plan.remove]);

    let added = 0;
    try {
      await mapLimit(plan.add, 3, async (chunk) => {
        const embedding = await embedder.embed(chunk.text, "RETRIEVAL_DOCUMENT", `sheet ${chunk.key} of ${characterId}`);
        await insertMemory(session, {
          characterId, subjectIds: [characterId], memoryType: SELF_SHEET_TYPE, source: `sheet:${chunk.key}`, text: chunk.text,
          importance: chunk.importance, confidence: 1, knowledgeType: "self", visibility: "private", metadata: { hash: chunk.hash, key: chunk.key },
        }, embedding);
        added += 1;
      });
    } catch (error) {
      if (!error?.waiting) throw error;
      /* What was stored stays stored (the hash makes a retry idempotent). */
      return res.json({ ...waitingBody(error), characterId, kept: plan.keep, added, removed: plan.remove.length });
    }
    res.json({ ok: true, characterId, kept: plan.keep, added, removed: plan.remove.length });
  }));

  /* Important things that happened to characters. */
  app.post("/memory/remember-batch", guard(async (req, res, session) => {
    const incoming = Array.isArray(req.body?.memories) ? req.body.memories.slice(0, MAX_EVENT_BATCH) : [];
    const items = incoming.map((item) => {
      const characterId = clip(item?.characterId, 120);
      const text = clip(item?.text, 1500);
      const memoryType = clip(item?.memoryType || EVENT_TYPE, 80);
      return {
        characterId, text, memoryType,
        source: clip(item?.source || "world", 120),
        knowledgeType: clip(item?.knowledgeType || "witnessed", 80),
        visibility: clip(item?.visibility || "private", 80),
        subjectIds: [...new Set((Array.isArray(item?.subjectIds) ? item.subjectIds : []).map((id) => clip(id, 120)).filter(Boolean))].slice(0, 20),
        importance: Math.round(Math.min(100, Math.max(0, Number(item?.importance) || 50))),
        confidence: Math.min(1, Math.max(0, Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : 1)),
        metadata: { ...(item?.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : {}), hash: memoryHash(characterId, memoryType, text) },
      };
    }).filter((item) => item.characterId && item.text);
    if (!items.length) return res.json({ ok: true, stored: 0, skipped: 0 });

    const known = await pool.query(
      "SELECT metadata->>'hash' AS hash FROM character_memories WHERE world_code = $1 AND metadata->>'hash' = ANY($2::text[])",
      [session.worldCode, items.map((item) => item.metadata.hash)],
    );
    const have = new Set(known.rows.map((row) => row.hash));
    const fresh = items.filter((item, index, all) => !have.has(item.metadata.hash) && all.findIndex((other) => other.metadata.hash === item.metadata.hash) === index);

    let stored = 0;
    try {
      await mapLimit(fresh, 3, async (item) => {
        const embedding = await embedder.embed(item.text, "RETRIEVAL_DOCUMENT", `${item.memoryType} memory for ${item.characterId}`);
        await insertMemory(session, item, embedding);
        stored += 1;
      });
    } catch (error) {
      if (!error?.waiting) throw error;
      return res.json({ ...waitingBody(error), stored, skipped: items.length - fresh.length });
    }
    res.json({ ok: true, stored, skipped: items.length - stored });
  }));

  /* The memories of up to four characters that matter for this moment: ONE query embedding. */
  app.post("/memory/recall", guard(async (req, res, session) => {
    const characterIds = [...new Set((Array.isArray(req.body?.characterIds) ? req.body.characterIds : []).map((id) => clip(id, 120)).filter(Boolean))].slice(0, MAX_RECALL_CHARACTERS);
    const query = clip(req.body?.query, 5000);
    const topK = Math.round(Math.min(8, Math.max(1, Number(req.body?.topK) || DEFAULT_RECALL_TOP_K)));
    if (!characterIds.length || !query) return res.status(400).json({ error: "characterIds and query are required." });

    let queryEmbedding = null, mode = "semantic", wait = null;
    try { queryEmbedding = await embedder.embed(query, "RETRIEVAL_QUERY"); }
    catch (error) {
      if (!error?.waiting) throw error;
      mode = "lexical"; wait = error;
    }

    const byCharacter = {};
    for (const characterId of characterIds) {
      const candidates = await pool.query(
        queryEmbedding
          ? `SELECT * FROM character_memories WHERE world_code = $1 AND character_id = $2 AND embedding IS NOT NULL AND embedding_model = $3
             ORDER BY importance DESC, created_at DESC LIMIT 600`
          : `SELECT * FROM character_memories WHERE world_code = $1 AND character_id = $2 AND $3::text IS NOT NULL
             ORDER BY importance DESC, created_at DESC LIMIT 600`,
        [session.worldCode, characterId, model],
      );
      byCharacter[characterId] = rankRows(candidates.rows, { queryEmbedding, query, now: now(), topK }).map(({ row, score }) => rowForClient(row, score));
    }
    res.json({ ok: true, mode, byCharacter, ...(wait ? { waiting: true, retryAfter: Number(wait.retryAfter) || 60 } : {}) });
  }));
}
