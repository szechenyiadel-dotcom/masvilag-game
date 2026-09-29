import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "MÁSVILÁG BACKGROUND BUSY UI SILENCE v1";

if (!next.includes(marker)) {
  const manualBusyUiAnchor = /if\s*\(\s*action\s*&&\s*action\.source\s*===\s*["']manual["']\s*&&\s*alive\s*\)\s*\{/m;
  const matches = next.match(new RegExp(manualBusyUiAnchor.source, "gm")) || [];
  if (matches.length !== 1) {
    throw new Error(`Background busy UI patch aborted: expected 1 manual SIM error anchor, found ${matches.length}.`);
  }

  next = next.replace(
    manualBusyUiAnchor,
    `if (action && action.source === "manual" && alive && !(e && e.busy)) { /* ${marker}: provider cooldown is background pacing, not a user-visible SIM error. */`
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied background provider-busy UI silence.");
} else {
  console.log("Background provider-busy UI silence already applied.");
}
