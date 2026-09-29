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
 * It is private source material, not display copy. The AI must interpret it and
 * express the relationship in its own words/behavior. After play begins, actual
 * interactions may evolve score / mood / bond / hidden state.
 */
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

  if (/subconscious|tudatalatti|unaware|nincs tudat[aá]ban|hasn.?t realized|nem ismerte fel/.test(low)) {
    return "The feeling is not fully conscious or recognized yet.";
  }
  if (/won.?t admit|will not admit|doesn.?t admit|denies|denial|tagad|nem vallja be|nem ismeri be|suppres|elfojt/.test(low)) {
    return "The feeling is denied, suppressed, or not openly admitted.";
  }
  if (/secret|hidden|keeps? .* secret|titok|titkos|rejteget|elhallgat/.test(low)) {
    return "Part of the feeling is deliberately kept private.";
  }

  return "";
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
   * Initialize the three semantic relationship parts separately without ever
   * copying the user's Connections wording into visible/live relationship text:
   * 1) bond/category = broad structural label
   * 2) mood = interpreted emotional/dynamic signals only
   * 3) hidden = interpreted secrecy/denial/awareness state only
   */
  base.mood = signals.length ? signals.join(", ") : (base.mood || "complex directed relationship");
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
 * Preserve the full source internally for comprehension, but never treat the
 * user's wording as copy to reproduce. Current runtime state and actual history
 * win after genuine in-world change.
 */
function relationshipBehaviorCard(w, actorId, targetId) {
  const previous = String(legacyDeepRelationshipBehaviorCard(w, actorId, targetId) || "");
  const live = (w && actorId && targetId && actorId !== targetId)
    ? getRel(w, actorId, targetId)
    : null;

  const evolved = previous
    .replace(
      "DEEP DIRECTED RELATIONSHIP CANON — RAW PROSE IS AUTHORITATIVE",
      "DEEP DIRECTED RELATIONSHIP CANON — PRIVATE SOURCE FOR INITIAL BASELINE + LIVE EVOLUTION"
    )
    .replace(
      "- A→B governs A’s actual feelings, history, beliefs, self-awareness and intended behavior toward B.",
      "- A→B defines A’s fresh-run STARTING feelings, history, beliefs, self-awareness and intended behavior toward B. After real in-world interactions, the current runtime relationship may evolve away from this baseline."
    )
    .replace(
      "- Behavior must come from the prose above plus current context, not from a generic trope associated with a category word.",
      "- At the start, infer behavior from the meaning of the full prose, not from a generic category word. Never reuse the user's wording as output. After play begins, preserve genuine changes caused by actual interactions instead of snapping back to the initial prose."
    )
    .replace(
      "The coarse baseline may help routing/scoring, but it NEVER overrides or replaces the raw directed prose above.",
      "The source prose defines meaning for the fresh-run starting state, but it is private source material, not text to quote. Once play has begun, documented current relationship state and actual interaction history may override the starting baseline where genuine change occurred."
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
    "PARAPHRASE RULE — HARD: Connections text is private source material. Never quote it, mirror its sentences, reuse distinctive phrasing, or output it as the relationship description. Understand the meaning, then express reactions, dialogue and behavior naturally in the character's own voice.",
    "",
    "LIVE DIRECTED RELATIONSHIP STATE — CURRENT, NOT THE ORIGINAL BASELINE:",
    liveCard ? JSON.stringify(liveCard) : "(none)",
    "EVOLUTION RULE: use Connections meaning to establish the first state; after that, let actual posts, DMs, comments, scenes, betrayals, intimacy, conflict and reconciliation change this direction naturally. Never copy the reverse direction unless the story actually makes the feeling reciprocal.",
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

/*
 * Migration for a worktree where the previous v3 wrapper was already applied:
 * remove copied user prose from live mood/hidden fields and add paraphrase rules
 * without requiring a clean checkout.
 */
const oldAppliedCanonLine = '  const canon = compactDirectedRelationshipCanon(direct, 500);\\n';
if (next.includes(oldAppliedCanonLine)) {
  next = next.replace(oldAppliedCanonLine, "");
}

const oldAppliedMood = '  base.mood = ("INITIAL CANON — " + signalText + ": " + canon).slice(0, 500);';
const newAppliedMood = '  base.mood = signals.length ? signals.join(", ") : (base.mood || "complex directed relationship");';
if (next.includes(oldAppliedMood)) {
  next = next.replace(oldAppliedMood, newAppliedMood);
}

const oldAppliedHiddenReturn = '  return hidden ? compactDirectedRelationshipCanon(text, 500) : "";';
if (next.includes(oldAppliedHiddenReturn)) {
  next = next.replace(
    oldAppliedHiddenReturn,
    '  if (/subconscious|tudatalatti|unaware|nincs tudat[aá]ban|hasn.?t realized|nem ismerte fel/.test(low)) return "The feeling is not fully conscious or recognized yet.";\\n  if (/won.?t admit|will not admit|doesn.?t admit|denies|denial|tagad|nem vallja be|nem ismeri be|suppres|elfojt/.test(low)) return "The feeling is denied, suppressed, or not openly admitted.";\\n  return hidden ? "Part of the feeling is deliberately kept private." : "";'
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log(
    "Applied directional relationship baseline v3: semantic initialization, paraphrased output, live evolution."
  );
} else {
  console.log("Directional relationship baseline v3 already applied.");
}
