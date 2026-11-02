'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [], connections = [], captures = [];
const count = Number(process.argv[2] || 500);
assert.ok([500, 1000].includes(count), 'Profile crowd scenario must be 500 or 1000');
const reportFile = count === 500 ? 'profile-crowd-result.json' : 'profile-crowd-' + count + '-result.json';
async function measure(label) {
  await q.send('lock', { enabled: true });
  await q.send('live-events-pause', { enabled: true });
  const run = (await q.send('performance', { label, seconds: 15 })).performanceRun;
  await q.wait(s => s.performanceRun === run && !s.performanceRunning, 'Frame sample ' + label, 22000);
  const report = JSON.parse(fs.readFileSync('performance-' + run + '.json', 'utf8'));
  assert.equal(q.state().failed, false); assert.equal(q.state().hudError, '');
  assert.equal(q.state().combatVisualError, ''); assert.ok(report.realProfiles > 0);
  results.push(report); console.log(JSON.stringify(report));
}
async function restore() {
  await q.send('reset');
  await q.send('blood-enabled', { enabled: original.BloodEnabled });
  await q.send('crowd-settings', { physical: original.PhysicalCreatures, timed: original.TimedMode, seconds: original.RoundSeconds, total: original.MaxCreatures });
  await q.send('live-events-pause', { enabled: false });
  await q.send('lock', { enabled: false });
  if (original.BroadcasterUsername) await q.send('live-connect', { username: original.BroadcasterUsername });
  if (!original.AutoConnect) await q.send('live-disconnect');
}
async function main() {
  await q.send('native-resume'); await q.send('menu', { open: false });
  await q.send('resolution', { width: 1280, height: 720 });
  await q.send('reset'); await q.send('crowd-settings', { physical: count, total: Math.max(original.MaxCreatures, count), timed: false });
  for (const username of ['ozgurkarip', 'sapkali.adam', 'maskeli.jokey', 'swkdcn']) {
    await q.send('live-events-pause', { enabled: false });
    const before = q.state().realAvatarFiles;
    await q.send('live-connect', { username });
    try {
      const state = await q.wait(s => s.live.username === username && s.live.status === 'connected' && s.realAvatarFiles > before, 'Native live avatars: ' + username, 45000);
      connections.push({ username, status: state.live.status, received: state.live.received, giftEvents: state.live.giftEvents, avatarFiles: state.realAvatarFiles, applied: state.liveApplied, unmapped: state.liveUnmapped });
      break;
    } catch { connections.push({ username, live: q.state().live }); }
  }
  assert.ok(connections.some(c => c.status === 'connected'), 'A requested live account must connect and supply a real profile');
  await q.send('live-events-pause', { enabled: true }); await q.send('reset');
  await q.send('lock', { enabled: true });
  await q.send('avatar-wave', { count });
  await q.wait(s => s.Alive === count && !s.pending, count + ' real-profile creatures', 95000);
  await q.send('view', { x: 10, z: -8, yaw: -55, pitch: 12 }); await sleep(2000);
  await q.wait(s => s.loadedLivePortraits > 0 && s.profiles === count, 'Visible real native profile textures');
  await measure('profiles-' + count); captures.push((await q.send('capture')).seq);
  await q.send('kill', { count: 450 });
  const retained = (await q.wait(s => s.bodies === 450 && s.Alive === count - 450, '450 real corpses')).bodyIds;
  await q.send('avatar-wave', { count: 450 });
  await q.wait(s => s.Alive === count && !s.pending, count + ' living creatures with 450 corpses', 60000);
  await sleep(2000); await measure('profiles-' + count + '-corpses-450');
  assert.equal(q.state().bodies, 450); assert.deepEqual(q.state().bodyIds, retained);
  captures.push((await q.send('capture')).seq);
  await q.send('blood-enabled', { enabled: false });
  await measure('profiles-' + count + '-corpses-450-no-blood');
  assert.deepEqual(q.state().bodyIds, retained); assert.equal(q.state().visibleSuppressedBlood, 0);
  fs.writeFileSync(reportFile, JSON.stringify({ passed: true, connections, results, captures, retainedCorpses: 450, trackedBodyIds: retained.length }, null, 2));
  await restore();
}
main().catch(async error => { fs.writeFileSync(reportFile, JSON.stringify({ passed: false, connections, results, captures, error: error.stack }, null, 2)); try { await restore(); } catch {} console.error(error); process.exitCode = 1; });
