import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
const needles = [
  "function structuralRelationshipHash",
  "function structuralRelationship",
  "structuralRelationshipHash(",
  "STRUCTURAL_READING_BATCH",
  "function identityCanon",
  "async function genIdentity",
  "function applyIdentity",
  "sensei",
  "dojo"
];
for (const needle of needles) {
  let at = app.indexOf(needle);
  let count = 0;
  while (at >= 0 && count < 6) {
    console.log("\n[REL-SOURCE-INSPECT] needle=" + needle + " at=" + at + "\n" +
      app.slice(Math.max(0, at - 3000), Math.min(app.length, at + 14000)));
    at = app.indexOf(needle, at + needle.length);
    count += 1;
  }
}
