'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { createSharedLiveConnection } = require('../lib/shared-live-connection.cjs');
const { createSharedGameEvents } = require('../lib/shared-game-events.cjs');

const root = path.join(__dirname, '..');
const directory = path.join(root, 'renderer/gift-assets');
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const catalog = read('katalog_tam.json');

test('updated gifts are available with the verified ID, coin value and PNG', () => {
    const library = read('_kutuphane.json');
    const presentation = read('visual-groups.json');
    const ids = catalog.map(row => row.id).sort();
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(library.map(row => row.id).sort(), ids);
    assert.deepEqual(presentation.groups.flatMap(group => group.ids).sort(), ids);
    for (const [id, coins] of [['1444192', 1], ['1444195', 99], ['1514426', 1000]]) {
        const row = catalog.find(gift => gift.id === id);
        assert.equal(row.coins, coins);
        assert.equal(row.file, id + '.png');
        assert.equal(fs.readFileSync(path.join(directory, row.file)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
    assert.equal(catalog.find(gift => gift.id === '5655').coins, 1);
});

test('widgets resolve new artwork by exact ID and allow LIVE artwork for an unlisted ID', () => {
    const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const lookup = vm.runInNewContext(
        main.slice(main.indexOf('let widgetGiftCatalogCache'), main.indexOf('function widgetLeaderboardKaydiEkle')) +
        '\nwidgetHediyeGorseliBul',
        { fs, path, process, __dirname: root, widgetYerelUrl: relative => relative }
    );
    assert.equal(lookup('Gül', '1444192'), '/widget/gift-assets/1444192.png');
    assert.equal(lookup('Gül', '99999999999'), '');
    assert.equal(lookup('Gül', ''), '/widget/gift-assets/5655.png');
});

test('shared LIVE events pass new numeric gift IDs, count and completion fields to games', async () => {
    const status = { username: 'catalog-test', roomId: '7811', status: 'connected' };
    const events = createSharedGameEvents();
    const connection = createSharedLiveConnection(status.username, {
        ensureLive: async () => status,
        getStatus: () => status,
        observe: observer => events.subscribe((type, payload) => observer.event(type, payload, status)),
    });
    const received = [];
    connection.on('gift', gift => received.push(gift));
    await connection.connect();
    const gift = { giftId: 1444192, repeatCount: 3, repeatEnd: true, diamondCount: 1 };
    events.publish('gift', gift, { channel: status.username, source: 'live' });
    assert.deepEqual(received, [gift]);
    connection.disconnect();
    events.close();
});
