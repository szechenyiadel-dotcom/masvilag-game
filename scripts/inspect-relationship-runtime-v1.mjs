import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");

const needles = [
  "/ai/reading-cache/get",
  "/ai/reading-cache/put",
  "reading-cache",
  "inferCanonicalRelationshipBaseline",
  "relationshipReading",
  "relationship_reading",
  "newRestartCopyHu",
  "A karakterek, a saját profilod",
  "Characters, your profile",
  "function World(",
  "function LegacyGroundedWorld(",
  "simEnqueue(",
  "function simEnqueue",
  "const simEnqueue",
];

for (const needle of needles) {
  let at = 0;
  let count = 0;
  while ((at = app.indexOf(needle, at)) >= 0 && count < 8) {
    const before = Math.max(0, at - 2200);
    const after = Math.min(app.length, at + 5000);
    console.log("\n[REL-SOURCE-INSPECT] needle=" + needle + " at=" + at + "\n" + app.slice(before, after));
    at += needle.length;
    count += 1;
  }
}
