import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "MÁSVILÁG AI BACKGROUND 429 CIRCUIT BREAKER v2";
const prerequisiteMarker = "MÁSVILÁG AI + PINIMG NETWORK RESILIENCE v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const r = new RegExp(regex.source, flags);
  let count = 0;
  while (r.exec(text)) count += 1;
  return count;
}

if (!next.includes(marker)) {
  if (!next.includes(prerequisiteMarker)) {
    throw new Error("AI 429 circuit-breaker patch aborted: network-resilience v1 must run first.");
  }

  /*
   * Background world actions do not need the full interactive 82k prompt budget.
   * Keeping their prompt smaller lowers tokens-per-minute pressure without touching
   * direct player DM/group/RP requests.
   */
  const budgetAssignmentAnchor = /(^[ \t]*prompt\s*=\s*budgeted\.prompt\s*;\s*\r?\n)/m;
  if (countMatches(next, budgetAssignmentAnchor) !== 1) {
    throw new Error("AI 429 circuit-breaker patch aborted: callClaude prompt-budget anchor changed.");
  }
  next = next.replace(
    budgetAssignmentAnchor,
    (match) =>
      match +
      `  const backgroundPromptCap = Math.min(\n` +
      `    AI_MAX_PROMPT_CHARS,\n` +
      `    Math.max(28000, Number(import.meta.env.VITE_AI_BACKGROUND_MAX_PROMPT_CHARS) || 52000)\n` +
      `  );\n` +
      `  if (!requestMeta.interactive && prompt.length > backgroundPromptCap) {\n` +
      `    prompt = preserveEdges(prompt, backgroundPromptCap, "background prompt");\n` +
      `  }\n` +
      `  /* ${marker}: background requests stay token-bounded before provider pacing. */\n`
  );

  /*
   * A manually queued simulation action (for example manual-note-react) is still
   * background AI traffic. It must wait through provider cooldown instead of
   * bypassing it and immediately producing another HTTP 429.
   */
  const schedulerCooldownAnchor = /if\s*\(\s*!manualQueued\s*&&\s*cooldownLeft\(\)\s*>\s*0\s*\)\s*return\s*;/g;
  const schedulerCooldownCount = countMatches(next, schedulerCooldownAnchor);
  if (schedulerCooldownCount !== 1) {
    throw new Error(`AI 429 circuit-breaker patch aborted: expected 1 scheduler cooldown anchor, found ${schedulerCooldownCount}.`);
  }
  next = next.replace(
    schedulerCooldownAnchor,
    `if (cooldownLeft() > 0) return; /* ${marker}: manual simulation queue also respects provider cooldown. */`
  );

  /*
   * Background work gets no in-request busy retry. On the first 429 it returns
   * control to the scheduler, whose global cooldown now decides when it is safe
   * to try again. Interactive player requests keep their existing retry policy.
   */
  const busyWaitAnchor = /const\s+maxBusyWaits\s*=\s*\r?\n\s*priority\s*>=\s*50\s*\r?\n\s*\?\s*4[^\r\n]*\r?\n\s*:\s*2[^\r\n]*;/m;
  if (!busyWaitAnchor.test(next)) {
    throw new Error("AI 429 circuit-breaker patch aborted: busy-retry anchor changed.");
  }
  next = next.replace(
    busyWaitAnchor,
    `const maxBusyWaits =\n        priority >= 50\n          ? 4   // direct player DM/group/RP keeps the existing interactive recovery\n          : 1;  // background: first 429 ends this request; scheduler retries only after cooldown`
  );

  /*
   * Background 429s need a longer quiet window than interactive requests because
   * they are large, periodic world-context calls and are the lane shown in the
   * note-react/popup-event failure sequence. Interactive timings remain unchanged.
   */
  const laneBackoffAnchor = /const base = tokenMinuteLimit \? 45000 : \(code === 429 \? 20000 : 8000\);\s*\r?\n\s*const adaptive = Math\.min\(120000, base \* Math\.pow\(1\.8, Math\.max\(0, strikeCount - 1\)\)\);/m;
  if (!laneBackoffAnchor.test(next)) {
    throw new Error("AI 429 circuit-breaker patch aborted: v1 adaptive-backoff anchor changed.");
  }
  next = next.replace(
    laneBackoffAnchor,
    `const base = tokenMinuteLimit\n        ? (requestMeta.interactive ? 45000 : 60000)\n        : (code === 429 ? (requestMeta.interactive ? 20000 : 45000) : 8000);\n      const adaptive = Math.min(\n        requestMeta.interactive ? 120000 : 180000,\n        base * Math.pow(1.8, Math.max(0, strikeCount - 1))\n      );`
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied background AI 429 circuit breaker.");
} else {
  console.log("Background AI 429 circuit breaker already applied.");
}
