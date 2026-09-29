import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const serverPath = path.join(root, "server", "proxy.js");

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const r = new RegExp(regex.source, flags);
  let count = 0;
  while (r.exec(text)) count += 1;
  return count;
}

function patchApp() {
  const original = fs.readFileSync(appPath, "utf8");
  let next = original;
  const marker = "MÁSVILÁG AI + PINIMG NETWORK RESILIENCE v1";

  if (next.includes(marker)) return false;

  const resolveStart = next.indexOf("const resolveImg = (src, media) => {");
  const resolveEnd = resolveStart >= 0 ? next.indexOf("function ensureImageMaps", resolveStart) : -1;
  if (resolveStart < 0 || resolveEnd < 0) {
    throw new Error("Network resilience patch aborted: resolveImg boundary not found.");
  }
  let resolveBlock = next.slice(resolveStart, resolveEnd);
  if (!/\n\s*return src;\r?\n\};/.test(resolveBlock)) {
    throw new Error("Network resilience patch aborted: resolveImg return anchor changed.");
  }
  resolveBlock = resolveBlock.replace(
    /\n\s*return src;\r?\n\};/,
    `\n  const rawExternal = String(src || "").trim();\n  if (/^https:\\/\\//i.test(rawExternal)) {\n    try {\n      const parsedExternal = new URL(rawExternal);\n      const externalHost = String(parsedExternal.hostname || "").toLowerCase();\n      if (\n        parsedExternal.protocol === "https:" &&\n        (externalHost === "i.pinimg.com" || externalHost.endsWith(".pinimg.com"))\n      ) {\n        return backendUrl(\`/media/remote-image?url=\${encodeURIComponent(rawExternal)}\`);\n      }\n    } catch (e) {}\n  }\n\n  return src;\n};`
  );
  next = next.slice(0, resolveStart) + resolveBlock + next.slice(resolveEnd);

  const maxConcurrentAnchor = /maxConcurrent:\s*Math\.max\(1,\s*Math\.min\(2,\s*Number\(import\.meta\.env\.VITE_AI_MAX_CONCURRENT\)\s*\|\|\s*2\)\),/;
  if (!maxConcurrentAnchor.test(next)) {
    throw new Error("Network resilience patch aborted: AI maxConcurrent anchor changed.");
  }
  next = next.replace(
    maxConcurrentAnchor,
    `maxConcurrent: 1, /* ${marker}: one provider request at a time prevents large-prompt bursts */`
  );

  const budgetAnchor = "function budgetAiRequest(system, prompt) {";
  if (!next.includes(budgetAnchor)) {
    throw new Error("Network resilience patch aborted: budgetAiRequest anchor not found.");
  }
  const dedupeHelper = `function dedupeLargeAiPromptBlocks(value) {\n  const text = String(value || "");\n  if (text.length < 12000) return text;\n\n  const parts = text.split(/\\r?\\n{2,}/);\n  const seen = new Set();\n  const out = [];\n\n  for (const part of parts) {\n    const normalized = String(part || "")\n      .trim()\n      .replace(/[ \\t]+/g, " ")\n      .replace(/\\r?\\n/g, "\\n");\n\n    if (normalized.length >= 420) {\n      if (seen.has(normalized)) continue;\n      seen.add(normalized);\n    }\n\n    out.push(part);\n  }\n\n  return out.join("\\n\\n");\n}\n\n`;
  next = next.replace(budgetAnchor, dedupeHelper + budgetAnchor);

  const compactLines = /const compactSystem = preserveEdges\(system, AI_MAX_SYSTEM_CHARS, "system"\);\s*\r?\n\s*const compactPrompt = preserveEdges\(prompt, AI_MAX_PROMPT_CHARS, "prompt"\);/;
  if (!compactLines.test(next)) {
    throw new Error("Network resilience patch aborted: budget compaction lines changed.");
  }
  next = next.replace(
    compactLines,
    `const dedupedSystem = dedupeLargeAiPromptBlocks(system);\n  const dedupedPrompt = dedupeLargeAiPromptBlocks(prompt);\n  const compactSystem = preserveEdges(dedupedSystem, AI_MAX_SYSTEM_CHARS, "system");\n  const compactPrompt = preserveEdges(dedupedPrompt, AI_MAX_PROMPT_CHARS, "prompt");`
  );

  const costGapAnchor = /const costGap\s*=\s*task\.priority >= 50\s*\? Math\.min\(5000, Number\(AI\.lastCostGap\) \|\| 0\)\s*:\s*task\.priority >= 15\s*\? Math\.min\(7000, Number\(AI\.lastCostGap\) \|\| 0\)\s*:\s*Math\.min\(10000, Number\(AI\.lastCostGap\) \|\| 0\);/m;
  if (!costGapAnchor.test(next)) {
    throw new Error("Network resilience patch aborted: AI cost-gap anchor changed.");
  }
  next = next.replace(
    costGapAnchor,
    `const costGap =\n          task.priority >= 50\n            ? Math.min(12000, Number(AI.lastCostGap) || 0)\n            : task.priority >= 15\n              ? Math.min(22000, Number(AI.lastCostGap) || 0)\n              : Math.min(45000, Number(AI.lastCostGap) || 0);`
  );

  const backoffAnchor = /const base = tokenMinuteLimit \? 30000 : \(code === 429 \? 12000 : 8000\);\s*\r?\n\s*const adaptive = Math\.min\(60000, base \* Math\.pow\(1\.8, Math\.max\(0, strikeCount - 1\)\)\);/;
  if (!backoffAnchor.test(next)) {
    throw new Error("Network resilience patch aborted: 429 backoff anchor changed.");
  }
  next = next.replace(
    backoffAnchor,
    `const base = tokenMinuteLimit ? 45000 : (code === 429 ? 20000 : 8000);\n      const adaptive = Math.min(120000, base * Math.pow(1.8, Math.max(0, strikeCount - 1)));`
  );

  const compactionLog = /if \(budgeted\.wasCompacted\) \{\s*console\.warn\(\s*"AI request compacted before provider call:",\s*`system=\$\{system\.length\} chars`,\s*`prompt=\$\{prompt\.length\} chars`\s*\);\s*\}/m;
  if (!compactionLog.test(next)) {
    throw new Error("Network resilience patch aborted: compaction log anchor changed.");
  }
  next = next.replace(
    compactionLog,
    `if (\n    budgeted.wasCompacted &&\n    (!Number(AI.lastCompactionNoticeAt) || now() - Number(AI.lastCompactionNoticeAt) >= 60000)\n  ) {\n    AI.lastCompactionNoticeAt = now();\n    console.info(\n      "AI request context compacted safely before provider call:",\n      \`system=\${system.length} chars\`,\n      \`prompt=\${prompt.length} chars\`\n    );\n  }`
  );

  fs.writeFileSync(appPath, next, "utf8");
  return true;
}

function patchServer() {
  const original = fs.readFileSync(serverPath, "utf8");
  let next = original;
  const marker = "MÁSVILÁG PINIMG SAME-ORIGIN PROXY + 429 RESILIENCE v1";

  if (next.includes(marker)) return false;

  const mediaVersionAnchor = 'app.get("/media/version", async (req, res) => {';
  if (!next.includes(mediaVersionAnchor)) {
    throw new Error("Network resilience patch aborted: media/version anchor not found.");
  }

  const remoteRoute = `/* ${marker} */\nfunction isPinimgRemoteUrl(rawUrl) {\n  try {\n    const parsed = new URL(String(rawUrl || "").trim());\n    const host = String(parsed.hostname || "").toLowerCase();\n    return (\n      parsed.protocol === "https:" &&\n      (host === "i.pinimg.com" || host.endsWith(".pinimg.com"))\n    );\n  } catch (e) {\n    return false;\n  }\n}\n\nasync function sendProxiedRemoteImage(rawUrl, res) {\n  const remote = await fetchRemoteImageReference(rawUrl);\n  const bytes = Buffer.from(remote.base64, "base64");\n  res.setHeader("Content-Type", remote.mimeType || "image/jpeg");\n  res.setHeader("Content-Length", String(bytes.length));\n  res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");\n  res.setHeader("X-Content-Type-Options", "nosniff");\n  return res.send(bytes);\n}\n\napp.get("/media/remote-image", async (req, res) => {\n  try {\n    if (!(await requireDb(res))) return;\n    const session = await getSessionIdentity(req);\n    if (!session) {\n      clearSessionCookie(res);\n      return res.status(401).end();\n    }\n\n    const rawUrl = String(req.query?.url || "").trim();\n    if (!isPinimgRemoteUrl(rawUrl)) return res.status(403).end();\n    return await sendProxiedRemoteImage(rawUrl, res);\n  } catch (err) {\n    console.warn("Remote image proxy failed:", err?.message || err);\n    return res.status(502).end();\n  }\n});\n\n`;
  next = next.replace(mediaVersionAnchor, remoteRoute + mediaVersionAnchor);

  const externalRedirect = /if \(\/\^https:\\\/\\\/\/i\.test\(dataUrl\)\) \{\s*return res\.redirect\(302, dataUrl\);\s*\}/m;
  if (!externalRedirect.test(next)) {
    throw new Error("Network resilience patch aborted: media external redirect anchor changed.");
  }
  next = next.replace(
    externalRedirect,
    `if (/^https:\\/\\//i.test(dataUrl)) {\n      if (isPinimgRemoteUrl(dataUrl)) {\n        try {\n          return await sendProxiedRemoteImage(dataUrl, res);\n        } catch (err) {\n          console.warn("Stored Pinterest image proxy failed:", err?.message || err);\n          return res.status(502).end();\n        }\n      }\n      return res.redirect(302, dataUrl);\n    }`
  );

  const providerRetryAnchor = /if \(\s*!retryableProviderStatus\(\s*r\.status\s*\) \|\|\s*attempt >= 2\s*\) \{\s*break;\s*\}/gm;
  const retryCount = countMatches(next, providerRetryAnchor);
  if (retryCount !== 2) {
    throw new Error(`Network resilience patch aborted: expected 2 provider retry anchors, found ${retryCount}.`);
  }
  next = next.replace(
    providerRetryAnchor,
    `if (\n        r.status === 429 ||\n        r.status === 529 ||\n        !retryableProviderStatus(r.status) ||\n        attempt >= 2\n      ) {\n        break;\n      }`
  );

  const providerResultAnchor = /last =\s*result;\s*\r?\n\s*\/\*\s*\r?\n\s*\* Only fail over for transient\/upstream\/model availability problems\./m;
  if (!providerResultAnchor.test(next)) {
    throw new Error("Network resilience patch aborted: provider failover anchor changed.");
  }
  next = next.replace(
    providerResultAnchor,
    `last =\n          result;\n\n        /* A provider rate limit is a pacing signal, not a reason to fan the\n         same huge prompt out to every configured provider. Let the client-side\n         queue respect Retry-After/backoff instead. */\n        if ([429, 529].includes(Number(result?.status))) {\n          break;\n        }\n\n        /*\n         * Only fail over for transient/upstream/model availability problems.`
  );

  const retryAfterAnchor = /if \(\s*last\?\.retryAfter\s*\) \{\s*res\.setHeader\(\s*"retry-after",\s*last\.retryAfter\s*\);\s*\}/m;
  if (!retryAfterAnchor.test(next)) {
    throw new Error("Network resilience patch aborted: response retry-after anchor changed.");
  }
  next = next.replace(
    retryAfterAnchor,
    `if (last?.retryAfter) {\n      res.setHeader("retry-after", last.retryAfter);\n    } else if ([429, 529].includes(upstreamStatus)) {\n      res.setHeader("retry-after", "45");\n    }`
  );

  fs.writeFileSync(serverPath, next, "utf8");
  return true;
}

const appChanged = patchApp();
const serverChanged = patchServer();

if (appChanged || serverChanged) {
  console.log("Applied AI rate-limit resilience and same-origin Pinterest image proxy.");
} else {
  console.log("AI/network resilience already applied.");
}
