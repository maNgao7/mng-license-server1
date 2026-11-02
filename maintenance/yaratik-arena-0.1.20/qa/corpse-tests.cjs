'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const settingsBefore = fs.readFileSync('../userdata/mod-settings.json', 'utf8');
const original = JSON.parse(settingsBefore);

async function restore() {
  await q.send('crowd-settings', {
    total: original.MaxCreatures, physical: original.PhysicalCreatures,
    timed: original.TimedMode, seconds: original.RoundSeconds
  });
  await q.send('menu', { open: false });
  await q.send('reset');
  await q.send('lock', { enabled: false });
  await q.send('live-events-pause', { enabled: false });
}

async function main() {
  assert.equal(q.state().version, '0.1.10');
  await q.send('live-events-pause', { enabled: true });
  await q.send('lock', { enabled: true });
  await q.send('native-resume');
  await q.send('menu', { open: false });
  await q.send('reset');
  await q.send('crowd-settings', { total: 1000000, physical: 180, timed: false });
  await q.send('view', { x: 10, z: -8, yaw: -55, pitch: 12 });
  await q.send('spawn', { count: 91, user: 'qa_corpse_retention' });
  await q.wait(s => s.Alive === 91 && s.pending === 0, 'Native wave');
  await q.send('kill', { count: 90 });
  const dead = await q.wait(s => s.bodies === 90 && s.Alive === 1, 'Ninety native bodies');
  const ids = new Set(dead.bodyIds);
  await sleep(5000);
  let state = q.state();
  assert.equal(state.bodies, 90);
  assert.equal(state.activeBodies, 90);
  assert.deepEqual(new Set(state.bodyIds), ids);
  assert.equal(state.bodyLifetime, 'vacuum-only');
  checks.push('Ninety original native bodies stay active beyond the previous 64-body and two-second cleanup limits');

  const rescued = state.outOfBoundsBodies;
  await q.send('body-fall');
  state = await q.wait(s => s.outOfBoundsBodies > rescued, 'Fallen body returns to the floor');
  assert.equal(state.bodies, 90);
  assert.deepEqual(new Set(state.bodyIds), ids);
  assert.ok(state.vacuumDiagnostics.bodies.every(b => b.center.y > -1));
  checks.push('An out-of-bounds corpse returns to the floor without removal, respawn or an additional kill');

  const round = state.Round;
  await q.send('kill', { count: 1 });
  state = await q.wait(s => s.Round > round && !s.Won, 'Automatic winner and next round', 19000);
  assert.equal(state.Alive, 0);
  assert.equal(state.Kills, 0);
  assert.equal(state.bodies, 91);
  assert.equal(state.activeBodies, 91);
  for (const id of ids) assert.ok(state.bodyIds.includes(id));
  checks.push('WINNER and the automatic next round preserve every corpse and reset only live participation and kill progress');

  const beforeNewWave = new Set(state.bodyIds);
  await q.send('spawn', { count: 10, user: 'qa_fresh_wave' });
  state = await q.wait(s => s.Alive === 10 && s.pending === 0, 'New round wave beside old bodies');
  assert.equal(state.bodies, 91);
  assert.equal(state.Kills, 0);
  assert.deepEqual(new Set(state.bodyIds), beforeNewWave);
  checks.push('New waves do not reuse old corpses as living creatures or count their deaths again');

  await q.send('round-reset');
  assert.equal(q.state().bodies, 91);
  assert.equal(q.state().activeBodies, 91);
  await q.send('crowd-settings', { timed: true, seconds: 1 });
  const timedRound = q.state().Round;
  await q.send('spawn', { count: 1, user: 'qa_timed_body_retention' });
  await q.send('challenge-start');
  await q.wait(s => s.roundTimedOut, 'Timed round end', 15000);
  state = await q.wait(s => s.Round > timedRound && !s.roundTimedOut, 'Timed next round', 7000);
  assert.equal(state.bodies, 91);
  assert.equal(state.activeBodies, 91);
  assert.equal(state.Alive, 0);
  checks.push('Manual new-round and timed-round transitions also leave accumulated bodies untouched');

  await q.send('crowd-settings', { timed: false });
  await q.send('spawn', { count: 10, user: 'qa_vacuum_retention' });
  await q.wait(s => s.Alive === 10, 'Live creatures during vacuum cleanup');
  const beforeVacuum = q.state();
  await q.send('vacuum-hold', { distance: 8 });
  await q.wait(s => s.vacuumCollected > beforeVacuum.vacuumCollected, 'Native vacuum removes a body', 10000);
  await sleep(8500);
  state = q.state();
  const collected = state.vacuumCollected - beforeVacuum.vacuumCollected;
  assert.equal(state.bodies, beforeVacuum.bodies + 1 - collected);
  assert.equal(state.Kills, beforeVacuum.Kills + 1);
  assert.equal(state.Alive, 10);
  assert.equal(state.vacuumStored, 0);
  assert.equal(state.activeBodies, state.bodies);
  assert.equal(state.failed, false);
  assert.equal(state.hudError, '');
  checks.push('Only native vacuum collection removes bodies; it does not damage living creatures or count old deaths again');
  const capture = (await q.send('capture')).seq;
  await restore();
  assert.equal(fs.readFileSync('../userdata/mod-settings.json', 'utf8'), settingsBefore);
  const result = { passed: true, checks, capture, bodiesTested: 91, vacuumCollected: collected, settingsUnchanged: true };
  fs.writeFileSync('corpse-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}

main().catch(async error => {
  fs.writeFileSync('corpse-result.json', JSON.stringify({ passed: false, checks, error: error.stack }, null, 2));
  try { await restore(); } catch {}
  console.error(error);
  process.exitCode = 1;
});
