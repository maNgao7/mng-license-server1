'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), cp = require('node:child_process');
const q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [], captures = [], connections = [], checks = [];
async function restore() {
  await q.send('reset');
  await q.send('crowd-settings', { physical: original.PhysicalCreatures, total: original.MaxCreatures, timed: original.TimedMode, seconds: original.RoundSeconds });
  await q.send('lock', { enabled: false }); await q.send('live-events-pause', { enabled: false });
  if (original.BroadcasterUsername) await q.send('live-connect', { username: original.BroadcasterUsername });
  if (!original.AutoConnect) await q.send('live-disconnect');
}
async function populate(target) {
  const before = q.state().Alive, count = target - before;
  if (count > 0) await q.send(q.state().realAvatarFiles ? 'avatar-wave' : 'spawn', { count, user: 'qa_dense_crowd' });
  const until = Date.now() + 240000; let refresh = 0;
  while (q.state().Alive < target || q.state().pending) {
    const state = q.state(); assert.equal(state.failed, false); assert.equal(state.hudError, '');
    if (state.crowdMemoryHold) throw new Error('Native memory safety paused new allocation at ' + state.Alive + ' living creatures; ' + state.pending + ' remain explicitly queued');
    if (Date.now() > until) throw new Error('Native crowd did not reach ' + target + ': ' + state.Alive + ' active / ' + state.pending + ' queued');
    if (Date.now() > refresh) {
      await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
      const freeKb = Number(cp.execFileSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory'], { encoding: 'utf8', windowsHide: true }).trim());
      console.log(JSON.stringify({ filling: target, actual: state.Alive, pending: state.pending, freeMb: Math.round(freeKb / 1024) }));
      if (freeKb < 2 * 1024 * 1024) throw new Error('Stopped native crowd test before exhausting physical memory');
      refresh = Date.now() + 4000;
    }
    await sleep(500);
  }
}
async function measure(target) {
  await populate(target); await sleep(3000);
  await q.send('memory-probe');
  const memory = JSON.parse(fs.readFileSync('memory-probe.json', 'utf8'));
  await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
  await q.send('view', { x: 17, z: -19, yaw: -40, pitch: 6 });
  await q.send('motion-sample', { seconds: 16 });
  const run = (await q.send('performance', { label: 'native-continuous-' + target, seconds: 15 })).performanceRun;
  await q.wait(s => s.performanceRun === run && !s.performanceRunning && !s.motionSampling, 'Native crowd sample ' + target, 23000);
  const report = JSON.parse(fs.readFileSync('performance-' + run + '.json', 'utf8'));
  const state = q.state();
  assert.equal(state.Alive, target); assert.equal(state.pending, 0); assert.equal(state.failed, false);
  assert.equal(state.liveFallRescues, 0); assert.equal(state.motionJumps, 0);
  results.push({ ...report, memory, motionJumps: state.motionJumps, motionMaxStep: state.motionMaxStep, rejectedArenaPaths: state.rejectedArenaPaths, models: state.creatureModels });
  captures.push({ target, seq: (await q.send('capture')).seq });
  console.log(JSON.stringify(results.at(-1)));
}
async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.5', 'Native 0.1.5 startup', 45000);
  await q.send('native-resume'); await q.send('menu', { open: false }); await q.send('reset');
  await q.send('crowd-settings', { physical: 5000, total: 5000, timed: false });
  for (const username of ['ozgurkarip', 'sapkali.adam', 'maskeli.jokey', 'swkdcn']) {
    await q.send('live-connect', { username });
    try {
      const state = await q.wait(s => s.live.username === username && s.live.status === 'connected' && s.realAvatarFiles > 0, 'Native live profile source ' + username, 30000);
      connections.push({ username, connected: true, avatars: state.realAvatarFiles, gifts: state.live.giftEvents }); break;
    } catch { connections.push({ username, connected: false, reason: q.state().live.reason }); }
  }
  await q.send('live-events-pause', { enabled: true }); await q.send('reset');
  for (const target of [1000, 2000, 5000]) await measure(target);
  checks.push('1000, 2000 and 5000 actual native creatures are present, not just logical queued totals');
  checks.push('Sampled movement has no jumps exceeding two metres per 100 ms, and no floor-fall rescue');
  checks.push('All nine original models and real profile textures remain in use');
  fs.writeFileSync('crowd-5000-result.json', JSON.stringify({ passed: true, checks, results, captures, connections }, null, 2));
  await restore();
}
main().catch(async error => { fs.writeFileSync('crowd-5000-result.json', JSON.stringify({ passed: false, checks, results, captures, connections, error: error.stack, state: q.state() }, null, 2)); try { await restore(); } catch {} console.error(error); process.exitCode = 1; });
