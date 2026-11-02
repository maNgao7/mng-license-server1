'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const vdf = require('./vendor/steam-vdf/lib/index.js');
const { assertSafePath, safeRelativePath, hashFile } = require('./download.cjs');

const APP_ID = '5364590';
const STORE_URL = 'https://store.steampowered.com/app/5364590/';
const EXECUTABLE = "Can 'Em All Demo.exe";
const TYPE = 'tikmng-arena-support';
const REQUIRED = ['bootstrap/TikMnG.Arena.Startup.exe', 'support/Mods/TikMnG.CanEmAll.dll',
    'support/version.dll', 'runtime/host/fxr/6.0.36/hostfxr.dll', 'bridge/index.cjs',
    'bridge/runtime/node.exe', 'catalog/gifts.json', 'defaults/game-settings.json'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const key = value => path.resolve(value).toLowerCase();

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

async function walk(directory, prefix = '') {
    const files = [];
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        const name = prefix + entry.name;
        safeRelativePath(name);
        if (!prefix && ['game', 'userdata', 'qa'].includes(entry.name) && entry.isDirectory()) continue;
        if (entry.isSymbolicLink()) throw new Error('Arena package links are forbidden.');
        if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), name + '/'));
        else if (entry.isFile()) files.push(name);
        else throw new Error('Unsupported Arena package entry.');
    }
    return files;
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

async function verifyPackage(directory) {
    assertSafePath(directory);
    const manifest = readManifest(directory);
    const files = entries(manifest.files, allowedFile);
    const base = entries(manifest.baseFiles, baseFile);
    for (const required of REQUIRED) if (!files.has(required.toLowerCase())) throw new Error('Arena package is incomplete.');
    for (const required of [EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll']) if (!base.has(required.toLowerCase())) throw new Error('Demo file index is incomplete.');
    const actual = (await walk(directory)).filter(file => !file.startsWith('game/') && !file.startsWith('userdata/') && !file.startsWith('qa/'));
    if (actual.some(file => !['manifest.json', '.tikmng-package.json'].includes(file) && !files.has(file.toLowerCase()))
        || actual.length !== files.size + 1 + Number(actual.includes('.tikmng-package.json'))) throw new Error('Arena package contains unlisted files.');
    for (const item of files.values()) {
        const file = assertSafePath(path.join(directory, item.path));
        if ((await fsp.stat(file)).size !== item.bytes || await hashFile(file) !== item.sha256) throw new Error('Arena package file integrity failed: ' + item.path);
    }
    return { manifest, files, base };
}

async function prepareLaunch({ directory, steam = findSteamDemo(), signal, onProgress = () => {} }) {
    if (!steam) throw new Error("Once Steam'den Demoyu Indir dugmesiyle ucretsiz Can 'Em All Demo oyununu kurun. Ardindan Kurulumu kontrol et dugmesine basin.");
    if (path.join(directory, 'game/MelonLoader/Dependencies/Il2CppAssemblyGenerator/Il2CppAssemblyGenerator.dll').length >= 240)
        throw new Error('Oyun klasoru bu motor icin fazla uzun. Launcher Ayarlar > Oyun klasoru bolumunden C:\\TikMnG-Oyunlar gibi kisa bir konum secin.');
    const verified = await verifyPackage(directory);
    if (steam.buildId !== verified.manifest.steam.buildId) throw new Error('Steam demosunun bu surumu henuz desteklenmiyor. TikMnG oyun guncellemesini kontrol edin.');
    const game = assertSafePath(path.join(directory, 'game'));
    if (key(game) === key(steam.directory) || key(directory).startsWith(key(steam.directory) + path.sep)) throw new Error('Steam original and Arena mod directories must be separate.');
    const markerFile = path.join(game, '.tikmng-steam-copy.json');
    let marker;
    try { marker = JSON.parse(await fsp.readFile(markerFile, 'utf8')); } catch {}
    if (marker && (marker.appId !== APP_ID || typeof marker.complete !== 'boolean')) throw new Error('Unrecognized Arena installation marker.');
    if (fs.existsSync(game) && !marker && (await fsp.readdir(game)).length) throw new Error('Arena game directory contains an unrecognized installation. No files were changed.');
    await fsp.mkdir(game, { recursive: true });
    if (!marker) await fsp.writeFile(markerFile, JSON.stringify({ appId: APP_ID, buildId: steam.buildId, complete: false }));
    const cached = marker?.appId === APP_ID && marker?.buildId === steam.buildId && marker?.complete === true;
    let copied = 0;
    for (const item of verified.base.values()) {
        signal?.throwIfAborted();
        const target = assertSafePath(path.join(game, item.path));
        const source = assertSafePath(path.join(steam.directory, item.path));
        const size = await fsp.stat(target).catch(() => null);
        const critical = [EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll'].includes(item.path);
        if (cached && size?.isFile() && size.size === item.bytes && (!critical || await hashFile(target) === item.sha256)) continue;
        if ((await fsp.stat(source)).size !== item.bytes) throw new Error('Steam demo files are incomplete. Verify the demo in Steam.');
        await fsp.mkdir(path.dirname(target), { recursive: true });
        const temporary = target + '.tikmng-copy';
        try {
            await fsp.copyFile(source, temporary);
            if (await hashFile(temporary) !== item.sha256) throw new Error('Steam demo verification failed. Verify the demo in Steam.');
            await fsp.rename(temporary, target);
        } finally { await fsp.rm(temporary, { force: true }).catch(() => {}); }
        copied += item.bytes;
        onProgress({ copiedBytes: copied, totalBytes: [...verified.base.values()].reduce((n, file) => n + file.bytes, 0) });
    }
    for (const item of verified.files.values()) {
        if (!item.path.startsWith('support/')) continue;
        signal?.throwIfAborted();
        const relative = item.path.slice(8), target = assertSafePath(path.join(game, relative));
        if (fs.existsSync(target) && await hashFile(target) === item.sha256) continue;
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.copyFile(path.join(directory, item.path), target);
        if (await hashFile(target) !== item.sha256) throw new Error('Arena loader installation verification failed.');
    }
    await fsp.writeFile(markerFile, JSON.stringify({ appId: APP_ID, buildId: steam.buildId, complete: true }));
    await fsp.mkdir(path.join(directory, 'qa'), { recursive: true });
    return { directory, game, copiedBytes: copied, version: verified.manifest.version };
}

async function launchArena({ directory, session, username = '', spawnProcess = spawn, prepare = prepareLaunch }) {
    await session.stage('demo', 'Steam demosu ve Yaratik Arena dosyalari dogrulaniyor...', () => prepare({ directory }), 180000);
    const child = spawnProcess(path.join(directory, 'bootstrap/TikMnG.Arena.Startup.exe'),
        ['--launcher-session', '--launcher-parent=' + process.pid], { cwd: directory, windowsHide: false,
            stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MNG_ARENA_TIKTOK_USER: username } });
    session.ownChild(child, { normalExit: true });
    await session.waitForMarker(child, 320000);
    const state = JSON.parse(await fsp.readFile(path.join(directory, 'qa/startup-state.json'), 'utf8'));
    const trace = JSON.parse(await fsp.readFile(path.join(directory, 'qa/startup-launch.json'), 'utf8'));
    if (trace.hostProcessId !== child.pid || !Number.isSafeInteger(state.processId) || state.processId <= 0 || state.processId !== trace.gameProcessId || !state.firstFrameRendered || state.failed
        || !Number.isFinite(Date.parse(state.utc)) || Date.now() - Date.parse(state.utc) > 15000) throw new Error('Yaratik Arena hazir sinyali dogrulanamadi.');
    session.nativeChild = { pid: state.processId };
    session.markReady('Yaratik Arena hazir.');
    return { basarili: true };
}

module.exports = { APP_ID, STORE_URL, EXECUTABLE, TYPE, findSteamDemo, validatePackageDirectory, verifyPackage, prepareLaunch, launchArena, allowedFile };
