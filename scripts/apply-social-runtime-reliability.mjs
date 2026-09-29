import fs from 'node:fs';
const path = new URL('../src/App.jsx', import.meta.url);
let source = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const marker = 'MÁSVILÁG SOCIAL RUNTIME RELIABILITY v2';
if (source.includes(marker)) {
  console.log('Social runtime reliability already applied.');
  process.exit(0);
}
function replace(old, next) {
  if (!source.includes(old) || source.indexOf(old) !== source.lastIndexOf(old)) throw new Error('Runtime patch anchor missing or ambiguous: ' + old.slice(0, 100));
  source = source.replace(old, next);
}
function section(start, end, edit) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Missing section: ' + start);
  const before = source.slice(a, b);
  const after = edit(before);
  if (before === after) throw new Error('Unchanged section: ' + start);
  source = source.slice(0, a) + after + source.slice(b);
}
// Await before attaching the evaluated cast, including characters choosing silence.
section('async function genNoteReact(', '/* Kit szólaltassunk', s => s.replace('  return askWorldJSON(', '  const out = await askWorldJSON('));
section('function pickNoteReactionCast(', '/* Egy bot', s => s.replace('.slice(0, 8)', '.slice(0, 4)'));
// Silence is a completed evaluation too; otherwise the same four actors starve the rest.
replace('  note.processedBy =\n    [...processed];', `  for (const id of castIds) {
    if (id !== note.authorId && !isHuman(n, id) && charById(n, id)) processed.add(id);
  }
  note.processedBy =
    [...processed];`);
section('  if (action.type === "note-react") {', '  const alreadyProcessed =', s => s.replace('    !note ||', '    !note || now() - (Number(note.ts) || 0) >= NOTE_LIFE ||'));
// A semantic parser needs only its supplied post facts, not the 33k world engine.
section('async function analyzeSocialPostMeaning(', 'function socialPostMeaningCard(', s => s.replace('      engineFor(w),', '      "You are a precise social-post meaning parser. Use only the supplied visible facts. Preserve uncertainty and never invent identities or private knowledge.",').replace('  const author = charById', '  if (cooldownLeft() > 0) return fallbackSocialPostMeaning(w, post);\n\n  const author = charById'));
// Honor the cost estimate instead of truncating a large request to an unrealistically short interval.
replace('Math.min(18000, raw)', 'Math.min(120000, raw)');
replace(': Math.min(45000, Number(AI.lastCostGap) || 0);', ': Math.min(120000, Number(AI.lastCostGap) || 0);');
replace('for (let guard = 0; guard < 40; guard++) {', 'while (cooldownLeft() > 0) {');
replace('            busyWaits++;', '            busyWaits++;\n            if (priority < 50) throw err; // Scheduler owns background retries; release worker immediately.');

// The dedicated apply-ai-proxy-busy-envelope patch runs earlier in social-policy
// and already converts HTTP 200 + {busy:true} into a retryable busy error.
// Keep this runtime patch focused on queue/cooldown starvation.

// All lanes already check their own due times. The feed clock cannot gate them all.
replace(`        if (
          !canTick(
            view2,
            AUTO_DEFAULT.every
          )
        ) {
          return;
        }
`, '');
// A pending AI request can legitimately spend >90 seconds waiting for cooldown.
// Releasing its lock early starts a second copy, not a recovery.
replace(`  if (autoRunning.current) {
    /* Recover from a rejected/aborted render cycle that left the engine locked. */
    if (autoRunningSince.current && now() - autoRunningSince.current > 90000) {
      autoRunning.current = false;
      autoRunningSince.current = 0;
      setAutoBusy(false);
    } else {
      return;
    }
  }`, '  if (autoRunning.current) return;');
replace('    const i = setInterval(beat, 9000);\n    const first = setTimeout(beat, 150);', `    const safeBeat = () => beat().catch((error) => {
      console.error("Simulation beat failed:", error);
    });
    const i = setInterval(safeBeat, 9000);
    const first = setTimeout(safeBeat, 150);`);
// Scope cleanup to the lock-owning invocation, including errors during state update.
replace('      autoRunning.current = true;\n      autoRunningSince.current = now();', '      autoRunning.current = true;\n      try {\n      autoRunningSince.current = now();');
replace('      autoRunning.current = false;\n      autoRunningSince.current = 0;\n      if (alive) setAutoBusy(false);', '      } finally {\n        autoRunning.current = false;\n        autoRunningSince.current = 0;\n        if (alive) setAutoBusy(false);\n      }');
// A delayed action must not block ready actions behind it.
replace('  return sim.queue.length ? sim.queue[0] : null;', '  return sim.queue.find((action) => action && (!action.notBefore || action.notBefore <= now())) || null;');

// Player-post reactions are user-triggered consequences even though they are not
// source="manual". Never leave their guaranteed comment/event work behind a global
// background cooldown. Once started, the AI queue itself waits/retries safely.
replace(`  const queued = simPeek(view2);
  const manualQueued = !!(queued && queued.source === "manual");`, `  const queued = simPeek(view2);
  const manualQueued = !!(queued && queued.source === "manual");
  const playerPostQueued = Boolean(
    queued && (
      queued.source === "coverage" ||
      (queued.source === "event" && queued.payload && queued.payload.trigger === "player-post")
    )
  );
  const cooldownBypassQueued = manualQueued || playerPostQueued;`);
replace(
  'if (cooldownLeft() > 0) return; /* MÁSVILÁG AI BACKGROUND 429 CIRCUIT BREAKER v2: manual simulation queue also respects provider cooldown. */',
  'if (!cooldownBypassQueued && cooldownLeft() > 0) return; /* MÁSVILÁG SOCIAL RUNTIME RELIABILITY v2: player-post/manual queue can enter retry handling during global cooldown. */'
);

// Follow-back complaints get a grace period; every queued follow DM is revalidated.
replace('    pending.payload.followSignalAt = now();', '    pending.payload.followSignalAt = now();\n    pending.notBefore = signal === "you-follow-player-no-followback" ? now() + 10 * 60000 : now();');
section('function maybeQueuePersonalityFollowDm(', 'function autonomousDmGroundingEvidence(', s => s.replace('  return simEnqueue(\n    w,\n    mkAction(', '  const action = mkAction(').replace(`      "event"
    )
  );`, `      "event"
    );
  action.notBefore = signal === "you-follow-player-no-followback" ? now() + 10 * 60000 : now();
  return simEnqueue(w, action);`));
section('  if (action.type === "dm") {', '    const rawTxt =', s => s.replace('    const out =', `    if (action.payload?.trigger === "follow-social-signal" &&
        !personalityFollowDmPromptContext(view, bot, action.payload)) return null;

    const out =`));
// A real newer transition invalidates stale signals; no notification or history invented.
replace('  if (!signal) return null;', `  if (!signal) return null;
  if (signal === "player-followed-you" && !isFollowing(w, playerId, actorId)) return null;
  if (signal === "player-unfollowed-you" && isFollowing(w, playerId, actorId)) return null;
  if (signal === "you-follow-player-no-followback" && now() - Number(latest.ts) < 10 * 60000) return null;`);
// Bound own-note starvation without forcing a quiet character to publish.
const helper = `/* ${marker} */
function dueAutonomousNoteAction(w) {
  const sim = w.sim || {};
  const last = Math.max(Number(sim.noteAttemptAt) || 0, Number(sim.liveWorldStartedAt) || 0,
    ...(w.notes || []).filter(n => n && !isHuman(w, n.authorId)).map(n => Number(n.ts) || 0));
  if (now() - last < 10 * 60000) return null;
  const candidates = (w.chars || []).filter(c => c && !isHuman(w, c.id))
    .filter(c => { const note = noteOf(w, c.id); return !note || now() - (note.ts || 0) >= NOTE_REFRESH; })
    .map(c => ({ c, score: characterNoteActivityScore(w, c) }))
    .filter(row => row.score >= 8).sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const bot = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].c;
  return mkAction("note", "due-note:" + bot.id + ":" + Math.floor(now() / 600000), { botId: bot.id }, "auto");
}

`;
replace('function planAutoAction(view) {', helper + 'function planAutoAction(view) {');
replace('  const pending = findUnanswered(view);', '  const dueNote = dueAutonomousNoteAction(view);\n  if (dueNote) return dueNote;\n\n  const pending = findUnanswered(view);');
replace('        simMarkRunning(n, action);', '        simMarkRunning(n, action);\n        if (action && action.type === "note") ensureSimState(n).noteAttemptAt = now();');
// Retry rate-limit/network failures without dropping the requested reaction.
replace('        busyFailure = Boolean(e && e.busy);', '        busyFailure = Boolean(e && (e.busy || /időben|hálózat|fetch|network|timeout/i.test(e.message || "")));');
replace('const BUILD_VERSION = "v99-performance-canon-cache-feed-tree";', 'const BUILD_VERSION = "v99-social-runtime-reliability-20260929b";');
fs.writeFileSync(path, source);
console.log('Applied social runtime reliability v2.');
