import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");

const original = fs.readFileSync(appPath, "utf8");

const oldFreshWindow = 'const LIVE_WORLD_FRESH_COMMENT_WINDOW_MS = Math.max(20 * 60000, Math.min(4 * 3600e3, Number(import.meta.env.VITE_WORLD_FRESH_COMMENT_WINDOW_MS) || 90 * 60000));';
const newFreshWindow = 'const LIVE_WORLD_FRESH_COMMENT_WINDOW_MS = 10 * 60 * 1000; // exact 10-minute live comment window';

let next = original;

if (next.includes(oldFreshWindow)) {
  next = next.replace(oldFreshWindow, newFreshWindow);
} else if (!next.includes(newFreshWindow)) {
  throw new Error("Social policy patch aborted: fresh-comment window source changed; refusing an unsafe broad replacement.");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied Másvilág social policy: fresh comments are active for exactly 10 minutes.");
} else {
  console.log("Másvilág social policy already applied.");
}
