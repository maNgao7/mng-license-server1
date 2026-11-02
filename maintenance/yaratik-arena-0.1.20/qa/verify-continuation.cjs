'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const q = require('./commands.cjs');

async function main() {
  const old = JSON.parse(fs.readFileSync('continue-20261027/mod-settings-before.json', 'utf8'));
  const current = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
  for (const key of Object.keys(old))
    assert.deepEqual(key === 'Actions' ? current.Actions.slice(0, old.Actions.length) : current[key], old[key], 'Preserved original setting: ' + key);
  assert.equal(current.Actions.length, old.Actions.length + 3);
  for (const op of ['flash', 'prison', 'release'])
    assert.ok(current.Actions.some(a => a.Op === op && a.GiftId === ''), 'Unassigned new action: ' + op);
  const nativeReports = ['corpse', 'effects', 'smoke', 'round-gifts'];
  for (const name of nativeReports) assert.equal(JSON.parse(fs.readFileSync(name + '-result.json', 'utf8')).passed, true, name);
  await q.send('native-resume');
  await q.send('menu', { open: false });
  await q.send('resolution', { width: 1280, height: 720 });
  await q.send('lock', { enabled: true });
  await q.send('view', { x: 10, z: -8, yaw: -55, pitch: 12 });
  if (q.state().vacuum) await q.send('vacuum');
  const finalCapture = (await q.send('capture')).seq;
  await q.send('lock', { enabled: false });
  await q.send('live-events-pause', { enabled: false });
  const state = q.state();
  assert.equal(state.version, '0.1.3');
  assert.equal(state.failed, false); assert.equal(state.hudError, '');
  assert.equal(state.brandingError, ''); assert.equal(state.combatVisualError, '');
  assert.equal(state.qaLocked, false); assert.equal(state.qaLiveEventsPaused, false);
  const result = {
    date: '2026-10-27', version: state.version, passed: true,
    originalSettingsPreserved: true, newUnassignedActionTypes: ['flash', 'prison', 'release'],
    corpseChecks: 6, effectsChecks: 7, smokeChecks: 17, roundGiftChecks: 6,
    pureRuleChecks: 44, bridgeChecks: 44,
    brandingCaptures: { correctedBat: 1668, coloredVacuum: 1670, final: finalCapture },
    brandedPosters: state.brandedPosters, brandedTools: state.brandedTools,
    liveStatus: state.live.status, syntheticNewEffectGiftTests: true,
    publishedLauncherUpdate: false, originalSteamInstallChanged: false,
    qaLocked: state.qaLocked, qaLiveEventsPaused: state.qaLiveEventsPaused
  };
  fs.writeFileSync('continue-20261027/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(async error => {
  try { await q.send('lock', { enabled: false }); await q.send('live-events-pause', { enabled: false }); } catch {}
  console.error(error); process.exitCode = 1;
});
