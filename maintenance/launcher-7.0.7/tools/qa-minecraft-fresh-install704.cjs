'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { verifyArchive } = require('./verify-game-archives.cjs');
const output = 'D:/TikMnG-Minecraft-Kurulum-Duzeltmesi-7.0.4';
const assets = path.join(output, 'assets');
const catalog = JSON.parse(fs.readFileSync(path.join(output, 'catalog-candidate.json')));
const ids = ['snow-war', 'battle-royale'];
const usePublic = process.argv.includes('--public');
const incremental = process.argv.includes('--incremental');
async function digest(file) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
}

async function main() {
    const root = fs.mkdtempSync(path.join(output, (usePublic ? 'public-' : 'local-') + (incremental ? 'upgrade-' : 'fresh-')));
    const sources = {};
    if (incremental) {
        const previous = JSON.parse(fs.readFileSync('D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3/public-game-install-verification.json'));
        for (const id of ids) {
            const base = path.join(previous.isolatedInstallRoot, '.game-library', id);
            const pointer = JSON.parse(fs.readFileSync(path.join(base, 'active.json')));
            const directory = path.join(base, 'versions', pointer.directory);
            const config = path.join(directory, 'game-instance/config', id === 'snow-war' ? 'mng-snow-war.json' : 'mng-battle-royale.json');
            sources[id] = { path: directory, version: pointer.version, config, configBytes: fs.readFileSync(config) };
            assert.equal(pointer.version, '7.0.3');
        }
    }
    const server = http.createServer((request, response) => {
        const name = new URL(request.url, 'http://127.0.0.1').pathname.slice(1);
        if (!ids.some(id => name === `${id}-7.0.4.zip` || name === `game-content-${id}-7.0.4.json`)) { response.writeHead(404); response.end(); return; }
        const file = path.join(assets, name);
        response.writeHead(200, { 'Content-Length': fs.statSync(file).size });
        fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const progress = [];
    const library = createGameLibrary({ root, definitions: Object.fromEntries(ids.map(id => [id, { klasor: id }])),
        resolveLegacy: id => sources[id] || null,
        getPackage: id => {
            const game = catalog.games.find(game => game.id === id);
            return { ...game, files: !incremental ? undefined : game.files.map(file => ({ ...file,
                url: usePublic ? file.url : `http://127.0.0.1:${server.address().port}/${path.basename(new URL(file.url).pathname)}` })),
                url: usePublic ? game.url : `http://127.0.0.1:${server.address().port}/${id}-7.0.4.zip` };
        },
        preservePaths: () => ['game-instance/config', 'game-instance/saves', 'game-instance/options.txt'],
        validate: (directory, id) => ['launch-game.cjs', 'runtime/java/bin/java.exe',
            `game-instance/mods/${id === 'snow-war' ? 'mng-snow-war' : 'mng_battle_royale'}-1.0.0.jar`].every(file => fs.existsSync(path.join(directory, file))),
        onProgress: event => { progress.push(event); if (!event.percent || event.percent === 100) console.log(event.oyun + ':' + event.phase); }
    });
    const results = [];
    try {
        for (const id of ids) {
            const game = catalog.games.find(game => game.id === id);
            const original = `D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3/assets/${id}-7.0.3.zip`;
            await assert.rejects(verifyArchive(original, { metadataOnly: true }), /compressed\/uncompressed size mismatch for stored file: 2 != 0/);
            const manifest = JSON.parse(fs.readFileSync(path.join(assets, `game-content-${id}-7.0.4.json`)));
            const previous = JSON.parse(fs.readFileSync(`D:/TikMnG-Minecraft-Oyun-Guncellemesi-7.0.3/assets/game-content-${id}-7.0.3.json`));
            assert.deepEqual(manifest.files, previous.files.filter(file => !/^runtime\/natives\/jna\d+\.dll\.x$/.test(file.path)));
            const other = ids.find(other => other !== id), otherBefore = library.state(other);
            const start = performance.now();
            await library.install(id);
            const state = library.state(id);
            assert.equal(state.installed, true); assert.equal(state.installedVersion, '7.0.4');
            assert.equal(library.state(other).path, otherBefore.path);
            assert.equal(library.state(other).installedVersion, otherBefore.installedVersion);
            const pending = manifest.files.values();
            let hashedFiles = 0;
            async function verifyFiles() {
                for (let next = pending.next(); !next.done; next = pending.next()) {
                    const file = next.value, target = path.join(state.path, file.path);
                    if (incremental && /^game-instance\/(?:config\/|saves\/|options\.txt$)/.test(file.path)) continue;
                    assert.equal((await fsp.stat(target)).size, file.bytes, file.path);
                    assert.equal(await digest(target), file.sha256, file.path);
                    hashedFiles++;
                }
            }
            await Promise.all(Array.from({ length: 4 }, verifyFiles));
            const marker = JSON.parse(fs.readFileSync(path.join(state.path, '.tikmng-package.json')));
            assert.equal(marker.version, '7.0.4');
            assert.equal(fs.existsSync(path.join(state.path, 'runtime/natives/jna15879509439115878519.dll.x')), false);
            if (incremental) {
                const done = progress.filter(event => event.oyun === id && event.phase === 'complete').at(-1);
                assert.equal(done.transferredBytes, 0); assert.equal(done.changedFiles, 0);
                assert.deepEqual(fs.readFileSync(path.join(state.path, 'game-instance/config', path.basename(sources[id].config))), sources[id].configBytes);
                assert.deepEqual(fs.readFileSync(sources[id].config), sources[id].configBytes);
            }
            results.push({ id, version: state.installedVersion, freshArchiveInstallPassed: !incremental,
                previousVersion: incremental ? sources[id].version : null, incrementalWithZeroContentBytes: incremental,
                originalReportedErrorReproduced: true, installedContentFilesHashed: hashedFiles,
                gameplayFilesUnchanged: true, elapsedMs: Math.round(performance.now() - start), archiveSha256: game.sha256,
                otherGamePointerAndVersionUnchanged: true });
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
    const report = { passed: true, checkedAt: new Date().toISOString(), publicGitHubDownloads: usePublic,
        actualLauncherArchiveDownloadPreflightExtractionAndActivation: !incremental, settingsBytePreserved: incremental,
        isolatedLibraryRoot: root, games: results };
    fs.writeFileSync(path.join(output, (usePublic ? 'public-' : '') + (incremental ? 'incremental-verification.json' : 'fresh-install-verification.json')), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
