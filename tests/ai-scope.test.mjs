import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FOCUS_SCOPE_MAX, focusedScope, inScope, relationshipInScope, eventInScope, strongestTieIds, groupsForScope,
} from "../src/aiScope.js";

test("Two characters and the player form a scope; nobody else is in it", () => {
  const scope = focusedScope(["manon", "brent"], { playerId: "me", includePlayer: true });
  assert.deepEqual([...scope.people].sort(), ["brent", "manon", "me"]);
  assert.equal(inScope(scope, "manon"), true);
  assert.equal(inScope(scope, "rita"), false);
  const withoutPlayer = focusedScope(["manon", "brent"], { playerId: "me", includePlayer: false });
  assert.equal(inScope(withoutPlayer, "me"), false);
});

test("No focus, or too many people, keeps the full-world context", () => {
  assert.equal(focusedScope(null), null);
  assert.equal(focusedScope([]), null);
  assert.equal(focusedScope(["", null]), null);
  const many = Array.from({ length: FOCUS_SCOPE_MAX + 1 }, (_, i) => "c" + i);
  assert.equal(focusedScope(many), null);
  assert.ok(focusedScope(many.slice(0, FOCUS_SCOPE_MAX)));
  assert.deepEqual([...focusedScope("manon").people], ["manon"]);
});

test("A relationship counts only when both people are in the conversation", () => {
  const scope = focusedScope(["manon", "brent"], { playerId: "me" });
  assert.equal(relationshipInScope(scope, "manon", "brent"), true);
  assert.equal(relationshipInScope(scope, "brent", "me"), true);
  assert.equal(relationshipInScope(scope, "manon", "rita"), false);
  assert.equal(relationshipInScope(scope, "rita", "paul"), false);
});

test("An event counts when it was done by, or aimed at, someone in the conversation", () => {
  const scope = focusedScope(["manon"], { playerId: "me" });
  assert.equal(eventInScope(scope, { actorId: "manon", targetIds: [] }), true);
  assert.equal(eventInScope(scope, { actorId: "rita", targetIds: ["me"] }), true);
  assert.equal(eventInScope(scope, { actorId: "rita", targetIds: ["paul"], meta: { participantIds: ["manon"] } }), true);
  assert.equal(eventInScope(scope, { actorId: "rita", targetIds: ["paul"] }), false);
  assert.equal(eventInScope(scope, null), false);
  assert.equal(eventInScope(null, { actorId: "manon" }), false);
});

test("The strongest ties are picked by absolute feeling, once per person, zero ignored", () => {
  const ties = [
    { id: "rita", strength: 20 }, { id: "paul", strength: -80 }, { id: "ann", strength: 55 },
    { id: "rita", strength: 70 }, { id: "zed", strength: 0 }, { id: "bo", strength: 10 },
  ];
  assert.deepEqual(strongestTieIds(ties, 3), ["paul", "rita", "ann"]);
  assert.deepEqual(strongestTieIds(ties, 0), []);
  assert.deepEqual(strongestTieIds(null), []);
});

test("Groups are listed only for the people in the conversation, their own members first", () => {
  const groups = [
    { name: "Cobra Kai", kind: "dojo", members: [{ id: "x1", label: "X1" }, { id: "x2", label: "X2" }, { id: "manon", label: "Manon" }] },
    { name: "Iron Dragons", kind: "dojo", members: [{ id: "y1", label: "Y1" }] },
    { name: "House 7", kind: "house", members: [{ id: "brent", label: "Brent" }, { id: "z1", label: "Z1" }] },
  ];
  const scope = focusedScope(["manon", "brent"], { playerId: "me" });
  const rows = groupsForScope(groups, scope, 2);
  assert.deepEqual(rows.map((g) => g.name), ["Cobra Kai", "House 7"]);
  assert.deepEqual(rows[0].members.map((m) => m.label), ["Manon", "X1"]);
  assert.deepEqual(rows[1].members.map((m) => m.label), ["Brent", "Z1"]);
  assert.equal(groupsForScope(groups, null, 2).length, 3, "without a scope every group stays");
  assert.deepEqual(groupsForScope(groups, null, 2)[0].members.map((m) => m.label), ["X1", "X2"]);
});

test("App.jsx builds focused conversations from the scope and keeps the full-world path for social feeds", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /import \{[^}]*focusedScope[^}]*\} from "\.\/aiScope\.js"/);
  assert.match(source, /socialScope \|\| contextOptions\.fullWorld === true\s*\?\s*null\s*:\s*focusedScope\(/);
  assert.match(source, /relationshipInScope\(scope, x, y\)/);
  assert.match(source, /scopedRosterLine\(w, scope\)/);
  assert.match(source, /worldGroupGlossaryCard\(args\[0\], scope\)/);
});

/* The real App.jsx helpers, evaluated against a small fake world. */
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const appAst = parse(appSource, { sourceType: "module", plugins: ["jsx"] });
const pickNodes = (names) => appAst.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => appSource.substring(node.start, node.end)).join("\n");

const fakeWorld = () => ({
  meId: "me",
  players: { me: { id: "me", name: "Player", username: "player" } },
  chars: ["manon", "brent", "rita", "paul", "ann", "zed"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) + " Last", username: id })),
  rels: {
    "manon>brent": { score: 40 }, "manon>rita": { score: 80 }, "manon>paul": { score: -5 }, "brent>ann": { score: -60 }, "brent>zed": { score: 0 },
  },
  notes: [],
  socialEvents: [
    { text: "Manon posted about her dojo", visibility: "public", actorId: "manon", targetIds: [], type: "post" },
    { text: "Rita and Paul argued", visibility: "public", actorId: "rita", targetIds: ["paul"], type: "comment" },
    { text: "Ann praised Brent", visibility: "public", actorId: "ann", targetIds: ["brent"], type: "comment" },
    { text: "Rita followed Paul", visibility: "public", actorId: "rita", targetIds: ["paul"], type: "follow" },
  ],
  sim: {
    identityCanon: {
      manon: { affiliations: [{ name: "Cobra Kai", kind: "dojo", role: "student" }] },
      brent: { affiliations: [{ name: "House 7", kind: "house", role: "resident" }] },
      rita: { affiliations: [{ name: "Cobra Kai", kind: "dojo", role: "student" }, { name: "Iron Dragons", kind: "dojo", role: "rival" }] },
      paul: { affiliations: [{ name: "Iron Dragons", kind: "dojo", role: "sensei" }] },
      ann: { affiliations: [{ name: "Night Owls", kind: "club", role: "member" }] },
    },
  },
});

function appHelpers() {
  const context = vm.createContext({
    focusedScope, inScope, strongestTieIds, groupsForScope, relationshipInScope, eventInScope,
    humanChars: (w) => Object.values(w.players),
    allSubjects: (w) => Object.values(w.players).concat(w.chars),
    charById: (w, id) => w.chars.find((c) => c.id === id) || w.players[id] || null,
    getRel: (w, a, b) => w.rels[a + ">" + b] || { score: 0 },
    termText: () => "player",
    worldLanguage: () => "en",
    isMediaAccount: () => false,
    identityCanonFor: (w, id) => w.sim.identityCanon[id] || null,
    liveNotes: (w) => w.notes,
    cut: (text, n) => String(text).slice(0, n),
  });
  vm.runInContext(pickNodes(["scopedRosterLine", "worldGroupGlossary", "recentStructuredWorldLines", "notesForAI"]), context);
  return context;
}

test("App: a Manon + Brent conversation names only them, the player and their closest ties", () => {
  const w = fakeWorld();
  const scope = focusedScope(["manon", "brent"], { playerId: w.meId });
  const roster = appHelpers().scopedRosterLine(w, scope);
  for (const name of ["Player", "Manon", "Brent", "Rita", "Ann", "Paul"]) assert.ok(roster.includes(name), name + " expected");
  assert.ok(!roster.includes("Zed"), "a stranger with no tie stays out");
});

test("App: only the groups of the people in the conversation are described", () => {
  const w = fakeWorld();
  const helpers = appHelpers();
  const all = helpers.worldGroupGlossary(w);
  assert.deepEqual(Array.from(all, (g) => g.name).sort(), ["Cobra Kai", "House 7", "Iron Dragons", "Night Owls"]);
  const scoped = helpers.worldGroupGlossary(w, focusedScope(["manon"], { playerId: w.meId }));
  assert.deepEqual(Array.from(scoped, (g) => g.name), ["Cobra Kai"]);
  assert.ok(scoped[0].members.some((m) => m.startsWith("Manon")));
});

test("App: recent public events are limited to the conversation, follows never appear", () => {
  const w = fakeWorld();
  const helpers = appHelpers();
  assert.equal(helpers.recentStructuredWorldLines(w, 10).length, 3);
  const lines = helpers.recentStructuredWorldLines(w, 10, focusedScope(["brent"], { playerId: w.meId }));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Ann praised Brent/);
});

test("App: notes of people outside the conversation are not sent", () => {
  const w = fakeWorld();
  w.notes = [{ authorId: "manon", text: "training" }, { authorId: "rita", text: "party" }];
  const helpers = appHelpers();
  assert.match(helpers.notesForAI(w), /party/);
  const scoped = helpers.notesForAI(w, focusedScope(["manon"], { playerId: w.meId }));
  assert.match(scoped, /training/);
  assert.ok(!scoped.includes("party"));
});
