'use strict';
const assert = require('node:assert/strict');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { createGameOptions } = require('../src/game-options.cjs');

test('native helper rejects a live non-boxing PID before applying volume', { skip: process.platform !== 'win32' }, () => {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Mta', '-File',
    path.join(__dirname, '../tools/game-volume.ps1'), '-GameProcessId', String(process.pid)],
  { windowsHide: true, input: '0\n', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 3);
});

test('Windows applies the latest level to newly created sessions of only the supplied PID',
  { skip: process.platform !== 'win32', timeout: 40000 }, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hediye-audio-fixture-'));
    // Only this freshly compiled test binary passes the helper's name guard.
    // Two instances with the same basename test PID isolation.
    const exe = path.join(dir, 'boxing.exe');
    const exits = [];
    const clients = [];
    let gamePid = null;
    const options = createGameOptions({ settingsPath: path.join(dir, 'settings.json'), getGamePid: () => gamePid });
    t.after(async () => {
      options.close();
      for (const child of clients) child.stdin.end();
      await Promise.all(exits);
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    });

    const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET/Framework/v4.0.30319/csc.exe');
    execFileSync(compiler, ['/nologo', '/out:' + exe, path.join(__dirname, 'audio-session-fixture.cs')], { windowsHide: true });
    async function client() {
      const child = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] });
      clients.push(child);
      exits.push(once(child, 'exit'));
      const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
      const { value } = await lines.next();
      if (value === 'no-endpoint') return null;
      assert.equal(value, 'ready');
      return {
        pid: child.pid,
        async request(command) {
          child.stdin.write(command + '\n');
          const reply = await lines.next();
          assert.equal(reply.done, false, 'fixture exited before reporting its own session level');
          return reply.value;
        },
      };
    }
    async function expectLevels(client, expected, timeout) {
      const deadline = Date.now() + timeout;
      let actual;
      do {
        actual = await client.request('levels');
        if (actual === expected) return;
        await delay(100);
      } while (Date.now() < deadline);
      assert.equal(actual, expected);
    }

    const target = await client();
    if (!target) return t.skip('Windows has no default render endpoint');
    const other = await client();
    assert.equal(await other.request('open'), 'opened');
    gamePid = target.pid;
    options.configure({ gameVolume: 35 });
    options.configure({ gameVolume: 37 });
    await delay(1200); // The target is alive before it owns a rendering session.
    assert.equal(await target.request('open'), 'opened');
    await expectLevels(target, '37', 7000);
    assert.equal(await other.request('levels'), '88');

    assert.equal(await target.request('open'), 'opened');
    await expectLevels(target, '37,37', 15000); // No slider change or sync notification.
    options.configure({ gameVolume: 70 });
    options.configure({ gameVolume: 0 });
    await expectLevels(target, '0,0', 4000);
    assert.equal(await other.request('levels'), '88');
  });
