import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "server", "proxy.js");
const marker = "MÁSVILÁG AI 429 SERVER GATE v3";

const original = fs.readFileSync(serverPath, "utf8");
if (!original.includes(marker)) {
  throw new Error("AI gate syntax repair aborted: v3 marker not found.");
}

let next = original;
const replacements = [
  [
    `.filter(Boolean)\n    .join("\n");`,
    `.filter(Boolean)\n    .join("\\n");`,
    "aiRequestText join",
  ],
  [
    `const text = (String(body.system || "") + "\n" + aiRequestText(body)).toLowerCase();`,
    `const text = (String(body.system || "") + "\\n" + aiRequestText(body)).toLowerCase();`,
    "source inference separator",
  ],
  [
    `return value.slice(0, head) + "\n...[context compacted by AI gate]...\n" + value.slice(-tail);`,
    `return value.slice(0, head) + "\\n...[context compacted by AI gate]...\\n" + value.slice(-tail);`,
    "prompt compaction marker",
  ],
  [
    `.update(source + "\n" + String(body.system || "") + "\n" + aiRequestText(body))`,
    `.update(source + "\\n" + String(body.system || "") + "\\n" + aiRequestText(body))`,
    "dedupe hash separators",
  ],
];

for (const [needle, replacement, label] of replacements) {
  if (next.includes(replacement)) continue;
  const first = next.indexOf(needle);
  if (first < 0 || next.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`AI gate syntax repair aborted: ${label} source missing or ambiguous.`);
  }
  next = next.slice(0, first) + replacement + next.slice(first + needle.length);
}

if (next !== original) {
  fs.writeFileSync(serverPath, next, "utf8");
  console.log("Repaired escaped newlines in generated AI gate.");
}

const check = spawnSync(process.execPath, ["--check", serverPath], {
  encoding: "utf8",
});
if (check.status !== 0) {
  const detail = String(check.stderr || check.stdout || "Node syntax check failed.").trim();
  throw new Error(`AI gate syntax validation failed:\n${detail}`);
}

console.log("AI gate server syntax validated with node --check.");
