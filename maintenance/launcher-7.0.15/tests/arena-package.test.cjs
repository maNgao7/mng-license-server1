'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const arena = require('../lib/arena-package.cjs');
const vdf = require('../lib/vendor/steam-vdf/lib/index.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'tikmng-arena-package-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('tikmng-arena-package-'));
        await fsp.rm(root, { recursive: true, force: true });
    });
    const directory = path.join(root, 'mod'), steamDirectory = path.join(root, 'Steam Demo');
    const files = [], baseFiles = [];
    async function put(base, relative, content) {
        const bytes = Buffer.from(content);
        await fsp.mkdir(path.dirname(path.join(base, relative)), { recursive: true });
        await fsp.writeFile(path.join(base, relative), bytes);
        return { path: relative, bytes: bytes.length, sha256: hash(bytes) };
    }
    for (const name of ['bootstrap/TikMnG.Arena.Startup.exe', 'support/Mods/TikMnG.CanEmAll.dll',
        'support/version.dll', 'runtime/host/fxr/6.0.36/hostfxr.dll', 'bridge/index.cjs',
        'bridge/runtime/node.exe', 'catalog/gifts.json', 'defaults/game-settings.json']) files.push(await put(directory, name, 'fixture:' + name));
    for (const name of [arena.EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', "Can 'Em All Demo_Data/il2cpp_data/Metadata/global-metadata.dat"]) baseFiles.push(await put(steamDirectory, name, 'original:' + name));
    const manifest = { type: arena.TYPE, schemaVersion: 1, platform: 'win32-x64', version: '0.1.20', steam: { appId: arena.APP_ID, buildId: '123' }, files, baseFiles };
    async function save() { await fsp.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest)); }
    await save();
    return { root, directory, steam: { directory: steamDirectory, buildId: '123' }, manifest, save, put };
}

test('Steam library discovery parses relocated libraries and requires actual demo files', t => {
    const root = path.resolve('C:/Steam'), library = path.resolve('D:/Custom Library');
    const texts = new Map([
        [path.join(root, 'steamapps/libraryfolders.vdf'), vdf.stringify({ libraryfolders: { 0: { path: library } } })],
        [path.join(library, 'steamapps/appmanifest_5364590.acf'), vdf.stringify({ AppState: { appid: '5364590', StateFlags: '4', installdir: 'Can Em Demo', buildid: '123' } })]
    ]);
    const expected = path.join(library, 'steamapps/common/Can Em Demo');
    const readFile = file => { if (!texts.has(file)) throw new Error('missing'); return texts.get(file); };
    assert.deepEqual(arena.findSteamDemo({ roots: [root], readFile, isFile: () => true }), { directory: expected, buildId: '123' });
    assert.equal(arena.findSteamDemo({ roots: [root], readFile, isFile: file => !file.endsWith('GameAssembly.dll') }), null);
    texts.set(path.join(library, 'steamapps/appmanifest_5364590.acf'), vdf.stringify({ AppState: { appid: '5364590', StateFlags: '4', installdir: '../Other' } }));
    assert.equal(arena.findSteamDemo({ roots: [root], readFile, isFile: () => true }), null);
});

test('demo absence and incompatible Steam build stop before changing game files', async t => {
    const x = await fixture(t);
    await assert.rejects(arena.prepareLaunch({ directory: x.directory, steam: null }), /Steam/);
    await assert.rejects(arena.prepareLaunch({ directory: x.directory, steam: { ...x.steam, buildId: '999' } }), /desteklenmiyor/);
    assert.equal(fs.existsSync(path.join(x.directory, 'game')), false);
});

test('Arena rejects the loader path at its 240-character boundary before touching files', async t => {
    const x = await fixture(t);
    const loader = 'game/MelonLoader/Dependencies/Il2CppAssemblyGenerator/Il2CppAssemblyGenerator.dll';
    const prefix = path.join(x.root, 'long-');
    const directory = prefix + 'x'.repeat(240 - path.join(prefix, loader).length);
    assert.equal(path.join(directory, loader).length, 240);
    await assert.rejects(arena.prepareLaunch({ directory, steam: x.steam }), /fazla uzun.*C:\\TikMnG-Oyunlar/);
    assert.equal(fs.existsSync(directory), false);
    assert.equal(fs.existsSync(path.join(x.directory, 'game')), false);
    for (const item of x.manifest.baseFiles) {
        assert.equal(hash(await fsp.readFile(path.join(x.steam.directory, item.path))), item.sha256);
    }
});

test('fresh preparation copies locally from Steam, preserves original and settings, and is idempotent', async t => {
    const x = await fixture(t);
    await x.put(x.directory, 'userdata/mod-settings.json', '{"saved":true}');
    const first = await arena.prepareLaunch(x);
    assert.equal(first.copiedBytes, x.manifest.baseFiles.reduce((n, item) => n + item.bytes, 0));
    for (const item of x.manifest.baseFiles) {
        assert.equal(hash(await fsp.readFile(path.join(x.steam.directory, item.path))), item.sha256);
        assert.equal(hash(await fsp.readFile(path.join(x.directory, 'game', item.path))), item.sha256);
    }
    assert.equal(await fsp.readFile(path.join(x.directory, 'userdata/mod-settings.json'), 'utf8'), '{"saved":true}');
    const second = await arena.prepareLaunch(x);
    assert.equal(second.copiedBytes, 0);
    await fsp.writeFile(path.join(x.directory, 'game/GameAssembly.dll'), 'corrupt');
    assert.ok((await arena.prepareLaunch(x)).copiedBytes > 0);
});

test('corrupted package and unlisted program files are rejected before launch', async t => {
    const x = await fixture(t);
    await x.put(x.directory, 'bridge/unlisted.cjs', 'unexpected');
    await assert.rejects(arena.verifyPackage(x.directory), /unlisted/);
    const unlisted = path.join(x.directory, 'bridge/unlisted.cjs');
    assert.ok(unlisted.startsWith(x.directory + path.sep));
    await fsp.unlink(unlisted);
    await fsp.writeFile(path.join(x.directory, 'support/Mods/TikMnG.CanEmAll.dll'), 'tampered');
    await assert.rejects(arena.prepareLaunch(x), /integrity/);
});

test('an unrecognized existing game folder is never replaced', async t => {
    const x = await fixture(t);
    await x.put(x.directory, 'game/personal.txt', 'keep');
    await assert.rejects(arena.prepareLaunch(x), /unrecognized/);
    assert.equal(await fsp.readFile(path.join(x.directory, 'game/personal.txt'), 'utf8'), 'keep');
});

test('original game binaries, saves, secrets and generated game assemblies cannot enter the mod package', () => {
    for (const file of ['../escape', 'game/GameAssembly.dll', 'support/GameAssembly.dll', 'bridge/token',
        'support/MelonLoader/Il2CppAssemblies/Assembly-CSharp.dll', 'userdata/mod-settings.json', 'bridge/.env']) assert.throws(() => arena.allowedFile(file));
    assert.equal(arena.STORE_URL, 'https://store.steampowered.com/app/5364590/');
    const published = require('../lib/published-games.json').games;
    assert.deepEqual(published.filter(game => game.announcementId).map(game => game.id), ['yaratik-arena']);
});

test('Arena uses its owned bootstrap and environment account handoff, not a second HTTP live connection', async t => {
    const x = await fixture(t);
    let spawned, marked = false, owned = false;
    const child = { pid: 12345 };
    const session = {
        stage: async (_phase, _message, action) => action(),
        ownChild: value => { assert.equal(value, child); owned = true; },
        waitForMarker: async value => {
            assert.equal(value, child);
            await fsp.writeFile(path.join(x.directory, 'qa/startup-state.json'), JSON.stringify({ processId: 12346, firstFrameRendered: true, failed: false, utc: new Date().toISOString() }));
            await fsp.writeFile(path.join(x.directory, 'qa/startup-launch.json'), JSON.stringify({ hostProcessId: child.pid, gameProcessId: 12346 }));
        },
        markReady: () => { marked = true; }
    };
    await arena.launchArena({ directory: x.directory, session, username: 'synthetic_host', prepare: options => arena.prepareLaunch({ ...options, steam: x.steam }), spawnProcess: (file, args, options) => { spawned = { file, args, options }; return child; } });
    assert.ok(owned && marked);
    assert.equal(spawned.options.env.MNG_ARENA_TIKTOK_USER, 'synthetic_host');
    assert.ok(spawned.args.includes('--launcher-session'));
    assert.equal(session.nativeChild.pid, 12346);
});
