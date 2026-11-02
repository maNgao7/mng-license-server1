'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('settings-before-0.1.10.json', 'utf8'));
const savedPath = '../userdata/mod-settings.json';
async function main() {
  const reports = ['auto-play-result.json', 'auto-motion-result.json', 'corpse-result.json', 'board-mount-result.json', 'menu-visual-result.json'];
  for (const name of reports) assert.equal(JSON.parse(fs.readFileSync(name, 'utf8')).passed, true, name);
  if (process.argv.includes('--prepare')) {
    await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
    await q.send('crowd-settings', {timed: original.TimedMode});
    await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
    const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
    assert.deepEqual(saved, {...original, FirstWeaponKills: 50, WeaponKillStep: 10});
    console.log(JSON.stringify({settingsPreserved: true, restartReady: true})); return;
  }
  const s = await q.wait(s => s.ready && !s.failed && s.version === '0.1.10'
    && Date.now() - fs.statSync('state.json').mtimeMs < 2000, 'fresh installed mod', 45000);
  assert.equal(s.autoPlaying, false); assert.equal(s.Kills, 0); assert.equal(s.Wins, 0);
  assert.equal(s.Alive, 0); assert.equal(s.bodies, 0); assert.equal(s.pending, 0);
  assert.equal(s.boardSealed, true); assert.equal(s.boardCarving, true);
  assert.equal(s.behindBoardCreatures, 0);
  for (const error of ['autoError', 'missionBoardError', 'hudError', 'brandingError', 'combatVisualError']) assert.equal(s[error], '', error);
  assert.equal(s.qaLocked, false); assert.equal(s.qaLiveEventsPaused, false);
  assert.equal(s.RequiredKills, 50); assert.equal(s.WeaponKillStep, 10); assert.equal(s.MaxCreatures, 2500);
  assert.equal(s.TimedMode, original.TimedMode); assert.equal(s.RoundSeconds, original.RoundSeconds);
  assert.deepEqual(JSON.parse(fs.readFileSync(savedPath, 'utf8')), {...original, FirstWeaponKills: 50, WeaponKillStep: 10});
  fs.writeFileSync('final-0.1.10-result.json', JSON.stringify({passed: true, reports, state: s,
    savedSettingsPreserved: true, localPrototypeOnly: true, actualPaidTikTokGiftsTested: false}, null, 2));
  console.log(JSON.stringify({passed: true, version: s.version, autoOff: !s.autoPlaying, settingsPreserved: true, reports}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
