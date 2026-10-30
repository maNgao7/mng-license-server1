'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { updatePK, visiblePK } = require('../lib/pk-state.cjs');
const scores = { battleId: '123', armies: { 111: { hostscore: '10' }, 222: { hostscore: '20' } } };
test('finished PK cannot be revived by late score events and disappears after its final display', () => {
    let state = updatePK(null, scores, 1000);
    state = updatePK(state, { battleId: '123', battleSettings: { status: 2 } }, 2000);
    assert.equal(state.status, 'finished');
    state = updatePK(state, scores, 3000);
    assert.equal(state.status, 'finished');
    assert.deepEqual(state.players.map(p => p.score), [10, 20]);
    assert.ok(visiblePK(state, 16999)); assert.equal(visiblePK(state, 17001), null);
});
test('new PK clears previous scores, enriches profiles and displays only its own scores', () => {
    let state = updatePK(null, scores, 1000);
    state = updatePK(state, { battleId: '124', battleSettings: { status: 0 } }, 2000);
    assert.equal(state.players.length, 0);
    state = updatePK(state, { ...scores, battleId: '124', battleSettings: { status: 1 } }, 3000);
    assert.equal(state.status, 'active'); assert.equal(state.players.length, 2);
    assert.equal(visiblePK(state, 303001), null);
});
test('announced end time removes obsolete scores even when no finish event arrives', () => {
    const now = 1793380000000;
    const state = updatePK(null, { ...scores, battleSettings: { status: 1, endTimeMs: String(now + 10000) } }, now);
    assert.ok(visiblePK(state, now + 20000)); assert.equal(visiblePK(state, now + 26000), null);
});
