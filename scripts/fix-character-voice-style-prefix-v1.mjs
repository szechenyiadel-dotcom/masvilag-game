import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const oldPrefix = "const VOICE_STYLE_PREFIX_MAX = 7600;";
const newPrefix = "const VOICE_STYLE_PREFIX_MAX = 14500; // enough for a separate compact card for every multi-speaker participant";
const oldCardReturn = 'return card && card.card ? String(card.card) : "";';
const newCardReturn = 'return card && card.card ? String(card.card).slice(0, 1600) : "";';

if (next.includes(oldPrefix)) next = next.replace(oldPrefix, newPrefix);
else if (!next.includes(newPrefix)) throw new Error("Voice-style prefix fix aborted: prefix anchor not found.");

if (next.includes(oldCardReturn)) next = next.replace(oldCardReturn, newCardReturn);
else if (!next.includes(newCardReturn)) throw new Error("Voice-style prefix fix aborted: card-return anchor not found.");

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Expanded protected voice-style prefix and compacted each speaker card so multi-character calls keep every card.");
} else {
  console.log("Voice-style multi-speaker prefix fix already applied.");
}
