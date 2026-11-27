'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSharedLiveConnection } = require('../lib/shared-live-connection.cjs');

function fixture() {
    const observers = new Set();
    let current = { status:'connected', username:'host', roomId:'73123' };
    const context = {
        ensureLive: async () => current,
        getStatus: () => current,
        observe(observer) {
            observers.add(observer);
            return () => observers.delete(observer);
        }
    };
    return {
        observers, context,
        move(status) { current = status; for (const observer of observers) observer.status(status); },
        publish(type, data) { for (const observer of observers) observer.event(type, data, current); }
    };
}

test('game subscribes to the verified owner room and closing it leaves the owner connected', async () => {
    const { observers, context, publish } = fixture();
    const connection = createSharedLiveConnection('@HOST', context);
    const accepted = [];
    connection.on('gift', data => accepted.push(data));
    assert.deepEqual(await connection.connect(), { roomId:'73123', isConnected:true });
    publish('gift', { giftId:'123', repeatCount:2, common:{ msgId:'900' } });
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].common.msgId, '900');
    connection.disconnect();
    publish('gift', { giftId:'123', common:{ msgId:'901' } });
    assert.equal(accepted.length, 1);
    assert.equal(observers.size, 0);
    assert.equal(context.getStatus().status, 'connected');
});

test('switching rooms retires the old subscriber and offline is reported explicitly', async () => {
    const fixtureState = fixture();
    const connection = createSharedLiveConnection('host', fixtureState.context);
    await connection.connect();
    let lost = 0;
    connection.on('disconnected', () => lost++);
    fixtureState.move({ status:'connected', username:'other', roomId:'73124' });
    assert.equal(lost, 1);
    assert.equal(connection.isConnected, false);
    assert.equal(fixtureState.observers.size, 0);
    fixtureState.move({ status:'waiting', reason:'offline', username:'host' });
    await assert.rejects(connection.connect(), /not online/);
});
