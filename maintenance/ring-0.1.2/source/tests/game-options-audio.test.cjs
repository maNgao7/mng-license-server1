'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createGameOptions } = require('../src/game-options.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-audio-options-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const settingsPath = path.join(dir, 'settings.json');
  const game = { pid: null };
  const workers = [];
  const init = () => createGameOptions({
    settingsPath,
    getGamePid: () => game.pid,
    spawnWorker(command, args, options) {
      assert.equal(command, 'powershell.exe');
      assert.equal(options.windowsHide, true);
      assert.ok(args.includes('-Mta'));
      const child = new EventEmitter();
      child.pidArgument = args.at(-1);
      child.writes = [];
      child.stdin = new EventEmitter();
      child.stdin.write = line => child.writes.push(line);
      child.kill = () => { child.killed = true; };
      workers.push(child);
      return child;
    },
  });
  const options = init();
  t.after(() => options.close());
  return { dir, game, workers, options, init, settingsPath };
}

test('atomic partial settings, independent snapshots and safe reload', t => {
  const { options, settingsPath, init, dir } = fixture(t);
  const defaults = { gameVolume: 50, effectsVolume: 60, flashes: true, quality: 'high',
    standingsCollapsed:false, queueCollapsed:false, showStandings:true, standingsScale:100, showQueue:true, queueScale:100 };
  assert.deepEqual(options.snapshot(), defaults);
  options.snapshot().quality = 'low';
  options.configure({ effectsVolume: -8, quality: 'low' });
  const expected = { ...defaults, gameVolume: 52, effectsVolume: 0, flashes: false, quality: 'low' };
  const changed = options.configure({ gameVolume: 51.6, flashes: false });
  assert.deepEqual(changed, expected);
  changed.gameVolume = 11;
  assert.throws(() => options.configure({ effectsVolume: 1, flashes: 'false' }), TypeError);
  assert.throws(() => options.configure({ gameVolume: Infinity }), TypeError);
  assert.deepEqual(options.snapshot(), expected);
  assert.deepEqual(fs.readdirSync(dir), ['settings.json']);
  assert.deepEqual(init().snapshot(), expected);
  fs.writeFileSync(settingsPath, '{');
  assert.deepEqual(init().snapshot(), defaults);
  fs.writeFileSync(settingsPath, JSON.stringify({ schemaVersion: 1, settings: { quality: 'unknown', gameVolume: 3 } }));
  assert.deepEqual(init().snapshot(), { ...defaults, gameVolume: 3 });
});

test('list visibility and size persist with bounds alongside audio options', t => {
  const { options, init } = fixture(t);
  options.configure({ standingsCollapsed:true, queueCollapsed:true, showStandings:false, standingsScale:110, showQueue:false, queueScale:80 });
  const saved=init().snapshot();
  assert.equal(saved.standingsCollapsed,true);assert.equal(saved.queueCollapsed,true);
  assert.equal(saved.showStandings,false);
  assert.equal(saved.standingsScale,110);
  assert.equal(saved.showQueue,false);
  assert.equal(saved.queueScale,80);
  assert.equal(options.configure({standingsScale:999}).standingsScale,140);
  assert.equal(options.configure({queueScale:-1}).queueScale,60);
});

test('failed replace keeps the previous memory state and cleans the temporary file', t => {
  const { options, settingsPath, dir, game, workers } = fixture(t);
  game.pid = 999;
  fs.mkdirSync(settingsPath);
  assert.throws(() => options.configure({ gameVolume: 12 }));
  assert.equal(options.snapshot().gameVolume, 50);
  assert.deepEqual(fs.readdirSync(dir), ['settings.json']);
  assert.deepEqual(workers, []);
});

test('debounces rapid volume changes, reuses the worker and rechecks the PID at dispatch', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { options, game, workers } = fixture(t);
  options.configure({ gameVolume: 80 });
  options.syncNative();
  t.mock.timers.tick(1000);
  assert.equal(workers.length, 0);
  game.pid = 42;
  options.syncNative();
  options.configure({ gameVolume: 45 });
  t.mock.timers.tick(90);
  options.configure({ gameVolume: 0 });
  t.mock.timers.tick(90);
  assert.equal(workers.length, 0);
  options.syncNative();
  t.mock.timers.tick(10);
  assert.equal(workers[0].pidArgument, '42');
  assert.deepEqual(workers[0].writes, ['0\n']);
  options.configure({ gameVolume: 120 });
  t.mock.timers.tick(100);
  options.configure({ quality: 'medium', effectsVolume: 10 });
  options.syncNative();
  t.mock.timers.tick(2000);
  assert.equal(workers.length, 1);
  assert.deepEqual(workers[0].writes, ['0\n', '100\n']);
  options.configure({ gameVolume: 17 });
  game.pid = 77;
  t.mock.timers.tick(100);
  assert.ok(workers[0].killed);
  t.mock.timers.tick(100);
  assert.equal(workers[1].pidArgument, '77');
  assert.deepEqual(workers[1].writes, ['17\n']);
  game.pid = null;
  options.syncNative();
  assert.ok(workers[1].killed);
});

test('retries helper failure once with latest volume and cancels obsolete work on close', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(console, 'warn', () => {});
  const { options, game, workers } = fixture(t);
  game.pid = 77;
  options.syncNative();
  t.mock.timers.tick(100);
  workers[0].stdin.emit('error', new Error('EPIPE'));
  workers[0].emit('exit', 1);
  options.configure({ gameVolume: 20 });
  t.mock.timers.tick(100);
  assert.deepEqual(workers[1].writes, ['20\n']);
  t.mock.timers.tick(1000);
  assert.equal(workers.length, 2);
  workers[1].emit('exit', 1);
  t.mock.timers.tick(1000);
  assert.deepEqual(workers[2].writes, ['20\n']);
  options.configure({ gameVolume: 30 });
  options.close();
  options.close();
  workers[2].emit('exit', 1);
  options.syncNative();
  t.mock.timers.tick(30000);
  assert.ok(workers[2].killed);
  assert.equal(workers.length, 3);
  assert.deepEqual(workers[2].writes, ['20\n']);
});
