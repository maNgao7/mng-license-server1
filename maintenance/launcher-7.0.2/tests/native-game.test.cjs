'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { launchNativeGame, findVoiceDrivingGame } = require('../lib/native-game.cjs');

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
