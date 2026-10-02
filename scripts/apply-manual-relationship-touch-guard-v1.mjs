import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;
const MARKER = "MÁSVILÁG MANUAL RELATIONSHIP TOUCH GUARD v1";

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) throw new Error("Manual relationship touch patch aborted: " + label);
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes("/* " + MARKER + " */")) {
  const stateAnchor = `  const [c, setC] = useState(initial);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [rels, setRelsState] = useState(() => {`;
  const stateReplacement = `  const [c, setC] = useState(initial);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  /* ${MARKER} */
  const [relTouched, setRelTouched] = useState(() => new Set());
  const [rels, setRelsState] = useState(() => {`;
  replaceExact(stateAnchor, stateReplacement, "CharForm relationship state");

  const setterAnchor = `  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const setRelDraft = (otherId, patch) => setRelsState((p) => ({ ...p, [otherId]: { ...(p[otherId] || { score: 0, hidden: "", bond: "", fixed: false }), ...patch } }));`;
  const setterReplacement = `  const set = (k, v) => setC((p) => ({ ...p, [k]: v }));
  const setRelDraft = (otherId, patch) => {
    setRelTouched((prev) => {
      const copy = new Set(prev);
      copy.add(String(otherId));
      return copy;
    });
    setRelsState((p) => ({ ...p, [otherId]: { ...(p[otherId] || { score: 0, hidden: "", bond: "", fixed: false }), ...patch } }));
  };`;
  replaceExact(setterAnchor, setterReplacement, "CharForm relationship setter");

  const saveAnchor = `      onSave(
        {
          ...c,
          connections: String(c.connections || "").slice(0, 4000),
          username: (c.username || c.name)
            .toLowerCase()
            .replace(/[^a-z0-9._]/g, "")
        },
        rels
      );`;
  const saveReplacement = `      const touchedRels = {};
      relTouched.forEach((id) => {
        if (rels[id]) touchedRels[id] = rels[id];
      });
      onSave(
        {
          ...c,
          connections: String(c.connections || "").slice(0, 4000),
          username: (c.username || c.name)
            .toLowerCase()
            .replace(/[^a-z0-9._]/g, "")
        },
        touchedRels
      );`;
  replaceExact(saveAnchor, saveReplacement, "CharForm relationship save");

  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] manual-relationship-touch-guard=v1 applied; untouched-rels-not-promoted");
} else {
  console.log("[patch-status] manual-relationship-touch-guard=v1 already applied");
}
