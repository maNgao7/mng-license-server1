'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { launchNativeGame, findVoiceDrivingGame } = require('../lib/native-game.cjs');
const { showNativeWindow } = require('../lib/native-window.cjs');
const { GameLaunchSession } = require('../lib/game-launch-session.cjs');
const output = 'D:/TikMnG-QA-Delivery/7.0.0';
const events = [];
const session = new GameLaunchSession({ game: 'caahr', title: 'Sesli Surus', onProgress: event => events.push(event) });
(async () => {
    const directory = findVoiceDrivingGame();
    assert.ok(directory, 'Modded Steam demo is required for this real-window test');
    const child = await session.stage('engine', 'Game starting', () => launchNativeGame({ session, directory, executable: 'CAAAHR.exe' }));
    const window = await session.stage('window', 'Window opening', () => showNativeWindow(child.pid), 40000);
    await session.stage('game-ready', 'Game menu and bridge', () => session.waitForHttp('http://127.0.0.1:4051/api/state', {
        timeoutMs: 60000, validate: state => state.product === 'tikmng-caaahr-voice' && state.game?.processId === child.pid && state.game.menuReady && Date.now() - state.game.receivedAt < 3000
    }), 65000);
    session.markReady();
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'native-window.json'), JSON.stringify({ passed: true, window, events }, null, 2));
    console.log(JSON.stringify({ passed: true, visible: window.visible, foreground: window.foreground, pid: child.pid }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await session.close(); });
