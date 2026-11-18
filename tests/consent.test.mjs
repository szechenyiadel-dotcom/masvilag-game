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

function sandbox() {
  const context = vm.createContext({ String, Array, RegExp, Boolean, nameOfIn: () => "Tandy Bowen" });
  vm.runInContext(pick(["splitQuotedSpeech", "PLAYER_REFUSAL_RE", "PLAYER_NOT_REFUSAL_RE", "PLAYER_CONSENT_RE", "SCENE_COERCION_RE", "playerRefusalState", "roleplayConsentBlock", "sceneRespectRefusal"]), context);
  return context;
}
const w = { meId: "me" };
const scene = (...player) => ({ turns: player.map((text) => ({ authorId: "me", text })) });

test("R132: 'don't do this', pushing away, breaking free, a slap are a no", () => {
  const c = sandbox();
  for (const line of ["don't do this *she whispers*", "Don't call me a bitch", "*she pushes him away* dont talk me like that", "*she breaks free* asshole", "*she slaps him*", "fuck off I'm not a bitch", "no.", "let me go"]) {
    assert.ok(c.playerRefusalState(w, scene(line)), line);
  }
  for (const line of ["don't stop", "kiss me", "*she pulls him closer*", "no way, really?", "fuck..."]) assert.equal(c.playerRefusalState(w, scene(line)), null, line);
  assert.ok(c.playerRefusalState(w, scene("*she pushes him away*", "*she moans* fuck")), "a moan right after a no does not undo the no");
  assert.equal(c.playerRefusalState(w, scene("*she pushes him away*", "kiss me")), null, "her own yes does");
});

test("R132: after the no, the coercive sentences of Nam-gyu's turn are removed; anger stays", () => {
  const c = sandbox();
  const s = scene("*she pushes him away* dont talk me like that");
  const turn = "Nam-gyu grabs Tandy's wrists and twists them painfully behind her back, slamming her face-first against the wall. \"You push me? You fucking dare to push me? I own you. You'll regret that.\"";
  const out = c.sceneRespectRefusal(w, s, turn, "");
  assert.doesNotMatch(out, /wrists|wall|own you/);
  assert.match(out, /You push me\? You fucking dare to push me\?/);
  assert.match(c.roleplayConsentBlock(w, s, ""), /HARD LINE[\s\S]*lets go and steps back/);
  assert.equal(c.sceneRespectRefusal(w, scene("kiss me"), turn, ""), turn, "no refusal, nothing removed");
  assert.match(source, /\$\{roleplayLatestBeatTail\(w, promptTurns, playerText, who\)\}\$\{roleplayConsentBlock\(w, promptScene, playerText\)\}/, "the card sits in the protected tail");
});
