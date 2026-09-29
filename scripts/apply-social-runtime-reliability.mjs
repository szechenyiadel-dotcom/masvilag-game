import fs from 'node:fs';
const path = new URL('../src/App.jsx', import.meta.url);
let source = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const marker = 'MÁSVILÁG SOCIAL RUNTIME RELIABILITY v3';
if (source.includes(marker)) {
  console.log('Social runtime reliability v3 already applied.');
  process.exit(0);
}
function replace(old, next) {
  if (!source.includes(old) || source.indexOf(old) !== source.lastIndexOf(old)) {
    throw new Error('Runtime v3 patch anchor missing or ambiguous: ' + old.slice(0, 120));
  }
  source = source.replace(old, next);
}
function section(start, end, edit) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Missing runtime v3 section: ' + start);
  const before = source.slice(a, b);
  const after = edit(before);
  if (before === after) throw new Error('Unchanged runtime v3 section: ' + start);
  source = source.slice(0, a) + after + source.slice(b);
}

/* NOTE reliability: one provider result is awaited and every evaluated actor is
   marked processed, including characters who consciously chose silence. */
section('async function genNoteReact(', '/* Kit szólaltassunk', s =>
  s.replace('  return askWorldJSON(', '  const out = await askWorldJSON(')
);
section('function pickNoteReactionCast(', '/* Egy bot', s => s.replace('.slice(0, 8)', '.slice(0, 4)'));
replace('  note.processedBy =\n    [...processed];', `  for (const id of castIds) {
    if (id !== note.authorId && !isHuman(n, id) && charById(n, id)) processed.add(id);
  }
  note.processedBy =
    [...processed];`);
section('  if (action.type === "note-react") {', '  const alreadyProcessed =', s =>
  s.replace('    !note ||', '    !note || now() - (Number(note.ts) || 0) >= NOTE_LIFE ||')
);

/* The optional post-meaning helper must never consume the provider while the
   provider is cooling down. Its grounded fallback is sufficient for routing. */
section('async function analyzeSocialPostMeaning(', 'function socialPostMeaningCard(', s =>
  s.replace(
    '      engineFor(w),',
    '      "You are a precise social-post meaning parser. Use only the supplied visible facts. Preserve uncertainty and never invent identities or private knowledge.",'
  ).replace(
    '  const author = charById',
    '  if (cooldownLeft() > 0) return fallbackSocialPostMeaning(w, post);\n\n  const author = charById'
  )
);

/* IMPORTANT: provider pacing/backoff is owned only by apply-ai-network-resilience.
   Do not stack a second global 429 circuit breaker here. */

/* Each social lane already has its own due-time logic. A single feed clock must
   not prevent ready DMs/Notes/posts from being considered. */
replace(`        if (
          !canTick(
            view2,
            AUTO_DEFAULT.every
          )
        ) {
          return;
        }
`, '');

/* Never let a delayed follow-back complaint block ready work behind it. */
replace(
  '  return sim.queue.length ? sim.queue[0] : null;',
  '  return sim.queue.find((action) => action && (!action.notBefore || action.notBefore <= now())) || null;'
);

/* Player-triggered public reactions are urgent queue work. They may enter the
   existing retry handler even if an earlier background request opened cooldown. */
replace(`  const queued = simPeek(view2);
  const manualQueued = !!(queued && queued.source === "manual");`, `  const queued = simPeek(view2);
  const manualQueued = !!(queued && queued.source === "manual");
  const urgentQueued = Boolean(
    queued && (
      queued.source === "coverage" ||
      (queued.source === "event" && queued.payload && queued.payload.trigger === "player-post")
    )
  );
  const cooldownBypassQueued = manualQueued || urgentQueued;`);
replace(
  '  if (!manualQueued && cooldownLeft() > 0) return;',
  '  if (!cooldownBypassQueued && cooldownLeft() > 0) return; /* MÁSVILÁG SOCIAL RUNTIME RELIABILITY v3 */'
);

/* Keep the original stale-lock recovery; only contain rejected beat promises and
   guarantee cleanup for the invocation that acquired the lock. */
replace(
  '    const i = setInterval(beat, 9000);\n    const first = setTimeout(beat, 150);',
  `    const safeBeat = () => beat().catch((error) => {
      console.error("Simulation beat failed:", error);
    });
    const i = setInterval(safeBeat, 9000);
    const first = setTimeout(safeBeat, 150);`
);
replace(
  '      autoRunning.current = true;\n      autoRunningSince.current = now();',
  '      autoRunning.current = true;\n      try {\n      autoRunningSince.current = now();'
);
replace(
  '      autoRunning.current = false;\n      autoRunningSince.current = 0;\n      if (alive) setAutoBusy(false);',
  '      } finally {\n        autoRunning.current = false;\n        autoRunningSince.current = 0;\n        if (alive) setAutoBusy(false);\n      }'
);

/* A player-post comment wave is guaranteed coverage, not optional ambience. */
replace(
  '    const isGuaranteedCoverage = commentTrigger === "guaranteed-coverage";',
  '    const isGuaranteedCoverage = commentTrigger === "guaranteed-coverage" || commentTrigger === "player-post";'
);

/* Mark quota output so applyComments can use one narrow rescue path when the AI
   did return comments but ordinary style filters rejected every single line. */
section('    const out = quotaEnforced', '    const commentsProbe =', s => {
  const old = `    const out = quotaEnforced
      ? {
          ...(quotaOut || {}),
          comments: safeAiComments(quotaOut).slice(0, maxComments),
        }
      : quotaOut;

`;
  const next = `    const out = quotaEnforced
      ? {
          ...(quotaOut || {}),
          comments: safeAiComments(quotaOut).slice(0, maxComments),
          __guaranteedCoverage: isGuaranteedCoverage,
        }
      : quotaOut;

`;
  if (!s.includes(old)) throw new Error('Guaranteed-comment output anchor changed');
  return s.replace(old, next);
});

/* Normal comment validation stays authoritative. Only when it produced zero for
   guaranteed coverage do we accept ONE already-generated AI line through a
   narrower rescue path. It still validates actor, ownership, post id, sanitation,
   direct addressing and duplicates. */
section('function applyComments(n, postId, out, label) {', 'function socialInteractionInterest(', s => {
  const old = `  /* Raw AI "events" are not a second reality. Concrete social objects above are the source of truth. */
  return createdVisible;
}
`;
  const next = `  if (!createdVisible && out && out.__guaranteedCoverage) {
    for (const c of safeAiComments(out)) {
      const who = aiVoice(n, c && (c.id !== undefined ? c.id : c.name));
      if (!who || !c || !c.text || who === p.authorId) continue;

      const declaredPostId = String(
        c.post_id !== undefined ? c.post_id : c.postId !== undefined ? c.postId : ""
      ).trim();
      if (declaredPostId && declaredPostId !== String(p.id)) continue;

      let body = cleanGeneratedComment(n, who, c.text, 240);
      if (!body) continue;
      body = sanitizeGeneratedDirectAddress(n, who, p.authorId, body);
      if (!body) continue;

      const normalized = body.replace(/\\s+/g, " ").trim().toLowerCase();
      const duplicate = safePostComments(p).some((row) =>
        row && row.authorId === who && String(row.text || "").replace(/\\s+/g, " ").trim().toLowerCase() === normalized
      );
      if (duplicate) continue;

      const made = {
        id: uid(),
        authorId: who,
        text: body,
        ts: now(),
        parent: null,
        language: worldLanguage(n, n.meId),
      };
      p.comments = safePostComments(p);
      p.comments.push(made);
      noteComment(n, p, made);
      createdVisible += 1;
      break;
    }
  }

  /* Raw AI "events" are not a second reality. Concrete social objects above are the source of truth. */
  return createdVisible;
}
`;
  if (!s.includes(old)) throw new Error('applyComments return anchor changed');
  return s.replace(old, next);
});

/* Existing coverage watchdog already retries a zero-result post every 12 seconds.
   Keep provider/network failures retryable too, without inventing another throttle. */
replace(
  '        busyFailure = Boolean(e && e.busy);',
  '        busyFailure = Boolean(e && (e.busy || /időben|hálózat|fetch|network|timeout/i.test(e.message || "")));'
);

/* Follow-back complaints get a grace period and stale follow events are
   revalidated immediately before an AI call. */
replace(
  '    pending.payload.followSignalAt = now();',
  '    pending.payload.followSignalAt = now();\n    pending.notBefore = signal === "you-follow-player-no-followback" ? now() + 10 * 60000 : now();'
);
section('function maybeQueuePersonalityFollowDm(', 'function autonomousDmGroundingEvidence(', s =>
  s.replace('  return simEnqueue(\n    w,\n    mkAction(', '  const action = mkAction(').replace(
    `      "event"
    )
  );`,
    `      "event"
    );
  action.notBefore = signal === "you-follow-player-no-followback" ? now() + 10 * 60000 : now();
  return simEnqueue(w, action);`
  )
);
section('  if (action.type === "dm") {', '    const rawTxt =', s =>
  s.replace(
    '    const out =',
    `    if (action.payload?.trigger === "follow-social-signal" &&
        !personalityFollowDmPromptContext(view, bot, action.payload)) return null;

    const out =`
  )
);
replace('  if (!signal) return null;', `  if (!signal) return null;
  if (signal === "player-followed-you" && !isFollowing(w, playerId, actorId)) return null;
  if (signal === "player-unfollowed-you" && isFollowing(w, playerId, actorId)) return null;
  if (signal === "you-follow-player-no-followback" && now() - Number(latest.ts) < 10 * 60000) return null;`);

/* Give autonomous Notes an opportunity without forcing a quiet character to post. */
const helper = `/* ${marker} */
function dueAutonomousNoteAction(w) {
  const sim = w.sim || {};
  const last = Math.max(
    Number(sim.noteAttemptAt) || 0,
    Number(sim.liveWorldStartedAt) || 0,
    ...(w.notes || []).filter(n => n && !isHuman(w, n.authorId)).map(n => Number(n.ts) || 0)
  );
  if (now() - last < 10 * 60000) return null;
  const candidates = (w.chars || [])
    .filter(c => c && !isHuman(w, c.id))
    .filter(c => { const note = noteOf(w, c.id); return !note || now() - (note.ts || 0) >= NOTE_REFRESH; })
    .map(c => ({ c, score: characterNoteActivityScore(w, c) }))
    .filter(row => row.score >= 8)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const bot = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].c;
  return mkAction("note", "due-note:" + bot.id + ":" + Math.floor(now() / 600000), { botId: bot.id }, "auto");
}

`;
replace('function planAutoAction(view) {', helper + 'function planAutoAction(view) {');
replace(
  '  const pending = findUnanswered(view);',
  '  const dueNote = dueAutonomousNoteAction(view);\n  if (dueNote) return dueNote;\n\n  const pending = findUnanswered(view);'
);
replace(
  '        simMarkRunning(n, action);',
  '        simMarkRunning(n, action);\n        if (action && action.type === "note") ensureSimState(n).noteAttemptAt = now();'
);

replace(
  'const BUILD_VERSION = "v99-performance-canon-cache-feed-tree";',
  'const BUILD_VERSION = "v99-social-runtime-reliability-20260929c";'
);

fs.writeFileSync(path, source);
console.log('Applied social runtime reliability v3.');
