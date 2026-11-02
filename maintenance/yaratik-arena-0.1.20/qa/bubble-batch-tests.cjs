'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const before = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const captures = [], checks = [];
function healthy(s) {
  assert.equal(s.failed, false);
  for (const key of ['autoError', 'hudError', 'missionBoardError']) assert.equal(s[key], '', key);
}
async function fresh() {
  await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('native-resume'); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('reset');
  await q.send('crowd-settings', {timed: true, total: 2500, physical: 2500, seconds: 3600, target: 10000});
  await q.send('blood-enabled', {enabled: false});
  await q.send('view', {x: 0, z: 0, yaw: 0, pitch: 0});
}
async function snap(label) {
  const s = await q.send('capture'); healthy(s);
  captures.push({label, file: `capture-${s.seq}.png`}); return s;
}
function overlap(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
async function restore() {
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('reset');
  await q.send('crowd-settings', {timed: before.TimedMode, total: before.MaxCreatures, physical: before.PhysicalCreatures,
    seconds: before.RoundSeconds, target: before.KillTarget, winGoal: before.WinGoal});
  await q.send('blood-enabled', {enabled: before.BloodEnabled});
  await q.send('resolution', {width: 1280, height: 720});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
}
async function main() {
  await q.wait(s => s.ready && s.version === '0.1.13', 'new native build startup', 45000);
  for (const [width, height] of [[1280,720],[800,600]]) {
    await fresh(); await q.send('resolution', {width, height});
    await q.send('auto-fixture', {level: 0, count: 12, distance: 5}); await q.send('kill', {count: 12});
    await q.send('gift', {id: '5655', repeatCount: 2, user: 'qa_bubble_long_viewer_name'});
    await sleep(300);
    const s = await snap('bottom-speech-bubbles-' + width);
    assert.equal(s.comboDrawn, true); assert.equal(s.giftNoticeDrawn, true);
    const center = {x: width / 2 - 12, y: height / 2 - 12, width: 24, height: 24};
    // Native canvas scales this original HUD; use its observed bounds at each captured resolution.
    const stamina = width === 800 ? {x: 24, y: height - 82, width: 244, height: 70}
      : {x: 32, y: height - 92, width: 288, height: 74};
    for (const rect of [s.comboBounds, s.giftNoticeBounds]) {
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height);
      assert.ok(rect.y > height / 2);
      assert.equal(overlap(rect, center), false, 'Crosshair stays clear');
      assert.equal(overlap(rect, stamina), false, 'Stamina stays clear');
    }
    assert.equal(overlap(s.comboBounds, s.giftNoticeBounds), false);
    await sleep(4100); await q.send('audio-probe');
    assert.equal(q.state().comboDrawn, false); assert.equal(q.state().giftNoticeDrawn, false);
  }
  checks.push('Both bottom speech bubbles render without crosshair/stamina overlap at 800x600 and 1280x720 and disappear on schedule');
  await fresh(); await q.send('resolution', {width: 1280, height: 720});
  await q.send('auto-fixture', {level: 0, count: 3, distance: 4});
  const attacks = q.state().autoAttacks, started = Date.now();
  await q.send('auto-play', {enabled: true}); await sleep(200); await q.send('audio-probe');
  assert.equal(q.state().challenge.phase, 'Active');
  await q.wait(s => s.autoAttacks > attacks || s.autoError || s.failed, 'immediate real bat attack', 5000);
  healthy(q.state());
  assert.ok(Date.now() - started < 5000);
  const firstAttackMs = Date.now() - started;
  checks.push('Automatic play starts the timed task immediately and makes a genuine native attack without ten seconds of preparation');
  await fresh(); await q.send('auto-fixture', {level: 0, count: 1, distance: 4});
  await q.send('challenge-start'); assert.equal(q.state().challenge.phase, 'Preparing');
  await q.send('auto-play', {enabled: true}); await sleep(250); await q.send('audio-probe');
  assert.equal(q.state().challenge.phase, 'Active');
  checks.push('Enabling automatic play also skips an already-running preparation');

  await fresh(); await q.send('spawn', {count: 99, user: 'qa_batch'});
  await q.wait(s => s.Alive === 99 && s.pending === 0 || s.failed, '99 native creatures spawned', 25000);
  await q.send('kill', {count: 99});
  const collected = q.state().vacuumCollected;
  await q.send('auto-play', {enabled: true}); await sleep(2200); await q.send('audio-probe');
  assert.equal(q.state().bodies, 99); assert.equal(q.state().vacuumCollected, collected);
  assert.equal(q.state().autoVacuumBatchActive, false);
  assert.equal(q.state().Collected, 0); assert.equal(q.state().level, 0); assert.equal(q.state().Progress, 0);
  await snap('99-corpses-no-automatic-vacuum');
  await q.send('auto-fixture', {level: 0, count: 1, distance: 5}); await q.send('kill', {count: 1});
  await q.wait(s => s.autoVacuumBatchActive || s.failed || s.autoError, 'hundredth corpse triggers batch', 5000);
  healthy(q.state());
  await snap('hundredth-corpse-starts-vacuum');
  const end = Date.now() + 160000;
  let nextLock = Date.now() + 25000, nextProgress = Date.now() + 15000;
  while (Date.now() < end && q.state().vacuumCollected < collected + 100) {
    healthy(q.state());
    if (Date.now() > nextLock) {
      await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true}); nextLock = Date.now() + 25000;
    }
    if (Date.now() > nextProgress) {
      console.log(JSON.stringify({collected: q.state().vacuumCollected - collected, bodies: q.state().bodies, status: q.state().autoStatus}));
      nextProgress = Date.now() + 15000;
    }
    await sleep(200);
  }
  await q.send('audio-probe');
  assert.equal(q.state().vacuumCollected - collected, 100, 'The entire hundred-body batch must be physically vacuumed');
  assert.equal(q.state().bodies, 0);
  assert.equal(q.state().highlights.Collected, 100);
  assert.equal(q.state().Collected, 100);
  assert.equal(q.state().level, 1); assert.equal(q.state().Progress, 50); assert.equal(q.state().RequiredCollections, 60);
  assert.equal(q.state().cleanupDrawn, false); assert.equal(q.state().highlights.CleanupEnabled, false);
  await q.send('auto-fixture', {level: 0, count: 2, distance: 5});
  const afterCleanupAttacks = q.state().autoAttacks;
  await q.wait(s => s.autoAttacks > afterCleanupAttacks || s.autoError || s.failed, 'combat resumes after full cleanup', 8000);
  healthy(q.state());
  checks.push('99 native corpses remain untouched; the hundredth starts suction; the full batch is physically collected before combat resumes');

  await fresh(); const manualCollected = q.state().vacuumCollected;
  await q.send('vacuum-hold', {distance: 5});
  await q.wait(s => s.vacuumCollected > manualCollected || s.failed, 'manual vacuum still collects under one hundred bodies', 12000);
  healthy(q.state());
  checks.push('Manual vacuum remains independent of the one-hundred-body automatic threshold');
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), before);
  fs.writeFileSync('bubble-batch-result.json', JSON.stringify({passed: true, firstAttackMs, checks, captures}, null, 2));
  console.log(JSON.stringify({passed: true, firstAttackMs, checks, captures}));
}
main().catch(async error => {
  const state = q.state(); try { await restore(); } catch {}
  fs.writeFileSync('bubble-batch-result.json', JSON.stringify({passed: false, checks, captures, error: error.stack, state}, null, 2));
  console.error(error); process.exitCode = 1;
});
