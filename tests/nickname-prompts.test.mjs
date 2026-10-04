import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { nicknameInfo, plainNickname, stripAliasGloss } from "../src/nicknames.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const players = { tandy: { id: "tandy", name: "Tandy Bowen", nick: "Dagger (her hero name, not everyone uses)", pronouns: "she/her" } };
const chars = [
  { id: "feng", name: "Feng Xiao", nick: "" },
  { id: "richard", name: "Richard Stone", nick: "Richie" },
];
const world = { meId: "tandy", chars };
const everyone = [players.tandy, ...chars];

function harness() {
  const identity = (w, a, b, text) => text;
  const context = vm.createContext({
    String, Array, Object, Set, RegExp, Math, Number, console,
    nicknameInfo, plainNickname, stripAliasGloss,
    allSubjects: () => everyone,
    charById: (w, id) => everyone.find((c) => c.id === id) || null,
    isHuman: (w, id) => id === "tandy",
    isOwnSenseiRelationship: () => false,
    worldLanguage: () => "en",
    identityCanonFor: () => ({}),
    identityPronouns: (c) => c.pronouns || "",
    isFakeDatingText: () => false,
    preferredTitleSurname: () => "",
    sanitizeIncorrectSenseiAddress: identity, sanitizeSelfAliasUsedAsTargetVocative: identity, sanitizeWrongCharacterVocative: identity,
    sanitizeOrientationIncompatibleRomanceText: identity, sanitizeDisallowedFlirtText: identity, stripHostileEndearments: identity, stripBuddyVocatives: identity,
  });
  vm.runInContext(pick(["regexEscapeLiteral", "normalizeAddressText", "normalizePreferredNicknameVocative", "sanitizeGeneratedDirectAddress", "preferredDirectAddressForCharacter", "identityCanonLine"]), context);
  return context;
}

test("What a character says never carries a note about the alias, and the alias is not forced onto everyone", () => {
  const ctx = harness();
  assert.equal(ctx.sanitizeGeneratedDirectAddress(world, "feng", "tandy", "Go away. I always win these games, Tandy, Dagger (her hero name, not everyone uses)."), "Go away. I always win these games, Tandy.");
  assert.equal(ctx.sanitizeGeneratedDirectAddress(world, "feng", "tandy", "Tandy, come here."), "Tandy, come here.", "a hero name 'not everyone uses' is not forced onto every address");
  assert.equal(ctx.sanitizeGeneratedDirectAddress(world, "feng", "richard", "Richard, come here."), "Richie, come here.", "a plain nickname still is");
});

test("The player's identity line tells the model who may say the alias, and never hands it the note as a name", () => {
  const ctx = harness();
  const line = ctx.identityCanonLine(world, players.tandy);
  assert.match(line, /call her: Tandy/);
  assert.ok(!/call her: Dagger/.test(line), line);
  assert.match(line, /alias "Dagger" \(private note, never write it out: her hero name, not everyone uses\)/);
  assert.match(line, /only a speaker whose own sheet or card shows they know and use that name says it/);
  assert.equal(ctx.preferredDirectAddressForCharacter(world, "feng", "tandy"), "Tandy");
  assert.equal(ctx.preferredDirectAddressForCharacter(world, "feng", "richard"), "Richie");
  const plain = ctx.identityCanonLine(world, { ...players.tandy, nick: "Tan" });
  assert.match(plain, /call her: Tan$/, "a plain nickname is just the way to call her: " + plain);
});
