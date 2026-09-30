import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-player-post-comment-guarantee-v2.mjs");
let text = fs.readFileSync(target, "utf8");

const old = `  {\n    const needle = 'String(action.payload && action.payload.postId || "")';\n    const count = next.split(needle).length - 1;\n    if (count !== 2) {\n      throw new Error(\`Player-post comment guarantee v2 aborted: event-feed post-id anchors expected 2, found \${count}.\`);\n    }\n    next = next.split(needle).join('String(eventFeedTrigger === "player-post" ? "" : (action.payload && action.payload.postId || ""))');\n  }`;

if (text.includes(old)) {
  const replacement = `  {\n    const needle = 'String(action.payload && action.payload.postId || "")';\n    const legacyAt = next.indexOf("async function legacyPlayerPostRunSimulationAction");\n    if (legacyAt < 0) throw new Error("Player-post comment guarantee v2 aborted: legacy action runner not found.");\n    const head = next.slice(0, legacyAt);\n    let tail = next.slice(legacyAt);\n    const count = tail.split(needle).length - 1;\n    if (count !== 2) {\n      throw new Error(\`Player-post comment guarantee v2 aborted: legacy event-feed post-id anchors expected 2, found \${count}.\`);\n    }\n    tail = tail.split(needle).join('String(eventFeedTrigger === "player-post" ? "" : (action.payload && action.payload.postId || ""))');\n    next = head + tail;\n  }`;
  text = text.replace(old, replacement);
  fs.writeFileSync(target, text, "utf8");
  console.log("Fixed player-post guarantee v2 to patch only legacy event-feed post-id anchors.");
} else {
  console.log("Player-post guarantee v2 legacy event-feed anchor fix already applied.");
}
