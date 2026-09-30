import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG GROUNDED RUNTIME WIRING v3";

function replaceOne(regex, replacement, label, required = true) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const count = [...next.matchAll(new RegExp(regex.source, flags))].length;
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Grounded runtime wiring v3 aborted: ${label} expected 1 match, found ${count}.`);
}

function replaceInBlock(startNeedle, endNeedle, transform, label) {
  const start = next.indexOf(startNeedle);
  const end = start >= 0 ? next.indexOf(endNeedle, start + startNeedle.length) : -1;
  if (start < 0 || end < 0) throw new Error(`Grounded runtime wiring v3 aborted: ${label} block not found.`);
  const block = next.slice(start, end);
  const changed = transform(block);
  if (changed === block) throw new Error(`Grounded runtime wiring v3 aborted: ${label} did not change.`);
  next = next.slice(0, start) + changed + next.slice(end);
}

if (!next.includes(`/* ${MARKER} */`)) {
  // 1) React #310 safeguard: never introduce a new hook into the late World render path.
  next = next.replace(
    /useEffect\(\(\) => \{\s*update\(\(n\) => \{\s*groundedRepairKnownFalseBrentIncident\(n\);\s*\}\);\s*\}, \[meId\]\);/m,
    "groundedRepairKnownFalseBrentIncident(view);"
  );

  // 2) A follow-not-returned DM is an explicit event consequence, not a generic unsolicited DM.
  // It must still be planned even while normal autonomous-DM throttles are active.
  replaceInBlock(
    "function groundedDueFollowBackAction(w) {",
    "function groundedUnreadDmCount",
    (block) => block.replace(
      /if \(!w \|\| eventDrivenAutonomousDmPauseReason\(w\)\) return null;/,
      "if (!w) return null;"
    ),
    "follow-not-returned planner"
  );

  // Bypass the generic pre-generation pause ONLY for this grounded follow consequence.
  replaceOne(
    /const dmPauseReason = eventDrivenAutonomousDmPauseReason\(view\);/,
    'const dmPauseReason = action && action.payload && action.payload.trigger === "follow-not-returned" ? "" : eventDrivenAutonomousDmPauseReason(view);',
    "follow-not-returned DM generation gate"
  );

  // 3) Event feed batches (especially popup-choice aftermath) used to stop after only two provider attempts.
  // Retry the same atomic batch a few times until the hard 6-post minimum and trigger comments are actually present.
  replaceOne(
    /const selectedAuthors = eventDrivenUsableBatchPosts\(generationView, merged\)\s*\.map\(\(post\) => eventDrivenFeedRawAuthor\(generationView, post\)\)\s*\.filter\(Boolean\);\s*\n\s*const needsSecond =\s*merged\.posts\.length < AI_ACTIVITY_OPTIMIZATION\.FEED_MIN_POSTS \|\|\s*!eventDrivenTriggerCommentsCovered\(merged, eventTriggerPostIds\);\s*\n\s*if \(needsSecond && feedAiCalls < 2\) \{\s*const missing = Math\.max\(\s*1,\s*AI_ACTIVITY_OPTIMIZATION\.FEED_MAX_POSTS - merged\.posts\.length\s*\);\s*const second = await callWorldBatch\(missing, selectedAuthors\);\s*merged = eventDrivenMergeBatchOutputs\(generationView, merged, second\);\s*\}/m,
    `let selectedAuthors = eventDrivenUsableBatchPosts(generationView, merged)
      .map((post) => eventDrivenFeedRawAuthor(generationView, post))
      .filter(Boolean);

    let needsMore =
      merged.posts.length < AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS ||
      !eventDrivenTriggerCommentsCovered(merged, eventTriggerPostIds);

    while (needsMore && feedAiCalls < 4) {
      const missing = Math.max(
        1,
        AI_ACTIVITY_OPTIMIZATION.FEED_MAX_POSTS - merged.posts.length
      );
      const extra = await callWorldBatch(missing, selectedAuthors);
      merged = eventDrivenMergeBatchOutputs(generationView, merged, extra);
      selectedAuthors = eventDrivenUsableBatchPosts(generationView, merged)
        .map((post) => eventDrivenFeedRawAuthor(generationView, post))
        .filter(Boolean);
      needsMore =
        merged.posts.length < AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS ||
        !eventDrivenTriggerCommentsCovered(merged, eventTriggerPostIds);
    }`,
    "event-feed retry loop"
  );

  // Never throw away valid partial feed output after retries. The event log will still mark it partial.
  // This fixes the previous zero-post outcome while preserving already generated posts.
  replaceOne(
    /if \(merged\.posts\.length < AI_ACTIVITY_OPTIMIZATION\.FEED_MIN_POSTS\) \{\s*console\.warn\(\s*"\[feed-refresh\]",\s*"incomplete-batch-aborted",[\s\S]*?\);\s*out = \{ \.\.\.merged, posts: \[\] \};\s*\} else \{\s*out = merged;\s*\}/m,
    `if (merged.posts.length < AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS) {
      console.warn(
        "[feed-refresh]",
        "incomplete-batch-preserved",
        "trigger=" + eventFeedTrigger,
        "posts=" + String(merged.posts.length),
        "required=" + String(AI_ACTIVITY_OPTIMIZATION.FEED_MIN_POSTS),
        "aiCalls=" + String(feedAiCalls)
      );
    }
    out = merged;`,
    "atomic feed partial preservation"
  );

  next += `\n\n/* ${MARKER} */\n`;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded runtime wiring v3: hook-order safeguard, guaranteed follow-back DM path, and resilient popup/event feed retries.");
} else {
  console.log("Grounded runtime wiring v3 already applied.");
}
