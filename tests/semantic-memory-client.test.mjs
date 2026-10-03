import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  chunkText, ownSheetChunks, fieldImportance, chunksFingerprint, sheetSyncJobs, eventMemoryBatch, recallBlock, insertBeforeProtectedTail,
  runSheetSync, runEventFlush, recallMemories, clearRecallCache,
  SHEET_CHUNK_CHARS, MAX_CHUNKS_PER_SHEET, EVENT_MEMORY_MAX_AGE_MS, RECALL_BLOCK_CHARS,
} from "../src/semanticMemory.js";

const NOW = 50_000_000_000;

test("Chunks respect the size limit, keep paragraphs together and never come out empty", () => {
  const text = ["First paragraph about the dojo.", "Second paragraph about her mother.", "x".repeat(2000), "A sentence. ".repeat(200)].join("\n\n");
  const chunks = chunkText(text, 300);
  assert.ok(chunks.length > 5);
  for (const chunk of chunks) { assert.ok(chunk.length <= 300, "too long: " + chunk.length); assert.ok(chunk.trim()); }
  assert.ok(chunks[0].startsWith("First paragraph about the dojo. Second paragraph about her mother."), "short paragraphs share a chunk");
  assert.deepEqual(chunkText("", 300), []);
  assert.deepEqual(chunkText("  \n\n  ", 300), []);
});

test("A sheet becomes labelled chunks: short facts together, long fields split, albums skipped", () => {
  const fields = {
    name: "Manon Leroy", age: 24, album: [{ note: "photo" }], media: "x",
    backstory: ("She grew up by the lake and nearly drowned there. ".repeat(40)).trim(),
    secrets: "She still has the keys to the old lake house and has told nobody about them at all, ever, to anyone.",
  };
  const chunks = ownSheetChunks(fields);
  assert.equal(chunks[0].key, "profile#0");
  assert.match(chunks[0].text, /age: 24/);
  assert.match(chunks[0].text, /name: Manon Leroy/);
  assert.ok(chunks.some((c) => c.key === "secrets#0" && c.importance === 80 && c.text.startsWith("secrets: ")));
  const backstory = chunks.filter((c) => c.key.startsWith("backstory#"));
  assert.ok(backstory.length >= 2 && backstory.every((c) => c.text.length <= SHEET_CHUNK_CHARS + 12 && c.importance === fieldImportance("backstory")));
  assert.ok(!chunks.some((c) => /album|media/.test(c.key)));
});

test("A huge sheet keeps its most important chunks, in the original order", () => {
  const fields = { likes: "l ".repeat(40000), secrets: "s ".repeat(30000), backstory: "b ".repeat(40000) };
  const chunks = ownSheetChunks(fields);
  assert.equal(chunks.length, MAX_CHUNKS_PER_SHEET);
  assert.ok(chunks.some((c) => c.key.startsWith("secrets#")));
  const keys = chunks.map((c) => c.key);
  assert.deepEqual(keys, [...keys].sort((a, b) => ["backstory", "likes", "secrets"].indexOf(a.split("#")[0]) - ["backstory", "likes", "secrets"].indexOf(b.split("#")[0]) || Number(a.split("#")[1]) - Number(b.split("#")[1])));
});

test("Only sheets that changed since the last sync are sent", () => {
  const people = [{ id: "a", backstory: "x ".repeat(60) }, { id: "b", backstory: "y ".repeat(60) }];
  const fieldsOf = (c) => ({ backstory: c.backstory });
  const first = sheetSyncJobs(people, { fieldsOf, synced: {} });
  assert.deepEqual(first.map((j) => j.characterId), ["a", "b"]);
  const synced = Object.fromEntries(first.map((j) => [j.characterId, j.fingerprint]));
  assert.deepEqual(sheetSyncJobs(people, { fieldsOf, synced }), []);
  people[1].backstory += " new line about her father and the boxing club that matters.";
  assert.deepEqual(sheetSyncJobs(people, { fieldsOf, synced }).map((j) => j.characterId), ["b"]);
  assert.notEqual(chunksFingerprint(first[0].chunks), chunksFingerprint(first[1].chunks));
});

const world = (events) => ({ socialEvents: events, chars: ["manon", "brent"].map((id) => ({ id })), meId: "me" });
const helpers = { isHuman: (w, id) => id === w.meId, charById: (w, id) => w.chars.find((c) => c.id === id) || null, now: NOW };
const event = (extra) => ({ id: "se_" + Math.random(), type: "dm-message", ts: NOW - 1000, actorId: "manon", targetIds: ["me"], visibility: "private", factLevel: "observed", importance: 70, text: "Manon told the player she is scared of the lake.", ...extra });

test("Important events become one memory per AI character involved", () => {
  const e = event({ actorId: "manon", targetIds: ["brent", "me"] });
  const { items, eventIds } = eventMemoryBatch(world([e]), helpers);
  assert.deepEqual(items.map((i) => i.characterId).sort(), ["brent", "manon"]);
  assert.deepEqual(eventIds, [e.id]);
  const manon = items.find((i) => i.characterId === "manon");
  assert.equal(manon.knowledgeType, "did");
  assert.deepEqual(manon.subjectIds.sort(), ["brent", "me"]);
  assert.equal(items.find((i) => i.characterId === "brent").knowledgeType, "witnessed");
  assert.equal(manon.metadata.eventId, e.id);
});

test("Trivia, follows, system events, remembered and old events are not sent", () => {
  const skip = [
    event({ importance: 20 }), event({ type: "follow" }), event({ visibility: "system" }), event({ semMem: 1 }),
    event({ ts: NOW - EVENT_MEMORY_MAX_AGE_MS - 1 }), event({ text: "   " }),
  ];
  const result = eventMemoryBatch(world(skip), helpers);
  assert.deepEqual(result.items, []);
  const counted = skip.filter((e) => e.importance === 70 && e.type === "dm-message" && e.visibility === "private" && !e.semMem && e.text.trim() && NOW - e.ts <= EVENT_MEMORY_MAX_AGE_MS);
  assert.equal(counted.length, 0);
});

test("An important event with no AI character involved is only marked, not sent", () => {
  const e = event({ actorId: "me", targetIds: [] });
  const result = eventMemoryBatch(world([e]), helpers);
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.eventIds, [e.id]);
});

test("Rumours are remembered as assumed with lower confidence", () => {
  const { items } = eventMemoryBatch(world([event({ factLevel: "speculation", actorId: "brent", targetIds: [] })]), helpers);
  assert.equal(items[0].knowledgeType, "assumed");
  assert.equal(items[0].confidence, 0.5);
});

test("A batch never exceeds the item limit; the events left over wait for the next round", () => {
  const events = Array.from({ length: 30 }, () => event({ actorId: "manon", targetIds: ["brent"] }));
  const { items, eventIds } = eventMemoryBatch(world(events), { ...helpers, maxItems: 10 });
  assert.equal(items.length, 10);
  assert.equal(eventIds.length, 5);
});

test("The recall block gives each character their own private section and respects the size cap", () => {
  const by = {
    manon: [{ memoryType: "self_sheet", text: "backstory: afraid of deep water" }, { memoryType: "event", text: "Brent kissed her", createdAt: new Date(NOW - 5 * 3600000).toISOString() }],
    brent: [{ memoryType: "self_sheet", text: "secrets: stole the keys" }],
    rita: [],
  };
  const block = recallBlock(by, (id) => id.toUpperCase(), { now: NOW, language: "en" });
  assert.match(block, /OWNERSHIP — HARD RULE/);
  assert.match(block, /\[MANON — private memory\]\n- \(own sheet\) backstory: afraid of deep water\n- \(event · 5 h ago\) Brent kissed her/);
  assert.match(block, /\[BRENT — private memory\]/);
  assert.ok(!block.includes("RITA"));
  assert.equal(recallBlock({}, (id) => id), "");
  assert.equal(recallBlock(null, (id) => id), "");
  const huge = { manon: Array.from({ length: 50 }, (_, i) => ({ memoryType: "event", text: "m".repeat(400) + i })) };
  assert.ok(recallBlock(huge, (id) => id).length < RECALL_BLOCK_CHARS + 900);
  assert.match(recallBlock(by, (id) => id, { now: NOW, language: "hu" }), /KEMÉNY SZABÁLY/);
});

test("The memory block goes before the protected tail, which stays last", () => {
  assert.equal(insertBeforeProtectedTail("body", ""), "body");
  assert.equal(insertBeforeProtectedTail("body", "MEM"), "body\n\nMEM");
  const out = insertBeforeProtectedTail("body\n[[PROTECTED_TAIL]]\nlatest", "MEM");
  assert.ok(out.indexOf("MEM") < out.indexOf("[[PROTECTED_TAIL]]") && out.endsWith("latest"));
  const dm = insertBeforeProtectedTail("body\n[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]\nx", "MEM");
  assert.ok(dm.indexOf("MEM") < dm.indexOf("[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]"));
});

test("Sheet sync stops on 'no free capacity' and reports every finished sheet", async () => {
  const jobs = [{ characterId: "a", chunks: [], fingerprint: "1" }, { characterId: "b", chunks: [], fingerprint: "2" }, { characterId: "c", chunks: [], fingerprint: "3" }];
  const done = [];
  const answers = [{ ok: true }, { ok: false, waiting: true, retryAfter: 75 }];
  const result = await runSheetSync(jobs, async () => answers.shift(), (job) => done.push(job.characterId));
  assert.deepEqual(result, { waiting: true, retryAfter: 75 });
  assert.deepEqual(done, ["a"]);
  const failed = await runSheetSync(jobs, async () => { throw new Error("offline"); });
  assert.equal(failed.failed, true);
  assert.deepEqual(await runSheetSync([], async () => { throw new Error("never"); }), { ok: true });
});

test("Event flush marks events only when the server stored them", async () => {
  const batch = { items: [{ characterId: "a", text: "x" }], eventIds: ["e1", "e2"] };
  assert.deepEqual((await runEventFlush(batch, async () => ({ ok: true }))).marked, ["e1", "e2"]);
  assert.equal((await runEventFlush(batch, async () => ({ ok: false, waiting: true, retryAfter: 30 }))).waiting, true);
  assert.equal((await runEventFlush(batch, async () => { throw new Error("x"); })).failed, true);
  assert.deepEqual((await runEventFlush({ items: [], eventIds: ["e3"] }, async () => { throw new Error("no call needed"); })).marked, ["e3"]);
  assert.equal((await runEventFlush({ items: [], eventIds: [] }, async () => {})).nothing, true);
});

test("Recall is cached for meaning-based answers only, and never throws", async () => {
  clearRecallCache();
  let calls = 0;
  const semantic = async () => { calls += 1; return { ok: true, mode: "semantic", byCharacter: { a: [{ text: "x" }] } }; };
  assert.deepEqual(await recallMemories(semantic, ["a"], "the lake"), { a: [{ text: "x" }] });
  await recallMemories(semantic, ["a"], "the lake");
  assert.equal(calls, 1, "second identical question is served from the cache");
  let lexicalCalls = 0;
  const lexical = async () => { lexicalCalls += 1; return { ok: true, mode: "lexical", waiting: true, byCharacter: { b: [] } }; };
  await recallMemories(lexical, ["b"], "other question");
  await recallMemories(lexical, ["b"], "other question");
  assert.equal(lexicalCalls, 2, "keyword-only answers are asked again next time");
  assert.equal(await recallMemories(semantic, [], "x"), null);
  assert.equal(await recallMemories(semantic, ["a"], ""), null);
});

test("Recall that keeps failing is switched off for a while instead of slowing every reply", async () => {
  clearRecallCache();
  let calls = 0;
  const broken = async () => { calls += 1; throw new Error("down"); };
  for (let i = 0; i < 3; i += 1) assert.equal(await recallMemories(broken, ["a"], "q" + i), null);
  assert.equal(calls, 3);
  assert.equal(await recallMemories(broken, ["a"], "q-after"), null);
  assert.equal(calls, 3, "paused: no further calls");
  clearRecallCache();
  const slow = () => new Promise(() => {});
  assert.equal(await recallMemories(slow, ["a"], "slow", { timeoutMs: 20 }), null);
  clearRecallCache();
});

test("App wiring: recall before player-facing replies, own-sheet sync and event flush by world changes", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const \{ memory, \.\.\.askOptions \} = options;/);
  assert.match(source, /insertBeforeProtectedTail\(prompt, memoryBlock\) \+ bondGenerationContext\(w\)/);
  assert.match(source, /if \(charId && latestText\) forward\.memory = \{ ids: \[charId\], query: latestText \};/);
  assert.match(source, /memory: \{ ids: groupAiIds\.slice\(0, 4\)/);
  assert.match(source, /memory: \{ ids: \(scene\.cast \|\| \[\]\)\.filter\(\(id\) => !isHuman\(w, id\)\)\.slice\(0, 4\)/);
  assert.match(source, /sheetSyncJobs\(w\.chars,/);
  assert.match(source, /eventMemoryBatch\(wRef\.current, \{ isHuman, charById \}\)/);
  assert.match(source, /e\.semMem = 1/);
  assert.match(source, /st\.timer = setTimeout\(runMemorySync, 20000\)/);
  const proxy = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  assert.match(proxy, /memory_type <> 'self_sheet'/, "a restart must not wipe the characters' own-sheet memory");
  assert.match(proxy, /registerSemanticMemory\(app,/);
});
