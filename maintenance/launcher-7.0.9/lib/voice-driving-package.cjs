'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { assertSafePath, safeRelativePath, hashFile } = require('./download.cjs');

const PACKAGE_TYPE = 'tikmng-caaahr-support';
const BEPINEX = Object.freeze({
    version: '5.4.23.5',
    url: 'https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.5/BepInEx_win_x64_5.4.23.5.zip',
    sha256: '82f9878551030f54657792c0740d9d51a09500eeae1fba21106b0c441e6732c4'
});
const RUNTIME_FILES = Object.freeze([
    '.doorstop_version', 'doorstop_config.ini', 'winhttp.dll',
    ...['0Harmony.dll', '0Harmony.xml', '0Harmony20.dll', 'BepInEx.dll',
        'BepInEx.Harmony.dll', 'BepInEx.Harmony.xml', 'BepInEx.Preloader.dll',
        'BepInEx.Preloader.xml', 'BepInEx.xml', 'HarmonyXInterop.dll',
        'Mono.Cecil.dll', 'Mono.Cecil.Mdb.dll', 'Mono.Cecil.Pdb.dll', 'Mono.Cecil.Rocks.dll',
        'MonoMod.RuntimeDetour.dll', 'MonoMod.RuntimeDetour.xml', 'MonoMod.Utils.dll',
        'MonoMod.Utils.xml'].map(name => 'BepInEx/core/' + name)
]);
const SUPPORT_FILES = Object.freeze([...RUNTIME_FILES,
    'BepInEx/plugins/TikMnG.Caaahr.Voice.dll', 'BepInEx/plugins/Newtonsoft.Json.dll']);
const BOOTSTRAP = 'BepInEx/config/TikMnG.Bootstrap.json';
const LIBRARY_MARKER = '.tikmng-package.json';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
const validVersion = value => typeof value === 'string' && value.length <= 64
    && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(value);

function absolute(value, name) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path.`);
    return assertSafePath(value);
}

function allowedPackagePath(value) {
    safeRelativePath(value);
    if (/\.(?:exe|pdb)$/i.test(value) || /(?:^|\/)(?:Assembly-CSharp[^/]*|UnityEngine[^/]*|UnityPlayer|GameAssembly|steam_api64|Fusion[^/]*)\.dll$/i.test(value)
        || /(?:^|\/)[^/]*_Data(?:\/|$)/i.test(value)
        || /(?:^|\/)(?:electron(?:-builder)?|\.git|\.npmrc|\.env[^/]*|euler-api-key\.txt|token|settings\.json|userdata|saves|logs)(?:\/|$)/i.test(value)) {
        throw new Error(`Forbidden package file: ${value}`);
    }
    if (value.startsWith('support/')) {
        if (!SUPPORT_FILES.includes(value.slice(8))) throw new Error(`Unknown support file: ${value}`);
    } else if (!['backend/', 'catalog/', 'licenses/', 'provenance/'].some(prefix => value.startsWith(prefix))
        && value !== 'PACKAGE-README.txt') throw new Error(`Unknown package file: ${value}`);
    return value;
}

async function packageFiles(root) {
    assertSafePath(root);
    const files = [];
    async function visit(directory) {
        for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
            safeRelativePath(entry.name);
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) await visit(file);
            else if (entry.isFile()) files.push(path.relative(root, file).split(path.sep).join('/'));
            else throw new Error(`Links and special files are forbidden: ${file}`);
        }
    }
    await visit(root);
    return files.sort();
}

function validatePackageDirectory(packageDirectory, { version } = {}) {
    try {
        const root = absolute(packageDirectory, 'packageDirectory');
        const file = assertSafePath(path.join(root, 'manifest.json'));
        if (fs.statSync(file).size > 16 * 1024 ** 2) return false;
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        return manifest.type === PACKAGE_TYPE && manifest.schemaVersion === 1 && manifest.platform === 'win32-x64'
            && validVersion(manifest.version) && (version === undefined || version === manifest.version)
            && ['backend/server.mjs', 'backend/package.json', 'catalog/.gift-catalog.json',
                'support/BepInEx/plugins/TikMnG.Caaahr.Voice.dll'].every(relative => fs.statSync(assertSafePath(path.join(root, relative))).isFile());
    } catch { return false; }
}

async function validateLibraryMarker(root, version) {
    const file = assertSafePath(path.join(root, LIBRARY_MARKER));
    if ((await fsp.stat(file)).size > 1024) throw new Error('Invalid library activation marker.');
    const marker = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (!marker || Object.keys(marker).sort().join(',') !== 'game,installedAt,version' || marker.game !== 'caahr'
        || marker.version !== version || typeof marker.installedAt !== 'string'
        || !Number.isFinite(Date.parse(marker.installedAt)) || new Date(marker.installedAt).toISOString() !== marker.installedAt) {
        throw new Error('Invalid library activation marker.');
    }
}

async function verifyPackage({ packageDirectory, expectedManifestSha256 }) {
    const root = absolute(packageDirectory, 'packageDirectory');
    const bytes = await fsp.readFile(assertSafePath(path.join(root, 'manifest.json')));
    if (bytes.length > 16 * 1024 ** 2) throw new Error('Package manifest is too large.');
    const manifestSha256 = digest(bytes);
    if (expectedManifestSha256 && manifestSha256 !== expectedManifestSha256.toLowerCase()) throw new Error('Manifest SHA-256 mismatch.');
    const manifest = JSON.parse(bytes);
    if (manifest.schemaVersion !== 1 || manifest.type !== PACKAGE_TYPE || manifest.platform !== 'win32-x64' || !validVersion(manifest.version)
        || manifest.runtime?.sha256 !== BEPINEX.sha256 || manifest.runtime?.url !== BEPINEX.url
        || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 30000) {
        throw new Error('Invalid voice driving support manifest.');
    }
    const seen = new Set();
    const entries = new Map();
    for (const item of manifest.files) {
        const relative = allowedPackagePath(item.path), key = relative.toLowerCase();
        if (seen.has(key) || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
            throw new Error(`Invalid or duplicate manifest entry: ${relative}`);
        }
        seen.add(key); entries.set(relative, item);
    }
    for (const relative of [...SUPPORT_FILES.map(name => 'support/' + name), 'backend/server.mjs',
        'backend/package.json', 'backend/package-lock.json', 'backend/node_modules/express/package.json',
        'backend/node_modules/lucide/dist/umd/lucide.js', 'backend/node_modules/sharp/package.json',
        'backend/node_modules/tiktok-live-connector/package.json', 'catalog/.gift-catalog.json', 'provenance/sources.json']) {
        if (!entries.has(relative)) throw new Error(`Required package file missing: ${relative}`);
    }
    if (manifest.pluginSha256 !== entries.get('support/BepInEx/plugins/TikMnG.Caaahr.Voice.dll').sha256) throw new Error('Plugin provenance hash mismatch.');
    const actual = await packageFiles(root);
    const hasMarker = actual.includes(LIBRARY_MARKER);
    if (hasMarker) await validateLibraryMarker(root, manifest.version);
    if (actual.length !== entries.size + 1 + Number(hasMarker) || actual.some(name => !['manifest.json', LIBRARY_MARKER].includes(name) && !entries.has(name))) {
        throw new Error('Package contains unlisted files.');
    }
    const pending = entries.entries();
    let failed = false;
    async function verifyFiles() {
        while (!failed) {
            const next = pending.next();
            if (next.done) return;
            const [relative, item] = next.value;
            try {
                const file = path.join(root, relative);
                if ((await fsp.stat(file)).size !== item.bytes || await hashFile(file) !== item.sha256) {
                    throw new Error(`Package SHA-256 mismatch: ${relative}`);
                }
            } catch (error) { failed = true; throw error; }
        }
    }
    // Bound disk work and let every in-flight verification finish before rejecting.
    const checks = await Promise.allSettled(Array.from({ length: 8 }, verifyFiles));
    const failure = checks.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return { manifest, manifestSha256, entries, packageDirectory: root };
}

function compatibleDoorstop(text) {
    let section = '', general = {};
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || /^[#;]/.test(line)) continue;
        if (line.startsWith('[') && line.endsWith(']')) { section = line.slice(1, -1).toLowerCase(); continue; }
        const separator = line.indexOf('=');
        if (section === 'general' && separator >= 0) general[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return general.enabled?.toLowerCase() === 'true'
        && general.target_assembly?.replaceAll('\\', '/').toLowerCase() === 'bepinex/core/bepinex.preloader.dll';
}

async function currentFile(file) {
    assertSafePath(file);
    try { return await fsp.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function inspect(options) {
    const verified = await verifyPackage(options);
    const gameDirectory = absolute(options.gameDirectory, 'gameDirectory');
    const dataDirectory = absolute(options.dataDirectory, 'dataDirectory');
    const roots = [gameDirectory, dataDirectory, verified.packageDirectory];
    if (roots.some((root, index) => roots.some((other, otherIndex) => index !== otherIndex && inside(root.toLowerCase(), other.toLowerCase())))) {
        throw new Error('Game, package and data directories must be separate.');
    }
    const executable = assertSafePath(path.join(gameDirectory, 'CAAAHR.exe'));
    if (!(await fsp.stat(executable).catch(() => null))?.isFile()) throw new Error('Original Steam demo CAAAHR.exe is missing.');
    const files = [];
    for (const relative of SUPPORT_FILES) {
        const item = verified.entries.get('support/' + relative);
        const destination = assertSafePath(path.join(gameDirectory, relative));
        const current = await currentFile(destination);
        let status = current === null ? 'missing' : digest(current) === item.sha256 ? 'match' : 'different';
        if (relative === 'doorstop_config.ini' && status === 'different') status = compatibleDoorstop(current.toString('utf8')) ? 'preserved-config' : 'conflict';
        files.push({ path: relative, destination, status, sha256: item.sha256 });
    }
    const bootstrapPath = assertSafePath(path.join(gameDirectory, BOOTSTRAP));
    const bootstrapBytes = await currentFile(bootstrapPath);
    let bootstrapMatches = false;
    try {
        const value = JSON.parse(bootstrapBytes);
        bootstrapMatches = value.dataDirectory === dataDirectory && !value.launcher;
    } catch {}
    return { ...verified, gameDirectory, dataDirectory, executable, files,
        bootstrapPath, bootstrapMatches, conflicts: files.filter(file => file.status === 'conflict').map(file => file.path),
        needsInstall: !bootstrapMatches || files.some(file => ['missing', 'different', 'conflict'].includes(file.status)) };
}

async function installMod(options) {
    const state = await inspect(options);
    return installInspectedMod(state);
}

async function installInspectedMod(state) {
    if (state.conflicts.length) throw new Error(`Existing loader configuration needs review: ${state.conflicts.join(', ')}`);
    if (!state.needsInstall) return { ...state, changed: [], backupDirectory: null };
    const originalHash = await hashFile(state.executable);
    const id = crypto.randomUUID();
    const backupDirectory = assertSafePath(path.join(state.dataDirectory, 'install-backups', id));
    await fsp.mkdir(state.dataDirectory, { recursive: true });
    const lockFile = assertSafePath(path.join(state.gameDirectory, '.tikmng-voice-install.lock'));
    const lock = await fsp.open(lockFile, 'wx');
    const changed = [];
    async function replace(relative, bytes) {
        const destination = assertSafePath(path.join(state.gameDirectory, relative));
        const before = await currentFile(destination);
        if (before?.equals(bytes)) return;
        if (before) {
            const backup = assertSafePath(path.join(backupDirectory, relative));
            await fsp.mkdir(path.dirname(backup), { recursive: true });
            await fsp.writeFile(backup, before, { flag: 'wx' });
        }
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        const temporary = assertSafePath(destination + '.' + id + '.tmp');
        try {
            await fsp.writeFile(temporary, bytes, { flag: 'wx' });
            await fsp.rename(temporary, destination);
            changed.push({ path: relative, destination, before });
        } finally { await fsp.rm(temporary, { force: true }); }
    }
    try {
        for (const file of state.files.filter(file => ['missing', 'different'].includes(file.status))) {
            const bytes = await fsp.readFile(assertSafePath(path.join(state.packageDirectory, 'support', file.path)));
            if (digest(bytes) !== file.sha256) throw new Error(`Package changed during installation: ${file.path}`);
            await replace(file.path, bytes);
        }
        if (!state.bootstrapMatches) await replace(BOOTSTRAP, Buffer.from(JSON.stringify({ dataDirectory: state.dataDirectory }, null, 2) + '\n'));
        if (await hashFile(state.executable) !== originalHash) throw new Error('Original game executable changed during installation.');
        for (const file of state.files.filter(file => file.status !== 'preserved-config')) {
            if (await hashFile(file.destination) !== file.sha256) throw new Error(`Installed SHA-256 mismatch: ${file.path}`);
        }
        return { ...state, needsInstall: false, bootstrapMatches: true,
            files: state.files.map(file => ({ ...file, status: file.status === 'preserved-config' ? file.status : 'match' })),
            changed: changed.map(file => file.path), backupDirectory: changed.some(file => file.before) ? backupDirectory : null };
    } catch (error) {
        for (const file of [...changed].reverse()) {
            try {
                assertSafePath(file.destination);
                if (file.before) await fsp.writeFile(file.destination, file.before);
                else await fsp.rm(file.destination);
            } catch (rollbackError) { error.message += `; rollback failed for ${file.path}: ${rollbackError.message}`; }
        }
        throw error;
    } finally { await lock.close(); await fsp.rm(lockFile, { force: true }); }
}

function createBackendLaunchSpec(verified, { dataDirectory, electronPath, environment = process.env }) {
    const dataRoot = absolute(dataDirectory, 'dataDirectory');
    const executable = absolute(electronPath, 'electronPath');
    if (inside(verified.packageDirectory.toLowerCase(), dataRoot.toLowerCase()) || inside(dataRoot.toLowerCase(), verified.packageDirectory.toLowerCase())) {
        throw new Error('Backend data must live outside the package.');
    }
    const cwd = path.join(verified.packageDirectory, 'backend');
    return { file: executable, args: [path.join(cwd, 'server.mjs')], options: {
        cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...environment,
            ELECTRON_RUN_AS_NODE: '1', TIKMNG_CAAHR_DATA_DIR: dataRoot,
            TIKMNG_CAAHR_CATALOG_ROOT: path.join(verified.packageDirectory, 'catalog') }
    }, url: 'http://127.0.0.1:4051', dataDirectory: dataRoot };
}

async function backendLaunchSpec(options) {
    return createBackendLaunchSpec(await verifyPackage(options), options);
}

async function prepareLaunch(options) {
    const started = performance.now();
    const state = await inspect(options);
    const verifiedAt = performance.now();
    const backend = options.electronPath ? createBackendLaunchSpec(state, options) : null;
    const installation = await installInspectedMod(state);
    return { installation, backend, timings: { verificationMs: Math.round(verifiedAt - started),
        installationMs: Math.round(performance.now() - verifiedAt), totalMs: Math.round(performance.now() - started),
        verifiedFiles: state.entries.size } };
}

module.exports = { inspect, installMod, backendLaunchSpec, prepareLaunch, verifyPackage, validatePackageDirectory, allowedPackagePath, packageFiles,
    PACKAGE_TYPE, BEPINEX, RUNTIME_FILES, SUPPORT_FILES };
