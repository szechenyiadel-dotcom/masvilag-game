import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerBondAnalysis } from "../server/bondAnalysis.js";
import { EXTRACT_PROMPT, BASELINE_PROMPT } from "../src/bondAnalysis.js";
import { fullSheetText, rebuildBondGraph, installBondGraph, analysisReady } from "../src/bondClient.js";

// The whole path: real client -> real Express handler -> in-memory cache table ->
// scripted "model". The model returns valid output derived from the prompt, so the
// real validators run. What these tests prove is the plumbing: what is read, what is
// re-used, how it fails and recovers.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (condition, what = "condition") => {
  for (let i = 0; i < 600; i += 1) { if (await condition()) return; await sleep(5); }
  throw new Error("timed out waiting for " + what);
};

const person = (id, backstory = "Sima diák.") => ({ id, name: id.toUpperCase(), backstory });
const subjects = (world) => world.chars;

const profileFor = ({ owner, ownSheet, fieldNames }) => {
  const name = /\[name\]\n(.*)/.exec(ownSheet)[1];
  const dojo = ownSheet.includes("Cobra Kai");
  return {
    id: owner, names: [name], processedFields: fieldNames,
    claims: [{ field: "names", value: name, evidence: name }],
    groups: dojo ? [{ name: "Cobra Kai", aliases: [], kind: "dojo", role: "tag", rank: null, evidence: "Cobra Kai" }] : [],
    groupRelations: [], mentions: [], facts: [], traits: [], goals: [], fears: [], secrets: [], timeline: [],
  };
};

const bondsFor = ({ owner, roster, objectiveFacts }) => ({
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
      hiddenFeelings: null, history: null, dynamics: null, wants: null, whoKnows: [],
      source: "logikai következtetés", evidence: [], fieldEvidence: [], factEvidence,
      layers: facts.filter((fact) => fact.source === "logikai következtetés").map((fact) => fact.type),
    };
  }),
});

async function start({ delay = 0, concurrency, failures } = {}) {
  const store = new Map();
  const calls = [];
  let clockNow = 1_000_000;
  let inFlight = 0;
  let maxInFlight = 0;
  const analyze = async (prompt, schema, validate) => {
    const stage = prompt.startsWith(EXTRACT_PROMPT) ? "profile" : "baseline";
    const payload = JSON.parse(prompt.slice((stage === "profile" ? EXTRACT_PROMPT : BASELINE_PROMPT).length + 1));
    calls.push({ stage, owner: payload.owner, targets: payload.roster?.map((card) => card.id) });
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await sleep(delay);
      const failure = failures?.(calls.length);
      if (failure) throw Object.assign(new Error(failure.message), { failures: failure.failures });
      const result = stage === "profile" ? profileFor(payload) : bondsFor(payload);
      validate(result);
      return { result, provider: "mock", model: "mock", keySlot: "MOCK", inputTokens: 1 };
    } finally { inFlight -= 1; }
  };
  const pool = {
    query: async (sql, params) => {
      if (/^\s*SELECT/i.test(sql)) return { rows: params[0].filter((key) => store.has(key)).map((key) => ({ cache_key: key, data: JSON.parse(JSON.stringify(store.get(key))) })) };
      store.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    },
  };
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  registerBondAnalysis(app, {
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
    store, calls, bodies, post, api, advance: (ms) => { clockNow += ms; },
    maxInFlight: () => maxInFlight, reset: () => { calls.length = 0; bodies.length = 0; },
    rebuild: (chars, options = {}) => rebuildBondGraph({ chars }, { subjects, api, language: "hu", pollMs: 5, ...options }),
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
    const edited = chars.map((char) => char.id === "c" ? { ...char, backstory: "Sima diák, szereti a csendet." } : char);
    await sim.rebuild(edited);
    assert.deepEqual(owners(sim.calls, "profile"), ["c"]);
    assert.deepEqual(sim.calls.filter((call) => call.stage === "baseline").map((call) => [call.owner, call.targets]), [["c", ["a", "b", "d"]]]);

    sim.reset();
    const joined = edited.map((char) => char.id === "c" ? { ...char, backstory: "Cobra Kai tag lett." } : char);
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
    const result = await sim.rebuild(Array.from({ length: 13 }, (_, i) => person("p" + i)));
    const sizes = sim.calls.filter((call) => call.stage === "baseline" && call.owner === "p0").map((call) => call.targets.length).sort((a, b) => b - a);
    assert.deepEqual(sizes, [10, 2]);
    assert.equal(Object.keys(result.baselines).length, 13 * 12);
    assert.equal(result.analysis.recalculatedBonds, 13 * 12);
  } finally { await sim.close(); }
});

test("A sheet is uploaded once per job; polling sends only the job key", async () => {
  const sim = await start({ delay: 40 });
  try {
    await sim.rebuild([person("a"), person("b")]);
    const uploads = sim.bodies.filter((body) => body.ownSheet);
    const polls = sim.bodies.filter((body) => body.poll);
    assert.equal(uploads.length, 4, "2 profiles + 2 baselines, each submitted once");
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

test("The mock sheets really are the ones the client builds", () => {
  assert.equal(fullSheetText(person("a")), "[backstory]\nSima diák.\n[name]\nA");
});
