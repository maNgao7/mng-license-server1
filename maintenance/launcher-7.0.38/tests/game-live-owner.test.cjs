'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameLiveOwner } = require('../lib/game-live-owner.cjs');

test('game retries share the current owner and respect manual disconnect and account selection', async () => {
    const owner = createGameLiveOwner();
    let channel = 'first';
    const started = [];
    const connect = owner.bind({
        getChannel: () => channel,
        setChannel: value => { channel = value; },
        ensureLive: async value => { started.push(value); return { status: 'connected' }; }
    });
    await connect('first');
    owner.manualConnect();
    channel = 'second';
    await assert.rejects(connect('first'), /launcher/);
    assert.equal(channel, 'second');
    await connect('second');
    owner.manualDisconnect();
    await assert.rejects(connect('second'), /launcher/);
    owner.manualConnect();
    await connect('second');
    assert.deepEqual(started, ['first', 'second', 'second']);
});
