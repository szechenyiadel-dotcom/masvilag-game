import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const payloadDir = path.join(root, "scripts", "grounded-events-invites-payload");
const EXPECTED_SHA = "efb447e7dd30fb21c950ba30217c9ca2eb43d57eb664a6f1165253d75e702eea";

const files = fs.readdirSync(payloadDir)
  .filter((name) => /^part\d+\.b64$/i.test(name))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

if (!files.length) {
  throw new Error("Grounded events/invites patch payload parts are missing.");
}

const payloadB64 = files
  .map((name) => fs.readFileSync(path.join(payloadDir, name), "utf8").replace(/\s+/g, ""))
  .join("");

const compressed = Buffer.from(payloadB64, "base64");
const source = zlib.gunzipSync(compressed).toString("utf8");
const sha = crypto.createHash("sha256").update(source).digest("hex");

if (sha !== EXPECTED_SHA) {
  throw new Error(`Grounded events/invites patch checksum mismatch: expected ${EXPECTED_SHA}, got ${sha}.`);
}

const tmp = path.join(root, "scripts", ".apply-grounded-events-invites-v1.decoded.mjs");
fs.writeFileSync(tmp, source, "utf8");
try {
  await import(pathToFileURL(tmp).href + `?v=${Date.now()}`);
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}

console.log(`Loaded grounded events/invites patch from ${files.length} verified payload parts.`);
