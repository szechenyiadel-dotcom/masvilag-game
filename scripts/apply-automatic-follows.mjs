import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");

const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "/* MÁSVILÁG AUTOMATIC SOCIAL FOLLOWS v1 */";
const oldCap = "const RELATIONSHIP_AUTO_FOLLOW_PENDING_MAX = 2;";
const newCap = "const RELATIONSHIP_AUTO_FOLLOW_PENDING_MAX = 0; // legacy relationship-follow queue disabled; obvious follows are immediate";
const originalEnsure = "function ensureFollowerSystem(";
const legacyEnsure = "function legacyEnsureFollowerSystem(";

const wrapper = `

${marker}
/*
 * Obvious real-world social ties should already be followed when the world is
 * initialized: friends, family, partners/crushes, teammates, dojo/faction mates,
 * classmates/coworkers and similarly established positive bonds.
 *
 * This changes ONLY the social follow graph. Relationship score/mood/bond are
 * still controlled by the relationship system. Because ensureFollowerSystem()
 * is also called during autonomous social processing, a later relationship
 * change can naturally create a new follow as soon as the pair becomes eligible.
 */
function explicitSharedSocialContext(actor, target) {
  if (!actor || !target) return false;

  const pairText = [
    connectionCanonSnippetAbout(null, actor, target, 5000),
    actor && actor.connections,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const targetName = String((target && target.name) || "").toLowerCase();
  if (!targetName || !pairText.includes(targetName)) return false;

  return /same dojo|same team|same squad|same club|same band|same class|same school|dojo mate|dojo-mate|dojomate|doj[oó]t[aá]rs|teammate|team mate|team-mate|csapatt[aá]rs|clubmate|club mate|klubt[aá]rs|classmate|oszt[aá]lyt[aá]rs|coworker|co-worker|munkat[aá]rs|bandmate|band mate|squadmate|squad mate/.test(pairText);
}

function shouldAutoFollowEstablishedTie(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id) return false;
  if (isMediaAccount(w, actor.id) || isMediaAccount(w, target.id)) return false;

  const eligibility = aiFollowEligibility(w, actor.id, target.id);
  if (!eligibility || !eligibility.allowed) return false;

  /* Enemy/rival + hidden crush remains a special case, not an automatic follow. */
  if (eligibility.mode === "enemy-secret-crush") return false;

  if (
    eligibility.mode === "family" ||
    eligibility.mode === "bond" ||
    eligibility.mode === "team" ||
    eligibility.mode === "relationship-score" ||
    eligibility.mode === "secret-crush" ||
    eligibility.mode === "interaction-bond"
  ) {
    return true;
  }

  return sameFollowTeamOrFaction(actor, target) || explicitSharedSocialContext(actor, target);
}

function ensureFollowerSystem(w) {
  const out = legacyEnsureFollowerSystem(w);
  if (!w || typeof w !== "object") return out;

  const profiles = socialProfiles(w);

  profiles.forEach((actor) => {
    if (!actor || isHuman(w, actor.id) || isMediaAccount(w, actor.id)) return;

    profiles.forEach((target) => {
      if (!target || target.id === actor.id || isMediaAccount(w, target.id)) return;
      if (isFollowing(w, actor.id, target.id)) return;
      if (!shouldAutoFollowEstablishedTie(w, actor, target)) return;

      setFollowState(
        w,
        actor.id,
        target.id,
        true,
        "relationship-auto-follow"
      );
    });
  });

  /* Remove stale queued copies created by older builds. */
  const sim = ensureSimState(w);
  if (sim && Array.isArray(sim.queue)) {
    sim.queue = sim.queue.filter(
      (action) =>
        !(
          action &&
          action.type === "follow" &&
          String(action.key || "").startsWith("relationship-auto-follow:")
        )
    );
  }

  return out;
}
`;

if (next.includes(oldCap)) {
  next = next.replace(oldCap, newCap);
} else if (!next.includes(newCap)) {
  throw new Error("Automatic follow patch aborted: relationship follow queue cap source changed.");
}

if (!next.includes(marker)) {
  if (next.includes(legacyEnsure)) {
    // partial previous application
  } else if (next.includes(originalEnsure)) {
    next = next.replace(originalEnsure, legacyEnsure);
  } else {
    throw new Error("Automatic follow patch aborted: ensureFollowerSystem source changed.");
  }

  next += wrapper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied automatic social follows for established ties and later relationship changes.");
} else {
  console.log("Automatic social follow policy already applied.");
}
