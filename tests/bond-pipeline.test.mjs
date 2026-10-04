import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerBondAnalysis, analyzeStructured, strangerBond, bondAnalysisOutputTokens } from "../server/bondAnalysis.js";
import { EXTRACT_PROMPT, BASELINE_PROMPT, validateBonds } from "../src/bondAnalysis.js";
import { fullSheetText, relationshipSourceText, relationshipFields, characterIdentities, rebuildBondGraph, installBondGraph, analysisReady, bondSourceFingerprint, staleReason } from "../src/bondClient.js";

// The whole path: real client -> real Express handler -> in-memory cache table ->
// scripted "model". The model returns valid output derived from the prompt, so the
// real validators run. What these tests prove is the plumbing: what is read, what is
// re-used, how it fails and recovers.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (condition, what = "condition") => {
  for (let i = 0; i < 600; i += 1) { if (await condition()) return; await sleep(5); }
  throw new Error("timed out waiting for " + what);
};

const person = (id, connections = "Sima diák.") => ({ id, name: id.toUpperCase(), connections });
const subjects = (world) => world.chars;

const profileFor = ({ owner, ownSheet, fieldNames }, mentions = {}) => {
  const name = /\[name\]\n(.*)/.exec(ownSheet)[1];
  const mentioned = mentions[owner] ? [{ targetName: mentions[owner], targetId: null, whatIsSaid: "említi", timeframe: "múlt", tone: "semleges", mutual: "nem derül ki", secret: false, whoKnows: [], negated: false, conditional: false, aftermath: null, evidence: "Sima diák." }] : [];
  const dojo = ownSheet.includes("Cobra Kai");
  return {
    id: owner, names: [name], processedFields: fieldNames,
    claims: [{ field: "names", value: name, evidence: name }],
    groups: dojo ? [{ name: "Cobra Kai", aliases: [], kind: "dojo", role: "tag", rank: null, evidence: "Cobra Kai" }] : [],
    groupRelations: [], mentions: mentioned, facts: [], traits: [], goals: [], fears: [], secrets: [], timeline: [],
  };
};

// witness: a character who (correctly) knows the owner's secret about everyone, even when
// that character is not among the targets of this very call.
const bondsFor = ({ owner, roster, objectiveFacts }, witness = null) => ({
  bonds: roster.map((card) => {
    const facts = objectiveFacts[card.id];
    const factEvidence = facts.flatMap((fact) => fact.evidence.map((e) => ({ sheetOf: e.sheetOf, quote: e.quote })));
    const supported = factEvidence.length > 0;
    return {
      from: owner, to: card.id, type: supported ? "csapattárs" : "semleges", status: supported ? "aktív" : "semleges",
      levels: { sentiment: 0, trust: 0, attraction: 0, tension: 0 }, intensity: 0, confidence: 1,
      summary: supported ? owner + " és " + card.id + " ugyanabban a dojóban edz. Személyes érzésről a lapok nem szólnak." : owner + " nem ismeri " + card.id + " karakterét.",
      description: supported
        ? owner + " ugyanabban a dojóban edz, mint " + card.id + ". Ez közös hétköznapokat jelent. A lap személyes érzést nem említ. A kapcsolat így csapattársi marad."
        : owner + " lapja nem ír személyes viszonyról " + card.id + " felé. Nincs igazolt közös múltjuk.",
      publicFace: "Személyes kapcsolatukról nincs adat.",
      hiddenFeelings: null, history: null, dynamics: null, wants: null,
      whoKnows: witness && witness !== owner && witness !== card.id ? [owner, witness] : [],
      source: "logikai következtetés", evidence: [], fieldEvidence: [], factEvidence,
      layers: facts.filter((fact) => fact.source === "logikai következtetés").map((fact) => fact.type),
    };
  }),
});

async function start({ delay = 0, concurrency, failures, witness = null, mentions = {}, store = new Map(), hang = false, decorate = null } = {}) {
  const calls = [];
  const payloads = [];
  let clockNow = 1_000_000;
  let inFlight = 0;
  let maxInFlight = 0;
  const analyze = async (prompt, schema, validate, options = {}) => {
    const stage = prompt.startsWith(EXTRACT_PROMPT) ? "profile" : "baseline";
    const payload = JSON.parse(prompt.slice((stage === "profile" ? EXTRACT_PROMPT : BASELINE_PROMPT).length + 1));
    calls.push({
      stage,
      owner: payload.owner,
      targets: payload.roster?.map((card) => card.id),
      thinking: options.thinkingLevel,
      outputTokens: options.outputTokens,
      fastCapacityCheck: options.fastCapacityCheck === true,
    });
    payloads.push({ stage, payload });
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await sleep(delay);
      if (hang) await new Promise(() => {});
      const failure = failures?.(calls.length);
      if (failure) throw Object.assign(new Error(failure.message), { failures: failure.failures });
      const result = stage === "profile" ? profileFor(payload, mentions) : bondsFor(payload, witness);
      decorate?.(result, stage);
      validate(result);
      return { result, provider: "mock", model: "mock", keySlot: "MOCK", inputTokens: 1 };
    } finally { inFlight -= 1; }
  };
  const pool = {
    query: async (sql, params) => {
      // The server's own sweep for readings that are still pending (nobody has to ask for them).
      if (/data->>'pending'/.test(sql)) return { rows: [...store].filter(([, data]) => data.pending === true).map(([key, data]) => ({ cache_key: key, data: JSON.parse(JSON.stringify(data)) })) };
      if (/^\s*SELECT/i.test(sql)) return { rows: params[0].filter((key) => store.has(key)).map((key) => ({ cache_key: key, data: JSON.parse(JSON.stringify(store.get(key))) })) };
      store.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    },
  };
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  const handle = registerBondAnalysis(app, {
    pool, requireDb: async () => true, getSessionIdentity: async () => ({ worldCode: "W1" }),
    stringifyJsonbSafe: (data) => JSON.stringify(data), analyze, clock: () => clockNow,
    env: concurrency ? { BOND_ANALYSIS_CONCURRENCY: String(concurrency) } : {},
  });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = "http://127.0.0.1:" + server.address().port;
  const bodies = [];
  const post = async (body) => {
    const res = await fetch(base + "/ai/bond-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const api = async (path, options) => {
    bodies.push(JSON.parse(options.body));
    const res = await fetch(base + path, { ...options, headers: { "Content-Type": "application/json" } });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw Object.assign(new Error(data?.error || "HTTP " + res.status), { status: res.status });
    return data;
  };
  return {
    store, calls, payloads, bodies, post, api, advance: (ms) => { clockNow += ms; }, resume: handle.resumePending,
    maxInFlight: () => maxInFlight, reset: () => { calls.length = 0; bodies.length = 0; payloads.length = 0; },
    rebuild: (chars, options = {}) => rebuildBondGraph({ chars }, { subjects, api, language: "hu", pollMs: 5, ...options }),
    rebuildWorld: (world, options = {}) => rebuildBondGraph(world, { subjects, api, language: "hu", pollMs: 5, ...options }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const owners = (calls, stage) => calls.filter((call) => call.stage === stage).map((call) => call.owner).sort();

test("Cold start reads every sheet once and builds the complete directed graph", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag."), person("c"), person("d")];
    const result = await sim.rebuild(chars);
    assert.deepEqual(owners(sim.calls, "profile"), ["a", "b", "c", "d"]);
    assert.deepEqual(owners(sim.calls, "baseline"), ["a", "b", "c", "d"]);
    assert.equal(Object.keys(result.baselines).length, 12);
    assert.deepEqual(result.baselines["a>b"].layers, ["csapattárs"], "same dojo is derived from both sheets");
    assert.deepEqual(result.baselines["b>a"].layers, ["csapattárs"]);
    assert.deepEqual(result.baselines["a>c"].layers, [], "different dojos alone prove nothing");
    assert.equal(result.analysis.recalculated, 4);
    assert.equal(result.analysis.recalculatedBonds, 12);
    const world = { chars };
    installBondGraph(world, result, subjects);
    assert.equal(analysisReady(world, subjects), true);
  } finally { await sim.close(); }
});

test("Restart or reload with unchanged sheets makes no model call at all", async () => {
  const sim = await start();
  try {
    const chars = [person("a"), person("b"), person("c")];
    const first = await sim.rebuild(chars);
    sim.reset();
    const again = await sim.rebuild(chars);
    assert.equal(sim.calls.length, 0);
    assert.equal(again.analysis.recalculated, 0);
    assert.equal(again.analysis.recalculatedBonds, 0);
    assert.deepEqual(again.baselines, first.baselines);
  } finally { await sim.close(); }
});

test("A new character costs only its own sheet and its own pairs, not the whole cast", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag."), person("c"), person("d")];
    const before = await sim.rebuild(chars);
    sim.reset();
    const result = await sim.rebuild([...chars, person("e", "Cobra Kai tag.")]);
    assert.deepEqual(owners(sim.calls, "profile"), ["e"], "only the new sheet is read");
    const baselineCalls = sim.calls.filter((call) => call.stage === "baseline");
    assert.equal(baselineCalls.length, 5);
    for (const call of baselineCalls) assert.deepEqual(call.targets, call.owner === "e" ? ["a", "b", "c", "d"] : ["e"], "owner " + call.owner);
    assert.equal(result.analysis.recalculatedBonds, 8);
    assert.equal(Object.keys(result.baselines).length, 20);
    for (const key of Object.keys(before.baselines)) assert.deepEqual(result.baselines[key], before.baselines[key], key + " must stay exactly as it was");
    assert.deepEqual(result.baselines["e>a"].layers, ["csapattárs"]);
    assert.deepEqual(result.baselines["a>e"].layers, ["csapattárs"]);
  } finally { await sim.close(); }
});

test("Editing one sheet re-reads that owner; others are re-read only toward facts that changed", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag."), person("c"), person("d")];
    await sim.rebuild(chars);

    sim.reset();
    const edited = chars.map((char) => char.id === "c" ? { ...char, connections: "Sima diák, szereti a csendet." } : char);
    await sim.rebuild(edited);
    assert.deepEqual(owners(sim.calls, "profile"), ["c"]);
    assert.deepEqual(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]), [["c", ["a", "b", "d"]]]);

    sim.reset();
    const joined = edited.map((char) => char.id === "c" ? { ...char, connections: "Cobra Kai tag lett." } : char);
    const result = await sim.rebuild(joined);
    assert.deepEqual(owners(sim.calls, "profile"), ["c"]);
    const byOwner = Object.fromEntries(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]));
    assert.deepEqual(byOwner, { a: ["c"], b: ["c"], c: ["a", "b", "d"], d: ["c"] });
    assert.deepEqual(result.baselines["a>c"].layers, ["csapattárs"], "the new fact reaches the bond");
    assert.deepEqual(result.baselines["c>b"].layers, ["csapattárs"]);
  } finally { await sim.close(); }
});

test("The server runs only as many heavy jobs as configured, however many are submitted", async () => {
  const sim = await start({ delay: 15, concurrency: 3 });
  try {
    const chars = Array.from({ length: 12 }, (_, i) => person("p" + i));
    const result = await sim.rebuild(chars);
    assert.equal(Object.keys(result.baselines).length, 132);
    assert.ok(sim.maxInFlight() <= 3, "in flight: " + sim.maxInFlight());
    assert.ok(sim.maxInFlight() >= 2, "should still run in parallel");
  } finally { await sim.close(); }
});

test("A long roster is read as short parallel calls, and the graph is still complete", async () => {
  const sim = await start();
  try {
    // Names of one letter are never taken for strangers, so every pair really goes to the model here.
    const result = await sim.rebuild(Array.from({ length: 13 }, (_, i) => person(String.fromCharCode(97 + i))));
    const sizes = sim.calls.filter((call) => call.stage === "baseline" && call.owner === "a").map((call) => call.targets.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [10, 2]);
    assert.equal(Object.keys(result.baselines).length, 13 * 12);
    assert.equal(result.analysis.recalculatedBonds, 13 * 12);
  } finally { await sim.close(); }
});

test("A sheet is uploaded once per job; polling sends only the job key", async () => {
  const sim = await start({ delay: 40 });
  try {
    await sim.rebuild([person("a"), person("b")]);
    const uploads = sim.bodies.filter((body) => body.ownSheet && !body.defer);
    const registrations = sim.bodies.filter((body) => body.defer);
    const polls = sim.bodies.filter((body) => body.poll);
    assert.equal(uploads.length, 4, "2 profiles + 2 baselines, each submitted once");
    assert.equal(registrations.length, 2, "and each baseline registered once ahead, so the server can carry on without the app");
    assert.ok(polls.length >= 4);
    assert.ok(polls.every((body) => Object.keys(body).join() === "poll"));
  } finally { await sim.close(); }
});

test("If the server forgets a job, the client resubmits it without duplicating work", async () => {
  const sim = await start({ delay: 60 });
  try {
    const pending = sim.rebuild([person("a"), person("b")]);
    await until(() => sim.store.size >= 2, "pending rows");
    for (const key of [...sim.store.keys()]) if (sim.store.get(key).pending) sim.store.delete(key);
    const result = await pending;
    assert.equal(Object.keys(result.baselines).length, 2);
    assert.deepEqual(owners(sim.calls, "profile"), ["a", "b"], "each sheet still read exactly once");
  } finally { await sim.close(); }
});

const profileRequest = () => ({ stage: "profile", owner: "a", roster: [], ownSheet: "[backstory]\nSima diák.\n[name]\nA", fieldNames: ["backstory", "name"], language: "hu" });
const rateLimited = { message: "all keys busy", failures: [{ phase: "semantic", status: 429, reason: "rate limit" }] };
const invalid = { message: "no valid answer", failures: [{ phase: "semantic", status: null, reason: "bond prose sentence counts" }] };

test("Provider outages wait and retry; the same request does not start a second model call", async () => {
  const sim = await start({ failures: (n) => (n === 1 ? rateLimited : null) });
  try {
    const body = profileRequest();
    assert.equal((await sim.post(body)).status, 202);
    await until(() => [...sim.store.values()].some((row) => row.retryAt), "failure to be recorded");
    const waiting = await sim.post(body);
    assert.equal(waiting.status, 202);
    assert.match(waiting.body.error, /all keys busy/);
    assert.equal(sim.calls.length, 1, "no second call while cooling down");
    sim.advance(61000);
    assert.equal((await sim.post(body)).status, 202);
    await until(() => [...sim.store.values()].some((row) => row.result), "retry to succeed");
    const done = await sim.post(body);
    assert.equal(done.status, 200);
    assert.equal(done.body.cached, true);
    assert.equal(sim.calls.length, 2);
  } finally { await sim.close(); }
});

test("A failed reading is never permanent: it is refused during cooldown, then tried again", async () => {
  const sim = await start({ failures: (n) => (n === 1 ? invalid : null) });
  try {
    const body = profileRequest();
    await sim.post(body);
    await until(() => [...sim.store.values()].some((row) => row.terminal), "terminal failure");
    const refused = await sim.post(body);
    assert.equal(refused.status, 422);
    assert.match(refused.body.error, /no valid answer/);
    assert.equal(sim.calls.length, 1);
    sim.advance(301000);
    assert.equal((await sim.post(body)).status, 202);
    await until(() => [...sim.store.values()].some((row) => row.result), "second attempt to succeed");
    assert.equal(sim.calls.length, 2);
  } finally { await sim.close(); }
});

test("Endless provider outages stop after a bounded number of rounds", async () => {
  const sim = await start({ failures: () => rateLimited });
  try {
    const body = profileRequest();
    for (let round = 1; round <= 4; round += 1) {
      await sim.post(body);
      await until(() => [...sim.store.values()].some((row) => row.attempts === round), "round " + round);
      sim.advance(61000);
    }
    assert.ok([...sim.store.values()].some((row) => row.terminal));
    assert.equal((await sim.post(body)).status, 422);
    assert.equal(sim.calls.length, 4);
  } finally { await sim.close(); }
});

test("A cached reading that no longer passes today's validation is read again, not served or crashed on", async () => {
  const sim = await start();
  try {
    const body = profileRequest();
    await sim.post(body);
    await until(() => [...sim.store.values()].some((row) => row.result), "first reading");
    const [key, row] = [...sim.store.entries()].find(([, value]) => value.result);
    sim.store.set(key, { ...row, result: { ...row.result, id: "somebody-else" } });
    const again = await sim.post(body);
    assert.equal(again.status, 202);
    await until(() => sim.store.get(key).result?.id === "a", "re-read");
    assert.equal(sim.calls.length, 2);
  } finally { await sim.close(); }
});


test("A witness outside the slice of targets is valid: a secret may be known to anyone in the cast", async () => {
  // 13 characters = two calls per owner (10 + 2 targets); p12 sits outside p0's first slice.
  const sim = await start({ witness: "p12" });
  try {
    const chars = Array.from({ length: 13 }, (_, i) => person("p" + i));
    const result = await sim.rebuild(chars);
    assert.deepEqual(result.baselines["p0>p1"].whoKnows, ["p0", "p12"]);
    assert.equal(Object.keys(result.baselines).length, 13 * 12);
  } finally { await sim.close(); }
});

test("Adding a character works when the owner's secret is known to someone who is not among the new targets", async () => {
  const sim = await start({ witness: "b" });
  try {
    const chars = [person("a"), person("b"), person("c")];
    await sim.rebuild(chars);
    sim.reset();
    const result = await sim.rebuild([...chars, person("d")]);
    const forA = sim.calls.find((call) => call.stage === "baseline" && call.owner === "a");
    assert.deepEqual(forA.targets, ["d"], "only the new pair is read");
    assert.deepEqual(result.baselines["a>d"].whoKnows, ["a", "b"]);
    assert.equal(Object.keys(result.baselines).length, 12);
  } finally { await sim.close(); }
});

test("Cached bonds that name a witness stay valid: unchanged sheets still cost no model call", async () => {
  const sim = await start({ witness: "c" });
  try {
    const chars = [person("a"), person("b"), person("c"), person("d")];
    const first = await sim.rebuild(chars);
    sim.reset();
    const again = await sim.rebuild(chars);
    assert.equal(sim.calls.length, 0);
    assert.equal(again.analysis.recalculatedBonds, 0);
    assert.deepEqual(again.baselines, first.baselines);
  } finally { await sim.close(); }
});

test("Someone who is only mentioned by an owner can join without re-reading that owner's other pairs", async () => {
  const sim = await start({ mentions: { a: "E" } });
  try {
    const chars = [person("a"), person("b"), person("c")];
    await sim.rebuild(chars);
    sim.reset();
    await sim.rebuild([...chars, person("e")]);
    const forA = sim.calls.find((call) => call.stage === "baseline" && call.owner === "a");
    assert.deepEqual(forA.targets, ["e"], "a>b and a>c must not be read again");
  } finally { await sim.close(); }
});

test("A failed run cancels the other pollers instead of leaving them hammering the server", async () => {
  const sim = await start({ delay: 30 });
  try {
    const chars = Array.from({ length: 6 }, (_, i) => person("p" + i));
    let failedOnce = false;
    const api = async (path, options) => {
      const body = JSON.parse(options.body);
      if (!failedOnce && body.ownSheet && body.owner === "p2") { failedOnce = true; throw Object.assign(new Error("HTTP 422"), { status: 422 }); }
      return sim.api(path, options);
    };
    const reports = [];
    await assert.rejects(rebuildBondGraph({ chars }, { subjects, api, language: "hu", pollMs: 5, progress: (state) => reports.push(state) }), /422/);
    const sent = sim.bodies.length;
    await sleep(300);
    assert.ok(sim.bodies.length - sent <= 2, "requests after the failure: " + (sim.bodies.length - sent));
    const reported = reports.length;
    await sleep(100);
    assert.equal(reports.length, reported, "no progress reports after the failure");
  } finally { await sim.close(); }
});

test("Answers that fail validation are not swept again and again; outages are", async () => {
  const sim = await start({ failures: () => invalid });
  try {
    await sim.post(profileRequest());
    await until(() => [...sim.store.values()].some((row) => row.terminal), "terminal after ONE sweep");
    assert.equal(sim.calls.length, 1);
    const [row] = [...sim.store.values()];
    assert.equal(row.attempts, 1);
  } finally { await sim.close(); }
});

test("One rate limit among many invalid answers does not make the whole sweep worth repeating", async () => {
  const mostlyInvalid = { message: "mostly invalid", failures: [
    { phase: "semantic", status: 429, transient: true, reason: "quota" },
    { phase: "semantic", status: null, transient: false, reason: "Missing reconciled objective fact" },
    { phase: "semantic", status: null, transient: false, reason: "Missing reconciled objective fact" },
    { phase: "semantic", status: null, transient: false, reason: "Missing reconciled objective fact" },
  ] };
  const sim = await start({ failures: () => mostlyInvalid });
  try {
    await sim.post(profileRequest());
    await until(() => [...sim.store.values()].some((row) => row.terminal !== undefined), "failure to be recorded");
    const [row] = [...sim.store.values()];
    assert.equal(row.terminal, true, "3 of 4 providers answered and failed validation: do not re-sweep");
    assert.equal((await sim.post(profileRequest())).status, 422);
    assert.equal(sim.calls.length, 1);
  } finally { await sim.close(); }
});

test("A mixed failure is classed by what the providers that were asked said; repair noise is ignored", async () => {
  const mixed = { message: "mixed", failures: [
    { phase: "semantic", status: 429, transient: true, reason: "quota" },
    { phase: "semantic", status: 503, transient: true, reason: "overloaded" },
    { phase: "semantic", status: null, transient: false, reason: "bond prose sentence counts mentions network and fetch" },
    { phase: "schema-repair", status: null, transient: false, reason: "repair could not fix it" },
  ] };
  const sim = await start({ failures: (n) => (n === 1 ? mixed : null) });
  try {
    await sim.post(profileRequest());
    await until(() => [...sim.store.values()].some((row) => row.retryAt), "failure to be recorded");
    const [row] = [...sim.store.values()];
    assert.equal(row.pending, true, "2 of 3 asked providers were unavailable: retry later");
    assert.equal(row.terminal, false);
  } finally { await sim.close(); }
});

test("With no provider configured the failure says what to set instead of an empty message", async () => {
  await assert.rejects(analyzeStructured("x", { type: "object" }, () => {}, { env: {} }), /No analysis provider is configured.*OPENAI_API_KEY.*AI_ALLOW_PAID_BACKGROUND=1/);
});

test("Connections profile preflight skips countTokens, caches Gemini metadata, and keeps a small output ceiling", async () => {
  const seen = { meta: 0, count: 0, generate: 0 };
  const schema = {
    type: "object",
    properties: { ok: { type: "string" } },
    required: ["ok"],
    additionalProperties: false,
  };
  const transport = async (url) => {
    if (url.endsWith(":countTokens")) { seen.count += 1; return { totalTokens: 10 }; }
    if (url.endsWith(":generateContent")) {
      seen.generate += 1;
      return { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":"yes"}' }] } }] };
    }
    seen.meta += 1;
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const candidate = { name: "gemini", model: "m-fast", key: "k", keySlot: "K" };
  const validate = (value) => assert.equal(value.ok, "yes");

  await analyzeStructured("short Connections", schema, validate, { candidates: [candidate], transport, outputTokens: 6000, fastCapacityCheck: true });
  await analyzeStructured("another short Connections", schema, validate, { candidates: [{ ...candidate, key: "k2" }], transport, outputTokens: 6000, fastCapacityCheck: true });

  assert.equal(seen.count, 0, "short Connections does not spend a countTokens request");
  assert.equal(seen.meta, 1, "model metadata is reused across character reads");
  assert.equal(seen.generate, 2);
});

test("Connections analysis uses bounded dynamic output budgets without truncating the source", () => {
  assert.equal(bondAnalysisOutputTokens("profile", 0, 0), 6000);
  assert.equal(bondAnalysisOutputTokens("profile", 4000, 0), 14000);
  assert.equal(bondAnalysisOutputTokens("profile", 50000, 0), 18000);
  assert.equal(bondAnalysisOutputTokens("baseline", 4000, 1), 8000);
  assert.equal(bondAnalysisOutputTokens("baseline", 4000, 10), 32000);
});

test("One analysis stops trying further providers after its deadline", async () => {
  let t = 1000;
  const clock = () => t;
  const seen = [];
  const transport = async (url) => {
    if (url.endsWith(":generateContent")) { seen.push(url); t += 5000; const error = new Error("busy"); error.status = 503; throw error; }
    if (url.endsWith(":countTokens")) return { totalTokens: 10 };
    return { supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000, outputTokenLimit: 65536 };
  };
  const candidates = ["a", "b", "c", "d", "e"].map((key) => ({ name: "gemini", model: "m", key, keySlot: "K" + key }));
  await assert.rejects(analyzeStructured("x", { type: "object" }, () => {}, { candidates, transport, clock, deadline: 1000 + 7000, outputTokens: 10 }), (error) => {
    assert.equal(seen.length, 2, "tried until the deadline, then stopped");
    assert.ok(error.failures.some((failure) => /deadline/.test(failure.reason)));
    return true;
  });
});

test("The mock sheets really are the ones the client builds", () => {
  assert.equal(relationshipSourceText(person("a")), "[name]\nA\n[connections]\nSima diák.");
  assert.ok(fullSheetText(person("a")).includes("[connections]"));
});

test("Restart progresses beyond 16 sheets to 20 and all 380 directed bonds", async () => {
  const sim = await start();
  try {
    const chars = Array.from({ length: 20 }, (_, i) => person("p" + i));
    const progress = [];
    const result = await sim.rebuild(chars, { progress: state => progress.push(state) });
    assert.equal(owners(sim.calls, "profile").length, 20);
    assert.ok(progress.some(state => state.phase === "profile" && state.completed === 16));
    assert.ok(progress.some(state => state.phase === "profile" && state.completed === 20));
    assert.equal(Object.keys(result.baselines).length, 380);
    const world = { chars };
    installBondGraph(world, result, subjects);
    assert.equal(analysisReady(world, subjects), true);
  } finally { await sim.close(); }
});

test("A nickname in one sheet's Connections leads to the person whose own nickname field says so", async () => {
  /* Angela Silverman's nickname is Angel. Brent's Connections says "Angel". The model that read
     Angela's identity forgot to list the nickname, so only the sheet's own fields can settle it. */
  const sim = await start({ mentions: { brent: "Angel" } });
  try {
    const chars = [
      { id: "angela", name: "Angela Silverman", nick: "Angel", connections: "Sima diák." },
      { id: "brent", name: "BRENT", connections: "Sima diák. Angel a legjobb barátom." },
      { id: "cara", name: "Cara Angeles", connections: "Sima diák." },
    ];
    const result = await sim.rebuild(chars);
    assert.match(result.baselines["brent>cara"].summary, /BRENT és Cara Angeles nem állnak személyes kapcsolatban/, "she is written by rule, with her full name");

    const request = sim.bodies.find((body) => body.stage === "baseline" && body.owner === "brent");
    assert.deepEqual(request.identities.angela, { name: "Angela Silverman", aliases: ["Angel"] });
    assert.deepEqual(request.identities.cara, { name: "Cara Angeles", aliases: [] });

    const { payload } = sim.payloads.find((row) => row.stage === "baseline" && row.payload.owner === "brent");
    assert.deepEqual(payload.profile.mentions.map((row) => [row.targetName, row.targetId]), [["Angel", "angela"]], "Angel is Angela, not an outsider and not Cara");
    const angela = payload.roster.find((card) => card.id === "angela");
    assert.equal(angela.fullName, "Angela Silverman");
    assert.deepEqual(angela.names.slice(0, 2), ["Angela Silverman", "Angel"], "full name first, then the nickname");
    assert.equal(payload.roster.find((card) => card.id === "cara"), undefined, "Cara is not named anywhere: no model is asked about her");
  } finally { await sim.close(); }
});

test("Changing only a nickname changes who a mention resolves to, so the pair is read again", async () => {
  const sim = await start({ mentions: { brent: "Angel" } });
  try {
    const chars = (nick) => [
      { id: "angela", name: "Angela Silverman", nick, connections: "Sima diák." },
      { id: "brent", name: "BRENT", connections: "Sima diák. Angel a legjobb barátom." },
    ];
    await sim.rebuild(chars("Angel"));
    sim.reset();
    await sim.rebuild(chars("Angel"));
    assert.equal(sim.calls.length, 0, "nothing changed, nothing read");
    sim.reset();
    const result = await sim.rebuild(chars("Angie"));
    assert.equal(sim.payloads.find((row) => row.stage === "baseline" && row.payload.owner === "brent"), undefined, "no model is asked: 'Angel' no longer names anyone in the cast");
    assert.match(result.baselines["brent>angela"].summary, /nem állnak személyes kapcsolatban/, "the pair Brent -> Angela is worked out again, and is now a stranger pair");
  } finally { await sim.close(); }
});

test("A reading whose round failed is retried by the server itself, with nobody polling", async () => {
  const sim = await start({ failures: (n) => (n === 1 ? rateLimited : null) });
  try {
    assert.equal((await sim.post(profileRequest())).status, 202);
    await until(() => [...sim.store.values()].some((row) => row.retryAt), "failure to be recorded");
    assert.equal(await sim.resume(), 0, "still cooling down: nothing is started early");
    assert.equal(sim.calls.length, 1);
    sim.advance(61000);
    assert.equal(await sim.resume(), 1, "the retry time has come: the server starts it");
    await until(() => [...sim.store.values()].some((row) => row.result), "the retry to succeed without any poll");
    assert.equal(sim.calls.length, 2);
    assert.equal(await sim.resume(), 0, "a finished reading is not started again");
  } finally { await sim.close(); }
});

test("After a server restart the reading that was in flight is picked up again without the app", async () => {
  const store = new Map();
  const before = await start({ store, hang: true });
  try {
    assert.equal((await before.post(profileRequest())).status, 202);
    await until(() => before.calls.length === 1, "the first run to start");
    const [row] = [...store.values()];
    assert.equal(row.pending, true);
    assert.ok(row.request, "the request is kept so the server can run it again");
  } finally { await before.close(); }
  const after = await start({ store });
  try {
    assert.equal(await after.resume(), 1, "the new process finds the pending reading");
    await until(() => [...store.values()].some((row) => row.result), "the reading to finish");
    assert.equal(after.calls.length, 1);
    assert.equal(await after.resume(), 0);
  } finally { await after.close(); }
});

test("The server does not start a reading again while it is already running it", async () => {
  const sim = await start({ delay: 40 });
  try {
    assert.equal((await sim.post(profileRequest())).status, 202);
    assert.equal(await sim.resume(), 0);
    await until(() => [...sim.store.values()].some((row) => row.result), "the reading to finish");
    assert.equal(sim.calls.length, 1);
  } finally { await sim.close(); }
});

test("A model that fills dynamics and wants without a quote no longer sinks the reading: they come back null, in one call", async () => {
  const sim = await start({ decorate: (result, stage) => { if (stage === "baseline") for (const bond of result.bonds) Object.assign(bond, { dynamics: "Kitalált dinamika.", wants: "Kitalált vágy.", hiddenFeelings: "Kitalált érzés." }); } });
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    const result = await sim.rebuild(chars);
    assert.equal(sim.calls.filter((call) => call.stage === "baseline").length, 2, "one model call per sheet, no retry rounds");
    for (const bond of Object.values(result.baselines)) {
      assert.equal(bond.dynamics, null); assert.equal(bond.wants, null); assert.equal(bond.hiddenFeelings, null);
      assert.ok(bond.description && bond.summary && bond.publicFace, "the shown texts stay filled");
    }
    assert.ok(![...sim.store.values()].some((row) => row.error), "no failed round was recorded");
  } finally { await sim.close(); }
});

test("A model that leaves out the group layer and the objective quotes no longer sinks the reading: the server completes them, in one call", async () => {
  const sim = await start({ decorate: (result, stage) => { if (stage === "baseline") for (const bond of result.bonds) Object.assign(bond, { layers: [], factEvidence: [], evidence: ["kitalált idézet, ami nincs a lapon"], source: "explicit" }); } });
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    const result = await sim.rebuild(chars);
    assert.equal(sim.calls.filter((call) => call.stage === "baseline").length, 2, "one model call per sheet, no retry rounds");
    assert.deepEqual(result.baselines["a>b"].layers, ["csapattárs"], "the shared dojo layer is put back");
    assert.ok(result.baselines["a>b"].factEvidence.length > 0, "and so are its quotes");
    assert.deepEqual(result.baselines["a>b"].evidence, [], "a quote that is not in the sheet never stays");
    assert.ok(![...sim.store.values()].some((row) => row.error), "no failed round was recorded");
  } finally { await sim.close(); }
});

/* ---------- the server carries the two stages on by itself ---------- */

const requestBodies = (chars) => {
  const world = { chars };
  const sheets = Object.fromEntries(chars.map((c) => [c.id, relationshipSourceText(c, undefined, world)]));
  const fieldNames = Object.fromEntries(chars.map((c) => [c.id, Object.keys(relationshipFields(c, world))]));
  return {
    profile: (c) => ({ stage: "profile", owner: c.id, roster: chars.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, names: [o.name] })), ownSheet: sheets[c.id], fieldNames: fieldNames[c.id], language: "hu", force: "" }),
    baseline: (c, profileKeys, extra = {}) => ({ stage: "baseline", owner: c.id, roster: chars.filter((o) => o.id !== c.id).map((o) => ({ id: o.id, names: [], oneLine: "" })), identities: characterIdentities(chars), ownSheet: sheets[c.id], profileKeys, language: "hu", force: "", ...extra }),
  };
};

test("A profile is read with little thinking and fast preflight; relationship reading keeps full thinking", async () => {
  const sim = await start();
  try {
    await sim.rebuild([person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")]);
    const profiles = sim.calls.filter((call) => call.stage === "profile");
    const baselines = sim.calls.filter((call) => call.stage === "baseline");
    assert.ok(profiles.every((call) => call.thinking === "LOW"));
    assert.ok(profiles.every((call) => call.fastCapacityCheck === true));
    assert.ok(profiles.every((call) => call.outputTokens >= 6000 && call.outputTokens <= 18000));
    assert.ok(baselines.every((call) => call.thinking === "HIGH"));
    assert.ok(baselines.every((call) => call.fastCapacityCheck === false));
    assert.ok(baselines.every((call) => call.outputTokens >= 8000 && call.outputTokens <= 32000));
  } finally { await sim.close(); }
});

test("A baseline registered before its profiles are ready starts by itself the moment they are, with nobody polling", async () => {
  const sim = await start({ delay: 60 });
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    const make = requestBodies(chars);
    const profiles = await Promise.all(chars.map((c) => sim.post(make.profile(c))));
    assert.ok(profiles.every((row) => row.status === 202), "the profiles are still being read");
    const profileKeys = profiles.map((row) => row.body.jobKey);
    const registered = await Promise.all(chars.map((c) => sim.post(make.baseline(c, profileKeys, { defer: true }))));
    assert.ok(registered.every((row) => row.status === 202 && row.body.deferred === true && row.body.pending === true), "registered, waiting for the profiles");
    assert.equal(sim.calls.filter((call) => call.stage === "baseline").length, 0, "nothing starts before the profiles are ready");
    await until(() => [...sim.store.values()].filter((row) => row.stage === "baseline" && row.result).length === 2, "both baselines to be read without any poll");
    const order = sim.calls.map((call) => call.stage);
    assert.deepEqual(order, ["profile", "profile", "baseline", "baseline"], "profiles first, then the baselines, all on the server's own initiative");
    const done = await sim.post({ poll: registered[0].body.jobKey });
    assert.equal(done.status, 200, "the browser can collect it later with the key it was given");
    assert.equal(done.body.result.bonds.length, 1);
  } finally { await sim.close(); }
});

test("Registering the same baseline twice leaves one waiting row, and a baseline whose profiles never finish does not start", async () => {
  const sim = await start({ hang: true });
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    const make = requestBodies(chars);
    const profiles = await Promise.all(chars.map((c) => sim.post(make.profile(c))));
    const profileKeys = profiles.map((row) => row.body.jobKey);
    const first = await sim.post(make.baseline(chars[0], profileKeys, { defer: true }));
    const second = await sim.post(make.baseline(chars[0], profileKeys, { defer: true }));
    assert.equal(first.body.jobKey, second.body.jobKey, "the same registration has the same key");
    assert.equal([...sim.store.values()].filter((row) => row.deferred).length, 1);
    assert.equal(await sim.resume(), 0, "its profiles are not ready: nothing to start");
    assert.equal(sim.calls.filter((call) => call.stage === "baseline").length, 0);
    const poll = await sim.post({ poll: first.body.jobKey });
    assert.equal(poll.status, 202, "asking about it meanwhile just says it is waiting");
    assert.equal(poll.body.deferred, true);
  } finally { await sim.close(); }
});

test("A baseline registered when the profiles are already ready is simply started, as before", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    const make = requestBodies(chars);
    const profileKeys = [];
    for (const c of chars) {
      const first = await sim.post(make.profile(c));
      profileKeys.push(first.body.jobKey);
    }
    await until(() => [...sim.store.values()].filter((row) => row.stage === "profile" && row.result).length === 2, "profiles to be read");
    const registered = await sim.post(make.baseline(chars[0], profileKeys, { defer: true }));
    assert.equal(registered.status, 202);
    assert.ok(!registered.body.deferred, "no waiting row: it is an ordinary reading now");
    await until(() => [...sim.store.values()].some((row) => row.stage === "baseline" && row.result), "the baseline to be read");
  } finally { await sim.close(); }
});

/* ---------- one character can be read again without touching the rest ---------- */

test("Re-reading one character reads only their sheet and the bonds they write; the rest comes back from the cache", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag."), person("c"), person("d")];
    const world = { chars };
    installBondGraph(world, await sim.rebuildWorld(world), subjects);
    sim.reset();
    const again = await sim.rebuildWorld(world, { only: "c" });
    assert.deepEqual(owners(sim.calls, "profile"), ["c"], "only c's sheet is read again");
    assert.deepEqual(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]), [["c", ["a", "b", "d"]]], "and only the bonds c writes");
    assert.deepEqual(Object.keys(again.analysis.generations), ["c"], "the fresh read is remembered for c alone");
    assert.equal(Object.keys(again.baselines).length, 12, "the graph is still complete");
  } finally { await sim.close(); }
});

test("A re-read is not undone by the next rebuild: later runs keep using the character's token", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag."), person("c")];
    const world = { chars };
    installBondGraph(world, await sim.rebuildWorld(world), subjects);
    installBondGraph(world, await sim.rebuildWorld(world, { only: "c" }), subjects);
    const token = world.bondAnalysis.generations.c;
    assert.ok(token);
    sim.reset();
    const next = [...chars, person("d")];
    await sim.rebuildWorld({ ...world, chars: next });
    const forceOf = (owner) => [...new Set(sim.bodies.filter((body) => body.owner === owner && !body.poll).map((body) => body.force))];
    assert.deepEqual(forceOf("c"), [token], "c is still read under the token of its fresh reading");
    assert.deepEqual(forceOf("a"), [""], "the others stay on the ordinary cache");
  } finally { await sim.close(); }
});

test("Everything read again at once gives every character the same fresh token", async () => {
  const sim = await start();
  try {
    const chars = [person("a"), person("b")];
    const result = await sim.rebuild(chars, { force: true });
    const tokens = Object.values(result.analysis.generations);
    assert.equal(tokens.length, 2);
    assert.equal(new Set(tokens).size, 1);
  } finally { await sim.close(); }
});

test("Baselines are registered ahead only when some profile is really being read, never when everything is cached", async () => {
  const sim = await start();
  try {
    const chars = [person("a", "Cobra Kai tag."), person("b", "Cobra Kai tag.")];
    await sim.rebuild(chars);
    assert.equal(sim.bodies.filter((body) => body.defer).length, 2, "cold start: registered ahead");
    sim.reset();
    await sim.rebuild(chars);
    assert.equal(sim.bodies.filter((body) => body.defer).length, 0, "everything cached: nothing to register");
  } finally { await sim.close(); }
});

test("A character read again on purpose gets the fresh bonds; the others keep what play made of them", () => {
  const baseline = (from, to, extra = {}) => ({ from, to, type: "semleges", levels: { sentiment: 0, trust: 0, attraction: 0, tension: 0 }, ...extra });
  const world = {
    chars: [person("a"), person("b"), person("c")],
    relationshipBaselines: { "a>b": baseline("a", "b"), "b>a": baseline("b", "a"), "a>c": baseline("a", "c"), "c>a": baseline("c", "a"), "b>c": baseline("b", "c"), "c>b": baseline("c", "b") },
    rels: {}, relationshipHistory: { "c>a": [{ note: "old" }], "a>c": [{ note: "old" }], "a>b": [{ note: "keep" }] }, officialRelationships: { "c>b": { kind: "x" } },
  };
  for (const key of Object.keys(world.relationshipBaselines)) world.rels[key] = { ...world.relationshipBaselines[key], levels: { sentiment: 40, trust: 40, attraction: 0, tension: 0 }, evolved: true };
  const result = { baselines: { ...world.relationshipBaselines, "c>a": baseline("c", "a", { type: "új típus" }), "a>c": baseline("a", "c", { type: "új típus" }) }, analysis: { version: 1, source: bondSourceFingerprint(world, subjects), profiles: {}, generations: { c: "t" } } };
  installBondGraph(world, result, subjects, { reset: ["c"] });
  assert.equal(world.rels["c>a"].type, "új típus", "c's outgoing bond is the fresh reading");
  assert.equal(world.rels["c>a"].evolved, undefined, "play's changes are gone for it");
  assert.equal(world.rels["a>c"].type, "új típus", "a bond toward c whose reading changed is refreshed too");
  assert.equal(world.rels["c>b"].evolved, undefined, "all of c's outgoing bonds are reset");
  assert.equal(world.rels["b>c"].evolved, true, "a bond toward c that did not change keeps what play made of it");
  assert.equal(world.rels["a>b"].evolved, true, "bonds between others are untouched");
  assert.equal(world.relationshipHistory["c>a"], undefined);
  assert.equal(world.relationshipHistory["a>c"], undefined);
  assert.deepEqual(world.relationshipHistory["a>b"], [{ note: "keep" }]);
  assert.equal(world.officialRelationships["c>b"], undefined);
  assert.deepEqual(world.bondAnalysis.generations, { c: "t" });
});

/* ---------- a pair that nothing connects is written by rule, not by a model ---------- */

const named = (id, name, connections = "Sima diák.", extra = {}) => ({ id, name, connections, ...extra });

test("Only the pairs that something connects reach a model; the rest are written at once by rule", async () => {
  const sim = await start({ mentions: { brent: "Angela Silverman" } });
  try {
    const chars = [
      named("angela", "Angela Silverman"),
      named("brent", "Brent Holloway", "Sima diák. Angela Silverman a barátom."),
      named("cara", "Cara Angeles"),
      named("dave", "Dave Okonkwo"),
    ];
    const result = await sim.rebuild(chars);
    const askedAbout = sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]);
    assert.deepEqual(askedAbout, [["brent", ["angela"]]], "one model call, for the one pair that is named");
    assert.equal(Object.keys(result.baselines).length, 12, "the graph is still complete");
    const stranger = result.baselines["cara>dave"];
    assert.equal(stranger.type, "semleges");
    assert.match(stranger.summary, /Cara Angeles és Dave Okonkwo nem állnak személyes kapcsolatban/);
    assert.deepEqual(stranger.levels, { sentiment: 0, trust: 0, attraction: 0, tension: 0 });
    assert.equal(result.baselines["brent>cara"].hiddenFeelings, null);
  } finally { await sim.close(); }
});

test("A name in the text counts however it is written: nickname, first name, other case or accents", async () => {
  const sim = await start();
  try {
    const chars = [
      named("agnes", "Ágnes Kovács", "Sima diák.", { nick: "Ági" }),
      named("brent", "Brent Holloway", "Sima diák. Az AGNES jó fej, Ági is."),
      named("cara", "Cara Angeles", "Sima diák. Ági a barátom."),
      named("dave", "Dave Okonkwo", "Sima diák. Valaki másról írok."),
    ];
    await sim.rebuild(chars);
    const asked = Object.fromEntries(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]));
    assert.deepEqual(asked.brent, ["agnes"], "'AGNES' without the accent, in capitals");
    assert.deepEqual(asked.cara, ["agnes"], "the nickname alone");
    assert.equal(asked.dave, undefined, "nobody named: nothing to ask");
    assert.equal(asked.agnes, undefined);
  } finally { await sim.close(); }
});

test("A pair is never taken for strangers when a shared group joins them or a name is too short to be sure of", async () => {
  const sim = await start();
  try {
    const chars = [
      named("alma", "Alma Kovács", "Cobra Kai tag."),
      named("bela", "Béla Szabó", "Cobra Kai tag."),
      named("cili", "Cili Nagy"),
      named("jo", "Jo"),
    ];
    await sim.rebuild(chars);
    const asked = Object.fromEntries(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]));
    assert.deepEqual(asked.alma, ["bela", "jo"], "same dojo, and the two-letter name 'Jo' cannot be ruled out");
    assert.deepEqual(asked.bela, ["alma", "jo"]);
    assert.deepEqual(asked.cili, ["jo"], "only the short name is left to the model");
    assert.equal(asked.jo, undefined, "a short name only matters for the one who is named, not for the one who writes");
  } finally { await sim.close(); }
});

test("A rule-written pair is stored like any other, so a later request finds everything cached", async () => {
  const sim = await start();
  try {
    const chars = [named("angela", "Angela Silverman"), named("cara", "Cara Angeles"), named("dave", "Dave Okonkwo")];
    await sim.rebuild(chars);
    assert.equal(sim.calls.filter((call) => call.stage === "baseline").length, 0, "no model at all for a cast nobody mentions");
    const pairRows = [...sim.store.values()].filter((row) => row.stage === "pair");
    assert.equal(pairRows.length, 6);
    assert.ok(pairRows.every((row) => row.provider === "rule"));
    sim.reset();
    await sim.rebuild(chars);
    assert.equal(sim.calls.length, 0);
  } finally { await sim.close(); }
});

test("The rule-written texts satisfy the same checks as a model's answer, in Hungarian and in English", () => {
  for (const language of ["Hungarian", "English"]) {
    const bond = strangerBond("a", "b", "Anna Kiss", "Béla Nagy", language);
    validateBonds({ bonds: [bond] }, "a", [{ id: "b" }], "Sima diák.", { b: [] }, ["a", "b"]);
    assert.ok(bond.summary.includes("Anna Kiss") && bond.summary.includes("Béla Nagy"), language);
  }
  assert.equal(strangerBond("a", "b", "X Y", "Z W", "English").type, "neutral");
});

/* ---------- "not ready" can be explained ---------- */

test("The stored analysis remembers each character's sheet, so a stale reading can say which one changed", async () => {
  const sim = await start();
  try {
    const chars = [named("angela", "Angela Silverman"), named("cara", "Cara Angeles"), named("dave", "Dave Okonkwo")];
    const world = { chars };
    assert.equal(staleReason(world, subjects), "no analysis yet");
    installBondGraph(world, await sim.rebuildWorld(world), subjects);
    assert.deepEqual(Object.keys(world.bondAnalysis.sources).sort(), ["angela", "cara", "dave"]);
    assert.match(staleReason(world, subjects), /^current/);
    const edited = { ...world, chars: chars.map((c) => (c.id === "cara" ? { ...c, connections: "Más szöveg." } : c)) };
    assert.equal(staleReason(edited, subjects), "changed: cara");
    assert.equal(staleReason({ ...world, chars: [...chars, named("eli", "Eli Vance")] }, subjects), "added: eli");
    assert.equal(staleReason({ ...world, chars: chars.slice(0, 2) }, subjects), "removed: dave");
    assert.equal(staleReason({ ...world, bondAnalysis: { ...world.bondAnalysis, refreshPending: true } }, subjects), "placeholder analysis (refresh pending)");
    assert.match(staleReason({ ...world, bondAnalysis: { ...world.bondAnalysis, sources: undefined }, chars: [...chars.slice(0, 2), named("dave", "Dave Okonkwo", "Más.")] }, subjects), /no per-character record/);
  } finally { await sim.close(); }
});

test("A reading says why it was needed in its first request, and the server logs it once per sheet", async () => {
  const sim = await start();
  const logged = [];
  const info = console.info; console.info = (...args) => logged.push(args.join(" "));
  try {
    const chars = [named("angela", "Angela Silverman"), named("cara", "Cara Angeles")];
    const world = { chars };
    installBondGraph(world, await sim.rebuildWorld(world), subjects);
    sim.reset();
    const edited = { ...world, chars: chars.map((c) => (c.id === "cara" ? { ...c, connections: "Más szöveg." } : c)) };
    await sim.rebuildWorld(edited);
    const firstProfiles = sim.bodies.filter((body) => body.stage === "profile" && !body.poll);
    assert.ok(firstProfiles.length > 0 && firstProfiles.every((body) => body.why === "changed: cara"));
    assert.ok(sim.bodies.filter((body) => body.stage === "baseline" || body.poll).every((body) => body.why === undefined), "only the profile requests carry it");
    assert.ok(logged.some((line) => /\[bond-analysis-why\] cara changed: cara/.test(line)), logged.filter((l) => /why/.test(l)).join(" | "));
  } finally { console.info = info; await sim.close(); }
});
