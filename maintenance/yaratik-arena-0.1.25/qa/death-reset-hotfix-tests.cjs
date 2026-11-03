'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const q = require('./commands.cjs');

const root = path.resolve(process.env.TIKMNG_ARENA_QA_ROOT || __dirname);
const settingsFile = path.join(root, '../userdata/mod-settings.json');
const checks = [], measurements = [], captures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const settingsHash = () => crypto.createHash('sha256').update(fs.readFileSync(settingsFile)).digest('hex');
let original;

function healthy(s) {
  assert.equal(s.failed, false);
  for (const key of ['hudError', 'survivalError', 'combatNavigationError', 'autoError']) assert.equal(s[key], '', key);
}

async function observe(predicate, label, timeout = 20000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const s = await q.send('report');
    healthy(s);
    if (predicate(s)) return s;
    await sleep(50);
  }
  throw new Error(label);
}

async function fresh() {
  await q.send('menu', { open: false });
  await q.send('lock', { enabled: true });
  await q.send('live-events-pause', { enabled: true });
  await q.send('auto-play', { enabled: false });
  await q.send('reset');
  await q.send('combat-settings', { enabled: false, playerHealth: 1, damage: 1, interval: .5 });
  await q.send('crowd-settings', { timed: true, seconds: 3600, target: 10000, physical: 10 });
  await q.send('view', { x: 0, z: -10, yaw: 0, pitch: 0 });
}

async function snapshot(label) {
  const s = await q.send('capture');
  captures.push({ label, file: path.join(root, 'capture-' + s.seq + '.png') });
}

async function deathCase(kind, newEvents) {
  await fresh();
  for (let i = 0; i < 3; i++) await q.send('team-fixture', { kind: 'spawn', user: 'qa_old_body', x: 15 + i, z: 15 });
  await q.send('kill', { count: 3 });
  await q.send('vacuum-reference-fixture');
  let s = await q.send('report');
  assert.equal(s.bodies, 3, 'pre-existing corpses');
  assert.equal(s.vacuumStored, 1, 'held corpse is registered in native vacuum');
  assert.ok(s.vacuumInRange >= 1 && s.vacuumIgnored >= 1, 'all native vacuum reference sets populated');
  await q.send('team-fixture', { kind: 'helper', user: 'qa_old_helper', x: 19, z: 19 });
  for (let i = 0; i < 10; i++) await q.send('team-fixture', { kind: 'spawn', user: 'qa_old_live', x: -18 + i * .7, z: 16 });
  await q.send('spawn', { count: 30, user: 'qa_old_queue' });
  await q.send('up');
  await q.send('up');
  // Flash suppresses auto-aim/fire, not enemy attacks, so the real enemy can land the lethal blow.
  await q.send('effect-test', { effect: 'flash', count: 30 });
  await q.send('auto-play', { enabled: true });
  await q.send('team-fixture', { kind, user: 'qa_killer_' + kind, x: 0, z: kind === 'spawn' ? -8.4 : -6.8 });

  const unique = kind + '-' + Date.now();
  const voter = 'qa_next_like_' + kind;
  if (newEvents) await q.send('live-event-fixture', { event: { kind: 'like', username: voter, eventId: unique + '-like99', likeCount: 99 } });
  const cfg = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const beforeHash = settingsHash();
  const start = await q.send('report');
  assert.ok(start.pending >= 30 && start.helperCount > 0 && start.level === 2);
  await q.send('combat-settings', { enabled: true });
  const deathHash = settingsHash();
  const commandFile = path.join(root, '../userdata/live-command.json');
  const liveCommandBefore = fs.existsSync(commandFile) ? fs.readFileSync(commandFile, 'utf8') : null;
  s = await observe(s => s.roundDied, 'actual lethal ' + kind + ' attack', 18000);
  assert.equal(s.killedBy, 'qa_killer_' + kind, 'last real attacker owns defeat profile');
  assert.equal(s.health, 0);
  assert.ok(s.autoPlaying, 'auto-play remains requested during defeat');
  const round = s.Round, resets = s.deathRoundResets;
  const identity = { username: s.live.username, roomId: s.live.roomId, epoch: s.live.epoch };
  await observe(s => s.defeatDrawn, 'killer overlay is drawn before cleanup', 1500);
  await snapshot(kind + '-killer-profile-before-reset');

  const expectedUsers = new Set();
  let expectedCount = 0;
  const gift = { kind: 'gift', username: 'qa_next_gift_' + kind, giftId: '5655', eventId: unique + '-gift', repeatCount: 1 };
  if (newEvents) {
    const giftCount = cfg.Actions.filter(a => a.Enabled !== false && a.GiftId === gift.giftId && a.Op === 'spawn').reduce((n, a) => n + a.Count, 0);
    assert.ok(giftCount > 0, 'mapped native gift fixture');
    await q.send('live-event-fixture', { event: gift });
    expectedCount += giftCount; expectedUsers.add(gift.username);
    await q.send('live-event-fixture', { event: { kind: 'like', username: voter, eventId: unique + '-like100', likeCount: 1 } });
    expectedCount += cfg.LikeAction.Count; expectedUsers.add(voter);
    const follower = 'qa_next_follow_' + kind;
    await q.send('live-event-fixture', { event: { kind: 'follow', username: follower, eventId: unique + '-follow' } });
    expectedCount += cfg.FollowAction.Count; expectedUsers.add(follower);
    await q.send('effect-test', { effect: 'up', count: 1 });
    s = await q.send('report');
    assert.equal(s.queuedRoundCreatures, expectedCount, 'result-screen gift/100th like/follow kept for next round only');
    assert.equal(s.nextRoundWeaponLevel, 1, 'new result-screen weapon gift kept');
  }
  // A cage during the result must also disappear, without touching incoming spawn batches.
  await q.send('effect-test', { effect: 'prison', count: 30 });
  s = await observe(s => s.Round === round + 1 && !s.roundDied, 'automatic fresh round after defeat', 12000);
  await q.send('menu', { open: true });
  s = await q.send('report');
  assert.equal(s.deathRoundResets, resets + 1);
  assert.equal(s.lastResetActiveRemainders, 0, 'all returned native creatures inactive');
  assert.ok(s.lastResetCreatures >= 15 && s.lastResetBodies >= 3, 'live creatures, corpses and helpers actually removed');
  for (const key of ['bodies', 'activeBodies', 'helperCount', 'vacuumStored', 'vacuumInRange', 'vacuumIgnored', 'Kills', 'Collected', 'Progress', 'queuedRoundCreatures', 'nextRoundWeaponLevel']) assert.equal(s[key], 0, key);
  assert.equal(s.health, s.maxHealth, 'full health on fresh round');
  assert.equal(s.level, newEvents ? 1 : 0, 'only new-round weapon gift survives');
  assert.equal(s.logicalAlive, expectedCount, 'old spawn queue discarded and new result queue preserved exactly');
  assert.equal(s.FlashSeconds, 0); assert.equal(s.PrisonSeconds, 0);
  assert.equal(s.flashIntroQueued, false);
  assert.equal(s.killedBy, '');
  assert.equal(s.autoPlaying, true, 'auto-play resumes after defeat');
  assert.equal(s.autoVacuumBatchActive, false);
  if (!newEvents) assert.equal(s.autoTargetAlive, false, 'An empty fresh round cannot retain an auto target');
  assert.equal(s.creaturePointerCount, s.profiles);
  for (const c of s.combatTestBodies) assert.ok(expectedUsers.has(c.Username), 'no old-round creature survives: ' + c.Username);
  if (!newEvents) for (const key of ['profiles', 'creaturePointerCount', 'arenaPathCacheCount', 'crowdMotionCacheCount']) assert.equal(s[key], 0, key);
  assert.deepEqual({ username: s.live.username, roomId: s.live.roomId, epoch: s.live.epoch }, identity, 'live room identity retained');
  assert.equal(fs.existsSync(commandFile) ? fs.readFileSync(commandFile, 'utf8') : null, liveCommandBefore, 'reset sends no disconnect or reconnect');
  assert.equal(settingsHash(), deathHash, 'automatic death reset does not rewrite saved settings');
  assert.notEqual(beforeHash, deathHash, 'test enables attacks explicitly before observing settings preservation');
  await snapshot(kind + '-fresh-arena-after-reset');
  if (newEvents) {
    const applied = s.liveApplied;
    await q.send('live-event-fixture', { event: gift });
    s = await q.send('report');
    assert.equal(s.liveApplied, applied, 'old gift replay remains deduplicated across reset');
    assert.equal(s.logicalAlive, expectedCount);
  }
  measurements.push({ kind, newEvents, clearedCreatures: s.lastResetCreatures, clearedBodies: s.lastResetBodies, incoming: expectedCount, liveConnected: s.live.status === 'connected' });
  checks.push(kind + ': native lethal hit, killer overlay, complete automatic cleanup, saved settings and live room identity retained' + (newEvents ? ', result-screen gifts/likes/follows kept exactly once' : ''));
}

async function ordinaryRoundStillKeepsBodies() {
  await fresh();
  await q.send('team-fixture', { kind: 'spawn', user: 'qa_collectable', x: 0, z: -5 });
  await q.send('kill', { count: 1 });
  const before = await q.send('report');
  await q.send('round-reset');
  const after = await q.send('report');
  assert.equal(after.bodies, 1, 'non-defeat round transition must preserve vacuum collection');
  assert.deepEqual(after.bodyIds, before.bodyIds);
  assert.equal(after.deathRoundResets, before.deathRoundResets);
  checks.push('Ordinary round reset still preserves collectable bodies; defeat cleanup is targeted');
}

async function restore() {
  if (!original) return;
  await q.send('menu', { open: false });
  await q.send('auto-play', { enabled: false });
  await q.send('reset');
  await q.send('combat-settings', { enabled: original.EnemyAttacks, playerHealth: original.PlayerHealth, damage: original.CreatureDamage, interval: original.CreatureAttackInterval });
  await q.send('crowd-settings', { physical: original.PhysicalCreatures, timed: original.TimedMode, seconds: original.RoundSeconds, target: original.KillTarget, winGoal: original.WinGoal });
  await q.send('reset');
  await q.send('live-events-pause', { enabled: false });
  await q.send('lock', { enabled: false });
}

async function main() {
  assert.ok(process.env.TIKMNG_ARENA_QA_ROOT, 'Use an isolated installed test root, never the user prototype');
  assert.notEqual(root.toLowerCase(), path.resolve(__dirname).toLowerCase(), 'Never run destructive fixtures in the user prototype');
  await q.wait(s => s.ready && s.version === (process.env.TIKMNG_QA_VERSION || '0.1.21') && Date.now() - fs.statSync(path.join(root, 'state.json')).mtimeMs < 2500, 'fresh hotfix process', 40000);
  original = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.equal(original.LikeThreshold, 100);
  assert.equal(original.LikeAction.Op, 'spawn'); assert.equal(original.LikeAction.Enabled, true);
  assert.equal(original.FollowAction.Op, 'spawn'); assert.equal(original.FollowAction.Enabled, true);
  await deathCase('spawn', false);
  await deathCase('boss', true);
  await ordinaryRoundStillKeepsBodies();
}

main().then(() => ({ passed: true, checks, measurements, captures }))
  .catch(error => { process.exitCode = 1; return { passed: false, error: error.stack, checks, measurements, captures, state: q.state() }; })
  .then(async result => {
    try { await restore(); } catch (error) { result.restoreError = error.stack; result.passed = false; process.exitCode = 1; }
    fs.writeFileSync(path.join(root, 'death-reset-hotfix-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  });
