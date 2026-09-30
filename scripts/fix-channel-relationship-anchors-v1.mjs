import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "apply-channel-relationship-impact-v1.mjs");
let text = fs.readFileSync(target, "utf8");

const oldLine = 'for(const [a,b,reason] of [["function applyComments(","async function genReply(","timeline-comments"],["function applyReplies(","async function genWorldStep(","timeline-replies"],["function applyWorldStep(","function NotesStrip(","timeline-feed"]])block(a,b,x=>{if((x.match(/applyChanges\\(n, out\\.changes\\);/g)||[]).length!==1)return x;return x.replace("applyChanges(n, out.changes);",`applyChannelRelationshipChanges(n, out.changes, "public", { reason: "${reason}" });`);},reason);';

if (text.includes(oldLine)) {
  text = text.replace(
    oldLine,
    '/* Public player post/comment score effects are weighted at the deterministic social-event layer below.\n   Do not rewrite applyComments/applyReplies/applyWorldStep here: later voice/comment patches own those bodies. */'
  );
  fs.writeFileSync(target, text, "utf8");
  console.log("Fixed channel relationship integration anchor without changing public relationship semantics.");
} else {
  console.log("Channel relationship integration anchor already fixed.");
}
