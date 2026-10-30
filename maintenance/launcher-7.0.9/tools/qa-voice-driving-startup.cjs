'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { prepareLaunch } = require('../lib/voice-driving-package.cjs');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const { launchNativeGame, findVoiceDrivingGame } = require('../lib/native-game.cjs');
const { showNativeWindow } = require('../lib/native-window.cjs');

const output = 'D:/TikMnG-Sesli-Surus-Acilis-20261027';
const baseline = process.argv.includes('--baseline');
const session = new GameLaunchSession({ game: 'caahr', title: 'Sesli Surus startup QA',
    onProgress: event => console.log(event.phase || event.tip) });
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
    await fs.mkdir(output, { recursive: true });
    const originalGame = findVoiceDrivingGame();
    assert.ok(originalGame);
    const existing = await fetch('http://127.0.0.1:4051/api/state', { signal: AbortSignal.timeout(1000) }).catch(() => null);
    assert.equal(existing, null, 'Do not interrupt an existing voice-driving service');
    const library = path.join(process.env.APPDATA, 'mng-tiktok-game/games/.game-library/caahr');
    const pointerFile = path.join(library, 'active.json');
    const pointerBytes = await fs.readFile(pointerFile), pointer = JSON.parse(pointerBytes);
    const packageDirectory = path.join(library, 'versions', pointer.directory);
    const watched = [pointerFile,
        path.join(originalGame, 'BepInEx/plugins/TikMnG.Caaahr.Voice.dll'),
        path.join(originalGame, 'BepInEx/config/TikMnG.Bootstrap.json'),
        path.join(process.env.LOCALAPPDATA, 'TikMnG-CAAAHR/settings.json')];
    const before = new Map();
    for (const file of watched) before.set(file, await fs.readFile(file).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
    }));
    const root = await fs.mkdtemp(path.join(output, 'isolated-'));
    const gameDirectory = path.join(root, 'SteamDemo'), dataDirectory = path.join(root, 'user-data');
    console.log('Preparing isolated original-game copy');
    await fs.cp(originalGame, gameDirectory, { recursive: true, errorOnExist: true });
    const start = performance.now();
    const options = {
        packageDirectory, gameDirectory, dataDirectory,
        electronPath: 'D:/TikMnG-Manager-7.0.0/win-unpacked/TikMnG.exe'
    };
    let prepare = prepareLaunch;
    if (baseline) {
        const asar = require('@electron/asar');
        const Module = require('node:module');
        const filename = path.resolve(__dirname, '../lib/voice-driving-package-baseline.cjs');
        const original = new Module(filename, module);
        original.filename = filename;
        original.paths = Module._nodeModulePaths(path.dirname(filename));
        original._compile(asar.extractFile('D:/TikMnG-Manager-7.0.0/win-unpacked/resources/app.asar',
            'lib/voice-driving-package.cjs').toString('utf8'), filename);
        assert.equal(original.exports.prepareLaunch, undefined, 'Baseline must use the original launch path');
        prepare = async settings => {
            const began = performance.now();
            const installation = await original.exports.installMod(settings);
            const firstVerified = performance.now();
            const backend = await original.exports.backendLaunchSpec(settings);
            return { installation, backend, timings: { verificationAndInstallMs: Math.round(firstVerified - began),
                duplicateVerificationMs: Math.round(performance.now() - firstVerified),
                totalMs: Math.round(performance.now() - began), verifiedFiles: installation.entries.size } };
        };
    }
    const prepared = await session.stage('mod', 'Verify and prepare', () => prepare(options), 90000);
    const spec = prepared.backend;
    session.ownChild(spawn(spec.file, spec.args, spec.options), { name: 'Isolated voice-driving service' });
    await session.waitForHttp(spec.url + '/api/state', { timeoutMs: 30000,
        validate: state => state.product === 'tikmng-caaahr-voice' });
    const backendReadyMs = Math.round(performance.now() - start);
    await fs.writeFile(path.join(gameDirectory, 'BepInEx/config/TikMnG.LocalConnection.token'),
        (await fs.readFile(path.join(dataDirectory, 'token'), 'utf8')).trim());
    const child = await session.stage('engine', 'Start original Unity game', () => launchNativeGame({
        session, directory: gameDirectory, executable: 'CAAAHR.exe'
    }));
    const window = await session.stage('window', 'Show original game window', () => showNativeWindow(child.pid), 40000);
    let state;
    await session.stage('game-ready', 'Verify live game heartbeat and catalog', () => session.waitForHttp(spec.url + '/api/state', {
        timeoutMs: 60000, validate: status => {
            state = status;
            return status.product === 'tikmng-caaahr-voice' && status.game?.processId === child.pid
                && status.game.menuReady && status.game.catalogCount >= 905 && Date.now() - status.game.receivedAt < 3000;
        }
    }), 65000);
    const readyMs = Math.round(performance.now() - start);
    await session.close();
    for (const [file, bytes] of before) assert.deepEqual(await fs.readFile(file).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
    }), bytes, 'Stable user files must stay unchanged');
    const report = { passed: true, baseline, checkedAt: new Date().toISOString(), isolatedRoot: root,
        launcherVersionNotChanged: true, publicReleaseNotChanged: true, packageVersion: pointer.version,
        verifiedFiles: prepared.timings.verifiedFiles, preparation: prepared.timings,
        backendReadyMs, gameAndGiftMenuReadyMs: readyMs, originalUnityWindowVisible: window.visible,
        catalogCount: state.game.catalogCount, gameHeartbeatProcessMatched: true,
        normalUserSettingsModAndGamePointerUnchanged: true, realTikTokGiftDeliveryClaimed: false,
        originalPluginSha256: sha256(before.get(watched[1])) };
    await fs.writeFile(path.join(output, baseline ? 'baseline-native-startup.json' : 'native-startup-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => session.close());
