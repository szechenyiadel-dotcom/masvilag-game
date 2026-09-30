import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/*
 * Build-time bootstrap for the immutable, original grounded-events/invites patch.
 * This avoids any transport corruption in later copied/split gzip payloads.
 * Nothing is fetched or executed at application runtime.
 */
const ORIGINAL_COMMIT = "64df1aec9180335aefb91c55adc0431c3dc0ef82";
const ORIGINAL_URL = `https://raw.githubusercontent.com/szechenyiadel-dotcom/masvilag-game/${ORIGINAL_COMMIT}/scripts/apply-grounded-events-invites-v1.mjs`;

const response = await fetch(ORIGINAL_URL, {
  headers: { "user-agent": "masvilag-build-patch-loader/1.0" },
});
if (!response.ok) {
  throw new Error(`Could not load immutable grounded patch: HTTP ${response.status}`);
}

const source = await response.text();
if (!source.includes("PAYLOAD_B64") || !source.includes("gunzipSync")) {
  throw new Error("Immutable grounded patch source failed integrity shape check.");
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const tempPath = path.join(scriptsDir, ".grounded-events-invites.original-wrapper.mjs");
fs.writeFileSync(tempPath, source, "utf8");
try {
  await import(pathToFileURL(tempPath).href + `?v=${Date.now()}`);
} finally {
  try { fs.unlinkSync(tempPath); } catch {}
}

console.log(`Loaded immutable grounded events/invites patch from commit ${ORIGINAL_COMMIT}.`);
