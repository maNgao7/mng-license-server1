'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const qa = process.argv[2];
const control = path.join(qa, 'control');
process.env.MNG_FORZA_QA_CONTROL = control;
const { sendAndWait } = require(path.join(process.argv[3], 'tests/command.cjs'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.writeFileSync(path.join(control, 'settings.json'), JSON.stringify({
  EconomyVersion: 7, DynamicsVersion: 1, GiftSpeedPerCoin: 10, Laps: 3,
  GraphicsQuality: 1, TargetFrameRate: 60, FullscreenWindow: false
}));
const runtime = path.join(qa, 'runtime');
const log = fs.openSync(path.join(qa, 'pack-process.log'), 'w');
const child = spawn(path.join(runtime, 'iracing-arcade.exe'), ['-screen-fullscreen', '0', '-screen-width', '1600', '-screen-height', '900'], { cwd: runtime, stdio: ['ignore', log, log] });
fs.closeSync(log);
function read() {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(control, 'status.json'), 'utf8'));
    if (state.pid === child.pid && Date.now() - Date.parse(state.utc) < 4000) return state;
  } catch {}
}
async function until(test, seconds, label) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    assert.equal(child.exitCode, null, 'Game exited during ' + label);
    const state = read();
    if (state && test(state)) return state;
    await wait(125);
  }
  throw Error('Timed out during ' + label + ' / ' + read()?.phase);
}
const gift = (username, coins, tag) => sendAndWait('live-event', { event: {
  type: 'gift', username, nickname: username, eventId: 'pack-' + tag + '-' + username,
  coins, repeatCount: 1, giftId: 'ordinary'
}});
const trailing = state => state.viewers.find(r => r.Username === 'packrear');
(async () => {
  await until(s => s.phase === 'staging' && s.viewers.length === 0, 95, 'empty grid');
  await sendAndWait('board-qa', { run: 'forza-054-crowded' });
  for (let n = 1; n <= 6; n++) await gift('pack' + n, 2 + n % 2, 'join');
  await gift('packrear', 1, 'join');
  await sendAndWait('test-race');
  const start = await until(s => s.phase === 'racing' && s.viewers.length === 7 && s.viewers.every(r => r.speed > 2) &&
    trailing(s)?.progressStarted && trailing(s).racePlace >= 6, 40, 'seven moving cars and rear start');
  const initialPlace = trailing(start).racePlace;
  const boosted = trailing(await gift('packrear', 13, 'boost'));
  assert.equal(boosted.TopSpeedKph, 190);
  let bestPlace = initialPlace, peakKph = 0, flashed = false, maxOffset = 0;
  let last = '';
  let lastLog = 0;
  const observe = s => {
    const car = trailing(s);
    if (!car || s.phase !== 'racing') return false;
    if (car.racePlace > 0) bestPlace = Math.min(bestPlace, car.racePlace);
    peakKph = Math.max(peakKph, car.speed * 3.6);
    flashed ||= !!car.passing?.flashing;
    maxOffset = Math.max(maxOffset, ...s.viewers.map(v => Math.abs(v.lineOffset || 0)));
    if (Date.now() - lastLog >= 2000) {
      lastLog = Date.now();
      const row = s.viewers.map(v => [v.Username, v.racePlace, Math.round(v.speed * 3.6), v.lap, v.lineOffset]);
      last = JSON.stringify({ row, bestPlace, flashed });
      console.log(last);
    }
    return initialPlace - bestPlace >= 2 && peakKph > 100 && flashed;
  };
  try { await until(observe, 105, 'gain two places, speed and flash'); }
  finally {
    fs.writeFileSync(path.join(qa, 'crowded-native-qa.json'), JSON.stringify({ initialPlace, bestPlace, peakKph, flashed, maxOffset, last }, null, 2));
  }
  await sendAndWait('finish-race');
  await until(s => s.phase === 'staging' && s.viewers.length === 0, 40, 'empty next grid');
  console.log('PASS crowded native race');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
  try { await sendAndWait('quit', {}, 2500); } catch {}
  if (child.exitCode === null) child.kill();
});
