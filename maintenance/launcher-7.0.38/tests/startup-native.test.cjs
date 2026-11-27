'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const arena = require('../lib/arena-package.cjs');
const forza = require('../lib/forza-package.cjs');

const original = 'verified';
const modified = 'modified';
const fixedTime = new Date('2024-01-01T00:00:00Z');
const probe = 'assets/nested/data-0.bin';

async function fixture(t, pkg) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'tikmng-native-test-'));
    t.after(async () => {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.match(path.basename(root), /^tikmng-native-test-/);
        await fsp.rm(root, { recursive: true, force: true });
    });
    const directory = path.join(root, 'package');
    const dataDirectory = path.join(root, 'data');
    const steam = { directory: path.join(root, 'steam'), buildId: '123' };
    const game = pkg === arena ? path.join(directory, 'game') : path.join(dataDirectory, 'runtime');
    const marker = pkg === arena ? path.join(game, '.tikmng-steam-copy.json') : path.join(dataDirectory, '.tikmng-forza-install.json');
    const settings = pkg === arena ? path.join(directory, 'userdata', 'settings.json') : path.join(dataDirectory, 'control', 'settings.json');
    async function put(dir, relative, content = original) {
        const file = path.join(dir, relative);
        await fsp.mkdir(path.dirname(file), { recursive: true });
        await fsp.writeFile(file, content);
        await fsp.utimes(file, fixedTime, fixedTime);
        return { path: relative, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') };
    }
    const required = pkg === arena ? [
        'bootstrap/TikMnG.Arena.Startup.exe', 'support/Mods/TikMnG.CanEmAll.dll', 'support/version.dll',
        'runtime/host/fxr/6.0.36/hostfxr.dll', 'bridge/index.cjs', 'bridge/runtime/node.exe',
        'catalog/gifts.json', 'defaults/game-settings.json'
    ] : pkg.REQUIRED;
    const files = [];
    for (const relative of [...required, ...Array.from({ length: 50 }, (_, i) => `assets/nested/data-${i}.bin`)]) {
        files.push(await put(directory, relative, relative === 'defaults/settings.json' ? '{}' : original));
    }
    const baseFiles = [];
    for (const relative of [pkg.EXECUTABLE, 'UnityPlayer.dll', 'GameAssembly.dll', ...(pkg === forza ? [
        'iracing-arcade_Data/il2cpp_data/Metadata/global-metadata.dat'
    ] : [])]) baseFiles.push(await put(steam.directory, relative));
    const manifest = { schemaVersion: 1, type: pkg.TYPE, platform: 'win32-x64', version: '1.2.3',
        steam: { appId: pkg.APP_ID, buildId: steam.buildId }, files, baseFiles };
    await fsp.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    return { root, directory, dataDirectory, steam, game, marker, settings, manifest, put };
}

for (const [name, pkg] of [['Arena', arena], ['Forza', forza]]) {
    test(`${name} hashes cold files once per copy and checks warm files without rehashing`, async t => {
        const x = await fixture(t, pkg);
        const read = t.mock.method(fs, 'createReadStream');
        const lstat = t.mock.method(fs, 'lstatSync');
        const readdir = t.mock.method(fsp, 'readdir');
        const copied = pkg === arena ? x.manifest.files.filter(row => row.path.startsWith('support/')) : x.manifest.files;
        assert.ok((await pkg.prepareLaunch(x)).copiedBytes > 0);
        assert.equal(read.mock.callCount(), x.manifest.files.length + x.manifest.baseFiles.length + copied.length);
        assert.ok(read.mock.calls.filter(call => call.arguments[0].endsWith('.tikmng-copy')).length > 0);
        const stat = await fsp.lstat(x.marker, { bigint: true });
        await x.put(path.dirname(x.settings), path.basename(x.settings), '{"saved":true}');
        for (const spy of [read, lstat, readdir]) spy.mock.resetCalls();

        assert.equal((await pkg.prepareLaunch(x)).copiedBytes, 0);
        assert.equal(read.mock.callCount(), 0);
        const assets = path.join(x.directory, 'assets', 'nested');
        assert.equal(readdir.mock.calls.filter(call => call.arguments[0] === assets).length, 1);
        assert.ok(lstat.mock.calls.every(call => !call.arguments[0].startsWith(assets + path.sep)));
        const after = await fsp.lstat(x.marker, { bigint: true });
        assert.equal(after.ino, stat.ino);
        assert.equal(after.mtimeNs, stat.mtimeNs);
        assert.equal(await fsp.readFile(x.settings, 'utf8'), '{"saved":true}');

        await pkg.verifyPackage(x.directory);
        assert.equal(read.mock.callCount(), x.manifest.files.length);
    });

    test(`${name} warm preparation rejects additions, missing files, junctions and same-size edits`, async t => {
        const x = await fixture(t, pkg);
        await pkg.prepareLaunch(x);
        const file = path.join(x.directory, probe);
        const assets = path.dirname(file);
        const unexpected = path.join(assets, 'extra.bin');
        await fsp.writeFile(unexpected, original);
        await assert.rejects(pkg.prepareLaunch(x), /unlisted/i);
        await fsp.unlink(unexpected);
        await fsp.unlink(file);
        await assert.rejects(pkg.prepareLaunch(x), /unlisted|integrity/i);
        await x.put(x.directory, probe);
        await pkg.prepareLaunch(x);

        const previous = await fsp.lstat(file, { bigint: true });
        await x.put(x.directory, probe, modified);
        assert.equal((await fsp.lstat(file, { bigint: true })).mtimeNs, previous.mtimeNs);
        await assert.rejects(pkg.prepareLaunch(x), /integrity/i);
        await x.put(x.directory, probe);
        await pkg.prepareLaunch(x);

        const moved = path.join(x.root, 'moved-assets');
        await fsp.rename(assets, moved);
        await fsp.symlink(moved, assets, 'junction');
        await assert.rejects(pkg.prepareLaunch(x), /link/i);
    });

    test(`${name} stages repairs and leaves the destination intact on hash failure or cancellation`, async t => {
        const x = await fixture(t, pkg);
        await pkg.prepareLaunch(x);
        const name = 'GameAssembly.dll';
        const target = path.join(x.game, name);
        await x.put(x.game, name, modified);
        await x.put(x.steam.directory, name, modified);
        await assert.rejects(pkg.prepareLaunch(x), /integrity|verification/i);
        assert.equal(await fsp.readFile(target, 'utf8'), modified);
        assert.ok((await fsp.readdir(x.game)).every(name => !name.endsWith('.tikmng-copy')));

        await x.put(x.steam.directory, name);
        const controller = new AbortController(), createReadStream = fs.createReadStream;
        const read = t.mock.method(fs, 'createReadStream', (file, options) => {
            if (path.basename(file).startsWith(name + '.') && file.endsWith('.tikmng-copy')) controller.abort();
            return createReadStream(file, options);
        });
        await assert.rejects(pkg.prepareLaunch({ ...x, signal: controller.signal }), /abort/i);
        assert.equal(await fsp.readFile(target, 'utf8'), modified);
        assert.ok((await fsp.readdir(x.game)).every(name => !name.endsWith('.tikmng-copy')));
        read.mock.restore();

        assert.equal((await pkg.prepareLaunch(x)).copiedBytes, Buffer.byteLength(original));
        assert.equal(await fsp.readFile(target, 'utf8'), original);
        assert.equal(JSON.parse(await fsp.readFile(x.marker, 'utf8')).complete, true);
    });
}
