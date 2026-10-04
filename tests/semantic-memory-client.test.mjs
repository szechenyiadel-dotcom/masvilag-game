import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  memoryQueryFromEvents, RECALL_MAX_CHARACTERS, BACKGROUND_RECALL_TOP_K,
  chunkText, ownSheetChunks, fieldImportance, chunksFingerprint, sheetSyncJobs, markSheetSynced, recentActorIds, eventMemoryBatch, recallBlock, insertBeforeProtectedTail,
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

test("The first sync reads only the Connections part of each sheet", () => {
  const fields = { name: "Manon", backstory: "b ".repeat(5000), secrets: "s ".repeat(3000), connections: "Brent is my old training partner. ".repeat(60) };
  const chunks = ownSheetChunks(fields, undefined, { scope: "connections" });
  assert.ok(chunks.length >= 1 && chunks.every((c) => c.key.startsWith("connections#") && c.text.startsWith("connections: ")));
  assert.ok(chunks.map((c) => c.text).join(" ").length < 3000, "a few thousand characters, not the whole sheet");
  assert.deepEqual(ownSheetChunks({ backstory: "b ".repeat(500) }, undefined, { scope: "connections" }), [], "no Connections, nothing to read");
  const all = ownSheetChunks(fields, undefined, { scope: "all" });
  assert.ok(chunks.every((c) => all.some((a) => a.key === c.key && a.text === c.text)), "the full sheet contains the very same Connections chunks");
});

test("Connections are synced for everyone once; the whole sheet only on request, and only what changed", () => {
  const people = [
    { id: "a", backstory: "x ".repeat(60), connections: "Brent is a friend of mine and a rival of Rita. ".repeat(3) },
    { id: "b", backstory: "y ".repeat(60), connections: "Manon is my coach and I trust her. ".repeat(3) },
  ];
  const fieldsOf = (c) => ({ backstory: c.backstory, connections: c.connections });
  const state = {};
  const first = sheetSyncJobs(people, { fieldsOf, state, scope: "connections" });
  assert.deepEqual(first.map((j) => [j.characterId, j.scope]), [["a", "connections"], ["b", "connections"]]);
  assert.ok(first.every((j) => j.chunks.every((c) => c.key.startsWith("connections#"))));
  first.forEach((job) => markSheetSynced(state, job));
  assert.deepEqual(sheetSyncJobs(people, { fieldsOf, state, scope: "connections" }), [], "nothing new");

  /* Only the acting character's whole sheet is read, and it includes the Connections part. */
  const acting = sheetSyncJobs([people[0]], { fieldsOf, state, scope: "all" });
  assert.equal(acting.length, 1);
  assert.ok(acting[0].chunks.some((c) => c.key.startsWith("backstory#")) && acting[0].chunks.some((c) => c.key.startsWith("connections#")));
  markSheetSynced(state, acting[0]);
  assert.deepEqual(sheetSyncJobs([people[0]], { fieldsOf, state, scope: "all" }), []);
  assert.equal(state.b.full, undefined, "the other character's whole sheet was never read");

  /* Editing the backstory matters for the whole sheet but not for the Connections-only sync. */
  people[0].backstory += " Something new about her father and the boxing club that matters a lot.";
  assert.deepEqual(sheetSyncJobs(people, { fieldsOf, state, scope: "connections" }), []);
  assert.equal(sheetSyncJobs([people[0]], { fieldsOf, state, scope: "all" }).length, 1);
  /* Editing Connections is caught by both. */
  people[1].connections += " Brent is her boyfriend now.";
  assert.deepEqual(sheetSyncJobs(people, { fieldsOf, state, scope: "connections" }).map((j) => j.characterId), ["b"]);
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

test("Characters that acted lately are the ones whose whole sheet is read", () => {
  const w = { meId: "me", chars: ["manon", "brent", "rita"].map((id) => ({ id })), socialEvents: [
    { actorId: "me", ts: NOW - 1000, type: "post" },
    { actorId: "manon", ts: NOW - 2000, type: "comment" },
    { actorId: "rita", ts: NOW - 3000, type: "follow" },
    { actorId: "brent", ts: NOW - 4000, type: "dm-message" },
    { actorId: "manon", ts: NOW - 5000, type: "post" },
    { actorId: "ghost", ts: NOW - 6000, type: "post" },
    { actorId: "rita", ts: NOW - 31 * 60 * 1000, type: "post" },
  ] };
  assert.deepEqual(recentActorIds(w, { ...helpers }), ["manon", "brent"]);
  assert.deepEqual(recentActorIds(w, { ...helpers, limit: 1 }), ["manon"]);
  assert.deepEqual(recentActorIds({ socialEvents: [] }, helpers), []);
});

test("App wiring: recall before player-facing replies, own-sheet sync and event flush by world changes", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const \{ memory, \.\.\.askOptions \} = options;/);
  assert.match(source, /insertBeforeProtectedTail\(prompt, \[memoryBlock, bondContextFor\(w, memory, prompt\)\]\.filter\(Boolean\)\.join\("\\n"\)\)/, "the bond context goes before the protected tail, scoped to the characters the call is about");
  assert.match(source, /if \(charId && latestText\) forward\.memory = \{ ids: \[charId\], query: latestText \};/);
  assert.match(source, /memory: \{ ids: groupAiIds\.slice\(0, 4\)/);
  assert.match(source, /memory: \{ ids: \(scene\.cast \|\| \[\]\)\.filter\(\(id\) => !isHuman\(w, id\)\)\.slice\(0, 4\)/);
  assert.match(source, /syncSheetMemory\(w, w\.chars, "connections"\)/, "everyone: Connections only");
  assert.match(source, /recentActorIds\(wRef\.current, \{ isHuman, charById \}\)/, "whole sheet: only characters that acted lately");
  assert.match(source, /syncSheetMemory\(wRef\.current, acted, "all"\)/);
  assert.match(source, /await ensureActingSheetMemory\(w, memory\.ids\);\s*const byCharacter = await recallMemories/, "characters in a player-facing exchange are read first");
  assert.ok(!source.includes("sim.semanticMemory"), "no world-state bookkeeping for the memory sync");
  assert.match(source, /eventMemoryBatch\(wRef\.current, \{ isHuman, charById \}\)/);
  assert.match(source, /e\.semMem = 1/);
  assert.match(source, /st\.timer = setTimeout\(runMemorySync, 20000\)/);
  const proxy = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  assert.match(proxy, /memory_type <> 'self_sheet'/, "a restart must not wipe the characters' own-sheet memory");
  assert.match(proxy, /registerSemanticMemory\(app,/);
});

/* The real sync functions of App.jsx, run against a fake server. */
import vm from "node:vm";
import { createRequire as createRequireForApp } from "node:module";
import { sheetSyncJobs as realSheetSyncJobs, markSheetSynced as realMarkSheetSynced, runSheetSync as realRunSheetSync } from "../src/semanticMemory.js";
const requireApp = createRequireForApp(import.meta.url);
const { parse: parseApp } = requireApp("@babel/parser");
const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const appAst = parseApp(appSource, { sourceType: "module", plugins: ["jsx"] });
const pickApp = (names) => appAst.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => appSource.substring(node.start, node.end)).join("\n");

function syncHarness() {
  const requests = [];
  const people = {
    manon: { id: "manon", backstory: "Grew up by the lake. ".repeat(80), connections: "Brent is my training partner. ".repeat(10) },
    brent: { id: "brent", backstory: "Works nights at the gym. ".repeat(80), connections: "Manon is my coach. ".repeat(10) },
  };
  const context = vm.createContext({
    sheetSyncJobs: realSheetSyncJobs, markSheetSynced: realMarkSheetSynced, runSheetSync: realRunSheetSync, RECALL_MAX_CHARACTERS,
    sheetFields: (c) => ({ backstory: c.backstory, connections: c.connections }),
    flattenSheetValue: (v) => String(v),
    apiJson: async (path, options) => {
      const body = JSON.parse(options.body);
      requests.push({ path, scope: body.scope, characterId: body.characterId, chars: body.chunks.reduce((n, c) => n + c.text.length, 0) });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true };
    },
    charById: (w, id) => people[id] || null,
    isHuman: (w, id) => id === "me",
    setTimeout, Promise, Map, Set, String, Array, Object, JSON,
  });
  vm.runInContext(pickApp(["SEMANTIC_SYNC", "semanticSyncState", "memorySheetText", "syncSheetMemory", "ensureActingSheetMemory"]), context);
  return { context, requests, w: { code: "W", chars: Object.values(people) } };
}

test("App: everyone gets only their Connections read; a character's whole sheet is read when it acts, once", async () => {
  const { context, requests, w } = syncHarness();
  await context.syncSheetMemory(w, w.chars, "connections");
  assert.deepEqual(requests.map((r) => [r.characterId, r.scope]), [["manon", "connections"], ["brent", "connections"]]);
  assert.ok(requests.every((r) => r.chars < 3500), "a few thousand characters per sheet, not the backstory");

  requests.length = 0;
  await context.ensureActingSheetMemory(w, ["manon", "me"]);
  assert.deepEqual(requests.map((r) => [r.characterId, r.scope]), [["manon", "all"]], "only the acting character, never the player or the bystander");
  assert.ok(requests[0].chars > 1500, "the rest of the sheet is read now");

  requests.length = 0;
  await context.ensureActingSheetMemory(w, ["manon"]);
  await context.syncSheetMemory(w, w.chars, "connections");
  assert.deepEqual(requests, [], "nothing changed, nothing sent");
});

test("App: two exchanges asking for the same character at once cause one sync", async () => {
  const { context, requests, w } = syncHarness();
  await Promise.all([context.ensureActingSheetMemory(w, ["brent"]), context.ensureActingSheetMemory(w, ["brent"])]);
  assert.equal(requests.filter((r) => r.characterId === "brent" && r.scope === "all").length, 1);
});

test("The recall query for the world's own actions is what is going on around the acting characters", () => {
  const w = { socialEvents: [
    { actorId: "rita", targetIds: ["paul"], type: "comment", text: "Rita and Paul argued about the tournament." },
    { actorId: "manon", targetIds: [], type: "post", text: "Manon posted about the lake trip." },
    { actorId: "manon", targetIds: ["brent"], type: "follow", text: "Manon followed Brent" },
    { actorId: "ann", targetIds: ["manon"], type: "comment", text: "Ann asked Manon about the dojo.", visibility: "public" },
    { actorId: "manon", targetIds: [], type: "dm-message", text: "secret system note", visibility: "system" },
  ] };
  const query = memoryQueryFromEvents(w, ["manon", "brent"]);
  assert.match(query, /Manon posted about the lake trip/);
  assert.match(query, /Ann asked Manon about the dojo/);
  assert.ok(!/argued|followed|system note/.test(query), "uninvolved, follow and system events stay out");
  assert.equal(memoryQueryFromEvents(w, ["nobody"]), "");
  assert.equal(memoryQueryFromEvents(w, []), "");
  assert.equal(memoryQueryFromEvents({ socialEvents: [] }, ["manon"]), "");
  assert.ok(memoryQueryFromEvents({ socialEvents: Array.from({ length: 40 }, () => ({ actorId: "manon", text: "x".repeat(500), type: "post" })) }, ["manon"]).length <= 1200);
});

test("The recall block shares its budget fairly: seven characters all get a section", () => {
  const long = (n) => Array.from({ length: n }, (_, i) => ({ memoryType: "event", text: "memory " + "w".repeat(380) + i }));
  const by = Object.fromEntries(["a", "b", "c", "d", "e", "f", "g"].map((id) => [id, long(5)]));
  const block = recallBlock(by, (id) => id.toUpperCase(), { language: "en" });
  for (const id of ["A", "B", "C", "D", "E", "F", "G"]) assert.match(block, new RegExp(`\\[${id} — private memory\\]`));
  assert.ok(block.length < RECALL_BLOCK_CHARS + 1200);
  assert.equal(RECALL_MAX_CHARACTERS, 7);
  assert.ok(BACKGROUND_RECALL_TOP_K <= 3);
});

/* The real helpers of App.jsx for the world's own actions. */
function backgroundHarness(events) {
  const people = Object.fromEntries(["manon", "brent", "rita"].map((id) => [id, { id }]));
  const context = vm.createContext({
    memoryQueryFromEvents, RECALL_MAX_CHARACTERS, BACKGROUND_RECALL_TOP_K,
    isHuman: (w, id) => id === w.meId,
    charById: (w, id) => people[id] || null,
    String, Array, Set,
  });
  vm.runInContext(pickApp(["backgroundMemory"]), context);
  return { context, w: { meId: "me", socialEvents: events } };
}

test("App: the world's own actions recall for the acting AI characters only", () => {
  const { context, w } = backgroundHarness([{ actorId: "manon", targetIds: ["brent"], type: "comment", text: "Manon challenged Brent to a sparring match." }]);
  const memory = context.backgroundMemory(w, ["manon", "me", "brent", "ghost", "manon", ""]);
  assert.deepEqual(Array.from(memory.ids), ["manon", "brent"], "no player, no unknown, no duplicates");
  assert.match(memory.query, /sparring match/);
  assert.equal(memory.topK, BACKGROUND_RECALL_TOP_K);
  assert.match(context.backgroundMemory(w, ["rita"], "Rita got a rumour about the dojo").query, /rumour about the dojo/, "an explicit query is used even with no event");
  assert.equal(context.backgroundMemory(w, ["rita"]), undefined, "nothing going on around her: no recall, no extra request");
  assert.equal(context.backgroundMemory(w, ["me"]), undefined);
  assert.equal(context.backgroundMemory(w, null), undefined);
  assert.equal(context.backgroundMemory(null, ["manon"]), undefined);
});

test("App: every autonomous writing call that names its characters recalls their memory", () => {
  const sites = appSource.match(/askWorldWritingJSON\("(?:feed-post|comments|dm|scene|group-chat|notes)"/g) || [];
  const wired = appSource.match(/backgroundMemory\(/g) || [];
  assert.ok(sites.length >= 20);
  assert.ok(wired.length >= sites.length - 3, `wired ${wired.length} of ${sites.length}`);
  assert.match(appSource, /function askWorldJSON\(w, system, prompt, options = \{\}\) \{[\s\S]{0,700}return memory \? memoryPromptBlock\(w, memory\)\.then\(run\) : run\(""\);/, "without a memory option the old path is untouched");
  assert.match(appSource, /memory: backgroundMemory\(w, plannedCards\.map\(\(card\) => card\.id\), postContext\.text\)/);
});
