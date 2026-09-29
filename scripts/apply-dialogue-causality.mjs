import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const huMarker = "OK-OKOZATI FOLYTONOSSÁG — HARD RULE";
const enMarker = "CAUSAL CONTINUITY — HARD RULE";
const sceneMarker = "ROLEPLAY TURN CAUSALITY — HARD";
const retryMarker = "ROLEPLAY RETRY CAUSALITY — HARD";

if (!next.includes(huMarker)) {
  const huAnchor = /(FŐ SZABÁLY:[^\r\n]*\r?\n)/;
  if (!huAnchor.test(next)) {
    throw new Error("Dialogue causality patch aborted: HU engine anchor not found.");
  }

  const huBlock = `${huMarker}:\n- MINDIG a legfrissebb, időrendben utolsó megfigyelhető megszólalásból/cselekvésből indulj tovább. A régebbi állapotot ne kezeld úgy, mintha még mindig aktuális lenne.\n- Mielőtt választ írsz, fejben rögzítsd: mi történt LEGUTOLJÁRA, ki tette/mondta, kinek szólt, és ez mit változtatott meg a helyzeten. A válasznak erre kell épülnie.\n- Egy már lezajlott beatet ne játsz újra és ne mondd el újra közeli parafrázissal. Ha a csók már megtörtént, ne viselkedj úgy a következő turnben, mintha még mindig a csók előtti hezitálás lenne a jelenlegi probléma.\n- A következő mondatnak vagy cselekvésnek ÚJ reakciót, következményt, információt, döntést vagy előrelépést kell adnia. Ugyanazt a szemrehányást, poént, fenyegetést, flörtformulát vagy szándékot ne ismételd csak más szavakkal.\n- A fizikai állapot tartós: levett ruha levett marad, megfogott tárgy helye számít, testhelyzet/érintés/sérülés/ajtó/helyszín csak új cselekvéssel változhat meg.\n- A párbeszéd ténylegesen válaszoljon arra, ami elhangzott. Kérdésre válaszolj; puszta cselekvést ne kezelj kimondott mondatként; ne reagálj olyan kijelentésre, amit senki nem tett.\n- A kronológia erősebb, mint egy karakter tipikus catchphrase-e vagy visszatérő attitűdje. A karakter maradjon önmaga, de mindig a MOSTANI helyzetre reagáljon.\n- Ha ugyanaz a generált sor változtatás nélkül ugyanúgy működött volna egy turnnel korábban is, ellenőrizd újra: valószínűleg figyelmen kívül hagytad a legfrissebb történést.\n- Ne találj ki a játékosnak választ, mozdulatot, érzést vagy beleegyezést.\n`;

  next = next.replace(huAnchor, (match) => match + "\n" + huBlock + "\n");
}

if (!next.includes(enMarker)) {
  const enAnchor = /(MAIN RULE:[^\r\n]*\r?\n)/;
  if (!enAnchor.test(next)) {
    throw new Error("Dialogue causality patch aborted: EN engine anchor not found.");
  }

  const enBlock = `${enMarker}:\n- ALWAYS continue from the newest observable line/action in chronological order. Never answer an older state as if the newest turn had not happened.\n- Before writing, resolve four facts: what happened LAST, who did/said it, who it targeted, and what it changed in the situation. The response must grow from that.\n- Never replay a completed beat or restate it as a near-paraphrase. If a kiss already happened, the next turn must not behave as if the scene is still waiting for that kiss.\n- Each new line/action must add a new reaction, consequence, fact, decision, or progression. Do not repeat the same complaint, joke, threat, flirt formula, or intention in different words.\n- Physical state persists: removed clothing stays removed, held objects/positions/touch/injuries/doors/location remain true until a new action changes them.\n- Dialogue must answer what was actually said. Answer real questions; do not treat an action-only input as spoken dialogue; never respond to a line nobody said.\n- Chronology outranks a character's favorite catchphrase or recurring attitude. Stay in character while reacting to the CURRENT beat.\n- If a generated line would work unchanged one turn earlier, re-check it: it probably ignored the newest development.\n- Never invent the player's next action, dialogue, feeling, or consent.\n`;

  next = next.replace(enAnchor, (match) => match + "\n" + enBlock + "\n");
}

if (!next.includes(sceneMarker)) {
  const sceneAnchor = /(ROLEPLAY FOLYTATÁS — FONTOS:\r?\n)/;
  if (!sceneAnchor.test(next)) {
    throw new Error("Dialogue causality patch aborted: roleplay continuation anchor not found.");
  }

  const sceneBlock = `${sceneMarker}:\n- A PONTOS LEGUTÓBBI TURN-NAPLÓ utolsó 1-3 sora az elsődleges ok-okozati input. Minden új beat előtt külön ellenőrizd őket.\n- Az utolsó játékosi action AZONNAL megváltoztatja a jelenlegi scene-state-et. A következő AI-beat már az UTÁNA fennálló helyzetben történik, nem az előzőben.\n- Ha a játékos egy korábbi kezdeményezést már elfogadott/viszonzott, ne kérd vagy provokáld ki ugyanazt újra. Haladj a következő természetes reakcióra.\n- Konkrét példa a kerülendő hibára: ha már megtörtént a csók, majd a játékos leveszi a másik felsőjét, a következő válasz ne ismételje, hogy „végre megtetted / sokáig tartott”; reagáljon a LEGVÉGÉN történt új cselekvésre vagy vigye onnan tovább a jelenetet.\n- Fizikai kontinuitás audit minden körben: ki hol van, mit visel még, mit tart, kit érint, milyen testhelyzetben van, milyen sérülése van, milyen ajtó/tárgy/helyzet változott. Ne állíts vissza korábbi állapotot.\n- Intimitási szint nem léphet indokolatlanul vissza. A mutual-kissing/private-intimacy/post-intimacy állapotot csak tényleges új esemény módosítsa, ne feledékenység.\n- Egy karakter egymást követő beatjei ne ugyanazt az érzelmi vagy verbális funkciót ismételjék. A második beatnek következménynek vagy új lépésnek kell lennie.\n- A sceneMemory.currentBeat azt írja le, MI TÖRTÉNIK MOST, nem azt, mi történt két körrel ezelőtt.\n\n`;

  next = next.replace(sceneAnchor, (match) => match + "\n" + sceneBlock);
}

if (!next.includes(retryMarker)) {
  const retryAnchor = /(SZIGORÚ ÚJRAGENERÁLÁSI SZABÁLYOK:\r?\n)/;
  if (!retryAnchor.test(next)) {
    throw new Error("Dialogue causality patch aborted: roleplay retry anchor not found.");
  }

  const retryBlock = `${retryMarker}:\n- Az újragenerálásnál ne csak a szövegezést változtasd meg: a LEGVÉGÉN megtörtént turnből indulj tovább ok-okozatilag.\n- Tilos olyan új sort adni, amely egy már lezajlott mozzanatot újra aktuális problémának kezel.\n- Minden új beatnek legyen egyértelmű kiváltó oka a legfrissebb naplóban, és vigye előre a jelenlegi állapotot.\n- A fizikai és intim state-et ne reseteld.\n\n`;

  next = next.replace(retryAnchor, (match) => match + retryBlock);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied dialogue + scene causal continuity rules.");
} else {
  console.log("Dialogue + scene causal continuity rules already applied.");
}
