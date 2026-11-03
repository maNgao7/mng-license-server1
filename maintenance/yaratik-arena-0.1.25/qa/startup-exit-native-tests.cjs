'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const launcher = 'C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/outputs/launcher-update-7.0.15';
const { GameLaunchSession } = require(path.join(launcher, 'lib/game-launch-session.cjs'));
const arena = require(path.join(launcher, 'lib/arena-package.cjs'));
const directory = path.resolve(process.argv[2]);
const version = process.env.TIKMNG_QA_VERSION || '0.1.24';
process.env.TIKMNG_ARENA_QA_ROOT = path.join(directory, 'qa');
const q = require('./commands.cjs');
const result = { passed: false, directory, cycles: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let session;
async function suite(name) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, name)], { cwd: path.join(directory, 'qa'), windowsHide: true,
            env: { ...process.env, TIKMNG_QA_VERSION: version }, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; });
        child.once('error', reject); child.once('exit', code => {
            fs.writeFileSync(path.join(directory, 'qa', name + '.log'), output);
            console.log(name + ': ' + (code === 0 ? 'PASS' : 'FAIL'));
            if (code === 0) resolve(); else reject(new Error(output.slice(0, 4000)));
        });
    });
}
async function main() {
    const settingsFile = path.join(directory, 'userdata/mod-settings.json');
    const original = fs.readFileSync(settingsFile);
    const saved = JSON.parse(original);
    for (let cycle = 0; cycle < 3; cycle++) {
        let child, exit;
        session = new GameLaunchSession({ game: 'yaratik-arena', title: 'Yaratik Arena', onProgress: p => console.log(p.phase) });
        await arena.launchArena({ directory, session, username: 'mangao7tv', spawnProcess: (...args) => {
            child = spawn(...args);
            child.once('exit', (code, signal) => { exit = { code, signal }; });
            return child;
        } });
        const s = await q.wait(s => s.ready && s.firstFrameRendered && s.version === version, 'Real native ' + version + ' frame', 20000);
        assert.equal(s.fullscreenMode, 'FullScreenWindow');
        if (cycle === 0) {
            await suite('connection-menu-hotfix-tests.cjs');
            if (process.argv.includes('--gameplay')) {
                for (const name of ['ammo-native-tests.cjs', 'pursuit-tests.cjs', 'final-event-tests.cjs', 'chase-tests.cjs']) await suite(name);
            }
            await q.send('connection-edit', { username: 'qa_arena_resume' });
            await q.send('connection-connect');
        } else {
            assert.equal(s.savedBroadcasterUsername, 'qa_arena_resume', 'A forced launcher account cannot replace the last game account across restarts');
            assert.equal(s.AutoConnect, cycle === 1);
            assert.equal(s.liveConnectionRequested, cycle === 1, 'Manual disconnect survives a game restart');
            if (cycle === 1) {
                assert.equal(s.selectedBroadcaster, 'qa_arena_resume');
                await q.send('live-disconnect');
            } else {
                if (saved.BroadcasterUsername) {
                    await q.send('live-connect', { username: saved.BroadcasterUsername });
                    if (!saved.AutoConnect) await q.send('live-disconnect');
                } else await q.send('live-disconnect', { clear: true });
                assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)), saved);
                fs.writeFileSync(settingsFile, original);
            }
        }
        await q.send('menu', { open: false });
        await q.send('quit');
        const end = Date.now() + 10000;
        while (Date.now() < end && (!exit || !session.closed)) await sleep(100);
        assert.ok(exit, 'Closing the native game must also exit the startup host; no hidden error dialog can remain');
        assert.equal(exit.code, 0, 'Normal game exit propagates success instead of a spurious startup error');
        assert.equal(exit.signal, null);
        assert.equal(session.error, null);
        assert.equal(session.closed, true);
        result.cycles.push({ cycle: cycle + 1, gameProcessId: s.processId, hostProcessId: child.pid, exit, normalSessionClose: true });
        console.log('Normal native exit ' + (cycle + 1) + ': PASS');
    }
    assert.deepEqual(fs.readFileSync(settingsFile), original, 'Saved account and every custom setting are restored byte-for-byte');
    result.lastAccountSurvivesRestart = true;
    result.disconnectSurvivesRestart = true;
    result.passed = true;
}
main().catch(error => { result.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
    if (session && !session.closed) await session.close();
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, 'qa', 'startup-exit-native-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
});
