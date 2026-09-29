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

const appMarker = "MÁSVILÁG QUIET PROXY BUSY ENVELOPE v1";
const serverMarker = "MÁSVILÁG QUIET PROXY BUSY RESPONSE v1";

if (!appNext.includes(appMarker)) {
  const responseAnchor = /(^[ \t]*let data;\r?\n[ \t]*try \{ data = await res\.json\(\); \} catch \(e\) \{ data = null; \}\r?\n\r?\n)([ \t]*if \(!res\.ok\) \{)/m;
  const matches = appNext.match(new RegExp(responseAnchor.source, "gm")) || [];
  if (matches.length !== 1) {
    throw new Error(`Quiet proxy-busy patch aborted: expected 1 client response anchor, found ${matches.length}.`);
  }

  appNext = appNext.replace(
    responseAnchor,
    (_all, parsed, nonOk) =>
      parsed +
      `  const proxyBusy =\n` +
      `    (res.headers && res.headers.get && res.headers.get("x-masvilag-ai-busy") === "1") ||\n` +
      `    !!(data && data.busy === true);\n` +
      `  if (proxyBusy) {\n` +
      `    const retryAfterRaw = res.headers && res.headers.get ? res.headers.get("retry-after") : "";\n` +
      `    const retryAfterSec = Math.max(0, Number.parseFloat(String(retryAfterRaw || "")) || Number(data && data.retryAfter) || 0);\n` +
      `    const restMs = Math.max(15000, Math.min(180000, retryAfterSec > 0 ? retryAfterSec * 1000 : (requestMeta.interactive ? 20000 : 60000)));\n` +
      `    setCooldown(restMs, false);\n` +
      `    const err = new Error(\`Az AI szolgáltató átmenetileg limitált — \${Math.ceil(restMs / 1000)} másodperc pihenő.\`);\n` +
      `    err.busy = true;\n` +
      `    err.proxyBusy = true;\n` +
      `    throw err;\n` +
      `  } /* ${appMarker} */\n\n` +
      nonOk
  );
}

if (!serverNext.includes(serverMarker)) {
  const upstreamAnchor = /(    const upstreamStatus =\r?\n      Number\(\r?\n        last\?\.status\r?\n      \) \|\| 503;\r?\n)/m;
  const matches = serverNext.match(new RegExp(upstreamAnchor.source, "gm")) || [];
  if (matches.length !== 1) {
    throw new Error(`Quiet proxy-busy patch aborted: expected 1 server upstream-status anchor, found ${matches.length}.`);
  }

  serverNext = serverNext.replace(
    upstreamAnchor,
    (match) =>
      match +
      `\n    /* ${serverMarker}: upstream throttling is returned as a successful transport envelope. */\n` +
      `    if ([429, 529].includes(upstreamStatus)) {\n` +
      `      const retryAfter = String(last?.retryAfter || "60").trim() || "60";\n` +
      `      res.setHeader("retry-after", retryAfter);\n` +
      `      res.setHeader("x-masvilag-ai-busy", "1");\n` +
      `      res.setHeader("x-masvilag-ai-provider", last?.provider || requestedProvider);\n` +
      `      res.setHeader("x-masvilag-ai-upstream-status", String(upstreamStatus));\n` +
      `      return res.status(200).json({\n` +
      `        ok: false,\n` +
      `        busy: true,\n` +
      `        retryAfter: Math.max(1, Number.parseFloat(retryAfter) || 60),\n` +
      `        provider: last?.provider || requestedProvider,\n` +
      `      });\n` +
      `    }\n`
  );
}

if (appNext !== appOriginal) fs.writeFileSync(appPath, appNext, "utf8");
if (serverNext !== serverOriginal) fs.writeFileSync(serverPath, serverNext, "utf8");

if (appNext !== appOriginal || serverNext !== serverOriginal) {
  console.log("Applied quiet AI provider-busy transport envelope.");
} else {
  console.log("Quiet AI provider-busy transport envelope already applied.");
}
