import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse } = require("@babel/parser");
const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const pick = (names) => ast.program.body
  .filter((node) => names.includes(node.id?.name) || (node.declarations || []).some((d) => names.includes(d.id?.name)))
  .map((node) => source.substring(node.start, node.end)).join("\n");

const context = vm.createContext({
  Array, Object, String, Number,
  charById: (w, id) => (w.chars || []).find((c) => c.id === id) || null,
  ageOf: (c) => c.age || "",
  worldLanguage: (w) => w.lang || "hu",
});
vm.runInContext(pick(["worldContentLevel", "isKnownAdultCharacter", "matureParticipantsAreAdults", "matureRoleplayToneBoostInstruction", "matureContentInstruction"]), context);

const world = (lang) => ({ meId: "me", lang, chars: [{ id: "me", age: "24" }, { id: "rita", age: "27" }, { id: "kid", age: "16" }, { id: "mystery" }] });
const adults = ["rita"];

for (const [lang, ceilingLine, oldRule, minorLine] of [
  ["en", /sets no ceiling on how explicit intimacy between known, consenting adults may be/, /No explicit pornographic sexual detail/, /Never sexualize a minor/],
  ["hu", /nem szab plafont az explicitségre ismert, beleegyező felnőttek között/, /Explicit pornográf szexuális részleteket ne írj/, /Kiskorút soha ne szexualizálj/],
]) {
  test(`${lang}: between known adults the game sets no ceiling of its own, in every channel`, () => {
    for (const channel of ["chat", "group", "roleplay"]) {
      const text = context.matureContentInstruction(world(lang), adults, channel);
      assert.match(text, ceilingLine, channel);
      assert.doesNotMatch(text, oldRule, channel);
      assert.doesNotMatch(text, /non-graphic limit|nem explicit határon/, channel);
    }
  });

  test(`${lang}: the roleplay tone boost carries the same sentence and no longer forbids detail`, () => {
    const text = context.matureRoleplayToneBoostInstruction(lang === "en", true);
    assert.match(text, ceilingLine);
    assert.doesNotMatch(text, /Do not describe anatomy|Anatómiai vagy explicit szexuális részletezés ne legyen|staying non-graphic|nem grafikusan/);
  });

  test(`${lang}: the protections that matter stay in force for known adults too`, () => {
    const text = context.matureContentInstruction(world(lang), adults, "roleplay");
    assert.match(text, minorLine);
    assert.match(text, lang === "en" ? /Never narrate the player's consent|never narrate the player's consent|Never narrate the player/i : /SOHA ne írd le helyette, hogy beleegyezik/);
    assert.match(text, lang === "en" ? /Consent must remain meaningful/ : /A beleegyezés maradjon valódi/);
    assert.match(text, lang === "en" ? /ORIENTATION IS HARD IDENTITY CANON/ : /AZ ORIENTÁCIÓ KEMÉNY IDENTITÁSKÁNON/);
    assert.match(text, lang === "en" ? /Never override a character's established boundaries/ : /soha ne írj felül egy karakterhez tartozó határt/);
  });

  test(`${lang}: with a minor or an unconfirmed age among the participants nothing is loosened`, () => {
    for (const ids of [["rita", "kid"], ["rita", "mystery"]]) {
      const text = context.matureContentInstruction(world(lang), ids, "roleplay");
      assert.match(text, oldRule, "the old limit stays when not everyone is a confirmed adult");
      assert.doesNotMatch(text, ceilingLine);
      assert.doesNotMatch(text, /TONE BOOST|HANGVÉTEL-ERŐSÍTÉS/, "no adult tone boost either");
      assert.match(text, lang === "en" ? /do NOT generate sexual or sexually suggestive content involving that participant/ : /semmilyen szexuális vagy szexuálisan kétértelmű tartalmat ne generálj/);
    }
  });
}

test("The player's own character counts: an unconfirmed player keeps the limits for everyone", () => {
  const unknownPlayer = { meId: "me", lang: "en", chars: [{ id: "me" }, { id: "rita", age: "27" }] };
  const text = context.matureContentInstruction(unknownPlayer, adults, "roleplay");
  assert.match(text, /No explicit pornographic sexual detail/);
  assert.doesNotMatch(text, /sets no ceiling/);
});

test("The only mentions of a ceiling left in the prompts are the ones for people who are not all confirmed adults", () => {
  const hits = source.split("\n").map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => /non-graphic|nem grafikus|nem-grafikus|pornogr|anatómi|anatomi|graphically/i.test(line));
  assert.equal(hits.length, 2, hits.map((h) => h.n + ": " + h.line.slice(0, 80)).join("\n"));
  for (const { line } of hits) assert.match(line, /^\s*: "(No explicit pornographic|Explicit pornográf)/);
});

test("The minor-protection lines in the shared voice prompts are untouched", () => {
  for (const needle of [
    "Kiskorú szereplő soha, semmilyen formában nem kerülhet romantikus vagy szexuális helyzetbe — ez alól nincs kivétel.",
    "Kiskorú vagy bizonytalan életkorú szereplő romantikus/szexuális helyzetbe továbbra sem kerülhet.",
    "A minor character must never, under any circumstances, be placed in a romantic or sexual situation — there is no exception to this.",
    "Minors or characters of uncertain age remain completely excluded from romantic or sexual situations.",
    "Kiskorút vagy nem igazoltan 18+ személyt soha ne szexualizálj.",
    "Never sexualize a minor or a person whose age is not confirmed 18+.",
  ]) assert.ok(source.includes(needle), needle);
});

test("The voice prompts say the same thing as the mature modes: no ceiling of the game's own, between known consenting adults", () => {
  assert.ok(source.includes("The game itself sets no ceiling on how explicit intimacy between known, consenting adults may be"));
  assert.ok(source.includes("A játék maga nem szab plafont az explicitségre ismert, beleegyező felnőttek között"));
  assert.ok(source.includes("how explicit intimacy gets is limited only by the AI provider's own rules"));
  assert.ok(source.includes("az intimitás explicitségét csak az AI-szolgáltató saját szabályai korlátozzák"));
});
