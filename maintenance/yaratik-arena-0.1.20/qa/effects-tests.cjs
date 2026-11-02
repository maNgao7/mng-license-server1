'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const sharp = require('../bridge/node_modules/sharp');
const q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const originalText = fs.readFileSync('../userdata/mod-settings.json', 'utf8');
const original = JSON.parse(originalText);
const checks = [], captures = [];

async function restore() {
  while (q.state().actionCount > original.Actions.length)
    await q.send('action-delete', { index: q.state().actionCount - 1 });
  for (let i = 0; i < original.Actions.length; i++)
    await q.send('binding', { index: i, giftId: original.Actions[i].GiftId, count: original.Actions[i].Count });
  await q.send('blood-enabled', { enabled: original.BloodEnabled });
  await q.send('blood-color', { index: original.BloodColor });
  await q.send('menu', { open: false, addingAction: false });
  await q.send('reset');
  await q.send('resolution', { width: 1280, height: 720 });
  await q.send('lock', { enabled: false });
  await q.send('live-events-pause', { enabled: false });
}

async function main() {
  await q.send('live-events-pause', { enabled: true });
  await q.send('lock', { enabled: true });
  await q.send('native-resume'); await q.send('menu', { open: false });
  await q.send('reset');
  await q.send('spawn', { count: 12, user: 'qa_blood_effects' });
  await q.wait(s => s.Alive === 12 && s.pending === 0, 'Twelve native creatures');
  await q.send('blood-sample');
  await q.send('blood-enabled', { enabled: false });
  let state = await q.wait(s => !s.BloodEnabled && s.floorBloodParticles === 0 && s.visibleSuppressedBlood === 0, 'Clear existing blood');
  const bursts = state.sparkBursts, blocked = state.suppressedBlood;
  for (let i = 0; i < 6; i++) {
    await q.send('blood-color', { index: i });
    await q.send('blood-sample');
    await q.send('hit', { damage: .2 });
    await sleep(150);
    state = q.state();
    assert.equal(state.BloodEnabled, false);
    assert.equal(state.floorBloodParticles, 0);
    assert.equal(state.visibleSuppressedBlood, 0);
    assert.equal(state.damageSlots, 0);
  }
  assert.ok(state.sparkBursts >= bursts + 6);
  assert.ok(state.suppressedBlood >= blocked + 12);
  assert.equal(state.Alive, 12);
  assert.equal(state.combatVisualError, '');
  checks.push('Blood-off suppresses fresh blood, floor traces and creature damage slots in every color while real hits create small yellow impacts');

  await q.send('menu', { open: true, tab: 3, optionPage: 1 });
  captures.push({ kind: 'blood-options-1280', seq: (await q.send('capture')).seq });
  await q.send('resolution', { width: 800, height: 600 }); await sleep(500);
  captures.push({ kind: 'blood-options-800', seq: (await q.send('capture')).seq });
  assert.equal(q.state().hudError, '');
  await q.send('resolution', { width: 1280, height: 720 }); await sleep(500);
  checks.push('Blood and hit-marker settings render at compact and desktop sizes without HUD errors');

  const prisonIndex = original.Actions.findIndex(a => a.Op === 'prison');
  const flashIndex = original.Actions.findIndex(a => a.Op === 'flash');
  const releaseIndex = original.Actions.findIndex(a => a.Op === 'release');
  const catalog = JSON.parse(fs.readFileSync('../catalog/gifts.json', 'utf8'));
  const freeIds = catalog.filter(g => !original.Actions.some(a => a.GiftId === g.id)).slice(0, 3).map(g => g.id);
  await q.send('binding', { index: prisonIndex, giftId: freeIds[0], count: 1 });
  await q.send('gift', { id: freeIds[0], repeatCount: 20 });
  assert.equal(q.state().PrisonSeconds, 20);
  await q.send('gift', { id: freeIds[0], repeatCount: 100 });
  assert.equal(q.state().PrisonSeconds, 120);
  await q.send('binding', { index: releaseIndex, giftId: freeIds[1], count: 1 });
  await q.send('gift', { id: freeIds[1], repeatCount: 20 });
  assert.equal(q.state().PrisonSeconds, 100);
  await sleep(600); assert.equal(q.state().PrisonSeconds, 100);
  checks.push('Exact gift IDs apply 20 + 100 - 20 prison seconds; menus pause the remaining duration');

  await q.send('menu', { open: false });
  state = await q.wait(s => s.cageActive && s.creaturesInCage === 0 && !s.weaponActive, 'Solid cage outside creatures');
  assert.ok(state.cageWalls >= 5);
  const alive = state.Alive, kills = state.Kills;
  await q.send('kill', { count: 1 });
  assert.equal(q.state().Alive, alive); assert.equal(q.state().Kills, kills);
  captures.push({ kind: 'native-prison', seq: (await q.send('capture')).seq });
  await q.send('effect-test', { effect: 'release', count: 3600 });
  state = await q.wait(s => !s.cageActive && s.PrisonSeconds === 0 && s.weaponActive, 'Release restores native weapon');
  checks.push('Cage has solid collision walls, excludes live creatures, disables weapons and blocks damage until release restores the selected weapon');

  await q.send('menu', { open: true });
  await q.send('binding', { index: flashIndex, giftId: freeIds[2], count: 3 });
  await q.send('gift', { id: freeIds[2], repeatCount: 2 });
  assert.equal(q.state().FlashSeconds, 6);
  await q.send('menu', { open: false });
  await q.wait(s => s.flashOpacity === 1 && !s.flashIntroQueued, 'Flash expands into white after its blast');
  const flashCapture = (await q.send('capture')).seq;
  const pixels = await sharp('capture-' + flashCapture + '.png').raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let p = 0; p < pixels.data.length; p += pixels.info.channels)
    if (pixels.data[p] > 250 && pixels.data[p + 1] > 250 && pixels.data[p + 2] > 250) white++;
  assert.ok(white / (pixels.info.width * pixels.info.height) > .97);
  captures.push({ kind: 'full-white-flash', seq: flashCapture });
  await q.wait(s => s.FlashSeconds === 0, 'Flash expires', 10000);
  checks.push('A configured three-second flash repeated twice covers the full rendered screen in white, then expires');

  const count = q.state().actionCount;
  await q.send('action-add', { effect: 'spawn' });
  assert.equal(q.state().actionCount, count + 1);
  await q.send('binding', { index: count, giftId: freeIds[2], count: 7 });
  const before = q.state().logicalAlive;
  await q.send('gift', { id: freeIds[2], repeatCount: 3 });
  await q.wait(s => s.logicalAlive === before + 21, 'Dynamic creature action multiplicity');
  await q.send('action-delete', { index: count });
  assert.equal(q.state().actionCount, count);
  checks.push('New actions are saved, configured creature counts multiply by gift repeats, and deleting removes the whole action row');

  await q.send('reset');
  await q.send('blood-enabled', { enabled: true });
  await q.send('blood-sample');
  await q.wait(s => s.floorBloodParticles > 0, 'Blood can be enabled again');
  checks.push('Blood can be re-enabled after spark mode without breaking native particles');
  await restore();
  assert.equal(fs.readFileSync('../userdata/mod-settings.json', 'utf8'), originalText);
  const result = { passed: true, checks, captures, settingsUnchanged: true };
  fs.writeFileSync('effects-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
main().catch(async error => {
  fs.writeFileSync('effects-result.json', JSON.stringify({ passed: false, checks, captures, error: error.stack }, null, 2));
  try { await restore(); } catch {}
  console.error(error); process.exitCode = 1;
});
