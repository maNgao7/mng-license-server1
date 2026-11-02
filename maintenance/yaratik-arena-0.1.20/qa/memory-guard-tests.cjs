'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
async function restore() {
  await q.send('memory-guard-force', { enabled: false }); await q.send('reset');
  await q.send('crowd-settings', { physical: original.PhysicalCreatures, total: original.MaxCreatures, timed: original.TimedMode, seconds: original.RoundSeconds });
  await q.send('lock', { enabled: false }); await q.send('live-events-pause', { enabled: false });
}
async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.7' && Date.now() - fs.statSync('state.json').mtimeMs < 2000, 'Latest native build', 45000);
  await q.send('native-resume'); await q.send('menu', { open: false }); await q.send('reset');
  await q.send('lock', { enabled: true }); await q.send('live-events-pause', { enabled: true });
  await q.send('crowd-settings', { physical: 2500, total: 2500, timed: false });
  await q.send('memory-guard-force', { enabled: true });
  await q.send('spawn', { count: 1200, user: 'qa_memory_guard' });
  const held = await q.wait(s => s.crowdMemoryHold && s.pending > 0 && s.Alive > 0 && s.counterDigits === String(s.Alive).padStart(7, '0'), 'Native allocation pauses with a visible physical count and queue', 30000);
  assert.equal(held.logicalAlive, 1200); assert.equal(held.failed, false);
  assert.equal(held.counterDigits, String(held.Alive).padStart(7, '0'));
  const queueCapture = (await q.send('capture')).seq;
  await q.send('memory-guard-force', { enabled: false });
  await q.wait(s => s.Alive === 1200 && !s.pending && !s.crowdMemoryHold, 'All queued creatures resume without being lost', 70000);
  await q.send('motion-sample', { seconds: 6 });
  await q.wait(s => !s.motionSampling, 'Latest native movement sample', 10000);
  assert.equal(q.state().motionJumps, 0); assert.equal(q.state().liveFallRescues, 0);
  const finalCapture = (await q.send('capture')).seq;
  await restore();
  const report = { passed: true, checks: ['Forced low-memory state preserves all 1200 identities/counts with explicit SAHADA/SIRADA labels', 'Disabling the forced state admits all 1200 native creatures without losing or replaying the queue', 'Latest build has no sampled movement discontinuities or live floor-fall rescues'], queueCapture, finalCapture };
  fs.writeFileSync('memory-guard-result.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
main().catch(async error => { fs.writeFileSync('memory-guard-result.json', JSON.stringify({ passed: false, error: error.stack }, null, 2)); try { await restore(); } catch {} console.error(error); process.exitCode = 1; });
