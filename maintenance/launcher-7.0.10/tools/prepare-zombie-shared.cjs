'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { createGameLibrary } = require('../lib/game-library.cjs');
const { hashFile } = require('../lib/download.cjs');
const { prepare } = require('./prepare-shared-game.cjs');
const root = 'D:/TikMnG-Update-QA-20261030/zombie-canonical';
const expected = require('../lib/catalog-defaults.json').games.find(game => game.id === 'zombie-war');
const archive = path.join('D:/TikMnG-Update-QA-20261030/retained-download-cache', expected.sha256 + '.zip');
let server;
(async () => {
    if (fs.statSync(archive).size !== expected.bytes || await hashFile(archive) !== expected.sha256) throw new Error('Canonical ZIP not verified');
    server = http.createServer((req, res) => {
        if (req.url !== '/canonical.zip') return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Length': expected.bytes }); fs.createReadStream(archive).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const library = createGameLibrary({ root, definitions: { 'zombie-war': {} },
        validate: dir => fs.existsSync(path.join(dir, 'launch-game.cjs')) && fs.existsSync(path.join(dir, 'game-instance/mods/mng-zombie-strike-1.0.0.jar')),
        getPackage: () => ({ ...expected, url: 'http://127.0.0.1:' + server.address().port + '/canonical.zip' }) });
    await library.install('zombie-war');
    const source = library.pathFor('zombie-war');
    for (const world of ['dust2', 'office', 'fighting_arena', 'romanya']) {
        if (!fs.existsSync(path.join(source, 'game-instance/saves', world, 'level.dat'))) throw new Error('Canonical map missing: ' + world);
    }
    console.log(JSON.stringify(await prepare({ source, output: 'D:/TikMnG-Update-QA-20261030/shared-packages', packageId: 'zombie-war', version: '6.5.18',
        worldTemplates: ['dust2', 'office', 'fighting_arena', 'romanya'],
        publicBase: 'https://github.com/maNgao7/mng-license-server1/releases/download/game-components-7.0.9/' })));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
});
