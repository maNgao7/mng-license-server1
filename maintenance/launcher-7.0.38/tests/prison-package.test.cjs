'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const prison = require('../lib/prison-package.cjs');
const { createSharedGameEvents } = require('../lib/shared-game-events.cjs');
const packageRoot = path.resolve(__dirname, '../../hapisten-kac-package');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const required = ['support/winhttp.dll', 'support/doorstop_config.ini',
    'support/BepInEx/core/BepInEx.Unity.IL2CPP.dll', 'support/BepInEx/plugins/TikMnG.HapistenKac.dll',
    'support/BepInEx/core/BepInEx.Core.dll', 'support/BepInEx/core/BepInEx.Preloader.Core.dll',
    'support/BepInEx/core/0Harmony.dll', 'support/BepInEx/core/Il2CppInterop.Runtime.dll',
    'support/dotnet/coreclr.dll', 'support/dotnet/System.Private.CoreLib.dll', 'bridge.cjs', 'runtime/node.exe',
    'node_modules/tiktok-live-connector/package.json', 'shared/live-session.cjs', 'shared/normalize.cjs',
    'shared/gift-catalog.json', 'shared/Hapisten-Kac-Hediye-Gorseli.png',
    'shared/cell-wall-ink.png', 'shared/hand-ink.png', 'shared/cuff-latch.pcm', 'shared/cuff-release.pcm', 'shared/cuff-rattle.pcm',
    'shared/defaults/hapisten-kac-actions.json', 'shared/defaults/hapisten-kac-audience.json', 'defaults/BepInEx.cfg'];
const baseNames = ['PunchYourWayOutDemo.exe', 'GameAssembly.dll', 'UnityPlayer.dll', 'PunchYourWayOutDemo_Data/il2cpp_data/Metadata/global-metadata.dat'];
async function put(file, content) { await fsp.mkdir(path.dirname(file), { recursive: true }); await fsp.writeFile(file, content); }
async function fixture(t) {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'tikmng-prison-test-'));
    t.after(() => fsp.rm(root, { recursive: true, force: true }));
    const directory = path.join(root, 'package'), source = path.join(root, 'steamapps/common/Punch Your Way Out Demo');
    const manifest = { schemaVersion: 1, type: prison.TYPE, version: '0.2.0', platform: 'win32-x64',
        steam: { appId: prison.APP_ID, buildId: '26583894' }, files: [], baseFiles: [] };
    for (const file of required) {
        let bytes = Buffer.from('package:' + file);
        if (file === 'shared/normalize.cjs') bytes = await fsp.readFile(path.join(packageRoot, file));
        await put(path.join(directory, file), bytes);
        manifest.files.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
    }
    for (const file of baseNames) {
        const bytes = Buffer.from('original:' + file);
        await put(path.join(source, file), bytes);
        manifest.baseFiles.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
    }
    const writeManifest = () => put(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    await writeManifest();
    const steam = { directory: source, buildId: '26583894' };
    return { root, directory, source, manifest, writeManifest, steam,
        prepare: options => prison.prepareLaunch({ directory, steam, ...options }) };
}

test('prison: finds the actual Steam app manifest through a library folder and rejects traversal', async t => {
    const f = await fixture(t), launcher = path.join(f.root, 'Steam');
    const vdf = require('../lib/vendor/steam-vdf/lib/index.js');
    await put(path.join(launcher, 'steamapps/libraryfolders.vdf'), vdf.stringify({ libraryfolders: { 0: { path: f.root } } }));
    const manifest = path.join(f.root, 'steamapps/appmanifest_5466880.acf');
    const state = { appid: '5466880', StateFlags: '4', buildid: '26583894', installdir: 'Punch Your Way Out Demo' };
    await put(manifest, vdf.stringify({ AppState: state }));
    assert.deepEqual(prison.findSteamDemo({ roots: [launcher] }), f.steam);
    await put(manifest, vdf.stringify({ AppState: { ...state, installdir: '../other' } }));
    assert.equal(prison.findSteamDemo({ roots: [launcher] }), null);
});

test('prison: first prepare hashes original source, cached prepare reads no base content, changed target repairs', async t => {
    const f = await fixture(t);
    const first = await f.prepare();
    assert.equal(first.hashedBaseFiles, baseNames.length);
    assert.ok(first.copiedBytes > 0);
    const second = await f.prepare();
    assert.equal(second.copiedBytes, 0);
    assert.equal(second.hashedBaseFiles, 0);
    assert.equal(second.cachedFiles, baseNames.length);
    const target = path.join(first.game, baseNames[0]);
    const original = await fsp.readFile(target);
    const times = await fsp.stat(target);
    await fsp.writeFile(target, Buffer.alloc(original.length, 88));
    await fsp.utimes(target, times.atime, times.mtime); // Restoring mtime alone must never bypass verification.
    const repaired = await f.prepare();
    assert.equal(repaired.hashedBaseFiles, 1);
    assert.deepEqual(await fsp.readFile(target), original);
    assert.equal(repaired.cachedFiles, baseNames.length - 1);
});

test('prison: a corrupted Steam source fails even with a matching previously prepared local target', async t => {
    const f = await fixture(t);
    await f.prepare();
    const file = path.join(f.source, baseNames[0]), before = await fsp.readFile(file), times = await fsp.stat(file);
    await fsp.writeFile(file, Buffer.alloc(before.length, 88));
    await fsp.utimes(file, times.atime, times.mtime);
    await assert.rejects(f.prepare(), /Steam demo integrity/);
    assert.deepEqual(await fsp.readFile(path.join(f.directory, 'game', baseNames[0])), before);
});

test('prison: a prior verification of the mod cannot authorize edited package content', async t => {
    const f = await fixture(t);
    await f.prepare();
    await f.prepare();
    const file = path.join(f.directory, 'bridge.cjs');
    const before = await fsp.readFile(file), times = await fsp.stat(file);
    await fsp.writeFile(file, Buffer.alloc(before.length, 88));
    await fsp.utimes(file, times.atime, times.mtime);
    await assert.rejects(f.prepare(), /Prison package integrity failed: bridge\.cjs/);
});

test('prison: tampering with metadata receipts cannot authorize altered base files', async t => {
    const f = await fixture(t), prepared = await f.prepare();
    const file = path.join(prepared.game, baseNames[0]), content = await fsp.readFile(file);
    await fsp.writeFile(file, Buffer.alloc(content.length, 88));
    const markerFile = path.join(prepared.game, '.tikmng-steam-copy.json');
    const marker = JSON.parse(await fsp.readFile(markerFile, 'utf8'));
    const stat = await fsp.lstat(file, { bigint: true });
    marker.receipt.value.files[baseNames[0]].target = ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'birthtimeNs', 'nlink'].map(x => String(stat[x])).join(':');
    await fsp.writeFile(markerFile, JSON.stringify(marker)); // MAC is now invalid.
    assert.equal((await f.prepare()).hashedBaseFiles, baseNames.length);
    assert.deepEqual(await fsp.readFile(file), content);
});

test('prison: config, saves and user deletions survive preparation and a fresh package version', async t => {
    const f = await fixture(t), prepared = await f.prepare();
    const config = path.join(prepared.game, 'BepInEx/config');
    const data = { 'com.tikmng.hapistenkac.cfg': 'user preferences', 'hapisten-kac-actions.json': '[]',
        'hapisten-kac-audience.json': '{"LikeThreshold":77}', 'hapisten-kac-saves/slot.bin': 'native-save',
        'hapisten-kac-route-lengths.json': '{"version":1}', 'hapisten-kac-escape-progress.json': '{"wins":5}' };
    for (const [name, bytes] of Object.entries(data)) await put(path.join(config, name), bytes);
    await f.prepare();
    await fsp.unlink(path.join(config, 'hapisten-kac-actions.json'));
    await f.prepare();
    assert.equal(fs.existsSync(path.join(config, 'hapisten-kac-actions.json')), false);
    assert.equal(fs.existsSync(path.join(f.directory, 'saves/hapisten-kac/config/hapisten-kac-actions.json')), false);
    const next = path.join(f.root, 'next-package');
    await fsp.cp(f.directory, next, { recursive: true, filter: src => !src.startsWith(path.join(f.directory, 'game')) });
    const nextManifest = JSON.parse(await fsp.readFile(path.join(next, 'manifest.json'), 'utf8'));
    nextManifest.version = '0.2.1';
    await fsp.writeFile(path.join(next, 'manifest.json'), JSON.stringify(nextManifest));
    await prison.prepareLaunch({ directory: next, steam: f.steam });
    for (const [name, bytes] of Object.entries(data)) if (name !== 'hapisten-kac-actions.json') {
        assert.equal(await fsp.readFile(path.join(next, 'game/BepInEx/config', name), 'utf8'), bytes);
        assert.equal(await fsp.readFile(path.join(config, name), 'utf8'), bytes);
    }
    assert.equal(fs.existsSync(path.join(next, 'game/BepInEx/config/hapisten-kac-actions.json')), false);
});

test('prison: an interrupted preparation can resume without accepting an unrelated installation', async t => {
    const f = await fixture(t), controller = new AbortController();
    await assert.rejects(f.prepare({ signal: controller.signal, onProgress: () => controller.abort() }), /abort/i);
    assert.equal((await f.prepare()).version, '0.2.0');
    const other = await fixture(t);
    await put(path.join(other.directory, 'game/unrelated.txt'), 'do not touch');
    await assert.rejects(other.prepare(), /unrecognized installation/);
    assert.equal(await fsp.readFile(path.join(other.directory, 'game/unrelated.txt'), 'utf8'), 'do not touch');
});

test('prison: rejects build mismatch and never prepares in the Steam source', async t => {
    const f = await fixture(t);
    await assert.rejects(f.prepare({ steam: { ...f.steam, buildId: '999' } }), /surumu/);
    await assert.rejects(prison.prepareLaunch({ directory: f.source, steam: f.steam }), /must be separate/);
    assert.equal(fs.existsSync(path.join(f.directory, 'game')), false);
});

test('prison: rejects traversal, original binaries, generated libraries, aliases and file/directory collisions', async t => {
    for (const name of ['../escape', 'support/../escape', 'support/PunchYourWayOutDemo_Data/file',
        'support/BepInEx/interop/Assembly-CSharp.dll', 'support/BepInEx/unity-libs/UnityEngine.dll',
        'shared/GameAssembly.dll', 'shared/.env', 'shared/CON.txt', 'shared/name.']) {
        const f = await fixture(t);
        f.manifest.files.push({ path: name, bytes: 1, sha256: digest('x') }); await f.writeManifest();
        assert.equal(prison.validatePackageDirectory(f.directory), false, name);
        await assert.rejects(f.prepare());
    }
    const f = await fixture(t);
    f.manifest.files.push({ ...f.manifest.files[0], path: 'support/WINHTTP.dll' }); await f.writeManifest();
    await assert.rejects(f.prepare(), /descriptor|Unknown prison package file/);
    f.manifest.files.pop(); f.manifest.files.push({ path: 'shared/normalize.cjs/child', bytes: 1, sha256: digest('x') });
    await f.writeManifest(); await assert.rejects(f.prepare(), /overlapping/);
});

test('prison: rejects missing, altered and unlisted support files before copying Steam content', async t => {
    const f = await fixture(t), file = path.join(f.directory, required[0]);
    await fsp.appendFile(file, 'altered'); await assert.rejects(f.prepare(), /integrity/);
    assert.equal(fs.existsSync(path.join(f.directory, 'game')), false);
    await fsp.writeFile(file, 'package:' + required[0]);
    await put(path.join(f.directory, 'shared/injected.cjs'), 'bad'); await assert.rejects(f.prepare(), /unlisted/);
    await fsp.unlink(path.join(f.directory, 'shared/injected.cjs')); await fsp.unlink(file);
    await assert.rejects(f.prepare());
});

test('prison: rejects junctions and hardlinks in package, Steam source and config', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'outside');
    await fsp.mkdir(outside);
    await fsp.symlink(outside, path.join(f.directory, 'saves'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(f.prepare(), /Links|links/i);
    await fsp.unlink(path.join(f.directory, 'saves'));
    const base = path.join(f.source, baseNames[0]); await fsp.link(base, path.join(outside, 'linked'));
    await assert.rejects(f.prepare(), /unlinked/);
    await fsp.unlink(path.join(outside, 'linked'));
    const prepared = await f.prepare();
    await fsp.symlink(outside, path.join(prepared.game, 'BepInEx/config/escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(f.prepare(), /links/i);
    assert.deepEqual(await fsp.readdir(outside), []);
});

async function liveFixture(t, username = 'streamer') {
    const f = await fixture(t), events = createSharedGameEvents();
    let state = { status: 'connected', username: 'streamer', roomId: '1234' }, channel = 'streamer', calls = 0;
    const owner = await prison.createPrisonPublisher({ directory: f.directory, username, events,
        getChannel: () => channel, getStatus: () => state,
        ensureLive: async name => { calls++; channel = name; state = { ...state, username: name }; } });
    t.after(() => owner.close());
    const request = async (route, options = {}) => {
        const response = await fetch(owner.url + route, { ...options, headers: { Authorization: 'Bearer ' + owner.token, ...options.headers } });
        return { code: response.status, data: await response.json() };
    };
    return { ...f, events, owner, request, calls: () => calls, setState: value => { state = value; channel = value.username; } };
}

test('prison: shared owner authenticates, preserves room/series/sender IDs, deduplicates and isolates accounts', async t => {
    const f = await liveFixture(t);
    const gift = { username: 'viewer', eventId: 'msg1', giftId: '5655', repeatCount: 3, groupId: 'combo1', giftType: 1, repeatEnd: true };
    const emit = (type, payload, channel = 'streamer') => f.events.publish(type, payload, { source: 'live', channel });
    assert.equal((await f.request('/poll?username=streamer&after=0', { headers: { Authorization: 'bad' } })).code, 401);
    emit('gift', gift, 'other'); emit('gift', { ...gift, repeatEnd: false }); emit('gift', { ...gift, test: true });
    emit('gift', gift); emit('gift', gift); emit('gift', { ...gift, eventId: 'replayed-terminal' });
    emit('follow', { username: 'viewer', eventId: 'follow1' });
    emit('like', { username: 'viewer', eventId: 'like1', likeCount: 15 });
    emit('like', { username: 'viewer', eventId: 'like1', likeCount: 15 });
    const first = (await f.request('/poll?username=streamer&after=0')).data;
    assert.equal(first.events.length, 3);
    assert.equal(first.status.roomId, '1234');
    assert.equal(first.events[0].value.repeatCount, 3);
    assert.equal(first.events[0].value.keys.length, 2);
    assert.equal(first.events[0].value.senderId, 'viewer');
    assert.equal(first.events[0].value.roomId, '1234');
    assert.equal((await f.request('/connect?username=other', { method: 'POST' })).code, 409);
    assert.equal((await f.request('/poll?username=streamer&after=0')).data.events.length, 3); // Reads are not destructive.
    assert.equal((await f.request('/poll?username=streamer&after=3')).data.events.length, 0);
    // The game can restart its Node child without restarting the owner.
    assert.equal((await f.request('/poll?username=streamer&after=0')).code, 200);
    assert.equal((await f.request('/poll?username=streamer&after=0')).data.events.length, 0);
    assert.equal(f.calls(), 0); // Existing launcher session is reused.
    f.setState({ status: 'connected', username: 'other', roomId: '9999' });
    emit('gift', { ...gift, eventId: 'cross-account', groupId: '' }, 'other');
    assert.equal((await f.request('/poll?username=streamer&after=3')).data.status.status, 'error');
    await f.owner.close(); assert.equal(f.events.size, 0);
});

test('prison: offline publisher binds once on first authenticated connect and reuses a connecting owner', async t => {
    const f = await liveFixture(t, '');
    f.setState({ status: 'disconnected', username: '', roomId: '' });
    assert.equal(f.owner.status().status, 'disconnected');
    assert.equal(f.owner.username, '');
    assert.equal((await f.request('/connect?username=streamer', { method: 'POST' })).code, 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls(), 1);
    assert.equal(f.owner.username, 'streamer');
    f.setState({ status: 'connecting', username: 'streamer', roomId: '' });
    await f.request('/connect?username=streamer', { method: 'POST' });
    assert.equal(f.calls(), 1);
    assert.equal((await f.request('/connect?username=other', { method: 'POST' })).code, 409);
    assert.equal(f.calls(), 1);
});

test('prison: packaged stdio bridge works offline-first, forwards once and stop leaves the owner connected', async t => {
    const f = await liveFixture(t, '');
    const child = spawn(process.execPath, [path.join(packageRoot, 'bridge.cjs')], { windowsHide: true,
        env: { ...process.env, TIKMNG_PRISON_USERNAME: '', TIKMNG_PRISON_OWNER_URL: f.owner.url, TIKMNG_PRISON_OWNER_TOKEN: f.owner.token },
        stdio: ['pipe', 'pipe', 'pipe'] });
    t.after(() => child.kill());
    const packets = []; let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    let pending = '';
    child.stdout.on('data', data => {
        pending += data;
        for (let end; (end = pending.indexOf('\n')) >= 0;) { packets.push(JSON.parse(pending.slice(0, end))); pending = pending.slice(end + 1); }
    });
    const until = async predicate => {
        for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 30)); }
        assert.fail('Bridge timed out: ' + stderr + ' ' + JSON.stringify(packets));
    };
    child.stdin.write('{"op":"start","account":"streamer"}\n');
    await until(() => packets.some(x => x.status === 'connected'));
    const gift = { username: 'viewer', eventId: 'gift1', giftId: '5655', repeatCount: 2 };
    f.events.publish('gift', gift, { source: 'live', channel: 'streamer' });
    await until(() => packets.some(x => x.type === 'gift'));
    child.stdin.write('{"op":"stop"}\n');
    await until(() => packets.some(x => x.status === 'disconnected'));
    assert.equal(f.owner.status().status, 'connected');
    child.stdin.write('{"op":"start","account":"streamer"}\n');
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(packets.filter(x => x.type === 'gift').length, 1);
    child.stdin.end(); const exit = await once(child, 'exit');
    assert.equal(exit[0], 0, stderr);
    assert.equal(f.calls(), 0);
});

test('prison: packaged bridge refuses external owner endpoints and never imports a standalone SDK', () => {
    const { ownerConfig } = require(path.join(packageRoot, 'bridge.cjs'));
    for (const url of ['https://127.0.0.1:123', 'http://example.com', 'http://127.0.0.1:123/path', 'http://user@127.0.0.1:123', 'http://127.0.0.1:123/?x=1']) {
        assert.throws(() => ownerConfig({ TIKMNG_PRISON_OWNER_URL: url, TIKMNG_PRISON_OWNER_TOKEN: 'a'.repeat(64) }));
    }
    const bridge = fs.readFileSync(path.join(packageRoot, 'bridge.cjs'), 'utf8');
    assert.doesNotMatch(bridge, /(?:require|import)\s*\(?\s*['"]tiktok-live-connector/);
    assert.doesNotMatch(bridge, /createLiveSession|TikTokLiveConnection/);
});
