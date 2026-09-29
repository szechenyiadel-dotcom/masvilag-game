import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");

const oldBlock = `    if (addressTargetId) {
      body = sanitizeGeneratedDirectAddress(n, who, addressTargetId, body);
    }`;

const newBlock = `    if (addressTargetId) {
      body = sanitizeGeneratedDirectAddress(n, who, addressTargetId, body);

      /* Reply @mention must use the actual target profile username, never an internal ID. */
      const replyTarget = charById(n, addressTargetId);
      const replyUsername = String((replyTarget && replyTarget.username) || "").replace(/^@/, "").trim();
      if (replyUsername) {
        body = body.replace(/^@[A-Za-z0-9._-]+\\b\\s*/i, \`@\${replyUsername} \`);
      } else {
        body = body.replace(/^@[A-Za-z0-9._-]+\\b\\s*/i, "");
      }
    }`;

let next = original;
if (next.includes(oldBlock)) {
  next = next.replace(oldBlock, newBlock);
} else if (!next.includes(newBlock)) {
  throw new Error("Reply mention patch aborted: reply target block changed; refusing broad replacement.");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied reply mention username validation.");
} else {
  console.log("Reply mention username validation already applied.");
}
