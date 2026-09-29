import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "/* MÁSVILÁG FEED RECOVERY RETRY BACKOFF v1 */";

if (!next.includes(marker)) {
  const gapAnchor = /const\s+LIVE_WORLD_MIN_ACTION_GAP_MS\s*=\s*9000\s*;/;
  if (!gapAnchor.test(next)) {
    throw new Error("Feed recovery backoff patch aborted: action-gap anchor not found.");
  }

  next = next.replace(
    gapAnchor,
    (match) => `${match}\nconst FEED_RECOVERY_RETRY_BACKOFF_MS = 2 * 60 * 1000; ${marker}`
  );

  const feedFnAnchor = /function\s+feedNeedsFreshPost\s*\(w\)\s*\{/;
  if (!feedFnAnchor.test(next)) {
    throw new Error("Feed recovery backoff patch aborted: feedNeedsFreshPost anchor not found.");
  }

  next = next.replace(
    feedFnAnchor,
    (match) => `${match}\n  const lastFeedAttemptAt = Number(w && w.sim && w.sim.feedAttemptAt) || 0;\n  if (lastFeedAttemptAt && now() - lastFeedAttemptAt < FEED_RECOVERY_RETRY_BACKOFF_MS) return false;`
  );

  const runningAnchor = /simMarkRunning\s*\(\s*n\s*,\s*action\s*\)\s*;/;
  if (!runningAnchor.test(next)) {
    throw new Error("Feed recovery backoff patch aborted: simMarkRunning anchor not found.");
  }

  next = next.replace(
    runningAnchor,
    (match) => `${match}\n        if (action && action.type === "world") {\n          ensureSimState(n).feedAttemptAt = now();\n        }`
  );

  const successAnchor = /sim\.lastSuccessAt\s*=\s*now\(\)\s*;\s*sim\.lastError\s*=\s*""\s*;/;
  if (!successAnchor.test(next)) {
    throw new Error("Feed recovery backoff patch aborted: success anchor not found.");
  }

  next = next.replace(
    successAnchor,
    (match) => `${match}\n          if (action && action.type === "world") {\n            sim.feedAttemptAt = 0;\n          }`
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied feed recovery retry backoff.");
} else {
  console.log("Feed recovery retry backoff already applied.");
}
