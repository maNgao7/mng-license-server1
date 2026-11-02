'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const before = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const samples = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function restore() {
  await q.send('auto-play', {enabled: false}); await q.send('reset');
  await q.send('crowd-settings', {timed: before.TimedMode});
  await q.send('blood-enabled', {enabled: before.BloodEnabled});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
}
async function main() {
  await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('reset'); await q.send('crowd-settings', {timed: false});
  await q.send('blood-enabled', {enabled: false});
  await q.send('view', {x: 0, z: 0, yaw: 0, pitch: 0});
  await q.send('auto-fixture', {level: 0, count: 30, distance: 5});
  const start = q.state().autoAttacks;
  await q.send('auto-play', {enabled: true});
  for (let i = 0; i < 24; i++) {
    await q.send('auto-probe');
    const p = JSON.parse(fs.readFileSync('auto-probe.json', 'utf8'));
    const s = await q.send('capture');
    assert.equal(s.autoError, ''); assert.equal(s.failed, false);
    samples.push({file: `capture-${s.seq}.png`, position: s.position, moving: s.autoMoving,
      attacks: s.autoAttacks - start, kills: s.Kills, ...p});
    await sleep(130);
  }
  const positions = samples.map(s => s.position);
  const distance = positions.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - positions[i-1].x, p.z - positions[i-1].z) : 0, 0);
  assert.ok(distance > 4, 'The player must travel between targets, not stand still');
  assert.ok(samples.at(-1).autoTargetChanges > samples[0].autoTargetChanges + 3, 'Target variety');
  assert.ok(samples.at(-1).attacks > 6, 'Multiple real bat swings');
  const swings = samples.filter(s => s.animationHash === 545311466);
  assert.ok(swings.length >= 3, 'The native BaseballBat state, not an idle/clip name, must actually play');
  assert.ok(swings.some(s => s.animationTime > .05 && s.animationTime < .85), 'An attack animation must advance');
  assert.ok(Math.max(...swings.map(s => s.animationTime)) - Math.min(...swings.map(s => s.animationTime)) > .25,
    'Bat wind-up and follow-through must progress across frames');
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), before);
  fs.writeFileSync('auto-motion-result.json', JSON.stringify({passed: true, distance, samples}, null, 2));
  console.log(JSON.stringify({passed: true, distance, attacks: samples.at(-1).attacks,
    targetChanges: samples.at(-1).autoTargetChanges - samples[0].autoTargetChanges,
    hashes: [...new Set(samples.map(s => s.animationHash))]}));
}
main().catch(async error => {
  try { await restore(); } catch {}
  fs.writeFileSync('auto-motion-result.json', JSON.stringify({passed: false, error: error.stack, samples}, null, 2));
  console.error(error); process.exitCode = 1;
});
