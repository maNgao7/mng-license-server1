'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createUnturnedProcessControl } = require('../lib/unturned-startup.cjs');

const execute = promisify(execFile);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('native Windows discovery/window/cleanup uses only disposable Unturned fixtures',
    { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tikmng-unturned-qa-'));
        const children = [];
        t.after(async () => {
            for (const child of children) {
                if (child.exitCode == null && child.signalCode == null) {
                    const exited = new Promise(resolve => child.once('exit', resolve));
                    child.kill(); await exited;
                }
            }
            assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
            assert.match(path.basename(root), /^tikmng-unturned-qa-/);
            await fs.rm(root, { recursive: true, force: true });
        });
        const directory = path.join(root, 'game'), decoyDirectory = path.join(root, 'other-install');
        await fs.mkdir(directory); await fs.mkdir(decoyDirectory);
        const file = path.join(directory, 'Unturned.exe');
        const source = `using System;
using System.Windows.Forms;
public static class DisposableUnturned {
  [STAThread] public static void Main(string[] args) {
    Application.EnableVisualStyles();
    using(var window = new Form()) {
      window.Text = "TikMnG disposable Unturned fixture";
      window.Width = 360; window.Height = 160;
      using(var shutdown = new Timer()) {
        shutdown.Interval = 30000; shutdown.Tick += (s,e) => window.Close(); shutdown.Start();
        Application.Run(window);
      }
    }
  }
}`;
        const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
        const script = "$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition @'\n" + source +
            "\n'@ -Language CSharp -ReferencedAssemblies System.Windows.Forms,System.Drawing -OutputType WindowsApplication -OutputAssembly '" + file.replace(/'/g, "''") + "'";
        await execute(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
            { windowsHide: true, timeout: 15000, maxBuffer: 65536 });
        const decoyFile = path.join(decoyDirectory, 'Unturned.exe');
        await fs.copyFile(file, decoyFile);
        const control = createUnturnedProcessControl({ directory, queryTimeoutMs: 10000 });
        const decoyControl = createUnturnedProcessControl({ directory: decoyDirectory, queryTimeoutMs: 10000 });
        assert.deepEqual(await control.probe(), []);

        async function start(executable, token) {
            const child = spawn(executable, ['-tikmng-launch=' + token], { cwd: path.dirname(executable), stdio: 'ignore', windowsHide: false });
            children.push(child);
            await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
            return child;
        }
        const token = 'a'.repeat(32), decoyToken = 'b'.repeat(32);
        const decoy = await start(decoyFile, decoyToken);
        assert.deepEqual(await control.probe(), [], 'a real process from another installation must not match');
        const child = await start(file, token);
        let identity;
        const until = Date.now() + 12000;
        do {
            const rows = await control.probe();
            identity = rows.find(row => row.pid === child.pid);
            if (identity?.windowHandle !== '0' && identity?.responding) break;
            await pause(100);
        } while (Date.now() < until);
        assert.ok(identity, 'own real fixture process was discovered');
        assert.equal(identity.pid, child.pid); assert.equal(identity.launchToken, token);
        assert.equal(identity.executablePath.toLowerCase(), file.toLowerCase());
        assert.notEqual(identity.windowHandle, '0'); assert.equal(identity.responding, true);
        assert.ok(identity.startedAt > Date.now() - 20000);

        for (const wrong of [{ launchToken: decoyToken }, { startTicks: (BigInt(identity.startTicks) + 1n).toString() }]) {
            await assert.rejects(control.stop({ ...identity, ...wrong }), /identity changed/);
            assert.ok((await control.probe()).some(row => row.pid === child.pid), 'wrong identity must not kill even this disposable process');
        }
        assert.equal((await control.stop(identity)).stopped, true);
        assert.deepEqual(await control.probe(), []);
        assert.equal((await control.stop(identity)).absent, true);
        const decoyIdentity = (await decoyControl.probe()).find(row => row.pid === decoy.pid);
        assert.ok(decoyIdentity, 'cleanup left the other installation running');
        assert.equal((await decoyControl.stop(decoyIdentity)).stopped, true);
        assert.deepEqual(await decoyControl.probe(), []);
    });
