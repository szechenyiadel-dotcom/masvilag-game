import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG EVENT-DRIVEN WORLD TIMER GUARD v2";
const oldBlock = `if (!isEventFeedRefresh && action.type === "world-full") {
    return null;
  }`;
const newBlock = `/* ${MARKER} */
  if (
    !isEventFeedRefresh &&
    (action.type === "world-full" || action.type === "world")
  ) {
    console.info(
      "[feed-refresh] skipped",
      "trigger=background-timer",
      "action=" + String(action.type || "")
    );
    return null;
  }`;

if (!next.includes(MARKER)) {
  const matches = next.split(oldBlock).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Event-driven world timer guard aborted: expected 1 world/world-full guard anchor, found ${matches}.`
    );
  }
  next = next.replace(oldBlock, newBlock);
}

if (!next.includes(MARKER)) {
  throw new Error("Event-driven world timer guard aborted: marker was not installed.");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied strict event-driven feed timer guard: background world + world-full calls cannot generate feed posts.");
} else {
  console.log("Strict event-driven feed timer guard v2 already applied.");
}
