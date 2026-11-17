import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { nicknameInfo } from "../src/nicknames.js";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const world = {
  meId: "me",
  chars: [
    { id: "eli", name: "Eli Moskowitz", nick: "Hawk" },
    { id: "ng", name: "Nam-gyu", nick: "" },
    { id: "rob", name: "Robby \"Bobby\" Keene", nick: "" },
  ],
};

function sandbox() {
  const context = vm.createContext({
    String, Array, RegExp, Set, Math,
    nicknameInfo,
    charById: (w, id) => w.chars.find((c) => c.id === id) || null,
    isHuman: () => false,
    worldLanguage: () => "en",
  });
  vm.runInContext(pick(["normalizeCharacterIdentityText", "characterIdentityNicknameParts", "characterOtherNames", "groupCastIdentityBlock", "sceneSpeechSelfThirdPerson"]), context);
  return context;
}

test("R117: Eli and Hawk are one person — Eli greeting 'Hawk' as a newcomer is caught", () => {
  const c = sandbox();
  assert.deepEqual([...c.characterOtherNames(world.chars[0])], ["Hawk"]);
  assert.deepEqual([...c.characterOtherNames(world.chars[2])], ["Bobby"], "a nickname written into the full name counts");
  assert.equal(c.sceneSpeechSelfThirdPerson(world, "eli", "Hawk?! What the hell are you doing in this group chat?"), true);
  assert.equal(c.sceneSpeechSelfThirdPerson(world, "ng", "Nam-gyu will deal with you."), true, "third person about himself");
  assert.equal(c.sceneSpeechSelfThirdPerson(world, "eli", "I'm Hawk, remember that."), false, "introducing yourself is fine");
  assert.equal(c.sceneSpeechSelfThirdPerson(world, "ng", "Hawk, shut up."), false, "naming somebody else is fine");
  assert.equal(c.sceneSpeechSelfThirdPerson(world, "eli", "Nam-gyu, you're done."), false);
});

test("R117: the group chat prompt lists every member once with all their names", () => {
  const c = sandbox();
  const block = c.groupCastIdentityBlock(world, ["eli", "ng"]);
  assert.match(block, /- Eli Moskowitz = also called "Hawk" \(the SAME person\)/);
  assert.match(block, /- Nam-gyu\n/);
  assert.match(block, /Address by name only people who are in this group/);
  assert.match(source, /\$\{groupCastIdentityBlock\(w, groupAiIds\)\}/, "interactive group chat");
  assert.match(source, /\$\{groupCastIdentityBlock\(w, memberIds\)\}/, "autonomous group chat");
  assert.match(source, /if \(sceneSpeechSelfThirdPerson\(w, id, body\)\) \{\n\s*reportClientDiag\("group-self-name"/);
  assert.match(source, /if \(sceneSpeechSelfThirdPerson\(view, who, text\)\) return null;/);
});
