import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-event-driven-ai-optimization-v1.mjs");
let text = fs.readFileSync(target, "utf8");

if (text.includes('replaceOne(\n    /\\s*if \\(p\\)')) {
  console.log("Event-driven popup batching anchor fix already applied.");
  process.exit(0);
}

const pattern = /  replaceInBlock\(\n    "const enactPopupChoice = useCallback\(",\n    "const requestWorldStep = useCallback",[\s\S]*?    "popup choice comment batching"\n  \);/;

if (!pattern.test(text)) {
  throw new Error("Event-driven popup batching anchor fix aborted: old block not found.");
}

text = text.replace(
  pattern,
  `  replaceOne(
    /\\s*if \\(p\\) \\{\\s*try \\{\\s*simEnqueue\\([\\s\\S]*?Popup comment queue failed:[\\s\\S]*?\\}\\s*\\}\\s*/m,
    "\\n            /* event-driven feed batch attaches the comments to this fresh popup post */\\n",
    "popup choice comment batching"
  );`
);

fs.writeFileSync(target, text, "utf8");
console.log("Fixed event-driven popup batching anchor without changing runtime behavior.");
