/*
 * MÁSVILÁG SEMANTIC MEMORY — client side
 *
 * Feeds the server's semantic memory and reads it back:
 *  - each character's OWN SHEET, cut into chunks (synced only when the sheet changed);
 *  - the important events that happened to them (sent once, in batches);
 *  - recall: for a conversation, the memories of the people in it that match what is being said.
 *
 * All of it is decided in code; no AI is asked what to remember. A failure or a "no free
 * capacity" answer never blocks the game: writes retry later, recall just returns nothing.
 */

export const SHEET_CHUNK_CHARS = 900;
export const MAX_CHUNKS_PER_SHEET = 60;
export const EVENT_MEMORY_MIN_IMPORTANCE = 45;
export const EVENT_MEMORY_MAX_AGE_MS = 3 * 24 * 3600 * 1000;
export const EVENT_BATCH_ITEMS = 24;
export const RECALL_TIMEOUT_MS = 2500;
export const RECALL_CACHE_MS = 60 * 1000;
export const RECALL_BLOCK_CHARS = 3600;

const SKIPPED_FIELDS = new Set(["album", "albums", "images", "photos", "media", "brief", "briefSrc", "profile", "profileHash", "sheetHash"]);
const IMPORTANCE_BY_FIELD = {
  secrets: 80, connections: 75, goals: 75, fears: 75, personality: 70, speech: 65, voice: 65, traits: 65,
  backstory: 60, likes: 50, extra: 50,
};
const SHORT_FIELD_CHARS = 80;
const clip = (value, max) => String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);

export const fieldImportance = (field) => IMPORTANCE_BY_FIELD[String(field).toLowerCase()] || 45;

/* Paragraphs first, then sentences, then words: a chunk never ends mid-sentence if it can help it. */
export function chunkText(text, max = SHEET_CHUNK_CHARS) {
  const paragraphs = String(text || "").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const pieces = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= max) { pieces.push(paragraph); continue; }
    for (const sentence of paragraph.split(/(?<=[.!?…])\s+/)) {
      if (sentence.length <= max) { pieces.push(sentence); continue; }
      let line = "";
      for (const word of sentence.split(" ")) {
        if (word.length > max) { if (line) pieces.push(line); line = ""; for (let i = 0; i < word.length; i += max) pieces.push(word.slice(i, i + max)); continue; }
        if ((line + " " + word).trim().length > max) { pieces.push(line); line = word; } else line = (line + " " + word).trim();
      }
      if (line) pieces.push(line);
    }
  }
  const chunks = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && (last + " " + piece).length <= max) chunks[chunks.length - 1] = last + " " + piece;
    else chunks.push(piece);
  }
  return chunks;
}

export const CONNECTIONS_FIELD = "connections";

/* fields: { name: value }, flatten(value) -> plain text. Returns [{ key, text, importance }].
   scope "connections": only the Connections field (a few thousand characters, read for everyone);
   scope "all": the whole sheet (read only for a character that is acting). */
export function ownSheetChunks(fields, flatten = (value) => String(value == null ? "" : value), { scope = "all" } = {}) {
  const chunks = [];
  const shortLines = [];
  for (const field of Object.keys(fields || {}).sort()) {
    if (SKIPPED_FIELDS.has(field)) continue;
    if (scope === "connections" && field !== CONNECTIONS_FIELD) continue;
    const text = String(flatten(fields[field]) || "").trim();
    if (!text) continue;
    if (text.length < SHORT_FIELD_CHARS) { shortLines.push(`${field}: ${text.replace(/\s+/g, " ")}`); continue; }
    chunkText(text).forEach((piece, index) => chunks.push({ key: `${field}#${index}`, text: `${field}: ${piece}`, importance: fieldImportance(field) }));
  }
  if (shortLines.length) chunks.unshift({ key: "profile#0", text: shortLines.join("; "), importance: 55 });
  if (chunks.length <= MAX_CHUNKS_PER_SHEET) return chunks;
  /* Too long a sheet: keep the most important chunks, in their original order. */
  const keep = new Set(chunks.map((chunk, index) => ({ index, importance: chunk.importance })).sort((a, b) => b.importance - a.importance || a.index - b.index).slice(0, MAX_CHUNKS_PER_SHEET).map((x) => x.index));
  return chunks.filter((_, index) => keep.has(index));
}

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash.toString(16).padStart(8, "0");
}

export const chunksFingerprint = (chunks) => `${chunks.length}:${fnv1a(chunks.map((chunk) => chunk.key + "\u0000" + chunk.text).join("\u0001"))}`;

/* Sheets whose chunks differ from what the server was last given.
   state: { [characterId]: { connections: fingerprint, full: fingerprint } }. */
export function sheetSyncJobs(characters, { fieldsOf, flatten, state = {}, scope = "all" }) {
  const jobs = [];
  for (const character of characters || []) {
    if (!character || !character.id) continue;
    const fields = fieldsOf(character);
    const connectionsFingerprint = chunksFingerprint(ownSheetChunks(fields, flatten, { scope: "connections" }));
    const known = state[character.id] || {};
    if (scope === "connections") {
      if (known.connections === connectionsFingerprint) continue;
      jobs.push({ characterId: String(character.id), scope, chunks: ownSheetChunks(fields, flatten, { scope }), fingerprint: connectionsFingerprint, connectionsFingerprint });
      continue;
    }
    const chunks = ownSheetChunks(fields, flatten, { scope: "all" });
    const fingerprint = chunksFingerprint(chunks);
    if (known.full !== fingerprint) jobs.push({ characterId: String(character.id), scope: "all", chunks, fingerprint, connectionsFingerprint });
  }
  return jobs;
}

/* A finished job: remember what the server now holds. A full sync includes the Connections part. */
export function markSheetSynced(state, job) {
  const entry = state[job.characterId] || (state[job.characterId] = {});
  entry.connections = job.connectionsFingerprint;
  if (job.scope === "all") entry.full = job.fingerprint;
}

/* AI characters that acted lately (posted, commented, wrote a DM, played a scene): newest first. */
export function recentActorIds(world, { isHuman, charById, now = Date.now(), windowMs = 30 * 60 * 1000, limit = 6 }) {
  const ids = [];
  for (const event of (world && Array.isArray(world.socialEvents) ? world.socialEvents : [])) {
    if (!event || !event.actorId) continue;
    if (now - (Number(event.ts) || 0) > windowMs) continue;
    if (/^(?:follow|unfollow|character-arrival)$/i.test(String(event.type || ""))) continue;
    const id = String(event.actorId);
    if (isHuman(world, id) || !charById(world, id) || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
}

/* Important events not yet remembered. Newest first; one memory per AI character involved. */
export function eventMemoryBatch(world, { isHuman, charById, now = Date.now(), minImportance = EVENT_MEMORY_MIN_IMPORTANCE, maxItems = EVENT_BATCH_ITEMS }) {
  const items = [];
  const eventIds = [];
  for (const event of (world && Array.isArray(world.socialEvents) ? world.socialEvents : [])) {
    if (!event || !event.id || event.semMem) continue;
    if (now - (Number(event.ts) || 0) > EVENT_MEMORY_MAX_AGE_MS) continue;
    const text = clip(event.text, 450);
    const type = String(event.type || "");
    const wanted = text && Number(event.importance) >= minImportance && event.visibility !== "system" && !/^(?:follow|unfollow)$/i.test(type);
    const participants = [...new Set([event.actorId, ...(event.targetIds || []), ...((event.meta && event.meta.participantIds) || [])].map((id) => String(id || "")).filter(Boolean))];
    const owners = wanted ? participants.filter((id) => !isHuman(world, id) && charById(world, id)) : [];
    if (items.length + owners.length > maxItems) break;
    for (const ownerId of owners) {
      items.push({
        characterId: ownerId,
        text,
        memoryType: "event",
        source: type || "event",
        knowledgeType: event.factLevel === "speculation" ? "assumed" : ownerId === String(event.actorId || "") ? "did" : "witnessed",
        visibility: "private",
        subjectIds: participants.filter((id) => id !== ownerId),
        importance: Math.round(Number(event.importance)),
        confidence: event.factLevel === "speculation" ? 0.5 : 1,
        metadata: { eventId: event.id, type, ts: Number(event.ts) || 0 },
      });
    }
    eventIds.push(event.id);
  }
  return { items, eventIds };
}

const ageLabel = (createdAt, now) => {
  const ms = now - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const hours = Math.floor(ms / 3600000);
  return hours < 1 ? "just now" : hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`;
};

/* The prompt block. Each block belongs to ONE character; nobody else may use it. */
export function recallBlock(byCharacter, nameOf, { now = Date.now(), language = "hu" } = {}) {
  const en = language === "en";
  const sections = [];
  let used = 0;
  for (const [characterId, memories] of Object.entries(byCharacter || {})) {
    const lines = [];
    for (const memory of memories || []) {
      const label = memory.memoryType === "self_sheet" ? (en ? "own sheet" : "saját lap") : `${en ? "event" : "esemény"}${memory.createdAt ? " · " + ageLabel(memory.createdAt, now) : ""}`;
      const line = `- (${label}) ${clip(memory.text, 500)}`;
      if (used + line.length > RECALL_BLOCK_CHARS) break;
      used += line.length;
      lines.push(line);
    }
    if (lines.length) sections.push(`[${nameOf(characterId)} — ${en ? "private memory" : "privát emlék"}]\n${lines.join("\n")}`);
  }
  if (!sections.length) return "";
  return (en
    ? "SEMANTIC MEMORY — WHAT EACH CHARACTER REMEMBERS THAT MATTERS RIGHT NOW (retrieved by meaning for this exact moment).\nOWNERSHIP — HARD RULE: each block is the PRIVATE memory of ONE character. Only that character knows it and may act on it; never let anyone else use it, and never invent details beyond it. Own-sheet lines are that character's own canon.\n"
    : "SZEMANTIKUS MEMÓRIA — AMIRE AZ EGYES KARAKTEREK EMLÉKEZNEK, ÉS MOST SZÁMÍT (jelentés alapján előkeresve erre a pillanatra).\nTULAJDONJOG — KEMÉNY SZABÁLY: minden blokk EGY karakter PRIVÁT emléke. Csak ő tudja és csak ő élhet vele; más soha ne használja, és ne találj ki hozzá részleteket. A saját lap sorai az illető saját kánonja.\n")
    + sections.join("\n\n");
}

/* Where to put a block so the protected tail of a prompt stays last. */
export function insertBeforeProtectedTail(prompt, block) {
  if (!block) return prompt;
  const text = String(prompt || "");
  const markers = ["[[PROTECTED_TAIL]]", "[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]"];
  const at = Math.max(...markers.map((marker) => text.lastIndexOf(marker)));
  return at < 0 ? `${text}\n\n${block}` : `${text.slice(0, at)}${block}\n\n${text.slice(at)}`;
}

/* ---------- talking to the server ---------- */

export async function runSheetSync(jobs, api, onDone = () => {}) {
  for (const job of jobs) {
    let result;
    try {
      result = await api("/memory/sync-sheet", { method: "POST", body: JSON.stringify({ characterId: job.characterId, chunks: job.chunks, scope: job.scope || "all" }) });
    } catch (error) {
      return { failed: true, error };
    }
    if (result && result.ok) { onDone(job); continue; }
    if (result && result.waiting) return { waiting: true, retryAfter: Number(result.retryAfter) || 60 };
    return { failed: true };
  }
  return { ok: true };
}

export async function runEventFlush(batch, api) {
  if (!batch.eventIds.length) return { ok: true, nothing: true };
  if (!batch.items.length) return { ok: true, marked: batch.eventIds };
  let result;
  try {
    result = await api("/memory/remember-batch", { method: "POST", body: JSON.stringify({ memories: batch.items }) });
  } catch (error) {
    return { failed: true, error };
  }
  if (result && result.ok) return { ok: true, marked: batch.eventIds };
  if (result && result.waiting) return { waiting: true, retryAfter: Number(result.retryAfter) || 60 };
  return { failed: true };
}

const recallCache = new Map();
let recallFailures = 0;
let recallSkipUntil = 0;
const RECALL_FAILURES_BEFORE_PAUSE = 3;
const RECALL_PAUSE_MS = 2 * 60 * 1000;

/* Memories of the characters in a conversation; null when none (never throws, never waits long). */
export async function recallMemories(api, characterIds, query, { now = () => Date.now(), timeoutMs = RECALL_TIMEOUT_MS, topK = 4 } = {}) {
  const ids = [...new Set((characterIds || []).map((id) => String(id || "")).filter(Boolean))].slice(0, 4);
  const text = clip(query, 1500);
  if (!ids.length || !text) return null;
  const key = ids.join(",") + "|" + fnv1a(text);
  const hit = recallCache.get(key);
  if (hit && now() - hit.at < RECALL_CACHE_MS) return hit.value;
  /* The server answers slowly or not at all: leave memory out for a while instead of slowing every reply. */
  if (now() < recallSkipUntil) return null;
  let timer;
  try {
    const result = await Promise.race([
      api("/memory/recall", { method: "POST", body: JSON.stringify({ characterIds: ids, query: text, topK }) }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("recall timeout")), timeoutMs); }),
    ]);
    const value = result && result.ok && result.byCharacter ? result.byCharacter : null;
    recallFailures = 0;
    /* A keyword-only answer (no free embedding right now) is not cached: ask again next time. */
    if (value && result.mode === "semantic") recallCache.set(key, { at: now(), value });
    return value;
  } catch (error) {
    recallFailures += 1;
    if (recallFailures >= RECALL_FAILURES_BEFORE_PAUSE) { recallSkipUntil = now() + RECALL_PAUSE_MS; recallFailures = 0; }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const clearRecallCache = () => { recallCache.clear(); recallFailures = 0; recallSkipUntil = 0; };
