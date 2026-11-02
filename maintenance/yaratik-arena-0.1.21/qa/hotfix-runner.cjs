'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const launcher = 'C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/outputs/launcher-update-7.0.15';
const { GameLaunchSession } = require(path.join(launcher, 'lib/game-launch-session.cjs'));
const arena = require(path.join(launcher, 'lib/arena-package.cjs'));
const directory = path.resolve(process.argv[2]);
const baseline = process.argv.includes('--baseline');
process.env.TIKMNG_ARENA_QA_ROOT = path.join(directory, 'qa');
const q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = { passed: false, baseline, directory, suites: [], samples: [] };
let session;
async function sample(label) {
    await q.send('performance', { label, seconds: 10 });
    const s = await q.wait(s => !s.performanceRunning && s.frameCount > 0, label, 20000);
    result.samples.push(JSON.parse(fs.readFileSync(path.join(directory, 'qa', 'performance-' + s.performanceRun + '.json'))));
}
async function suite(name) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, name)], { cwd: path.join(directory, 'qa'), windowsHide: true,
            env: { ...process.env, TIKMNG_QA_VERSION: '0.1.21' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; });
        child.once('error', reject);
        child.once('exit', code => {
            fs.writeFileSync(path.join(directory, 'qa', name + '.log'), output);
            result.suites.push({ name, passed: code === 0 });
            console.log(name + ': ' + (code === 0 ? 'PASS' : 'FAIL'));
            if (code === 0) resolve(); else {
                let reason = output.slice(0, 2500);
                const reportName = name.replace('-tests.cjs', '-result.json');
                try { reason = JSON.parse(fs.readFileSync(path.join(directory, 'qa', reportName))).error || reason; } catch {}
                reject(new Error(name + ': ' + reason));
            }
        });
    });
}
async function main() {
    session = new GameLaunchSession({ game: 'yaratik-arena', title: 'Yaratik Arena', onProgress: p => console.log(p.phase + ': ' + p.mesaj) });
    await arena.launchArena({ directory, session, username: '' });
    await q.wait(s => s.ready && s.firstFrameRendered && s.version === (baseline ? '0.1.20' : '0.1.21'), 'First hotfix frame', 30000);
    await q.send('live-disconnect');
    await q.send('lock', { enabled: true });
    await q.send('live-events-pause', { enabled: true });
    await q.send('menu', { open: false });
    await q.send('auto-play', { enabled: false });
    await q.send('reset');
    await q.send('combat-settings', { enabled: false });
    await q.send('resolution', { width: 1280, height: 720 });
    await q.send('view', { x: 0, z: -10, yaw: 0, pitch: 12 });
    await q.send('spawn', { count: 100, user: 'qa_hotfix_crowd' });
    await q.wait(s => s.Alive === 100 && s.pending === 0, '100 native creatures', 45000);
    await sleep(2000);
    await sample((baseline ? 'before' : 'after') + '-100-native-creatures');
    const capture = await q.send('capture');
    result.capture = 'capture-' + capture.seq + '.png';
    result.labels = { visible: capture.drawnCreatureBars, reserved: capture.reservedHudProfiles };
    if (!baseline) {
        const names = process.env.TIKMNG_HOTFIX_SUITES ? process.env.TIKMNG_HOTFIX_SUITES.split(',')
            : ['labels-hotfix-tests.cjs', 'death-reset-hotfix-tests.cjs', 'regen-hotfix-tests.cjs', 'final-event-tests.cjs', 'combat-polish-tests.cjs', 'crowd-polish-tests.cjs', 'floor-vacuum-dash-tests.cjs'];
        for (const name of names) await suite(name);
    }
    assert.equal(q.state().failed, false);
    await q.send('quit');
    result.passed = true;
}
main().catch(error => { result.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
    if (session && !session.closed) await session.close();
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, 'qa', baseline ? 'hotfix-before.json' : 'hotfix-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
});
