import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");

const original = fs.readFileSync(appPath, "utf8");
let next = original;

const marker = "/* MÁSVILÁG AUTOMATIC SOCIAL FOLLOWS v2 */";
const oldCap = "const RELATIONSHIP_AUTO_FOLLOW_PENDING_MAX = 2;";
const newCap = "const RELATIONSHIP_AUTO_FOLLOW_PENDING_MAX = 0; // legacy relationship-follow queue disabled; obvious follows are immediate";
const originalEnsure = "function ensureFollowerSystem(";
const legacyEnsure = "function legacyEnsureFollowerSystem(";
const originalApplyChanges = "function applyChanges(";
const legacyApplyChanges = "function legacyApplyChanges(";

const wrapper = `

${marker}
/*
 * Obvious real-world social ties should already be followed when the world is
 * initialized: friends, family, partners/crushes, teammates, dojo/faction mates,
 * classmates/coworkers and similarly established positive bonds.
 *
 * IMPORTANT PERFORMANCE RULE:
 * The expensive all-pairs scan must NOT run on every follower normalization.
 * It runs once for the initial graph, then only when relationship changes mark
 * the graph dirty. This keeps the automatic-follow behavior without repeatedly
 * doing an O(n²) character scan during normal live-world activity.
 */
let automaticFollowSyncActive = false;

function explicitSharedSocialContext(actor, target) {
  if (!actor || !target) return false;

  const pairText = String((actor && actor.connections) || "").toLowerCase();
  const targetName = String((target && target.name) || "").toLowerCase();
  if (!targetName || !pairText.includes(targetName)) return false;

  return /same dojo|same team|same squad|same club|same band|same class|same school|dojo mate|dojo-mate|dojomate|doj[oó]t[aá]rs|teammate|team mate|team-mate|csapatt[aá]rs|clubmate|club mate|klubt[aá]rs|classmate|oszt[aá]lyt[aá]rs|coworker|co-worker|munkat[aá]rs|bandmate|band mate|squadmate|squad mate/.test(pairText);
}

function shouldAutoFollowEstablishedTie(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id) return false;
  if (isMediaAccount(w, actor.id) || isMediaAccount(w, target.id)) return false;

  const rel = getRel(w, actor.id, target.id);
  const explicitGroupTie = sameFollowTeamOrFaction(actor, target) || explicitSharedSocialContext(actor, target);

  /* Explicit personal hostility beats a generic shared-team default. */
  if (hasEnemyOrRivalBond(rel)) return false;

  /* Known or explicitly written same-dojo/team/class/work ties follow immediately. */
  if (explicitGroupTie) return true;

  const eligibility = aiFollowEligibility(w, actor.id, target.id);
  if (!eligibility || !eligibility.allowed) return false;

  /* Enemy/rival + hidden crush remains a special case, not an automatic follow. */
  if (eligibility.mode === "enemy-secret-crush") return false;

  return (
    eligibility.mode === "family" ||
    eligibility.mode === "bond" ||
    eligibility.mode === "team" ||
    eligibility.mode === "relationship-score" ||
    eligibility.mode === "secret-crush" ||
    eligibility.mode === "interaction-bond"
  );
}

function applyChanges(n, changes) {
  if (n && Array.isArray(changes) && changes.length) {
    const sim = ensureSimState(n);
    if (sim) sim.automaticFollowSyncDirty = true;
  }
  return legacyApplyChanges(n, changes);
}

function ensureFollowerSystem(w) {
  const out = legacyEnsureFollowerSystem(w);
  if (!w || typeof w !== "object") return out;

  const sim = ensureSimState(w);
  if (!sim) return out;

  /* setFollowState() itself calls ensureFollowerSystem(); avoid recursion. */
  if (automaticFollowSyncActive) return out;

  /* The heavy scan is needed only once initially, then after a real rel change. */
  if (sim.automaticFollowSyncDone && !sim.automaticFollowSyncDirty) return out;

  automaticFollowSyncActive = true;

  try {
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
    if (Array.isArray(sim.queue)) {
      sim.queue = sim.queue.filter(
        (action) =>
          !(
            action &&
            action.type === "follow" &&
            String(action.key || "").startsWith("relationship-auto-follow:")
          )
      );
    }

    sim.automaticFollowSyncDone = true;
    sim.automaticFollowSyncDirty = false;
  } finally {
    automaticFollowSyncActive = false;
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

  if (next.includes(legacyApplyChanges)) {
    // partial previous application
  } else if (next.includes(originalApplyChanges)) {
    next = next.replace(originalApplyChanges, legacyApplyChanges);
  } else {
    throw new Error("Automatic follow patch aborted: applyChanges source changed.");
  }

  next += wrapper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied automatic social follows with relationship-dirty performance gating.");
} else {
  console.log("Automatic social follow policy already applied.");
}
