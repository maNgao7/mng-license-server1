'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const vdf = require('./vendor/steam-vdf/lib/index.js');
const { assertSafePath, safeRelativePath, hashFile } = require('./download.cjs');

const APP_ID = '4041470';
const EXECUTABLE = 'iracing-arcade.exe';
const TYPE = 'tikmng-forza-support';
const STORE_URL = 'https://store.steampowered.com/app/4041470/';
const NODE = 'C:/Program Files/nodejs/node.exe';
const REQUIRED = ['desktop.cjs', 'splash.html', 'bridge/service.cjs', 'support/winhttp.dll',
    'support/doorstop_config.ini', 'support/dotnet/coreclr.dll',
    'support/BepInEx/core/BepInEx.Unity.IL2CPP.dll', 'support/BepInEx/plugins/TikMnG.Arcade.Mod.dll',
    'defaults/settings.json', 'assets/effects/forward-rescue.json', 'assets/effects/forward-rocket.json',
    'assets/gifts.json', 'assets/loading-turkish-classics-v2.png', 'assets/audio/startup-music.mp3'];

function findSteamDemo({ roots, readFile = file => fs.readFileSync(file, 'utf8'),
    isFile = file => { try { const s = fs.statSync(file); return s.isFile() && s.size > 0; } catch { return false; } } } = {}) {
    const candidates = roots ? [...roots] : [path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Steam')];
    if (!roots) {
        try {
            const value = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
                { encoding: 'utf8', timeout: 1500, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
            const match = /SteamPath\s+REG_SZ\s+(.+)/i.exec(value);
            if (match) candidates.unshift(match[1].trim());
        } catch {}
        for (let c = 67; c <= 90; c++) candidates.push(String.fromCharCode(c) + ':/SteamLibrary');
    }
    const seen = new Set();
    for (const root of candidates) {
        if (typeof root !== 'string' || !path.isAbsolute(root) || seen.has(path.resolve(root).toLowerCase())) continue;
        seen.add(path.resolve(root).toLowerCase());
        try {
            const folders = vdf.parse(readFile(path.join(root, 'steamapps/libraryfolders.vdf'))).libraryfolders;
            for (const row of Object.values(folders || {})) {
                const folder = typeof row === 'string' ? row : row?.path;
                if (typeof folder === 'string' && path.isAbsolute(folder)) candidates.push(folder);
            }
        } catch {}
        try {
            const state = vdf.parse(readFile(path.join(root, `steamapps/appmanifest_${APP_ID}.acf`))).AppState;
            if (String(state?.appid) !== APP_ID || !(Number(state.StateFlags) & 4)
                || typeof state.installdir !== 'string' || /[\\/:]|^\.+$/.test(state.installdir)) continue;
            const directory = assertSafePath(path.join(root, 'steamapps/common', state.installdir));
            if ([EXECUTABLE, 'UnityPlayer.dll', 'GameAssembly.dll', 'iracing-arcade_Data/il2cpp_data/Metadata/global-metadata.dat']
                .every(file => isFile(path.join(directory, file)))) return { directory, buildId: String(state.buildid || '') };
        } catch {}
    }
    return null;
}

function defaultDataDirectory(steam = findSteamDemo(), userData = '') {
    if (!steam?.directory) return path.join(path.resolve(userData), 'forza-preview');
    // The native demo is much larger than a normal launcher profile. Keep its
    // private runtime on the same roomy drive as Steam instead of filling C:.
    const drive = path.parse(path.resolve(steam.directory)).root;
    return path.join(drive, 'TikMnG-GameData', 'forza-preview');
}

function allowedFile(relative) {
    safeRelativePath(relative);
    if (/^(desktop\.cjs|splash\.html|bridge\/service\.cjs)$/.test(relative)) return relative;
    if (relative === 'defaults/settings.json') return relative;
    if (/(?:^|\/)(?:\.env[^/]*|token|userdata|control|logs|cache|interop|unity-libs|reference-photos|comparisons)(?:\/|$)/i.test(relative)) throw new Error('Private or generated Forza file: ' + relative);
    if (/^(?:assets|licenses|provenance)\//.test(relative) && !/\.(?:exe|dll|cjs|js)$/i.test(relative)) return relative;
    if (/^support\/(?:winhttp\.dll|doorstop_config\.ini|BepInEx\/config\/BepInEx\.cfg|BepInEx\/plugins\/TikMnG\.Arcade\.Mod\.dll|BepInEx\/(?:core|patchers)\/.+|dotnet\/.+)$/.test(relative)
        && !/(?:^|\/)(?:GameAssembly|UnityPlayer|Assembly-CSharp|steam_api64)\.dll$/i.test(relative)) return relative;
    throw new Error('Unknown Forza package file: ' + relative);
}

function baseFile(relative) {
    safeRelativePath(relative);
    if ([EXECUTABLE, 'GameAssembly.dll', 'UnityPlayer.dll', 'UnityCrashHandler64.exe', 'baselib.dll', 'steam_appid.txt', 'FishNet.SDK.Id'].includes(relative)
        || relative.startsWith('iracing-arcade_Data/') || relative.startsWith('D3D12/')) return relative;
    throw new Error('Unknown Steam demo file: ' + relative);
}

async function filesIn(directory, prefix = '') {
    assertSafePath(directory);
    const files = [];
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
        const relative = safeRelativePath(prefix + entry.name), file = assertSafePath(path.join(directory, entry.name));
        if (entry.isDirectory()) files.push(...await filesIn(file, relative + '/'));
        else if (entry.isFile()) files.push(relative);
        else throw new Error('Linked or special package entry.');
    }
    return files;
}

function readManifest(directory) {
    const file = assertSafePath(path.join(directory, 'manifest.json'));
    if (fs.statSync(file).size > 8 * 1024 ** 2) throw new Error('Forza manifest too large.');
    const m = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (m.type !== TYPE || m.schemaVersion !== 1 || m.platform !== 'win32-x64'
        || !/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(m.version) || m.steam?.appId !== APP_ID
        || !/^\d+$/.test(m.steam.buildId) || !Array.isArray(m.files) || !Array.isArray(m.baseFiles)
        || !m.files.length || m.files.length > 20000 || !m.baseFiles.length || m.baseFiles.length > 20000) throw new Error('Invalid Forza manifest.');
    return m;
}

function validatePackageDirectory(directory) {
    try { readManifest(directory); return REQUIRED.every(file => fs.statSync(assertSafePath(path.join(directory, file))).isFile()); }
    catch { return false; }
}

function descriptors(rows, allow) {
    const map = new Map();
    for (const row of rows) {
        const key = allow(row.path).toLowerCase();
        if (map.has(key) || !/^[a-f0-9]{64}$/.test(row.sha256) || !Number.isSafeInteger(row.bytes) || row.bytes < 0) throw new Error('Invalid Forza file descriptor.');
        map.set(key, row);
    }
    return map;
}

async function verifyPackage(directory) {
    const manifest = readManifest(directory), files = descriptors(manifest.files, allowedFile), base = descriptors(manifest.baseFiles, baseFile);
    for (const name of REQUIRED) if (!files.has(name.toLowerCase())) throw new Error('Incomplete Forza support package: ' + name);
    for (const name of [EXECUTABLE, 'UnityPlayer.dll', 'GameAssembly.dll', 'iracing-arcade_Data/il2cpp_data/Metadata/global-metadata.dat']) {
        if (!base.has(name.toLowerCase())) throw new Error('Incomplete Forza Steam file index.');
    }
    const actual = (await filesIn(directory)).filter(name => !['manifest.json', '.tikmng-package.json', '.tikmng-content.json'].includes(name));
    if (actual.length !== files.size || actual.some(name => !files.has(name.toLowerCase()))) throw new Error('Unlisted Forza package files.');
    for (const row of files.values()) {
        const file = assertSafePath(path.join(directory, row.path));
        if ((await fs.promises.stat(file)).size !== row.bytes || await hashFile(file) !== row.sha256) throw new Error('Forza package integrity failed: ' + row.path);
    }
    return { manifest, files, base };
}

async function atomicJson(file, value) {
    assertSafePath(file);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    try {
        const handle = await fs.promises.open(temp, 'wx');
        try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
        await fs.promises.rename(temp, file);
    } finally { await fs.promises.rm(temp, { force: true }); }
}

async function prepareLaunch({ directory, dataDirectory, steam = findSteamDemo(), signal, onProgress = () => {} }) {
    if (!steam) throw new Error('Once Steam uzerinden ucretsiz iRacing Arcade Demo kurun.');
    const verified = await verifyPackage(directory);
    if (steam.buildId !== verified.manifest.steam.buildId) throw new Error('Steam demosunun bu surumu desteklenmiyor. Oyun paketini guncelleyin.');
    const data = assertSafePath(path.resolve(dataDirectory)), game = path.join(data, 'runtime');
    for (const input of [directory, steam.directory]) {
        const a = path.resolve(input).toLowerCase(), b = data.toLowerCase();
        if (a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep)) throw new Error('Forza data must be separate from package and Steam.');
    }
    const markerFile = path.join(data, '.tikmng-forza-install.json');
    let marker;
    try { marker = JSON.parse(await fs.promises.readFile(markerFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('Unrecognized Forza installation marker.'); }
    if (marker && (marker.schemaVersion !== 1 || marker.appId !== APP_ID)) throw new Error('Unrecognized Forza installation marker.');
    if (!marker && fs.existsSync(data) && (await fs.promises.readdir(data)).some(name => name !== '.launch-lock')) throw new Error('Unrecognized Forza data directory.');
    await atomicJson(markerFile, { schemaVersion: 1, appId: APP_ID, buildId: steam.buildId, complete: false });
    let copiedBytes = 0;
    async function copyVerified(source, target, row) {
        signal?.throwIfAborted();
        assertSafePath(source); assertSafePath(target);
        if (fs.existsSync(target) && (await fs.promises.stat(target)).size === row.bytes && await hashFile(target) === row.sha256) return;
        if ((await fs.promises.stat(source)).size !== row.bytes) throw new Error('Steam/package file size mismatch: ' + row.path);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        const temp = target + '.tikmng-copy';
        assertSafePath(temp);
        try {
            await fs.promises.copyFile(source, temp);
            if (await hashFile(temp) !== row.sha256) throw new Error('Steam/package file integrity failed: ' + row.path);
            signal?.throwIfAborted();
            await fs.promises.rename(temp, target);
        } finally { await fs.promises.rm(temp, { force: true }); }
        copiedBytes += row.bytes; onProgress({ copiedBytes });
    }
    for (const row of verified.base.values()) await copyVerified(path.join(steam.directory, row.path), path.join(game, row.path), row);
    for (const row of verified.files.values()) {
        const relative = row.path.startsWith('support/') ? 'runtime/' + row.path.slice(8) : row.path;
        await copyVerified(path.join(directory, row.path), path.join(data, relative), row);
    }
    await fs.promises.mkdir(path.join(data, 'control'), { recursive: true });
    const settingsFile = assertSafePath(path.join(data, 'control/settings.json'));
    if (!fs.existsSync(settingsFile)) await atomicJson(settingsFile, JSON.parse(await fs.promises.readFile(path.join(directory, 'defaults/settings.json'), 'utf8')));
    await atomicJson(markerFile, { schemaVersion: 1, appId: APP_ID, buildId: steam.buildId, complete: true, version: verified.manifest.version });
    return { directory: data, game, copiedBytes, version: verified.manifest.version };
}

function assertNoDemoProcess(run = execFileSync) {
    const output = run('tasklist.exe', ['/FI', 'IMAGENAME eq ' + EXECUTABLE, '/FO', 'CSV', '/NH'],
        { windowsHide: true, timeout: 5000, encoding: 'utf8' });
    if (/"iracing-arcade\.exe"/i.test(output)) throw new Error('iRacing Arcade Demo zaten acik. Mevcut oyunu kapatip yeniden deneyin.');
}

async function launchForza({ directory, dataDirectory, steam, session, BrowserWindow, events, getChannel, getStatus,
    portrait, username = '', spawnProcess = spawn, prepare = prepareLaunch, checkProcess = assertNoDemoProcess,
    checkNode = () => fs.existsSync(NODE), showNativeWindow = require('./native-window.cjs').showNativeWindow,
    ensureSteam = async () => {
        const out = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
        if (!/"steam\.exe"/i.test(out)) throw new Error('Steam hesabini acip yeniden deneyin.');
    } }) {
    checkProcess();
    await ensureSteam();
    const controller = new AbortController();
    session.disposers.add(() => controller.abort());
    assertSafePath(dataDirectory);
    await fs.promises.mkdir(dataDirectory, { recursive: true });
    const releaseLaunchLock = await require('./forza-launch-lock.cjs').acquireForzaLaunchLock(dataDirectory, assertSafePath, checkProcess);
    if (session.closed) {
        await releaseLaunchLock();
        throw new Error('Forza başlatma iptal edildi.');
    }
    session.disposers.add(releaseLaunchLock);
    const prepared = await session.stage('forza-files', 'Steam demosu ve Turkish Forza dosyalari dogrulaniyor...',
        () => prepare({ directory, dataDirectory, steam, signal: controller.signal }), 240000);
    if (session.closed) throw new Error('Forza baslatma iptal edildi.');
    const usesLauncherRuntime = require('semver').gte(prepared.version, '0.5.1');
    if (!usesLauncherRuntime && !checkNode()) throw new Error('Turkish Forza oyun paketini güncelleyin. Bu eski paket node.exe gerektiriyor.');
    const { createForzaPublisher } = require('./forza-publisher.cjs');
    const feed = await createForzaPublisher({ events, getChannel, getStatus, portrait, username, directory: prepared.directory,
        onError: error => { void session.close(error); } });
    session.disposers.add(() => feed.close());
    const cover = require(path.join(prepared.directory, 'desktop.cjs')).createCover({ BrowserWindow, directory: prepared.directory });
    session.disposers.add(() => { if (!cover.isDestroyed()) cover.destroy(); });
    const onCoverClosed = () => { if (!session.ready) void session.close(new Error('Forza acilisi kapatildi.')); };
    cover.once('closed', onCoverClosed);
    await cover.loadFile(path.join(prepared.directory, 'splash.html')); cover.maximize(); cover.show();
    const playback = await cover.webContents.executeJavaScript("(async()=>{const audio=document.getElementById('opening-music');if(!audio)return {error:'missing-audio'};try{await audio.play();return {playing:!audio.paused,volume:audio.volume};}catch(error){return {error:error.name};}})()");
    if (playback?.error) throw new Error('Forza açılış müziği başlatılamadı: '+playback.error);
    checkProcess();
    const started = Date.now();
    const control = path.join(prepared.directory, 'control');
    await atomicJson(path.join(control, 'command.json'), { id: started, command: 'none' });
    const child = session.ownChild(spawnProcess(path.join(prepared.game, EXECUTABLE), ['-screen-fullscreen', '0'], {
        cwd: prepared.game, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false,
        env: { ...process.env, MNG_FORZA_PUBLISHER_URL: feed.url, MNG_FORZA_PUBLISHER_TOKEN: feed.token,
            MNG_FORZA_LAUNCHER_RUNTIME: usesLauncherRuntime ? process.execPath : '' }
    }), { normalExit: true });
    session.nativeChild = child;
    await atomicJson(path.join(control, 'launch-session.json'), { schemaVersion: 1, pid: child.pid });
    let timer;
    const wait = new Promise((resolve, reject) => {
        timer = setInterval(() => {
            try {
                const state = JSON.parse(fs.readFileSync(path.join(control, 'status.json'), 'utf8'));
                if (state.pid !== child.pid || Date.parse(state.utc) < started || Date.now() - Date.parse(state.utc) > 4000) return;
                if (state.error || state.phase === 'error') return reject(new Error(state.error || 'Forza native startup error.'));
                if (state.phase === 'staging' && state.appReady && state.camera && state.cars?.length === 0 && !state.startRequested) resolve(state);
            } catch (e) { if (!['ENOENT', 'SyntaxError'].includes(e.code || e.name)) reject(e); }
        }, 150);
    });
    const stop = () => clearInterval(timer); session.disposers.add(stop);
    try { await session.wait(wait, 240000, 'Turkish Forza piste zamaninda ulasamadi. control/status.json ve runtime/BepInEx/LogOutput.log kayitlarini kontrol edin.'); }
    finally { stop(); session.disposers.delete(stop); }
    await session.stage('forza-opening', 'Acilis sunumu tamamlaniyor...', async () => {
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
            controller.signal.throwIfAborted();
            if (await cover.webContents.executeJavaScript("document.getElementById('opening-music').volume === 0 || document.getElementById('opening-music').ended || !!document.getElementById('opening-music').error")) return;
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        throw new Error('Forza acilis sesi zaman asimina ugradi.');
    }, 46000);
    await showNativeWindow(child.pid);
    cover.removeListener('closed', onCoverClosed);
    cover.destroy();
    await atomicJson(path.join(control, 'command.json'), { id: Date.now(), command: 'track-intro' });
    if (username) {
        // The command slot is acknowledged before account handoff to avoid overwriting the intro.
        await session.stage('forza-bridge', 'Yayinci olay akisi hazirlaniyor...', async () => {
            const intro = JSON.parse(fs.readFileSync(path.join(control, 'command.json'), 'utf8')).id;
            while (true) {
                controller.signal.throwIfAborted();
                let state; try { state = JSON.parse(fs.readFileSync(path.join(control, 'status.json'), 'utf8')); } catch {}
                if (state?.pid === child.pid && state.commandId >= intro) break;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            await atomicJson(path.join(control, 'command.json'), { id: Math.max(Date.now(), intro + 1), command: 'connect', username });
            await session.wait(feed.clientAttached, 15000, 'Native oyun launcher yayin akisina baglanamadi. Node.js ve control/status.json kaydini kontrol edin.');
        }, 26000);
    }
    session.markReady('Turkish Forza hazir.');
    return { basarili: true };
}

module.exports = { APP_ID, TYPE, EXECUTABLE, STORE_URL, NODE, REQUIRED, findSteamDemo, defaultDataDirectory, allowedFile, baseFile,
    filesIn, readManifest, verifyPackage, validatePackageDirectory, prepareLaunch, atomicJson, assertNoDemoProcess, launchForza };
