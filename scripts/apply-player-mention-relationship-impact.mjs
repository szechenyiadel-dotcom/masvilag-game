import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "MÁSVILÁG PLAYER PUBLIC MENTION RELATIONSHIP IMPACT v1";

if (!next.includes(marker)) {
  const anchor = /function\s+recordSocialEvent\s*\(\s*w\s*,\s*event\s*=\s*\{\}\s*\)\s*\{/m;
  if (!anchor.test(next)) {
    throw new Error("Player mention relationship patch aborted: recordSocialEvent anchor not found.");
  }

  const helper = `/* ${marker} */
function playerPublicMentionToneDelta(text) {
  const raw = String(text || "").trim();
  if (!raw) return 0;
  const low = raw.toLowerCase();

  const positiveStrong = [
    /(?:i\\s+love|love\\s+you|adore|imádom|szeretem|szeretlek|büszke\\s+vagyok|proud\\s+of)/i,
    /(?:amazing|incredible|gorgeous|beautiful|handsome|brilliant|iconic|csodálatos|gyönyörű|zseniális|lenyűgöző)/i,
  ];
  const positiveSoft = [
    /(?:cute|hot|pretty|sweet|lovely|favorite|favourite|queen|king|cuki|dögös|szép|kedvenc|királynő|király)/i,
    /(?:❤️|❤|🥰|😍|💖|💕|🔥)/u,
  ];
  const negativeStrong = [
    /(?:i\\s+hate|hate\\s+you|can't\\s+stand|cannot\\s+stand|utálom|utállak|gyűlölöm|gyűlöllek)/i,
    /(?:disgusting|pathetic|worthless|repulsive|undorító|szánalmas|értéktelen)/i,
  ];
  const negativeSoft = [
    /(?:liar|coward|loser|moron|hazug|képmutató|gyáva|vesztes|idióta)/i,
    /(?:🤮|🖕)/u,
  ];

  let score = 0;
  positiveStrong.forEach((rx) => { if (rx.test(low)) score += 2; });
  positiveSoft.forEach((rx) => { if (rx.test(low)) score += 1; });
  negativeStrong.forEach((rx) => { if (rx.test(low)) score -= 2; });
  negativeSoft.forEach((rx) => { if (rx.test(low)) score -= 1; });

  if (score >= 2) return 2;
  if (score === 1) return 1;
  if (score <= -2) return -2;
  if (score === -1) return -1;
  return 0;
}

function applyPlayerPublicMentionRelationshipImpact(w, event) {
  if (!w || !event || typeof event !== "object") return;
  if (!w.meId || String(event.actorId || "") !== String(w.meId)) return;

  const type = String(event.type || "").toLowerCase();
  if (!(type === "post" || type === "comment" || type === "reply")) return;

  const text = String(event.text || "").trim();
  if (!text) return;

  const targetIds = explicitNamedCharacterIdsInText(w, text, w.meId)
    .filter((id) => id && id !== w.meId && !isHuman(w, id));
  if (!targetIds.length) return;

  if (!w.sim || typeof w.sim !== "object" || Array.isArray(w.sim)) w.sim = {};
  if (!w.sim.playerMentionRelationshipImpactSeen || typeof w.sim.playerMentionRelationshipImpactSeen !== "object" || Array.isArray(w.sim.playerMentionRelationshipImpactSeen)) {
    w.sim.playerMentionRelationshipImpactSeen = {};
  }

  const ref = String(event.refId || event.id || "").trim();
  const eventKey = ref
    ? type + ":" + ref
    : type + ":" + String(Number(event.ts) || 0) + ":" + text.slice(0, 120);
  if (w.sim.playerMentionRelationshipImpactSeen[eventKey]) return;
  w.sim.playerMentionRelationshipImpactSeen[eventKey] = now();

  const seenEntries = Object.entries(w.sim.playerMentionRelationshipImpactSeen)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  if (seenEntries.length > 220) {
    w.sim.playerMentionRelationshipImpactSeen = Object.fromEntries(seenEntries.slice(0, 180));
  }

  const delta = playerPublicMentionToneDelta(text);

  [...new Set(targetIds)].slice(0, 6).forEach((targetId) => {
    const target = charById(w, targetId);
    if (!target) return;

    const playerName = w.player && w.player.name ? w.player.name : "";
    const surfaceHu = type === "post" ? "posztban" : "kommentben";
    const surfaceEn = type === "post" ? "post" : "comment";

    rememberAboutTarget(w, targetId, w.meId, {
      kind: "event",
      source: "public_social",
      confidence: 1,
      text: sysLangText(
        w,
        targetId,
        (playerName || "A játékos") + " nyilvánosan megemlített engem egy " + surfaceHu + ": " + cut(text, 180),
        (playerName || "The player") + " publicly mentioned me in a " + surfaceEn + ": " + cut(text, 180)
      ),
    });

    if (!delta) return;

    const current = getRel(w, targetId, w.meId);
    const oldScore = Number(current && current.score) || 0;
    const nextScore = Math.max(-100, Math.min(100, oldScore + delta));
    if (nextScore === oldScore) return;

    setRel(w, targetId, w.meId, { score: nextScore });
  });
}

`;

  next = next.replace(anchor, (match) => helper + match + "\n  applyPlayerPublicMentionRelationshipImpact(w, event);");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded player public-mention relationship impact.");
} else {
  console.log("Player public-mention relationship impact already applied.");
}
