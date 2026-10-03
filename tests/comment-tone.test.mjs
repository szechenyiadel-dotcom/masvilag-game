import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { insertBeforeProtectedTail } from "../src/semanticMemory.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

function harness() {
  const sent = [];
  const context = vm.createContext({
    Array, Object, String, Number, Promise,
    insertBeforeProtectedTail,
    charById: (w, id) => (w.chars || []).find((c) => c.id === id) || null,
    ageOf: (c) => c.age || "",
    worldLanguage: (w) => w.lang || "hu",
    askWorldJSON: async (w, system, prompt, options) => { sent.push({ via: "background", prompt, options }); return {}; },
    askWorldJSONInteractive: async (w, system, prompt, options) => { sent.push({ via: "interactive", prompt, options }); return {}; },
  });
  vm.runInContext(pick(["worldContentLevel", "isKnownAdultCharacter", "matureParticipantsAreAdults", "matureCommentInstruction", "withCommentTone", "askWorldWritingJSON", "askWorldWritingJSONInteractive"]), context);
  return { context, sent };
}
const world = (extra = {}) => ({
  meId: "me", lang: "en",
  chars: [
    { id: "me", age: "24" }, { id: "rita", age: "27" }, { id: "paul", age: "31" },
    { id: "kid", age: "16" }, { id: "mystery" }, { id: "edge", age: "17" }, { id: "just", age: "18" },
  ],
  ...extra,
});

test("When everyone in the thread is a known adult, comments may be crude, vulgar and obscene, but stay non-graphic", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction(world(), ["rita", "paul", "me"]);
  assert.match(text, /MATURE 18\+ COMMENT MODE — ADULTS ONLY/);
  assert.match(text, /crude, vulgar and obscene/);
  assert.match(text, /strong profanity/);
  assert.match(text, /Do NOT sanitize/);
  assert.match(text, /non-graphic \(innuendo and bluntness, no anatomical description and no explicit sex acts\)/);
  assert.match(text, /never sexualize anyone who is not a confirmed adult/);
  assert.match(text, /orientation and flirt-permission rules still apply/);
  assert.match(text, /never invent the player's own feelings or consent/);
});

test("The Hungarian world gets the Hungarian block with the same limits", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction(world({ lang: "hu" }), ["rita", "paul"]);
  assert.match(text, /MATURE 18\+ KOMMENT MÓD — CSAK FELNŐTTEK KÖZÖTT/);
  assert.match(text, /trágárok/);
  assert.match(text, /nem grafikus/);
  assert.match(text, /senkit se szexualizálj, aki nem igazoltan felnőtt/);
  assert.match(text, /orientációs és flörtengedély-szabályok/);
});

test("One person who is a minor, or whose age is not confirmed, switches the whole block off", () => {
  const { context } = harness();
  for (const ids of [["rita", "kid"], ["rita", "mystery"], ["rita", "edge"], ["kid"], ["mystery"], ["rita", "nobody-in-this-world"]]) {
    assert.equal(context.matureCommentInstruction(world(), ids), "", ids.join(","));
  }
  assert.notEqual(context.matureCommentInstruction(world(), ["rita", "just"]), "", "exactly 18 counts as an adult");
});

test("If the player's own character is not a known adult, no comment block is ever added", () => {
  const { context } = harness();
  const minor = world({ chars: [{ id: "me", age: "17" }, { id: "rita", age: "27" }] });
  assert.equal(context.matureCommentInstruction(minor, ["rita"]), "");
  const unknown = world({ chars: [{ id: "me" }, { id: "rita", age: "27" }] });
  assert.equal(context.matureCommentInstruction(unknown, ["rita"]), "");
});

test("Nobody named, nobody to vouch for: nothing is added", () => {
  const { context } = harness();
  for (const ids of [[], undefined, null, ["", null]]) assert.equal(context.matureCommentInstruction(world(), ids), "");
});

test("Comment calls get the block before the protected tail, and the participants never travel on to the AI request", async () => {
  const { context, sent } = harness();
  const prompt = "THREAD...\n[[PROTECTED_TAIL]]\nanswer in JSON";
  await context.askWorldWritingJSON("comments", world(), "sys", prompt, { maxTokens: 300, participants: ["rita", "paul"] });
  await context.askWorldWritingJSONInteractive("comments", world(), "sys", prompt, { maxTokens: 150, participants: ["rita", "paul"] });
  for (const call of sent) {
    assert.match(call.prompt, /MATURE 18\+ COMMENT MODE/);
    assert.ok(call.prompt.indexOf("COMMENT MODE") < call.prompt.indexOf("[[PROTECTED_TAIL]]"), "the tail stays last");
    assert.equal("participants" in call.options, false);
    assert.equal(call.options.source, "comments");
  }
  assert.deepEqual(sent.map((c) => c.via), ["background", "interactive"]);
  assert.equal(sent[0].options.maxTokens, 300);
});

test("With a minor in the thread the prompt goes out exactly as it was written", async () => {
  const { context, sent } = harness();
  await context.askWorldWritingJSON("comments", world(), "sys", "THREAD", { participants: ["rita", "kid"] });
  assert.equal(sent[0].prompt, "THREAD");
});

test("Only comments are touched: DMs, scenes and the rest never get the comment block", async () => {
  const { context, sent } = harness();
  for (const kind of ["dm", "scene", "feed-post", "notes", "group-chat"]) {
    await context.askWorldWritingJSON(kind, world(), "sys", "PROMPT", { participants: ["rita", "paul"] });
  }
  assert.ok(sent.every((call) => call.prompt === "PROMPT"));
  assert.ok(sent.every((call) => "participants" in call.options === false));
});

test("A comment call that names nobody is left alone", async () => {
  const { context, sent } = harness();
  await context.askWorldWritingJSON("comments", world(), "sys", "PROMPT", { maxTokens: 100 });
  assert.equal(sent[0].prompt, "PROMPT");
});

test("Every comment generator names the poster and the people it writes for, so the age check covers all of them", () => {
  const sites = [...source.matchAll(/askWorldWritingJSON(?:Interactive)?\("comments"/g)];
  assert.equal(sites.length, 10);
  assert.equal((source.match(/participants:/g) || []).length, 9, "nine of the ten name their participants");
  const gossip = source.slice(source.indexOf("async function genGossipReactions"), source.indexOf("async function genGossipReactions") + 4000);
  assert.ok(!/participants:/.test(gossip), "the gossip-media reactions do not (a media account has no age, so it could never pass the check anyway)");
  for (const needle of [
    "participants: [...cast.map((c) => c.id), post.authorId]",
    "participants: [...candidates.map((c) => c.id), post.authorId]",
    "participants: [...cast.map((c) => c.id), post.authorId, comment.authorId]",
    "participants: [directResponder.id, post.authorId, comment.authorId]",
    "participants: [responderId, post.authorId, comment.authorId]",
    "participants: [forcedResponder.id, post.authorId, comment.authorId]",
    "participants: castIds.concat([target.id])",
    "participants: [...plannedCards.map((card) => card.id), post.authorId]",
  ]) assert.ok(source.includes(needle), needle);
});
