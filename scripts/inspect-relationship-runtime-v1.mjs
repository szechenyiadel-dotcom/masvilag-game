import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const needles = [
  "function relationshipReadingHash",
  "function relationshipReadingDueTargets",
  "async function genRelationshipReading",
  "function applyRelationshipReadingRows",
  "function relationshipReadingState",
  "const RELATIONSHIP_READING",
  "function relationshipReadingCacheKey",
  "function connectionCanonSnippetAbout",
  "function allSubjects"
];
for (const needle of needles) {
  let at = app.indexOf(needle);
  if (at < 0) continue;
  console.log("\n[REL-SOURCE-INSPECT] needle=" + needle + " at=" + at + "\n" +
    app.slice(Math.max(0, at - 2600), Math.min(app.length, at + 12000)));
}
