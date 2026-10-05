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
  vm.runInContext(pick(["worldContentLevel", "isKnownAdultCharacter", "matureParticipantsAreAdults", "matureCommentInstruction", "withCommentTone", "askWorldWritingJSON", "askWorldWritingJSONInteractive", "normalizeDmAnswerShape"]), context);
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

test("When everyone in the thread is a known adult, comments may be crude, vulgar and obscene, with no ceiling of the game's own", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction(world(), ["rita", "paul", "me"]);
  assert.match(text, /MATURE 18\+ COMMENT MODE — ADULTS ONLY/);
  assert.match(text, /crude, vulgar and obscene/);
  assert.match(text, /strong profanity/);
  assert.match(text, /Do NOT sanitize/);
  assert.match(text, /sets no ceiling of its own on how crude or explicit these adults may get/);
  assert.doesNotMatch(text, /non-graphic|no anatomical|no explicit sex/i, "the game adds no limit on top of the provider's");
  assert.match(text, /never sexualize anyone who is not a confirmed adult/);
  assert.match(text, /orientation and flirt-permission rules still apply/);
  assert.match(text, /never invent the player's own feelings or consent/);
});

test("The Hungarian world gets the Hungarian block with the same limits", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction(world({ lang: "hu" }), ["rita", "paul"]);
  assert.match(text, /MATURE 18\+ KOMMENT MÓD — CSAK FELNŐTTEK KÖZÖTT/);
  assert.match(text, /trágárok/);
  assert.match(text, /nem szab plafont arra, mennyire lehetnek ezek a felnőttek durvák vagy explicitek/);
  assert.doesNotMatch(text, /nem grafikus|anatómiai leírás/i);
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

/* ---------- the writers decide the crude language, everyone decides the sexual banter ---------- */

const mixed = () => ({
  meId: "me", lang: "en",
  chars: [{ id: "me" }, { id: "rita", age: "27" }, { id: "paul", age: "31" }, { id: "kid", age: "16" }, { id: "poster-unknown" }, { id: "mystery" }],
});

test("Adult commenters get the crude-language block even when the poster or the player has no confirmed age, but with the sexual banter switched off", () => {
  const { context } = harness();
  for (const poster of ["poster-unknown", "kid", "mystery"]) {
    const text = context.matureCommentInstruction(mixed(), ["rita", "paul", poster], ["rita", "paul"]);
    assert.match(text, /MATURE 18\+ COMMENT MODE — CRUDE LANGUAGE/, poster);
    assert.match(text, /strong profanity, brutal roasting, trash talk/, poster);
    assert.match(text, /keep it NON-SEXUAL: no sexual banter, innuendo or thirst aimed at anyone/, poster);
    assert.match(text, /nothing sexual about any person who is not a confirmed adult/, poster);
    assert.doesNotMatch(text, /filthy jokes|blunt sexual banter|shameless thirst/, poster + ": no sexual banter in this tier");
  }
  /* the player's own character (not an argument, always counted) with no age: same tier */
  const text = context.matureCommentInstruction(mixed(), ["rita", "paul"], ["rita", "paul"]);
  assert.match(text, /CRUDE LANGUAGE/);
});

test("When everyone involved is a known adult the writers get the full adult block, as before", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction(world(), ["rita", "paul", "me"], ["rita", "paul"]);
  assert.match(text, /MATURE 18\+ COMMENT MODE — ADULTS ONLY/);
  assert.match(text, /filthy jokes, blunt sexual banter/);
});

test("A commenter who is a minor or has no confirmed age gets nothing, whoever else is in the thread", () => {
  const { context } = harness();
  for (const writers of [["kid"], ["rita", "kid"], ["rita", "mystery"], ["mystery"], []]) {
    assert.equal(context.matureCommentInstruction(mixed(), ["rita", "paul", ...writers], writers), "", writers.join(",") || "(nobody)");
  }
});

test("The Hungarian world gets the Hungarian crude-language block, also without sexual content", () => {
  const { context } = harness();
  const text = context.matureCommentInstruction({ ...mixed(), lang: "hu" }, ["rita", "poster-unknown"], ["rita"]);
  assert.match(text, /NYERS NYELVEZET/);
  assert.match(text, /erős káromkodás, brutális beszólás/);
  assert.match(text, /maradjon SZEXUÁLIS TARTALOM NÉLKÜL/);
  assert.doesNotMatch(text, /mocskos viccek|szégyentelen vágyakozás/);
});

test("A call that does not name its writers keeps the strict rule: everyone must be a known adult, otherwise nothing", () => {
  const { context } = harness();
  assert.equal(context.matureCommentInstruction(mixed(), ["rita", "paul"]), "", "the player's character has no age, so nothing without named writers");
  assert.notEqual(context.matureCommentInstruction(world(), ["rita", "paul"]), "");
});

test("The comment wrapper passes the writers on, strips both options from the AI request and picks the tier", async () => {
  const { context, sent } = harness();
  await context.askWorldWritingJSON("comments", mixed(), "sys", "THREAD\n[[PROTECTED_TAIL]]\nJSON", { maxTokens: 200, participants: ["rita", "poster-unknown"], commenters: ["rita"] });
  await context.askWorldWritingJSONInteractive("comments", mixed(), "sys", "THREAD", { participants: ["rita", "kid"], commenters: ["kid"] });
  assert.match(sent[0].prompt, /CRUDE LANGUAGE/);
  assert.ok(sent[0].prompt.indexOf("CRUDE LANGUAGE") < sent[0].prompt.indexOf("[[PROTECTED_TAIL]]"));
  assert.equal(sent[1].prompt, "THREAD", "a minor writing: untouched");
  for (const call of sent) { assert.equal("participants" in call.options, false); assert.equal("commenters" in call.options, false); }
  await context.askWorldWritingJSON("dm", mixed(), "sys", "P", { commenters: ["rita"], participants: ["rita"] });
  assert.equal(sent[2].prompt, "P", "never for anything but comments");
});

test("Every comment generator names the poster and the people it writes for, and who writes, so the age check covers all of them", () => {
  const sites = [...source.matchAll(/askWorldWritingJSON(?:Interactive)?\("comments"/g)];
  assert.equal(sites.length, 10);
  assert.equal((source.match(/participants:/g) || []).length, 9, "nine of the ten name their participants");
  assert.equal((source.match(/^\s*(?:\{.*)?.*[ ,{]commenters: (?:\[|cast\.|candidates\.|castIds|plannedCards\.map\(\(card\) => card\.id\))/gm) || []).length >= 9, true, "and name who writes");
  const gossip = source.slice(source.indexOf("async function genGossipReactions"), source.indexOf("async function genGossipReactions") + 4000);
  assert.ok(!/participants:/.test(gossip), "the gossip-media reactions do not (a media account has no age, so it could never pass the check anyway)");
  for (const needle of [
    "participants: [...cast.map((c) => c.id), post.authorId], commenters: cast.map((c) => c.id)",
    "participants: [...candidates.map((c) => c.id), post.authorId], commenters: candidates.map((c) => c.id)",
    "participants: [...cast.map((c) => c.id), post.authorId, comment.authorId], commenters: cast.map((c) => c.id)",
    "commenters: [directResponder.id],",
    "participants: [responderId, post.authorId, comment.authorId], commenters: [responderId]",
    "participants: [forcedResponder.id, post.authorId, comment.authorId], commenters: [forcedResponder.id]",
    "participants: castIds.concat([target.id]),\n      commenters: castIds,",
    "participants: [...plannedCards.map((card) => card.id), post.authorId],\n          commenters: plannedCards.map((card) => card.id),",
  ]) assert.ok(source.includes(needle), needle);
});
