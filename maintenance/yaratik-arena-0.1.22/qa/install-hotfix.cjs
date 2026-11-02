'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const launcher = 'C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/outputs/launcher-update-7.0.15';
const { createGameLibrary } = require(path.join(launcher, 'lib/game-library.cjs'));
const arena = require(path.join(launcher, 'lib/arena-package.cjs'));
const version = process.argv[2] || '0.1.21';
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid game version');
const descriptor = require('D:/TikMnG-Yaratik-Arena-' + version + '-release/package-descriptor.json');
const root = 'D:/TikMnG-Arena715-Final2QA';
let server;
async function main() {
    server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Length': descriptor.bytes, 'Content-Type': 'application/zip' });
        fs.createReadStream(descriptor.file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const library = createGameLibrary({ root: path.join(root, 'library'), definitions: { 'yaratik-arena': { id: 'yaratik-arena', klasor: 'yaratik-arena', paketSurumu: version } },
        resolveLegacy: () => null, validate: arena.validatePackageDirectory,
        getPackage: () => ({ version: descriptor.version, url: 'http://127.0.0.1:' + server.address().port + '/yaratik-arena.zip', bytes: descriptor.bytes, sha256: descriptor.sha256 }),
        preservePaths: () => ['userdata', 'game'], onProgress: p => { if (p.phase !== server.lastPhase) { server.lastPhase = p.phase; console.log(p.phase); } } });
    const original = library.pathFor('yaratik-arena');
    assert.ok(original);
    const before = fs.readFileSync(path.join(original, 'userdata/mod-settings.json'));
    await library.install('yaratik-arena');
    const directory = library.pathFor('yaratik-arena');
    assert.notEqual(original, directory);
    assert.deepEqual(fs.readFileSync(path.join(directory, 'userdata/mod-settings.json')), before);
    const prepared = await arena.prepareLaunch({ directory });
    assert.equal(prepared.copiedBytes, 0, 'Updating the mod must preserve the cached original Steam base');
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'))).version, version);
    const result = { passed: true, directory, previous: original, settingsPreserved: true, steamBaseRecopiedBytes: prepared.copiedBytes, descriptor };
    fs.writeFileSync(path.join(root, 'hotfix-install-' + version + '-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
