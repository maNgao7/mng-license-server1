'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [], captures = [], root = process.env.TIKMNG_ARENA_QA_ROOT || __dirname;
function check(label, value) { assert.ok(value, label); checks.push(label); }
async function level(wanted) {
  while (q.state().level < wanted) await q.send('up');
  while (q.state().level > wanted) await q.send('down');
}
async function capture(label) {
  const state = await q.send('capture'); const file = 'capture-' + state.seq + '.png';
  fs.copyFileSync(path.join(root, file), path.join(root, 'ammo-' + label + '.png')); captures.push('ammo-' + label + '.png');
}
(async () => {
  let error;
  try {
    await q.wait(s => s.ready && !s.failed && s.version === (process.env.TIKMNG_QA_VERSION || '0.1.24'), 'Game ready', 40000);
    await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
    await q.send('auto-play', { enabled: false }); await q.send('menu', { open: false }); await q.send('reset');
    await q.send('resolution', { width: 1280, height: 720 });
    await level(2); check('native pistol starts with 12', q.state().weaponResources.rounds === 12 && q.state().ammo === 12);
    await q.send('ammo-shot'); check('one shot consumes one round', q.state().weaponResources.rounds === 11);
    await q.send('vacuum'); await q.send('vacuum'); check('vacuum switch never refills magazine', q.state().weaponResources.rounds === 11);
    await q.send('ammo-reload'); await q.wait(s => s.weaponResources.reloading && s.weaponResources.poseApplied, 'Native reload pose');
    await capture('pistol-reload'); await q.wait(s => !s.weaponResources.reloading && s.weaponResources.rounds === 12, 'Pistol reload done');
    check('pistol reload advances only through timer', q.state().weaponResources.reloads >= 1);
    await q.send('ammo-empty'); await q.wait(s => s.weaponResources.reloading, 'Empty auto reload');
    await q.send('menu', { open: true }); let before = q.state().weaponResources.remaining; await sleep(700);
    check('menu pauses reload timer', Math.abs(q.state().weaponResources.remaining - before) < .05);
    await q.send('menu', { open: false }); await q.wait(s => !s.weaponResources.reloading, 'Resume reload');
    await q.send('ammo-shot'); await q.send('ammo-reload'); await level(3); await level(2);
    check('switching away cancels reload without free ammunition', q.state().weaponResources.rounds === 11 && !q.state().weaponResources.reloading);
    await level(4); check('native AK starts with thirty rounds', q.state().weaponResources.rounds === 30 && q.state().ammo === 30);
    await q.send('ammo-shot'); await q.send('ammo-shot'); check('AK model and native counter match', q.state().weaponResources.rounds === 28 && q.state().ammo === 28);
    await capture('ak-loaded');
    await q.send('ammo-empty'); await q.wait(s => s.weaponResources.reloading && s.weaponResources.poseApplied, 'AK reload');
    await capture('ak-reload'); await q.wait(s => !s.weaponResources.reloading && s.ammo === 30, 'AK reload complete');
    for (const gun of [3, 5, 6]) {
      await level(gun); await q.send('ammo-empty'); await q.wait(s => s.weaponResources.reloading, 'Other gun reload ' + gun);
      await q.wait(s => !s.weaponResources.reloading && s.weaponResources.rounds === s.weaponResources.capacity, 'Other gun ready ' + gun);
      check('gun ' + gun + ' reloaded', q.state().ammo === q.state().weaponResources.capacity);
    }
    await level(7); await q.send('ammo-shot', { seconds: 4 }); let hot = q.state().weaponResources;
    check('flame becomes genuinely blocked', hot.overheated && hot.cooldown > 4.8);
    await capture('flame-overheat'); await q.send('ammo-shot', { seconds: 1 });
    check('blocked flame does not restart cooldown', q.state().weaponResources.overheats === hot.overheats && q.state().weaponResources.cooldown < hot.cooldown);
    await q.send('menu', { open: true }); before = q.state().weaponResources.cooldown; await sleep(600);
    check('menu cannot bypass flame cooldown', Math.abs(q.state().weaponResources.cooldown - before) < .05);
    await q.send('menu', { open: false }); await level(6); await level(7);
    check('weapon switch cannot erase overheat', q.state().weaponResources.overheated);
    await q.wait(s => !s.weaponResources.overheated, 'Five second flame cooldown', 8000);
    await q.send('ammo-shot', { seconds: .5 }); check('flame can heat again after cooling', q.state().weaponResources.heat > 0 && !q.state().weaponResources.overheated);
    await capture('flame-ready'); await q.send('reset');
    check('round reset clears heat and magazine state', q.state().weaponResources.heat === 0 && !q.state().weaponResources.overheated);
    await q.send('team-fixture', { user: 'qa_boss_double', kind: 'boss', x: 18, z: 18 });
    await q.send('team-fixture', { user: 'qa_bigboss_double', kind: 'bigboss', x: -18, z: 18 });
    check('native boss has exactly 264 health', q.state().combatTestBodies.some(c => c.Username === 'qa_boss_double' && c.maxHealth === 264));
    check('native Big Boss has exactly 528 health', q.state().combatTestBodies.some(c => c.Username === 'qa_bigboss_double' && c.maxHealth === 528));
    for (const size of [[800, 600], [1024, 768], [1280, 720], [1920, 1080]]) {
      await q.send('reset'); await level(4); await q.send('resolution', { width: size[0], height: size[1] });
      await q.wait(s => s.width === size[0] && s.height === size[1] && s.weaponResources.hudDrawn, 'HUD resolution');
      const s = q.state(), a = s.weaponResources.bounds, h = s.healthBounds;
      check('HUD fits ' + size[0], a.x >= 0 && a.y >= 0 && a.x + a.width <= s.width && a.y + a.height <= s.height);
      check('HUD clears player health ' + size[0], a.x + a.width <= h.x || a.x >= h.x + h.width || a.y + a.height <= h.y || a.y >= h.y + h.height);
      await capture('hud-' + size[0]);
    }
    check('native game remains healthy', !q.state().failed && !q.state().autoError && !q.state().survivalError);
  } catch (failure) { error = failure.stack; process.exitCode = 1; }
  finally {
    const result = { passed: !error, timestamp: new Date().toISOString(), checks, captures, error };
    fs.writeFileSync(path.join(root, 'ammo-native-result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
    try { await q.send('reset'); await q.send('lock', { enabled: false }); await q.send('live-events-pause', { enabled: false }); } catch {}
  }
})();
