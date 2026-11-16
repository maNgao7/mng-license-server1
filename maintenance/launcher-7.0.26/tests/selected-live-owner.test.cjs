'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSelectedLiveOwner } = require('../lib/selected-live-owner.cjs');

test('TikFinity-selected games share one bridge request and do not open a direct SDK session', async () => {
    let status = { status: 'ready', username: 'host' };
    const observers = new Set();
    let direct = 0, bridge = 0, closed = 0;
    const connect = createSelectedLiveOwner({
        source: () => 'tikfinity', getStatus: () => status,
        connectDirect: () => { direct++; }, closeDirect: async () => { closed++; },
        connectBridge() {
            bridge++;
            setImmediate(() => {
                status = { status: 'connected', username: 'host', roomId: '73554' };
                for (const observer of observers) observer.status(status);
            });
        },
        observe: observer => { observers.add(observer); return () => observers.delete(observer); }
    });
    const results = await Promise.all([connect('host'), connect('host')]);
    assert.equal(results[0].roomId, '73554');
    await connect('host');
    assert.equal(direct, 0);
    assert.equal(bridge, 1);
    assert.equal(closed, 1);
    assert.equal(observers.size, 0);
});

test('direct source uses its existing shared session and bridge timeout does not invent an active room', async () => {
    let selected = 'direct';
    let direct = 0, bridge = 0;
    const connect = createSelectedLiveOwner({
        source: () => selected, getStatus: () => ({ status: 'ready', username: 'host', roomId: '' }),
        connectDirect: async () => { direct++; return { status: 'connected' }; },
        closeDirect: async () => {}, connectBridge: () => { bridge++; },
        observe: () => () => {}, timeoutMs: 10
    });
    await connect('host');
    selected = 'tikfinity';
    await assert.rejects(connect('host'), /bekleniyor/);
    assert.equal(direct, 1);
    assert.equal(bridge, 1);
});
