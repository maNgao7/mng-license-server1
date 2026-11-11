'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const wait = require('node:timers/promises').setTimeout;
const [root, qa, project] = process.argv.slice(2);
const stage = path.join(root, 'launcher');
const { createForzaPublisher } = require(path.join(stage, 'lib/forza-publisher.cjs'));
const { createSharedGameEvents } = require(path.join(stage, 'lib/shared-game-events.cjs'));
const { createWidgetPortraits } = require(path.join(stage, 'lib/widget-portraits.cjs'));
const events = createSharedGameEvents();
process.env.MNG_FORZA_QA_CONTROL = path.join(qa, 'control');
const { sendAndWait } = require(path.join(project, 'tests/command.cjs'));
const portraitPath = path.join(qa, 'assets', 'portrait-ring.png');
const image = fs.readFileSync(portraitPath);
let allowImage;
const ready = new Promise(resolve => { allowImage = resolve; });
const groups = [{ rank: 4, urls: ['high'] }, { rank: 1, urls: ['thumb'] }];
const engine = {
  PortraitCache: class {
    async get(urls) {
      if (urls.includes('thumb')) { await ready; return './cache/00000000-0000-0000-0000-000000000000'; }
      if (urls.includes('high')) { await wait(25000, undefined, { ref: false }); }
      return '';
    }
    info() { return { width: 128, height: 128 }; }
    file() { return portraitPath; }
    close() {}
  },
  ProfileSources: class { async get() { return []; } close() {} },
  VsPortraits: class { async get() { return null; } close() {} },
  portraitCandidates(data) { return data.user ? groups : []; }
};
const portraits = createWidgetPortraits({ folder: qa, engine });
let child, feed;
function state() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(qa, 'control/status.json'), 'utf8'));
    if (data.pid === child.pid && Date.now() - Date.parse(data.utc) < 4000) return data;
  } catch {}
}
async function until(predicate, seconds, label) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    assert.equal(child.exitCode, null, 'Game exited during ' + label);
    const s = state();
    if (s && predicate(s)) return s;
    await wait(100);
  }
  throw Error(label + ' / ' + state()?.phase);
}
const driver = s => s.viewers.find(v => v.Username === 'driverqa');
function gift(id, coins) {
  events.publish('gift', { eventId: id, username: 'driverqa', nickname: 'Sürücü', coins }, { channel: 'forzaqa', source: 'live' });
}
(async () => {
  feed = await createForzaPublisher({ events, getChannel: () => 'forzaqa', getStatus: () => ({ status: 'connected' }), directory: qa,
    portrait: async (username, data) => {
      const file = await portraits.racePortrait(username, data);
      return file ? fs.readFileSync(file) : null;
    }
  });
  fs.writeFileSync(path.join(qa, 'control/settings.json'), JSON.stringify({ EconomyVersion: 7, DynamicsVersion: 1, GiftSpeedPerCoin: 10, Laps: 3 }));
  const runtime = path.join(qa, 'runtime');
  child = spawn(path.join(runtime, 'iracing-arcade.exe'), ['-screen-fullscreen', '0', '-screen-width', '1600', '-screen-height', '900'], {
    cwd: runtime, stdio: 'ignore', env: { ...process.env, MNG_FORZA_PUBLISHER_URL: feed.url, MNG_FORZA_PUBLISHER_TOKEN: feed.token, MNG_FORZA_LAUNCHER_RUNTIME: process.execPath }
  });
  await until(s => s.phase === 'staging' && s.viewers.length === 0, 80, 'native startup');
  await sendAndWait('board-qa', { run: 'public-054-portrait' });
  await sendAndWait('connect', { username: 'forzaqa' });
  await until(s => s.live === 'connected', 15, 'publisher connection');
  portraits.observe({ username: 'driverqa', user: {} });
  gift('join', 5);
  const entry = await until(s => driver(s)?.TopSpeedKph === 100, 15, 'gift immediately spawns and boosts one car');
  assert.equal(driver(entry).hasAvatar, false);
  const imageAvailableAt = Date.now();
  allowImage();
  await until(s => driver(s)?.hasAvatar, 9, 'quick portrait attached to existing car while high resolution is pending');
  const latency = Date.now() - imageAvailableAt;
  await sendAndWait('test-race');
  await until(s => s.phase === 'racing' && driver(s)?.speed > 0, 25, 'manual race start');
  gift('boost', 5);
  const race = await until(s => driver(s)?.TopSpeedKph === 150 && driver(s).hasAvatar, 10, 'portrait survives second gift');
  assert.equal(race.viewers.length, 1);
  const result = { passed: true, giftTargetsKph: [100, 150], portraitVisibleInNativeGame: true, singleCar: true, portraitLatencyMs: latency };
  fs.writeFileSync(path.join(root, 'public-portrait-qa.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
  if (child) {
    try { await sendAndWait('quit', {}, 2500); } catch {}
    if (child.exitCode === null) child.kill();
  }
  await feed?.close();
  events.close();
  portraits.close();
});
