'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { assertSafeTree, safeRelativePath, hashFile } = require('../lib/download.cjs');
const { parseContentPackage, CONTENT_PATH } = require('../lib/game-content.cjs');
const { componentAssetURL } = require('./component-publication.cjs');

function zipper() {
    return require(require.resolve('archiver', { paths: [process.env.MNG_BUILD_DEPENDENCIES ||
        'C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules'] }));
}

async function zipFiles(files, destination) {
    const archive = zipper()('zip', { zlib: { level: 9 }, forceLocalTime: false });
    const output = fs.createWriteStream(destination, { flags: 'wx' });
    const done = pipeline(archive, output);
    for (const file of files) {
        const options = { name: file.path, date: new Date('2020-01-01T00:00:00Z'), mode: 0o644 };
        if (file.data) archive.append(file.data, options);
        else archive.file(file.source, options);
    }
    await archive.finalize();
    await done;
}

async function prepare({ source, output, packageId, version, publicBase, overrides = {}, worldTemplates = [] }) {
    source = path.resolve(source); output = path.resolve(output);
    if (output === source || output.startsWith(source + path.sep)) throw new Error('Output must be outside source');
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(packageId) || !/^[0-9A-Za-z._+-]+$/.test(version)) throw new Error('Invalid package/version');
    const origin = new URL(publicBase.endsWith('/') ? publicBase : publicBase + '/');
    if (origin.protocol !== 'https:') throw new Error('Publication base must be HTTPS');
    await assertSafeTree(source);
    fs.mkdirSync(output, { recursive: true });
    const assets = path.join(output, 'assets'); fs.mkdirSync(assets, { recursive: true });
    const runtime = [], game = [];
    async function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
            const file = path.join(directory, entry.name);
            const relative = safeRelativePath(path.relative(source, file).split(path.sep).join('/'));
            if (['logs', 'crash-reports', 'screenshots', '.git', '.native-cache'].includes(entry.name)) continue;
            if (relative === 'runtime/assets/skins') continue;
            if (entry.name === 'saves' && !(relative === 'game-instance/saves' && worldTemplates.length)) continue;
            if (relative.startsWith('game-instance/saves/') && relative.split('/').length === 3 && !worldTemplates.includes(entry.name)) continue;
            if (entry.isDirectory()) { await visit(file); continue; }
            if (['.tikmng-package.json', '.tikmng-content.json', '.tikmng-runtime.json', 'game-ready.flag'].includes(relative) ||
                /^runtime\/natives\/jna\d+\.dll(?:\.x)?$/i.test(relative) ||
                /(?:^|\/)(?:launch\.log|bridge\.log|bridge-error\.log|launch-args\.txt)$/.test(relative)) continue;
            const selected = overrides[relative] ? path.resolve(overrides[relative]) : file;
            let data;
            if (relative === 'launch-game.cjs') {
                const original = fs.readFileSync(selected, 'utf8');
                const old = "const runtime = path.join(root, 'runtime');";
                if (!original.includes(old) && !original.includes("const runtime = require('./runtime-location.cjs').runtimeDirectory(root);")) throw new Error('Unrecognized game launch script; manual review required');
                let changed = original.replace(old, "const runtime = require('./runtime-location.cjs').runtimeDirectory(root);");
                if (packageId === 'zombie-war' && !changed.includes("process.argv.includes('--check')")) {
                    const main = 'async function main() {';
                    if (!changed.includes(main)) throw new Error('Zombie launch entry point missing');
                    changed = changed.replace(main, main + "\n  if (process.argv.includes('--check')) { const args = launchArguments(0); console.log(JSON.stringify({ok:true,arguments:args.length})); return; }\n");
                }
                const marker = changed.search(/^if\s*\(\s*require\.main\s*===\s*module\)/m);
                if (marker < 0) throw new Error('Launch entry point missing');
                const cacheRoot = packageId === 'minecraft-snake-arena' ? 'instance' : 'game';
                changed = changed.slice(0, marker) + "const unsharedLaunchArguments = launchArguments;\nlaunchArguments = (...args) => require('./runtime-location.cjs').isolatedNativeArguments(unsharedLaunchArguments(...args), " + cacheRoot + ");\n" + changed.slice(marker);
                data = Buffer.from(changed);
            }
            const record = { path: relative.startsWith('runtime/') ? relative.slice(8) : relative,
                source: selected, ...(data ? { data } : {}),
                sha256: data ? crypto.createHash('sha256').update(data).digest('hex') : await hashFile(selected),
                bytes: data ? data.length : fs.statSync(selected).size };
            (relative.startsWith('runtime/') ? runtime : game).push(record);
        }
    }
    await visit(source);
    const resolver = path.resolve(__dirname, '../lib/runtime-location.cjs');
    game.push({ path: 'runtime-location.cjs', source: resolver, sha256: await hashFile(resolver), bytes: fs.statSync(resolver).size });
    for (const collection of [runtime, game]) collection.sort((a, b) => a.path.localeCompare(b.path, 'en'));
    async function archive(collection) {
        const inventory = JSON.stringify(collection.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })));
        const identity = crypto.createHash('sha256').update(inventory).digest('hex');
        const receipt = path.join(output, identity + '.archive.json');
        if (!fs.existsSync(receipt)) {
            for (const name of fs.readdirSync(output).filter(name => name.endsWith('-manifest.json'))) {
                const old = JSON.parse(fs.readFileSync(path.join(output, name), 'utf8'));
                const previousFiles = collection === runtime ? old.runtime?.files : old.files;
                const previous = collection === runtime ? old.runtime?.archive : old.payloadArchive;
                if (!previous || !Array.isArray(previousFiles)) continue;
                const previousInventory = JSON.stringify(previousFiles.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })));
                const target = path.join(assets, previous.sha256 + '.zip');
                if (previousInventory === inventory && fs.existsSync(target) && await hashFile(target) === previous.sha256) {
                    fs.writeFileSync(receipt, JSON.stringify(previous)); break;
                }
            }
        }
        if (fs.existsSync(receipt)) {
            const saved = JSON.parse(fs.readFileSync(receipt, 'utf8'));
            const target = path.join(assets, saved.sha256 + '.zip');
            if (/^[a-f0-9]{64}$/.test(saved.sha256 || '') && fs.existsSync(target) &&
                fs.statSync(target).size === saved.bytes && await hashFile(target) === saved.sha256) {
                return { ...saved, url: componentAssetURL(origin.href, saved.sha256 + '.zip') };
            }
        }
        const intermediate = path.join(output, identity + '.zip');
        if (!fs.existsSync(intermediate)) await zipFiles(collection, intermediate);
        const sha256 = await hashFile(intermediate), bytes = fs.statSync(intermediate).size;
        const target = path.join(assets, sha256 + '.zip');
        if (!fs.existsSync(target)) fs.renameSync(intermediate, target);
        else fs.unlinkSync(intermediate);
        const descriptor = { sha256, bytes, url: componentAssetURL(origin.href, sha256 + '.zip') };
        fs.writeFileSync(receipt, JSON.stringify(descriptor));
        return descriptor;
    }
    const runtimeArchive = await archive(runtime), payloadArchive = await archive(game);
    const files = [];
    for (const file of game) {
        const target = path.join(assets, file.sha256 + '.bin');
        if (!fs.existsSync(target)) {
            if (file.data) fs.writeFileSync(target, file.data);
            else fs.copyFileSync(file.source, target);
        }
        files.push({ path: file.path, sha256: file.sha256, bytes: file.bytes,
            url: componentAssetURL(origin.href, file.sha256 + '.bin') });
    }
    const manifest = { schemaVersion: 2, type: 'tikmng-game-content', package: packageId, version, files,
        runtime: { archive: runtimeArchive, files: runtime.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) }, payloadArchive };
    parseContentPackage(manifest, { packageId, version });
    const data = Buffer.from(JSON.stringify(manifest)), sha256 = crypto.createHash('sha256').update(data).digest('hex');
    fs.writeFileSync(path.join(assets, sha256 + '.json'), data);
    const descriptor = { path: CONTENT_PATH, sha256, bytes: data.length, url: componentAssetURL(origin.href, sha256 + '.json') };
    const report = { packageId, version, source, minimumLauncher: '7.0.9', descriptor, runtimeArchive, payloadArchive,
        runtimeUnpackedBytes: runtime.reduce((sum, file) => sum + file.bytes, 0),
        gameUnpackedBytes: game.reduce((sum, file) => sum + file.bytes, 0),
        firstInstallBytes: runtimeArchive.bytes + payloadArchive.bytes, subsequentGameBytes: payloadArchive.bytes };
    fs.writeFileSync(path.join(output, packageId + '-manifest.json'), data);
    fs.writeFileSync(path.join(output, packageId + '-summary.json'), JSON.stringify(report, null, 2));
    return report;
}
if (require.main === module) {
    const [source, output, packageId, version, publicBase, overrides] = process.argv.slice(2);
    prepare({ source, output, packageId, version, publicBase, overrides: overrides ? JSON.parse(fs.readFileSync(overrides, 'utf8')) : {} })
        .then(report => console.log(JSON.stringify(report))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { prepare, zipFiles };
