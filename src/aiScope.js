/*
 * MÁSVILÁG AI CONTEXT SCOPE
 *
 * An AI request gets what it needs, not the whole world. When a few characters talk
 * (Manon and Brent), the prompt carries Manon, Brent (and the player, if involved):
 * their relationship, their groups, the events that touch them. Everyone else stays out.
 */

export const FOCUS_SCOPE_MAX = 4;
export const STRONGEST_TIES = 3;

const idOf = (value) => String(value == null ? "" : value).trim();

/* null = no focus (or too many people): the request keeps the full-world context. */
export function focusedScope(focusIds, { playerId = "", includePlayer = true } = {}) {
  const focus = [...new Set((Array.isArray(focusIds) ? focusIds : [focusIds]).map(idOf).filter(Boolean))];
  if (!focus.length || focus.length > FOCUS_SCOPE_MAX) return null;
  const people = new Set(focus);
  if (includePlayer && idOf(playerId)) people.add(idOf(playerId));
  return { focus, people };
}

export const inScope = (scope, id) => Boolean(scope) && scope.people.has(idOf(id));

/* A relationship is relevant when BOTH people are part of the conversation. */
export function relationshipInScope(scope, fromId, toId) {
  return inScope(scope, fromId) && inScope(scope, toId);
}

/* An event is relevant when it was done by, or aimed at, someone in the conversation. */
export function eventInScope(scope, event) {
  if (!scope || !event) return false;
  if (inScope(scope, event.actorId)) return true;
  const targets = Array.isArray(event.targetIds) ? event.targetIds : [];
  if (targets.some((id) => inScope(scope, id))) return true;
  const participants = event.meta && Array.isArray(event.meta.participantIds) ? event.meta.participantIds : [];
  return participants.some((id) => inScope(scope, id));
}

/* The people the speakers feel most strongly about, so they can still name their closest circle. */
export function strongestTieIds(ties, limit = STRONGEST_TIES) {
  const best = new Map();
  for (const tie of Array.isArray(ties) ? ties : []) {
    const id = idOf(tie && tie.id);
    const strength = Math.abs(Number(tie && tie.strength) || 0);
    if (id && strength > 0 && strength > (best.get(id) || 0)) best.set(id, strength);
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, limit)).map(([id]) => id);
}

/* Groups (dojos, gangs, houses...) are relevant when someone in the conversation belongs to them.
   groups: [{ name, kind, members: [{ id, label }] }]; the member list is capped, in-scope people first. */
export function groupsForScope(groups, scope, memberCap = 6) {
  return (Array.isArray(groups) ? groups : [])
    .filter((group) => !scope || group.members.some((member) => inScope(scope, member.id)))
    .map((group) => {
      const ordered = scope
        ? [...group.members.filter((m) => inScope(scope, m.id)), ...group.members.filter((m) => !inScope(scope, m.id))]
        : group.members;
      return { ...group, members: ordered.slice(0, memberCap) };
    });
}
