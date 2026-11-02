'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const before = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const nativeBefore = fs.readFileSync('../userdata/settings.sav');
const checks = [], captures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function healthy(s) {
  assert.equal(s.failed, false);
  for (const key of ['autoError', 'hudError', 'missionBoardError']) assert.equal(s[key], '', key);
}
async function snap(label) {
  const s = await q.send('capture'); healthy(s);
  captures.push({label, file: 'capture-' + s.seq + '.png'}); return s;
}
async function restore() {
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('reset');
  await q.send('progression', {first: before.FirstWeaponKills, step: before.WeaponKillStep});
  await q.send('crowd-settings', {timed: before.TimedMode, seconds: before.RoundSeconds, target: before.KillTarget});
  await q.send('blood-enabled', {enabled: before.BloodEnabled});
  await q.send('combat-settings', {enabled: before.EnemyAttacks});
  await q.send('resolution', {width: 1280, height: 720});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
}
async function main() {
  await q.wait(s => s.ready && s.version === '0.1.17', 'vacuum progression startup', 45000);
  await q.send('native-resume'); await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('combat-settings', {enabled: false});
  await q.send('reset'); await q.send('reset');
  await q.send('crowd-settings', {timed: true, seconds: 3600, target: 10000});
  await q.send('blood-enabled', {enabled: false});
  await q.send('auto-fixture', {level: 0, count: 55, distance: 4});
  const popsBeforeKills = q.state().vacuumIntakeSounds;
  await q.send('kill', {count: 55});
  let s = await q.send('audio-probe');
  assert.equal(s.Kills, 55); assert.equal(s.Collected, 0); assert.equal(s.Progress, 0); assert.equal(s.level, 0);
  assert.equal(s.vacuumIntakeSounds, popsBeforeKills); assert.equal(s.cleanupDrawn, false);
  await snap('fifty-five-kills-no-weapon-upgrade');
  checks.push('Fifty-five real native deaths leave the weapon and collection gauge unchanged and emit no intake feedback');

  await q.send('reset'); await q.send('progression', {first: 3, step: 2});
  const base = q.state().vacuumCollected, sounds = q.state().vacuumIntakeSounds;
  await q.send('audio-sample');
  for (let i = 1; i <= 8; i++) {
    await q.send('vacuum-hold', {distance: 5});
    s = await q.wait(s => s.vacuumCollected >= base + i || s.failed, 'physical manual vacuum intake ' + i, 15000);
    healthy(s);
    await q.send('audio-probe'); s = q.state();
    assert.equal(s.Collected, i); assert.equal(s.vacuumIntakeSounds - sounds, i);
    const level = i < 3 ? 0 : i < 8 ? 1 : 2;
    assert.equal(s.level, level); assert.equal(s.Progress, i < 3 ? i : i < 8 ? i - 3 : 0);
    assert.equal(s.RequiredCollections, level === 0 ? 3 : level === 1 ? 5 : 7);
    assert.equal(s.cleanupDrawn, false); assert.equal(s.highlights.HighestWeapon, level);
    if (i === 3 || i === 8) await snap('physical-intake-upgrade-' + i);
    if (i === 1) {
      const audio = JSON.parse(fs.readFileSync('audio-probe.json', 'utf8'));
      assert.ok(audio.qaAudioPeak > .0001); assert.equal(audio.audioError, '');
      assert.equal(audio.configuredVolume, before.Volume);
      assert.ok(s.vacuumIntakeClip === 'suckpop' || s.vacuumIntakeClip === 'Collect_Pop_1');
    }
  }
  checks.push('Eight physically vacuumed corpses trigger exactly eight intake sounds and exact upgrades at the saved-style 3/5/7 collection thresholds');
  await sleep(600); await q.send('audio-probe');
  assert.equal(q.state().vacuumIntakeSounds - sounds, 8); assert.equal(q.state().Collected, 8);
  checks.push('Repeated empty vacuum updates never duplicate collection progress or intake feedback');

  for (const [width,height] of [[1280,720],[800,600]]) {
    await q.send('resolution', {width,height}); await snap('collection-hud-' + width);
    await q.send('menu', {open: true, tab: 3, optionPage: 3}); await snap('collection-weapon-settings-' + width);
    await q.send('menu', {open: true, tab: 3, optionPage: 4}); await snap('broadcast-without-side-goal-' + width);
    await q.send('menu', {open: false});
  }
  checks.push('Collection labels and settings render at 800x600 and 1280x720, with no separate right-hand vacuum goal');
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), before);
  assert.deepEqual(fs.readFileSync('../userdata/settings.sav'), nativeBefore);
  fs.writeFileSync('vacuum-progression-result.json', JSON.stringify({passed:true, checks, captures, nativeIntakes:8, purchasedTikTokGiftsTested:false}, null, 2));
  console.log(JSON.stringify({passed:true,checks,captures}));
}
main().catch(async error => {
  const state = q.state(); try { await restore(); } catch {}
  fs.writeFileSync('vacuum-progression-result.json', JSON.stringify({passed:false,checks,captures,error:error.stack,state},null,2));
  console.error(error); process.exitCode = 1;
});
