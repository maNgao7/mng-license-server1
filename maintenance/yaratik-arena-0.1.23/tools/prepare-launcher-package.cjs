'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const launcher = process.argv[2];
const steam = process.argv[3];
const destination = process.argv[4];
const resume = process.argv[5] === '--resume';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function files(directory, prefix = '') {
    const result = [];
    for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('Links cannot enter an Arena release.');
        const name = prefix + entry.name;
        if (entry.isDirectory()) result.push(...await files(path.join(directory, entry.name), name + '/'));
        else if (entry.isFile()) result.push(name);
    }
    return result.sort();
}

async function copy(source, target) {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(source, target, fs.constants.COPYFILE_EXCL);
}

async function main() {
    for (const value of [launcher, steam, destination]) if (!value || !path.isAbsolute(value)) throw new Error('Launcher, Steam demo and destination absolute paths are required.');
    if (fs.existsSync(destination) && !resume) throw new Error('Package destination already exists. Use a new empty release path.');
    if (fs.existsSync(path.join(destination, 'yaratik-arena.zip'))) throw new Error('A completed release archive cannot be overwritten. Use a new release directory.');
    const localRequire = createRequire(path.join(launcher, 'package.json'));
    const extract = localRequire('extract-zip');
    const vdf = localRequire('./lib/vendor/steam-vdf/lib/index.js');
    const support = localRequire('./lib/arena-package.cjs');
    const { hashFile } = localRequire('./lib/download.cjs');
    const assetManifest = JSON.parse(await fsp.readFile(path.join(root, 'assets/publishing/manifest.json'), 'utf8'));
    const steamManifest = vdf.parse(await fsp.readFile(path.join(steam, '../../appmanifest_5364590.acf'), 'utf8')).AppState;
    if (String(steamManifest.appid) !== support.APP_ID || !(Number(steamManifest.StateFlags) & 4)) throw new Error('The actual installed Steam demo is required.');
    const stage = path.join(destination, 'package');
    await fsp.mkdir(stage, { recursive: true });
    if (!resume) {
    for (const directory of ['assets', 'defaults', 'catalog', 'bridge']) {
        for (const relative of await files(path.join(root, directory))) {
            if (directory === 'bridge' && ['probe.cjs', 'README.md'].includes(relative)) continue;
            if (directory === 'assets' && /\.(?:ps1|cjs|md)$/.test(relative)) continue;
            if (/\.(?:log|pdb)$/.test(relative)) continue;
            support.allowedFile(directory + '/' + relative);
            await copy(path.join(root, directory, relative), path.join(stage, directory, relative));
        }
    }
    await copy(path.join(root, 'bootstrap/TikMnG.Arena.Startup.exe'), path.join(stage, 'bootstrap/TikMnG.Arena.Startup.exe'));
    await extract(path.join(root, 'downloads/dotnet-runtime-6.0.36-win-x64.zip'), { dir: path.join(stage, 'runtime') });
    await extract(path.join(root, 'downloads/MelonLoader.x64.zip'), { dir: path.join(stage, 'support') });
    for (const [source, target] of [['src/bin/Release/net6.0/TikMnG.CanEmAll.dll', 'support/Mods/TikMnG.CanEmAll.dll'],
        ['game/UserLibs/StbImageSharp.dll', 'support/UserLibs/StbImageSharp.dll']]) await copy(path.join(root, source), path.join(stage, target));
    const license = await fetch('https://raw.githubusercontent.com/LavaGang/MelonLoader/v0.7.3/LICENSE.md');
    if (!license.ok) throw new Error('MelonLoader license download failed.');
    await fsp.mkdir(path.join(stage, 'licenses'), { recursive: true });
    await fsp.writeFile(path.join(stage, 'licenses/MelonLoader-0.7.3.txt'), await license.text());
    await copy(path.join(root, 'packages/stbimagesharp/2.30.15/stbimagesharp.nuspec'), path.join(stage, 'licenses/StbImageSharp.nuspec'));
    const provenance = { loader: { version: '0.7.3', url: 'https://github.com/LavaGang/MelonLoader/releases/tag/v0.7.3',
        sha256: hash(await fsp.readFile(path.join(root, 'downloads/MelonLoader.x64.zip'))) },
        runtime: { version: '6.0.36', sha256: hash(await fsp.readFile(path.join(root, 'downloads/dotnet-runtime-6.0.36-win-x64.zip'))) },
        originalDemoIncluded: false, privateAccountsIncluded: false };
    await fsp.mkdir(path.join(stage, 'provenance'), { recursive: true });
    await fsp.writeFile(path.join(stage, 'provenance/sources.json'), JSON.stringify(provenance, null, 2));
    }
    const descriptors = [];
    for (const relative of await files(stage)) {
        support.allowedFile(relative);
        const file = path.join(stage, relative);
        descriptors.push({ path: relative, bytes: (await fsp.stat(file)).size, sha256: await hashFile(file) });
    }
    const baseFiles = [];
    for (const relative of await files(steam)) {
        if (!([support.EXECUTABLE, 'baselib.dll', 'GameAssembly.dll', 'UnityCrashHandler64.exe', 'UnityPlayer.dll'].includes(relative)
            || relative.startsWith("Can 'Em All Demo_Data/") || relative.startsWith('D3D12/'))) continue;
        const file = path.join(steam, relative);
        baseFiles.push({ path: relative, bytes: (await fsp.stat(file)).size, sha256: await hashFile(file) });
    }
    const manifest = { schemaVersion: 1, type: support.TYPE, platform: 'win32-x64', version: assetManifest.prototypeVersion,
        steam: { appId: support.APP_ID, buildId: String(steamManifest.buildid), storeUrl: support.STORE_URL },
        files: descriptors, baseFiles };
    await fsp.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await support.verifyPackage(stage);
    const archive = path.join(destination, 'yaratik-arena.zip');
    execFileSync('tar.exe', ['-a', '-c', '-f', archive, '-C', stage, ...await fsp.readdir(stage)], { timeout: 180000, windowsHide: true });
    const result = { version: manifest.version, file: archive, bytes: (await fsp.stat(archive)).size, sha256: await hashFile(archive),
        manifestSha256: hash(await fsp.readFile(path.join(stage, 'manifest.json'))), files: descriptors.length,
        steamBuildId: manifest.steam.buildId, steamBaseBytes: baseFiles.reduce((n, file) => n + file.bytes, 0), originalDemoIncluded: false,
        url: 'https://github.com/maNgao7/mng-license-server1/releases/download/yaratik-arena-' + manifest.version + '/yaratik-arena.zip' };
    await fsp.writeFile(path.join(destination, 'package-descriptor.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
