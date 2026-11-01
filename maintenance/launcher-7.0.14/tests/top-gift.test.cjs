'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recordTopGift, topGiftState } = require('../lib/top-gift.cjs');
const tea = (username, count = 1) => ({ username, giftId: '5303', giftName: 'Çay', count, coins: count * 50 });
test('equal unit prices keep the incumbent regardless of repeat count', () => {
    let state = recordTopGift({}, tea('first', 5));
    state = recordTopGift(state, tea('second', 5));
    assert.equal(state.champion.username, 'first');
    state = recordTopGift(state, tea('second'));
    assert.equal(state.champion.username, 'first');
    assert.equal(state.champion.count, 5);assert.equal(state.champion.coins, 50);
    state = recordTopGift(state, tea('first'));
    assert.equal(state.champion.username, 'first');
    state = recordTopGift(state, { username: 'third', giftId: 'galaxy', coins: 1000, count: 1 });
    assert.equal(state.champion.username, 'third');
});
test('same sender and gift accumulate, different gifts do not merge and data survive restart', () => {
    let state = recordTopGift({}, tea('first', 2));
    state = recordTopGift(JSON.parse(JSON.stringify(state)), tea('@FIRST', 2));
    assert.equal(state.champion.coins, 50);assert.equal(state.champion.totalCoins, 200);assert.equal(state.champion.count, 4);
    state = recordTopGift(state, { username: 'first', giftId: 'rose', coins: 10, count: 10 });
    assert.equal(state.champion.giftId, '5303');assert.equal(state.candidates.length, 2);
    const otherChannel = recordTopGift({}, tea('other'));
    assert.equal(otherChannel.champion.coins, 50);
});
test('501 roses cannot beat one money gun; saved cumulative rankings migrate to unit price',()=>{
    const rose={username:'rose',giftId:'rose',count:501,coins:501};
    const gun={username:'gun',giftId:'gun',count:1,coins:500};
    let state=recordTopGift({},gun);state=recordTopGift(state,rose);
    state=recordTopGift(state,{...rose,count:10000,coins:10000});
    assert.equal(state.champion.username,'gun');assert.equal(state.candidates[1].unitCoins,1);
    assert.equal(state.candidates[1].totalCoins,10501);
    const migrated=topGiftState({schemaVersion:2,champion:rose,candidates:[rose,gun]});
    assert.equal(migrated.schemaVersion,3);assert.equal(migrated.champion.username,'gun');
    assert.equal(topGiftState({old:rose}).champion.unitCoins,1);
});
test('legacy champion retained; partial streak and invalid coins cannot change it', () => {
    const old = { champion: tea('old', 5) };
    assert.equal(topGiftState(old).champion.username, 'old');
    for (const coins of [NaN, Infinity, -20]) assert.equal(recordTopGift(old, { ...tea('new'), coins }).champion.username, 'old');
    assert.equal(recordTopGift(old, { ...tea('new', 10), giftType: 1, repeatEnd: false }).champion.username, 'old');
});
