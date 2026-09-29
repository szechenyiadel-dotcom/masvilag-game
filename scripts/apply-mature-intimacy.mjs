import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

/*
 * Do not replace exact prose sentences: ENGINE/ENGINE_EN wording has changed
 * across App.jsx versions. Insert the mature policy at stable section boundaries
 * instead, and use markers so repeated dev/build runs are idempotent.
 */
const huMarker = "MATURE 18+ — FELNŐTT INTIMITÁS FOLYTATÁSA";
const enMarker = "MATURE 18+ — ADULT INTIMACY CONTINUATION";

const huBlock = `${huMarker}
- Kizárólag ismert felnőtt szereplők között, valós kölcsönös beleegyezés és a karakterek/kapcsolat által indokolt helyzetben alkalmazd.
- Az AI-karakter nem csak reagálhat: karakterhűen kezdeményezhet romantikus vagy szexuális közeledést is. Ha a célpont a JÁTÉKOS, csak az AI saját kezdeményező mozdulatát vagy mondatát írd meg, majd állj meg a játékos válasza előtt; a játékos beleegyezését, tettét vagy érzését soha ne találd ki.
- Kialakult kölcsönös felnőtt intimitásnál a jelenet nem köteles csóknál vagy célzásnál megállni: eljuthat beleegyezésen alapuló szexuális együttlétig is.
- A jelenet maradhat képernyőn érzéki, szuggesztív, eufemisztikus és érzelmileg konkrét módon; a közelség, légzés, ruházat, mozgás, párbeszéd, ritmus, idő múlása és utóhatás viheti tovább. Pornografikus anatómiai részleteket vagy explicit anatómiai aktusleírást ne adj.
- A fade-to-black lehet eszköz, de nem kötelező automatikus lezárás. A jelenet természetes ritmusa és következményei folytatódhatnak.
- Kiskorú vagy bizonytalan életkorú szereplő romantikus/szexuális helyzetbe továbbra sem kerülhet.`;

const enBlock = `${enMarker}
- Apply this only between known adult characters when mutual consent is real and the characters, relationship, and situation support it.
- An AI character may initiate romantic or sexual escalation in character instead of only reacting. If the target is the PLAYER, write only the AI character's own initiating move or line, then stop before deciding the player's response; never invent the player's consent, action, or feelings.
- Once mutual adult intimacy is established, the scene does not have to stop at kissing or implication; it may progress into consensual sex.
- The scene may remain on-page in sensual, suggestive, euphemistic, emotionally concrete language using closeness, breathing, clothing, movement, dialogue, rhythm, time passing, and aftermath. Do not use pornographic anatomical detail or explicit anatomical act descriptions.
- Fade-to-black is available as a pacing tool, not a mandatory automatic ending. The scene and its aftermath may continue naturally.
- Minors or characters of uncertain age remain completely excluded from romantic or sexual situations.`;

function insertBeforeSection(source, anchor, marker, block, label) {
  if (source.includes(marker)) return source;

  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Mature intimacy patch aborted: ${label} section anchor not found.`);
  }

  return source.slice(0, index) + block + "\n" + source.slice(index);
}

next = insertBeforeSection(
  next,
  "NYERSESÉG, AGRESSZIÓ, KÁROMKODÁS",
  huMarker,
  huBlock,
  "Hungarian"
);

next = insertBeforeSection(
  next,
  "RAWNESS, AGGRESSION, PROFANITY",
  enMarker,
  enBlock,
  "English"
);

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied adult-only mature intimacy continuation + AI initiative rules.");
} else {
  console.log("Mature intimacy rules already applied.");
}
