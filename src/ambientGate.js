/*
 * MÁSVILÁG AMBIENT ACTIVITY GATE
 *
 * The world no longer asks the AI "should something happen?" on a timer. Background
 * extras (popups, group chatter, gossip, rumours) run only after something really
 * happened in the game: the player did something. Each such event allows a small
 * number of extras while it is still fresh; then the world rests until the next one.
 *
 * Pure functions: the caller keeps `state` ({ triggerAt, used }) on the world's sim.
 */

export const AMBIENT_TRIGGER_WINDOW_MS = 30 * 60 * 1000;
export const AMBIENT_ACTIONS_PER_TRIGGER = 2;

/* Timestamp of the newest event the player caused (events are stored newest first,
   so the most recent 300 rows are enough). */
export function latestPlayerTriggerAt(events, isPlayerId, scanLimit = 300) {
  const list = Array.isArray(events) ? events : [];
  const limit = Math.min(list.length, scanLimit);
  let latest = 0;
  for (let i = 0; i < limit; i += 1) {
    const event = list[i];
    if (!event || !event.actorId || !isPlayerId(event.actorId)) continue;
    const ts = Number(event.ts) || 0;
    if (ts > latest) latest = ts;
  }
  return latest;
}

export function ambientGateOpen({ triggerAt, now, state, windowMs = AMBIENT_TRIGGER_WINDOW_MS, perTrigger = AMBIENT_ACTIONS_PER_TRIGGER }) {
  const at = Number(triggerAt) || 0;
  if (!at || now - at > windowMs) return false;
  const seen = state && Number(state.triggerAt) === at;
  return !seen || (Number(state.used) || 0) < perTrigger;
}

/* New state after one ambient action started. */
export function ambientGateAfterRun(state, triggerAt) {
  const at = Number(triggerAt) || 0;
  const sameTrigger = state && Number(state.triggerAt) === at;
  return { triggerAt: at, used: sameTrigger ? (Number(state.used) || 0) + 1 : 1 };
}
