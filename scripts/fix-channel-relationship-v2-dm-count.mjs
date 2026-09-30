import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-channel-relationship-impact-v2.mjs");
let text = fs.readFileSync(target, "utf8");
let changed = false;

const oldDm = `  replaceOne(\n    /applyChanges\\(\\s*n,\\s*dmChanges\\s*\\);/,\n    \`applyChannelRelationshipChanges(n, dmChanges, \"dm\", { text: t, reason: \"direct-dm\" });\`,\n    \"direct DM channel weighting\"\n  );`;
if (text.includes(oldDm)) {
  const replacement = `  {\n    const dmRx = /applyChanges\\(\\s*n,\\s*dmChanges\\s*\\);/g;\n    const dmCount = allMatches(dmRx).length;\n    if (dmCount !== 2) {\n      throw new Error(\`Channel relationship v2 aborted: direct DM channel weighting expected 2 matches, found \${dmCount}.\`);\n    }\n    next = next.replace(\n      dmRx,\n      \`applyChannelRelationshipChanges(n, dmChanges, \"dm\", { text: t, reason: \"direct-dm\" });\`\n    );\n  }`;
  text = text.replace(oldDm, replacement);
  changed = true;
}

/* The generated App has two visually similar relation rows. Only the actual
   character-list row has c.id as the owner. Patch it contextually instead of
   replacing the relationship editor row by accident. */
const profileStart = text.indexOf('  replaceOne(\n    /\\{r\\.score > 0');
const profileEnd = profileStart >= 0 ? text.indexOf('\n\n  const starredNeedle', profileStart) : -1;
if (profileStart >= 0 && profileEnd > profileStart) {
  const profileReplacement = `  {\n    const listAnchor = 'className=\"character-list-main\"';\n    const listStart = next.indexOf(listAnchor);\n    const spanNeedle = '{r.score > 0 ? \"+\" : \"\"}{r.score} · {relLabel(r)}</span>';\n    const spanAt = listStart >= 0 ? next.indexOf(spanNeedle, listStart) : -1;\n    if (listStart < 0 || spanAt < 0 || spanAt - listStart > 1800) {\n      throw new Error(\"Channel relationship v2 aborted: character-list official status anchor not found.\");\n    }\n    next = next.slice(0, spanAt) +\n      '{r.score > 0 ? \"+\" : \"\"}{r.score} · {officialRelationshipStatusForPair(w, c.id, w.meId, CURRENT_LANG)}</span>' +\n      next.slice(spanAt + spanNeedle.length);\n  }`;
  text = text.slice(0, profileStart) + profileReplacement + text.slice(profileEnd);
  changed = true;
}

/* Official mutual status must never leak one-sided romance. */
const mutualStart = text.indexOf('function explicitMutualStatus(w, a, b) {');
const mutualEnd = mutualStart >= 0 ? text.indexOf('\n\nfunction officialRelationshipStatusForPair', mutualStart) : -1;
if (mutualStart >= 0 && mutualEnd > mutualStart) {
  const mutualReplacement = String.raw`function relationshipOfficialOverrideKey(a, b) {
  return [String(a || ""), String(b || "")].sort().join("<>");
}

function directedRomanticOfficialKind(rel) {
  const bond = String(rel && (rel.bond || rel.type) || "").toLowerCase();
  if (/spouse|married|házas|házastárs|férj|feleség/.test(bond)) return "spouse";
  if (/engaged|jegyes|fiancé|fiance/.test(bond)) return "engaged";
  if (/dating|járnak|partner|boyfriend|girlfriend|párkapcsolat|couple/.test(bond)) return "dating";
  if (/exes|\bex\b|volt pár/.test(bond)) return "exes";
  return "";
}

function mutualRomanticFloor(aKind, bKind) {
  if (aKind === "exes" || bKind === "exes") return aKind === "exes" && bKind === "exes" ? "exes" : "";
  const rank = { dating: 1, engaged: 2, spouse: 3 };
  const a = rank[aKind] || 0;
  const b = rank[bKind] || 0;
  const floor = Math.min(a, b);
  return floor >= 3 ? "spouse" : floor >= 2 ? "engaged" : floor >= 1 ? "dating" : "";
}

function explicitMutualStatus(w, a, b) {
  const key = relationshipOfficialOverrideKey(a, b);
  const override = w && w.relationshipOfficialOverrides && w.relationshipOfficialOverrides[key];
  if (override && ["dating", "engaged", "spouse", "exes", "best-friend"].includes(String(override.kind || ""))) {
    return String(override.kind);
  }

  const ra = getRel(w, a, b) || EMPTY_REL;
  const rb = getRel(w, b, a) || EMPTY_REL;
  const romantic = mutualRomanticFloor(directedRomanticOfficialKind(ra), directedRomanticOfficialKind(rb));
  if (romantic) return romantic;

  const aBest = /best friend|legjobb barát/i.test(String(ra.bond || ra.type || "")) || Number(ra.score) >= 80;
  const bBest = /best friend|legjobb barát/i.test(String(rb.bond || rb.type || "")) || Number(rb.score) >= 80;
  if (aBest && bBest) return "best-friend";
  return "";
}

function recordExplicitMutualRelationshipMilestones(w, changes, source = "roleplay") {
  if (!w || !Array.isArray(changes)) return;
  const rows = changes.filter((row) => row && row.a && row.b && row.a !== row.b);
  for (const row of rows) {
    const reverse = rows.find((other) => other && other.a === row.b && other.b === row.a);
    if (!reverse) continue;
    const kind = mutualRomanticFloor(directedRomanticOfficialKind(row), directedRomanticOfficialKind(reverse));
    const rowBest = /best friend|legjobb barát/i.test(String(row.bond || row.type || ""));
    const reverseBest = /best friend|legjobb barát/i.test(String(reverse.bond || reverse.type || ""));
    const resolvedKind = kind || (rowBest && reverseBest ? "best-friend" : "");
    if (!resolvedKind) continue;
    if (!w.relationshipOfficialOverrides || typeof w.relationshipOfficialOverrides !== "object" || Array.isArray(w.relationshipOfficialOverrides)) {
      w.relationshipOfficialOverrides = {};
    }
    const key = relationshipOfficialOverrideKey(row.a, row.b);
    w.relationshipOfficialOverrides[key] = { kind: resolvedKind, source, at: now() };
    console.info("[relationship-milestone]", "pair=" + key, "status=" + resolvedKind, "source=" + source);
  }
}`;
  text = text.slice(0, mutualStart) + mutualReplacement + text.slice(mutualEnd);
  changed = true;
}

/* Record a story-explicit mutual milestone only when the scene relationship
   output itself contains reciprocal changes. Existing bond mirroring stays untouched. */
const oldSceneWrapper = 'function applySceneChangesWithStatus(...args) {\n  return withRelationshipChannel("roleplay", { reason: "roleplay" }, () => legacyChannelApplySceneChangesWithStatus(...args));\n}';
if (text.includes(oldSceneWrapper)) {
  const newSceneWrapper = 'function applySceneChangesWithStatus(...args) {\n  const [world, scene, changes] = args;\n  const result = withRelationshipChannel("roleplay", { reason: "roleplay" }, () => legacyChannelApplySceneChangesWithStatus(...args));\n  recordExplicitMutualRelationshipMilestones(world, changes, scene && scene.id ? "roleplay:" + scene.id : "roleplay");\n  return result;\n}';
  text = text.replace(oldSceneWrapper, newSceneWrapper);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, text, "utf8");
  console.log("Finalized channel relationship v2 anchors and strict mutual official-status rules.");
} else {
  console.log("Channel relationship v2 finalizer already applied.");
}
