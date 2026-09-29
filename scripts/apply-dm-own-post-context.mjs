import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const oldRecent = /  const recent = \(\r?\n    w\.posts \|\| \[\]\r?\n  \)\r?\n    \.slice\(0, 4\)/;
const newRecent = `  const recent = (\n    w.posts || []\n  )\n    .filter((po) => po && po.authorId === w.meId)\n    .slice(0, 4)`;

const oldRule = `- Az ok kapcsolódhat friss eseményhez, poszthoz, kommenthez, jegyzethez, közös ügyhöz, kapcsolati változáshoz, pletykához, konfliktushoz, tervhez vagy egyszerűen valamihez, amit most akarsz tőle.`;
const newRule = `- Az ok kapcsolódhat friss eseményhez, poszthoz, kommenthez, jegyzethez, közös ügyhöz, kapcsolati változáshoz, pletykához, konfliktushoz, tervhez vagy egyszerűen valamihez, amit most akarsz tőle. Más karakter posztját SOHA ne kezeld úgy, mintha ${'${w.player.name}'} írta vagy csinálta volna.`;

const oldRetry = `Do not invent off-screen facts. Respect relationship=${'${Number(rel.score)||0}'}${'${rel.bond?`, bond=${rel.bond}`:""}'}.`;
const newRetry = `Do not invent off-screen facts. Never address ${'${w.player.name}'} as if another character's post or action belonged to them. Respect relationship=${'${Number(rel.score)||0}'}${'${rel.bond?`, bond=${rel.bond}`:""}'}.`;

if (oldRecent.test(next)) {
  next = next.replace(oldRecent, newRecent);
} else if (!next.includes(newRecent)) {
  throw new Error("DM own-post patch aborted: recent-post source changed.");
}

if (next.includes(oldRule)) {
  next = next.replace(oldRule, newRule);
} else if (!next.includes(newRule)) {
  throw new Error("DM own-post patch aborted: DM rule source changed.");
}

if (next.includes(oldRetry)) {
  next = next.replace(oldRetry, newRetry);
} else if (!next.includes(newRetry)) {
  throw new Error("DM own-post patch aborted: retry rule source changed.");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied autonomous DM own-post attribution guard.");
} else {
  console.log("Autonomous DM own-post attribution guard already applied.");
}
