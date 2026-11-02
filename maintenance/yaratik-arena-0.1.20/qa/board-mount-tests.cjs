'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const checks = [], captures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let mount;

async function view(x, z, target) {
  const dx = target.x - x, dz = target.z - z, dy = target.y - 1.8;
  await q.send('view', {x, z, yaw: Math.atan2(dx, dz) * 180 / Math.PI,
    pitch: -Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI});
  await sleep(450);
}

async function aim(id, x = 10) {
  const control = q.state().boardControls.find(c => c.Id === id);
  assert.ok(control, id);
  await view(x, 0, {x: mount.board.x, y: mount.board.y + control.y * mount.board.scale,
    z: mount.board.z - control.x * mount.board.scale});
  await q.send('board-mount-probe');
  assert.equal(q.state().boardRay.collider, 'TikMnG_Mission_Board', id);
  assert.equal(q.state().boardRay.control, id);
}

async function capture(label) {
  const state = await q.send('capture');
  captures.push({label, file: `capture-${state.seq}.png`});
}

async function restore() {
  await q.send('round-reset');
  await q.send('crowd-settings', {total: original.MaxCreatures, physical: original.PhysicalCreatures,
    timed: original.TimedMode, seconds: original.RoundSeconds, target: original.KillTarget, winGoal: original.WinGoal});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false});
  await q.send('live-events-pause', {enabled: false});
}

async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.10'
    && Date.now() - fs.statSync('state.json').mtimeMs < 2000, 'fresh 0.1.10 startup', 45000);
  await q.send('lock', {enabled: true});
  await q.send('live-events-pause', {enabled: true});
  await q.send('native-resume');
  await q.send('menu', {open: false});
  await q.send('board-mount-probe');
  mount = JSON.parse(fs.readFileSync('board-mount-probe.json', 'utf8'));
  assert.ok(mount.wallGap > 0 && mount.wallGap <= .051);
  assert.ok(mount.board.x > 21.8);
  assert.equal(mount.pipeVisible, false);
  assert.equal(mount.housing, true);
  assert.equal(q.state().missionBoardError, '');
  checks.push('Display is within 5.1 cm of the measured wall; the old protruding pipe renderer is hidden');

  for (const [label, x, z] of [['front', 0, 0], ['left-edge', 19, -11], ['right-edge', 19, 11]]) {
    await view(x, z, {x: mount.board.x, y: 4.2, z: 0});
    await capture(label);
  }
  await q.send('crowd-settings', {timed: true});
  for (const control of q.state().boardControls.filter(c => c.Id !== 'pause')) await aim(control.Id);
  checks.push('All eleven waiting-state controls remain reachable by the real camera ray, with no pipe occlusion');

  for (const [up, down, field, amount] of [
    ['minute-up', 'minute-down', 'RoundSeconds', 60],
    ['second-up', 'second-down', 'RoundSeconds', 1],
    ['kills-up', 'kills-down', 'KillTarget', 100],
    ['wins-up', 'wins-down', 'WinGoal', 1]
  ]) {
    const before = q.state()[field];
    await aim(up); await q.send('board-click'); assert.equal(q.state()[field], before + amount);
    await aim(down); await q.send('board-click'); assert.equal(q.state()[field], before);
  }
  checks.push('Duration, kill target and win target buttons still change and save the correct values');

  await aim('start'); await q.send('board-click');
  assert.equal(q.state().challenge.phase, 'Preparing');
  await aim('pause'); await q.send('board-click');
  const frozen = q.state().challenge.remaining;
  assert.equal(q.state().challenge.IsPaused, true);
  await sleep(1200); await q.send('board-mount-probe');
  assert.equal(q.state().challenge.remaining, frozen);
  await q.send('challenge-start'); assert.equal(q.state().challenge.IsPaused, true);
  await q.send('board-click'); assert.equal(q.state().challenge.IsPaused, false);
  checks.push('Start, pause and resume still work on the mounted board without resetting the paused countdown');

  await q.send('round-reset'); await aim('start'); await q.send('board-bullet');
  assert.equal(q.state().challenge.phase, 'Preparing');
  const hits = q.state().boardWeaponHits;
  await q.send('round-reset'); await aim('start', mount.board.x - 2.1); await q.send('board-bat');
  await q.wait(s => s.challenge.phase === 'Preparing' && s.boardWeaponHits > hits, 'native bat start', 4000);
  checks.push('Native bullet impact and the native delayed bat swing still start the same challenge');

  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), original);
  assert.equal(q.state().failed, false); assert.equal(q.state().missionBoardError, '');
  assert.equal(q.state().hudError, '');
  checks.push('Existing gift mappings and every saved setting are unchanged; test locks are released');
  const result = {passed: true, version: '0.1.10', checks, captures, mount,
    settingsPreserved: true, nativeTests: true, realTikTokGiftDeliveryClaimed: false};
  fs.writeFileSync('board-mount-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({passed: true, checks, captures}));
}

main().catch(async error => {
  try { await restore(); } catch {}
  fs.writeFileSync('board-mount-result.json', JSON.stringify({passed: false, checks, captures, error: error.stack}, null, 2));
  console.error(error); process.exitCode = 1;
});
