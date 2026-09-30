import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const patchPath = path.join(root, "scripts", "apply-sims-social-intelligence-v1.mjs");
let source = fs.readFileSync(patchPath, "utf8");

const fixed = "  const helper = String.raw`";
const legacy = "  const helper = `";

if (source.includes(fixed)) {
  console.log("Sims social intelligence generator escape mode already fixed.");
} else {
  const first = source.indexOf(legacy);
  if (first < 0 || source.indexOf(legacy, first + legacy.length) >= 0) {
    throw new Error("Sims social intelligence escape repair aborted: helper template anchor missing or ambiguous.");
  }
  source = source.slice(0, first) + fixed + source.slice(first + legacy.length);
  fs.writeFileSync(patchPath, source, "utf8");
  console.log("Fixed Sims social intelligence generator to preserve literal escapes.");
}
