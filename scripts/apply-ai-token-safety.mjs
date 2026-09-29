import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const serverPath = path.join(root, "server", "proxy.js");
const marker = "MÁSVILÁG AI TOKEN SAFETY v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const r = new RegExp(regex.source, flags);
  let count = 0;
  while (r.exec(text)) count += 1;
  return count;
}

function buildAppPatch(original) {
  let next = original;
  if (next.includes(marker)) return { changed: false, text: next };

  /*
   * Background world work was observed sending ~82k prompt chars. Keep direct
   * player interactions untouched, but bound autonomous/background context so a
   * single tab cannot consume the provider's token-per-minute budget by itself.
   */
  const budgetAssignmentAnchor = /(^[ \t]*prompt\s*=\s*budgeted\.prompt\s*;\s*\r?\n)/m;
  if (countMatches(next, budgetAssignmentAnchor) !== 1) {
    throw new Error("AI token safety aborted: callClaude prompt-budget anchor changed.");
  }
  next = next.replace(
    budgetAssignmentAnchor,
    (match) =>
      match +
      `  const backgroundPromptCap = Math.min(\n` +
      `    AI_MAX_PROMPT_CHARS,\n` +
      `    Math.max(18000, Number(import.meta.env.VITE_AI_BACKGROUND_MAX_PROMPT_CHARS) || 28000)\n` +
      `  );\n` +
      `  if (!requestMeta.interactive && prompt.length > backgroundPromptCap) {\n` +
      `    prompt = preserveEdges(prompt, backgroundPromptCap, "background prompt");\n` +
      `  }\n`
  );

  /*
   * Post meaning is only a routing/parser helper. It must not receive the whole
   * world engine as its system message; all required visible facts are already
   * supplied by its own prompt. This removes ~33k system chars from that helper.
   */
  const semanticStart = next.indexOf("async function analyzeSocialPostMeaning(");
  const semanticEnd = semanticStart >= 0
    ? next.indexOf("function socialPostMeaningCard(", semanticStart)
    : -1;
  if (semanticStart < 0 || semanticEnd < 0) {
    throw new Error("AI token safety aborted: post-meaning helper boundary changed.");
  }
  const semanticOriginal = next.slice(semanticStart, semanticEnd);
  let semanticNext = semanticOriginal;
  const engineAnchor = "      engineFor(w),";
  if (!semanticNext.includes(engineAnchor)) {
    throw new Error("AI token safety aborted: post-meaning engine anchor changed.");
  }
  semanticNext = semanticNext.replace(
    engineAnchor,
    `      "You are a precise social-post meaning parser. Use only the supplied visible facts. Preserve uncertainty. Never invent identities, relationships, private knowledge, or events.",`
  );
  if (semanticNext === semanticOriginal) {
    throw new Error("AI token safety aborted: post-meaning helper was not changed.");
  }
  next = next.slice(0, semanticStart) + semanticNext + next.slice(semanticEnd);

  /* Marker lives in generated App.jsx so repeated build/dev patch runs are safe. */
  next = next.replace(
    "function budgetAiRequest(system, prompt) {",
    `/* ${marker} */\nfunction budgetAiRequest(system, prompt) {`
  );

  return { changed: next !== original, text: next };
}

function buildServerPatch(original) {
  let next = original;
  if (next.includes(marker)) return { changed: false, text: next };

  /*
   * Do not immediately repeat a rate-limited request inside the proxy. Gemini
   * may still move to its configured fallback MODEL, but each model is tried
   * once for 429/529 instead of hammering the same quota twice within ~700 ms.
   * There are exactly two retry loops with this anchor (Gemini + Anthropic).
   */
  const providerRetryAnchor = /if \(\s*!retryableProviderStatus\(\s*r\.status\s*\) \|\|\s*attempt >= 2\s*\) \{\s*break;\s*\}/gm;
  const retryCount = countMatches(next, providerRetryAnchor);
  if (retryCount !== 2) {
    throw new Error(`AI token safety aborted: expected 2 provider retry anchors, found ${retryCount}.`);
  }
  next = next.replace(
    providerRetryAnchor,
    `if (\n        r.status === 429 ||\n        r.status === 529 ||\n        !retryableProviderStatus(r.status) ||\n        attempt >= 2\n      ) {\n        break;\n      }`
  );

  /*
   * A 429/529 from the requested provider is a pacing signal. Do not fan the
   * same large request out to the next provider. In the current production
   * setup that was turning a Gemini 429 into a second OpenAI "no credits" 429
   * and hiding the real Retry-After signal from the client.
   */
  const providerResultAnchor = /last =\s*result;\s*\r?\n\s*\/\*\s*\r?\n\s*\* Only fail over for transient\/upstream\/model availability problems\./m;
  if (!providerResultAnchor.test(next)) {
    throw new Error("AI token safety aborted: provider failover anchor changed.");
  }
  next = next.replace(
    providerResultAnchor,
    `last =\n          result;\n\n        if ([429, 529].includes(Number(result?.status))) {\n          break;\n        }\n\n        /*\n         * Only fail over for transient/upstream/model availability problems.`
  );

  /* Give the client a sane cooldown even if an upstream omitted Retry-After. */
  const retryAfterAnchor = /if \(\s*last\?\.retryAfter\s*\) \{\s*res\.setHeader\(\s*"retry-after",\s*last\.retryAfter\s*\);\s*\}/m;
  if (!retryAfterAnchor.test(next)) {
    throw new Error("AI token safety aborted: response Retry-After anchor changed.");
  }
  next = next.replace(
    retryAfterAnchor,
    `if (last?.retryAfter) {\n      res.setHeader("retry-after", last.retryAfter);\n    } else if ([429, 529].includes(upstreamStatus)) {\n      res.setHeader("retry-after", "30");\n    }`
  );

  /* Marker lives near the message route only; no social scheduler code touched. */
  const messageRouteAnchor = `app.post(\n  [\n    "/ai/messages",`;
  if (!next.includes(messageRouteAnchor)) {
    throw new Error("AI token safety aborted: AI message route anchor changed.");
  }
  next = next.replace(messageRouteAnchor, `/* ${marker} */\n${messageRouteAnchor}`);

  return { changed: next !== original, text: next };
}

const appOriginal = fs.readFileSync(appPath, "utf8");
const serverOriginal = fs.readFileSync(serverPath, "utf8");

/* Validate both fully before writing either one. */
const appPatch = buildAppPatch(appOriginal);
const serverPatch = buildServerPatch(serverOriginal);

if (appPatch.changed) fs.writeFileSync(appPath, appPatch.text, "utf8");
if (serverPatch.changed) fs.writeFileSync(serverPath, serverPatch.text, "utf8");

if (appPatch.changed || serverPatch.changed) {
  console.log("Applied AI token safety without changing social scheduler.");
} else {
  console.log("AI token safety already applied.");
}
