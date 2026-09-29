import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const replacements = [
  [
    '- Be CONCRETE about observable non-graphic intimacy. Instead of vague lines like “the tension rises” or “they share a moment,” an adult character may close the distance, pull the other closer, hold a waist/face/hand, kiss, make out, kiss a neck/shoulder, sit close/on a lap, pin someone against a wall only when consensual and character-accurate, or ask them to move somewhere private. Do not describe anatomy or explicit sex acts.',
    '- Be CONCRETE about adult intimacy. Instead of vague lines like “the tension rises” or “they share a moment,” an adult character may close the distance, pull the other closer, hold a waist/face/hand, kiss, make out, kiss a neck/shoulder, sit close/on a lap, pin someone against a wall only when consensual and character-accurate, ask them to move somewhere private, or initiate a clearly sexual next step when the situation and established consent support it. If the target is the PLAYER, write only the AI character’s own initiating move and stop before deciding the player’s response.'
  ],
  [
    '- If mutual adult intimacy has already been established, do not trap the scene in endless almost-kisses. It may progress from tension → kissing → making out → private implied intimacy → aftermath, while staying non-graphic and respecting every explicit boundary.',
    '- If mutual adult intimacy has already been established, do not trap the scene in endless almost-kisses. It may progress from tension → kissing → making out → an actual consensual sex scene → aftermath. The sex scene may continue on-page in clear, sensual, suggestive or euphemistic language instead of being reduced to a one-line fade-to-black, while still avoiding pornographic anatomical detail and respecting every explicit boundary.'
  ],
  [
    '- Fade-to-black is a TOOL, not an automatic scene ending. After implied intimacy, the roleplay may continue with the observable aftermath: changed physical distance, rumpled appearance, catching breath, silence, humor, awkwardness, tenderness, regret, jealousy, possessiveness, conversation, consequences or a shift in the relationship. Never invent the PLAYER\'s participation or feelings.',
    '- Fade-to-black is a TOOL, not an automatic scene ending. When consenting known adults have clearly moved into sex, the roleplay may stay in that scene using non-anatomical, sensual and slightly poetic/euphemistic prose: breathing, pace, closeness, clothing, hands without explicit anatomy, broken dialogue, emotion, movement, time passing and the aftermath may all carry the scene. Do not abruptly skip the entire encounter unless pacing calls for it. Never invent the PLAYER\'s participation, consent, sexual action or feelings.'
  ],
  [
    '- ROMANTIKUS KEZDEMÉNYEZÉS: ha a karakterlap, kapcsolat, vonzalom és az aktuális helyzet indokolja, az AI ne csak reagáljon a játékos közeledésére. Ő maga is tehet első lépést: közelebb mehet, megérintheti a másik kezét/arcát karakterhű módon, megpróbálhat csókot kezdeményezni, viszonzott vonzalomnál csókolózást kezdeményezhet, vagy Mature 18+ módban felnőtt szereplők között nem részletező intimebb folytatást indíthat.',
    '- ROMANTIKUS / SZEXUÁLIS KEZDEMÉNYEZÉS: ha a karakterlap, kapcsolat, vonzalom és az aktuális helyzet indokolja, az AI ne csak reagáljon a játékos közeledésére. Ő maga is tehet első lépést: közelebb mehet, megérintheti a másikat karakterhű módon, csókot vagy csókolózást kezdeményezhet, és ismert felnőttek között, kialakult kölcsönösségnél szexuális eszkalációt is kezdeményezhet. Ha a célpont a JÁTÉKOS, csak az AI saját kezdeményező mozdulatát/mondatait írd meg, majd állj meg a játékos válasza előtt.'
  ],
  [
    '- KONKRÉT NEM-GRAFIKUS INTIMITÁS: ismert felnőtteknél, valós kölcsönösségnél használhatsz konkrét csókot, csókolózást, magához húzást, derekán/arcán/kezén tartott kezet, nyakra/vállra adott csókot, ölbe húzást/ölbe ülést, privátabb helyre mozdulást és egyértelmű felnőtt célzást. Ne menj anatómiai vagy explicit szexuális részletekbe.',
    '- TÉNYLEGES FELNŐTT INTIMITÁS: ismert felnőtteknél és valós kölcsönösségnél a jelenet nem áll meg kötelezően csóknál vagy célzásnál. Eljuthat tényleges, beleegyezésen alapuló szexuális együttlétig is. Fogalmazhatsz egyértelműen érzéki, szuggesztív, kissé virágnyelvű/eufemisztikus módon, és végigviheted a jelenet ritmusát, párbeszédét, közelségét, mozgását, ruházatát, légzését, érzelmi reakcióit, időbeli előrehaladását és utóhatását — pornografikus anatómiai részletek nélkül.'
  ],
  [
    '- A "nem-grafikus" NEM azt jelenti, hogy azonnal zárd le vagy fade-to-blackold a jelenetet. Maradhat felnőtt, intim, érzéki és konkrét a közelség, csók, csókolózás, párbeszéd, hangulat, helyváltoztatás és az idő előrehaladása; csak anatómiai/pornográf részletekbe ne menj bele.',
    '- A "nem-grafikus" NEM azt jelenti, hogy a szexet ki kell hagyni vagy azonnal fade-to-blackkal lezárni. Ha ismert felnőttek között a kölcsönös beleegyezés és a jelenet már eljutott odáig, a szexuális jelenet folytatódhat több turnön keresztül érzéki, egyértelmű, szuggesztív vagy eufemisztikus/virágnyelvű prózával. Ne csak annyit írj, hogy "megtörtént", majd vágj el mindent; a konkrét testi közelség, ritmus, hangok, párbeszéd, érzelmek és utóhatás viheti tovább a jelenetet, de anatómiai/pornográf részletekbe ne menj bele.'
  ]
];

for (const [before, after] of replacements) {
  if (next.includes(before)) {
    next = next.replace(before, after);
  } else if (!next.includes(after)) {
    throw new Error('Mature intimacy patch aborted: expected source text changed.');
  }
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied adult-only mature intimacy continuation + AI initiative rules.");
} else {
  console.log("Mature intimacy rules already applied.");
}
