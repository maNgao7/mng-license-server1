'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recordTopGift, topGiftState } = require('../lib/top-gift.cjs');
const tea = (username, count = 1) => ({ username, giftId: '5303', giftName: 'Çay', count, coins: count * 50 });
test('five teas keep the incumbent on an equal five, sixth tea changes leader', () => {
    let state = recordTopGift({}, tea('first', 5));
    state = recordTopGift(state, tea('second', 5));
    assert.equal(state.champion.username, 'first');
    state = recordTopGift(state, tea('second'));
    assert.equal(state.champion.username, 'second');
    assert.equal(state.champion.count, 6);assert.equal(state.champion.coins, 300);
    state = recordTopGift(state, tea('first'));
    assert.equal(state.champion.username, 'second');
    state = recordTopGift(state, { username: 'third', giftId: 'galaxy', coins: 1000, count: 1 });
    assert.equal(state.champion.username, 'third');
});
test('same sender and gift accumulate, different gifts do not merge and data survive restart', () => {
    let state = recordTopGift({}, tea('first', 2));
    state = recordTopGift(JSON.parse(JSON.stringify(state)), tea('@FIRST', 2));
    assert.equal(state.champion.coins, 200);assert.equal(state.champion.count, 4);
    state = recordTopGift(state, { username: 'first', giftId: 'rose', coins: 10, count: 10 });
    assert.equal(state.champion.giftId, '5303');assert.equal(state.candidates.length, 2);
    const otherChannel = recordTopGift({}, tea('other'));
    assert.equal(otherChannel.champion.coins, 50);
});
test('legacy champion retained; partial streak and invalid coins cannot change it', () => {
    const old = { champion: tea('old', 5) };
    assert.equal(topGiftState(old).champion.username, 'old');
    for (const coins of [NaN, Infinity, -20]) assert.equal(recordTopGift(old, { ...tea('new'), coins }).champion.username, 'old');
    assert.equal(recordTopGift(old, { ...tea('new', 10), giftType: 1, repeatEnd: false }).champion.username, 'old');
});
