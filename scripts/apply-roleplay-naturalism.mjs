import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const huMarker = "TERMÉSZETES PÁRBESZÉDFUNKCIÓ — HARD RULE";
const enMarker = "NATURAL DIALOGUE FUNCTION — HARD RULE";
const sceneMarker = "ROLEPLAY NATURALISM — HARD";
const retryMarker = "ROLEPLAY RETRY NATURALISM — HARD";

if (!next.includes(huMarker)) {
  const anchor = /(OK-OKOZATI FOLYTONOSSÁG — HARD RULE:[\s\S]*?- Ne találj ki a játékosnak választ, mozdulatot, érzést vagy beleegyezést\.\r?\n)/;
  if (!anchor.test(next)) {
    throw new Error("Roleplay naturalism patch aborted: HU causal continuity anchor not found.");
  }

  const block = `\n${huMarker}:\n- Egy karaktert ne redukálj egyetlen ismételt személyiségjegyre. A domináns, szarkasztikus, birtokló, hideg, flörtölős, arrogáns, félénk stb. csak szűrő a viselkedésen, nem utasítás ugyanarra a reakcióra minden körben.\n- Minden válasznak legyen a LEGFRISSEBB beathez illő kommunikációs FUNKCIÓJA: válasz, reagálás, cselekvés, döntés, felfedés, elhárítás, poén, eszkaláció, enyhülés, visszavonulás vagy irányváltás. Ne írj sort csak azért, mert önmagában karakterhűen hangzik.\n- Direkt kérdésre normál esetben tényleges válasz vagy tudatos, karakterindokolt kitérés jöjjön ELŐBB; ne hagyd figyelmen kívül a jelentését csak egy újabb beszólás kedvéért.\n- Egy már elhangzott szemrehányás, challenge, poén, vád, fenyegetés vagy flört-hook LEJÁRT, hacsak új esemény nem nyitja meg újra. Ne körözz ugyanazon sérelem körül egymást követő turnökben.\n- Puszta cselekvés mögé ne találj ki automatikusan motivációt. Ha valaki leveszi a pólóját, abból nem következik automatikusan, hogy „ártatlant játszik”, „el akar terelni”, „tesztel”, stb.\n- A válasz FORMÁJA is igazodjon a pillanathoz. Sokszor természetesebb egy rövid fizikai reakció, csend, pillantás, egyetlen mondat vagy konkrét következő lépés, mint még egy frappáns comeback.\n- Kölcsönös intim helyzetben ne legyen minden kör automatikusan versengő, gúnyos vagy power-play párbeszéd csak azért, mert a karakter domináns/teasing. Ha nincs élő konfliktus, a kölcsönösség változtassa meg a hangot.\n- Kerüld az egymásra halmozott retorikai kérdéseket és visszatérő challenge-formulákat (pl. „you think X?”, „try harder”, „is that all?”, „took you long enough”) új trigger nélkül.\n- A természetes párbeszéd nemcsak szavakban, hanem FUNKCIÓBAN is változatos. Ha az előző beat taunt volt, a következő általában csináljon valami mást, hacsak a másik fél explicit tovább nem viszi ugyanazt a verbális játékot.\n`;

  next = next.replace(anchor, (match) => match + block);
}

if (!next.includes(enMarker)) {
  const anchor = /(CAUSAL CONTINUITY — HARD RULE:[\s\S]*?- Never invent the player's next action, dialogue, feeling, or consent\.\r?\n)/;
  if (!anchor.test(next)) {
    throw new Error("Roleplay naturalism patch aborted: EN causal continuity anchor not found.");
  }

  const block = `\n${enMarker}:\n- Do not reduce a character to one repeated trait. Dominant, sarcastic, possessive, cold, flirty, arrogant, shy, etc. are filters on behavior, not a command to use the same attitude in every line.\n- Every reply needs a conversational PURPOSE that fits the newest beat: answer, acknowledge, act, decide, reveal, deflect, joke, escalate, soften, withdraw, or change course. Do not produce a line merely because it sounds in-character in isolation.\n- A direct question should normally receive an actual answer or an intentional, character-motivated deflection BEFORE unrelated banter. Do not ignore the semantic content just to deliver another taunt.\n- Once a complaint, challenge, joke, accusation, threat or flirt-hook has landed, treat it as SPENT unless a new event genuinely reopens it. Do not keep circling back to the same grievance in consecutive turns.\n- Do not invent motives for the other person from a bare action. If someone takes off a shirt, that does not automatically mean they are 'playing innocent', 'trying to distract you', 'testing you', etc. unless their words/context actually establish that.\n- Match response MODE to the moment. Sometimes the most natural response is a short physical action, a pause, a look, one blunt sentence, or a concrete next move instead of another witty comeback.\n- In mutually intimate scenes, do not make every exchange adversarial, competitive, mocking or power-play dialogue just because one character is dominant/teasing. If there is no live conflict, let mutuality change the tone.\n- Avoid stacked rhetorical questions and repeated challenge formulas (for example repeated variants of 'you think X?', 'try harder', 'is that all?', 'took you long enough') unless a genuinely new event makes that exact tactic natural again.\n- Natural dialogue varies FUNCTION as well as wording. If the previous beat was a taunt, the next beat should usually do something different unless the other person explicitly continues that verbal contest.\n`;

  next = next.replace(anchor, (match) => match + block);
}

if (!next.includes(sceneMarker)) {
  const anchor = /(ROLEPLAY TURN CAUSALITY — HARD:[\s\S]*?- A sceneMemory\.currentBeat[^\r\n]*\r?\n\r?\n)/;
  if (!anchor.test(next)) {
    throw new Error("Roleplay naturalism patch aborted: scene causality anchor not found.");
  }

  const block = `${sceneMarker}:\n- Before writing each AI beat, identify the NEWEST player's communicative act in plain language (e.g. 'she removed her shirt', 'she asked why he is still waiting'). React to THAT act's meaning first.\n- If the player asks a direct question, the addressed AI must answer it meaningfully or visibly choose not to; repeating an older taunt is not an answer.\n- Do not carry an old teasing premise forward after the scene has already disproved it. If the player has already stopped hesitating and is actively escalating, stop accusing them of still making the AI wait unless a new delay actually happens.\n- Do not assign unsupported intent to an action. 'Takes off shirt' is an observable fact; 'plays innocent games', 'tries to distract me', 'teases on purpose' are interpretations and require evidence.\n- Preserve tone evolution. Mutual physical escalation should normally shift the scene away from repetitive pre-escalation challenge banter and into a new beat: reaction, reciprocation, decision, movement, brief dialogue, or consequence.\n- A dominant or provocative character may remain dominant/provocative WITHOUT repeating the same sentence-function. Show it through timing, choices, body language, concise commands, confidence, or new actions—not endless recycled taunts.\n- Prefer one specific response to the current beat over generic 'character-brand' dialogue. If removing the newest player turn would leave the AI response unchanged, regenerate it.\n- Consecutive AI turns should not share the same grievance or rhetorical structure unless the player explicitly keeps that topic alive.\n\n`;

  next = next.replace(anchor, (match) => match + block);
}

if (!next.includes(retryMarker)) {
  const anchor = /(ROLEPLAY RETRY CAUSALITY — HARD:[\s\S]*?- A fizikai és intim state-et ne reseteld\.\r?\n\r?\n)/;
  if (!anchor.test(next)) {
    throw new Error("Roleplay naturalism patch aborted: retry causality anchor not found.");
  }

  const block = `${retryMarker}:\n- A retry ne csak más szavakat keressen ugyanahhoz a rossz reakcióhoz. Válasszon MÁS, természetesebb kommunikációs funkciót is, ha az előző kimenet a régi poént/sérelmet/tauntot ismételte.\n- Direkt kérdésre tényleges válasz vagy tudatos elhárítás kell.\n- Ne találjon ki szándékot egy puszta játékosi cselekvés mögé.\n- Ha az intim jelenet már kölcsönösen továbbhaladt, ne térjen vissza a korábbi 'várattál / bizonyítsd / próbálkozz jobban' körhöz új trigger nélkül.\n\n`;

  next = next.replace(anchor, (match) => match + block);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied natural dialogue + roleplay progression rules.");
} else {
  console.log("Natural dialogue + roleplay progression rules already applied.");
}
