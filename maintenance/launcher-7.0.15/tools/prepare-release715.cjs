'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const version = '7.0.15';
const source = path.resolve(__dirname, '..');
const stage = path.resolve('D:/TikMnG-Release-7.0.15-build');
const output = path.resolve('D:/TikMnG-Release-7.0.15-ready');
const descriptorFile = 'D:/TikMnG-Yaratik-Arena-0.1.20-final2/package-descriptor.json';
const expectedArena = { version: '0.1.20', bytes: 151499890,
    sha256: '3761d94d81a4c69591d3e0520d1dee101526cc0bc26e2a8be9c776728fe14434' };
const marker = path.join(output, 'build-source.json');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => crypto.createHash(algorithm).update(bytes).digest(encoding);

async function hashFile(file, algorithm = 'sha256', encoding = 'hex') {
    const digest = crypto.createHash(algorithm);
    for await (const bytes of fs.createReadStream(file)) digest.update(bytes);
    return digest.digest(encoding);
}

function assertOwned(directory) {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved).toLowerCase(), path.resolve('D:/').toLowerCase());
    assert.ok(['TikMnG-Release-7.0.15-build', 'TikMnG-Release-7.0.15-ready'].includes(path.basename(resolved)));
    assert.equal(fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink(), false, 'Release root cannot be a link');
}

function filesUnder(directory, prefix = '') {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const relative = prefix + entry.name;
        if (relative === 'portrait-engine' || relative.startsWith('portrait-engine/')) return [];
        assert.equal(entry.isSymbolicLink(), false, 'Unexpected release source link: ' + relative);
        if (entry.isDirectory()) return filesUnder(path.join(directory, entry.name), relative + '/');
        assert.ok(entry.isFile(), relative);
        return [relative];
    });
}

function sourceSnapshot() {
    const files = ['main.js', 'preload.js', 'license-server.txt', 'package.json', 'package-lock.json', 'RELEASE-NOTES-7.0.15.md'];
    for (const directory of ['lib', 'renderer', 'build']) files.push(...filesUnder(path.join(source, directory)).map(file => directory + '/' + file));
    return Object.fromEntries(files.sort().map(file => [file, hash(fs.readFileSync(path.join(source, file)))]));
}

function assertFresh(prepared) {
    assert.deepEqual(sourceSnapshot(), prepared.sourceFiles, 'Source changed since staging; prepare and build again');
}

async function prepare() {
    for (const directory of [stage, output]) assertOwned(directory);
    assert.equal(fs.existsSync(path.join(output, 'manifest-7.0.15.json')), false, 'Do not overwrite a finalized release');
    const pkg = readJSON(path.join(source, 'package.json'));
    assert.equal(pkg.version, version);
    assert.equal(pkg.build.appId, 'com.mng.tiktokgame');
    assert.equal(pkg.build.productName, 'TikMnG');
    assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
    assert.deepEqual(pkg.build.publish, [{ provider: 'github', owner: 'maNgao7', repo: 'mng-license-server1' }]);
    const arena = readJSON(descriptorFile);
    for (const [key, value] of Object.entries(expectedArena)) assert.equal(arena[key], value, 'Arena descriptor ' + key);
    assert.equal(arena.originalDemoIncluded, false);
    assert.equal(fs.statSync(arena.file).size, arena.bytes);
    assert.equal(await hashFile(arena.file), arena.sha256);
    const catalog = readJSON(path.join(source, 'lib/catalog-defaults.json'));
    const published = readJSON(path.join(source, 'lib/published-games.json'));
    const game = catalog.games.find(item => item.id === 'yaratik-arena');
    for (const key of ['version', 'bytes', 'sha256', 'url']) assert.equal(game?.[key], arena[key], 'Arena catalog ' + key);
    assert.equal(new URL(arena.url).protocol, 'https:');
    assert.ok(published.games.some(item => item.id === 'yaratik-arena' && !item.adminOnly && !item.definition?.adminOnly));
    assert.deepEqual(published.games.filter(item => item.announcementId).map(item => item.id), ['yaratik-arena']);
    const before = sourceSnapshot();
    if (fs.existsSync(stage) && fs.readdirSync(stage).length) {
        assert.ok(fs.existsSync(marker), 'Existing stage has no ownership marker');
        const previous = readJSON(marker);
        assert.equal(previous.source, source);
        assert.equal(previous.stage, stage);
        assert.equal(previous.version, version);
        assertOwned(stage);
        fs.rmSync(stage, { recursive: true, force: true });
    }
    fs.mkdirSync(stage, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    for (const file of ['main.js', 'preload.js', 'license-server.txt']) fs.copyFileSync(path.join(source, file), path.join(stage, file));
    for (const directory of ['lib', 'renderer', 'build']) fs.cpSync(path.join(source, directory), path.join(stage, directory), {
        recursive: true, filter: file => !path.relative(path.join(source, directory), file).split(path.sep).includes('portrait-engine')
    });
    // Published games remain in their own manifest; local administrator packages are not distributable.
    writeJSON(path.join(stage, 'lib/admin-games.json'), { schemaVersion: 1, games: [] });
    pkg.build.directories.output = output;
    pkg.build.releaseInfo = { releaseNotes: fs.readFileSync(path.join(source, 'RELEASE-NOTES-7.0.15.md'), 'utf8') };
    pkg.build.files = [...new Set([...pkg.build.files, '!lib/portrait-engine/**/*', '!node_modules/onnxruntime-node/**/*'])];
    writeJSON(path.join(stage, 'package.json'), pkg);
    const lock = readJSON(path.join(source, 'package-lock.json'));
    lock.version = version;
    lock.packages[''].version = version;
    writeJSON(path.join(stage, 'package-lock.json'), lock);
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(stage, 'node_modules'), 'junction');
    assert.deepEqual(sourceSnapshot(), before, 'Source changed while staging; rerun preparation');
    for (const [file, digest] of Object.entries(before)) {
        if (['package.json', 'package-lock.json', 'lib/admin-games.json', 'RELEASE-NOTES-7.0.15.md'].includes(file)) continue;
        assert.equal(hash(fs.readFileSync(path.join(stage, file))), digest, 'Stage mismatch: ' + file);
    }
    const prepared = { version, source, stage, output, createdAt: new Date().toISOString(), published: false,
        productionAppId: pkg.build.appId, signedPublisher: false, currentUserCustomSettingsNotChanged: true,
        administratorPackagesStripped: true, publishedGameRetained: 'yaratik-arena', arena, sourceFiles: before };
    writeJSON(marker, prepared);
    console.log(JSON.stringify({ version, stage, output, published: false, administratorPackagesStripped: true, arena: expectedArena }));
    return prepared;
}

async function build(prepared) {
    assertFresh(prepared);
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(source, 'node_modules/electron-builder/cli.js'), '--win', '--x64', '--publish', 'never'], {
            cwd: stage, windowsHide: true, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false',
                ELECTRON_BUILDER_CACHE: path.join(output, '.builder-cache') }
        });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error('electron-builder exited ' + code)));
    });
    assertFresh(prepared);
}

async function finalize() {
    assertOwned(output);
    assert.equal(fs.existsSync(path.join(output, 'manifest-7.0.15.json')), false, 'Do not overwrite a finalized release');
    const prepared = readJSON(marker);
    assert.equal(prepared.source, source);
    assert.equal(prepared.stage, stage);
    assertFresh(prepared);
    const nativeFile = process.env.MNG_ARENA715_QA_REPORT || 'D:/TikMnG-Arena715-Final2QA/arena-package-result.json';
    const native = fs.existsSync(nativeFile) ? readJSON(nativeFile) : null;
    assert.equal(native?.passed, true, 'Main native Final2QA must pass before finalization');
    assert.equal(native.nativePassed, true, 'The full native regression suite is required, not a live-only run');
    assert.equal(native.livePassed, true, 'Main live acceptance must also pass');
    for (const [key, value] of Object.entries(expectedArena)) assert.equal(prepared.arena[key], value, 'Staged Arena ' + key);
    const text = fs.readFileSync(path.join(source, 'qa-715-full.log'), 'utf8');
    const count = name => Number(new RegExp('(?:^|\\n)[^\\n]*\\b' + name + ' (\\d+)\\s*(?:\\n|$)').exec(text)?.[1]);
    const launcherTests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(name => [name, count(name)]));
    assert.ok(launcherTests.pass >= 1174, 'Full launcher suite result missing');
    for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(launcherTests[key], 0, key);
    const packaged = readJSON(path.join(source, 'qa/715/packaged-result.json'));
    assert.equal(packaged.passed, true);
    assert.equal(path.resolve(packaged.executablePath), path.join(output, 'win-unpacked/TikMnG.exe'));
    for (const key of ['realPackagedIPC', 'steamDetail', 'demoStatusRefresh', 'newGameOnlyAnnouncement', 'guidePNGVerified', 'settingsSurviveRestart', 'isolatedProfile']) assert.equal(packaged[key], true, key);
    const asar = require('@electron/asar');
    const archive = path.join(output, 'win-unpacked/resources/app.asar');
    const packageDigest = await hashFile(archive);
    assert.equal(packaged.appAsarSha256, packageDigest, 'Smoke test was run against a different build');
    assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, version);
    assert.deepEqual(JSON.parse(asar.extractFile(archive, 'lib/admin-games.json')).games, []);
    for (const file of Object.keys(prepared.sourceFiles)) {
        if (['package.json', 'package-lock.json', 'lib/admin-games.json', 'RELEASE-NOTES-7.0.15.md'].includes(file)) continue;
        const stageFile = path.join(stage, file);
        if (!file.startsWith('build/') && !readJSON(path.join(stage, 'package.json')).build.files.some(pattern => pattern.startsWith('!') && file === pattern.slice(1))) {
            assert.equal(hash(asar.extractFile(archive, path.normalize(file))), hash(fs.readFileSync(stageFile)), 'Packaged file mismatch: ' + file);
        }
    }
    const files = [];
    for (const [from, name] of [
        ['TikMnG Setup 7.0.15.exe', 'TikMnG-Setup-7.0.15.exe'],
        ['TikMnG Setup 7.0.15.exe.blockmap', 'TikMnG-Setup-7.0.15.exe.blockmap'],
        ['TikMnG 7.0.15.exe', 'TikMnG-7.0.15-Portable.exe']
    ]) {
        const target = path.join(output, name);
        fs.copyFileSync(path.join(output, from), target);
        files.push({ name, bytes: fs.statSync(target).size, sha256: await hashFile(target), sha512: await hashFile(target, 'sha512', 'base64') });
    }
    const yaml = require('js-yaml');
    const feedFile = path.join(output, 'latest.yml');
    const feed = yaml.load(fs.readFileSync(feedFile, 'utf8'));
    assert.equal(feed.version, version);
    assert.equal(feed.sha512, files[0].sha512);
    assert.equal(feed.files[0].size, files[0].bytes);
    feed.path = files[0].name;
    feed.files[0].url = files[0].name;
    fs.writeFileSync(feedFile, yaml.dump(feed, { lineWidth: -1 }));
    const report = { passed: true, version, createdAt: new Date().toISOString(), launcherTests, packaged,
        arena: prepared.arena, appAsarSha256: packageDigest, nativeArenaReport: nativeFile,
        nativeArenaPassed: native?.passed === true, nativeArenaVerificationOwnedByMain: true,
        published: false, renderChanged: false, signedPublisher: false, currentUserCustomSettingsNotChanged: true,
        realPaidGiftTest: false, otherCustomerHardwareTest: false,
        remainingBlockers: ['GitHub publication and Render deployment are outside this sidecar.'] };
    writeJSON(path.join(output, 'KONTROL-RAPORU.json'), report);
    fs.copyFileSync(path.join(source, 'RELEASE-NOTES-7.0.15.md'), path.join(output, 'RELEASE-NOTES-7.0.15.md'));
    writeJSON(path.join(output, 'manifest-7.0.15.json'), { version, createdAt: report.createdAt, files, published: false, signedPublisher: false });
    console.log(JSON.stringify({ passed: true, output, launcherTests, files, remainingBlockers: report.remainingBlockers }));
}

async function main() {
    const args = process.argv.slice(2);
    assert.ok(args.every(arg => ['--build', '--finalize'].includes(arg)), 'Usage: node tools/prepare-release715.cjs [--build | --finalize]');
    assert.ok(!(args.includes('--build') && args.includes('--finalize')), 'Build and finalize are separate steps; run packaged QA between them');
    if (args.includes('--finalize')) return finalize();
    const prepared = await prepare();
    if (args.includes('--build')) await build(prepared);
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
