import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const serverPath = path.join(root, "server", "proxy.js");

const appOriginal = fs.readFileSync(appPath, "utf8");
const serverOriginal = fs.readFileSync(serverPath, "utf8");
let appNext = appOriginal;
let serverNext = serverOriginal;

const appMarker = "MÁSVILÁG AUTONOMOUS AI ACTIVITY RECOVERY v1";
const serverMarker = "MÁSVILÁG SINGLE 429 FAILOVER v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const r = new RegExp(regex.source, flags);
  let count = 0;
  while (r.exec(text)) count += 1;
  return count;
}

if (!appNext.includes(appMarker)) {
  /* Notes react automatically through the existing player-note -> note-react signal.
     Remove only the redundant manual request button; the autonomous path remains. */
  const requestButton = /\r?\n\s*\{mine\s*&&\s*w\.chars\.length\s*>\s*0\s*\?\s*\(\s*<button\s+className=["']btn tiny ghost["'][^>]*onClick=\{askReactions\}[^>]*>\s*<Sparkles\s+size=\{12\}\s*\/?>\s*\{tt\(["']Reakciók kérése["'],\s*["']Request reactions["']\)\}\s*<\/button>\s*\)\s*:\s*null\}\s*/m;
  if (countMatches(appNext, requestButton) !== 1) {
    throw new Error("Autonomous activity recovery aborted: Note request-reaction button anchor changed.");
  }
  appNext = appNext.replace(
    requestButton,
    `\n      {/* ${appMarker}: Note reactions are automatic; no manual request button. */}\n`
  );

  /* A provider cooldown is an expected fallback condition for the optional post
     meaning helper. Keep the grounded fallback, but do not print a scary stack. */
  const meaningWarn = /console\.warn\(["']Post meaning analysis failed; using grounded fallback:["'],\s*err\);/g;
  if (countMatches(appNext, meaningWarn) !== 1) {
    throw new Error("Autonomous activity recovery aborted: post-meaning fallback warning anchor changed.");
  }
  appNext = appNext.replace(
    meaningWarn,
    `if (!(err && err.busy)) console.warn("Post meaning analysis failed; using grounded fallback:", err);`
  );

  /* Scope the retry preservation strictly to the central simulation beat. */
  const runAnchor = "result = await runSimulationAction(viewRef.current, update, action, addImage);";
  const runPos = appNext.indexOf(runAnchor);
  const updatePos = runPos >= 0 ? appNext.indexOf("      update((n) => {", runPos) : -1;
  if (runPos < 0 || updatePos < 0) {
    throw new Error("Autonomous activity recovery aborted: simulation beat boundary changed.");
  }
  let beatBlock = appNext.slice(
    appNext.lastIndexOf("      let ok = false;", runPos),
    updatePos
  );
  if (!beatBlock.startsWith("      let ok = false;")) {
    throw new Error("Autonomous activity recovery aborted: simulation result state anchor changed.");
  }
  if (!beatBlock.includes("      let result = null;")) {
    throw new Error("Autonomous activity recovery aborted: simulation result variable anchor changed.");
  }
  if (!/\}\s*catch\s*\(e\)\s*\{/.test(beatBlock)) {
    throw new Error("Autonomous activity recovery aborted: simulation catch anchor changed.");
  }

  beatBlock = beatBlock.replace(
    "      let result = null;",
    "      let result = null;\n      let busyFailure = false;"
  );
  beatBlock = beatBlock.replace(
    /\}\s*catch\s*\(e\)\s*\{/,
    `} catch (e) {\n        busyFailure = Boolean(e && e.busy);`
  );
  appNext =
    appNext.slice(0, appNext.lastIndexOf("      let ok = false;", runPos)) +
    beatBlock +
    appNext.slice(updatePos);

  const dropAnchor = /(^\s*)if\s*\(\s*queued\s*&&\s*action\s*&&\s*queued\.id\s*===\s*action\.id\s*\)\s*\{\s*simDropQueued\(n,\s*queued\.id\);\s*\}/m;
  if (countMatches(appNext, dropAnchor) !== 1) {
    throw new Error("Autonomous activity recovery aborted: queued-action drop anchor changed.");
  }
  appNext = appNext.replace(
    dropAnchor,
    (match, indent) =>
      `${indent}if (busyFailure) {\n` +
      `${indent}  const sim = ensureSimState(n);\n` +
      `${indent}  sim.running = "";\n` +
      `${indent}  sim.lastAttemptAt = now();\n` +
      `${indent}  /* Keep an AI action alive across provider cooldown. Queued actions stay\n` +
      `${indent}     where they are; planner-created actions are queued once for retry. */\n` +
      `${indent}  if (!(queued && action && queued.id === action.id) && action) {\n` +
      `${indent}    simEnqueue(n, action);\n` +
      `${indent}  }\n` +
      `${indent}  return;\n` +
      `${indent}}\n\n` +
      match
  );
}

if (!serverNext.includes(serverMarker)) {
  /* Network resilience intentionally stopped provider fan-out on 429. That made
     one throttled default provider silence the whole autonomous world even when
     another configured provider was healthy. Allow exactly ONE alternate provider:
     no same-provider retry storm and no three-provider fan-out. */
  const rateLimitBreak = /if\s*\(\s*\[429,\s*529\]\.includes\(Number\(result\?\.status\)\)\s*\)\s*\{\s*break;\s*\}/m;
  if (countMatches(serverNext, rateLimitBreak) !== 1) {
    throw new Error("Autonomous activity recovery aborted: provider 429 failover anchor changed.");
  }
  serverNext = serverNext.replace(
    rateLimitBreak,
    `if ([429, 529].includes(Number(result?.status))) {\n          /* ${serverMarker}: if the requested provider is throttled, try only\n             the first configured alternate provider, then stop. */\n          const providerIndex = providers.indexOf(provider);\n          if (providerIndex === 0 && providers.length > 1) {\n            continue;\n          }\n          break;\n        }`
  );
}

if (appNext !== appOriginal) fs.writeFileSync(appPath, appNext, "utf8");
if (serverNext !== serverOriginal) fs.writeFileSync(serverPath, serverNext, "utf8");

if (appNext !== appOriginal || serverNext !== serverOriginal) {
  console.log("Applied automatic Note reactions + autonomous AI activity recovery.");
} else {
  console.log("Automatic Note reactions + autonomous AI activity recovery already applied.");
}
