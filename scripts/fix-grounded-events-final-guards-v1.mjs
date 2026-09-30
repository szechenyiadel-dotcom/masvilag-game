import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG GROUNDED EVENTS FINAL GUARDS v1";

function count(regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...next.matchAll(new RegExp(regex.source, flags))].length;
}
function one(regex, replacement, label) {
  const n = count(regex);
  if (n !== 1) throw new Error(`Grounded final guards aborted: ${label} expected 1, found ${n}.`);
  next = next.replace(regex, replacement);
}

if (!next.includes(`/* ${MARKER} */`)) {
  // Keep the known false-Brent rollback in the same render path where it already existed.
  // Do NOT introduce a new React hook here: this patch runs inside a component section whose
  // render branches can return before this point, and adding useEffect caused React #310.
  if (!/groundedRepairKnownFalseBrentIncident\(view\);\s*\n\s*view\.activeSceneId = tab === "scene" && sceneId \? sceneId : "";/.test(next)) {
    throw new Error("Grounded final guards aborted: false-Brent repair hook missing.");
  }

  if (!/playerPostContentIsolation:\s*true/.test(next)) {
    throw new Error("Grounded final guards aborted: isolated player-post comment route missing.");
  }
  if (!/minComments:\s*3,\s*maxComments:\s*6,\s*playerPostContentIsolation:\s*true/.test(next)) {
    throw new Error("Grounded final guards aborted: player-post comment quota is not 3–6.");
  }

  one(
    /function\s+applyChannelRelationshipChanges\s*\(/,
    "function legacyGroundedFinalApplyChannelRelationshipChanges(",
    "channel relationship change wrapper"
  );

  const helper = String.raw`

/* ${MARKER} */
function groundedBondFamily(label) {
  const s = String(label || "").toLowerCase();
  if (/mother|father|mom|dad|parent|sibling|brother|sister|cousin|aunt|uncle|family|anya|apa|szülő|testvér|unokatestvér|nagynéni|nagybácsi|rokon/.test(s)) return "family";
  if (/enemy|ellens/.test(s)) return "enemy";
  if (/rival|rivális/.test(s)) return "rival";
  if (/best friend|legjobb barát/.test(s)) return "best";
  if (/close friend|közeli barát/.test(s)) return "close";
  if (/friend|barát/.test(s)) return "friend";
  if (/acquaint|ismerős/.test(s)) return "acquaintance";
  if (/stranger|idegen/.test(s)) return "stranger";
  return "";
}

function groundedBondRank(label) {
  const family = groundedBondFamily(label);
  const map = { enemy: -2, rival: -1, stranger: 0, acquaintance: 1, friend: 2, close: 3, best: 4 };
  return Object.prototype.hasOwnProperty.call(map, family) ? map[family] : null;
}

function groundedRemoveRequestedBond(row) {
  const out = { ...row };
  delete out.bond;
  delete out.type;
  return out;
}

function groundedGuardBondChange(w, row, channel, ctx = {}) {
  if (!row || typeof row !== "object") return row;
  const a = findChar(w, row.a);
  const b = findChar(w, row.b);
  if (!a || !b || a === b) return row;
  const current = getRel(w, a, b) || EMPTY_REL;
  if (current.fixed || groundedBondFamily(current.bond || current.type) === "family") {
    return groundedRemoveRequestedBond(row);
  }

  const requested = row.bond || row.type;
  if (!requested) return row;
  const oldLabel = current.bond || current.type || "";
  const oldRank = groundedBondRank(oldLabel);
  const newRank = groundedBondRank(requested);

  if (oldRank !== null && newRank !== null && Math.abs(newRank - oldRank) > 1) {
    console.info("[relationship-status-guard]", "blocked=multi-level-jump", "from=" + a, "toward=" + b, "old=" + oldLabel, "requested=" + requested, "channel=" + String(channel || ""));
    return groundedRemoveRequestedBond(row);
  }

  if (groundedBondFamily(oldLabel) === "rival" && groundedBondFamily(requested) === "enemy") {
    const why = String(row.why || ctx.reason || "");
    const strongRoleplay = channel === "roleplay" && (Math.abs(Number(row.delta) || 0) >= 6 || /betray|árul|attack|megtámad|violence|erőszak|serious threat|komoly fenyeget|humiliat|megaláz/i.test(why));
    if (!strongRoleplay) {
      console.info("[relationship-status-guard]", "blocked=rival-to-enemy-without-strong-grounded-roleplay", "from=" + a, "toward=" + b, "channel=" + String(channel || ""));
      return groundedRemoveRequestedBond(row);
    }
  }
  return row;
}

function applyChannelRelationshipChanges(w, changes, channel, ctx = {}) {
  const guarded = (Array.isArray(changes) ? changes : []).map((row) => groundedGuardBondChange(w, row, channel, ctx));
  return legacyGroundedFinalApplyChannelRelationshipChanges(w, guarded, channel, ctx);
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied grounded final guards without adding React hooks; verified 3–6 comments and bounded bond transitions.");
} else {
  console.log("Grounded final guards already applied.");
}
