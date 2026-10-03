import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { buildGroupIndex, deriveFromGroups, reconcileFacts, resolveProfileReferences, validateProfile, validateBonds, runtimeBond, restoreBaselineGraph, assertCompleteGraph, ProfileSchema } from "../src/bondAnalysis.js";
import { fullSheetText, rebuildBondGraph, installBondGraph, analysisReady, bondGenerationContext, bondSourceFingerprint } from "../src/bondClient.js";
import { sheetHash, analyzeStructured } from "../server/bondAnalysis.js";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const ids = ["player", "ai-a", "ai-b", "sensei"];
const profile = (id, group = "Cobra Kai", role = "tag") => ({ id, names: [id], processedFields: ["name", "backstory"], claims: [{ field: "names", value: id, evidence: id }], groups: [{ name: group, aliases: [], kind: "dojo", role, rank: null, evidence: id + " a " + group + " " + role + "." }], groupRelations: [], mentions: [], facts: [], traits: [], goals: [], fears: [], secrets: [], timeline: [] });
const profiles = ids.map(id => profile(id, "Cobra Kai", id === "sensei" ? "sensei" : "tag"));
const ownText = p => p.id + "\n" + p.groups[0].evidence;
const bond = (from, to, extra = {}) => ({ from, to, type: "semleges", status: "semleges", levels: { sentiment: 0, trust: 0, attraction: 0, tension: 0 }, intensity: 0, confidence: 1, summary: from + " nem ismeri " + to + " karakterét.", description: from + " lapja nem ír személyes viszonyról " + to + " felé. Nincs igazolt közös múltjuk.", publicFace: "Személyes kapcsolatukról nincs adat.", hiddenFeelings: null, history: null, dynamics: null, wants: null, whoKnows: [], source: "logikai következtetés", evidence: [], fieldEvidence: [], factEvidence: [], layers: [], ...extra });
const graph = () => Object.fromEntries(ids.flatMap(a => ids.filter(b => b !== a).map(b => [a + ">" + b, runtimeBond(bond(a, b))])));

test("A1: same dojo teammates and both directed sensei relationships", () => {
 const index = buildGroupIndex(profiles);
 assert.equal(deriveFromGroups("ai-a", "ai-b", index)[0].type, "csapattárs");
 for (const id of ["ai-a", "ai-b"]) {
  assert.equal(deriveFromGroups(id, "sensei", index)[0].type, "tanítvány–sensei");
  assert.equal(deriveFromGroups("sensei", id, index)[0].type, "sensei–tanítvány");
 }
});
test("A2: rivalry requires literal group proof; different groups alone neutral", () => {
 const left = profile("a"), right = profile("b", "Miyagi-Do");
 assert.deepEqual(deriveFromGroups("a", "b", buildGroupIndex([left, right])), []);
 left.groupRelations.push({ from: "Cobra Kai", to: "Miyagi-Do", kind: "rivális", evidence: "A Cobra Kai riválisa a Miyagi-Do." });
 const facts = deriveFromGroups("a", "b", buildGroupIndex([left, right]));
 assert.equal(facts[0].type, "rivális");
 assert.ok(facts[0].evidence.some(q => q.quote === left.groupRelations[0].evidence));
});
test("A3/R2/R3: all pairs including AI–AI; missing direction rejected", () => {
 const bases = graph(); assertCompleteGraph(ids, bases); assert.equal(Object.keys(bases).length, 12);
 assert.ok(bases["ai-a>ai-b"] && bases["ai-b>ai-a"]);
 delete bases["ai-b>ai-a"]; assert.throws(() => assertCompleteGraph(ids, bases));
});
test("A8/R5/R6: schema, verbatim own evidence, asymmetric prose, hidden null", () => {
 const quote = "Anna titokban többet érez Béla iránt.";
 const a = bond("a", "b", { type: "titkos crush", status: "egyoldalú", summary: "Anna barátként ismeri Bélát. Többre vágyik, mint barátságra.", description: "Anna régi barátként tekint Bélára. Mégis többet érez iránta. Ezt az érzést magában tartja. A külvilág ebből nem értesül a titkáról.", hiddenFeelings: "Anna többre vágyik.", whoKnows: ["a"], evidence: [quote], fieldEvidence: [{ field: "hiddenFeelings", quotes: [quote] }], source: "explicit" });
 const b = bond("b", "a");
 validateBonds({ bonds: [a] }, "a", [{ id: "b" }], quote, {});
 validateBonds({ bonds: [b] }, "b", [{ id: "a" }], "Béla.", {});
 assert.notEqual(a.description, b.description); assert.equal(b.hiddenFeelings, null);
 assert.throws(() => validateBonds({ bonds: [{ ...a, evidence: ["kitalált idézet"] }] }, "a", [{ id: "b" }], quote, {}));
 assert.throws(() => validateBonds({ bonds: [{ ...a, fieldEvidence: [] }] }, "a", [{ id: "b" }], quote, {}));
});
test("Objective cross-check retains contradictions without mirroring feelings", () => {
 const a = profile("a"), b = profile("b");
 a.facts.push({ targetName: "b", targetId: "b", kind: "rokonság", forward: "testvér", reverse: "testvér", timeframe: "jelen", negated: false, conditional: false, secret: false, whoKnows: [], evidence: "b a testvérem." });
 b.facts.push({ ...a.facts[0], targetName: "a", targetId: "a", negated: true, evidence: "a nem a testvérem." });
 const facts = reconcileFacts("b", "a", [a, b], buildGroupIndex([a, b]));
 assert.ok(facts.some(f => f.perspective === "a")); assert.ok(facts.some(f => f.perspective === "b" && f.negated));
 assert.ok(!facts.some(f => f.hiddenFeelings));
});
test("Alias resolution accepts unique aliases, excludes outsiders and ambiguous names", () => {
 const a = profile("a"), b = profile("b"), c = profile("c"); b.names.push("Béci", "Közös"); c.names.push("Közös");
 a.mentions = ["Béci", "Közös", "Világon kívüli"].map(targetName => ({ targetName, targetId: null, whoKnows: ["Béci"] }));
 assert.deepEqual(resolveProfileReferences([a, b, c])[0].mentions.map(row => row.targetId), ["b", null, null]);
});
test("A7: full long original text retained and sent exactly; hashes change", async () => {
 const people = [{ id: "a", name: "Anna", backstory: "Árnyalt előtörténet. ".repeat(10000) + "LAP VÉGE" }, { id: "b", name: "Béla", backstory: "Másik teljes lap." }];
 const calls = [];
 const world = { chars: people };
 const api = async (url, options) => {
  const request = JSON.parse(options.body); calls.push(request);
  return { cached: false, cacheKey: request.owner, hash: sheetHash(request.ownSheet), result: request.stage === "profile" ? { ...profile(request.owner), groups: [] } : { bonds: request.roster.map(row => bond(request.owner, row.id)) } };
 };
 const result = await rebuildBondGraph(world, { subjects: w => w.chars, api, language: "hu" });
 for (const call of calls) assert.equal(call.ownSheet, fullSheetText(people.find(p => p.id === call.owner)));
 assert.ok(calls[0].ownSheet.endsWith("[name]\nAnna")); assert.ok(calls[0].ownSheet.includes("LAP VÉGE"));
 assert.equal(calls.filter(c => c.stage === "baseline").length, 2);
 installBondGraph(world, result, w => w.chars); assert.ok(analysisReady(world, w => w.chars));
 people[0].backstory += " Változás"; assert.ok(!analysisReady(world, w => w.chars));
 assert.notEqual(sheetHash(calls[0].ownSheet), sheetHash(fullSheetText(people[0])));
});
test("A6/R7: sheet change recomputes complete outgoing graph and incoming dependencies", async () => {
 const people = ids.map(id => ({ id, name: id, backstory: id })); const world = { chars: people };
 const counts = [];
 const api = async (_, opts) => { const row = JSON.parse(opts.body); counts.push(row); return { cached: true, cacheKey: row.owner, hash: sheetHash(row.ownSheet), result: row.stage === "profile" ? profile(row.owner) : { bonds: row.roster.map(t => bond(row.owner, t.id)) } }; };
 const initial = await rebuildBondGraph(world, { subjects: w => w.chars, api }); installBondGraph(world, initial, w => w.chars);
 people[1].backstory += " módosítás"; counts.length = 0;
 const next = await rebuildBondGraph(world, { subjects: w => w.chars, api }); installBondGraph(world, next, w => w.chars);
 assert.equal(Object.keys(next.baselines).length, 12);
 for (const id of ids) assert.ok(counts.some(c => c.stage === "baseline" && c.owner === id));
});
test("R1/R3/R4: three manually changed currents and invented game romance reset every field", () => {
 const bases = graph(), snapshot = structuredClone(bases);
 const world = { relationshipBaselines: bases, rels: structuredClone(bases), relationshipHistory: { change: "old" }, relationshipContinuity: { old: 1 }, officialRelationships: { old: 1 } };
 for (const key of ["player>ai-a", "ai-a>player", "ai-a>ai-b"]) Object.assign(world.rels[key], { type: "Járnak", hiddenFeelings: "Új játékbeli titok", whoKnows: ids, levels: { sentiment: 99, trust: 100, attraction: 100, tension: 80 }, extraRuntimeField: "must disappear" });
 restoreBaselineGraph(world, ids);
 assert.deepEqual(world.rels, snapshot); assert.deepEqual(world.relationshipHistory, {});
 world.rels["ai-a>ai-b"].levels.trust = 99; assert.deepEqual(bases, snapshot);
});
test("Incomplete baseline cannot partially reset even in memory", () => {
 const world = { relationshipBaselines: graph(), rels: { unchanged: true }, relationshipHistory: { unchanged: true } };
 delete world.relationshipBaselines["ai-b>sensei"];
 const before = structuredClone(world); assert.throws(() => restoreBaselineGraph(world, ids)); assert.deepEqual(world, before);
});
const candidates = [{ name: "gemini", model: "configured-primary", key: "test", priority: 100 }, { name: "groq", model: "configured-fallback", key: "test", contextWindow: 1000000, outputLimit: 65536 }];
const response = result => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] });
const transportFor = (mode, calls) => async (url, opts) => {
 calls.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
 if (url.endsWith(":countTokens")) return { totalTokens: 100 };
 if (url.endsWith(":generateContent")) {
  if (mode === "rate") { const error = new Error("rate limit"); error.status = 429; throw error; }
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] };
 }
 if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: mode === "size" ? 200 : 1000000, outputTokenLimit: 65536 };
 if (url.endsWith("/models")) return { data: [{ id: "configured-fallback", active: true, context_window: 1000000, max_completion_tokens: 65536 }] };
 return response({ ok: true });
};
for (const mode of ["rate", "invalid", "size"]) test("Provider fallback: " + mode + ", full prompt unchanged", async () => {
 const calls = [], prompt = "TELJES LAP ".repeat(3000) + "VÉGE";
 const result = await analyzeStructured(prompt, { type: "object" }, value => { if (!value.ok) throw new Error("invalid output"); }, { candidates, transport: transportFor(mode, calls), outputTokens: 1000 });
 assert.equal(result.provider, "groq");
 const sent = calls.find(c => c.url.endsWith("/chat/completions")); assert.equal(sent.body.messages[0].content, prompt);
 assert.equal(calls.filter(c => c.url.endsWith(":generateContent")).length, mode === "invalid" || mode === "rate" ? 1 : 0);
});
test("Profile rejects unprocessed fields and unsupported claims", () => {
 const p = profile("a"); validateProfile(p, ownText(p), "a", new Set(["a", "b"]), ["name"]);
 assert.throws(() => validateProfile(p, ownText(p), "a", new Set(["a", "b"]), ["extra"]));
 p.secrets.push("kitalált titok"); assert.throws(() => validateProfile(p, ownText(p), "a", new Set(["a", "b"])));
});
test("Generation receives complete profiles and both CURRENT directions", () => {
 const world = { bondAnalysis: { profiles: Object.fromEntries(profiles.map(p => [p.id, { profile: p }])) }, rels: graph() };
 world.rels["ai-a>ai-b"].description = "Játékban változott viszony.";
 const prompt = bondGenerationContext(world); assert.ok(prompt.includes("Játékban változott viszony."));
 for (const id of ids) assert.ok(prompt.includes('"id":"' + id + '"'));
 assert.ok(prompt.includes('"ai-a>ai-b"') && prompt.includes('"ai-b>ai-a"'));
});

// Execute the actual world-save handler, extracted unchanged from the server.
// The SQL adapter is a transaction-aware test double, not a live PostgreSQL instance.
const serverSource = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
const serverAst = parse(serverSource, { sourceType: "module" });
const route = serverAst.program.body.find(n => n.type === "ExpressionStatement" && n.expression.type === "CallExpression" && n.expression.arguments[0]?.value === "/world/save").expression.arguments[1];
async function resetRequest(failUpdate = false) {
 const database = { world: { code: "test", syncRev: 1, rels: { old: true } }, memories: ["old"] };
 const original = structuredClone(database); let transaction;
 const statements = [];
 const client = { release() {}, async query(sql, args) {
  statements.push(sql.trim());
  if (sql === "BEGIN") transaction = structuredClone(database);
  else if (sql === "ROLLBACK") transaction = null;
  else if (sql === "COMMIT") Object.assign(database, transaction);
  else if (sql.includes("FOR UPDATE")) return { rows: [{ sync_rev: 1, rev: 1, accounts: {} }] };
  else if (sql.startsWith("DELETE FROM character_memories")) transaction.memories = [];
  else if (sql.includes("UPDATE worlds")) { if (failUpdate) throw new Error("Injected write failure"); transaction.world = JSON.parse(args[1]); }
  return { rows: [] };
 }};
 const context = vm.createContext({ requireDb: async () => true, getSessionIdentity: async () => ({ worldCode: "test", accountId: "player" }), cleanCode: s => s.toLowerCase(), pool: { connect: async () => client }, assertCompleteGraph, stringifyJsonbSafe: JSON.stringify, console: { info() {}, error() {} } });
 const handler = vm.runInContext("(" + serverSource.substring(route.start, route.end) + ")", context);
 const world = { code: "test", syncRev: 1, players: { accountKey: { id: "player" } }, chars: ids.filter(id => id !== "player").map(id => ({ id })), relationshipBaselines: graph(), bondAnalysis: { version: 1, profiles: Object.fromEntries(ids.map(id => [id, {}])) } };
 restoreBaselineGraph(world, ids);
 const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
 await handler({ body: { world, bondReset: true } }, res);
 return { database, original, statements, res };
}
test("Restart SQL handler atomically saves graph and deletes memories", async () => {
 const result = await resetRequest(); assert.equal(result.res.code, 200); assert.equal(result.database.memories.length, 0);
 assert.deepEqual(result.database.world.rels, result.database.world.relationshipBaselines);
 assert.ok(result.statements.at(-1) === "COMMIT");
});
test("R8: actual save handler rolls back graph AND deleted memories on error", async () => {
 const result = await resetRequest(true); assert.equal(result.res.code, 500);
 assert.deepEqual(result.database, result.original); assert.equal(result.statements.at(-1), "ROLLBACK");
});

test("Posting an album image preserves the full sheet and does not invalidate baselines", () => {
 const item = { id: "photo1", imageId: "img1", who: "Anna és Béla", note: "  Teljes, eredeti képaláírás.  ", vision: "Dojo", analyzedAt: 5, customCaption: "Rejtett doboz felirata" };
 const character = { id: "a", name: "Anna", album: [item] };
 const world = { chars: [character], posts: [] };
 const before = fullSheetText(character, undefined, world);
 character.album = [];
 world.posts.push({ authorId: "a", sourceAlbumItemId: "photo1", sourceSheetAlbumItem: item });
 assert.equal(fullSheetText(character, undefined, world), before);
 assert.ok(before.includes(item.customCaption) && before.includes(item.note));
});
test("Actor knowledge excludes another person's private feelings unless whoKnows authorizes it", () => {
 const world = { bondAnalysis: { profiles: { a: { profile: profile("a") }, b: { profile: profile("b") } } }, rels: { "a>b": bond("a", "b"), "b>a": bond("b", "a", { hiddenFeelings: "Titkos vonzalom", whoKnows: ["b"] }) } };
 const context = JSON.parse(bondGenerationContext(world).split("[[FULL_BOND_CONTEXT]]\n")[1].split("\n[[/FULL_BOND_CONTEXT]]")[0]);
 assert.equal(context.knowledgeByActor.a["b>a"].hiddenFeelings, undefined);
 assert.equal(context.knowledgeByActor.b["b>a"].hiddenFeelings, "Titkos vonzalom");
});

test("First migration preserves played relationships; only Restart resets them", async () => {
 const people = [{ id: "a", name: "Anna" }, { id: "b", name: "Béla" }];
 const current = { score: 74, bond: "Játékban összejöttek", hidden: "Új titok", why: "A jelenetben történt", trust: 80, attraction: 93, tension: 4, freshFromSheet: false, gameMarker: true };
 const world = { chars: people, rels: { "a>b": structuredClone(current) } };
 const api = async (_, options) => { const request = JSON.parse(options.body); return { cached: false, cacheKey: request.owner, hash: sheetHash(request.ownSheet), result: request.stage === "profile" ? profile(request.owner) : { bonds: request.roster.map(row => bond(request.owner, row.id)) } }; };
 const result = await rebuildBondGraph(world, { subjects: w => w.chars, api, language: "en" });
 installBondGraph(world, result, w => w.chars);
 for (const [key, value] of Object.entries(current)) assert.deepEqual(world.rels["a>b"][key], value);
 assert.ok(world.rels["a>b"].description.includes(current.why));
 assert.equal(world.rels["a>b"].levels.attraction, 93); assert.equal(world.rels["a>b"].hiddenFeelings, current.hidden);
 restoreBaselineGraph(world, ["a", "b"]); assert.deepEqual(world.rels, result.baselines);
});
test("English mode sends English interpretation language at BOTH analysis stages", async () => {
 const world = { chars: [{ id: "a", name: "Anna", backstory: "She has never been in love with Bela." }, { id: "b", name: "Bela" }] };
 const calls = [];
 const api = async (_, options) => { const request = JSON.parse(options.body); calls.push(request); return { cacheKey: request.owner, hash: sheetHash(request.ownSheet), result: request.stage === "profile" ? profile(request.owner) : { bonds: request.roster.map(row => bond(request.owner, row.id)) } }; };
 await rebuildBondGraph(world, { subjects: w => w.chars, api, language: "en" });
 assert.equal(calls.length, 4); assert.ok(calls.every(row => row.language === "en"));
 assert.ok(calls[0].ownSheet.includes(world.chars[0].backstory));
});

test("Gemini semantic routing tries free keys 2 through 8 before paid key 1", async () => {
 const env = { GEMINI_ANALYSIS_MODEL: "configured-gemini" };
 for (let i = 1; i <= 8; i++) env["GEMINI_API_KEY" + (i === 1 ? "" : "_" + i)] = "test-key-" + i;
 const attempted = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) {
   const key = opts.headers["x-goog-api-key"]; attempted.push(key);
   if (key !== "test-key-8") { const error = new Error("quota"); error.status = 429; throw error; }
   assert.equal(JSON.parse(opts.body).generationConfig.thinkingConfig.thinkingLevel, "HIGH");
   return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] };
  }
  return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
 };
 const result = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 });
 assert.equal(result.provider, "gemini");
 assert.deepEqual(attempted, ["test-key-2","test-key-3","test-key-4","test-key-5","test-key-6","test-key-7","test-key-8"]);
});
test("Restart profile rotation keeps every free Gemini fallback before paid Gemini and OpenAI", async () => {
 const env = { GEMINI_ANALYSIS_MODEL: "configured-gemini", OPENAI_API_KEY: "openai-key", OPENAI_ANALYSIS_MODEL: "configured-openai" };
 for (let i = 1; i <= 8; i++) env["GEMINI_API_KEY" + (i === 1 ? "" : "_" + i)] = "test-key-" + i;
 const attempted = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) {
   attempted.push(opts.headers["x-goog-api-key"]);
   const error = new Error("quota");
   error.status = 429;
   throw error;
  }
  if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  attempted.push(opts.headers.Authorization);
  return response({ ok: true });
 };
 const result = await analyzeStructured(
  "Complete source",
  { type: "object" },
  value => assert.equal(value.ok, true),
  { env, transport, outputTokens: 1000, semanticStartOffset: 3 }
 );
 assert.deepEqual(attempted, [
  "test-key-5","test-key-6","test-key-7","test-key-8",
  "test-key-2","test-key-3","test-key-4",
  "test-key-1","Bearer openai-key"
 ]);
 assert.equal(result.provider, "openai");
});

test("Paid Gemini key 1 is used only after free Gemini keys 2 through 8 fail", async () => {
 const env = { GEMINI_ANALYSIS_MODEL: "configured-gemini" };
 for (let i = 1; i <= 8; i++) env["GEMINI_API_KEY" + (i === 1 ? "" : "_" + i)] = "test-key-" + i;
 const attempted = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) {
   const key = opts.headers["x-goog-api-key"]; attempted.push(key);
   if (key !== "test-key-1") { const error = new Error("quota"); error.status = 429; throw error; }
   return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] };
  }
  return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
 };
 const result = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 });
 assert.deepEqual(attempted, ["test-key-2","test-key-3","test-key-4","test-key-5","test-key-6","test-key-7","test-key-8","test-key-1"]);
 assert.equal(result.keySlot, "GEMINI_API_KEY");
});

test("Semantic OpenAI fallback is after every configured Gemini key", async () => {
 const env = { GEMINI_ANALYSIS_MODEL: "configured-gemini", GEMINI_API_KEY_2: "g2", GEMINI_API_KEY: "g1", OPENAI_API_KEY: "oa", OPENAI_ANALYSIS_MODEL: "configured-openai" };
 const attempted = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) { attempted.push(opts.headers["x-goog-api-key"]); const error = new Error("quota"); error.status = 429; throw error; }
  if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  attempted.push(opts.headers.Authorization); return response({ ok: true });
 };
 const result = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 });
 assert.deepEqual(attempted, ["g2", "g1", "Bearer oa"]);
 assert.equal(result.provider, "openai");
});

test("Invalid Gemini JSON can be normalized by Groq without changing semantic provider attribution", async () => {
 const semantic = { name: "gemini", model: "semantic-gemini", key: "g", keySlot: "GEMINI_API_KEY_2" };
 const schemaRepair = { name: "groq", model: "schema-groq", key: "r", keySlot: "GROQ_API_KEY", contextWindow: 1000000, outputLimit: 65536 };
 const calls = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) { calls.push("gemini"); return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] }; }
  if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  if (url.endsWith("/models")) return { data: [{ id: "schema-groq", active: true, context_window: 1000000, max_completion_tokens: 65536 }] };
  calls.push("groq"); return response({ ok: true });
 };
 const result = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { candidates: [semantic], schemaCandidates: [schemaRepair], transport, outputTokens: 1000 });
 assert.deepEqual(calls, ["gemini", "groq"]);
 assert.equal(result.provider, "gemini"); assert.equal(result.formatterProvider, "groq");
});

test("Sensei and shared affiliation behavior use validated profiles/current layers, not sheet keywords", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
 const names = ["characterIsSensei", "isOwnSenseiRelationship", "sameFollowTeamOrFaction"];
 const context = vm.createContext({ getRel: (w, a, b) => w.rels[a + ">" + b] });
 vm.runInContext(ast.program.body.filter(node => names.includes(node.id?.name)).map(node => source.substring(node.start,node.end)).join("\n"), context);
 const a = { id: "a", backstory: "My old sensei trained me, but I never belonged to Bela's dojo." }, b = { id: "b", name: "Bela" };
 const world = { bondAnalysis: { profiles: { a: { profile: { groups: [{ role: "tanítvány" }] } }, b: { profile: { groups: [{ role: "sensei" }] } } } }, rels: { "a>b": { layers: [] } } };
 assert.equal(context.characterIsSensei(a, world), false); assert.equal(context.characterIsSensei(b, world), true);
 assert.equal(context.isOwnSenseiRelationship(world, "a", "b"), false); assert.equal(context.sameFollowTeamOrFaction(world,a,b), false);
 world.rels["a>b"].layers = ["tanítvány–sensei"];
 assert.equal(context.isOwnSenseiRelationship(world, "a", "b"), true); assert.equal(context.sameFollowTeamOrFaction(world,a,b), true);
});

test("Provider-side invalid JSON receives two attempts before failover", async () => {
 const calls = []; let invalid = 0;
 const transport = async (url, opts) => {
  if (url.endsWith(":generateContent")) {
   invalid++; const error = new Error("Provider could not validate JSON"); error.status = 400; error.invalidOutput = true; throw error;
  }
  return transportFor("rate", calls)(url, opts);
 };
 const result = await analyzeStructured("Complete original sheet", { type: "object" }, result => assert.equal(result.ok, true), { candidates, transport, outputTokens: 1000 });
 assert.equal(invalid, 1); assert.equal(result.provider, "groq");
});
test("Schema routing uses Groq key 1, then key 2, then OpenAI", async () => {
 const tried = [];
 const env = { GROQ_ANALYSIS_MODEL: "configured-groq", GROQ_API_KEY: "groq-1", GROQ_API_KEY_2: "groq-2", GROQ_ANALYSIS_CONTEXT_WINDOW: "131072", GROQ_ANALYSIS_OUTPUT_LIMIT: "65536", OPENAI_API_KEY: "openai-key", OPENAI_SCHEMA_MODEL: "configured-openai" };
 const transport = async (url, opts) => {
  if (url.endsWith("/models")) return { data: [{ id: "configured-groq", active: true, context_window: 131072, max_completion_tokens: 65536 }] };
  const auth = opts.headers.Authorization; tried.push(auth);
  if (auth === "Bearer groq-1" || auth === "Bearer groq-2") { const error = new Error("quota"); error.status = 429; throw error; }
  return response({ ok: true });
 };
 const result = await analyzeStructured("Complete sheet", { type: "object" }, result => assert.equal(result.ok, true), { env, transport, outputTokens: 1000, mode: "schema" });
 assert.deepEqual(tried, ["Bearer groq-1", "Bearer groq-2", "Bearer openai-key"]);
 assert.equal(result.provider, "openai"); assert.equal(result.keySlot, "OPENAI_API_KEY");
});


test("Neutral complete-graph records do not imply acquaintance or social interest", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
 const context = vm.createContext({});
 vm.runInContext(ast.program.body.filter(node => node.id?.name === "hasEstablishedBond").map(node => source.substring(node.start,node.end)).join("\n"), context);
 const neutral = runtimeBond(bond("a","b"));
 assert.equal(context.hasEstablishedBond(neutral), false);
 assert.equal(context.hasEstablishedBond({...neutral, layers: ["csapattárs"]}), true);
 assert.equal(context.hasEstablishedBond({...neutral, trust: 25}), true);
 assert.equal(context.hasEstablishedBond({...neutral, status: "aktív"}), true);
 assert.equal(context.hasEstablishedBond({bond: "barát", score: 0}), true);
});


test("Existing hierarchy, intimidation, continuity and social rules remain in current-bond context", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
 const calls = [], context = vm.createContext({ getRel: (w,a,b) => w.rels[a+">"+b], JSON });
 for (const name of ["relationshipContinuityCard","hierarchyBehaviorCard","intimidationBehaviorCard","simsSocialRelationshipContextCard","fakeDatingBehaviorCard"]) context[name] = () => {calls.push(name);return name;};
 vm.runInContext(ast.program.body.filter(n => n.id?.name === "relationshipBehaviorCard").map(n => source.substring(n.start,n.end)).join("\n"),context);
 const w = {rels:{"a>b":runtimeBond(bond("a","b")),"b>a":runtimeBond(bond("b","a",{hiddenFeelings:"PRIVATE REVERSE",whoKnows:["b"]}))}};
 const output=context.relationshipBehaviorCard(w,"a","b");
 assert.equal(calls.length,5);assert.ok(output.includes("hierarchyBehaviorCard"));assert.ok(!output.includes("PRIVATE REVERSE"));
});

test("Social and fake-dating helpers cannot expose unknown reverse private state", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
 const context=vm.createContext({getRel:(w,a,b)=>w.rels[a+">"+b],charById:(w,id)=>({id,name:id}),simsSocialReactionStyle:()=>"style",isFakeDatingText:value=>value==="fake",worldLanguage:()=>"en",nameOfIn:(w,id)=>id,EMPTY_REL:{}});
 vm.runInContext(ast.program.body.filter(n=>["simsSocialRelationshipContextCard","fakeDatingBehaviorCard"].includes(n.id?.name)).map(n=>source.substring(n.start,n.end)).join("\n"),context);
 const w={meId:"other",rels:{"a>b":runtimeBond(bond("a","b")),"b>a":runtimeBond(bond("b","a",{type:"fake",levels:{sentiment:87,trust:90,attraction:91,tension:0},whoKnows:["b"]}))}};
 assert.ok(!context.simsSocialRelationshipContextCard(w,"a","b").includes("score=87"));
 assert.equal(context.fakeDatingBehaviorCard(w,"a","b"),"");
 w.rels["b>a"].whoKnows.push("a");assert.ok(context.fakeDatingBehaviorCard(w,"a","b").includes("FAKE DATING"));
});


test("Invalid semantic output moves to the next semantic candidate when no schema repair chain is supplied", async () => {
 const calls = [], models = [{...candidates[0], model:"primary"}, {...candidates[0], model:"alternate"}, candidates[1]];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return {totalTokens:100};
  if (url.endsWith(":generateContent")) { const model=url.includes("/primary:")?"primary":"alternate";calls.push(model);return {candidates:[{finishReason:"STOP",content:{parts:[{text:model==="alternate"?'{"ok":true}':'{}'}]}}]}; }
  if (url.endsWith("/chat/completions")) {calls.push("groq");return response({});}
  if (url.endsWith("/models")) return {data:[{id:"configured-fallback",active:true,context_window:1000000,max_completion_tokens:65536}]};
  return {supportedGenerationMethods:["generateContent"],inputTokenLimit:1000000,outputTokenLimit:65536};
 };
 const output=await analyzeStructured("Complete source",{type:"object"},value=>assert.equal(value.ok,true),{candidates:models,transport,outputTokens:1000});
 assert.equal(output.model,"alternate");assert.deepEqual(calls,["primary","alternate"]);
});


test("Restart analysis accounting counts new directed baselines and cached work separately", async () => {
 const chars = [{id:"a",name:"a",backstory:"a"},{id:"b",name:"b",backstory:"b"}];
 const api = async (_,opts) => {const row=JSON.parse(opts.body);return {cached:row.stage==="profile",cacheKey:row.owner,hash:sheetHash(row.ownSheet),result:row.stage==="profile"?profile(row.owner):{bonds:row.roster.map(target=>bond(row.owner,target.id))}}};
 const result=await rebuildBondGraph({chars},{subjects:w=>w.chars,api});
 assert.equal(result.analysis.recalculated,0);assert.equal(result.analysis.recalculatedBonds,2);
});


test("A transient Load failed is retried instead of failing the whole rebuild", async () => {
 const chars = [{ id: "a", name: "a", backstory: "a" }, { id: "b", name: "b", backstory: "b" }];
 const attempts = new Map();
 const api = async (_, options) => {
  const row = JSON.parse(options.body);
  const key = row.stage + ":" + row.owner;
  const count = (attempts.get(key) || 0) + 1;
  attempts.set(key, count);
  if (row.stage === "profile" && row.owner === "a" && count === 1) throw new Error("Load failed");
  return {
   pending: false,
   cached: false,
   cacheKey: key,
   hash: sheetHash(row.ownSheet),
   result: row.stage === "profile"
    ? profile(row.owner)
    : { bonds: row.roster.map(target => bond(row.owner, target.id)) },
  };
 };
 const result = await rebuildBondGraph({ chars }, { subjects: w => w.chars, api });
 assert.equal(attempts.get("profile:a"), 2);
 assert.equal(Object.keys(result.baselines).length, 2);
});

test("Restart reads only what changed, and only then restores the baselines and saves", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
 const start = source.indexOf("const restartWorldHistory = async () => {");
 assert.ok(start >= 0);
 const block = source.slice(start, source.indexOf("\n  };", start));
 const order = ["analysisReady(draft, allSubjects)", "await rebuildBondGraph(draft", "installBondGraph(draft, result, allSubjects)", "restartWorldHistoryInPlace(draft)", "serverSaveWorld(draft, { bondReset: true })"].map(part => block.indexOf(part));
 assert.ok(order.every(index => index >= 0), "missing step: " + order);
 assert.deepEqual([...order].sort((a, b) => a - b), order, "steps are out of order");
 assert.ok(!/force:\s*true/.test(block), "Restart must reuse the server cache, never force a full re-read");
 assert.ok(block.includes("bondAnalysisBusy.add(w.code)") && block.includes("bondAnalysisBusy.delete(w.code)"));
});

test("Placeholder 'instant restart' baselines are gone and old ones are re-read", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
 for (const name of ["ensureInstantRestartRelationshipBaselines", "markRestartAnalysisUsableImmediately", "bondRestartRefreshBusy", "fastRestart"]) assert.ok(!source.includes(name), name);
 const chars = [{ id: "a", name: "a", backstory: "a" }];
 const world = { chars, bondAnalysis: { version: 1, source: bondSourceFingerprint({ chars }, w => w.chars), profiles: {} } };
 assert.equal(analysisReady(world, w => w.chars), true);
 world.bondAnalysis.refreshPending = true;
 assert.equal(analysisReady(world, w => w.chars), false);
});

test("The paid GEMINI_API_KEY is the last Gemini key in the general proxy rotation too", () => {
 const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
 const start = source.indexOf("const GEMINI_KEYS = [");
 const list = source.slice(start, source.indexOf("]", start));
 const order = [...list.matchAll(/process\.env\.(GEMINI_API_KEY(?:_\d)?)/g)].map(match => match[1]);
 assert.deepEqual(order, ["GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY_6", "GEMINI_API_KEY_7", "GEMINI_API_KEY_8", "GEMINI_API_KEY"]);
});

test("Quote check ignores layout only: spacing, typographic quotes and dashes, never words", () => {
 const sheet = "Anna azt mondta:\n  \"Nem bízom benne\" – és elment.";
 const quoted = (evidence) => validateProfile({ ...profile("a"), groups: [], claims: [{ field: "names", value: "a", evidence }] }, sheet, "a", new Set(["a"]));
 quoted("Nem bízom benne");
 quoted("Anna azt mondta: \u201CNem bízom benne\u201D - és elment.");
 assert.throws(() => quoted("Nem bízom benne senkiben"));
 assert.throws(() => quoted("Nem bízom BENNE"));
 assert.throws(() => quoted("\u200B"), "invisible characters are not a quotation");
 assert.throws(() => quoted("   "));
 assert.throws(() => quoted(42));
});
