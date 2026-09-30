import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-event-driven-ai-optimization-v1.mjs");
let text = fs.readFileSync(target, "utf8");
let changed = false;

const popupPattern = /  replaceInBlock\(\n    "const enactPopupChoice = useCallback\(",\n    "const requestWorldStep = useCallback",[\s\S]*?    "popup choice comment batching"\n  \);/;

if (popupPattern.test(text)) {
  text = text.replace(
    popupPattern,
    `  replaceOne(
    /\\s*if \\(p\\) \\{\\s*try \\{\\s*simEnqueue\\([\\s\\S]*?Popup comment queue failed:[\\s\\S]*?\\}\\s*\\}\\s*/m,
    "\\n            /* event-driven feed batch attaches the comments to this fresh popup post */\\n",
    "popup choice comment batching"
  );`
  );
  changed = true;
}

const dmPattern = /  replaceInBlock\(\n    'if \(action\.type === "dm"\) \{',\n    'const out =',[\s\S]*?    "autonomous DM pre-generation guard"\n  \);/;

if (dmPattern.test(text)) {
  text = text.replace(
    dmPattern,
    `  replaceOne(
    /\\n\\s*const out =\\s*\\n\\s*await genDM\\(view, bot\\);/m,
    \`\n\n    const dmPauseReason = eventDrivenAutonomousDmPauseReason(view);\n    if (dmPauseReason) {\n      update((n) => eventDrivenRememberDeferredDm(n, action, dmPauseReason));\n      return "dm-deferred";\n    }\n\n    const out =\n      await genDM(view, bot);\`,
    "autonomous DM pre-generation guard"
  );`
  );
  changed = true;
}

if (!text.includes('"popup choice comment batching"')) {
  throw new Error("Event-driven anchor fixer: popup batching patch block missing.");
}
if (!text.includes('"autonomous DM pre-generation guard"')) {
  throw new Error("Event-driven anchor fixer: autonomous DM guard patch block missing.");
}

if (changed) {
  fs.writeFileSync(target, text, "utf8");
  console.log("Fixed event-driven popup + autonomous-DM build anchors without changing requested runtime behavior.");
} else {
  console.log("Event-driven popup + autonomous-DM anchor fixes already applied.");
}
