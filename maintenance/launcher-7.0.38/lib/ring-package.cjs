'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const vdf = require('./vendor/steam-vdf/lib/index.js');
const { assertSafePath, safeRelativePath, hashFile } = require('./download.cjs');

const APP_ID = '4793540';
const STORE_URL = 'https://store.steampowered.com/app/4793540/';
const EXECUTABLE = 'Ring.exe';
const STEAM_EXECUTABLE = 'boxing.exe';
const STEAM_SHA256 = '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67';
// Native bootstrap converts the current demo only in its private working copy,
// then verifies STEAM_SHA256 before applying the existing native integration.
const STEAM_SOURCE_HASHES = Object.freeze([STEAM_SHA256,
    'fe6f213d0f8eabc4674f9160fcee128f448727c255a8ed8a1a029b5a58d782ed']);
const OWNER_HELPER = 'bridge/runtime/owner-helper.cjs';
const CATALOG = 'bridge/runtime/gift-assets/katalog_tam.json';
const key = value => path.resolve(value).toLowerCase();
const overlaps = (a, b) => key(a) === key(b) || key(a).startsWith(key(b) + path.sep) || key(b).startsWith(key(a) + path.sep);
const isFile = file => {
    try { const stat = fs.statSync(assertSafePath(file)); return stat.isFile() && stat.size > 0; }
    catch { return false; }
};

function validatePackageDirectory(directory) {
    if (!directory) return false;
    try {
        if (![EXECUTABLE, 'resources/app/package.json', OWNER_HELPER, CATALOG]
            .every(file => isFile(path.join(directory, file)))) return false;
        const app = JSON.parse(fs.readFileSync(path.join(directory, 'resources/app/package.json'), 'utf8'));
        const entry = safeRelativePath(app.main || 'index.js');
        return isFile(path.join(directory, 'resources/app', entry));
    } catch { return false; }
}

// Same registry, libraryfolders.vdf and installed-app checks as the other Steam mods.
// A package's boxing.exe is never a substitute for an installed Steam demo.
function findSteamDemo({ roots, env = process.env, readFile = file => fs.readFileSync(file, 'utf8'),
    isFile: fileExists = isFile } = {}) {
    const candidates = roots ? [...roots] : [path.join(env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Steam'),
        path.join(env.ProgramFiles || 'C:/Program Files', 'Steam')];
    if (!roots) {
        try {
            const value = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
                { encoding: 'utf8', windowsHide: true, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] });
            const match = /SteamPath\s+REG_SZ\s+(.+)/i.exec(value);
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
            const name = safeRelativePath(state.installdir);
            if (name.length > 200 || name.includes('/')) continue;
            const directory = assertSafePath(path.join(root, 'steamapps/common', name));
            if (fileExists(path.join(directory, STEAM_EXECUTABLE))) return { directory, buildId: String(state.buildid) };
        } catch {}
    }
    return null;
}

async function resolveSteamDemo({ directory, steam = findSteamDemo(), hashSource = hashFile }) {
    if (!steam?.directory) throw new Error(`Önce Steam’den ücretsiz Online Boxing 3D Demo (App ID: ${APP_ID}) oyununu kurun, ardından Ring’i yeniden açın. ${STORE_URL}`);
    const source = assertSafePath(steam.directory);
    if (!path.isAbsolute(steam.directory) || overlaps(directory, source)) throw new Error('Ring paketi ve Steam demosu ayrı klasörlerde olmalı.');
    const executable = assertSafePath(path.join(source, STEAM_EXECUTABLE));
    if (!isFile(executable) || !STEAM_SOURCE_HASHES.includes(await hashSource(executable))) {
        throw new Error(`Steam demosunun sürümü Ring ile eşleşmiyor. Steam > Özellikler > Yüklü Dosyalar > Dosyaların bütünlüğünü doğrula işlemini uygulayın ve Ring güncellemesini kontrol edin. ${STORE_URL}`);
    }
    return source;
}

async function launchRing({ directory, dataDirectory, session, events, getChannel, getStatus,
    catalogDirectory = path.join(directory, 'bridge/runtime/gift-assets') },
    { spawnProcess = spawn, findSteam = findSteamDemo, hashSource = hashFile,
        createOwner = options => require(path.join(directory, OWNER_HELPER)).createLauncherOwner(options) } = {}) {
    if (!validatePackageDirectory(directory)) throw new Error('Ring paketi eksik. Launcher’dan dosyaları onarın.');
    if (session.closed) throw session.error || new Error('Ring açılışı iptal edildi.');
    const source = await resolveSteamDemo({ directory, steam: findSteam(), hashSource });
    if (session.closed) throw session.error || new Error('Ring açılışı iptal edildi.');
    dataDirectory = assertSafePath(dataDirectory);
    if (overlaps(dataDirectory, directory) || overlaps(dataDirectory, source)) throw new Error('Ring kayıt klasörü oyun paketinden ve Steam demosundan ayrı olmalı.');
    await fs.promises.mkdir(dataDirectory, { recursive: true });
    const signalPath = path.join(dataDirectory, `startup-${randomUUID()}.signal`);
    const owner = await createOwner({
        subscribeSharedEvents: events.subscribe, ensureLive: session.ensureLive, getChannel, getStatus, catalogDirectory,
        journalFile: path.join(dataDirectory, 'launcher-live.jsonl'),
        portraitDirectory: path.join(dataDirectory, 'launcher-portraits')
    });
    if (session.closed) {
        await owner.close();
        throw session.error || new Error('Ring açılışı iptal edildi.');
    }
    session.disposers.add(() => owner.close());
    const env = { ...process.env, ...owner.childEnvironment, TIKMNG_RING_DATA_DIR: dataDirectory,
        TIKMNG_RING_GAME_SOURCE: source, TIKMNG_RING_STARTUP_SIGNAL: signalPath };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    try {
        const child = spawnProcess(path.join(directory, EXECUTABLE), [], {
            cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        session.ownChild(child, { normalExit: true });
        session.nativeChild = child;
        await session.stage('game-ready', 'Ring hazırlanıyor; boş ring ve başlangıç ekranı bekleniyor…', async () => {
            while (!session.closed) {
                try {
                    if ((await fs.promises.readFile(signalPath, 'utf8')).trim() === '4') return;
                } catch (error) {
                    if (!['ENOENT', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
                }
                await delay(100);
            }
            throw session.error || new Error('Ring açılışı iptal edildi.');
        }, 45000);
        session.markReady('Ring hazır. P ile maçı başlatabilirsiniz.');
        return { basarili: true };
    } catch (error) {
        await session.close(error);
        throw session.error || error;
    } finally {
        await fs.promises.rm(signalPath, { force: true });
    }
}

module.exports = { APP_ID, STORE_URL, STEAM_EXECUTABLE, STEAM_SHA256, STEAM_SOURCE_HASHES, validatePackageDirectory, findSteamDemo, resolveSteamDemo, launchRing };
