'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = process.argv[2] || 'baseline';
const results = [];
async function measure(name, count) {
  await q.send('lock', { enabled: true });
  await q.send('live-events-pause', { enabled: true });
  await q.send('reset');
  await q.send('crowd-settings', { physical: 500, timed: false });
  if (count) {
    await q.send('spawn', { count, user: 'qa_crowd_' + count });
    await q.wait(s => s.Alive === count && s.pending === 0, count + ' native creatures', 60000);
  }
  await q.send('view', { x: 10, z: -8, yaw: -55, pitch: 12 });
  await sleep(2000);
  const run = (await q.send('performance', { label: label + '-' + name, seconds: 15 })).performanceRun;
  await q.wait(s => s.performanceRun === run && !s.performanceRunning, 'Frame sample', 22000);
  const report = JSON.parse(fs.readFileSync('performance-' + run + '.json', 'utf8'));
  assert.equal(report.live, count); assert.equal(q.state().failed, false);
  results.push(report); console.log(JSON.stringify(report));
}
async function restore() {
  await q.send('crowd-settings', { physical: original.PhysicalCreatures, timed: original.TimedMode, seconds: original.RoundSeconds, total: original.MaxCreatures });
  await q.send('reset'); await q.send('lock', { enabled: false });
  await q.send('live-events-pause', { enabled: false });
}
async function main() {
  await q.send('native-resume'); await q.send('menu', { open: false });
  await q.send('resolution', { width: 1280, height: 720 });
  for (const count of [0, 300, 400, 500]) await measure(count ? String(count) : 'empty', count);
  fs.writeFileSync('crowd-performance-' + label + '.json', JSON.stringify({ passed: true, results }, null, 2));
  await restore();
}
main().catch(async error => { fs.writeFileSync('crowd-performance-' + label + '.json', JSON.stringify({ passed: false, results, error: error.stack }, null, 2)); try { await restore(); } catch {} console.error(error); process.exitCode = 1; });
