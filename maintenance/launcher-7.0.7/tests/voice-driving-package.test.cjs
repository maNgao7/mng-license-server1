'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { inspect, installMod, backendLaunchSpec, prepareLaunch, SUPPORT_FILES, BEPINEX, PACKAGE_TYPE,
    packageFiles, allowedPackagePath, validatePackageDirectory } = require('../lib/voice-driving-package.cjs');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function put(root, relative, text) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text);
}

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-package-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const options = { gameDirectory: path.join(root, 'Steam Demo'), packageDirectory: path.join(root, 'package'), dataDirectory: path.join(root, 'user data') };
    await put(options.gameDirectory, 'CAAAHR.exe', 'original Steam executable');
    await put(options.gameDirectory, 'CAAAHR_Data/Managed/Assembly-CSharp.dll', 'original managed assembly');
    await put(options.gameDirectory, 'BepInEx/plugins/UnrelatedMod.dll', 'unrelated mod');
    await put(options.gameDirectory, 'BepInEx/config/UnrelatedMod.cfg', 'custom config');
    await put(options.dataDirectory, 'settings.json', '{"rules":["custom user binding"]}');
    for (const relative of SUPPORT_FILES) await put(options.packageDirectory, 'support/' + relative,
        relative === 'doorstop_config.ini' ? '[General]\nenabled=true\ntarget_assembly=BepInEx\\core\\BepInEx.Preloader.dll\n' : 'support bytes: ' + relative);
    for (const relative of ['backend/server.mjs', 'backend/package.json', 'backend/package-lock.json',
        'backend/node_modules/express/package.json', 'backend/node_modules/lucide/dist/umd/lucide.js',
        'backend/node_modules/sharp/package.json', 'backend/node_modules/tiktok-live-connector/package.json',
        'catalog/.gift-catalog.json', 'provenance/sources.json']) await put(options.packageDirectory, relative, '{}');
    await manifest(options.packageDirectory);
    return options;
}

async function manifest(root, change = value => value) {
    const files = [];
    for (const relative of await packageFiles(root)) {
        if (relative === 'manifest.json') continue;
        const bytes = await fs.readFile(path.join(root, relative)); files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const value = change({ schemaVersion: 1, type: PACKAGE_TYPE, version: '0.6.11', platform: 'win32-x64', runtime: BEPINEX,
        pluginSha256: files.find(file => file.path === 'support/BepInEx/plugins/TikMnG.Caaahr.Voice.dll').sha256, files });
    await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(value));
}

async function originals(options) {
    return Promise.all(['CAAAHR.exe', 'CAAAHR_Data/Managed/Assembly-CSharp.dll', 'BepInEx/plugins/UnrelatedMod.dll',
        'BepInEx/config/UnrelatedMod.cfg'].map(file => fs.readFile(path.join(options.gameDirectory, file), 'utf8'))
        .concat(fs.readFile(path.join(options.dataDirectory, 'settings.json'), 'utf8')));
}

test('fresh Steam demo installs only allowlisted support files and stays idempotent', async t => {
    const options = await fixture(t), before = await originals(options);
    const state = await inspect(options);
    assert.equal(state.needsInstall, true); assert.equal(state.files.length, SUPPORT_FILES.length);
    assert.equal(await fs.stat(path.join(options.gameDirectory, 'winhttp.dll')).catch(() => null), null);
    const result = await installMod(options);
    assert.deepEqual(new Set(result.changed), new Set([...SUPPORT_FILES, 'BepInEx/config/TikMnG.Bootstrap.json']));
    assert.equal(result.backupDirectory, null); assert.deepEqual(await originals(options), before);
    assert.deepEqual(JSON.parse(await fs.readFile(result.bootstrapPath, 'utf8')), { dataDirectory: options.dataDirectory });
    assert.equal((await inspect(options)).needsInstall, false);
    assert.deepEqual((await installMod(options)).changed, []);
    assert.deepEqual(await originals(options), before);
});

test('replaced support and bootstrap files have exact recoverable backups', async t => {
    const options = await fixture(t), before = await originals(options);
    const plugin = 'BepInEx/plugins/TikMnG.Caaahr.Voice.dll';
    const bootstrap = 'BepInEx/config/TikMnG.Bootstrap.json';
    await put(options.gameDirectory, plugin, 'previous reviewed plugin');
    await put(options.gameDirectory, bootstrap, '{"launcher":"C:/old/Start.ps1","dataDirectory":"C:/old/data"}');
    const result = await installMod(options);
    assert.equal(await fs.readFile(path.join(result.backupDirectory, plugin), 'utf8'), 'previous reviewed plugin');
    assert.equal(JSON.parse(await fs.readFile(path.join(result.backupDirectory, bootstrap), 'utf8')).launcher, 'C:/old/Start.ps1');
    assert.deepEqual(await originals(options), before);
});

test('a failed support install restores overwritten files and removes only its new support files', async t => {
    const options = await fixture(t), before = await originals(options);
    const plugin = 'BepInEx/plugins/TikMnG.Caaahr.Voice.dll';
    await put(options.gameDirectory, plugin, 'previous plugin');
    const rename = fs.rename;
    fs.rename = async (source, target) => {
        if (target.endsWith('TikMnG.Bootstrap.json')) throw new Error('Simulated bootstrap write failure');
        return rename(source, target);
    };
    try { await assert.rejects(installMod(options), /Simulated bootstrap write failure/); }
    finally { fs.rename = rename; }
    assert.equal(await fs.readFile(path.join(options.gameDirectory, plugin), 'utf8'), 'previous plugin');
    assert.equal(await fs.stat(path.join(options.gameDirectory, 'winhttp.dll')).catch(() => null), null);
    assert.equal(await fs.stat(path.join(options.gameDirectory, '.tikmng-voice-install.lock')).catch(() => null), null);
    assert.deepEqual(await originals(options), before);
});

test('compatible Doorstop settings are retained; an incompatible loader is rejected before writes', async t => {
    const options = await fixture(t);
    const compatible = '[General]\nenabled = true\ntarget_assembly = BepInEx\\core\\BepInEx.Preloader.dll\nredirect_output_log=true\n';
    await put(options.gameDirectory, 'doorstop_config.ini', compatible);
    assert.equal((await inspect(options)).files.find(file => file.path === 'doorstop_config.ini').status, 'preserved-config');
    await installMod(options); assert.equal(await fs.readFile(path.join(options.gameDirectory, 'doorstop_config.ini'), 'utf8'), compatible);
    await put(options.gameDirectory, 'doorstop_config.ini', '[General]\nenabled=true\ntarget_assembly=OtherMod.dll\n');
    await assert.rejects(installMod(options), /configuration needs review/);
    assert.match(await fs.readFile(path.join(options.gameDirectory, 'doorstop_config.ini'), 'utf8'), /OtherMod.dll/);
});

test('tampered, incomplete and unlisted packages never install', async t => {
    const options = await fixture(t), file = 'support/BepInEx/core/BepInEx.dll';
    await put(options.packageDirectory, file, 'corrupt');
    await assert.rejects(installMod(options), /SHA-256 mismatch/);
    assert.equal(await fs.stat(path.join(options.gameDirectory, 'winhttp.dll')).catch(() => null), null);
    await manifest(options.packageDirectory, value => ({ ...value, files: value.files.filter(item => item.path !== file) }));
    await assert.rejects(inspect(options), /Required package file missing/);
    await manifest(options.packageDirectory);
    await put(options.packageDirectory, '.env', 'secret sentinel');
    await assert.rejects(inspect(options), /unlisted files/);
});

test('manifest cannot redirect installation into original game files or outside the package', async t => {
    const options = await fixture(t);
    for (const relative of ['support/CAAAHR.exe', 'support/CAAAHR_Data/Managed/Assembly-CSharp.dll', '../escape', 'support/BepInEx/plugins/AnotherMod.dll']) {
        await manifest(options.packageDirectory, value => ({ ...value, files: [...value.files, { path: relative, bytes: 1, sha256: '0'.repeat(64) }] }));
        await assert.rejects(inspect(options), /Forbidden|Unknown|Unsafe/);
    }
    await manifest(options.packageDirectory);
    await assert.rejects(inspect({ ...options, expectedManifestSha256: '0'.repeat(64) }), /Manifest SHA-256 mismatch/);
    await fs.rm(path.join(options.gameDirectory, 'CAAAHR.exe'));
    await assert.rejects(inspect(options), /Original Steam demo/);
});

test('installer rejects junctions and overlapping mutable data before changing support files', async t => {
    const options = await fixture(t);
    await assert.rejects(inspect({ ...options, dataDirectory: path.join(options.packageDirectory, 'data') }), /must be separate/);
    const outside = path.join(path.dirname(options.gameDirectory), 'outside'); await fs.mkdir(outside);
    await fs.symlink(outside, path.join(options.gameDirectory, 'BepInEx/core'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(installMod(options), /Links and special files/);
    assert.deepEqual(await fs.readdir(outside), []);
});

test('backend launch spec uses the supplied bundled Electron with external data and an owned catalog', async t => {
    const options = await fixture(t), electronPath = path.join(path.dirname(options.packageDirectory), 'launcher/TikMnG.exe');
    const spec = await backendLaunchSpec({ ...options, electronPath, environment: { PATH: 'no-global-node', EULER_API_KEY: 'test-env-key', ELECTRON_RUN_AS_NODE: '0' } });
    assert.equal(spec.file, electronPath);
    assert.deepEqual(spec.args, [path.join(options.packageDirectory, 'backend/server.mjs')]);
    assert.equal(spec.options.cwd, path.join(options.packageDirectory, 'backend'));
    assert.equal(spec.options.windowsHide, true); assert.equal(spec.options.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(spec.options.env.TIKMNG_CAAHR_DATA_DIR, options.dataDirectory);
    assert.equal(spec.options.env.TIKMNG_CAAHR_CATALOG_ROOT, path.join(options.packageDirectory, 'catalog'));
    assert.equal(spec.options.env.EULER_API_KEY, 'test-env-key');
    assert.equal(await fs.stat(path.join(options.dataDirectory, 'token')).catch(() => null), null);
});

test('launch preparation verifies the complete package once for both installation and backend startup', async t => {
    const options = await fixture(t), before = await originals(options);
    const electronPath = path.join(path.dirname(options.packageDirectory), 'launcher/TikMnG.exe');
    const readFile = fs.readFile;
    let manifestReads = 0;
    fs.readFile = async (file, ...args) => {
        if (file === path.join(options.packageDirectory, 'manifest.json')) manifestReads++;
        return readFile(file, ...args);
    };
    let prepared;
    try { prepared = await prepareLaunch({ ...options, electronPath }); }
    finally { fs.readFile = readFile; }
    assert.equal(manifestReads, 1);
    assert.equal(prepared.backend.file, electronPath);
    assert.equal(prepared.installation.needsInstall, false);
    assert.ok(prepared.timings.verifiedFiles > SUPPORT_FILES.length);
    assert.ok(prepared.timings.totalMs >= prepared.timings.verificationMs);
    assert.deepEqual(await originals(options), before);
    const reusedService = await prepareLaunch(options);
    assert.equal(reusedService.backend, null);
    assert.deepEqual(reusedService.installation.changed, []);
});

test('launch preparation still rejects same-size tampering and cannot accept a caller-supplied verification result', async t => {
    const options = await fixture(t);
    await put(options.packageDirectory, 'backend/server.mjs', '[]');
    await assert.rejects(prepareLaunch({ ...options, electronPath: path.join(options.dataDirectory, 'launcher.exe'),
        verifiedPackage: { packageDirectory: options.packageDirectory } }), /SHA-256 mismatch/);
    assert.equal(await fs.stat(path.join(options.gameDirectory, 'winhttp.dll')).catch(() => null), null);
});

test('single-pass package enumeration rejects a nested directory junction', async t => {
    const options = await fixture(t);
    const outside = path.join(path.dirname(options.packageDirectory), 'outside-package');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(options.packageDirectory, 'backend/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(prepareLaunch(options), /Links and special files/);
    assert.deepEqual(await fs.readdir(outside), []);
});

test('cheap directory validation checks version and entry points; activation marker is strictly validated separately', async t => {
    const options = await fixture(t);
    assert.equal(validatePackageDirectory(options.packageDirectory), true);
    assert.equal(validatePackageDirectory(options.packageDirectory, { version: '0.6.11' }), true);
    assert.equal(validatePackageDirectory(options.packageDirectory, { version: '0.6.10' }), false);
    const marker = { game: 'caahr', version: '0.6.11', installedAt: new Date().toISOString() };
    await put(options.packageDirectory, '.tikmng-package.json', JSON.stringify(marker));
    assert.equal((await inspect(options)).needsInstall, true);
    for (const invalid of [{ ...marker, game: 'other' }, { ...marker, version: '0.6.10' },
        { ...marker, extra: true }, { ...marker, installedAt: 'yesterday' }]) {
        await put(options.packageDirectory, '.tikmng-package.json', JSON.stringify(invalid));
        await assert.rejects(inspect(options), /activation marker/);
    }
    await fs.rm(path.join(options.packageDirectory, '.tikmng-package.json'));
    for (const version of [11, '', '../0.6.11', '0.6', '0.6.11/path', '0.06.11']) {
        await manifest(options.packageDirectory, value => ({ ...value, version }));
        assert.equal(validatePackageDirectory(options.packageDirectory), false);
        await assert.rejects(inspect(options), /Invalid voice driving support manifest/);
    }
});

test('package policy excludes game binaries, Electron, keys and user data', () => {
    for (const relative of ['backend/CAAAHR.exe', 'backend/lib/Assembly-CSharp.dll', 'backend/lib/Assembly-CSharp-firstpass.dll',
        'backend/lib/UnityEngine.CoreModule.dll', 'backend/CAAAHR_Data/Managed/Fusion.Runtime.dll',
        'backend/node_modules/electron/package.json', 'backend/euler-api-key.txt', 'backend/.env', 'backend/token', 'backend/settings.json',
        'catalog/logs/session.json', 'support/BepInEx/plugins/unrelated.dll']) assert.throws(() => allowedPackagePath(relative));
    assert.equal(allowedPackagePath('backend/node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node'), 'backend/node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node');
});

test('backend honors package catalog and external data environment variables', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-package-backend-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
    const appRoot = path.resolve(__dirname, '../../apps/caaahr-voice');
    const { standardRules } = await import(pathToFileURL(path.join(appRoot, 'lib/settings.mjs')).href);
    const catalogRoot = path.join(root, 'catalog'), dataRoot = path.join(root, 'external data');
    const gifts = standardRules().map(rule => ({ id: rule.giftId, name: rule.id, coins: 1, file: rule.giftId + '.png' }));
    await put(catalogRoot, '.gift-catalog.json', JSON.stringify(gifts));
    for (const gift of gifts) await put(catalogRoot, 'public/assets/gift-images/' + gift.id + '.png', 'PNG fixture');
    const previous = { data: process.env.TIKMNG_CAAHR_DATA_DIR, catalog: process.env.TIKMNG_CAAHR_CATALOG_ROOT };
    process.env.TIKMNG_CAAHR_DATA_DIR = dataRoot; process.env.TIKMNG_CAAHR_CATALOG_ROOT = catalogRoot;
    const { createServer } = await import(pathToFileURL(path.join(appRoot, 'server.mjs')).href);
    let app;
    try {
        app = await createServer({ createConnection: () => assert.fail('No live connection during package test') });
        assert.equal(app.settings.file, path.join(dataRoot, 'settings.json')); assert.equal(app.catalog.root, catalogRoot);
        assert.equal(app.catalog.gifts.length, 13); const address = await app.listen(0);
        const vendor = await fetch('http://127.0.0.1:' + address.port + '/vendor/lucide.js');
        assert.equal(vendor.status, 200); await vendor.arrayBuffer();
        const source = await fs.readFile(path.join(appRoot, 'server.mjs'), 'utf8');
        assert.doesNotMatch(source, /euler-api-key\.txt|loadEulerKey/);
    } finally {
        if (app) await app.close();
        for (const [name, value] of [['TIKMNG_CAAHR_DATA_DIR', previous.data], ['TIKMNG_CAAHR_CATALOG_ROOT', previous.catalog]]) {
            if (value === undefined) delete process.env[name]; else process.env[name] = value;
        }
    }
});
