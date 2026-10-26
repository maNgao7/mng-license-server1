'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const archiver = require('archiver');
const { extractGameArchive } = require('../lib/archive.cjs');
const { assertSafePath, hashFile } = require('../lib/download.cjs');
const { BEPINEX, RUNTIME_FILES, SUPPORT_FILES, PACKAGE_TYPE, packageFiles, allowedPackagePath, verifyPackage } = require('../lib/voice-driving-package.cjs');

const DLL_SHA256 = '84071ccd365e66c93fe78490baeb6f49efc2a6821dd17101d9dac76b426b3def';
const LICENSES = [
    ['BepInEx', 'https://raw.githubusercontent.com/BepInEx/BepInEx/57f1fb859bd4d0264cd2a59074d0e96c6a492a33/LICENSE', 'https://github.com/BepInEx/BepInEx/tree/57f1fb859bd4d0264cd2a59074d0e96c6a492a33'],
    ['BepInEx.Harmony', 'https://raw.githubusercontent.com/BepInEx/BepInEx.Harmony/d4cdcb4cdeac14a0b77012165f5f5a9f5032a9fa/LICENSE', 'https://github.com/BepInEx/BepInEx.Harmony/tree/d4cdcb4cdeac14a0b77012165f5f5a9f5032a9fa'],
    ['HarmonyX-2.9.0', 'https://raw.githubusercontent.com/BepInEx/HarmonyX/v2.9.0/LICENSE', 'https://github.com/BepInEx/HarmonyX/tree/v2.9.0'],
    ['Mono.Cecil-0.10.4', 'https://raw.githubusercontent.com/jbevain/cecil/0.10.4/LICENSE.txt', 'https://github.com/jbevain/cecil/tree/0.10.4'],
    ['MonoMod-22.1.29.1', 'https://raw.githubusercontent.com/MonoMod/MonoMod/v22.01.29.01/LICENSE', 'https://github.com/MonoMod/MonoMod/tree/v22.01.29.01'],
    ['UnityDoorstop-4.5.0', 'https://raw.githubusercontent.com/NeighTools/UnityDoorstop/v4.5.0/LICENSE', 'https://github.com/NeighTools/UnityDoorstop/tree/v4.5.0']
];

async function response(url) {
    const result = await fetch(url, { headers: { 'User-Agent': 'TikMnG-voice-driving-package-builder', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(45000) });
    if (!result.ok) throw new Error(`Official source unavailable (${result.status}): ${url}`);
    return result;
}

async function write(root, relative, bytes) {
    const file = assertSafePath(path.join(root, relative));
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, bytes, { flag: 'wx' });
}

async function copy(source, root, relative) {
    assertSafePath(source);
    await write(root, relative, await fsp.readFile(source));
}

async function verifiedDownload(url, file, algorithm, expected) {
    if (fs.existsSync(file)) {
        const bytes = await fsp.readFile(assertSafePath(file));
        if (crypto.createHash(algorithm).update(bytes).digest('hex') === expected) return;
        throw new Error(`Cached official archive digest mismatch: ${file}`);
    }
    const bytes = Buffer.from(await (await response(url)).arrayBuffer());
    if (crypto.createHash(algorithm).update(bytes).digest('hex') !== expected) throw new Error(`Official archive digest mismatch: ${url}`);
    await fsp.writeFile(assertSafePath(file), bytes, { flag: 'wx' });
}

async function runNpm(directory, npmCli) {
    const cli = npmCli || process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    assertSafePath(cli);
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, 'ci', '--omit=dev', '--include=optional', '--ignore-scripts', '--no-audit', '--no-fund'], {
            cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'production' }
        });
        let output = '';
        for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output = (output + bytes).slice(-8000); });
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Production npm ci failed (${code}): ${output}`)));
    });
}

async function zipPackage(directory, archivePath) {
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archivePath, { flags: 'wx' });
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.once('close', resolve); output.once('error', reject);
        archive.once('error', reject); archive.on('warning', reject);
        archive.pipe(output); archive.directory(directory, false); archive.finalize().catch(reject);
    });
}

async function build(options = {}) {
    const version=options.version||'0.6.12';
    if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid package version.');
    const source = assertSafePath(path.resolve(options.source || path.join(__dirname, '../../apps/caaahr-voice')));
    const catalogSource = assertSafePath(path.resolve(options.catalogSource || path.join(__dirname, '../../apps/tiktok-vs')));
    const output = assertSafePath(path.resolve(options.output || 'D:/TikMnG-Voice-Driving-Package/voice-driving-'+version));
    const parent = path.dirname(output), cache = assertSafePath(path.join(parent, 'cache'));
    for (const input of [source, catalogSource]) {
        if (output === input || output.startsWith(input + path.sep) || input.startsWith(output + path.sep)) throw new Error('Output must be outside source directories.');
    }
    if (fs.existsSync(output) || fs.existsSync(output + '.zip') || fs.existsSync(output + '.hash-report.json')) throw new Error('Output already exists; use a new package path.');
    const expectedPluginSha256 = options.expectedPluginSha256 || DLL_SHA256;
    const pluginFile = path.join(source, 'plugin/build/TikMnG.Caaahr.Voice.dll');
    if (await hashFile(pluginFile) !== expectedPluginSha256.toLowerCase()) throw new Error('Compiled plugin differs from the reviewed build.');
    await fsp.mkdir(cache, { recursive: true });
    const stage = assertSafePath(path.join(parent, '.voice-package-' + crypto.randomUUID()));
    await fsp.mkdir(stage);
    try {
        const releaseURL = 'https://api.github.com/repos/BepInEx/BepInEx/releases/tags/v' + BEPINEX.version;
        const release = await (await response(releaseURL)).json();
        const asset = release.assets.find(value => value.browser_download_url === BEPINEX.url);
        if (asset?.digest !== 'sha256:' + BEPINEX.sha256) throw new Error('Official GitHub release digest could not be verified.');
        const runtimeArchive = path.join(cache, 'BepInEx_win_x64_5.4.23.5.zip');
        await verifiedDownload(BEPINEX.url, runtimeArchive, 'sha256', BEPINEX.sha256);
        const runtimeStage = path.join(stage, 'runtime-extract');
        await extractGameArchive(runtimeArchive, runtimeStage);
        for (const relative of RUNTIME_FILES) await copy(path.join(runtimeStage, relative), stage, 'support/' + relative);
        await fsp.rm(runtimeStage, { recursive: true });
        await copy(pluginFile, stage, 'support/BepInEx/plugins/TikMnG.Caaahr.Voice.dll');

        const nugetURL = 'https://api.nuget.org/v3-flatcontainer/newtonsoft.json/13.0.3/newtonsoft.json.13.0.3.nupkg';
        const nugetRegistrationURL = 'https://api.nuget.org/v3/registration5-gz-semver2/newtonsoft.json/13.0.3.json';
        const registration = await (await response(nugetRegistrationURL)).json();
        if (!registration.catalogEntry?.startsWith('https://api.nuget.org/v3/catalog0/') || registration.packageContent !== nugetURL) throw new Error('Invalid official Newtonsoft registration.');
        const nugetMetadata = await (await response(registration.catalogEntry)).json();
        const sha512Text = nugetMetadata.packageHash;
        if (nugetMetadata.packageHashAlgorithm !== 'SHA512' || !/^[A-Za-z0-9+/]{86}==$/.test(sha512Text)) throw new Error('Official Newtonsoft package SHA-512 is missing.');
        const newtonsoftArchive = path.join(cache, 'newtonsoft.json.13.0.3.nupkg');
        await verifiedDownload(nugetURL, newtonsoftArchive, 'sha512', Buffer.from(sha512Text, 'base64').toString('hex'));
        const newtonsoftStage = path.join(stage, 'newtonsoft-extract');
        await extractGameArchive(newtonsoftArchive, newtonsoftStage);
        await copy(path.join(newtonsoftStage, 'lib/net45/Newtonsoft.Json.dll'), stage, 'support/BepInEx/plugins/Newtonsoft.Json.dll');
        await copy(path.join(newtonsoftStage, 'LICENSE.md'), stage, 'licenses/Newtonsoft.Json-13.0.3-LICENSE.md');
        await fsp.rm(newtonsoftStage, { recursive: true });

        for (const relative of ['server.mjs', 'package.json', 'package-lock.json',
            'public/index.html', 'public/app.js', 'public/style.css', 'public/assets/voice-driving-gifts.png']) {
            await copy(path.join(source, relative), stage, 'backend/' + relative);
        }
        for (const name of await fsp.readdir(path.join(source, 'lib'))) {
            if (name.endsWith('.mjs')) await copy(path.join(source, 'lib', name), stage, 'backend/lib/' + name);
        }
        await runNpm(path.join(stage, 'backend'), options.npmCli);
        // npm command shims are not needed: the launcher starts server.mjs directly.
        await fsp.rm(path.join(stage, 'backend/node_modules/.bin'), { recursive: true, force: true });
        await fsp.rm(path.join(stage, 'backend/node_modules/.package-lock.json'), { force: true });

        const { GiftCatalog } = await import(pathToFileURL(path.join(source, 'lib/catalog.mjs')).href);
        const catalog = await new GiftCatalog(catalogSource).load();
        if (catalog.gifts.length < 13 || catalog.gifts.some(gift => !gift.image)) throw new Error('Catalog gifts require local PNGs.');
        const rows = [];
        for (const gift of catalog.gifts) {
            if (!/^\d+$/.test(gift.id) || !gift.image.startsWith('/catalog-assets/')) throw new Error('Invalid catalog gift image.');
            const relative = decodeURIComponent(gift.image.slice('/catalog-assets/'.length));
            if (!/^gift-images\/\d+\.png$/.test(relative)) throw new Error('Gift image is not a catalog-owned PNG.');
            await copy(path.join(catalogSource, 'public/assets', relative), stage, 'catalog/public/assets/gift-images/' + gift.id + '.png');
            rows.push({ id: gift.id, name: gift.origName || gift.name, trName: gift.name, coins: gift.coins,
                image: '/catalog-assets/gift-images/' + gift.id + '.png', tiktokIds: gift.tiktokIds });
        }
        await write(stage, 'catalog/.gift-catalog.json', JSON.stringify(rows, null, 2) + '\n');

        const sources = [{ component: 'BepInEx runtime with Doorstop', ...BEPINEX, releaseAPI: releaseURL, releaseAssetId: asset.id,
            source: LICENSES[0][2], verified: 'Official GitHub release API digest and downloaded SHA-256 agree.' },
        { component: 'Newtonsoft.Json', version: '13.0.3', url: nugetURL, sha512: sha512Text,
            metadata: registration.catalogEntry, source: 'https://github.com/JamesNK/Newtonsoft.Json/tree/13.0.3', sha256: await hashFile(newtonsoftArchive) }];
        for (const [name, url, sourceURL] of LICENSES) {
            const text = await (await response(url)).text();
            if (text.length < 500 || /<html/i.test(text)) throw new Error(`Invalid official license: ${url}`);
            await write(stage, 'licenses/' + name + '-LICENSE.txt', text);
            sources.push({ component: name, licenseURL: url, source: sourceURL, licenseSha256: crypto.createHash('sha256').update(text).digest('hex') });
        }
        const pluginSources = [];
        for (const name of (await fsp.readdir(path.join(source, 'plugin'))).filter(name => name.endsWith('.cs')).sort()) {
            pluginSources.push({ path: 'plugin/' + name, sha256: await hashFile(path.join(source, 'plugin', name)) });
        }
        await write(stage, 'provenance/plugin-sources.json', JSON.stringify({ pluginSha256: expectedPluginSha256.toLowerCase(), sources: pluginSources }, null, 2) + '\n');
        const lock = JSON.parse(await fsp.readFile(path.join(stage, 'backend/package-lock.json'), 'utf8'));
        const npmSources = Object.entries(lock.packages).filter(([name]) => name && fs.existsSync(path.join(stage, 'backend', name, 'package.json')))
            .map(([name, value]) => ({ path: name, version: value.version, resolved: value.resolved, integrity: value.integrity, license: value.license }));
        await write(stage, 'provenance/npm-packages.json', JSON.stringify(npmSources, null, 2) + '\n');
        await write(stage, 'provenance/sources.json', JSON.stringify(sources, null, 2) + '\n');
        await write(stage, 'PACKAGE-README.txt', 'TikMnG CAAAHR voice driving support package 0.6.11\n\nRequires the original Steam CAAAHR! Demo for Windows x64, installed separately.\nContains no base game files or Unity engine executables.\nInstall with launcher/lib/voice-driving-package.cjs installMod().\nThe launcher owns the backend child and runs its bundled Electron in Node mode.\nTIKMNG_CAAHR_CATALOG_ROOT selects catalog/; TIKMNG_CAAHR_DATA_DIR selects external mutable data.\nOptional signing key: EULER_API_KEY environment variable. No private key file is read.\nBootstrap contains only the selected external data directory. No global Node.js is required.\nThird-party licenses accompany this package and npm dependency directories.\nOfficial runtime archives, source references and hashes are recorded under provenance/.\n');
        const files = [];
        for (const relative of await packageFiles(stage)) {
            allowedPackagePath(relative);
            const file = path.join(stage, relative);
            files.push({ path: relative, bytes: (await fsp.stat(file)).size, sha256: await hashFile(file) });
        }
        const manifest = { schemaVersion: 1, type: PACKAGE_TYPE, version, platform: 'win32-x64',
            runtime: { ...BEPINEX }, pluginSha256: expectedPluginSha256.toLowerCase(), catalogCount: rows.length,
            installFiles: SUPPORT_FILES, files };
        await write(stage, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
        const verified = await verifyPackage({ packageDirectory: stage });
        await zipPackage(stage, output + '.zip');
        await fsp.rename(stage, output);
        const report = { directory: output, archive: output + '.zip', archiveBytes: (await fsp.stat(output + '.zip')).size,
            archiveSha256: await hashFile(output + '.zip'), manifestSha256: verified.manifestSha256,
            pluginSha256: manifest.pluginSha256, runtimeArchiveSha256: BEPINEX.sha256, files: files.length,
            supportFiles: SUPPORT_FILES.length, catalogPngs: rows.length, payloadBytes: files.reduce((sum, file) => sum + file.bytes, 0),
            excludes: ['base game', 'Unity executables/assemblies', 'Electron', 'private signing keys', 'user settings/saves/tokens'], published: false };
        await fsp.writeFile(output + '.hash-report.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
        return report;
    } finally {
        if (stage.startsWith(parent + path.sep + '.voice-package-')) await fsp.rm(stage, { recursive: true, force: true });
    }
}

if (require.main === module) {
    const args = process.argv.slice(2), options = {};
    for (let index = 0; index < args.length; index += 2) {
        const key = { '--output': 'output', '--source': 'source', '--catalog-source': 'catalogSource', '--plugin-sha256': 'expectedPluginSha256', '--version':'version' }[args[index]];
        if (!key || !args[index + 1]) throw new Error('Usage: node tools/build-voice-driving-package.cjs [--output <absolute-directory>] [--plugin-sha256 <reviewed-sha256>]');
        options[key] = args[index + 1];
    }
    build(options).then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { build, zipPackage, DLL_SHA256 };
