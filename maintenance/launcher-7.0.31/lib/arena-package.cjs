'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { checkFiles } = require('./native-package-checks.cjs');
const vdf = require('./vendor/steam-vdf/lib/index.js');
const { assertSafePath, safeRelativePath } = require('./download.cjs');

const APP_ID = '5364590';
const STORE_URL = 'https://store.steampowered.com/app/5364590/';
const EXECUTABLE = "Can 'Em All Demo.exe";
const TYPE = 'tikmng-arena-support';
const REQUIRED = ['bootstrap/TikMnG.Arena.Startup.exe', 'support/Mods/TikMnG.CanEmAll.dll',
    'support/version.dll', 'runtime/host/fxr/6.0.36/hostfxr.dll', 'bridge/index.cjs',
    'bridge/runtime/node.exe', 'catalog/gifts.json', 'defaults/game-settings.json'];
const key = value => path.resolve(value).toLowerCase();

// A fresh process and explicit verification both hash the actual bytes.
const verifiedFiles = new Map();
const fileIdentity = stat => [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.birthtimeNs].join(':');
const fingerprint = stat => `${fileIdentity(stat)}:${stat.ctimeNs}`;
const statOptions = { bigint: true };

function rememberFile(file, stat, sha256) {
    if (verifiedFiles.size >= 50000) verifiedFiles.delete(verifiedFiles.keys().next().value);
    verifiedFiles.set(file, { metadata: fingerprint(stat), sha256 });
}

// Callers check the path or the containing package directory. lstat checks the leaf.
async function fileMatches(file, item, { useCache = false, signal, inPackageWalk = false }) {
    signal?.throwIfAborted();
    let before;
    try { before = await fsp.lstat(file, statOptions); }
    catch (error) { if (error.code === 'ENOENT') { verifiedFiles.delete(file); return false; } throw error; }
    if (before.isSymbolicLink()) throw new Error('Arena package links are forbidden.');
    const metadata = fingerprint(before), cached = verifiedFiles.get(file);
    if (!before.isFile() || before.size !== BigInt(item.bytes)) { verifiedFiles.delete(file); return false; }
    if (useCache && before.ino && cached?.metadata === metadata && cached.sha256 === item.sha256) return before;
    verifiedFiles.delete(file);
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file, { highWaterMark: 1024 * 1024, signal })) hash.update(chunk);
    signal?.throwIfAborted();
    const after = await fsp.lstat(inPackageWalk ? file : assertSafePath(file), statOptions);
    if (hash.digest('hex') !== item.sha256 || fingerprint(after) !== metadata) return false;
    rememberFile(file, after, item.sha256);
    return after;
}

async function copyVerified(source, target, item, integrityError, signal) {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const temporary = assertSafePath(target + '.' + crypto.randomUUID() + '.tikmng-copy');
    await fsp.copyFile(assertSafePath(source), temporary, fs.constants.COPYFILE_EXCL);
    try {
        const staged = await fileMatches(temporary, item, { signal });
        signal?.throwIfAborted();
        assertSafePath(target);
        if (!staged || fingerprint(fs.lstatSync(temporary, statOptions)) !== fingerprint(staged)) throw new Error(integrityError);
        fs.renameSync(temporary, target);
        const installed = fs.lstatSync(target, statOptions);
        // Rename changes ctime. Carry the verified digest only to the same file,
        // then use the final fingerprint (including ctime) for subsequent launches.
        if (staged.ino && installed.isFile() && fileIdentity(installed) === fileIdentity(staged)) {
            rememberFile(target, installed, item.sha256);
        } else if (!await fileMatches(assertSafePath(target), item, { signal })) throw new Error(integrityError);
    } finally {
        verifiedFiles.delete(temporary);
        await fsp.rm(temporary, { force: true });
    }
}

function findSteamDemo({ roots, env = process.env, readFile = file => fs.readFileSync(file, 'utf8'),
    isFile = file => { try { const s = fs.statSync(file); return s.isFile() && s.size > 0; } catch { return false; } } } = {}) {
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
    for (let index = 0; index < candidates.length; index++) {
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
            if (String(state?.appid) !== APP_ID || !(Number(state.StateFlags) & 4)) continue;
            const name = state.installdir;
            if (typeof name !== 'string' || name.length > 200 || /[\\/:]|^\.+$/.test(name)) continue;
            const directory = assertSafePath(path.join(root, 'steamapps/common', name));
            if ([EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', "Can 'Em All Demo_Data/il2cpp_data/Metadata/global-metadata.dat"]
                .every(file => isFile(path.join(directory, file)))) return { directory, buildId: String(state.buildid || '') };
        } catch {}
    }
    return null;
}

function allowedFile(relative) {
    safeRelativePath(relative);
    if (/\\|(?:^|\/)(?:userdata|qa|\.env[^/]*|\.git|token|euler-api-key\.txt|saves|logs)(?:\/|$)/i.test(relative)) throw new Error('Unsafe Arena package file.');
    if (!['assets/', 'bootstrap/', 'defaults/', 'runtime/', 'bridge/', 'catalog/', 'support/', 'licenses/', 'provenance/'].some(prefix => relative.startsWith(prefix))) throw new Error('Unknown Arena package file.');
    if (relative.startsWith('support/') && !/^support\/(?:version\.dll|Mods\/TikMnG\.CanEmAll\.dll|UserLibs\/StbImageSharp\.dll|MelonLoader\/(?:net6|net35|net472|Dependencies|Documentation)\/.+)$/.test(relative)) throw new Error('Unknown Arena loader file: ' + relative);
    if (/^(?:support\/)?(?:.*\/)?(?:GameAssembly|Assembly-CSharp|UnityPlayer|steam_api64)\.dll$/i.test(relative)
        || relative.includes('/Il2CppAssemblies/') || relative.includes('/UnityDependencies/')) throw new Error('Original demo files cannot be distributed in the mod package.');
    return relative;
}

function readManifest(directory) {
    const file = assertSafePath(path.join(directory, 'manifest.json'));
    if (fs.statSync(file).size > 8 * 1024 ** 2) throw new Error('Arena manifest is too large.');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.type !== TYPE || manifest.schemaVersion !== 1 || manifest.platform !== 'win32-x64' || !/^\d+\.\d+\.\d+$/.test(manifest.version)
        || manifest.steam?.appId !== APP_ID || !Array.isArray(manifest.files) || !Array.isArray(manifest.baseFiles)
        || !manifest.files.length || manifest.files.length > 20000 || !manifest.baseFiles.length || manifest.baseFiles.length > 10000) throw new Error('Invalid Arena manifest.');
    return manifest;
}

function validatePackageDirectory(directory) {
    try { readManifest(directory); return REQUIRED.every(file => fs.statSync(assertSafePath(path.join(directory, file))).isFile()); }
    catch { return false; }
}

async function walk(directory, prefix, visit, signal) {
    signal?.throwIfAborted();
    assertSafePath(directory);
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        const name = prefix + entry.name;
        safeRelativePath(name);
        if (!prefix && ['game', 'userdata', 'qa'].includes(entry.name) && entry.isDirectory()) continue;
        if (entry.isSymbolicLink()) throw new Error('Arena package links are forbidden.');
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), name + '/', visit, signal);
        else if (entry.isFile()) await visit(name);
        else throw new Error('Unsupported Arena package entry.');
    }
    assertSafePath(directory);
}

function entries(items, validate) {
    const result = new Map();
    for (const item of items) {
        const relative = validate(item.path);
        if (result.has(relative.toLowerCase()) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 1) throw new Error('Invalid Arena file descriptor.');
        result.set(relative.toLowerCase(), item);
    }
    return result;
}

function baseFile(relative) {
    safeRelativePath(relative);
    if (/\\/.test(relative) || !([EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', 'UnityCrashHandler64.exe', 'baselib.dll'].includes(relative)
        || relative.startsWith("Can 'Em All Demo_Data/") || relative.startsWith('D3D12/'))) throw new Error('Invalid original demo file.');
    return relative;
}

async function verifyPackageFiles(directory, useCache = false, signal) {
    directory = assertSafePath(directory);
    const manifest = readManifest(directory);
    const files = entries(manifest.files, allowedFile);
    const base = entries(manifest.baseFiles, baseFile);
    for (const required of REQUIRED) if (!files.has(required.toLowerCase())) throw new Error('Arena package is incomplete.');
    for (const required of [EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll']) if (!base.has(required.toLowerCase())) throw new Error('Demo file index is incomplete.');
    const remaining = new Set(files.keys());
    const listed = [];
    let foundManifest = false;
    // Inspect the tree and check the metadata of every listed file.
    await walk(directory, '', name => {
        if (name === 'manifest.json') { foundManifest = true; return; }
        if (name === '.tikmng-package.json') return;
        const entry = name.toLowerCase(), item = files.get(entry);
        if (!remaining.delete(entry)) throw new Error('Arena package contains unlisted files.');
        listed.push(item);
    }, signal);
    if (!foundManifest || remaining.size) throw new Error('Arena package contains unlisted files.');
    await checkFiles(listed, async item => {
        if (!await fileMatches(path.join(directory, item.path), item, { useCache, signal, inPackageWalk: true })) {
            throw new Error('Arena package file integrity failed: ' + item.path);
        }
    }, signal);
    return { manifest, files, base };
}

// Public install/repair verification always reads and hashes every listed file.
async function verifyPackage(directory) { return verifyPackageFiles(directory); }

async function prepareLaunch({ directory, steam = findSteamDemo(), signal, onProgress = () => {} }) {
    if (!steam) throw new Error("Once Steam'den Demoyu Indir dugmesiyle ucretsiz Can 'Em All Demo oyununu kurun. Ardindan Kurulumu kontrol et dugmesine basin.");
    if (path.join(directory, 'game/MelonLoader/Dependencies/Il2CppAssemblyGenerator/Il2CppAssemblyGenerator.dll').length >= 240)
        throw new Error('Oyun klasoru bu motor icin fazla uzun. Launcher Ayarlar > Oyun klasoru bolumunden C:\\TikMnG-Oyunlar gibi kisa bir konum secin.');
    signal?.throwIfAborted();
    const verified = await verifyPackageFiles(directory, true, signal);
    if (steam.buildId !== verified.manifest.steam.buildId) throw new Error('Steam demosunun bu surumu henuz desteklenmiyor. TikMnG oyun guncellemesini kontrol edin.');
    const game = assertSafePath(path.join(directory, 'game'));
    if (key(game) === key(steam.directory) || key(directory).startsWith(key(steam.directory) + path.sep)) throw new Error('Steam original and Arena mod directories must be separate.');
    const markerFile = assertSafePath(path.join(game, '.tikmng-steam-copy.json'));
    let marker;
    try { marker = JSON.parse(await fsp.readFile(markerFile, 'utf8')); } catch {}
    if (marker && (marker.appId !== APP_ID || typeof marker.complete !== 'boolean')) throw new Error('Unrecognized Arena installation marker.');
    if (fs.existsSync(game) && !marker && (await fsp.readdir(game)).length) throw new Error('Arena game directory contains an unrecognized installation. No files were changed.');
    await fsp.mkdir(game, { recursive: true });
    if (!marker) await fsp.writeFile(markerFile, JSON.stringify({ appId: APP_ID, buildId: steam.buildId, complete: false }));
    let copied = 0;
    const totalBytes = [...verified.base.values()].reduce((n, file) => n + file.bytes, 0);
    for (const item of verified.base.values()) {
        signal?.throwIfAborted();
        const target = assertSafePath(path.join(game, item.path));
        if (await fileMatches(target, item, { useCache: true, signal })) continue;
        const source = assertSafePath(path.join(steam.directory, item.path));
        if ((await fsp.stat(source)).size !== item.bytes) throw new Error('Steam demo files are incomplete. Verify the demo in Steam.');
        await copyVerified(source, target, item, 'Steam demo verification failed. Verify the demo in Steam.', signal);
        copied += item.bytes;
        onProgress({ copiedBytes: copied, totalBytes });
    }
    for (const item of verified.files.values()) {
        if (!item.path.startsWith('support/')) continue;
        signal?.throwIfAborted();
        const relative = item.path.slice(8), target = assertSafePath(path.join(game, relative));
        if (await fileMatches(target, item, { useCache: true, signal })) continue;
        await copyVerified(path.join(directory, item.path), target, item, 'Arena loader installation verification failed.', signal);
    }
    signal?.throwIfAborted();
    if (!marker?.complete || marker.buildId !== steam.buildId) {
        await fsp.writeFile(markerFile, JSON.stringify({ appId: APP_ID, buildId: steam.buildId, complete: true }));
    }
    await fsp.mkdir(path.join(directory, 'qa'), { recursive: true });
    return { directory, game, copiedBytes: copied, version: verified.manifest.version };
}

async function launchArena({ directory, session, username = '', liveEnvironment = {}, spawnProcess = spawn, prepare = prepareLaunch }) {
    const controller = new AbortController();
    session.disposers.add(() => controller.abort());
    await session.stage('demo', 'Steam demosu ve Yaratik Arena dosyalari dogrulaniyor...', () => prepare({ directory, signal: controller.signal }), 180000);
    if (session.closed) throw new Error('Arena baslatma iptal edildi.');
    const started = Date.now();
    const child = spawnProcess(path.join(directory, 'bootstrap/TikMnG.Arena.Startup.exe'),
        ['--launcher-session', '--launcher-parent=' + process.pid], { cwd: directory, windowsHide: false,
            stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...liveEnvironment, MNG_ARENA_TIKTOK_USER: username } });
    session.ownChild(child, { normalExit: true });
    await session.waitForMarker(child, 320000);
    const state = JSON.parse(await fsp.readFile(path.join(directory, 'qa/startup-state.json'), 'utf8'));
    const trace = JSON.parse(await fsp.readFile(path.join(directory, 'qa/startup-launch.json'), 'utf8'));
    if (trace.hostProcessId !== child.pid || !Number.isSafeInteger(state.processId) || state.processId <= 0 || state.processId !== trace.gameProcessId || !state.firstFrameRendered || state.failed
        || trace.outcome === 'error' || !Number.isFinite(Date.parse(state.utc)) || Date.parse(state.utc) < started
        || Date.parse(state.utc) > Date.now() || Date.now() - Date.parse(state.utc) > 15000) throw new Error('Yaratik Arena hazir sinyali dogrulanamadi.');
    session.nativeChild = { pid: state.processId };
    session.markReady('Yaratik Arena hazir.');
    return { basarili: true };
}

module.exports = { APP_ID, STORE_URL, EXECUTABLE, TYPE, findSteamDemo, validatePackageDirectory, verifyPackage, prepareLaunch, launchArena, allowedFile };
