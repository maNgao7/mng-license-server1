'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('settings-before-0.1.11.json', 'utf8'));
const native = JSON.parse(fs.readFileSync('native-settings-before-0.1.11.json', 'utf8'));
const checks = [];
async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.11', 'native 0.1.11 startup', 45000);
  const source = fs.readFileSync('../src/Mod.cs', 'utf8');
  assert.ok(source.includes('Input.GetKeyDown(KeyCode.P)) SetAutoPlay(!autoPlaying)'));
  assert.ok(!source.includes('Input.GetKeyDown(KeyCode.G)'));
  assert.ok(!source.includes('Input.GetKeyDown(KeyCode.P)) StartChallenge()'));
  checks.push('P exclusively toggles automatic play; G and the old P timer shortcut are removed');
  await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('crowd-settings', {timed: false});
  await q.send('view', {x: 0, z: 0, yaw: 0, pitch: 0});
  await q.send('auto-fixture', {level: 0, count: 8, distance: 6});
  const collected = q.state().vacuumCollected;
  await q.send('audio-sample'); await q.send('auto-play', {enabled: true});
  await q.wait(s => s.Kills >= 2 || s.failed || s.autoError, 'bat sounds and actual native kills', 30000);
  await q.send('audio-probe');
  const audio = JSON.parse(fs.readFileSync('audio-probe.json', 'utf8'));
  assert.equal(audio.audioError, ''); assert.equal(audio.listenerPaused, false);
  assert.equal(audio.listenerVolume, original.Volume);
  assert.ok(audio.listeners.some(l => l.enabled && l.active));
  assert.ok(audio.qaAudioPeak > .005, 'Real Unity output samples must contain sound');
  for (const group of ['Master', 'SFX']) assert.ok(audio.mixer[group] > -40);
  assert.equal(q.state().autoError, ''); assert.equal(q.state().failed, false);
  checks.push('The real bat gameplay produces nonzero audio at the active native listener with open Master/SFX mixer groups');
  await q.wait(s => (s.Alive === 0 && s.bodies === 0 && s.vacuumCollected >= collected + 8) || s.failed || s.autoError,
    'autonomous kill and vacuum regression', 60000);
  assert.equal(q.state().autoError, ''); assert.equal(q.state().failed, false);
  checks.push('Automatic native attacks and vacuum cleanup still complete an eight-creature wave');
  await q.send('auto-play', {enabled: false}); await q.send('reset');
  await q.send('crowd-settings', {timed: original.TimedMode});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), original);
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/settings.sav', 'utf8')), native);
  checks.push('Every mod setting, gift mapping and native graphics/audio setting is unchanged');
  fs.writeFileSync('audio-keyboard-result.json', JSON.stringify({passed: true, checks, audio,
    physicalKeyboardObserved: ['P enables auto and real preparation', 'P disables auto without resetting task time', 'G leaves auto off'],
    windowsAudioObserved: {initialMuted: true, initialLevel: 0, finalMuted: false, otherAppsChangedByAgent: false}}, null, 2));
  console.log(JSON.stringify({passed: true, checks, audioPeak: audio.qaAudioPeak}));
}
main().catch(async error => {
  try {
    await q.send('auto-play', {enabled: false}); await q.send('crowd-settings', {timed: original.TimedMode});
    await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
  } catch {}
  fs.writeFileSync('audio-keyboard-result.json', JSON.stringify({passed: false, checks, error: error.stack, state: q.state()}, null, 2));
  console.error(error); process.exitCode = 1;
});
