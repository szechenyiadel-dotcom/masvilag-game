import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");

const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "/* MÁSVILÁG DIRECTIONAL RELATIONSHIP BASELINE v3 */";
const originalInfer = "function inferCanonicalRelationshipBaseline(";
const legacyInfer = "function legacyInferCanonicalRelationshipBaseline(";
const currentBehaviorFn = "function relationshipBehaviorCard(";
const legacyBehaviorFn = "function legacyDeepRelationshipBehaviorCard(";

const wrapper = `

${marker}
/*
 * Connections prose defines the fresh-run STARTING state, direction by direction.
 * It is not a permanent lock: after play begins, actual interactions may evolve
 * score / mood / bond / hidden state. A -> B never inherits B -> A automatically.
 */
function compactDirectedRelationshipCanon(text, maxChars = 460) {
  return String(text || "")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, Math.max(120, Number(maxChars) || 460));
}

function directedRelationshipSignals(text) {
  const low = String(text || "").toLowerCase();
  const out = [];
  const push = (value) => {
    if (value && !out.includes(value)) out.push(value);
  };

  if (/obsess|fixat|megsz[aá]ll|k[eé]nyszeres/.test(low)) push("obsessive fixation");
  if (/possess|birtokl|territorial|az eny[eé]m|mine\\b/.test(low)) push("possessiveness");
  if (/jealous|f[eé]lt[eé]ken/.test(low)) push("jealousy");
  if (/overprotect|protectiv|v[eé]delmez|oltalmaz/.test(low)) push("protectiveness");
  if (/dependen|f[uü]gg|needs? .* emotionally|cannot let go|nem tudja elengedni/.test(low)) push("dependency");
  if (/in love|loves?\\b|szerelmes|m[eé]lyen szeret/.test(low)) push("love");
  if (/crush|attract|vonz[oó]d|vonzalom|sexual tension|romantic/.test(low)) push("attraction");
  if (/loyal|h[uű]s[eé]g|ride or die|would do anything|b[aá]rmit megtenne/.test(low)) push("loyalty");
  if (/distrust|doesn.?t trust|nem b[ií]zik|gyanak/.test(low)) push("distrust");
  if (/resent|neheztel|harag|angry at/.test(low)) push("resentment");
  if (/hate|gy[uű]l[oö]l/.test(low)) push("hatred");
  if (/fear|afraid|rette|f[eé]l t[oő]le/.test(low)) push("fear");
  if (/rival|riv[aá]lis|competitive|verseng/.test(low)) push("rivalry");
  if (/friend|bar[aá]t|close to|k[oö]zel [aá]ll/.test(low)) push("friendship");
  if (/family|sibling|brother|sister|cousin|csal[aá]d|testv[eé]r|unokatestv[eé]r/.test(low)) push("family bond");

  return out;
}

function directedHiddenCanon(text) {
  const low = String(text || "").toLowerCase();
  const hidden =
    /secret|hidden|keeps? .* secret|titok|titkos|rejteget|elhallgat|won.?t admit|will not admit|doesn.?t admit|denies|denial|tagad|nem vallja be|nem ismeri be|suppres|elfojt|subconscious|tudatalatti|unaware|nincs tudat[aá]ban/.test(low);

  return hidden ? compactDirectedRelationshipCanon(text, 500) : "";
}

function inferCanonicalRelationshipBaseline(w, actor, target) {
  const legacy = legacyInferCanonicalRelationshipBaseline(w, actor, target);

  if (!w || !actor || !target || actor.id === target.id) return legacy;

  /*
   * HARD DIRECTION RULE:
   * Only actor -> target is allowed to initialize actor's relationship state.
   * target -> actor may be completely different and is never copied here.
   */
  const direct = connectionCanonSnippetAbout(w, actor, target, 24000);
  if (!direct) return legacy;

  const canon = compactDirectedRelationshipCanon(direct, 500);
  const signals = directedRelationshipSignals(direct);
  const low = String(direct).toLowerCase();

  const base = legacy && typeof legacy === "object"
    ? { ...legacy }
    : {
        score: 0,
        bond: "",
        fixed: false,
        hidden: "",
        mood: "",
        why: "",
        source: "connections",
      };

  /*
   * The three semantic relationship parts are initialized separately:
   * 1) bond/category = the broad structural label (Crush/Friend/Enemy/etc.)
   * 2) mood = the detailed directed emotional/dynamic prose
   * 3) hidden = secrecy/denial/unawareness only when the prose actually says so
   *
   * This prevents "Crush + obsessed/possessive/jealous..." from collapsing
   * into plain "Crush".
   */
  const signalText = signals.length ? signals.join(", ") : "directed canon";
  base.mood = ("INITIAL CANON — " + signalText + ": " + canon).slice(0, 500);
  base.hidden = directedHiddenCanon(direct);

  /*
   * Score remains a coarse affinity/intensity axis, but extreme directed canon
   * may strengthen the starting magnitude without changing directionality.
   */
  const numericScore = Number(base.score) || 0;
  if (/obsess|fixat|megsz[aá]ll|k[eé]nyszeres/.test(low) && numericScore > 0) {
    base.score = Math.max(numericScore, 78);
  } else if (/\\bin love\\b|szerelmes|would do anything|b[aá]rmit megtenne/.test(low) && numericScore > 0) {
    base.score = Math.max(numericScore, 72);
  } else if (/\\bhate\\b|gy[uű]l[oö]l/.test(low) && numericScore < 0) {
    base.score = Math.min(numericScore, -85);
  }

  base.source = "connections-deep";
  return base;
}

/*
 * Preserve the previous deep two-sided context, but reinterpret it correctly:
 * Connections prose is the initial directed baseline. Current runtime state and
 * actual history win after genuine in-world change.
 */
function relationshipBehaviorCard(w, actorId, targetId) {
  const previous = String(legacyDeepRelationshipBehaviorCard(w, actorId, targetId) || "");
  const live = (w && actorId && targetId && actorId !== targetId)
    ? getRel(w, actorId, targetId)
    : null;

  const evolved = previous
    .replace(
      "DEEP DIRECTED RELATIONSHIP CANON — RAW PROSE IS AUTHORITATIVE",
      "DEEP DIRECTED RELATIONSHIP CANON — INITIAL BASELINE + LIVE EVOLUTION"
    )
    .replace(
      "- A→B governs A’s actual feelings, history, beliefs, self-awareness and intended behavior toward B.",
      "- A→B defines A’s fresh-run STARTING feelings, history, beliefs, self-awareness and intended behavior toward B. After real in-world interactions, the current runtime relationship may evolve away from this baseline."
    )
    .replace(
      "- Behavior must come from the prose above plus current context, not from a generic trope associated with a category word.",
      "- At the start, behavior must come from the full prose above, not a generic category word. After play begins, preserve genuine changes caused by actual interactions instead of snapping back to the initial prose."
    )
    .replace(
      "The coarse baseline may help routing/scoring, but it NEVER overrides or replaces the raw directed prose above.",
      "The raw directed prose controls the fresh-run starting state. Once play has begun, documented current relationship state and actual interaction history may override the starting baseline where genuine change occurred."
    );

  const liveCard = live && typeof live === "object"
    ? {
        score: Number(live.score) || 0,
        bond: String(live.bond || live.type || ""),
        mood: String(live.mood || ""),
        hidden: String(live.hidden || ""),
      }
    : null;

  return [
    evolved,
    "",
    "LIVE DIRECTED RELATIONSHIP STATE — CURRENT, NOT THE ORIGINAL BASELINE:",
    liveCard ? JSON.stringify(liveCard) : "(none)",
    "EVOLUTION RULE: use Connections prose to establish the first state; after that, let actual posts, DMs, comments, scenes, betrayals, intimacy, conflict and reconciliation change this direction naturally. Never copy the reverse direction unless the story actually makes the feeling reciprocal.",
  ].join("\\n");
}
`;

if (!next.includes(marker)) {
  if (next.includes(legacyInfer)) {
    // already renamed by a partial application
  } else if (next.includes(originalInfer)) {
    next = next.replace(originalInfer, legacyInfer);
  } else {
    throw new Error(
      "Deep relationship baseline patch aborted: inferCanonicalRelationshipBaseline source changed; refusing unsafe replacement."
    );
  }

  if (next.includes(legacyBehaviorFn)) {
    // already renamed by a partial application
  } else if (next.includes(currentBehaviorFn)) {
    next = next.replace(currentBehaviorFn, legacyBehaviorFn);
  } else {
    throw new Error(
      "Deep relationship baseline patch aborted: relationshipBehaviorCard source changed; refusing unsafe replacement."
    );
  }

  next += wrapper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log(
    "Applied directional relationship baseline v3: detailed bond/mood/hidden initialization + live evolution."
  );
} else {
  console.log("Directional relationship baseline v3 already applied.");
}
