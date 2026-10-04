import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { buildGroupIndex, deriveFromGroups, reconcileFacts, resolveProfileReferences, validateProfile, validateBonds, sanitizeBonds, runtimeBond, restoreBaselineGraph, assertCompleteGraph, ProfileSchema, BASELINE_PROMPT } from "../src/bondAnalysis.js";
import { fullSheetText, relationshipSourceText, relationshipFields, rebuildBondGraph, installBondGraph, analysisReady, bondGenerationContext, bondSourceFingerprint } from "../src/bondClient.js";
import { sheetHash, analyzeStructured, generationTimeoutMs, providerCandidates } from "../server/bondAnalysis.js";
import { createGeminiLedger } from "../server/aiPolicy.js";
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
test("A nickname on any sheet resolves to the person who carries it; whole names beat first-name matches; ties are never guessed", () => {
 const mention = (targetName) => ({ targetName, targetId: null, whoKnows: [] });
 const b = profile("b"), angela = profile("angela"), angelo = profile("angelo"), x = profile("x");
 angela.names = ["Angela Silverman"]; angelo.names = ["Angel Torres"];
 x.mentions = ["Angel", "Angela", "Silverman", "Torres", "angel", "ÁNGELA", "Silverman Angela", "Nobody"].map(mention);
 const identities = { angela: ["Angela Silverman", "Angel"], angelo: ["Angel Torres"] };
 /* "Angel" is Angela's nickname as a whole AND Angelo's first name: the whole-name match wins. */
 assert.deepEqual(resolveProfileReferences([b, angela, angelo, x], identities)[3].mentions.map(row => row.targetId), ["angela", "angela", "angela", "angelo", "angela", "angela", null, null]);
 /* Without the nickname field the same text is a first-name match for Angelo only. */
 assert.equal(resolveProfileReferences([b, angela, angelo, x], {})[3].mentions[0].targetId, "angelo");
 /* Two people carrying the same nickname: no guess. */
 assert.equal(resolveProfileReferences([b, angela, angelo, x], { angela: ["Angel"], angelo: ["Angel"] })[3].mentions[0].targetId, null);
 /* The sheets' own names also resolve who knows a secret. */
 const secret = profile("y"); secret.mentions = [{ targetName: "Béla", targetId: null, whoKnows: ["Angel", "Nobody"] }];
 assert.deepEqual(resolveProfileReferences([b, angela, secret], identities)[2].mentions[0].whoKnows, ["angela"]);
});
test("A7: the complete Connections text is sent exactly; the rest of the sheet is not", async () => {
 const people = [
  { id: "a", name: "Anna", backstory: "Hosszú előtörténet. ".repeat(10000), connections: "Árnyalt kapcsolatok. ".repeat(10000) + "LAP VÉGE" },
  { id: "b", name: "Béla", backstory: "Másik teljes lap.", connections: "Anna régi barát." },
 ];
 const calls = [];
 const world = { chars: people };
 const api = async (url, options) => {
  const request = JSON.parse(options.body); calls.push(request);
  return { cached: false, cacheKey: request.owner, hash: sheetHash(request.ownSheet), result: request.stage === "profile" ? { ...profile(request.owner), groups: [] } : { bonds: request.roster.map(row => bond(request.owner, row.id)) } };
 };
 const result = await rebuildBondGraph(world, { subjects: w => w.chars, api, language: "hu" });
 for (const call of calls) {
  const owner = people.find(p => p.id === call.owner);
  assert.equal(call.ownSheet, relationshipSourceText(owner));
  assert.deepEqual(call.fieldNames ?? Object.keys(relationshipFields(owner)), Object.keys(relationshipFields(owner)));
  assert.ok(!call.ownSheet.includes("Hosszú előtörténet") && !call.ownSheet.includes("Másik teljes lap"));
 }
 assert.ok(calls[0].ownSheet.includes("LAP VÉGE")); assert.ok(calls[0].ownSheet.includes("[name]\nAnna"));
 assert.equal(calls.filter(c => c.stage === "baseline").length, 2);
 installBondGraph(world, result, w => w.chars); assert.ok(analysisReady(world, w => w.chars));
 // Editing anything but Connections / identity costs nothing: no re-read, same hash.
 people[0].backstory += " Változás"; assert.ok(analysisReady(world, w => w.chars));
 assert.equal(sheetHash(calls[0].ownSheet), sheetHash(relationshipSourceText(people[0])));
 // Editing Connections does invalidate the analysis.
 people[0].connections += " Új sor."; assert.ok(!analysisReady(world, w => w.chars));
 assert.notEqual(sheetHash(calls[0].ownSheet), sheetHash(relationshipSourceText(people[0])));
});
test("A character without a Connections field is still analysed from its identity fields", async () => {
 const world = { chars: [{ id: "a", name: "Anna", backstory: "Sok minden." }, { id: "b", name: "Béla", nick: "B" }] };
 assert.deepEqual(Object.keys(relationshipFields(world.chars[0])), ["name"]);
 assert.deepEqual(Object.keys(relationshipFields(world.chars[1])), ["name", "nick"]);
 assert.equal(relationshipSourceText(world.chars[0]), "[name]\nAnna");
});
test("A world analysed from whole sheets stays ready until a sheet changes", () => {
 const chars = [{ id: "a", name: "Anna", backstory: "x", connections: "Béla a barátom." }, { id: "b", name: "Béla", backstory: "y" }];
 const legacy = JSON.stringify(chars.map(character => ({ id: character.id, fields: Object.fromEntries(Object.keys(character).filter(key => key !== "id").sort().map(key => [key, character[key]])) })).sort((a, b) => a.id.localeCompare(b.id)));
 const world = { chars, bondAnalysis: { version: 1, source: legacy, profiles: {} } };
 assert.equal(analysisReady(world, w => w.chars), true);
 chars[1].backstory = "z";
 assert.equal(analysisReady(world, w => w.chars), false);
 assert.ok(bondSourceFingerprint(world, w => w.chars).startsWith("connections-v1:"));
});
test("Both analysis prompts name Connections as the only relationship source", async () => {
 const { EXTRACT_PROMPT, BASELINE_PROMPT } = await import("../src/bondAnalysis.js");
 for (const prompt of [EXTRACT_PROMPT, BASELINE_PROMPT]) assert.ok(/RELATIONSHIP SOURCE/.test(prompt) && /Connections/.test(prompt) && !/ENTIRE owner's sheet|COMPLETE original sheet/.test(prompt));
 assert.ok(/OWN words/.test(BASELINE_PROMPT));
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
const candidates = [{ name: "gemini", model: "configured-primary", key: "test", priority: 100 }, { name: "openai", model: "configured-fallback", key: "test" }];
const response = result => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] });
const transportFor = (mode, calls) => async (url, opts) => {
 calls.push({ url, body: opts?.body ? JSON.parse(opts.body) : null });
 if (url.endsWith(":countTokens")) return { totalTokens: 100 };
 if (url.endsWith(":generateContent")) {
  if (mode === "rate") { const error = new Error("rate limit"); error.status = 429; throw error; }
  return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] };
 }
 if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: mode === "size" ? 200 : 1000000, outputTokenLimit: 65536 };
 return response({ ok: true });
};
for (const mode of ["rate", "invalid", "size"]) test("Provider fallback: " + mode + ", full prompt unchanged", async () => {
 const calls = [], prompt = "TELJES LAP ".repeat(3000) + "VÉGE";
 const result = await analyzeStructured(prompt, { type: "object" }, value => { if (!value.ok) throw new Error("invalid output"); }, { candidates, transport: transportFor(mode, calls), outputTokens: 1000 });
 assert.equal(result.provider, "openai");
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
 const world = { chars: [{ id: "a", name: "Anna", connections: "She has never been in love with Bela." }, { id: "b", name: "Bela" }] };
 const calls = [];
 const api = async (_, options) => { const request = JSON.parse(options.body); calls.push(request); return { cacheKey: request.owner, hash: sheetHash(request.ownSheet), result: request.stage === "profile" ? profile(request.owner) : { bonds: request.roster.map(row => bond(request.owner, row.id)) } }; };
 await rebuildBondGraph(world, { subjects: w => w.chars, api, language: "en" });
 assert.equal(calls.length, 4); assert.ok(calls.every(row => row.language === "en"));
 assert.ok(calls[0].ownSheet.includes(world.chars[0].connections));
});
test("Gemini semantic routing tries free keys 2 through 8 before paid key 1", async () => {
 const env = { GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off", GEMINI_ANALYSIS_MODEL: "configured-gemini" };
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
test("Restart profile rotation keeps every free Gemini key (each group rotated), then asks OpenAI once, and never the paid Gemini key", async () => {
 const env = { GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off", GEMINI_ANALYSIS_MODEL: "configured-gemini", OPENAI_API_KEY: "openai-key", OPENAI_ANALYSIS_MODEL: "configured-openai" };
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
 assert.deepEqual(attempted, ["test-key-2","test-key-3","test-key-4","test-key-8","test-key-5","test-key-6","test-key-7","Bearer openai-key"], "the 3 Flash keys, then the 4 light-model keys helping out, rotated by 3 within each group");
 assert.equal(result.provider, "openai"); assert.equal(result.model, "configured-openai");
});
test("Paid Gemini key 1 is never used for analysis unless paid background use is switched on", async () => {
 const run = async (extraEnv) => {
  const env = { GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off", GEMINI_ANALYSIS_MODEL: "configured-gemini", ...extraEnv };
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
  const outcome = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 }).then(result => ({ result }), error => ({ error }));
  return { attempted, ...outcome };
 };
 const free = await run({});
 assert.deepEqual(free.attempted, ["test-key-2","test-key-3","test-key-4","test-key-5","test-key-6","test-key-7","test-key-8"]);
 assert.match(free.error.message, /No analysis provider completed/);
 const paid = await run({ AI_ALLOW_PAID_BACKGROUND: "1" });
 assert.deepEqual(paid.attempted, ["test-key-2","test-key-3","test-key-4","test-key-5","test-key-6","test-key-7","test-key-8","test-key-1"]);
 assert.equal(paid.result.keySlot, "GEMINI_API_KEY");
});
test("OpenAI is the paid last resort of a sheet reading: after every free Gemini key, never the paid Gemini key, and it can be switched off", async () => {
 const run = async (extraEnv) => {
  const env = { GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off", GEMINI_ANALYSIS_MODEL: "configured-gemini", GEMINI_API_KEY_2: "g2", GEMINI_API_KEY: "g1", OPENAI_API_KEY: "oa", OPENAI_ANALYSIS_MODEL: "configured-openai", ...extraEnv };
  const attempted = [];
  const transport = async (url, opts) => {
   if (url.endsWith(":countTokens")) return { totalTokens: 100 };
   if (url.endsWith(":generateContent")) { attempted.push(opts.headers["x-goog-api-key"]); const error = new Error("quota"); error.status = 429; throw error; }
   if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
   attempted.push(opts.headers.Authorization); return response({ ok: true });
  };
  const outcome = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 }).then(result => ({ result }), error => ({ error }));
  return { attempted, ...outcome };
 };
 const normal = await run({});
 assert.deepEqual(normal.attempted, ["g2", "Bearer oa"], "free key first, OpenAI next, paid Gemini key 1 never");
 assert.equal(normal.result.provider, "openai"); assert.equal(normal.result.keySlot, "OPENAI_API_KEY");
 const off = await run({ BOND_ANALYSIS_OPENAI: "off" });
 assert.deepEqual(off.attempted, ["g2"]); assert.ok(off.error);
 const noKey = await run({ OPENAI_API_KEY: "" });
 assert.deepEqual(noKey.attempted, ["g2"]); assert.ok(noKey.error);
 const everything = await run({ AI_ALLOW_PAID_BACKGROUND: "1" });
 assert.deepEqual(everything.attempted, ["g2", "g1", "Bearer oa"], "the paid Gemini key is still opt-in, and stays before OpenAI");
});
test("OpenAI is asked with the whole prompt and a paid call is logged without the key", async () => {
 const prompt = "entire sheet ".repeat(5500) + "FINAL SOURCE";
 const seen = [], logged = [];
 const transport = async (url, options) => { seen.push({ url, body: JSON.parse(options.body) }); return response({ ok: true }); };
 const original = console.info; console.info = (...args) => logged.push(args.join(" "));
 try {
  const result = await analyzeStructured(prompt, { type: "object" }, value => assert.equal(value.ok, true), { candidates: [candidates[1]], transport, outputTokens: 1000 });
  assert.equal(result.provider, "openai");
 } finally { console.info = original; }
 assert.equal(seen[0].url, "https://api.openai.com/v1/chat/completions");
 assert.equal(seen[0].body.messages[0].content, prompt, "never shortened");
 assert.ok(logged.some(line => /\[bond-analysis-paid\] openai configured-fallback mode=semantic promptChars=\d+/.test(line)), logged.join(" | "));
 assert.ok(!logged.join(" ").includes("test"), "the key is not logged");
});
test("Invalid Gemini JSON can be normalized by OpenAI without changing semantic provider attribution", async () => {
 const semantic = { name: "gemini", model: "semantic-gemini", key: "g", keySlot: "GEMINI_API_KEY_2" };
 const schemaRepair = { name: "openai", model: "schema-openai", key: "r", keySlot: "OPENAI_API_KEY" };
 const calls = [];
 const transport = async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) { calls.push("gemini"); return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] }; }
  if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  calls.push("openai"); return response({ ok: true });
 };
 const result = await analyzeStructured("Complete source", { type: "object" }, value => assert.equal(value.ok, true), { candidates: [semantic], schemaCandidates: [schemaRepair], transport, outputTokens: 1000 });
 assert.deepEqual(calls, ["gemini", "openai"]);
 assert.equal(result.provider, "gemini"); assert.equal(result.formatterProvider, "openai");
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
 assert.equal(invalid, 1); assert.equal(result.provider, "openai");
});
test("Schema routing asks the light Gemini models on the free keys first and OpenAI last, never Groq", async () => {
 const run = async (extraEnv) => {
  const tried = [];
  const env = { GEMINI_API_KEY_2: "g2", GEMINI_LITE_MODELS: "lite-x", GEMINI_EXTRA_MODELS: "off", GROQ_API_KEY: "groq-1", GROQ_API_KEY_2: "groq-2", GROQ_MODEL: "groq-m", OPENAI_API_KEY: "openai-key", OPENAI_SCHEMA_MODEL: "configured-openai", ...extraEnv };
  const transport = async (url, opts) => {
   if (url.endsWith(":countTokens")) return { totalTokens: 100 };
   if (url.endsWith(":generateContent")) { tried.push("gemini:" + decodeURIComponent(url.split("/models/")[1].split(":")[0])); const error = new Error("quota"); error.status = 429; throw error; }
   if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
   tried.push(opts.headers.Authorization); return response({ ok: true });
  };
  const outcome = await analyzeStructured("Complete sheet", { type: "object" }, result => assert.equal(result.ok, true), { env, transport, outputTokens: 1000, mode: "schema" }).then(result => ({ result }), error => ({ error }));
  return { tried, ...outcome };
 };
 const normal = await run({});
 assert.deepEqual(normal.tried, ["gemini:lite-x", "Bearer openai-key"]);
 assert.equal(normal.result.provider, "openai"); assert.equal(normal.result.keySlot, "OPENAI_API_KEY"); assert.equal(normal.result.model, "configured-openai");
 const off = await run({ BOND_ANALYSIS_OPENAI: "off" });
 assert.deepEqual(off.tried, ["gemini:lite-x"]); assert.ok(off.error);
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
  if (url.endsWith("/chat/completions")) {calls.push("openai");return response({});}
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

test("Restart works from the latest live world, installs the analysis there, and retries a save conflict", () => {
 const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
 const start = source.indexOf("const restartWorldHistory = async () => {");
 assert.ok(start >= 0);
 const block = source.slice(start, source.indexOf("\n  };", start));
 const order = ["update(n => { fresh = cloneWorldState(n); })", "analysisReady(fresh, allSubjects)", "await rebuildBondGraph(fresh", "installBondGraph(n, result, allSubjects)", "restartWorldHistoryInPlace(fresh)", "serverSaveWorld(fresh, { bondReset: true })"].map(part => block.indexOf(part));
 assert.ok(order.every(index => index >= 0), "missing step: " + order);
 assert.deepEqual([...order].sort((a, b) => a - b), order, "steps are out of order");
 assert.ok(!/force:\s*true/.test(block), "Restart must reuse the server cache, never force a full re-read");
 assert.ok(!block.includes("cloneWorldState(w)"), "never save a click-time copy of the world");
 assert.ok(block.includes("error?.status !== 409"), "a save conflict means: take the newest world and redo");
 assert.ok(block.includes("bondAnalysisBusy.add(w.code)") && block.includes("bondAnalysisBusy.delete(w.code)"));
 assert.ok(block.includes("setErr(") && block.indexOf("setErr(") < block.indexOf("bondRestartBusy.add(w.code)"), "a click ignored because a restart is running must say so");
});

test("A restart the rules reject is answered 422 with the reason, never a retried 500", () => {
 const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
 assert.ok(source.includes("validationError.restartRejected = true"));
 assert.ok(source.includes('res.status(422).json({ error: "Restart rejected: " + err.message })'));
});

test("validateBonds checks witnesses against the whole cast, the roster only for completeness", () => {
 const one = (extra) => ({ bonds: [bond("a", "b", extra)] });
 const roster = [{ id: "b" }];
 const own = "a lap";
 assert.throws(() => validateBonds(one({ whoKnows: ["a", "c"] }), "a", roster, own, { b: [] }), /Unknown hidden observer/, "without a cast list only the slice is known (old behaviour)");
 validateBonds(one({ whoKnows: ["a", "c"] }), "a", roster, own, { b: [] }, ["a", "b", "c", "d"]);
 assert.throws(() => validateBonds(one({ whoKnows: ["a", "zed"] }), "a", roster, own, { b: [] }, ["a", "b", "c"]), /Unknown hidden observer/, "an invented character is still rejected");
 assert.throws(() => validateBonds({ bonds: [] }, "a", roster, own, { b: [] }, ["a", "b", "c"]), /Incomplete outgoing bond graph/, "every target in the slice still needs its bond");
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

test("The general proxy keeps free Gemini keys 2-8 apart from the paid key, which only a waiting player may reach last", () => {
 const source = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
 const start = source.indexOf("const GEMINI_FREE_KEYS = [");
 const list = source.slice(start, source.indexOf("]", start));
 const order = [...list.matchAll(/process\.env\.(GEMINI_API_KEY(?:_\d)?)/g)].map(match => match[1]);
 assert.deepEqual(order, ["GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY_6", "GEMINI_API_KEY_7", "GEMINI_API_KEY_8"]);
 assert.ok(source.includes("const GEMINI_KEYS = [...GEMINI_FREE_KEYS, GEMINI_PAID_KEY]"));
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

test("All 20 sheets complete when Gemini quota runs out after 16: OpenAI reads the rest, each with the whole sheet", async () => {
 const env = {
  GEMINI_ANALYSIS_MODEL: "configured-gemini", GEMINI_API_KEY_2: "free", GEMINI_API_KEY: "paid",
  OPENAI_API_KEY: "openai", OPENAI_ANALYSIS_MODEL: "configured-openai",
  GROQ_ANALYSIS_MODEL: "configured-groq", GROQ_API_KEY: "groq-1", GROQ_API_KEY_2: "groq-2",
 };
 const completed = [], fallbackPrompts = [], hosts = new Set();
 let prompt;
 const transport = async (url, options) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 12000 };
  if (url.endsWith(":generateContent")) {
   if (completed.length >= 16) throw Object.assign(new Error("quota exhausted"), { status: options.headers["x-goog-api-key"] === "paid" ? 402 : 429 });
   return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ sheet: prompt }) }] } }] };
  }
  if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  hosts.add(new URL(url).host);
  const body = JSON.parse(options.body);
  fallbackPrompts.push(body.messages[0].content);
  return response({ sheet: body.messages[0].content });
 };
 for (let i = 0; i < 20; i++) {
  prompt = "Full sheet " + i + "\n" + "complete source ".repeat(2800) + "END";
  const result = await analyzeStructured(prompt, { type: "object" }, value => assert.equal(value.sheet, prompt), { env, transport });
  completed.push(result);
 }
 assert.equal(completed.length, 20);
 assert.deepEqual(completed.slice(16).map(row => row.keySlot), Array(4).fill("OPENAI_API_KEY"));
 assert.equal(fallbackPrompts.length, 4);
 assert.ok(fallbackPrompts.every(value => value.endsWith("END") && value.length > 39000));
 assert.deepEqual([...hosts], ["api.openai.com"], "Groq is never asked");
});

test("An incomplete OpenAI answer is never accepted", async () => {
 const transport = async () => ({ choices: [{ finish_reason: "length", message: { content: '{"ok":true}' } }] });
 await assert.rejects(analyzeStructured("full sheet ".repeat(6000), { type: "object" }, () => {}, { candidates: [candidates[1]], transport }), /Incomplete OpenAI analysis: length/);
});

test("A sheet reading never reaches Groq, whatever Groq keys exist", () => {
 const config = { GROQ_API_KEY: "gk", GROQ_API_KEY_2: "gk2", GROQ_MODEL: "groq-m", GROQ_ANALYSIS_MODEL: "groq-a", GEMINI_API_KEY_2: "g2", GEMINI_ANALYSIS_MODEL: "pro-x", OPENAI_API_KEY: "oa" };
 for (const mode of ["semantic", "schema"]) assert.ok(providerCandidates(config, mode).every(candidate => candidate.name === "gemini" || candidate.name === "openai"), mode);
});

/* ---------- sheet analysis shares the server's view of resting Gemini keys ---------- */

const geminiTransport = (calls, answer) => async (url, opts) => {
  if (url.endsWith(":countTokens")) return { totalTokens: 100 };
  if (url.endsWith(":generateContent")) {
    const key = opts.headers["x-goog-api-key"], model = decodeURIComponent(url.split("/models/")[1].split(":")[0]);
    calls.push(key + "/" + model);
    return answer({ key, model });
  }
  return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
};
const gem = (key, model) => ({ name: "gemini", key, keySlot: "K_" + key, model });
const okReply = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] };
const quotaError = () => Object.assign(new Error("Analysis provider HTTP 429: quota"), { status: 429, payload: { error: { details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "250" }] }] } } });

test("Sheet analysis skips a (key, model) pair the server already knows is spent, without a single request", async () => {
  const ledger = createGeminiLedger();
  ledger.fail("k1", "m1", { status: 429, payload: quotaError().payload });
  const calls = [];
  const result = await analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), {
    candidates: [gem("k1", "m1"), gem("k2", "m1")], transport: geminiTransport(calls, () => okReply), outputTokens: 1000, ledger,
  });
  assert.equal(result.keySlot, "K_k2");
  assert.deepEqual(calls, ["k2/m1"], "k1/m1 was not even asked");
});

test("A quota error during sheet analysis is reported, so chat and pictures stop using that pair too", async () => {
  const ledger = createGeminiLedger();
  const calls = [];
  const result = await analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), {
    candidates: [gem("k1", "m1"), gem("k2", "m1")], transport: geminiTransport(calls, ({ key }) => { if (key === "k1") throw quotaError(); return okReply; }), outputTokens: 1000, ledger,
  });
  assert.equal(result.keySlot, "K_k2");
  assert.ok(ledger.restMs("k1", "m1") > 3600 * 1000, "rested until the daily reset");
  assert.equal(ledger.restMs("k2", "m1"), 0);
  assert.equal(ledger.restMs("k1", "m2"), 0, "other models on that key stay open");
});

test("An answer that arrives but does not validate says nothing about the key: it is never rested for it", async () => {
  const ledger = createGeminiLedger();
  const calls = [];
  const bad = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] };
  for (let round = 0; round < 3; round += 1) {
    await analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), {
      candidates: [gem("k1", "m1"), gem("k2", "m1")], transport: geminiTransport(calls, ({ key }) => (key === "k1" ? bad : okReply)), outputTokens: 1000, ledger,
    });
  }
  assert.equal(ledger.restMs("k1", "m1"), 0, "three invalid answers in a row are not three provider failures");
});

test("When every pair rests, the analysis fails as 'transient' so the job waits and retries", async () => {
  const ledger = createGeminiLedger();
  ledger.fail("k1", "m1", { status: 429, payload: quotaError().payload });
  const calls = [];
  const error = await analyzeStructured("Complete source", { type: "object" }, () => {}, { candidates: [gem("k1", "m1")], transport: geminiTransport(calls, () => okReply), outputTokens: 1000, ledger }).then(() => null, (e) => e);
  assert.ok(error, "it failed");
  assert.deepEqual(calls, []);
  assert.ok(error.failures.every((f) => f.transient === true), "every failure is worth retrying later");
});

test("proxy.js hands the shared ledger to the sheet analysis", () => {
  assert.match(serverSource, /registerBondAnalysis\(app, \{[^}]*ledger: GEMINI_LEDGER[,} ]/);
  assert.match(serverSource, /resumeEveryMs: process\.env\.BOND_ANALYSIS_RESUME_MS/, "the server carries a reading on without the app");
});

/* ---------- when one Gemini model is overloaded or spent, sheet analysis moves to the next model ---------- */

const modelOfUrl = (url) => decodeURIComponent(url.split("/models/")[1].split(":")[0]);
function ladderRun({ env = {}, answer, ledger = null, validate = (value) => assert.equal(value.ok, true) }) {
  const attempted = [], bodies = [];
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) {
      const key = opts.headers["x-goog-api-key"], model = modelOfUrl(url);
      attempted.push(model + "@" + key);
      bodies.push({ model, body: JSON.parse(opts.body) });
      return answer({ key, model });
    }
    if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
    return { choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] };
  };
  const full = { GEMINI_API_KEY_2: "g2", GEMINI_API_KEY_3: "g3", GEMINI_ANALYSIS_MODEL: "pro-x", GEMINI_MODEL: "flash-x", ...env };
  return analyzeStructured("Complete source", { type: "object" }, validate, { env: full, transport, outputTokens: 1000, ledger }).then(
    (result) => ({ result, attempted, bodies }), (error) => ({ error, attempted, bodies }),
  );
}
const ok = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] };
const quotaDay = () => Object.assign(new Error("Analysis provider HTTP 429: quota"), { status: 429, payload: { error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } } });
const busy503 = () => Object.assign(new Error("Analysis provider HTTP 503: This model is currently experiencing high demand. Spikes in demand are usually temporary."), { status: 503, payload: { error: { message: "This model is currently experiencing high demand." } } });

test("Sheet analysis tries the owner's models, then the other full models, then the light ones, each model on every key before the next", async () => {
  const out = await ladderRun({ answer: () => { throw quotaDay(); } });
  const models = [...new Set(out.attempted.map((row) => row.split("@")[0]))];
  assert.deepEqual(models, ["pro-x", "flash-x", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"]);
  assert.deepEqual(out.attempted.slice(0, 4), ["pro-x@g2", "pro-x@g3", "flash-x@g2", "flash-x@g3"], "model by model");
  assert.equal(out.attempted.length, 16, "eight models on two keys");
});

test("A model that is overloaded (503 high demand) is not asked again on the other keys: the next model answers", async () => {
  const ledger = createGeminiLedger();
  const out = await ladderRun({ ledger, answer: ({ model }) => { if (model === "pro-x") throw quotaDay(); if (model === "flash-x") throw busy503(); return ok; } });
  assert.equal(out.result.model, "gemini-3.5-flash");
  assert.deepEqual(out.attempted, ["pro-x@g2", "pro-x@g3", "flash-x@g2", "gemini-3.5-flash@g2"], "flash-x was tried once, not on every key");
  assert.ok(ledger.restMs("g3", "flash-x") > 0, "and the whole model rests for a minute");
});

test("The result says which model of the ladder finally read the sheet", async () => {
  const out = await ladderRun({ answer: ({ model }) => { if (/lite/.test(model)) return ok; throw busy503(); } });
  assert.equal(out.result.model, "gemini-3.5-flash-lite");
});

test("With no Gemini model configured there is still nothing to try, however many keys exist", async () => {
  const out = await ladderRun({ env: { GEMINI_ANALYSIS_MODEL: "", GEMINI_MODEL: "" }, answer: () => ok });
  assert.match(out.error.message, /No analysis provider is configured/);
  assert.deepEqual(out.attempted, []);
});

test("Normalising a malformed answer uses the light Gemini models first, with a low thinking level", async () => {
  const out = await ladderRun({
    env: { GROQ_API_KEY: "gk", GROQ_MODEL: "groq-m" },
    validate: (value) => assert.equal(value.ok, true),
    answer: ({ model }) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: model === "pro-x" ? '{"ok":false}' : '{"ok":true}' }] } }] }),
  });
  assert.equal(out.result.model, "pro-x", "the reading is still credited to the model that did it");
  assert.equal(out.result.formatterModel, "gemini-3.5-flash-lite");
  assert.deepEqual(out.attempted, ["pro-x@g2", "gemini-3.5-flash-lite@g2"], "no Groq call, and the repair did not start on the full models");
  assert.equal(out.bodies[0].body.generationConfig.thinkingConfig.thinkingLevel, "HIGH");
  assert.equal(out.bodies[1].body.generationConfig.thinkingConfig.thinkingLevel, "LOW");
});

test("With Groq keys configured a repair is still done by a light Gemini model", async () => {
  const out = await ladderRun({
    env: { GROQ_API_KEY: "gk", GROQ_MODEL: "groq-m" },
    answer: ({ model }) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: model === "pro-x" ? "{}" : '{"ok":true}' }] } }] }),
  });
  assert.equal(out.result.formatterProvider, "gemini");
});

test("A model with no free quota (limit 0) is asked once, not on every key, and the log says what Google answered", async () => {
  const zero = () => Object.assign(new Error("Analysis provider HTTP 429: quota"), { status: 429, payload: { error: { details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "0" }] }] } } });
  const logged = [];
  const original = console.warn;
  console.warn = (...args) => logged.push(args.join(" "));
  try {
    const ledger = createGeminiLedger();
    const out = await ladderRun({ ledger, answer: ({ model }) => { if (model === "pro-x") throw zero(); return ok; } });
    assert.equal(out.result.model, "flash-x");
    assert.deepEqual(out.attempted, ["pro-x@g2", "flash-x@g2"], "pro-x was asked on one key only");
    assert.ok(logged.some((line) => /\[bond-analysis-gemini\] pro-x GEMINI_API_KEY_2 HTTP 429 model-no-free-quota\/per-day limit=0 GenerateRequestsPerDay/.test(line)), logged.join(" | "));
    assert.ok(!logged.some((line) => /g2|g3/.test(line.replace(/GEMINI_API_KEY_\d/g, ""))), "no key value is ever logged");
  } finally { console.warn = original; }
});

test("A short reading may not hang for ten minutes on one model: four minutes, then the next model; long sheets keep ten", async () => {
  assert.equal(generationTimeoutMs(6652), 240000);
  assert.equal(generationTimeoutMs(40000), 240000);
  assert.equal(generationTimeoutMs(40001), 600000);
  const seen = [];
  const transport = async (url, opts) => {
    seen.push({ kind: url.endsWith(":generateContent") ? "generate" : url.endsWith(":countTokens") ? "count" : "meta", timeoutMs: opts.timeoutMs });
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) return ok;
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  await analyzeStructured("short source", { type: "object" }, (value) => assert.equal(value.ok, true), { env: { GEMINI_API_KEY_2: "g2", GEMINI_ANALYSIS_MODEL: "pro-x" }, transport, outputTokens: 1000 });
  assert.deepEqual(seen.map((row) => [row.kind, row.timeoutMs]), [["meta", 60000], ["count", 60000], ["generate", 240000]]);
});

/* ---------- the free keys are split: 3 are the home of the plain Flash models, 4 of the light ones ---------- */

const sevenKeys = (extra = {}) => {
  const env = { GEMINI_ANALYSIS_MODEL: "gemini-3.8-flash", ...extra };
  for (let i = 2; i <= 8; i += 1) env["GEMINI_API_KEY_" + i] = "k" + i;
  return env;
};
const pairs = (list) => list.map((candidate) => candidate.model.replace("gemini-", "") + "@" + candidate.keySlot.replace("GEMINI_API_KEY_", ""));
const flashModels = ["3.8-flash", "3.5-flash", "3.7-flash", "3.6-flash"], liteModels = ["3.5-flash-lite", "3.1-flash-lite", "2.5-flash-lite"];

test("Of the 7 free keys 3 carry the plain Flash models (3.8, 3.5, then the other full ones) and 4 carry the light ones", () => {
  const list = pairs(providerCandidates(sevenKeys(), "semantic"));
  const home = list.slice(0, flashModels.length * 3 + liteModels.length * 4);
  assert.deepEqual(home.slice(0, flashModels.length * 3), flashModels.flatMap((model) => ["2", "3", "4"].map((key) => model + "@" + key)), "Flash model by model on keys 2-4 only");
  assert.deepEqual(home.slice(flashModels.length * 3), liteModels.flatMap((model) => ["5", "6", "7", "8"].map((key) => model + "@" + key)), "then the light models on keys 5-8 only");
  assert.ok(!home.some((row) => /flash-lite@[234]$/.test(row) || /^[0-9.]+-flash@[5678]$/.test(row)), "nothing crosses over in the home part");
});

test("Each group then helps the other, so no free key or model is wasted before OpenAI", () => {
  const list = pairs(providerCandidates(sevenKeys(), "semantic"));
  const homeLength = flashModels.length * 3 + liteModels.length * 4;
  const rest = list.slice(homeLength);
  assert.deepEqual(rest.slice(0, flashModels.length * 4), flashModels.flatMap((model) => ["5", "6", "7", "8"].map((key) => model + "@" + key)), "Flash models on the light keys");
  assert.deepEqual(rest.slice(flashModels.length * 4), liteModels.flatMap((model) => ["2", "3", "4"].map((key) => model + "@" + key)), "light models on the Flash keys");
  assert.equal(new Set(list).size, list.length, "no (model, key) pair twice");
  assert.equal(list.length, 7 * (flashModels.length + liteModels.length), "every model on every free key, once");
});

test("BOND_ANALYSIS_FLASH_KEYS moves the split, and the starting key of each group rotates between jobs", () => {
  const two = pairs(providerCandidates(sevenKeys({ BOND_ANALYSIS_FLASH_KEYS: "2", GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off" }), "semantic"));
  assert.deepEqual(two.slice(0, 2), ["3.8-flash@2", "3.8-flash@3"]);
  const rotated = pairs(providerCandidates(sevenKeys({ GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off" }), "semantic", 1));
  assert.deepEqual(rotated.slice(0, 3), ["3.8-flash@3", "3.8-flash@4", "3.8-flash@2"], "the Flash group starts on its second key");
  assert.deepEqual(rotated.slice(3, 7), ["3.8-flash@6", "3.8-flash@7", "3.8-flash@8", "3.8-flash@5"], "and the other group on its own second key");
});

test("When the plain Flash models are overloaded the light models on the 4 light keys read the sheet, in a few requests", async () => {
  const attempted = [];
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) {
      const model = decodeURIComponent(url.split("/models/")[1].split(":")[0]);
      attempted.push(model.replace("gemini-", "") + "@" + opts.headers["x-goog-api-key"]);
      if (!/lite/.test(model)) throw busy503();
      return ok;
    }
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const result = await analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), { env: sevenKeys(), transport, outputTokens: 1000, ledger: createGeminiLedger() });
  assert.equal(result.model, "gemini-3.5-flash-lite");
  assert.equal(result.keySlot, "GEMINI_API_KEY_5");
  assert.deepEqual(attempted, ["3.8-flash@k2", "3.5-flash@k2", "3.7-flash@k2", "3.6-flash@k2", "3.5-flash-lite@k5"], "each busy model was asked once, then the first light key answered");
});

test("The paid Gemini key stays opt-in and is asked after every free candidate, OpenAI after it", () => {
  const without = providerCandidates(sevenKeys({ GEMINI_API_KEY: "paid", OPENAI_API_KEY: "oa" }), "semantic");
  assert.ok(without.every((candidate) => candidate.key !== "paid"));
  assert.equal(without.at(-1).name, "openai");
  const withPaid = providerCandidates(sevenKeys({ GEMINI_API_KEY: "paid", OPENAI_API_KEY: "oa", AI_ALLOW_PAID_BACKGROUND: "1" }), "semantic");
  const firstPaid = withPaid.findIndex((candidate) => candidate.key === "paid");
  assert.ok(firstPaid > 0 && withPaid.slice(0, firstPaid).every((candidate) => candidate.key !== "paid" && candidate.name === "gemini"));
  assert.equal(withPaid.slice(firstPaid, -1).every((candidate) => candidate.key === "paid"), true);
  assert.equal(withPaid.at(-1).name, "openai");
});

test("Repair work starts on the light models of the light keys, then the plain Flash models", () => {
  const list = pairs(providerCandidates(sevenKeys(), "schema"));
  assert.deepEqual(list.slice(0, 4), ["3.5-flash-lite@5", "3.5-flash-lite@6", "3.5-flash-lite@7", "3.5-flash-lite@8"]);
  assert.ok(list.indexOf("3.5-flash@2") > list.indexOf("2.5-flash-lite@4"), "plain Flash only after every light model");
});

/* ---------- bond texts: shorter is fine, empty or one word is not ---------- */

const evidenceLine = "Anna Bélával jár edzeni.";
const supportedBond = (extra = {}) => bond("a", "b", {
  type: "edzőpartner", status: "aktív", source: "explicit", evidence: [evidenceLine],
  summary: "Anna rendszeresen edz Bélával. Ez közös hétköznapokat ad nekik.",
  description: "Anna Bélával jár edzeni, így hetente többször találkoznak. A lap ennél többet nem mond, ezért kapcsolatuk edzőpartneri marad. Személyes érzésről nem esik szó.",
  publicFace: "Együtt látják őket az edzéseken.", ...extra,
});
const checkBond = (value) => validateBonds({ bonds: [value] }, "a", [{ id: "b" }], evidenceLine, {});

test("A compact supported bond (3 sentences) is accepted: shorter descriptions are fine", () => {
  checkBond(supportedBond());
});

test("A supported description needs at least 3 sentences and enough words to be real sentences", () => {
  assert.throws(() => checkBond(supportedBond({ description: "Anna Bélával jár edzeni, így hetente többször találkoznak. A lap ennél többet nem mond." })), /prose sentence counts/);
  assert.throws(() => checkBond(supportedBond({ description: "Edz. Jár. Együtt." })), /description is too short|prose sentence counts/);
});

test("Never one word and never empty: summary, description, publicFace and type", () => {
  assert.throws(() => checkBond(supportedBond({ summary: "Barátok. Edzenek." })), /summary is too short/);
  assert.throws(() => checkBond(supportedBond({ publicFace: "Barát." })), /publicFace is too short/);
  assert.throws(() => checkBond(supportedBond({ summary: "" })), /prose sentence counts|Empty bond description/);
  assert.throws(() => checkBond(supportedBond({ type: "  " })), /Empty bond description/);
  const stranger = (extra) => validateBonds({ bonds: [bond("a", "b", extra)] }, "a", [{ id: "b" }], "Sima diák.", {});
  stranger({});
  assert.throws(() => stranger({ summary: "Ismeretlen." }), /summary is too short/);
  assert.throws(() => stranger({ description: "Nincs." }), /description is too short/);
  assert.throws(() => stranger({ summary: "   " }), /prose sentence counts|Empty bond description/);
});

test("The prompt asks for compact but always filled texts, and still lets the unsupported fields stay empty", () => {
  assert.match(BASELINE_PROMPT, /description: 3–5 coherent sentences/);
  assert.match(BASELINE_PROMPT, /summary: 2–3 sentences/);
  assert.match(BASELINE_PROMPT, /publicFace: 1–2 sentences/);
  assert.match(BASELINE_PROMPT, /type, summary, description and publicFace are ALWAYS filled with real sentences/);
  assert.match(BASELINE_PROMPT, /hiddenFeelings\/history\/dynamics\/wants: null without support/);
});

/* ---------- a reading that cannot be repaired must not run up paid calls ---------- */

test("The paid repair is asked once per reading, however many models give an answer that does not validate", async () => {
  const env = sevenKeys({ OPENAI_API_KEY: "oa", OPENAI_SCHEMA_MODEL: "schema-openai", GEMINI_EXTRA_MODELS: "off", GEMINI_LITE_MODELS: "off" });
  let openaiCalls = 0;
  const logged = [];
  const warn = console.warn; console.warn = (...args) => logged.push(args.join(" "));
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] };
    if (url.includes("generativelanguage")) return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
    openaiCalls += 1;
    return { choices: [{ finish_reason: "stop", message: { content: '{"ok":false}' } }] };
  };
  try {
    await assert.rejects(analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), { env, transport, outputTokens: 1000 }), /No analysis provider completed/);
  } finally { console.warn = warn; }
  assert.equal(openaiCalls, 2, "one paid repair, plus the one paid semantic reading itself");
  assert.ok(logged.some((line) => /^\[bond-analysis-invalid\] gemini\/gemini-3\.8-flash \[GEMINI_API_KEY_2\] /.test(line)), "what the model got wrong is visible at once: " + logged.slice(0, 2).join(" | "));
  assert.ok(logged.every((line) => !/\bk[2-8]\b|oa\b/.test(line.replace(/GEMINI_API_KEY_\d/g, ""))), "no key value is ever logged");
});

/* ---------- an unbacked subjective field becomes null instead of failing the whole reading ---------- */

test("A subjective field without an own-sheet quote becomes null; one with a quote stays", () => {
  const quote = "Anna titokban többet érez Béla iránt.";
  const filled = supportedBond({
    evidence: [quote], hiddenFeelings: "Anna többre vágyik, mint barátságra.", dynamics: "Anna visszafogja magát Béla mellett.", wants: "Közelebb kerülni Bélához.", history: "Régi barátok.",
    fieldEvidence: [{ field: "hiddenFeelings", quotes: [quote] }],
  });
  const result = sanitizeBonds({ bonds: [filled] }).bonds[0];
  assert.equal(result.hiddenFeelings, "Anna többre vágyik, mint barátságra.", "backed by its quote: kept");
  assert.equal(result.dynamics, null, "no quote for it: null");
  assert.equal(result.wants, null);
  assert.equal(result.history, "Régi barátok.", "history is proven by the bond's own evidence");
  const stranger = sanitizeBonds({ bonds: [bond("a", "b", { history: "Kitalált közös múlt.", dynamics: "Kitalált." })] }).bonds[0];
  assert.equal(stranger.history, null, "no evidence at all: no shared history");
  assert.equal(stranger.dynamics, null);
});

test("After sanitising, exactly the answer that used to fail with 'Unsupported own-sheet feeling' is valid, and a fake quote still is not", () => {
  const sheet = "Anna Bélával jár edzeni.";
  const answer = (extra = {}) => ({ bonds: [supportedBond({ dynamics: "Anna visszafogja magát.", wants: "Közelebb kerülni.", ...extra })] });
  assert.throws(() => validateBonds(answer(), "a", [{ id: "b" }], sheet, {}), /Unsupported own-sheet feeling: dynamics/, "the old behaviour: the whole reading is rejected");
  const fixed = sanitizeBonds(answer());
  validateBonds(fixed, "a", [{ id: "b" }], sheet, {});
  assert.equal(fixed.bonds[0].dynamics, null);
  assert.throws(() => validateBonds(sanitizeBonds(answer({ evidence: ["kitalált idézet"] })), "a", [{ id: "b" }], sheet, {}), /verbatim|quote/i, "verbatim quotes stay strict");
  assert.throws(() => validateBonds(sanitizeBonds(answer({ fieldEvidence: [{ field: "dynamics", quotes: ["kitalált idézet"] }] })), "a", [{ id: "b" }], sheet, {}), /verbatim|quote/i, "a fake quote for a field is still rejected, not silently dropped");
});

test("Sanitising leaves anything that is not shaped like a bond to the schema check", () => {
  assert.equal(sanitizeBonds(null), null);
  assert.deepEqual(sanitizeBonds({ bonds: [null, 5, {}] }), { bonds: [null, 5, {}] });
  assert.deepEqual(sanitizeBonds({ other: 1 }), { other: 1 });
});

/* ---------- a repair that cannot work stops early and respects the shared ledger ---------- */

test("A repair stops after two answers that still do not validate, instead of walking every model and key", async () => {
  const semantic = gem("s", "full");
  const repairs = ["lite-a", "lite-b", "lite-c"].flatMap((model) => ["k1", "k2", "k3", "k4"].map((key) => gem(key, model)));
  const asked = [];
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) { asked.push(modelOfUrl(url) + "@" + opts.headers["x-goog-api-key"]); return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] }; }
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const warn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), { candidates: [semantic], schemaCandidates: repairs, transport, outputTokens: 1000 }), /No analysis provider completed/);
  } finally { console.warn = warn; }
  assert.deepEqual(asked, ["full@s", "lite-a@k1", "lite-a@k2"], "one reading, two repairs, then it gives up");
});

test("A repair never asks more than eight times, even when the providers keep failing", async () => {
  const semantic = gem("s", "full");
  const repairs = ["lite-a", "lite-b", "lite-c"].flatMap((model) => ["k1", "k2", "k3", "k4", "k5"].map((key) => gem(key, model)));
  const asked = [];
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) {
      const model = modelOfUrl(url); asked.push(model);
      if (model === "full") return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] };
      throw Object.assign(new Error("Analysis provider HTTP 500: boom"), { status: 500 });
    }
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const warn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), { candidates: [semantic], schemaCandidates: repairs, transport, outputTokens: 1000 }), /No analysis provider completed/);
  } finally { console.warn = warn; }
  assert.equal(asked.length, 1 + 8, "the reading plus at most eight repair attempts");
});

test("A repair model that Google no longer offers (404) is asked once, not on every key, and the ledger learns it", async () => {
  const semantic = gem("s", "full");
  const repairs = ["gone-model", "good-model"].flatMap((model) => ["k1", "k2", "k3"].map((key) => gem(key, model)));
  const asked = [];
  const transport = async (url, opts) => {
    if (url.endsWith(":countTokens")) return { totalTokens: 100 };
    if (url.endsWith(":generateContent")) {
      const model = modelOfUrl(url); asked.push(model + "@" + opts.headers["x-goog-api-key"]);
      if (model === "full") return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":false}' }] } }] };
      if (model === "gone-model") throw Object.assign(new Error("Analysis provider HTTP 404: This model models/gone-model is no longer available to new users."), { status: 404, payload: { error: { message: "This model models/gone-model is no longer available to new users." } } });
      return okReply;
    }
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const ledger = createGeminiLedger();
  const warn = console.warn; console.warn = () => {};
  let result;
  try {
    result = await analyzeStructured("Complete source", { type: "object" }, (value) => assert.equal(value.ok, true), { candidates: [semantic], schemaCandidates: repairs, transport, outputTokens: 1000, ledger });
  } finally { console.warn = warn; }
  assert.equal(result.formatterModel, "good-model");
  assert.deepEqual(asked, ["full@s", "gone-model@k1", "good-model@k1"], "the gone model was asked on one key only");
  assert.ok(ledger.restMs("k2", "gone-model") > 0, "and every other key now knows it is gone");
});

/* ---------- what the rules already decide is applied, so one detail no longer sinks a reading ---------- */

const rivalFact = { type: "rivális", group: "Cobra Kai", source: "logikai következtetés", evidence: [{ sheetOf: "a", quote: "Anna a Cobra Kai tagja." }, { sheetOf: "b", quote: "Béla a Miyagi-dojo tanítványa." }] };
const sheetText = "Anna Bélával jár edzeni. Anna a Cobra Kai tagja.";
const sanitizeContext = (extra = {}) => ({ ownSheet: sheetText, factsByTarget: { b: [rivalFact] }, cast: new Set(["a", "b", "c"]), ...extra });

test("The group layer and the quotes of the objective facts the server supplied are completed when the model left them out", () => {
  const answer = () => ({ bonds: [supportedBond({ layers: [], factEvidence: [] })] });
  assert.throws(() => validateBonds(answer(), "a", [{ id: "b" }], sheetText, { b: [rivalFact] }), /Missing deterministic group layer: rivális/, "the old behaviour: the whole reading is rejected");
  const fixed = sanitizeBonds(answer(), sanitizeContext());
  assert.deepEqual(fixed.bonds[0].layers, ["rivális"]);
  assert.deepEqual(fixed.bonds[0].factEvidence, rivalFact.evidence);
  validateBonds(fixed, "a", [{ id: "b" }], sheetText, { b: [rivalFact] });
  const again = sanitizeBonds(structuredClone(fixed), sanitizeContext());
  assert.deepEqual(again, fixed, "applying it twice changes nothing");
});

test("A cross-sheet quote that is not among the supplied facts is removed, never kept", () => {
  const fake = { sheetOf: "b", quote: "Béla titokban Anna ellensége." };
  const fixed = sanitizeBonds({ bonds: [supportedBond({ layers: ["rivális"], factEvidence: [...rivalFact.evidence, fake] })] }, sanitizeContext());
  assert.deepEqual(fixed.bonds[0].factEvidence, rivalFact.evidence);
  validateBonds(fixed, "a", [{ id: "b" }], sheetText, { b: [rivalFact] });
});

test("A quote that is not verbatim in the owner's sheet is dropped; a field it alone backed becomes null", () => {
  const good = "Anna Bélával jár edzeni.";
  const answer = supportedBond({ evidence: [good, "Béla a Miyagi-dojo tanítványa."], hiddenFeelings: "Anna tart Bélától.", wants: "Győzni.", fieldEvidence: [{ field: "hiddenFeelings", quotes: ["kitalált idézet"] }, { field: "wants", quotes: [good, "ez sincs a lapon"] }], layers: ["rivális"], factEvidence: rivalFact.evidence });
  const fixed = sanitizeBonds({ bonds: [answer] }, sanitizeContext()).bonds[0];
  assert.deepEqual(fixed.evidence, [good]);
  assert.equal(fixed.hiddenFeelings, null, "its only quote was fake");
  assert.equal(fixed.wants, "Győzni.", "one verbatim quote is enough");
  assert.deepEqual(fixed.fieldEvidence, [{ field: "wants", quotes: [good] }]);
  validateBonds({ bonds: [fixed] }, "a", [{ id: "b" }], sheetText, { b: [rivalFact] });
});

test("Witnesses outside the cast go, and an 'explicit' bond with no evidence at all becomes an inference", () => {
  const fixed = sanitizeBonds({ bonds: [bond("a", "b", { source: "explicit", whoKnows: ["a", "ghost", "c"] })] }, { ownSheet: "Sima diák.", factsByTarget: { b: [] }, cast: new Set(["a", "b", "c"]) }).bonds[0];
  assert.deepEqual(fixed.whoKnows, ["a", "c"]);
  assert.equal(fixed.source, "logikai következtetés");
  validateBonds({ bonds: [fixed] }, "a", [{ id: "b" }], "Sima diák.", { b: [] }, ["a", "b", "c"]);
});

test("Without an outside context the sanitiser touches no evidence or layer", () => {
  const answer = supportedBond({ evidence: ["valami"], layers: [], factEvidence: [{ sheetOf: "b", quote: "x" }] });
  const before = structuredClone(answer);
  sanitizeBonds({ bonds: [answer] });
  assert.deepEqual(answer.evidence, before.evidence); assert.deepEqual(answer.layers, before.layers); assert.deepEqual(answer.factEvidence, before.factEvidence);
});

/* ---------- the Bonds screen has a button per character ---------- */

test("The Bonds screen can re-analyse one character without a world restart", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const bonds = source.slice(source.indexOf("function Bonds({ w, update, setErr })"), source.indexOf("function Bonds({ w, update, setErr })") + 6000);
  assert.match(bonds, /force: !only, only: only \|\| null/, "one character: not a forced read of everyone");
  assert.match(bonds, /installBondGraph\(n, result, allSubjects, \{ reset: only \? \[only\] : \[\] \}\)/, "and only their bonds are reset to the fresh reading");
  assert.match(bonds, /reanalyze\(me\.id\)/, "a button for the character being looked at, whoever that is");
  assert.match(bonds, /reanalyze\(null\)/, "the slow read of everything is still there, and says so");
  assert.match(bonds, /Re-analyze \$\{me\.name\}'s bonds/);
  assert.match(bonds, /Re-analyze ALL bonds \(slow\)/);
  assert.ok(!/restartWorld|bondReset/.test(bonds), "no restart is involved");
});
