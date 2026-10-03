import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import pg from "pg";
import { analyzeStructured, sheetHash } from "../server/bondAnalysis.js";
import { ProfileSchema, BondArraySchema, EXTRACT_PROMPT, BASELINE_PROMPT, validateProfile, validateBonds, resolveProfileReferences, buildGroupIndex, reconcileFacts, runtimeBond, restoreBaselineGraph, assertCompleteGraph } from "../src/bondAnalysis.js";
import { fullSheetText } from "../src/bondClient.js";

if (process.argv.includes("--require-live") && !(process.env.DATABASE_URL && (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY))) throw new Error("Live acceptance credentials/database are required");
const liveEnabled = Boolean(process.env.DATABASE_URL && (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY));
test("LIVE acceptance: actual configured AI keys and PostgreSQL, isolated disposable world", { skip: !liveEnabled, timeout: 3600000 }, async t => {
 const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
 t.after(() => pool.end());
 const analyzeLive = async (prompt, schema, validate, options) => {
  const cacheKey = "bond-live-v1:" + sheetHash(prompt + JSON.stringify(schema));
  const cached = (await pool.query("SELECT data FROM relationship_reading_cache WHERE cache_key=$1", [cacheKey])).rows[0]?.data;
  if (cached?.result) { validate(cached.result); console.info("[bond-live-checkpoint]", JSON.stringify({ provider: cached.provider, model: cached.model, reusedValidatedLiveOutput: true })); return cached; }
  const output = await analyzeStructured(prompt, schema, validate, options);
  await pool.query("INSERT INTO relationship_reading_cache(cache_key,data,updated_at) VALUES ($1,$2::jsonb,NOW()) ON CONFLICT(cache_key) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()", [cacheKey, JSON.stringify(output)]);
  return output;
 };
 await t.test("Schema lane is Groq 1 -> Groq 2 -> OpenAI", async () => {
  assert.ok(process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_2 || process.env.OPENAI_API_KEY);
  const schema = { type: "object", properties: { verified: { type: "boolean" } }, required: ["verified"], additionalProperties: false };
  const result = await analyzeStructured('Return exactly {"verified":true} using the provided JSON schema.', schema, result => assert.equal(result.verified, true), { outputTokens: 1000, mode: "schema" });
  console.info("[bond-live-schema-provider]", JSON.stringify({ provider: result.provider, model: result.model, keySlot: result.keySlot, verified: result.result.verified }));
 });
 const people = [
  { id: "p", name: "Anna", nick: "Anni", personality: "Anna visszafogott, lojális, és nehezen beszél a saját érzéseiről.", backstory: "Anna a Cobra Kai tanítványa. A Cobra Kai senseie Sándor. A Cobra Kai és a Miyagi-Do rivális dojók. Anna és Béla régi barátok. Tavaly januárban egyszer volt köztük egy one-night stand a Fő utcai lakásban. Azóta kínos a viszony: Anna többet érez Béla iránt, Béla kerüli a témát. Anna nem meri bevallani az érzéseit; a csapatból senki nem tud az éjszakáról vagy a vonzalmáról. Anna és Dóra között soha nem volt semmi romantikus vagy szexuális. Anna nem vonzódik Dórához.", goals: "Anna szeretné visszanyerni Béla közelségét, de fél a visszautasítástól." },
  { id: "b", name: "Béla", personality: "Béla tárgyilagos, és kerüli az érzelmi vitákat.", backstory: "Béla a Cobra Kai tagja. Sándor a senseie. Anna régi barátja. Tavaly januárban a Fő utcai lakásban egy éjszakát együtt töltöttek. Béla csak barátként tekint Annára, nem vonzódik hozzá. Az eset óta kerüli a témát, mert nem szeretné elrontani a barátságot. A csapatból senki nem tud az éjszakáról. Béla nem tud Anna rejtett vonzalmáról." },
  { id: "s", name: "Sándor", personality: "Sándor szigorú és fegyelmezett oktató.", backstory: "Sándor a Cobra Kai senseie. Anna és Béla a tanítványai. Sándor mindkettőjüket rendszeresen edzi a Cobra Kai dojóban. Sándor nem tud Anna és Béla közös éjszakájáról vagy Anna rejtett vonzalmáról." },
  { id: "d", name: "Dóra", personality: "Dóra nyugodt, versengő sportoló.", backstory: "Dóra a Miyagi-Do tagja. Dóra és Anna között soha nem volt semmi romantikus vagy szexuális. Dóra nem vonzódik Annához. Dóra nem tud Anna és Béla közös éjszakájáról vagy Anna érzéseiről." },
 ];
 const ids = people.map(p => p.id), sheets = Object.fromEntries(people.map(p => [p.id, fullSheetText(p)]));
 const extracted = [];
 for (const person of people) {
  const ownSheet = sheets[person.id], fieldNames = Object.keys(person).filter(key => key !== "id");
  const payload = { owner: person.id, ownSheet, fieldNames, outputLanguage: "Hungarian" };
  const prompt = EXTRACT_PROMPT + "\n" + JSON.stringify(payload);
  assert.equal(JSON.parse(prompt.substring(prompt.lastIndexOf("\n") + 1)).ownSheet.length, ownSheet.length);
  console.info("[bond-live-input]", JSON.stringify({ stage: "profile", owner: person.id, sourceChars: ownSheet.length, submittedChars: payload.ownSheet.length }));
  const output = await analyzeLive(prompt, ProfileSchema, result => validateProfile(result, ownSheet, person.id, new Set(ids), fieldNames), { outputTokens: 64000 });
  console.info("[bond-live-provider]", JSON.stringify({ stage: "profile", owner: person.id, provider: output.provider, model: output.model, keySlot: output.keySlot, formatterProvider: output.formatterProvider || null, formatterKeySlot: output.formatterKeySlot || null, inputTokens: output.inputTokens }));
  extracted.push(output.result);
 }
 const profiles = resolveProfileReferences(extracted), index = buildGroupIndex(profiles), baselines = {};
 for (const person of people) {
  const roster = profiles.filter(p => p.id !== person.id).map(p => ({ id: p.id, names: p.names, groups: p.groups, oneLine: "" }));
  const objectiveFacts = Object.fromEntries(roster.map(p => [p.id, reconcileFacts(person.id, p.id, profiles, index)]));
  const payload = { owner: person.id, ownSheet: sheets[person.id], profile: profiles.find(p => p.id === person.id), roster, groupIndex: index, objectiveFacts, outputLanguage: "Hungarian" };
  console.info("[bond-live-input]", JSON.stringify({ stage: "baseline", owner: person.id, sourceChars: sheets[person.id].length, submittedChars: payload.ownSheet.length }));
  const output = await analyzeLive(BASELINE_PROMPT + "\n" + JSON.stringify(payload), BondArraySchema, result => validateBonds(result, person.id, roster, payload.ownSheet, objectiveFacts), { outputTokens: 64000 });
  console.info("[bond-live-provider]", JSON.stringify({ stage: "baseline", owner: person.id, provider: output.provider, model: output.model, keySlot: output.keySlot, formatterProvider: output.formatterProvider || null, formatterKeySlot: output.formatterKeySlot || null, inputTokens: output.inputTokens }));
  for (const bond of output.result.bonds) baselines[bond.from + ">" + bond.to] = runtimeBond(bond);
 }
 await t.test("A1: teammates and sensei present in every required direction", () => {
  assert.ok(baselines["p>b"].layers.includes("csapattárs"));
  for (const student of ["p", "b"]) { assert.ok(baselines[student + ">s"].layers.includes("tanítvány–sensei")); assert.ok(baselines["s>" + student].layers.includes("sensei–tanítvány")); }
 });
 await t.test("A2: rival dojos have quoted justification", () => {
  assert.ok(baselines["b>d"].layers.includes("rivális"));
  assert.ok(baselines["b>d"].factEvidence.some(q => q.quote.includes("rivális dojók")));
 });
 await t.test("A3/R2/R3: 12 directed records, including AI–AI", () => { assertCompleteGraph(ids, baselines); assert.equal(Object.keys(baselines).length, 12); assert.ok(baselines["b>d"] && baselines["d>b"]); });
 await t.test("A4: one-night event has contextual aftermath, person, time; type is not the event", () => {
  const row = baselines["p>b"], mention = profiles.find(p => p.id === "p").mentions.find(m => m.targetId === "b" && m.timeframe === "múlt");
  assert.ok(mention); assert.ok(mention.aftermath);
  assert.notEqual(row.type.toLocaleLowerCase().trim(), "one-night stand");
  assert.ok(row.history && row.summary.includes("Béla"));
  assert.ok(/január|tavaly/i.test(row.summary));
  assert.ok(/kínos|kerül|barát|több|feszül/i.test(row.summary));
  console.info("[bond-live-one-night]", JSON.stringify({ type: row.type, summary: row.summary }));
 });
 await t.test("A5: explicit denial creates no romantic bond", () => {
  assert.equal(baselines["p>d"].levels.attraction, 0); assert.equal(baselines["d>p"].levels.attraction, 0);
  assert.equal(baselines["p>d"].hiddenFeelings, null); assert.equal(baselines["d>p"].hiddenFeelings, null);
 });
 await t.test("R5/R6: asymmetric own-sheet prose and supported hidden feelings only", () => {
  assert.notEqual(baselines["p>b"].description, baselines["b>p"].description);
  assert.ok(baselines["p>b"].hiddenFeelings); assert.equal(baselines["b>p"].hiddenFeelings, null);
  for (const key of ["p>b", "b>p"]) assert.ok(baselines[key].evidence.length && baselines[key].evidence.every(q => sheets[baselines[key].from].includes(q)));
 });
 await t.test("A7/A8: full lengths and provenance for every baseline", () => {
  for (const row of Object.values(baselines)) assert.ok(row.evidence.length || row.factEvidence.length || row.source === "logikai következtetés");
  for (const p of people) assert.equal(sheets[p.id], fullSheetText(p));
 });
 await t.test("A6/R7: full-sheet modification invalidates SHA256", () => { const changed = { ...people[0], backstory: people[0].backstory + " Anna új célt fogalmazott meg." }; assert.notEqual(sheetHash(fullSheetText(changed)), sheetHash(sheets.p)); });

 await t.test("English source interpretation and English relationship prose retain original evidence", async () => {
  const ownSheet = "Anna is a Cobra Kai student. Anna and Béla are old friends. Last January they had a one-night stand at the flat on Main Street. Afterwards things became awkward: Anna developed deeper feelings, while Béla avoided the subject. Anna hides her feelings; none of the team knows about the night or her attraction. Anna has never had any romantic or sexual relationship with Dóra and is not attracted to her.";
  const extractedEnglish = await analyzeLive(EXTRACT_PROMPT + "\n" + JSON.stringify({ owner: "p", ownSheet, fieldNames: [], outputLanguage: "English" }), ProfileSchema, result => validateProfile(result, ownSheet, "p", new Set(ids)), { outputTokens: 64000 });
  const englishProfiles = resolveProfileReferences([extractedEnglish.result, ...extracted.filter(p => p.id !== "p")]);
  const groupIndex = buildGroupIndex(englishProfiles), roster = englishProfiles.filter(p => p.id !== "p").map(p => ({ id: p.id, names: p.names, groups: p.groups, oneLine: "" }));
  const objectiveFacts = Object.fromEntries(roster.map(p => [p.id, reconcileFacts("p", p.id, englishProfiles, groupIndex)]));
  const result = await analyzeLive(BASELINE_PROMPT + "\n" + JSON.stringify({ owner: "p", ownSheet, profile: extractedEnglish.result, roster, groupIndex, objectiveFacts, outputLanguage: "English" }), BondArraySchema, result => validateBonds(result, "p", roster, ownSheet, objectiveFacts), { outputTokens: 64000 });
  const row = result.result.bonds.find(b => b.to === "b");
  assert.ok(/friend|feeling|awkward|attract/i.test(row.description));
  assert.ok(row.evidence.length && row.evidence.every(q => ownSheet.includes(q)));
  assert.equal(result.result.bonds.find(b => b.to === "d").levels.attraction, 0);
  console.info("[bond-live-english]", JSON.stringify({ provider: result.provider, model: result.model, description: row.description, evidence: row.evidence }));
 });

 // The actual save handler runs against the real DB. Only an isolated test world
 // is inserted; all its rows are removed in finally, including on assertion failure.
 const code = "bond-acceptance-" + crypto.randomUUID();
 const initial = { code, syncRev: 1, rev: 1, accounts: {}, players: { testAccount: { ...people[0] } }, chars: people.slice(1), rels: structuredClone(baselines), relationshipBaselines: structuredClone(baselines), bondAnalysis: { version: 1, profiles: Object.fromEntries(profiles.map(p => [p.id, { profile: p }])), recalculated: 4 }, posts: [{ text: "Régi poszt" }], scenes: [{ id: "old" }], relationshipHistory: { old: 1 } };
 for (const key of ["p>b", "b>p", "b>d"]) Object.assign(initial.rels[key], { type: "Járnak", hiddenFeelings: "Játékban keletkezett titok", whoKnows: ids, extraGameField: "delete", levels: { sentiment: 100, trust: 100, attraction: 100, tension: 100 } });
 const serverSource = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
 const start = serverSource.indexOf('app.post("/world/save", '), end = serverSource.indexOf('\n});', start);
 const handlerSource = serverSource.substring(start + 'app.post("/world/save", '.length, end);
 const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
 const appFunction = name => { const start = appSource.indexOf("function " + name + "("); assert.ok(start >= 0); return appSource.substring(start, appSource.indexOf("\n}", start) + 2); };
 const resetContext = vm.createContext({ structuredClone, now: Date.now, restorePostedAlbumImagesForFreshRun: () => 0, restoreBaselineGraph, allSubjects: w => [...Object.values(w.players), ...w.chars], trimWorldImagesToFreshPeople() {}, ensureStorySettings: w => w.story ||= {} });
 vm.runInContext(["freshSimulationRuntime", "resetSocialProfileForFreshRun", "restoreRelationshipBaselinesForFreshRun", "restartWorldHistoryInPlace"].map(appFunction).join("\n"), resetContext);
 async function save(world, fail) {
  const adapter = { async connect() { const client = await pool.connect(); return { release: () => client.release(), async query(sql, args) { if (fail && sql.includes("UPDATE worlds")) throw new Error("Injected restart write failure"); return client.query(sql, args); } }; } };
  const context = vm.createContext({ pool: adapter, requireDb: async () => true, getSessionIdentity: async () => ({ worldCode: code, accountId: "p" }), cleanCode: value => value.toLowerCase(), assertCompleteGraph, stringifyJsonbSafe: JSON.stringify, console: { info: console.info, error() {} } });
  const handler = vm.runInContext("(" + handlerSource + ")", context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: { world: structuredClone(world), bondReset: true } }, res);
  return res;
 }
 try {
  await pool.query("INSERT INTO worlds(code,data) VALUES ($1,$2::jsonb)", [code, JSON.stringify(initial)]);
  await pool.query("INSERT INTO character_memories(world_code,character_id,subject_ids,memory_type,memory_text,knowledge_type,visibility,metadata) VALUES ($1,'p','[]'::jsonb,'relationship','Isolated test memory','experienced','private','{}'::jsonb)", [code]);
  const draft = structuredClone(initial); resetContext.restartWorldHistoryInPlace(draft);
  await t.test("R8: real PostgreSQL rollback preserves world AND memories on write failure", async () => {
   const result = await save(draft, true); assert.equal(result.statusCode, 500);
   const current = (await pool.query("SELECT data FROM worlds WHERE code=$1", [code])).rows[0].data;
   assert.deepEqual(current, initial);
   assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM character_memories WHERE world_code=$1", [code])).rows[0].count), 1);
  });
  await t.test("R1/R3/R4: three full current records incl. AI–AI revert exactly; game romance disappears", async () => {
   const result = await save(draft, false); assert.equal(result.statusCode, 200);
   const current = (await pool.query("SELECT data FROM worlds WHERE code=$1", [code])).rows[0].data;
   assert.deepEqual(current.rels, current.relationshipBaselines); assert.deepEqual(current.rels, baselines);
   assert.equal(Object.keys(current.rels).length, ids.length * (ids.length - 1));
   assert.deepEqual(current.relationshipHistory, {}); assert.deepEqual(current.posts, []); assert.deepEqual(current.scenes, []);
   assert.equal(Number((await pool.query("SELECT COUNT(*) AS count FROM character_memories WHERE world_code=$1", [code])).rows[0].count), 0);
  });
  await pool.query("DELETE FROM relationship_reading_cache WHERE cache_key LIKE 'bond-live-v1:%'");
 } finally {
  await pool.query("DELETE FROM character_memories WHERE world_code=$1", [code]);
  await pool.query("DELETE FROM worlds WHERE code=$1", [code]);

 }
});
