'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], measurements = [], captures = [];
const before = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
function healthy(s) {
  assert.equal(s.failed, false);
  for (const key of ['survivalError', 'hudError', 'combatNavigationError', 'autoError']) assert.equal(s[key], '', key);
}
async function snap(label) {
  const s = await q.send('capture');
  fs.copyFileSync('capture-' + s.seq + '.png', 'pursuit-' + label + '.png'); captures.push('pursuit-' + label + '.png');
}
async function fresh() {
  await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
  await q.send('menu', { open: false }); await q.send('auto-play', { enabled: false }); await q.send('reset'); await q.send('reset');
  await q.send('combat-settings', { enabled: true, damage: 1, interval: 1.2 });
  await q.send('view', { x: 0, z: -10, yaw: 0, pitch: 0 });
}
(async () => {
  let error;
  try {
    for (const count of [180, 600]) {
      await fresh(); await q.send('spawn', { count, user: 'qa_pressure' });
      await q.wait(s => s.Alive === count && s.pending === 0, 'native crowd ' + count, 60000);
      await q.send('view', { x: -13, z: 12, yaw: 135, pitch: 0 });
      const samples = [];
      for (let i = 0; i < 12; i++) {
        await sleep(750); const s = await q.send('report'); healthy(s);
        samples.push({ seconds: (i + 1) * .75, player: s.playerPhysics, health: s.health, pursuit: s.pursuit,
          firstDistances: s.combatTestBodies.map(c => c.distance) });
      }
      const initial = samples[0], last = samples[samples.length - 1];
      const drift = Math.hypot(last.player.x + 13, last.player.z - 12);
      measurements.push({ count, drift, samples });
      assert.ok(samples.slice(0, 4).some(s => s.pursuit.moving / Math.max(1, s.pursuit.approaching) > .85), 'whole crowd keeps approaching');
      assert.ok(last.pursuit.noPath < Math.max(4, count * .08), 'new arrivals receive paths');
      assert.ok(last.firstDistances.reduce((a, b) => a + b, 0) < initial.firstDistances.reduce((a, b) => a + b, 0) * .65, 'pursuers close the gap');
      assert.ok(drift < 1.5, 'standing player is not driven away by the crowd: ' + drift);
      checks.push(count + ' creatures: pursuit continues after crossing the arena; no path starvation; limited player drift');
      await snap('crowd-' + count);
      await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
      await q.send('view', { x: 12, z: -12, yaw: -45, pitch: 0 });
      await sleep(1800); const redirected = await q.send('report'); healthy(redirected);
      assert.ok(redirected.pursuit.moving > count * .8, 'all rows follow second direction change');
      checks.push(count + ' creatures: rear rows also redirect toward the new player position');
      if (count === 600) {
        await q.send('performance', { label: 'preview-ammo-crowd-600', seconds: 5 });
        const performanceState = await q.wait(s => !s.performanceRunning && s.frameCount > 0, '600 creature frame sample', 15000);
        const performance = JSON.parse(fs.readFileSync('performance-' + performanceState.performanceRun + '.json'));
        fs.copyFileSync('performance-' + performanceState.performanceRun + '.json', 'pursuit-performance-600.json');
        assert.equal(performance.live, 600); healthy(performanceState);
        checks.push('600-creature frame timing recorded without game or navigation errors');
      }
    }
    await fresh(); await q.send('view', { x: 0, z: 0, yaw: 0, pitch: 0 });
    const idle = [];
    for (let i = 0; i < 8; i++) { await sleep(150); const s = await q.send('report'); idle.push(s.playerPhysics); }
    assert.ok(Math.max(...idle.map(p => p.y)) - Math.min(...idle.map(p => p.y)) < .01, 'idle standing body has no vertical oscillation');
    checks.push('idle standing capsule is stable and player interpolation is enabled');
    assert.equal(q.state().pursuit.playerInterpolation, 'Interpolate');
    await fresh(); await q.send('combat-fixture', { distance: 1.5, user: 'qa_collision_wall' });
    await q.wait(s => s.Alive === 1, 'wall fixture'); await q.send('combat-wall', { enabled: true });
    const wallHealth = q.state().health; await sleep(1500);
    assert.equal((await q.send('report')).health, wallHealth, 'world wall still blocks damage');
    await q.send('combat-wall', { enabled: false });
    await q.wait(s => s.health < wallHealth, 'normal attacks resume through open space', 8000);
    checks.push('disabling player/mob push does not bypass world walls or prevent real melee damage');
    await fresh(); await q.send('combat-fixture', { distance: 1.5, user: 'qa_collision_prison' });
    await q.wait(s => s.Alive === 1, 'prison fixture'); await q.send('effect-test', { effect: 'prison', count: 15 });
    await q.wait(s => s.cageActive && s.creaturesInCage === 0, 'cage exclusion');
    const prisonHealth = q.state().health;
    await q.send('prison-move'); await q.wait(s => !s.prisonMovementRunning && s.prisonMovementTravel > .5, 'prison movement', 6000);
    let prison = await q.send('report'); healthy(prison);
    assert.equal(prison.creaturesInCage, 0); assert.equal(prison.health, prisonHealth); assert.equal(prison.prisonMovementError, '');
    await q.send('effect-test', { effect: 'release', count: 3600 });
    await q.wait(s => !s.cageActive && s.health < prisonHealth, 'attack after cage release', 15000);
    checks.push('player moves inside cage, enemies remain outside, protection and attacks after release still work');
  } catch (failure) { error = failure.stack; process.exitCode = 1; }
  finally {
    try {
      await q.send('reset'); await q.send('reset');
      await q.send('combat-settings', { enabled: before.EnemyAttacks, damage: before.CreatureDamage, interval: before.CreatureAttackInterval });
      await q.send('lock', { enabled: false }); await q.send('live-events-pause', { enabled: false });
      assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), before);
    } catch (restoreError) { error = (error || '') + '\nRestore: ' + restoreError.stack; process.exitCode = 1; }
    const result = { passed: !error, timestamp: new Date().toISOString(), checks, measurements, captures, error };
    fs.writeFileSync('pursuit-result.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: result.passed, checks, measurements: measurements.map(m => ({ count: m.count, drift: m.drift, final: m.samples.at(-1).pursuit })), error }, null, 2));
  }
})();
