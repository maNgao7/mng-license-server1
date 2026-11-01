'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Store = require('C:/Users/User/Desktop/MNG-TikTok-Game/launcher/node_modules/electron-store');
const { createCachedStore } = require('../lib/cached-store.cjs');
const { createStudio } = require('../lib/widget-studio.cjs');
const { scopedWidgetSnapshot } = require('../lib/widget-snapshot.cjs');
const root = fs.mkdtempSync('D:/TikMnG-Update-QA-20261030/widget-burst-');
const disk = new Store({ cwd: root, name: 'synthetic', encryptionKey: 'synthetic-qa-not-user-credentials' });
let writes = 0;
const adapter = { path: disk.path, get store() { return disk.store; }, set store(value) { writes++; disk.store = value; },
    get: (...args) => disk.get(...args), set: (...args) => disk.set(...args), delete: (...args) => disk.delete(...args) };
const store = createCachedStore(adapter), studio = createStudio(store, () => '');
studio.save('qa', 'raconlist', { giftId: '7934' });
studio.save('qa', 'raconlist', { giftId: '7934', rankingRows: Array.from({ length: 5000 }, (_, i) => ({ username: 'qa_' + i, count: 1 })) });
const before = writes, durations = [];
for (let i = 0; i < 200; i++) {
    const start = performance.now();
    store.batch(() => studio.ingest('qa', { id: 'burst-' + i, type: 'gift', giftId: '7934', count: 1, coins: 1,
        username: 'qa_0', nickname: 'Synthetic QA', createdAt: Date.now() }));
    durations.push(performance.now() - start);
}
const state = studio.state('qa');
assert.equal(state.raconRanking.length, 5000); assert.equal(state.raconRanking[0].count, 201);
assert.equal(writes - before, 200, 'One atomic encrypted write per event');
const snapshotBytes = Buffer.byteLength(JSON.stringify(scopedWidgetSnapshot({ channel: 'qa', studio: state }, 'raconlist')));
assert.ok(snapshotBytes < 8192, 'Overlay must not receive all 5000 participants');
durations.sort((a, b) => a - b);
const report = { passed: true, synthetic: true, encryptedStore: true, participants: 5000, giftEvents: 200,
    receivedGiftCount: 200, atomicWrites: writes - before, snapshotBytes,
    meanEventMs: durations.reduce((a, b) => a + b, 0) / durations.length, p95EventMs: durations[189],
    maxEventMs: durations.at(-1), scope: 'Local model/persistence burst, not a full broadcast GPU or all-device guarantee' };
fs.writeFileSync(path.resolve(__dirname, '../qa/20261030/widget-burst-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
