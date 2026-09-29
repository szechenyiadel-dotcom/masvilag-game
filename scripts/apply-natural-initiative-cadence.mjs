import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG NATURAL AUTONOMOUS INITIATIVE CADENCE v1";

function replaceExact(oldText, newText, label) {
  if (next.includes(newText)) return;
  if (!next.includes(oldText)) {
    throw new Error(`Natural initiative cadence patch aborted: ${label} anchor changed.`);
  }
  next = next.replace(oldText, newText);
}

if (!next.includes(MARKER)) {
  replaceExact(
    "const LIVE_WORLD_DM_TARGET_MS = Math.max(8 * 60 * 1000, Math.min(30 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 12 * 60 * 1000));",
    `/* ${MARKER} */\nconst LIVE_WORLD_DM_TARGET_MS = Math.max(7 * 60 * 1000, Math.min(30 * 60 * 1000, Number(import.meta.env.VITE_WORLD_DM_INTERVAL_MS) || 10 * 60 * 1000));`,
    "DM cadence"
  );

  replaceExact(
    "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(12 * 60 * 1000, Math.min(45 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 20 * 60 * 1000));",
    "const LIVE_WORLD_EVENT_TARGET_MS = Math.max(10 * 60 * 1000, Math.min(40 * 60 * 1000, Number(import.meta.env.VITE_WORLD_EVENT_INTERVAL_MS) || 15 * 60 * 1000));",
    "Event cadence"
  );

  if (!next.includes("Math.max(8 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))")) {
    throw new Error("Natural initiative cadence patch aborted: DM watchdog cadence anchor changed.");
  }
  next = next.replaceAll(
    "Math.max(8 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))",
    "Math.max(7 * 60 * 1000, Math.round(LIVE_WORLD_DM_TARGET_MS / dmActivityFactor))"
  );

  if (!next.includes("Math.max(12 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))")) {
    throw new Error("Natural initiative cadence patch aborted: Event watchdog cadence anchor changed.");
  }
  next = next.replaceAll(
    "Math.max(12 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))",
    "Math.max(10 * 60 * 1000, Math.round(LIVE_WORLD_EVENT_TARGET_MS / rpActivityFactor))"
  );

  replaceExact(
    "const groupTarget = Math.max(8 * 60 * 1000, Math.round((12 * 60 * 1000) / groupPeak));",
    "const groupTarget = Math.max(7 * 60 * 1000, Math.round((10 * 60 * 1000) / groupPeak));",
    "group cadence"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied natural autonomous initiative cadence without changing existing social functions.");
} else {
  console.log("Natural autonomous initiative cadence already applied.");
}
