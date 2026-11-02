'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('settings-before-0.1.10.json', 'utf8'));
const checks = [], captures = [], weapons = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function healthy(s) { assert.equal(s.failed, false); assert.equal(s.autoError, ''); assert.equal(s.missionBoardError, ''); assert.equal(s.hudError, ''); }
async function outcome(predicate, label, timeout = 25000) {
  const s = await q.wait(s => predicate(s) || s.autoError || s.failed, label, timeout); healthy(s); return s;
}
async function fresh() {
  await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('crowd-settings', {timed: false});
  await q.send('view', {x: 0, z: 0, yaw: 0, pitch: 0});
}
async function snap(label) { const s = await q.send('capture'); captures.push({label, file: `capture-${s.seq}.png`}); }
async function restore() {
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false}); await q.send('reset');
  await q.send('crowd-settings', {total: original.MaxCreatures, physical: original.PhysicalCreatures, timed: original.TimedMode,
    seconds: original.RoundSeconds, target: original.KillTarget, winGoal: original.WinGoal});
  await q.send('progression', {first: original.FirstWeaponKills ?? 50, step: original.WeaponKillStep ?? 10});
  await q.send('blood-enabled', {enabled: original.BloodEnabled});
  await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('resolution', {width: 1280, height: 720});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
}

async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.10' && Date.now() - fs.statSync('state.json').mtimeMs < 2000, 'fresh 0.1.10', 45000);
  await q.send('native-resume'); await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await fresh(); await q.send('blood-enabled', {enabled: false});
  assert.equal(q.state().boardSealed, true); assert.equal(q.state().boardCarving, true);
  await q.send('board-pressure'); await sleep(2500); await q.send('board-mount-probe');
  assert.equal(q.state().behindBoardCreatures, 0); assert.equal(q.state().Alive, 1);
  checks.push('The sealed backstage has a physical collider and carved navigation; an 18 m/s native push cannot leave a creature behind it');
  await q.send('board-occupant'); await outcome(s => s.behindBoardCreatures === 0, 'recover a previously trapped creature', 5000);
  assert.equal(q.state().Alive, 1); await q.send('kill', {count: 1});
  const bodyId = q.state().bodyIds[0]; await q.send('board-occupant');
  await outcome(s => s.behindBoardCreatures === 0, 'recover a trapped corpse', 5000);
  assert.equal(q.state().bodies, 1); assert.equal(q.state().bodyIds[0], bodyId);
  checks.push('Already trapped live creatures and bodies return to the playable side without a kill, deletion or identity change');

  await fresh(); await q.send('progression', {first: 50, step: 10});
  await q.send('auto-fixture', {level: 0, count: 100, distance: 5});
  await q.send('kill', {count: 49}); assert.equal(q.state().RequiredKills, 50); assert.equal(q.state().level, 0);
  await q.send('kill', {count: 1}); assert.equal(q.state().RequiredKills, 60); assert.equal(q.state().Progress, 0);
  await q.send('auto-fixture', {level: 1, count: 20, distance: 10});
  await q.send('kill', {count: 59}); assert.equal(q.state().level, 1); assert.equal(q.state().Progress, 59);
  await snap('knife-59-of-60'); await q.send('kill', {count: 1});
  assert.equal(q.state().level, 2); assert.equal(q.state().RequiredKills, 70); assert.equal(q.state().Kills, 110);
  await q.send('progression', {first: 3, step: 2}); await q.send('reset');
  await q.send('auto-fixture', {level: 0, count: 8, distance: 5}); await q.send('kill', {count: 3});
  assert.equal(q.state().RequiredKills, 5); await q.send('kill', {count: 5}); assert.equal(q.state().RequiredKills, 7);
  checks.push('Native deaths promote at 50 then 60, the HUD shows 59/60, and configured 3+2 targets promote at 3 then 5');
  await q.send('progression', {first: 50, step: 10});

  for (let level = 0; level < 8; level++) {
    await fresh(); await q.send('auto-fixture', {level, count: 1, distance: level < 2 ? 6 : 9});
    const before = q.state().vacuumCollected, attacks = q.state().autoWeaponAttacks[level];
    await q.send('auto-play', {enabled: true});
    let s = await outcome(s => s.Kills >= 1, 'automatic native weapon ' + level, 35000);
    assert.ok(s.autoWeaponAttacks[level] > attacks);
    s = await outcome(s => s.vacuumCollected > before && s.bodies === 0, 'automatic vacuum after weapon ' + level, 20000);
    weapons.push({level, attacks: s.autoWeaponAttacks[level] - attacks, killed: s.Kills, collected: s.vacuumCollected - before});
    await q.send('auto-play', {enabled: false});
    console.log(JSON.stringify({weapon: level, passed: true}));
  }
  checks.push('All eight real weapons autonomously aim, attack with native damage, then switch to native vacuum and collect the corpse');

  await fresh(); await q.send('auto-fixture', {level: 3, count: 24, distance: 8});
  const collected = q.state().vacuumCollected, kills = q.state().autoKills; await q.send('auto-play', {enabled: true});
  await outcome(s => s.autoKills >= kills + 24 && s.bodies === 0 && s.vacuumCollected >= collected + 24, '24-creature autonomous wave', 90000);
  assert.equal(q.state().behindBoardCreatures, 0); await snap('automatic-wave-completed');
  checks.push('A 24-creature native wave is killed and vacuumed without a kill/collect command or user input');

  await fresh(); await q.send('auto-fixture', {level: 0, count: 2, distance: 15});
  await q.send('effect-test', {effect: 'prison', count: 5}); await q.send('auto-play', {enabled: true});
  await outcome(s => s.autoStatus === 'HAPIS', 'auto prison wait');
  const heldAttacks = q.state().autoAttacks; await sleep(1100); await q.send('auto-probe');
  assert.equal(q.state().autoAttacks, heldAttacks); assert.equal(q.state().Kills, 0);
  await q.send('effect-test', {effect: 'release', count: 5}); await q.send('effect-test', {effect: 'flash', count: 3});
  await outcome(s => s.autoStatus === 'FLAS', 'auto flash wait');
  await sleep(1100); await q.send('auto-probe'); assert.equal(q.state().autoAttacks, heldAttacks);
  await q.send('menu', {open: true, tab: 3, optionPage: 3}); await sleep(700); await q.send('auto-probe');
  assert.equal(q.state().autoStatus, 'DURAKLATILDI'); assert.equal(q.state().autoAttacks, heldAttacks);
  await snap('auto-weapons-settings'); await q.send('menu', {open: false});
  await outcome(s => s.Kills === 2 && s.bodies === 0, 'auto resumes after effects and menu', 55000);
  checks.push('Prison, flash and B pause stop movement/fire; automatic play resumes afterward and performs native cleanup');

  await fresh(); await q.send('crowd-settings', {timed: true, seconds: 15, target: 1});
  await q.send('auto-fixture', {level: 2, count: 1, distance: 6}); await q.send('auto-play', {enabled: true});
  await outcome(s => s.challenge.phase === 'Preparing', 'auto starts preparation');
  const beforePrep = q.state().autoAttacks; await sleep(1100); await q.send('auto-probe');
  assert.equal(q.state().autoAttacks, beforePrep); assert.equal(q.state().challenge.Kills, 0);
  await outcome(s => s.Won, 'automatic timed win', 25000);
  await outcome(s => s.challenge.phase === 'Waiting' && !s.Won && s.bodies === 0, 'automatic next round', 15000);
  assert.equal(q.state().autoPlaying, true); await sleep(1300); await q.send('auto-probe');
  assert.equal(q.state().challenge.phase, 'Waiting');
  checks.push('Timed automatic mode starts the genuine ten-second preparation, does not shoot early, wins, cleans up and waits for another wave');

  await q.send('auto-play', {enabled: false});
  for (const width of [800, 1280]) {
    await q.send('resolution', {width, height: width === 800 ? 600 : 720});
    await q.send('menu', {open: true, tab: 3, optionPage: 3}); await sleep(500); await snap('weapon-settings-' + width);
    healthy(q.state()); assert.equal(q.state().menuRendered, true);
  }
  checks.push('Progression settings and the automatic toggle render at 800x600 and 1280x720 without HUD errors');
  await restore();
  const saved = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
  const added = {FirstWeaponKills: saved.FirstWeaponKills, WeaponKillStep: saved.WeaponKillStep};
  if (original.FirstWeaponKills === undefined) delete saved.FirstWeaponKills;
  if (original.WeaponKillStep === undefined) delete saved.WeaponKillStep;
  assert.deepEqual(saved, original); assert.equal(q.state().autoPlaying, false);
  checks.push('Every previous saved setting and gift mapping is preserved; only the default 50+10 progression fields are added and auto play stays session-only');
  fs.writeFileSync('auto-play-result.json', JSON.stringify({passed: true, checks, weapons, captures, added,
    nativeTests: true, realTikTokGiftDeliveryClaimed: false}, null, 2));
  console.log(JSON.stringify({passed: true, checks, weapons, captures}));
}
main().catch(async error => {
  const state = q.state();
  try { await restore(); } catch {}
  fs.writeFileSync('auto-play-result.json', JSON.stringify({passed: false, checks, weapons, captures,
    error: error.stack, state}, null, 2)); console.error(error); process.exitCode = 1;
});
