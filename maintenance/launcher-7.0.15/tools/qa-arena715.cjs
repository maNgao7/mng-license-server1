'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const arena = require('../lib/arena-package.cjs');
const prototype = 'D:/TikMnG-CanEmAll-Prototype';
const release = process.env.MNG_ARENA715_RELEASE || 'D:/TikMnG-Yaratik-Arena-0.1.20-final';
const descriptor = require(path.join(release, 'package-descriptor.json'));
const root = path.resolve(process.env.MNG_ARENA715_QA_ROOT || 'D:/TikMnG-Arena715-FinalQA');
const report = { passed: false, startedAt: new Date().toISOString(), checks: [], live: [], syntheticGiftTests: true };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, session, q;

async function suite(name, directory) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(prototype, 'qa', name)], { cwd: path.join(directory, 'qa'), windowsHide: true,
            env: { ...process.env, TIKMNG_ARENA_QA_ROOT: path.join(directory, 'qa'), TIKMNG_QA_VERSION: '0.1.20' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; });
        child.once('error', reject);
        child.once('exit', code => {
            fs.writeFileSync(path.join(root, name + '.log'), output);
            console.log(name + ': ' + (code === 0 ? 'PASS' : 'FAIL'));
            if (code === 0) resolve(); else reject(new Error(name + ': ' + output.slice(-3000)));
        });
    });
}

async function main() {
    await fsp.mkdir(root, { recursive: true });
    server = http.createServer((req, res) => {
        if (req.url !== '/yaratik-arena.zip') { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Length': descriptor.bytes, 'Content-Type': 'application/zip' });
        fs.createReadStream(descriptor.file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const library = createGameLibrary({ root: path.join(root, 'library'), definitions: { 'yaratik-arena': { id: 'yaratik-arena', klasor: 'yaratik-arena', paketSurumu: descriptor.version } },
        resolveLegacy: () => null, validate: arena.validatePackageDirectory,
        getPackage: () => ({ version: descriptor.version, url: `http://127.0.0.1:${server.address().port}/yaratik-arena.zip`, sha256: descriptor.sha256, bytes: descriptor.bytes }),
        preservePaths: () => ['userdata', 'game'], onProgress: progress => { if (progress.phase !== report.lastPhase) { report.lastPhase = progress.phase; console.log('Install: ' + progress.phase); } } });
    await library.install('yaratik-arena');
    assert.equal(library.state('yaratik-arena').installed, true);
    const directory = library.pathFor('yaratik-arena');
    report.directory = directory;
    report.checks.push('Actual compressed game package passes safe extraction, SHA-256 and library activation in an empty game library.');
    process.env.TIKMNG_ARENA_QA_ROOT = path.join(directory, 'qa');
    q = require(path.join(prototype, 'qa/commands.cjs'));
    session = new GameLaunchSession({ game: 'yaratik-arena', title: 'Yaratik Arena', onProgress: progress => console.log(progress.phase + ': ' + progress.mesaj) });
    await arena.launchArena({ directory, session, username: 'bencezehra' });
    const started = await q.wait(s => s.ready && s.firstFrameRendered && !s.failed, 'Actual packaged first frame', 20000);
    report.gameProcessId = started.processId;
    assert.equal(started.fullscreenMode, 'FullScreenWindow', 'Shipping game always starts in borderless fullscreen');
    const defaults = JSON.parse(await fsp.readFile(path.join(directory, 'userdata/mod-settings.json')));
    assert.equal(defaults.LikeThreshold, 100); assert.equal(defaults.LikeAction.Count, 5); assert.equal(defaults.FollowAction.Count, 5);
    assert.equal(defaults.Actions.find(action => action.GiftId === '5658').Count, 25);
    assert.equal(defaults.Actions.find(action => action.GiftId === '5319').Count, 10);
    const launch = JSON.parse(await fsp.readFile(path.join(directory, 'qa/startup-launch.json')));
    report.startup = launch;
    assert.equal(launch.gameProcessId, started.processId);
    assert.equal(launch.outcome, 'ready');
    assert.ok(Date.parse(launch.firstPaintUtc) <= Date.parse(launch.gameStartedUtc));
    await q.send('audio-probe');
    const initialAudio = JSON.parse(await fsp.readFile(path.join(directory, 'qa/audio-probe.json')));
    assert.equal(initialAudio.nativeMaster, 71); assert.equal(initialAudio.nativeMusic, 3); assert.equal(initialAudio.nativeSfx, 80);
    assert.equal(initialAudio.audioError, '');
    report.checks.push('Native first-install sliders start at master 71, music 3 and effects 80.');
    report.checks.push('Fresh Steam-derived isolated copy generates its own loader state and reaches real first-frame readiness through the shipping launcher bootstrap.');
    if (process.argv.includes('--boot-only')) {
        report.mode = 'boot-only';
        await q.send('quit');
        await session.close();
        report.passed = true;
        return;
    }
    await q.send('lock', { enabled: true });
    await q.send('combat-settings', { enabled: false });
    const accounts = (process.env.MNG_ARENA715_LIVE_USERS || 'bencezehra,barbarpm').split(',').map(value => value.trim().replace(/^@/, '')).filter(Boolean);
    for (const username of accounts) {
        await q.send('live-connect', { username });
        let live = await q.wait(s => s.live.username === username && ['connected', 'waiting', 'error'].includes(s.live.status), 'Live ' + username, 40000);
        if (live.live.status !== 'connected') {
            report.live.push({ username, status: live.live.status, available: false });
            console.log('Live ' + username + ': ' + live.live.status + '; continuing with the next account and native regressions.');
            await q.send('live-disconnect');
            continue;
        }
        const deadline = Date.now() + 45000;
        do {
            await sleep(1500);
            live = await q.send('report');
        } while (Date.now() < deadline && live.live.status === 'connected' && (!live.live.received || !live.realAvatarFiles));
        if (live.live.status !== 'connected' || !live.live.received || !live.realAvatarFiles) {
            report.live.push({ username, status: live.live.status, received: live.live.received, avatarFiles: live.realAvatarFiles, verifiedEvents: false });
            console.log('Live ' + username + ': no verified event/profile within 45 seconds; continuing native regressions.');
            await q.send('live-disconnect');
            continue;
        }
        for (let index = 0; index < 5; index++) await q.send('avatar-test');
        await q.wait(s => s.loadedLivePortraits > 0 && !s.hudError, 'Real live profiles in native renderer', 10000);
        live = await q.send('capture');
        report.live.push({ username, status: live.live.status, received: live.live.received, giftEvents: live.live.giftEvents,
            likeEvents: live.live.likeEvents, followEvents: live.live.followEvents, applied: live.liveApplied, unmapped: live.liveUnmapped,
            avatarFiles: live.realAvatarFiles, loadedLivePortraits: live.loadedLivePortraits, verifiedEvents: true, capture: 'capture-' + live.seq + '.png' });
        assert.equal(live.failed, false);
        assert.equal(live.hudError, '');
        await q.send('reset');
    }
    const connectedAccounts = report.live.filter(item => item.verifiedEvents);
    if (connectedAccounts.length) report.checks.push(connectedAccounts.length + ' available account(s) connected inside the actual packaged native game, delivered real live events and rendered live profile portraits. No messages or gifts were sent by the test.');
    await q.send('live-disconnect');
    if (process.argv.includes('--live-only')) {
        report.mode = 'live-only';
        report.livePassed = connectedAccounts.length > 0;
        assert.ok(report.livePassed, 'No available account delivered verified live events and a rendered portrait.');
        await q.send('quit');
        await session.close();
        report.passed = true;
        return;
    }
    await q.send('combat-settings', { enabled: true });
    await q.send('lock', { enabled: false });
    for (const name of ['final-event-tests.cjs', 'combat-polish-tests.cjs', 'crowd-polish-tests.cjs', 'floor-vacuum-dash-tests.cjs']) await suite(name, directory);
    await q.send('audio-probe');
    const audio = JSON.parse(await fsp.readFile(path.join(directory, 'qa/audio-probe.json')));
    assert.equal(audio.nativeMaster, 71); assert.equal(audio.nativeMusic, 3); assert.equal(audio.nativeSfx, 80); assert.equal(audio.audioError, '');
    report.checks.push('First-install audio defaults are 71/3/80; actual package completes the gift/audience, combat, crowd, floor, dash and vacuum regression suites.');
    const repeated = await arena.prepareLaunch({ directory });
    assert.equal(repeated.copiedBytes, 0);
    const before = await fsp.readFile(path.join(directory, 'userdata/mod-settings.json'));
    await q.send('quit');
    await session.close();
    await library.install('yaratik-arena', { repair: true });
    const repaired = library.pathFor('yaratik-arena');
    assert.deepEqual(await fsp.readFile(path.join(repaired, 'userdata/mod-settings.json')), before);
    assert.equal((await arena.prepareLaunch({ directory: repaired })).copiedBytes, 0);
    report.checks.push('Second preparation performs no base-game copy; library repair preserves settings and the locally prepared Steam copy.');
    report.nativePassed = true;
    report.livePassed = connectedAccounts.length > 0;
    assert.ok(report.livePassed, 'Native regressions passed, but no supplied account is currently live. Repeat with an available account before publishing.');
    report.passed = true;
}
main().catch(error => { report.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
    if (session && !session.closed) await session.close();
    if (server) await new Promise(resolve => server.close(resolve));
    report.finishedAt = new Date().toISOString();
    await fsp.mkdir(root, { recursive: true });
    await fsp.writeFile(path.join(root, process.argv.includes('--live-only') ? 'arena-live-result.json' : 'arena-package-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
});
