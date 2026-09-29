import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const funcs = new Map(ast.program.body.filter(n => n.type === 'FunctionDeclaration').map(n => [n.id.name, source.slice(n.start, n.end)]));
function load(names, globals = {}) {
  const context = vm.createContext({ ...globals });
  vm.runInContext(names.map(n => { assert.ok(funcs.has(n), n); return funcs.get(n); }).join('\n'), context);
  return context;
}
const t = 10_000_000;
const characters = [{ id: 'obsessed', personality: 'obsessed possessive' }, { id: 'secure', personality: 'secure calm friendly' }];
const world = () => ({ meId: 'me', chars: characters, notes: [], socialEvents: [], sim: { queue: [], liveWorldStartedAt: t - 20 * 60000 } });
const base = {
  now: () => t,
  isHuman: (_, id) => id === 'me',
  charById: (w, id) => w.chars.find(c => c.id === id),
  getRel: () => ({}),
  relationshipObsessionLevel: () => 0,
  characterLoreCorpus: c => c.personality,
  ensureSimState: w => w.sim,
  isFollowing: (w, a, b) => !!w.follows?.includes(`${a}:${b}`),
  worldLanguage: () => 'en',
};
test('Notes await output and track every evaluated actor, including silent ones', async () => {
  const c = load(['genNoteReact'], {
    ...base, pickNoteReactionCast: () => characters, worldContext: () => '', engineFor: () => '',
    voiceCard: () => '', characterMemoryCard: () => '', TAIL: '',
    askWorldJSON: async () => ({ reacts: [], dms: [] }),
  });
  const out = await c.genNoteReact({ ...world(), player: { name: 'Player' } }, { authorId: 'me' });
  assert.deepEqual(Array.from(out.__castIds), ['obsessed', 'secure']);
});
test('Notes with no remaining cast do not call AI', async () => {
  const c = load(['genNoteReact'], { pickNoteReactionCast: () => [], askWorldJSON: () => assert.fail('unexpected AI') });
  const out = await c.genNoteReact(world(), {});
  assert.equal(out.__castIds.length, 0);
});
test('Queue skips delayed follow-back complaint and runs ready reactions', () => {
  const c = load(['simPeek'], base);
  const w = world();
  w.sim.queue = [{ id: 'later', notBefore: t + 10000 }, { id: 'note', type: 'note-react' }];
  assert.equal(c.simPeek(w).id, 'note');
  w.sim.queue[0].notBefore = t - 1;
  assert.equal(c.simPeek(w).id, 'later');
});
test('Follow DMs require personality and current follow truth', () => {
  const c = load(['personalityFollowDmSensitivity', 'personalityFollowDmPromptContext'], base);
  const w = world();
  w.follows = ['me:obsessed'];
  assert.equal(c.personalityFollowDmSensitivity(w, 'secure', 'me'), 0);
  assert.equal(c.personalityFollowDmSensitivity(w, 'obsessed', 'me'), 4);
  const context = { trigger: 'follow-social-signal', followSignal: 'player-unfollowed-you' };
  assert.equal(c.personalityFollowDmPromptContext(w, characters[0], context), '');
  w.follows = [];
  assert.match(c.personalityFollowDmPromptContext(w, characters[0], context), /just unfollowed/);
  context.followSignal = 'you-follow-player-no-followback';
  assert.equal(c.personalityFollowDmPromptContext(w, characters[0], context), '');
  w.follows = ['obsessed:me'];
  assert.match(c.personalityFollowDmPromptContext(w, characters[0], context), /not following you back/);
  w.follows.push('me:obsessed');
  assert.equal(c.personalityFollowDmPromptContext(w, characters[0], context), '');
});
test('Follow-back complaint is delayed; secure characters never enqueue one', () => {
  const c = load(['personalityFollowDmSensitivity', 'maybeQueuePersonalityFollowDm'], {
    ...base, Math: { ...Math, random: () => 0, floor: Math.floor },
    rememberAboutTarget: () => {}, recordCharacterAgentPerception: () => {},
    mkAction: (type, key, payload, origin) => ({ type, key, payload, source: origin }),
    simEnqueue: (w, action) => { w.sim.queue.push(action); return true; },
  });
  const w = world(); w.follows = ['obsessed:me', 'secure:me'];
  assert.equal(c.maybeQueuePersonalityFollowDm(w, 'secure', 'me', 'you-follow-player-no-followback'), false);
  assert.equal(c.maybeQueuePersonalityFollowDm(w, 'obsessed', 'me', 'you-follow-player-no-followback'), true);
  assert.equal(w.sim.queue.length, 1);
  assert.equal(w.sim.queue[0].notBefore, t + 600000);
});
test('Background cost spacing reflects large prompts, not an 18-second ceiling', () => {
  const c = load(['estimatedAiRequestTokens', 'aiCostGapFor'], { AI: { targetTokensPerMinute: 60000 } });
  assert.ok(c.aiCostGapFor('s'.repeat(33452), 'p'.repeat(52000), 1200) > 30000);
});
test('Own-note lane gets an opportunity without forcing quiet characters', () => {
  const c = load(['dueAutonomousNoteAction'], {
    ...base, noteOf: () => null, NOTE_REFRESH: 3600000,
    characterNoteActivityScore: (_, c) => c.id === 'obsessed' ? 12 : 1,
    mkAction: (type, key, payload) => ({ type, key, payload }),
  });
  const w = world();
  assert.equal(c.dueAutonomousNoteAction(w).type, 'note');
  w.sim.noteAttemptAt = t - 1000;
  assert.equal(c.dueAutonomousNoteAction(w), null);
  w.sim.noteAttemptAt = 0; w.chars = [characters[1]];
  assert.equal(c.dueAutonomousNoteAction(w), null);
});
test('Semantic helper uses fallback during cooldown without any provider call', async () => {
  const c = load(['analyzeSocialPostMeaning'], { cooldownLeft: () => 60000, fallbackSocialPostMeaning: () => ({ fallback: true }) });
  assert.equal((await c.analyzeSocialPostMeaning(world(), {})).fallback, true);
});
test('Background busy request releases worker immediately and preserves error', async () => {
  const error = Object.assign(new Error('busy'), { busy: true });
  const c = load(['askJSON'], {
    AI: { pending: 0 }, queued: async fn => fn(), asLang: x => x,
    languageInstruction: () => '', callClaude: async () => { throw error; },
    wait: () => assert.fail('background work must not sleep inside worker'),
  });
  await assert.rejects(c.askJSON('', '', { language: 'en', priority: 0 }), e => e === error);
  assert.equal(c.AI.pending, 0);
});
test('Silent evaluated cast is persisted so subsequent Note rounds advance', () => {
  const c = load(['applyNotePerceptionImpact'], { ...base, applyChanges: () => {}, safeAiChanges: () => [] });
  const w = world(); const note = { id: 'note', authorId: 'me' };
  c.applyNotePerceptionImpact(w, note, { __castIds: ['obsessed', 'secure'], reacts: [], dms: [], perceptions: [], changes: [] });
  assert.deepEqual(Array.from(note.processedBy), ['obsessed', 'secure']);
});
test('Expired notes cannot consume another provider request', async () => {
  const c = load(['runSimulationAction'], { ...base, NOTE_LIFE: 24 * 3600000, genNoteReact: () => assert.fail('expired note called AI') });
  const w = world(); w.notes = [{ id: 'old', authorId: 'me', ts: t - 25 * 3600000 }];
  assert.equal(await c.runSimulationAction(w, fn => fn(w), { type: 'note-react', payload: { noteId: 'old' } }), null);
});
