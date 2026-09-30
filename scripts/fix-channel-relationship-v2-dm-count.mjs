import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-channel-relationship-impact-v2.mjs");
let text = fs.readFileSync(target, "utf8");

const old = `  replaceOne(\n    /applyChanges\\(\\s*n,\\s*dmChanges\\s*\\);/,\n    \`applyChannelRelationshipChanges(n, dmChanges, \"dm\", { text: t, reason: \"direct-dm\" });\`,\n    \"direct DM channel weighting\"\n  );`;

if (text.includes(old)) {
  const replacement = `  {\n    const dmRx = /applyChanges\\(\\s*n,\\s*dmChanges\\s*\\);/g;\n    const dmCount = allMatches(dmRx).length;\n    if (dmCount !== 2) {\n      throw new Error(\`Channel relationship v2 aborted: direct DM channel weighting expected 2 matches, found \${dmCount}.\`);\n    }\n    next = next.replace(\n      dmRx,\n      \`applyChannelRelationshipChanges(n, dmChanges, \"dm\", { text: t, reason: \"direct-dm\" });\`\n    );\n  }`;
  text = text.replace(old, replacement);
  fs.writeFileSync(target, text, "utf8");
  console.log("Adjusted channel relationship v2 for both generated direct-DM apply blocks.");
} else {
  console.log("Channel relationship v2 direct-DM count fix already applied.");
}
