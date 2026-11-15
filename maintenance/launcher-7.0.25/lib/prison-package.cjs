'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const vdf = require('./vendor/steam-vdf/lib/index.js');
const { assertSafePath, safeRelativePath, hashFile } = require('./download.cjs');
const { showNativeWindow } = require('./native-window.cjs');

const APP_ID = '5466880';
const STORE_URL = 'https://store.steampowered.com/app/5466880/';
const TYPE = 'tikmng-prison-support';
const EXECUTABLE = 'PunchYourWayOutDemo.exe';
const DATA = 'PunchYourWayOutDemo_Data/';
const CONFIG = 'game/BepInEx/config';
// `saves` is preserved by game-library.cjs even without a game-specific rule.
const SAVED_CONFIG = 'saves/hapisten-kac/config';
const PRESERVED_PATHS = ['saves', CONFIG];
const REQUIRED_BASE = [EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', DATA + 'il2cpp_data/Metadata/global-metadata.dat'];
const REQUIRED = ['support/winhttp.dll', 'support/doorstop_config.ini',
    'support/BepInEx/core/BepInEx.Unity.IL2CPP.dll', 'support/BepInEx/plugins/TikMnG.HapistenKac.dll',
    'support/BepInEx/core/BepInEx.Core.dll', 'support/BepInEx/core/BepInEx.Preloader.Core.dll',
    'support/BepInEx/core/0Harmony.dll', 'support/BepInEx/core/Il2CppInterop.Runtime.dll',
    'support/dotnet/coreclr.dll', 'support/dotnet/System.Private.CoreLib.dll', 'bridge.cjs', 'runtime/node.exe',
    'node_modules/tiktok-live-connector/package.json', 'shared/live-session.cjs', 'shared/normalize.cjs',
    'shared/gift-catalog.json', 'shared/Hapisten-Kac-Hediye-Gorseli.png',
    'shared/cell-wall-ink.png', 'shared/hand-ink.png', 'shared/cuff-latch.pcm', 'shared/cuff-release.pcm', 'shared/cuff-rattle.pcm',
    'shared/defaults/hapisten-kac-actions.json', 'shared/defaults/hapisten-kac-audience.json', 'defaults/BepInEx.cfg'];
const key = value => path.resolve(value).toLowerCase();
const overlaps = (a, b) => key(a) === key(b) || key(a).startsWith(key(b) + path.sep) || key(b).startsWith(key(a) + path.sep);

function findSteamDemo({ roots, env = process.env, readFile = file => fs.readFileSync(file, 'utf8'),
    isFile = file => { try { const s = fs.statSync(assertSafePath(file)); return s.isFile() && s.size > 0; } catch { return false; } } } = {}) {
    const candidates = roots ? [...roots] : [path.join(env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Steam'),
        path.join(env.ProgramFiles || 'C:/Program Files', 'Steam')];
    if (!roots) {
        try {
            const text = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
                { encoding: 'utf8', windowsHide: true, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] });
            const match = /SteamPath\s+REG_SZ\s+(.+)/i.exec(text);
            if (match) candidates.unshift(match[1].trim());
        } catch {}
        for (let code = 67; code <= 90; code++) candidates.push(String.fromCharCode(code) + ':/SteamLibrary');
    }
    const seen = new Set();
    for (let index = 0; index < candidates.length && index < 256; index++) {
        const root = candidates[index];
        if (typeof root !== 'string' || !path.isAbsolute(root) || seen.has(key(root))) continue;
        seen.add(key(root));
        try {
            const folders = vdf.parse(readFile(path.join(root, 'steamapps/libraryfolders.vdf'))).libraryfolders;
            for (const item of Object.values(folders || {})) {
                const folder = typeof item === 'string' ? item : item?.path;
                if (typeof folder === 'string' && path.isAbsolute(folder) && !seen.has(key(folder))) candidates.push(folder);
            }
        } catch {}
        try {
            const state = vdf.parse(readFile(path.join(root, `steamapps/appmanifest_${APP_ID}.acf`))).AppState;
            if (String(state?.appid) !== APP_ID || !(Number(state.StateFlags) & 4) || !/^\d+$/.test(String(state.buildid))) continue;
            const name = state.installdir;
            if (typeof name !== 'string' || name.length > 200) continue;
            safeRelativePath(name);
            if (name.includes('/')) continue;
            const directory = assertSafePath(path.join(root, 'steamapps/common', name));
            if (REQUIRED_BASE.every(file => isFile(path.join(directory, file)))) return { directory, buildId: String(state.buildid) };
        } catch {}
    }
    return null;
}

function allowedFile(relative) {
    safeRelativePath(relative);
    if (/(?:^|\/)(?:interop|unity-libs|cache|logs|userdata|qa|\.git|\.env[^/]*|euler-api-key\.txt)(?:\/|$)/i.test(relative)
        || /(?:^|\/)(?:GameAssembly|Assembly-CSharp|UnityPlayer|steam_api64)\.dll$/i.test(relative)
        || /(?:^|\/)[^/]*_Data(?:\/|$)/i.test(relative)) throw new Error('Original demo files, generated libraries and private data cannot be distributed.');
    const allowed = relative === 'bridge.cjs' || relative === 'README.md'
        || /^(?:runtime|node_modules|shared|licenses|provenance)\/.+/.test(relative)
        || relative === 'defaults/BepInEx.cfg'
        || /^support\/(?:winhttp\.dll|doorstop_config\.ini|\.doorstop_version|steam_appid\.txt|BepInEx\/core\/.+|BepInEx\/plugins\/TikMnG\.HapistenKac\.dll|dotnet\/.+)$/.test(relative);
    if (!allowed) throw new Error('Unknown prison package file: ' + relative);
    return relative;
}

function baseFile(relative) {
    safeRelativePath(relative);
    if (!([EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', 'UnityCrashHandler64.exe', 'baselib.dll', 'CREDITS.txt'].includes(relative)
        || [DATA, 'D3D12/', 'Licenses/'].some(prefix => relative.startsWith(prefix)))) throw new Error('Invalid original demo file: ' + relative);
    return relative;
}

function entries(items, validate) {
    if (!Array.isArray(items) || !items.length || items.length > 25000) throw new Error('Invalid prison file index.');
    const result = new Map();
    for (const item of items) {
        const relative = validate(item?.path);
        const id = relative.normalize('NFC').toLowerCase();
        if (result.has(id) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0)
            throw new Error('Invalid prison file descriptor.');
        result.set(id, item);
    }
    for (const name of result.keys()) {
        const parts = name.split('/');
        while (parts.pop() && parts.length) if (result.has(parts.join('/'))) throw new Error('Prison index contains overlapping paths.');
    }
    return result;
}

function readManifest(directory) {
    const file = assertSafePath(path.join(directory, 'manifest.json'));
    if (fs.statSync(file).size > 8 * 1024 ** 2) throw new Error('Prison manifest is too large.');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.type !== TYPE || manifest.schemaVersion !== 1 || manifest.platform !== 'win32-x64'
        || !/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.steam?.appId !== APP_ID || !/^\d+$/.test(manifest.steam.buildId))
        throw new Error('Invalid prison manifest.');
    const files = entries(manifest.files, allowedFile), base = entries(manifest.baseFiles, baseFile);
    for (const file of REQUIRED) if (!files.has(file.toLowerCase()) || !files.get(file.toLowerCase()).bytes) throw new Error('Prison package is incomplete: ' + file);
    for (const file of REQUIRED_BASE) if (!base.has(file.toLowerCase()) || !base.get(file.toLowerCase()).bytes) throw new Error('Demo file index is incomplete.');
    return { manifest, files, base };
}

function validatePackageDirectory(directory) {
    try {
        const { files } = readManifest(directory);
        return REQUIRED.every(file => {
            const s = fs.statSync(assertSafePath(path.join(directory, file)));
            return s.isFile() && s.size === files.get(file.toLowerCase()).bytes;
        });
    } catch { return false; }
}

async function walk(directory, prefix = '', skipMutable = false) {
    const files = [];
    for (const entry of await fsp.readdir(assertSafePath(directory), { withFileTypes: true })) {
        const name = prefix + entry.name;
        safeRelativePath(name);
        if (entry.isSymbolicLink()) throw new Error('Prison package links are forbidden.');
        if (skipMutable && !prefix && ['game', 'saves', 'qa', 'userdata'].includes(entry.name) && entry.isDirectory()) continue;
        if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), name + '/', skipMutable));
        else if (entry.isFile()) files.push(name);
        else throw new Error('Unsupported prison package entry.');
    }
    return files;
}

async function verifyPackage(directory, signal) {
    const verified = readManifest(directory);
    const actual = await walk(directory, '', true);
    if (actual.some(file => !['manifest.json', '.tikmng-package.json'].includes(file) && !verified.files.has(file.normalize('NFC').toLowerCase()))
        || actual.length !== verified.files.size + 1 + Number(actual.includes('.tikmng-package.json'))) throw new Error('Prison package contains unlisted files.');
    for (const item of verified.files.values()) {
        signal?.throwIfAborted();
        const file = assertSafePath(path.join(directory, item.path));
        if ((await fsp.stat(file)).size !== item.bytes || await hashFile(file, signal) !== item.sha256) throw new Error('Prison package integrity failed: ' + item.path);
    }
    return verified;
}

async function atomicCopy(source, target, sha256, signal) {
    signal?.throwIfAborted();
    assertSafePath(source); assertSafePath(target);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const temporary = target + '.tikmng-' + crypto.randomUUID();
    try {
        await fsp.copyFile(source, temporary);
        if (sha256 && await hashFile(temporary, signal) !== sha256) throw new Error('File verification failed: ' + source);
        signal?.throwIfAborted();
        await fsp.rename(temporary, target);
    } finally { await fsp.rm(temporary, { force: true }).catch(() => {}); }
}

async function atomicJson(file, value) {
    assertSafePath(file);
    const temporary = file + '.' + crypto.randomUUID();
    try { await fsp.writeFile(temporary, JSON.stringify(value)); await fsp.rename(temporary, file); }
    finally { await fsp.rm(temporary, { force: true }).catch(() => {}); }
}

// Only launcher-created, MAC-authenticated receipts may skip content reads.
// Package archives cannot contain saves or this key. Timestamps alone are not
// sufficient: include NTFS identity, change time and link count as well.
async function cacheKey(directory) {
    const file = assertSafePath(path.join(directory, 'saves/hapisten-kac/.verification-key'));
    await fsp.mkdir(path.dirname(file), { recursive: true });
    try { await fsp.writeFile(file, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const bytes = await fsp.readFile(assertSafePath(file));
    if (bytes.length !== 32 || (await fsp.stat(file)).nlink !== 1) throw new Error('Invalid prison verification key.');
    return bytes;
}

async function metadata(file) {
    const stat = await fsp.lstat(assertSafePath(file), { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n) throw new Error('Prison files must be regular, unlinked files: ' + file);
    return ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'birthtimeNs', 'nlink'].map(name => String(stat[name])).join(':');
}

const mac = (key, value) => crypto.createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
function authentic(key, receipt) {
    if (!receipt || typeof receipt.mac !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.mac)) return false;
    return crypto.timingSafeEqual(Buffer.from(receipt.mac, 'hex'), Buffer.from(mac(key, receipt.value), 'hex'));
}

// Exact snapshots also preserve user deletions. No publisher defaults are written over config.
async function snapshotConfig(directory) {
    const source = assertSafePath(path.join(directory, CONFIG));
    if (!fs.existsSync(source)) return;
    const target = assertSafePath(path.join(directory, SAVED_CONFIG));
    const files = await walk(source);
    await fsp.mkdir(target, { recursive: true });
    const names = new Set(files.map(file => file.toLowerCase()));
    for (const file of files) {
        const from = path.join(source, file), to = assertSafePath(path.join(target, file));
        // Ignore our own transient copies if a game save is being written concurrently.
        if (/\.tikmng-[a-f0-9-]+$/.test(file)) continue;
        const hash = await hashFile(from);
        if (fs.existsSync(to) && await hashFile(to) === hash) continue;
        await atomicCopy(from, to);
    }
    for (const file of await walk(target)) if (!names.has(file.toLowerCase())) await fsp.unlink(assertSafePath(path.join(target, file)));
}

async function prepareLaunch({ directory, steam = findSteamDemo(), signal, onProgress = () => {} }) {
    signal?.throwIfAborted();
    if (!steam) throw new Error("Once Steam'den ucretsiz Punch Your Way Out Demo oyununu kurun ve Kurulumu kontrol et dugmesine basin.");
    assertSafePath(directory); assertSafePath(steam.directory);
    if (overlaps(directory, steam.directory)) throw new Error('Steam original and prison mod directories must be separate.');
    const verified = await verifyPackage(directory, signal);
    if (String(steam.buildId) !== verified.manifest.steam.buildId) throw new Error('Steam demosunun bu surumu henuz desteklenmiyor. TikMnG oyun guncellemesini kontrol edin.');
    const game = assertSafePath(path.join(directory, 'game'));
    const markerFile = path.join(game, '.tikmng-steam-copy.json');
    let marker;
    if (fs.existsSync(markerFile)) {
        try { marker = JSON.parse(await fsp.readFile(assertSafePath(markerFile), 'utf8')); } catch { throw new Error('Unrecognized prison installation marker.'); }
        if (marker?.appId !== APP_ID || typeof marker.complete !== 'boolean') throw new Error('Unrecognized prison installation marker.');
    }
    if (fs.existsSync(game) && !marker && (await fsp.readdir(game)).length) throw new Error('Prison game directory contains an unrecognized installation. No files were changed.');
    const configInitialized = marker?.configInitialized === true || marker?.complete === true;
    const secret = await cacheKey(directory);
    const indexHash = crypto.createHash('sha256').update(JSON.stringify([...verified.base.values()])).digest('hex');
    const cache = authentic(secret, marker?.receipt) && marker.receipt.value.indexHash === indexHash
        && marker.receipt.value.source === key(steam.directory) ? marker.receipt.value.files : {};
    const receipts = {};
    let copied = 0, verifiedBytes = 0, cachedFiles = 0, hashedBaseFiles = 0;
    const total = [...verified.base.values()].reduce((n, file) => n + file.bytes, 0);
    await fsp.mkdir(game, { recursive: true });
    await atomicJson(markerFile, { appId: APP_ID, complete: false, configInitialized, receipt: marker?.receipt });
    for (const item of verified.base.values()) {
        signal?.throwIfAborted();
        const target = assertSafePath(path.join(game, item.path));
        const source = assertSafePath(path.join(steam.directory, item.path));
        if ((await fsp.stat(source)).size !== item.bytes) throw new Error('Steam demo files are incomplete. Verify the demo in Steam.');
        const sourceMeta = await metadata(source);
        let targetMeta = fs.existsSync(target) ? await metadata(target) : '';
        if (cache[item.path]?.source === sourceMeta && cache[item.path]?.target === targetMeta && targetMeta) cachedFiles++;
        else {
            // Always verify the installed Steam source on first preparation,
            // even when an old local target already has the expected bytes.
            if (await hashFile(source, signal) !== item.sha256 || await metadata(source) !== sourceMeta)
                throw new Error('Steam demo integrity failed: ' + item.path + '. Verify the demo in Steam.');
            hashedBaseFiles++;
            if (!targetMeta || (await fsp.stat(target)).size !== item.bytes || await hashFile(target, signal) !== item.sha256) {
                await atomicCopy(source, target, item.sha256, signal);
                copied += item.bytes;
            }
            if (await metadata(source) !== sourceMeta) throw new Error('Steam demo changed during preparation.');
            targetMeta = await metadata(target);
        }
        receipts[item.path] = { source: sourceMeta, target: targetMeta };
        verifiedBytes += item.bytes;
        onProgress({ copiedBytes: copied, verifiedBytes, totalBytes: total, cachedFiles, hashedBaseFiles });
    }
    for (const item of verified.files.values()) {
        if (!item.path.startsWith('support/')) continue;
        const target = assertSafePath(path.join(game, item.path.slice(8)));
        if (fs.existsSync(target) && await hashFile(target, signal) === item.sha256) continue;
        await atomicCopy(path.join(directory, item.path), target, item.sha256, signal);
    }
    const config = assertSafePath(path.join(directory, CONFIG));
    const saved = assertSafePath(path.join(directory, SAVED_CONFIG));
    // Existing game config is authoritative, including deletions. Restore the
    // portable snapshot only into a freshly prepared version after an update.
    if (!configInitialized && fs.existsSync(saved)) for (const file of await walk(saved)) {
        const target = assertSafePath(path.join(config, file));
        if (!fs.existsSync(target)) await atomicCopy(path.join(saved, file), target, null, signal);
    }
    const bepConfig = assertSafePath(path.join(config, 'BepInEx.cfg'));
    if (!fs.existsSync(bepConfig) && !configInitialized && !fs.existsSync(saved)) await atomicCopy(path.join(directory, 'defaults/BepInEx.cfg'), bepConfig, null, signal);
    await snapshotConfig(directory);
    signal?.throwIfAborted();
    const value = { indexHash, source: key(steam.directory), files: receipts };
    await atomicJson(markerFile, { appId: APP_ID, buildId: steam.buildId, complete: true, configInitialized: true, version: verified.manifest.version,
        receipt: { value, mac: mac(secret, value) } });
    return { directory, game, copiedBytes: copied, cachedFiles, hashedBaseFiles, version: verified.manifest.version };
}

// A local adapter around the launcher's existing owner, never a TikTok client.
// The native plugin's stdio bridge receives only this authenticated endpoint.
async function createPrisonPublisher({ directory, events, getChannel, getStatus, ensureLive, username = '', limit = 10000 }) {
    if (typeof events?.subscribe !== 'function' || typeof getChannel !== 'function'
        || typeof getStatus !== 'function' || typeof ensureLive !== 'function') throw new Error('Prison shared publisher callbacks required.');
    const normalize = require(assertSafePath(path.join(directory, 'shared/normalize.cjs')));
    const { normalizeLiveLikes } = require('./forza-publisher.cjs');
    let channel = normalize.username(username);
    if (username && !channel) throw new Error('Gecerli bir Hapisten Kac yayinci hesabi secin.');
    const token = crypto.randomBytes(32).toString('hex');
    let sequence = 0, acknowledged = 0, fault = '', closed = false, connecting;
    const pending = [], seen = new Set();
    const status = () => {
        if (!channel) return { status: 'disconnected', username: '', roomId: '', reason: 'idle', message: 'B panelinden yayin hesabi secin.' };
        const value = getStatus() || {};
        const mismatch = normalize.username(getChannel()) !== channel || value.username && normalize.username(value.username) !== channel;
        return { status: fault || mismatch ? 'error' : value.status || 'disconnected', username: channel,
            roomId: mismatch ? '' : String(value.roomId || ''), reason: mismatch ? 'account' : value.reason || '',
            message: fault || (mismatch ? 'Launcher yayin hesabi degisti. Oyunu secili hesapla yeniden acin.' : String(value.message || 'Launcher yayin paylasimi.').slice(0, 512)) };
    };
    const unsubscribe = events.subscribe((type, payload, meta = {}) => {
        const current = status();
        if (closed || fault || meta.source !== 'live' || normalize.username(meta.channel) !== channel
            || current.status !== 'connected' || !/^[1-9][0-9]*$/.test(current.roomId) || payload?.test === true) return;
        if (type === 'like' && payload.forzaRawLike) return;
        if (type === 'forza-like') { payload = normalizeLiveLikes(payload, current.roomId); type = 'like'; }
        if (!payload || !['gift', 'like', 'follow'].includes(type)) return;
        const item = type === 'gift' ? normalize.normalizeGift(payload, current.roomId, current.roomId)
            : normalize.normalizeAudience(type, payload, current.roomId, current.roomId);
        if (!item || item.keys.some(id => seen.has(id))) return;
        if (pending.length >= limit || seen.size + item.keys.length > 40000) {
            fault = 'Hapisten Kac yayin olay kuyrugu doldu. Olay akisini kontrol edin.';
            return;
        }
        item.keys.forEach(id => seen.add(id));
        pending.push({ seq: ++sequence, value: { type, ...item.event, keys: item.keys,
            roomId: current.roomId, senderId: item.profile.senderId } });
    });
    const server = http.createServer(async (req, res) => {
        const reply = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
        const supplied = Buffer.from(String(req.headers.authorization || ''));
        const expected = Buffer.from('Bearer ' + token);
        if (req.socket.remoteAddress !== '127.0.0.1' || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return reply(401, { error: 'unauthorized' });
        const url = new URL(req.url, 'http://127.0.0.1');
        const requested = normalize.username(url.searchParams.get('username'));
        if (!/^[a-z0-9_.]{2,32}$/.test(requested)) return reply(400, { error: 'account' });
        // Offline launch stays unbound. The first authenticated connect chooses
        // exactly one account; concurrent different requests cannot rebind it.
        if (!channel && req.method === 'POST' && url.pathname === '/connect') channel = requested;
        if (requested !== channel) return reply(409, { error: 'account' });
        try {
            if (req.method === 'POST' && url.pathname === '/connect') {
                req.resume();
                const current = status();
                if (!['connected', 'connecting', 'waiting'].includes(current.status) && !connecting) {
                    connecting = Promise.resolve().then(() => ensureLive(channel)).catch(() => { fault = 'Launcher yayin baglantisini baslatamadi.'; }).finally(() => { connecting = null; });
                }
                return reply(200, { schemaVersion: 1, status: status() });
            }
            if (req.method === 'GET' && url.pathname === '/poll') {
                const after = url.searchParams.get('after');
                if (!/^\d{1,16}$/.test(after || '') || !Number.isSafeInteger(Number(after)) || Number(after) > sequence)
                    return reply(409, { error: 'cursor' });
                // A restarted native stdio helper starts at zero. Never move
                // the acknowledgement backwards or replay consumed events.
                acknowledged = Math.max(acknowledged, Number(after));
                while (pending.length && pending[0].seq <= acknowledged) pending.shift();
                return reply(200, { schemaVersion: 1, status: status(), events: pending.slice(0, 64) });
            }
            return reply(404, { error: 'route' });
        } catch { return reply(500, { error: 'publisher' }); }
    });
    server.requestTimeout = 5000; server.headersTimeout = 5000;
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
    catch (error) { unsubscribe(); throw error; }
    return { url: `http://127.0.0.1:${server.address().port}`, token, get username() { return channel; }, status,
        async close() { if (closed) return; closed = true; unsubscribe(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}

function existingGame() {
    if (process.platform !== 'win32') throw new Error('Hapisten Kac Windows x64 gerektirir.');
    const executable = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const output = execFileSync(executable, ['-NoProfile', '-NonInteractive', '-Command',
        "@(Get-Process -Name PunchYourWayOutDemo -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id) | ConvertTo-Json -Compress"],
    { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return output ? JSON.parse(output) : [];
}

async function acquireLock(lockDirectory) {
    const file = assertSafePath(path.join(lockDirectory, 'tikmng-prison-launch.lock'));
    const claim = { pid: process.pid, token: crypto.randomUUID() };
    const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
    try { await fsp.writeFile(file, JSON.stringify(claim), { flag: 'wx' }); }
    catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const recovery = assertSafePath(file + '.recovery');
        let handle;
        try {
            handle = await fsp.open(recovery, 'wx');
            const old = JSON.parse(await fsp.readFile(file, 'utf8'));
            if (!Number.isSafeInteger(old.pid) || old.pid <= 0 || alive(old.pid)) throw new Error('Hapisten Kac zaten acik veya baslatiliyor.');
            await fsp.unlink(file);
            await fsp.writeFile(file, JSON.stringify(claim), { flag: 'wx' });
        } finally { if (handle) { await handle.close(); await fsp.unlink(recovery); } }
    }
    return async () => {
        const current = JSON.parse(await fsp.readFile(file, 'utf8'));
        if (current.token === claim.token) await fsp.unlink(file);
    };
}

async function waitForMenu({ child, session, logFile, signal, timeoutMs }) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        signal.throwIfAborted();
        if (session.closed || child.exitCode != null || child.signalCode != null) throw session.error || new Error('Hapisten Kac hazir olmadan kapandi.');
        let text = '';
        try {
            const handle = await fsp.open(assertSafePath(logFile), 'r');
            try {
                const size = (await handle.stat()).size;
                const bytes = Buffer.alloc(Math.min(size, 2 * 1024 ** 2));
                await handle.read(bytes, 0, bytes.length, Math.max(0, size - bytes.length));
                text = bytes.toString('utf8');
            } finally { await handle.close(); }
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const failure = text.match(/^\[(?:Fatal|Error)\s*:[^\]]*\].*$/m);
        if (failure) throw new Error('Hapisten Kac acilis hatasi: ' + failure[0]);
        if (text.includes('Hapisten Kaç loaded into the original demo.') && text.includes('Native menu retained and TikMnG controls attached.')) return;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Hapisten Kac menu hazir sinyali vermedi. ' + logFile);
}

async function launchPrison({ directory, session, steam, username = session?.tiktokUser || '', events, getChannel, getStatus, ensureLive,
    spawnProcess = spawn, prepare = prepareLaunch,
    findExisting = existingGame, showWindow = showNativeWindow, lockDirectory = os.tmpdir(), readyTimeoutMs = 300000 }) {
    const controller = new AbortController();
    const abort = () => controller.abort(new Error('Hapisten Kac baslatma islemi iptal edildi.'));
    session.disposers.add(abort);
    let unlock, child, backupTimer, backup = Promise.resolve();
    const persist = () => (backup = backup.then(() => snapshotConfig(directory)));
    try {
        unlock = await acquireLock(lockDirectory);
        if ([].concat(await findExisting()).length) throw new Error('Hapisten Kac zaten acik. Mevcut oyunu kapatip yeniden deneyin.');
        const prepared = await session.stage('demo', 'Steam demosu ve Hapisten Kac dosyalari dogrulaniyor...', () =>
            prepare({ directory, ...(steam === undefined ? {} : { steam }), signal: controller.signal,
                onProgress: () => session.progress('demo', 'Steam demosu yerel oyun klasorune hazirlaniyor...') }), 180000);
        controller.signal.throwIfAborted();
        let publisher;
        if (events || getChannel || getStatus || ensureLive) {
            publisher = await createPrisonPublisher({ directory, events, getChannel, getStatus, ensureLive, username });
            session.disposers.add(() => publisher.close());
        }
        const qa = assertSafePath(path.join(directory, 'qa'));
        await fsp.mkdir(qa, { recursive: true });
        const logFile = assertSafePath(path.join(prepared.game, 'BepInEx/LogOutput.log'));
        if (fs.existsSync(logFile)) await fsp.rename(logFile, path.join(qa, 'previous-startup-' + crypto.randomUUID() + '.log'));
        if ([].concat(await findExisting()).length) throw new Error('Hapisten Kac zaten acik.');
        controller.signal.throwIfAborted();
        const env = { ...process.env };
        // LiveBridge.cs uses ProcessStartInfo("node.exe"). Its packaged bridge
        // has no standalone SDK fallback, including when the owner is missing.
        const oldPath = Object.keys(env).find(name => name.toLowerCase() === 'path');
        const inheritedPath = oldPath ? env[oldPath] : '';
        if (oldPath) delete env[oldPath];
        for (const name of Object.keys(env)) if (/^NODE_(?:OPTIONS|PATH)$|^ELECTRON_RUN_AS_NODE$|^(?:MNG_LIVE_OWNER|MNG_FORZA_PUBLISHER|TIKMNG_PRISON)_/i.test(name)) delete env[name];
        env.PATH = path.join(directory, 'runtime') + path.delimiter + inheritedPath;
        env.NODE_PATH = path.join(directory, 'node_modules');
        env.SteamAppId = APP_ID;
        env.SteamGameId = APP_ID;
        const selected = String(username).trim().replace(/^@/, '').toLowerCase();
        env.TIKMNG_PRISON_USERNAME = /^[a-z0-9_.]{2,32}$/.test(selected) ? selected : '';
        if (publisher) {
            env.TIKMNG_PRISON_OWNER_URL = publisher.url;
            env.TIKMNG_PRISON_OWNER_TOKEN = publisher.token;
        }
        session.progress('engine', 'Hapisten Kac aciliyor; mod ve menu hazir sinyali bekleniyor...');
        child = spawnProcess(path.join(prepared.game, EXECUTABLE),
            ['-screen-fullscreen', '0', '-screen-width', '1152', '-screen-height', '648'],
            { cwd: prepared.game, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        session.ownChild(child, { normalExit: true });
        session.nativeChild = child;
        const release = unlock;
        session.disposers.add(async () => {
            clearInterval(backupTimer);
            // Disposers and owned-child termination run concurrently in GameLaunchSession.close.
            if (child.exitCode == null && child.signalCode == null && child.pid) await new Promise(resolve => {
                const timer = setTimeout(() => { child.removeListener('exit', exited); resolve(); }, 6000);
                const exited = () => { clearTimeout(timer); resolve(); };
                child.once('exit', exited);
            });
            try { await persist(); } finally { await release(); }
        });
        unlock = null;
        backupTimer = setInterval(() => { void persist().catch(error => { void session.close(new Error('Hapisten Kac ayarlari korunamadi: ' + error.message)); }); }, 1000);
        backupTimer.unref();
        await session.stage('game-ready', 'Hapisten Kac modu ve oyun menusu hazirlaniyor...', () =>
            waitForMenu({ child, session, logFile, signal: controller.signal, timeoutMs: readyTimeoutMs }), readyTimeoutMs + 1000);
        await session.stage('window', 'Hapisten Kac penceresi hazirlaniyor...', async () => {
            const state = await showWindow(child.pid);
            if (state?.pid !== child.pid || state.visible !== true) throw new Error('Hapisten Kac penceresi dogrulanamadi.');
        }, 40000);
        await persist();
        session.markReady(publisher ? 'Hapisten Kac hazir. Launcher yayini oyunla paylasiliyor.'
            : 'Hapisten Kac menusu hazir. Launcher yayin paylasimi saglanmadi.');
        return { basarili: true };
    } catch (error) {
        controller.abort(error);
        await session.close(error);
        throw session.error || error;
    } finally {
        if (unlock) await unlock();
    }
}

module.exports = { validatePackageDirectory, findSteamDemo, prepareLaunch, launchPrison, createPrisonPublisher, snapshotConfig,
    PRESERVED_PATHS, APP_ID, STORE_URL, TYPE };
