'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const yauzl = createRequire(require.resolve('extract-zip'))('yauzl');
const root = path.resolve(__dirname, '..');
const expected = require('../renderer/gift-assets/katalog_tam.json');

async function main() {
    const file = path.resolve(process.argv[2]);
    const assets = path.join(root, 'renderer/gift-assets');
    const data = new Map();
    let catalogScreen;
    await new Promise((resolve, reject) => {
        yauzl.open(file, { lazyEntries: true }, (error, zip) => {
            if (error) return reject(error);
            zip.on('error', reject); zip.on('end', resolve);
            zip.on('entry', entry => {
                const isScreen = ['com/tikmng/snowwar/client/SnowWarGiftCatalogScreen.class','com/tikmng/snake/SnakeScreens.class'].includes(entry.fileName);
                if (!isScreen && !/^assets\/(?:mng_(?:snow_war|battle_royale)|tikmng_snake_arena)\/gifts\/(?:catalog\.json|katalog_tam\.json|visual-groups\.json|\d+\.png)$/.test(entry.fileName)) return zip.readEntry();
                zip.openReadStream(entry, (error, stream) => {
                    if (error) return reject(error);
                    const chunks = [];
                    stream.on('error', reject); stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', () => {
                        const bytes = Buffer.concat(chunks);
                        if (isScreen) catalogScreen = bytes; else data.set(path.posix.basename(entry.fileName), bytes);
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
    const catalog = JSON.parse((data.get('katalog_tam.json')||data.get('catalog.json')).toString('utf8'));
    assert.equal(catalog.length, expected.length);
    assert.equal(data.size, expected.length+2, 'canonical merged gift PNGs plus metadata and visual groups; no unrelated IDs');
    assert.deepEqual(data.get('visual-groups.json'),fs.readFileSync(path.join(assets,'visual-groups.json')));
    assert.ok(catalogScreen?.includes(Buffer.from('gifts/')), 'compiled catalog screen uses gift textures');
    assert.equal(catalogScreen.includes(Buffer.from('textures/gui/gifts/')), false, 'compiled UI must use canonical merged artwork, not the obsolete duplicate directory');
    const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    const byId = new Map(catalog.map(gift => [gift.id, gift]));
    for (const gift of expected) {
        assert.equal(byId.get(gift.id)?.coins, gift.coins, gift.id + ' coin mapping');
        assert.equal(byId.get(gift.id)?.name, gift.name, gift.id + ' name mapping');
        assert.equal(digest(data.get(gift.id + '.png')), digest(fs.readFileSync(path.join(assets, gift.id + '.png'))), gift.id + ' artwork bytes');
    }
    console.log(JSON.stringify({ passed: true, file, catalog: catalog.length, pngs: data.size - 2, uniqueVisuals:JSON.parse(data.get('visual-groups.json')).groups.length, allNamesCoinsAndPngsMatchSource: true, compiledCatalogUsesCanonicalTextures: true }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
