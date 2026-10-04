import test from "node:test";
import assert from "node:assert/strict";
import { nicknameInfo, plainNickname, stripAliasGloss } from "../src/nicknames.js";

test("A nickname field is split into the name and the note written next to it", () => {
  assert.deepEqual(nicknameInfo("Dagger (her hero name, not everyone uses)"), { name: "Dagger", note: "her hero name, not everyone uses", plain: false });
  assert.deepEqual(nicknameInfo("Richie"), { name: "Richie", note: "", plain: true });
  assert.deepEqual(nicknameInfo("  “Richie”  "), { name: "Richie", note: "", plain: true });
  assert.equal(nicknameInfo("Richie, Rich").name, "Richie");
  assert.equal(nicknameInfo("Richie, Rich").plain, true, "a list of names restricts nothing");
  assert.equal(nicknameInfo("Dagger - hero name").plain, false);
  assert.equal(nicknameInfo("Tőrös (a hőse neve, nem mindenki használja)").plain, false, "Hungarian notes too");
  assert.deepEqual(nicknameInfo(""), { name: "", note: "", plain: true });
  assert.equal(nicknameInfo("everyone calls her the girl with the dagger").name, "", "a sentence is not a name");
  assert.equal(plainNickname("Dagger (hero name)"), "", "a restricted alias is not a default way to address someone");
  assert.equal(plainNickname("Richie"), "Richie");
});

const people = [{ name: "Tandy Bowen", nick: "Dagger (her hero name, not everyone uses)" }, { name: "Brent LaRusso", nick: "" }];

test("The gloss a model writes after a name is removed; the sentence around it is kept", () => {
  assert.equal(stripAliasGloss("Go away. But you'll be back. I always win these games, Tandy, Dagger (her hero name, not everyone uses).", people),
    "Go away. But you'll be back. I always win these games, Tandy.");
  assert.equal(stripAliasGloss("Hey Dagger (nickname), you good?", people), "Hey Dagger, you good?");
  assert.equal(stripAliasGloss("Dagger (hero name) is on fire", people), "Dagger is on fire");
  assert.equal(stripAliasGloss("Nice one (aka the queen of mean)", people), "Nice one");
  assert.equal(stripAliasGloss("Szia Tőrös (a hőse neve), mi újság?", []), "Szia Tőrös, mi újság?");
});

test("A name and its alias stacked are one form: the one written first", () => {
  assert.equal(stripAliasGloss("You did great, Tandy, Dagger.", people), "You did great, Tandy.");
  assert.equal(stripAliasGloss("Dagger / Tandy!", people), "Dagger!");
  assert.equal(stripAliasGloss("Tandy (Dagger) Bowen is here", people), "Tandy Bowen is here");
  assert.equal(stripAliasGloss('Tandy "Dagger" Bowen is here', people), "Tandy Bowen is here");
  assert.equal(stripAliasGloss("Tandy Bowen, Dagger.", people), "Tandy Bowen.");
});

test("Real speech is left alone", () => {
  for (const line of ["Dagger, come here.", "Tandy is Dagger to some people, not to me.", "Tandy, Dagger's looking for you.", "I told Tandy, then Dagger left (finally).", "Brent (finally) showed up", "Tandy and Dagger are the same person?"]) {
    assert.equal(stripAliasGloss(line, people), line, line);
  }
  assert.equal(stripAliasGloss("", people), "");
  assert.equal(stripAliasGloss("plain", []), "plain");
});
