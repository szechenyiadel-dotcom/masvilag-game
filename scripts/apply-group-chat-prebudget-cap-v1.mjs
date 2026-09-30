import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const marker = "MÁSVILÁG GROUP CHAT PRE-BUDGET CAP v1";
const original = fs.readFileSync(appPath, "utf8");

if (original.includes(marker)) {
  console.log("Group chat pre-budget cap v1 already applied.");
  process.exit(0);
}

const anchor = /(^[ \t]*)const budgeted\s*=\s*budgetAiRequest\(system,\s*prompt\);/m;
const matches = [...original.matchAll(new RegExp(anchor.source, "gm"))];
if (matches.length !== 1) {
  throw new Error(`Group chat pre-budget cap v1 aborted: expected 1 budget anchor, found ${matches.length}.`);
}

const next = original.replace(anchor, (_match, indent) => {
  const generated = [
    `${indent}/* ${marker} */`,
    `${indent}const preBudgetSource = typeof inferAiRequestSource === "function"`,
    `${indent}  ? inferAiRequestSource(system, prompt, requestMeta)`,
    `${indent}  : "";`,
    `${indent}if (preBudgetSource === "group-chat" && prompt.length > 28000) {`,
    `${indent}  const beforeGroupPromptChars = prompt.length;`,
    `${indent}  prompt = preserveEdges(prompt, 28000, "group-chat prompt");`,
    `${indent}  console.info("[ai-context-client] group-chat", "promptChars=" + beforeGroupPromptChars + "->" + prompt.length, "stage=pre-budget");`,
    `${indent}}`,
    `${indent}const budgeted = budgetAiRequest(system, prompt);`,
  ];
  return generated.join("\n");
});

fs.writeFileSync(appPath, next, "utf8");
console.log("Applied group-chat-only pre-budget prompt cap; no queue/gate/provider/social behavior changed.");
