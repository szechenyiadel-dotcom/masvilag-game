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

/* Do NOT rewrite AI pacing/backoff here. Network resilience owns provider pacing.
   The previous runtime patch stacked a second 120-second throttle on top of it,
   which is what made the social world appear dead. */

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
   normal AI retry handler even if a previous background request opened cooldown. */
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

/* Keep the stale-lock recovery from the original scheduler. Add only rejected
   promise containment and guaranteed cleanup for the invocation that owns it. */
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

/* The player-post comment lane is hard coverage, not an optional wave. */
replace(
  '    const isGuaranteedCoverage = commentTrigger === "guaranteed-coverage";',
  '    const isGuaranteedCoverage = commentTrigger === "guaranteed-coverage" || commentTrigger === "player-post";'
);

/* Mark quota output so applyComments can use a narrow last-resort acceptance path
   only for guaranteed player/post coverage. The text still comes from the AI and
   still passes actor, ownership, sanitation and direct-address guards. */
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

/* Normal comment validation stays authoritative. Only if it rejected every
   generated line for a guaranteed post do we accept one already-generated AI
   line through a narrower rescue path. This prevents a successful provider call
   from becoming an invisible no-op. */
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

/* If even the rescue had no usable AI line, do not silently drop the coverage
   action. Mark the post and throw a retryable scheduler error; the queue recovery
   patch keeps the exact action alive instead of pretending it succeeded. */
section('    const commentsProbe =', '    update((n) => {', s => {
  const old = `    if (!visibleReactionCount) {
      if (isGuaranteedCoverage) {
        update((n) => {
          const failedPost = (n.posts || []).find((row) => row && row.id === post.id);
          if (!failedPost) return;
          failedPost.commentCoverageAttemptAt = now();
          failedPost.commentCoverageAttempts =
            Math.max(0, Math.round(Number(failedPost.commentCoverageAttempts) || 0)) + 1;
        });
      }
      return null;
    }

`;
  const next = `    if (!visibleReactionCount) {
      if (isGuaranteedCoverage) {
        update((n) => {
          const failedPost = (n.posts || []).find((row) => row && row.id === post.id);
          if (!failedPost) return;
          failedPost.commentCoverageAttemptAt = now();
          failedPost.commentCoverageAttempts =
            Math.max(0, Math.round(Number(failedPost.commentCoverageAttempts) || 0)) + 1;
        });
        const err = new Error("Guaranteed post comment produced no visible AI line");
        err.busy = true;
        err.retryable = true;
        throw err;
      }
      return null;
    }

`;
  if (!s.includes(old)) throw new Error('Empty-comment retry anchor changed');
  return s.replace(old, next);
});

/* Retryable/background errors keep their action. Add a short notBefore to
   coverage work so an invalid provider response cannot spin every 9 seconds. */
replace(
  '        busyFailure = Boolean(e && e.busy);',
  '        busyFailure = Boolean(e && (e.busy || /időben|hálózat|fetch|network|timeout/i.test(e.message || "")));'
);
section('        if (busyFailure) {', '        if (\n          queued &&', s => {
  const old = `          if (!(queued && action && queued.id === action.id) && action) {
            simEnqueue(n, action);
          }
          return;`;
  const next = `          if (queued && action && queued.id === action.id && action.source === "coverage") {
            const same = sim.queue.find((row) => row && row.id === action.id);
            if (same) same.notBefore = now() + GUARANTEED_POST_COMMENT_RETRY_MS;
          }
          if (!(queued && action && queued.id === action.id) && action) {
            if (action.source === "coverage") action.notBefore = now() + GUARANTEED_POST_COMMENT_RETRY_MS;
            simEnqueue(n, action);
          }
          return;`;
  if (!s.includes(old)) throw new Error('Busy queue preservation anchor changed');
  return s.replace(old, next);
});

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
