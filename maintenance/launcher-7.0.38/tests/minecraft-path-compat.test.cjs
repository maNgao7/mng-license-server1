'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { win32: paths } = require('node:path');
const { relativizeArgumentFile } = require('../lib/minecraft-path-compat.cjs');

test('Forge arguments use paths relative to a Unicode install, including shared runtime paths', () => {
    const library = 'C:\\Kullanıcı Çağrı\\.game-library';
    const root = `${library}\\snow-war\\versions\\package`;
    const instance = `${root}\\game-instance`;
    const runtime = `${library}\\shared-runtimes\\runtime`;
    const argumentsFile = [
        `-DlegacyClassPath=${runtime}\\lib1.jar;${runtime}\\lib2.jar`,
        `-Dorg.lwjgl.librarypath=${root}\\runtime\\natives`,
        '-Dmng.bridge.port=12891', '--gameDir', instance,
        '--assetsDir', `${runtime}\\assets`, '--accessToken', '0'
    ].map(value => JSON.stringify(value)).join('\n');
    const result = relativizeArgumentFile(argumentsFile, instance, [instance, root, library], paths);
    const args = result.split('\n').map(line => JSON.parse(line));
    assert.equal(args[0], '-DlegacyClassPath=..\\..\\..\\..\\shared-runtimes\\runtime\\lib1.jar;..\\..\\..\\..\\shared-runtimes\\runtime\\lib2.jar');
    assert.equal(paths.resolve(instance, args[0].split('=')[1].split(';')[0]), `${runtime}\\lib1.jar`);
    assert.equal(paths.resolve(instance, args[1].split('=')[1]), `${root}\\runtime\\natives`);
    assert.equal(args[2], '-Dmng.bridge.port=12891');
    assert.equal(args[4], '.');
    assert.equal(paths.resolve(instance, args[6]), `${runtime}\\assets`);
    assert.equal(args[8], '0');
});
