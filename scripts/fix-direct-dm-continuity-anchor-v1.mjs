import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-direct-dm-continuity-v1.mjs");
let text = fs.readFileSync(target, "utf8");

const oldBlock = /  replaceInBlock\(\n    "const send = async \(override\) => \{",\n    "function Groups\(",[\s\S]*?    "normal player-to-bot DM"\n  \);/;

if (oldBlock.test(text)) {
  text = text.replace(
    oldBlock,
    `  const sendStart = next.indexOf("const send = async (override) => {");
  if (sendStart < 0) {
    throw new Error("Direct DM continuity patch aborted: Chat.send anchor not found.");
  }

  const directCallNeedle = "const out = await askWorldJSONInteractive(";
  const directCallAt = next.indexOf(directCallNeedle, sendStart);
  if (directCallAt < 0) {
    throw new Error("Direct DM continuity patch aborted: direct DM AI call not found after Chat.send.");
  }

  next =
    next.slice(0, directCallAt) +
    next.slice(directCallAt).replace(
      directCallNeedle,
      "const out = await askDirectDmJSONInteractive("
    );

  const optionsNeedle = "{ maxTries: 1, maxTokens: 650, timeoutMs: 28000 }";
  const optionsAt = next.indexOf(optionsNeedle, directCallAt);
  if (optionsAt < 0) {
    throw new Error("Direct DM continuity patch aborted: direct DM request options not found.");
  }
  next =
    next.slice(0, optionsAt) +
    next.slice(optionsAt).replace(
      optionsNeedle,
      "{ maxTries: 1, maxTokens: 650, timeoutMs: 28000, dmCharId: c.id, dmChatKey: ck, dmLatestText: t }"
    );`
  );
  fs.writeFileSync(target, text, "utf8");
  console.log("Fixed direct-DM continuity build anchor without changing requested runtime behavior.");
} else {
  console.log("Direct-DM continuity anchor fix already applied.");
}
