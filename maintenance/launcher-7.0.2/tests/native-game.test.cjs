'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { launchNativeGame, findVoiceDrivingGame, nativeOwnsLiveSession } = require('../lib/native-game.cjs');
const fs = require('node:fs');
const os = require('node:os');

test('released and preview Minecraft clients own their live session, but older installed clients keep HTTP handoff', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-native-owner-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    assert.equal(nativeOwnsLiveSession('minecraft-snake-arena', directory), true);
    assert.equal(nativeOwnsLiveSession('snow-war', directory), false);
    for (const version of ['7.0.2', '7.0.2-preview.5', '7.1.0', '8.0.0', '6.5.16', '7.0.1', 'bad']) {
        fs.writeFileSync(path.join(directory, '.tikmng-package.json'), JSON.stringify({version}));
        const expected = ['7.0.2', '7.0.2-preview.5', '7.1.0', '8.0.0'].includes(version);
        for (const game of ['snow-war', 'battle-royale']) assert.equal(nativeOwnsLiveSession(game, directory), expected, game + '/' + version);
        assert.equal(nativeOwnsLiveSession('zombie-war', directory), false);
    }
    fs.writeFileSync(path.join(directory, '.tikmng-package.json'), 'invalid json');
    assert.equal(nativeOwnsLiveSession('battle-royale', directory), false);
});

test('voice driving discovery requires both original game and installed mod',()=>{
    const root=path.join('D:/SteamLibrary','steamapps/common','CAAAHR! Demo');
    const files=new Set([path.join(root,'CAAAHR.exe'),path.join(root,'BepInEx/plugins/TikMnG.Caaahr.Voice.dll')]);
    assert.equal(findVoiceDrivingGame({exists:file=>files.has(file),env:{}}),root);
    files.delete(path.join(root,'BepInEx/plugins/TikMnG.Caaahr.Voice.dll'));
    assert.equal(findVoiceDrivingGame({exists:file=>files.has(file),env:{}}),null);
    assert.equal(findVoiceDrivingGame({exists:file=>files.has(file),env:{},requireMod:false}),root);
});

test('native game owns its exact child and launches only the selected package', async () => {
    const directory = path.resolve(__dirname, '../packages');
    const child = new EventEmitter();
    let owned;
    await launchNativeGame({ directory, executable: 'CAAAHR.exe',
        session: { ownChild: (value, options) => { owned = value; assert.equal(options.normalExit, true); } },
        spawnProcess: (file, args, options) => {
            assert.equal(file, path.join(directory, 'CAAAHR.exe'));
            assert.deepEqual(args, []);
            assert.equal(options.cwd, directory);
            assert.equal(options.windowsHide, false);
            queueMicrotask(() => child.emit('spawn'));
            return child;
        }
    });
    assert.equal(owned, child);
});

test('native spawn failures reject and unsafe paths never spawn', async () => {
    const directory = path.resolve(__dirname, '../packages');
    const session = { ownChild() {} };
    await assert.rejects(launchNativeGame({ directory, session, executable: 'CAAAHR.exe',
        spawnProcess: () => {
            const child = new EventEmitter();
            queueMicrotask(() => child.emit('error', new Error('ENOENT')));
            return child;
        }
    }), /ENOENT/);
    assert.throws(() => launchNativeGame({ directory, session, executable: '../other.exe',
        spawnProcess: () => assert.fail('must not spawn') }));
});
