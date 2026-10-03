import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  memoryHash, planSheetSync, lexicalScore, scoreMemory, rankRows, createEmbedder, registerSemanticMemory,
  SELF_SHEET_TYPE, MIN_SEMANTIC_SCORE,
} from "../server/semanticMemory.js";

/* ---------- fakes: a tiny memory table and a bag-of-words "embedding model" ---------- */

const DIM = 16;
const bucket = (token) => [...token].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % DIM, 7);
const fakeVector = (text) => {
  const vector = new Array(DIM).fill(0);
  for (const token of String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)) vector[bucket(token)] += 1;
  const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
};

function fakeDb() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    async query(sql, params) {
      if (/^INSERT INTO character_memories/.test(sql.trim())) {
        const [world_code, character_id, subject_ids, memory_type, source, memory_text, importance, confidence, knowledge_type, visibility, metadata, embedding, embedding_model] = params;
        rows.push({ id: nextId++, world_code, character_id, subject_ids: JSON.parse(subject_ids), memory_type, source, memory_text, importance, confidence, knowledge_type, visibility, metadata: JSON.parse(metadata), created_at: new Date(), embedding: JSON.parse(embedding), embedding_model });
        return { rows: [] };
      }
      if (/^DELETE FROM character_memories/.test(sql.trim())) {
        const ids = new Set(params[1]);
        for (let i = rows.length - 1; i >= 0; i -= 1) if (ids.has(rows[i].id)) rows.splice(i, 1);
        return { rows: [] };
      }
      if (/SELECT id, metadata->>'hash' AS hash/.test(sql)) {
        return { rows: rows.filter((r) => r.world_code === params[0] && r.character_id === params[1] && r.memory_type === params[2]).map((r) => ({ id: r.id, hash: r.metadata.hash, key: r.metadata.key })) };
      }
      if (/SELECT metadata->>'hash' AS hash/.test(sql)) {
        return { rows: rows.filter((r) => r.world_code === params[0] && params[1].includes(r.metadata.hash)).map((r) => ({ hash: r.metadata.hash })) };
      }
      if (/^SELECT \* FROM character_memories/.test(sql.trim())) {
        const needsEmbedding = /embedding IS NOT NULL/.test(sql);
        return { rows: rows.filter((r) => r.world_code === params[0] && r.character_id === params[1] && (!needsEmbedding || (r.embedding && r.embedding_model === params[2]))) };
      }
      throw new Error("unexpected SQL: " + sql);
    },
  };
}

function setup({ failFree = false, batch = null } = {}) {
  const db = fakeDb();
  const calls = { embed: 0, http: 0, batches: 0, keys: [], bodies: [] };
  const fetchFn = async (url, options) => {
    const key = options.headers["x-goog-api-key"];
    calls.keys.push(key);
    calls.http += 1;
    if (failFree && key !== "paid") return { ok: false, status: 429, json: async () => ({ error: { message: "rate limit per minute" } }) };
    const body = JSON.parse(options.body);
    calls.bodies.push({ url, body });
    if (/:batchEmbedContents/.test(url)) {
      if (batch) { const answer = batch(body); if (answer) return answer; }
      calls.batches += 1;
      calls.embed += body.requests.length;
      return { ok: true, status: 200, json: async () => ({ embeddings: body.requests.map((request) => ({ values: fakeVector(request.content.parts[0].text) })) }) };
    }
    calls.embed += 1;
    const text = body.content.parts[0].text;
    return { ok: true, status: 200, json: async () => ({ embedding: { values: fakeVector(text) } }) };
  };
  const embedder = createEmbedder({ freeKeys: ["free1", "free2"], paidKey: "paid", fetchFn, model: "emb", dimensions: DIM });
  const app = express();
  app.use(express.json());
  let authenticated = true;
  registerSemanticMemory(app, {
    pool: db, requireDb: async () => true, embedder, model: "emb",
    getSession: async () => (authenticated ? { worldCode: "W1" } : null),
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  return { db, calls, post, close: () => server.close(), logout: () => { authenticated = false; } };
}

const sheetChunks = [
  { key: "backstory#0", text: "Manon is afraid of deep water since she almost drowned in the lake as a child.", importance: 70 },
  { key: "goals#0", text: "Manon wants to win the regional boxing tournament for the Cobra Kai dojo.", importance: 75 },
];

/* ---------- pure helpers ---------- */

test("planSheetSync keeps what is unchanged, drops what is gone, embeds only what is new", () => {
  const wanted = ["a", "b", "c"].map((hash) => ({ hash }));
  const existing = [{ id: 1, hash: "a" }, { id: 2, hash: "x" }, { id: 3, hash: "a" }, { id: 4, hash: "b" }];
  const plan = planSheetSync(existing, wanted);
  assert.deepEqual(plan.remove.sort(), [2, 3]);
  assert.deepEqual(plan.add.map((c) => c.hash), ["c"]);
  assert.equal(plan.keep, 2);
  assert.deepEqual(planSheetSync([], [{ hash: "z" }, { hash: "z" }]).add.length, 1);
});

test("The same text hashes the same per character and type, different otherwise", () => {
  assert.equal(memoryHash("a", "event", "x"), memoryHash("a", "event", "x"));
  assert.notEqual(memoryHash("a", "event", "x"), memoryHash("b", "event", "x"));
  assert.notEqual(memoryHash("a", "event", "x"), memoryHash("a", SELF_SHEET_TYPE, "x"));
});

test("Keyword fallback ranks the overlapping text first and ignores the unrelated", () => {
  const query = "do you still swim in the lake";
  assert.ok(lexicalScore(query, "afraid of the lake and deep water") > lexicalScore(query, "loves boxing at the dojo"));
  assert.equal(lexicalScore(query, "loves boxing at the dojo"), 0);
  assert.equal(lexicalScore("", "anything"), 0);
});

test("Scoring prefers meaning, then importance and recency", () => {
  const base = { confidence: 1, ageDays: 0 };
  assert.ok(scoreMemory({ ...base, semantic: 0.9, importance: 10 }) > scoreMemory({ ...base, semantic: 0.5, importance: 100 }));
  assert.ok(scoreMemory({ ...base, semantic: 0.7, importance: 80 }) > scoreMemory({ ...base, semantic: 0.7, importance: 20 }));
  assert.ok(scoreMemory({ ...base, semantic: 0.7, importance: 50 }) > scoreMemory({ ...base, semantic: 0.7, importance: 50, ageDays: 400 }));
});

test("rankRows drops memories below the meaning threshold and wrong-sized vectors", () => {
  const row = (text, embedding) => ({ memory_text: text, embedding, importance: 50, confidence: 1, created_at: new Date() });
  const ranked = rankRows(
    [row("close", [0.9, 0.1, 0]), row("unrelated", [0, 1, 0]), row("wrong size", [1, 0])],
    { queryEmbedding: [1, 0, 0], topK: 5 },
  );
  assert.deepEqual(ranked.map((r) => r.row.memory_text), ["close"]);
  assert.ok(ranked[0].semantic >= MIN_SEMANTIC_SCORE);
});

/* ---------- the routes ---------- */

test("A character's own sheet is stored once; an unchanged sheet costs no embedding at all", async () => {
  const t = setup();
  try {
    const first = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: sheetChunks });
    assert.deepEqual([first.body.ok, first.body.added, first.body.kept, first.body.removed], [true, 2, 0, 0]);
    assert.equal(t.calls.embed, 2);
    const again = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: sheetChunks });
    assert.deepEqual([again.body.added, again.body.kept], [0, 2]);
    assert.equal(t.calls.embed, 2, "no new embedding for unchanged chunks");
    assert.ok(t.db.rows.every((r) => r.memory_type === SELF_SHEET_TYPE && r.knowledge_type === "self" && r.visibility === "private"));
  } finally { t.close(); }
});

test("Editing one part of a sheet replaces only that chunk", async () => {
  const t = setup();
  try {
    await t.post("/memory/sync-sheet", { characterId: "manon", chunks: sheetChunks });
    const edited = [sheetChunks[0], { ...sheetChunks[1], text: "Manon wants to open her own gym in Budapest." }];
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: edited });
    assert.deepEqual([result.body.added, result.body.removed, result.body.kept], [1, 1, 1]);
    assert.equal(t.calls.embed, 3);
    assert.deepEqual(t.db.rows.map((r) => r.memory_text).sort(), edited.map((c) => c.text).sort());
  } finally { t.close(); }
});

test("Recall brings back the relevant part of the sheet, and only for the character it belongs to", async () => {
  const t = setup();
  try {
    await t.post("/memory/sync-sheet", { characterId: "manon", chunks: sheetChunks });
    await t.post("/memory/sync-sheet", { characterId: "brent", chunks: [{ key: "secrets#0", text: "Brent secretly stole the lake house keys from his uncle.", importance: 80 }] });
    const recall = await t.post("/memory/recall", { characterIds: ["manon", "brent"], query: "she almost drowned in deep water in the lake" });
    assert.equal(recall.body.ok, true);
    assert.equal(recall.body.mode, "semantic");
    assert.match(recall.body.byCharacter.manon[0].text, /afraid of deep water/);
    assert.ok(recall.body.byCharacter.manon.every((m) => m.characterId === "manon"));
    assert.ok(recall.body.byCharacter.brent.every((m) => m.characterId === "brent"), "Brent never receives Manon's memories");
    assert.ok(!recall.body.byCharacter.brent.some((m) => /drowned/.test(m.text)));
    assert.equal(t.calls.embed, 3 + 1, "three sheet chunks + ONE query embedding for both characters");
  } finally { t.close(); }
});

test("Important events are remembered once, however often they are sent", async () => {
  const t = setup();
  try {
    const memories = [
      { characterId: "manon", text: "Brent kissed Manon at the dojo party.", importance: 85, subjectIds: ["brent"], metadata: { eventId: "se_1" } },
      { characterId: "brent", text: "Brent kissed Manon at the dojo party.", importance: 85, subjectIds: ["manon"], metadata: { eventId: "se_1" } },
    ];
    const first = await t.post("/memory/remember-batch", { memories });
    assert.deepEqual([first.body.ok, first.body.stored, first.body.skipped], [true, 2, 0]);
    const again = await t.post("/memory/remember-batch", { memories: [...memories, ...memories] });
    assert.deepEqual([again.body.stored, again.body.skipped], [0, 4]);
    assert.equal(t.db.rows.length, 2);
    assert.equal(t.db.rows[0].memory_type, "event");
    assert.equal(t.db.rows[0].metadata.eventId, "se_1");
  } finally { t.close(); }
});

test("With the free keys used up, writes wait, reads fall back to keywords, and the paid key is never called", async () => {
  const t = setup({ failFree: true });
  try {
    const sync = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: sheetChunks });
    assert.equal(sync.status, 200);
    assert.deepEqual([sync.body.ok, sync.body.waiting], [false, true]);
    assert.ok(sync.body.retryAfter >= 20);
    const remember = await t.post("/memory/remember-batch", { memories: [{ characterId: "manon", text: "Something important happened.", importance: 90 }] });
    assert.equal(remember.body.waiting, true);
    assert.ok(!t.calls.keys.includes("paid"), "paid key must stay untouched");

    /* seed rows directly, as if embedded earlier, then ask while no key is free */
    t.db.rows.push({ id: 99, world_code: "W1", character_id: "manon", memory_type: SELF_SHEET_TYPE, source: "sheet:backstory#0", memory_text: sheetChunks[0].text, importance: 70, confidence: 1, created_at: new Date(), embedding: fakeVector(sheetChunks[0].text), embedding_model: "emb", metadata: { hash: "h" } });
    const recall = await t.post("/memory/recall", { characterIds: ["manon"], query: "is she afraid of deep water in the lake?" });
    assert.deepEqual([recall.body.ok, recall.body.mode, recall.body.waiting], [true, "lexical", true]);
    assert.match(recall.body.byCharacter.manon[0].text, /afraid of deep water/);
    assert.ok(!t.calls.keys.includes("paid"));
  } finally { t.close(); }
});

test("Every memory route needs a session, and validates its input", async () => {
  const t = setup();
  try {
    assert.equal((await t.post("/memory/recall", { characterIds: [], query: "x" })).status, 400);
    assert.equal((await t.post("/memory/recall", { characterIds: ["a"], query: "" })).status, 400);
    assert.equal((await t.post("/memory/sync-sheet", { chunks: [] })).status, 400);
    t.logout();
    for (const path of ["/memory/sync-sheet", "/memory/remember-batch", "/memory/recall"]) {
      assert.equal((await t.post(path, { characterId: "a", characterIds: ["a"], query: "q", chunks: [], memories: [] })).status, 401, path);
    }
  } finally { t.close(); }
});

test("The embedder rests a rate-limited key and moves on to the next free key", async () => {
  const seen = [];
  const rest = new Map();
  const fetchFn = async (url, options) => {
    const key = options.headers["x-goog-api-key"]; seen.push(key);
    return key === "free1"
      ? { ok: false, status: 429, json: async () => ({ error: { message: "slow down" } }) }
      : { ok: true, status: 200, json: async () => ({ embedding: { values: [1, 0] } }) };
  };
  const embedder = createEmbedder({ freeKeys: ["free1", "free2"], paidKey: "paid", fetchFn, model: "m", dimensions: 2, restUntil: rest });
  assert.deepEqual(await embedder.embed("hello"), [1, 0]);
  assert.deepEqual(seen, ["free1", "free2"]);
  seen.length = 0;
  await embedder.embed("again");
  assert.deepEqual(seen, ["free2"], "free1 is resting now");
});

test("An invalid key (Google answers HTTP 400 'API key not valid') is rested for a day and the next free key is used", async () => {
  const seen = [];
  const rest = new Map();
  const fetchFn = async (url, options) => {
    const key = options.headers["x-goog-api-key"]; seen.push(key);
    return key === "bad"
      ? { ok: false, status: 400, json: async () => ({ error: { message: "API key not valid. Please pass a valid API key." } }) }
      : { ok: true, status: 200, json: async () => ({ embedding: { values: [0, 1] } }) };
  };
  const embedder = createEmbedder({ freeKeys: ["bad", "good"], paidKey: "paid", fetchFn, model: "m", dimensions: 2, restUntil: rest, now: () => 1000 });
  assert.deepEqual(await embedder.embed("hello"), [0, 1]);
  assert.deepEqual(seen, ["bad", "good"]);
  assert.ok(rest.get("bad") >= 1000 + 23 * 3600 * 1000);
  /* a real request error (not about the key) still stops at once */
  const strict = createEmbedder({ freeKeys: ["good"], fetchFn: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid JSON payload" } }) }), model: "m", dimensions: 2 });
  await assert.rejects(strict.embed("hello"), /Invalid JSON payload/);
});

const connectionsChunk = { key: "connections#0", text: "Manon: Brent is my old training partner and Rita is my rival from Iron Dragons.", importance: 75 };

test("The Connections part is synced first and alone; the rest of the sheet follows only when the character acts", async () => {
  const t = setup();
  try {
    const first = await t.post("/memory/sync-sheet", { characterId: "manon", scope: "connections", chunks: [connectionsChunk, ...sheetChunks] });
    assert.deepEqual([first.body.ok, first.body.scope, first.body.added], [true, "connections", 1], "chunks outside Connections are ignored in this scope");
    assert.equal(t.calls.embed, 1);

    const full = await t.post("/memory/sync-sheet", { characterId: "manon", scope: "all", chunks: [connectionsChunk, ...sheetChunks] });
    assert.deepEqual([full.body.added, full.body.kept], [2, 1]);
    assert.equal(t.calls.embed, 3, "Connections is not embedded a second time");
    assert.equal(t.db.rows.length, 3);
  } finally { t.close(); }
});

test("A later Connections-only sync never touches the rest of a character's stored sheet", async () => {
  const t = setup();
  try {
    await t.post("/memory/sync-sheet", { characterId: "manon", scope: "all", chunks: [connectionsChunk, ...sheetChunks] });
    const changed = { ...connectionsChunk, text: "Manon: Brent is now her coach and Rita is still her rival." };
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", scope: "connections", chunks: [changed] });
    assert.deepEqual([result.body.added, result.body.removed, result.body.kept], [1, 1, 0]);
    assert.equal(t.db.rows.length, 3);
    assert.ok(sheetChunks.every((c) => t.db.rows.some((r) => r.memory_text === c.text)), "the other parts of the sheet are still there");
    assert.ok(t.db.rows.some((r) => r.memory_text === changed.text) && !t.db.rows.some((r) => r.memory_text === connectionsChunk.text));
  } finally { t.close(); }
});

test("The embedder reads the quota window: a per-minute limit rests the key briefly, a per-day one until midnight Pacific", async () => {
  const detail = (quotaId, delay) => ({ error: { message: "You exceeded your current quota", details: [
    { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] },
    ...(delay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay }] : []),
  ] } });
  const now = Date.UTC(2026, 9, 3, 11, 18, 0);
  const attempt = async (payload) => {
    const rest = new Map();
    const embedder = createEmbedder({ freeKeys: ["k"], fetchFn: async () => ({ ok: false, status: 429, json: async () => payload }), model: "m", dimensions: 2, restUntil: rest, now: () => now });
    await assert.rejects(embedder.embed("hello"), (error) => error.waiting === true);
    return rest.get("k") - now;
  };
  assert.equal(await attempt(detail("EmbedContentRequestsPerMinutePerProjectPerModel-FreeTier", "20s")), 22000);
  assert.equal(await attempt(detail("EmbedContentRequestsPerDayPerProjectPerModel-FreeTier")), (19 * 3600 + 42 * 60 + 60) * 1000);
});

/* ---------- batches ---------- */

const manyChunks = (n) => Array.from({ length: n }, (_, i) => ({ key: "bio#" + i, text: "Chunk number " + i + " about Manon and her gym.", importance: 50 }));

test("A whole sheet is embedded in ONE request, not one request per chunk", async () => {
  const t = setup();
  try {
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(7) });
    assert.deepEqual([result.body.ok, result.body.added], [true, 7]);
    assert.equal(t.calls.http, 1, "one request for seven chunks");
    assert.equal(t.calls.batches, 1);
    assert.equal(t.calls.embed, 7);
    const sent = t.calls.bodies[0].body.requests;
    assert.equal(sent.length, 7);
    assert.equal(sent[0].model, "models/emb");
    assert.equal(sent[0].embedContentConfig.taskType, "RETRIEVAL_DOCUMENT");
    assert.match(sent[0].embedContentConfig.title, /sheet bio#0 of manon/);
  } finally { t.close(); }
});

test("A big sheet goes out in batches of twenty", async () => {
  const t = setup();
  try {
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(45) });
    assert.equal(result.body.added, 45);
    assert.equal(t.calls.http, 3, "20 + 20 + 5");
    assert.deepEqual(t.calls.bodies.map((b) => b.body.requests.length), [20, 20, 5]);
  } finally { t.close(); }
});

test("A single chunk and a single event use the plain request", async () => {
  const t = setup();
  try {
    await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(1) });
    assert.match(t.calls.bodies[0].url, /:embedContent$/);
  } finally { t.close(); }
});

test("Events are embedded together too", async () => {
  const t = setup();
  try {
    const memories = ["Manon won the regional final.", "Brent lied about the keys.", "Manon fell out with Brent."].map((text, i) => ({ characterId: i === 1 ? "brent" : "manon", text, importance: 60 }));
    const result = await t.post("/memory/remember-batch", { memories });
    assert.deepEqual([result.body.ok, result.body.stored], [true, 3]);
    assert.equal(t.calls.http, 1);
  } finally { t.close(); }
});

test("If Google rejects the batch form, single requests take over and the batch form is not tried again", async () => {
  const t = setup({ batch: () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Invalid JSON payload received. Unknown name \"embedContentConfig\"" } }) }) });
  try {
    const first = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(3) });
    assert.deepEqual([first.body.ok, first.body.added], [true, 3], "nothing is lost");
    assert.equal(t.calls.batches, 0);
    const batchAttempts = t.calls.bodies.filter((b) => /batchEmbedContents/.test(b.url)).length;
    assert.equal(batchAttempts, 1, "one rejected try");
    await t.post("/memory/sync-sheet", { characterId: "brent", chunks: manyChunks(3) });
    assert.equal(t.calls.bodies.filter((b) => /batchEmbedContents/.test(b.url)).length, 1, "not tried again");
  } finally { t.close(); }
});

test("A batch answer with the wrong number of vectors falls back to single requests", async () => {
  const t = setup({ batch: () => ({ ok: true, status: 200, json: async () => ({ embeddings: [{ values: [1, 0, 0] }] }) }) });
  try {
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(3) });
    assert.deepEqual([result.body.ok, result.body.added], [true, 3]);
    assert.ok(t.db.rows.every((row) => Array.isArray(row.embedding) && row.embedding.length === DIM));
  } finally { t.close(); }
});

test("A rate-limited key rests during a batch and the next free key carries it", async () => {
  const t = setup({ batch: (body) => null });
  const rest = new Map();
  const embedder = createEmbedder({
    freeKeys: ["a", "b"], restUntil: rest, model: "emb", dimensions: DIM, now: () => 5000,
    fetchFn: async (url, options) => (options.headers["x-goog-api-key"] === "a"
      ? { ok: false, status: 429, json: async () => ({ error: { message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "RequestsPerMinute" }] }] } }) }
      : { ok: true, status: 200, json: async () => ({ embeddings: JSON.parse(options.body).requests.map(() => ({ values: [1, 0, 0] })) }) }),
  });
  try {
    const vectors = await embedder.embedMany([{ text: "one" }, { text: "two" }]);
    assert.equal(vectors.length, 2);
    assert.ok(rest.get("a") > 5000, "the limited key rests");
    assert.equal(rest.get("b"), undefined);
  } finally { t.close(); }
});

test("With no free capacity a batch waits like a single request does", async () => {
  const t = setup({ failFree: true });
  try {
    const result = await t.post("/memory/sync-sheet", { characterId: "manon", chunks: manyChunks(3) });
    assert.equal(result.body.waiting, true);
    assert.equal(result.body.added, 0);
  } finally { t.close(); }
});
