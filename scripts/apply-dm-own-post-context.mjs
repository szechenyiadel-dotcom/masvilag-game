import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

/*
 * Patch ONLY genDM(). App.jsx has existed in both compact one-line and expanded
 * multiline forms, so matching exact whitespace is intentionally avoided.
 */
const genDmStart = next.indexOf("async function genDM(");
const genDmEnd = genDmStart >= 0 ? next.indexOf("async function genNote(", genDmStart + 1) : -1;

if (genDmStart < 0 || genDmEnd < 0 || genDmEnd <= genDmStart) {
  throw new Error("DM own-post patch aborted: genDM function boundary not found.");
}

let genDm = next.slice(genDmStart, genDmEnd);

/* Keep autonomous-DM post context limited to the player's own posts. */
const ownedPostFilter = "po.authorId === w.meId";
if (!genDm.includes(ownedPostFilter)) {
  const recentPostsAnchor = /(\bconst\s+recent\s*=\s*\(\s*w\.posts\s*\|\|\s*\[\]\s*\)\s*)\.slice\(\s*0\s*,\s*4\s*\)/;

  if (!recentPostsAnchor.test(genDm)) {
    throw new Error("DM own-post patch aborted: genDM recent-post anchor not found.");
  }

  genDm = genDm.replace(
    recentPostsAnchor,
    "$1.filter((po) => po && po.authorId === w.meId).slice(0, 4)"
  );
}

/*
 * The filtered context is also stated explicitly to the model. This is an
 * idempotent semantic marker instead of a fragile replacement of whole prompt
 * sentences, which have changed between App.jsx versions.
 */
const promptMarker = "DM OWN-POST ATTRIBUTION — HARD RULE:";
if (!genDm.includes(promptMarker)) {
  const recentPromptAnchor = /\$\{recent\s*\|\|\s*["']még nincs poszt["']\}/;

  if (!recentPromptAnchor.test(genDm)) {
    throw new Error("DM own-post patch aborted: genDM recent-post prompt anchor not found.");
  }

  const guard = [
    promptMarker,
    "- A fenti posztlista kizárólag ${w.player.name} saját posztjait tartalmazza.",
    "- Más karakter posztját, kommentjét vagy tettét SOHA ne kezeld úgy, mintha ${w.player.name} írta vagy csinálta volna.",
    "- Never attribute another character's post, comment, or action to ${w.player.name}."
  ].join("\n");

  genDm = genDm.replace(
    recentPromptAnchor,
    (match) => match + "\n" + guard
  );
}

next = next.slice(0, genDmStart) + genDm + next.slice(genDmEnd);

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied autonomous DM own-post attribution guard.");
} else {
  console.log("Autonomous DM own-post attribution guard already applied.");
}
