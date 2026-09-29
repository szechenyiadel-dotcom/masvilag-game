import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");

const marker = "/* Reply @mention must use the actual target profile username, never an internal ID. */";
const replyTargetAnchor = /(^[ \t]*)if\s*\(\s*addressTargetId\s*\)\s*\{\s*body\s*=\s*sanitizeGeneratedDirectAddress\s*\(\s*n\s*,\s*who\s*,\s*addressTargetId\s*,\s*body\s*\)\s*;/m;

let next = original;

if (!next.includes(marker)) {
  const match = next.match(replyTargetAnchor);

  if (!match) {
    throw new Error("Reply mention patch aborted: reply target anchor not found; refusing broad replacement.");
  }

  const indent = match[1] || "";
  const inner = `${indent}  `;

  const replacement = `${indent}if (addressTargetId) {\n${inner}body = sanitizeGeneratedDirectAddress(n, who, addressTargetId, body);\n\n${inner}${marker}\n${inner}const replyTarget = charById(n, addressTargetId);\n${inner}const replyUsername = String((replyTarget && replyTarget.username) || "").replace(/^@/, "").trim();\n${inner}if (replyUsername) {\n${inner}  body = body.replace(/^@[A-Za-z0-9._-]+\\b\\s*/i, \`@\${replyUsername} \`);\n${inner}} else {\n${inner}  body = body.replace(/^@[A-Za-z0-9._-]+\\b\\s*/i, "");\n${inner}}`;

  next = next.replace(replyTargetAnchor, replacement);
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied reply mention username validation.");
} else {
  console.log("Reply mention username validation already applied.");
}
