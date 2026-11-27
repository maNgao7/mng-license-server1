'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HediyeBoxMatch } = require('../src/match-core.cjs');

function gift(eventId, overrides = {}) {
  return {
    eventId, giftId: '5655', giftName: 'Gül', giftType: 0,
    repeatCount: 1, repeatEnd: true, userId: 'user-1',
    uniqueId: 'handle-1', nickname: 'Sender One',
    profilePictureUrl: 'https://profiles.invalid/one.jpg', isTest: false,
    ...overrides,
  };
}
function hit(match, side, now) {
  const punch = match.nextPunch(side, now);
  assert.ok(punch, `${side} punch should be available at ${now}`);
  return match.reportHit(punch.punchId);
}

test('starts with two fixed healthy boxers and never dispatches autonomous punches', () => {
  const match = new HediyeBoxMatch();
  const state = match.snapshot();
  assert.equal(state.status, 'active');
  assert.equal(state.winner, null);
  assert.equal(state.sides.left.giftId, '5655');
  assert.equal(state.sides.right.giftId, '5269');
  for (const side of ['left', 'right']) {
    assert.equal(state.sides[side].health, 100);
    assert.equal(state.sides[side].leader, null);
    assert.equal(match.nextPunch(side, 0), null);
    assert.equal(match.nextPunch(side, 100000), null);
  }
  match.ingestGift(gift('one'));
  assert.equal(match.snapshot().sides.right.health, 100);
  assert.equal(match.snapshot().sides.left.inFlight, null);
});

test('global event dedupe prevents replay and the same event being applied to both sides', () => {
  const match = new HediyeBoxMatch();
  assert.deepEqual(match.ingestGift(gift('shared')), { accepted: true, side: 'left', addedPunches: 1 });
  assert.equal(match.ingestGift(gift('shared')).reason, 'duplicate-event');
  assert.equal(match.ingestGift(gift('shared', { giftId: '5269', userId: 'other' })).reason, 'duplicate-event');
  assert.equal(match.ingestGift(gift('shared', { isTest: true })).reason, 'duplicate-event');
  assert.equal(match.snapshot().sides.left.pendingPunches, 1);
  assert.equal(match.snapshot().sides.right.pendingPunches, 0);
});

test('cumulative 1 -> 3 -> 3 final credits three units immediately without a final double count', () => {
  const match = new HediyeBoxMatch();
  const combo = { streakId: 'combo-1', giftType: 1, repeatEnd: false };
  assert.equal(match.ingestGift(gift('c1', combo)).addedPunches, 1);
  assert.equal(match.snapshot().sides.left.pendingPunches, 1);
  assert.ok(match.nextPunch('left', 0), 'no waiting for repeatEnd');
  assert.equal(match.ingestGift(gift('c2', { ...combo, repeatCount: 3 })).addedPunches, 2);
  assert.equal(match.ingestGift(gift('c3', { ...combo, repeatCount: 3, repeatEnd: true })).addedPunches, 0);
  const state = match.snapshot().sides.left;
  assert.equal(state.pendingPunches, 2);
  assert.equal(state.giftUnits, 3);
  assert.equal(state.leader.giftCount, 3);
  assert.equal(match.ingestGift(gift('older', { ...combo, repeatCount: 2 })).addedPunches, 0);
  assert.equal(match.ingestGift(gift('c4', { ...combo, repeatCount: 4 })).addedPunches, 1);
});

test('streak keys separate senders, gifts, new combos and live/test streams', () => {
  const match = new HediyeBoxMatch();
  const combo = { giftType: 1, streakId: 'same', repeatCount: 3 };
  for (const [eventId, overrides] of [
    ['a', combo],
    ['b', { ...combo, userId: 'user-2' }],
    ['c', { ...combo, giftId: '5269' }],
    ['d', { ...combo, streakId: 'new' }],
    ['test', { ...combo, isTest: true }],
  ]) assert.equal(match.ingestGift(gift(eventId, overrides)).addedPunches, 3);
  assert.equal(match.snapshot().sides.left.pendingPunches, 12);
  assert.equal(match.snapshot().sides.right.pendingPunches, 3);
  assert.equal(match.snapshot().sides.left.leader.giftCount, 6);
});

test('independent non-streak gifts with equal repeat counts are all counted', () => {
  const match = new HediyeBoxMatch();
  match.ingestGift(gift('a', { repeatCount: 3 }));
  match.ingestGift(gift('b', { repeatCount: 3 }));
  assert.equal(match.snapshot().sides.left.pendingPunches, 6);
});

test('owner delta packets carrying combo metadata retain each distinct unit and dedupe replays', () => {
  const match = new HediyeBoxMatch();
  const combo = {isDelta:true, giftType:1, streakId:'owner-series', repeatCount:2};
  for (const eventId of ['first','second','first']) match.ingestGift(gift(eventId, combo));
  assert.equal(match.snapshot().sides.left.pendingPunches, 4);
});

test('leaders aggregate by stable user ID, keep display identity separate and exclude tests', () => {
  const match = new HediyeBoxMatch();
  match.ingestGift(gift('a', { repeatCount: 2 }));
  match.ingestGift(gift('b', { userId: 'user-2', uniqueId: 'second', nickname: 'Two', repeatCount: 3 }));
  assert.equal(match.snapshot().sides.left.leader.userId, 'user-2');
  match.ingestGift(gift('tie'));
  assert.equal(match.snapshot().sides.left.leader.userId, 'user-2', 'incumbent wins a tie');
  const urls = ['https://profiles.invalid/best.jpg', 'https://profiles.invalid/backup.jpg'];
  match.ingestGift(gift('lead', {
    uniqueId: 'renamed', nickname: 'New Name', profilePictureUrl: urls[0], profilePictureUrls: urls,
  }));
  urls[0] = 'mutated';
  const leader = match.snapshot().sides.left.leader;
  assert.equal(leader.userId, 'user-1');
  assert.equal(leader.uniqueId, 'renamed');
  assert.equal(leader.nickname, 'New Name');
  assert.equal(leader.giftCount, 4);
  assert.equal(leader.profilePictureUrl, 'https://profiles.invalid/best.jpg');
  assert.equal(leader.profilePictureUrls[0], leader.profilePictureUrl);
  match.ingestGift(gift('test-leader', { isTest: true, userId: 'test', repeatCount: 100 }));
  assert.equal(match.snapshot().sides.left.leader.userId, 'user-1');
  match.ingestGift(gift('right', { giftId: '5269', userId: 'user-3', uniqueId: 'right-handle' }));
  assert.equal(match.snapshot().sides.right.leader.userId, 'user-3');
  match.ingestGift(gift('no-profile', { profilePictureUrl: '', nickname: '', uniqueId: '' }));
  assert.equal(match.snapshot().sides.left.leader.nickname, 'New Name');
  assert.equal(match.snapshot().sides.left.leader.profilePictureUrl, leader.profilePictureUrl);
});

test('opaque IDs preserve precision and do not collide with display-name fallback identities', () => {
  const match = new HediyeBoxMatch();
  const userId = '999999999999999999999';
  match.ingestGift(gift(1, { userId, repeatCount: 2 }));
  match.ingestGift(gift('2', { userId: '', uniqueId: userId }));
  assert.equal(match.snapshot().sides.left.leader.userId, userId);
  assert.equal(match.snapshot().sides.left.leader.giftCount, 2);
  assert.equal(match.ingestGift(gift('1')).reason, 'duplicate-event');
});

test('catalog IDs are authoritative; exact name fallback works only without an ID', () => {
  const match = new HediyeBoxMatch();
  assert.equal(match.ingestGift(gift('left', { giftName: 'TikTok' })).side, 'left');
  assert.equal(match.ingestGift(gift('right', { giftId: 5269, giftName: 'Rose' })).side, 'right');
  for (const [i, name] of ['Rose', 'Gül', 'GÜL', 'gul'].entries()) {
    assert.equal(match.ingestGift(gift(`name-${i}`, { giftId: undefined, giftName: name })).side, 'left');
  }
  assert.equal(match.ingestGift(gift('name-right', { giftId: '', giftName: ' TikTok ' })).side, 'right');
  for (const [i, overrides] of [
    { giftId: '999', giftName: 'Rose' },
    { giftId: undefined, giftName: 'Rose Galaxy' },
    { giftId: NaN, giftName: 'Rose' },
  ].entries()) assert.equal(match.ingestGift(gift(`unknown-${i}`, overrides)).reason, 'unsupported-gift');
});

test('controller interleaves queues, first punch is immediate and delayed polling never drops units', () => {
  const match = new HediyeBoxMatch({ maxHealth: 1000, punchIntervalMs: 100 });
  match.ingestGift(gift('left', { repeatCount: 4 }));
  match.ingestGift(gift('right', { giftId: '5269', repeatCount: 3 }));
  const left = match.nextPunch('left', 0);
  const right = match.nextPunch('right', 0);
  assert.ok(left);
  assert.ok(right);
  assert.equal(match.nextPunch('left', 10000), null, 'in-flight punches need contact acknowledgement');
  assert.equal(match.snapshot().sides.left.pendingPunches, 3);
  assert.equal(match.reportHit(left.punchId).health, 995);
  assert.equal(match.reportHit(right.punchId).health, 995);
  assert.equal(match.nextPunch('left', 99), null);
  assert.equal(match.nextPunch('right', 99), null);
  hit(match, 'right', 100);
  hit(match, 'left', 100);
  hit(match, 'left', 100000);
  assert.equal(match.nextPunch('left', 100000), null, 'no burst catch-up');
  hit(match, 'right', 100000);
  hit(match, 'left', 100100);
  const state = match.snapshot();
  assert.equal(state.sides.left.health, 985);
  assert.equal(state.sides.right.health, 980);
  for (const side of ['left', 'right']) {
    assert.equal(state.sides[side].pendingPunches, 0);
    assert.equal(match.nextPunch(side, 999999), null);
  }
});

test('huge combos stay as exact counters and snapshots do not materialize punch items', () => {
  const match = new HediyeBoxMatch();
  const count = 1_000_000_000_000;
  match.ingestGift(gift('huge', { repeatCount: count, streakId: 'huge', giftType: 1 }));
  assert.equal(match.snapshot().sides.left.pendingPunches, count);
  const punch = match.nextPunch('left', 0);
  assert.ok(punch);
  assert.equal(match.snapshot().sides.left.pendingPunches, count - 1);
  assert.ok(JSON.stringify(match.snapshot()).length < 2500);
});

test('a native miss consumes a punch without damage or KO and releases the next at cadence', () => {
  const match = new HediyeBoxMatch({ maxHealth: 5 });
  match.ingestGift(gift('left', { repeatCount: 2 }));
  match.ingestGift(gift('right', { giftId: '5269' }));
  const punch = match.nextPunch('left', 0);
  const opponent = match.nextPunch('right', 0);
  const before = match.snapshot();
  assert.equal(match.reportMiss('invented'), null);
  assert.deepEqual(match.snapshot(), before);
  assert.deepEqual(match.reportMiss(punch.punchId), {
    ...punch, damageApplied: 0, health: 5, knockout: false,
  });
  const state = match.snapshot();
  assert.equal(state.status, 'active');
  assert.equal(state.winner, null);
  assert.equal(state.sides.left.health, 5);
  assert.equal(state.sides.right.health, 5);
  assert.equal(state.sides.left.inFlight, null);
  assert.equal(state.sides.left.pendingPunches, 1);
  assert.equal(state.sides.left.giftUnits, 2);
  assert.equal(state.sides.left.leader.giftCount, 2);
  assert.equal(state.sides.right.inFlight.punchId, opponent.punchId);
  assert.equal(match.nextPunch('left', 299), null, 'miss does not bypass cadence');
  assert.ok(match.nextPunch('left', 300));
  assert.equal(match.reportMiss(opponent.punchId).damageApplied, 0);
  assert.equal(match.snapshot().sides.right.inFlight, null);
  assert.equal(match.nextPunch('right', 300), null, 'miss does not retry a consumed gift unit');
});

test('miss after hit is ignored without clearing a newer in-flight punch', () => {
  const match = new HediyeBoxMatch();
  match.ingestGift(gift('left', { repeatCount: 2 }));
  const first = hit(match, 'left', 0);
  const next = match.nextPunch('left', 300);
  assert.ok(next);
  const before = match.snapshot();
  assert.equal(match.reportMiss(first.punchId), null);
  assert.deepEqual(match.snapshot(), before);
  assert.equal(match.reportHit(next.punchId).health, 90);
});

test('hit after miss and double miss are ignored without clearing a newer in-flight punch', () => {
  const match = new HediyeBoxMatch();
  match.ingestGift(gift('left', { repeatCount: 2 }));
  const first = match.nextPunch('left', 0);
  assert.ok(match.reportMiss(first.punchId));
  const next = match.nextPunch('left', 300);
  assert.ok(next);
  const before = match.snapshot();
  assert.equal(match.reportHit(first.punchId), null);
  assert.equal(match.reportMiss(first.punchId), null);
  assert.deepEqual(match.snapshot(), before);
  assert.equal(match.reportHit(next.punchId).health, 95);
});

test('damage is applied at contact once, clamped at zero and a round concludes only once', () => {
  const match = new HediyeBoxMatch({ maxHealth: 12, punchDamage: 5, punchIntervalMs: 0 });
  match.ingestGift(gift('left', { repeatCount: 10 }));
  match.ingestGift(gift('right', { giftId: '5269', repeatCount: 2 }));
  const first = match.nextPunch('left', 0);
  assert.equal(match.snapshot().sides.right.health, 12);
  assert.equal(match.reportHit('invented'), null);
  assert.equal(match.reportHit(first.punchId).damageApplied, 5);
  assert.equal(match.reportHit(first.punchId), null);
  assert.equal(hit(match, 'left', 0).health, 2);
  const unhit = match.nextPunch('right', 0);
  const ko = hit(match, 'left', 0);
  assert.equal(ko.damageApplied, 2);
  assert.equal(ko.knockout, true);
  const finished = match.snapshot();
  assert.equal(finished.status, 'finished');
  assert.equal(finished.winner, 'left');
  assert.equal(finished.sides.right.health, 0);
  assert.equal(finished.sides.left.health, 12);
  assert.equal(finished.sides.left.pendingPunches, 7);
  assert.equal(finished.sides.right.pendingPunches, 2, 'unhit opponent punch is returned');
  assert.equal(match.reportHit(unhit.punchId), null);
  assert.equal(match.reportHit(ko.punchId), null);
  assert.equal(match.reportMiss(unhit.punchId), null);
  assert.equal(match.reportMiss(ko.punchId), null);
  assert.equal(match.nextPunch('left', 1000), null);
  assert.equal(match.nextPunch('right', 1000), null);
  assert.deepEqual(match.snapshot(), finished);
});

test('finished gifts queue without restarting; an explicit user reset can discard unspent punches', () => {
  const match = new HediyeBoxMatch({ maxHealth: 5 });
  match.ingestGift(gift('ko', { repeatCount: 2 }));
  const ko = hit(match, 'left', 0);
  match.ingestGift(gift('after', { giftId: '5269', repeatCount: 3 }));
  assert.equal(match.snapshot().status, 'finished');
  assert.equal(match.snapshot().sides.right.pendingPunches, 3);
  assert.equal(match.nextPunch('right', 10000), null);
  const reset = match.resetRound({ preservePending: false });
  assert.equal(reset.round, 2);
  assert.equal(reset.status, 'active');
  assert.equal(reset.winner, null);
  for (const side of ['left', 'right']) {
    assert.equal(reset.sides[side].health, 5);
    assert.equal(reset.sides[side].pendingPunches, 0);
    assert.equal(match.nextPunch(side, 0), null);
  }
  assert.equal(match.reportHit(ko.punchId), null);
  assert.equal(match.ingestGift(gift('after', { giftId: '5269' })).reason, 'duplicate-event');
  assert.equal(reset.sides.right.leader.giftCount, 3, 'leaders are session scoped');
});

test('default reset preserves pending gifts and unresolved punches without dispatching them', () => {
  for (const options of [undefined, {}]) {
    const match = new HediyeBoxMatch({ maxHealth: 5 });
    match.ingestGift(gift('ko', { repeatCount: 3 }));
    match.ingestGift(gift('opponent', { giftId: '5269', repeatCount: 2 }));
    const old = match.nextPunch('right', 0);
    hit(match, 'left', 0);
    match.ingestGift(gift('late', { giftId: '5269' }));
    assert.equal(match.nextPunch('right', 10000), null);
    const reset = match.resetRound(options);
    assert.equal(reset.round, 2);
    assert.equal(reset.status, 'active');
    assert.equal(reset.winner, null);
    assert.equal(reset.sides.left.pendingPunches, 2);
    assert.equal(reset.sides.right.pendingPunches, 3);
    for (const side of ['left', 'right']) {
      assert.equal(reset.sides[side].health, 5);
      assert.equal(reset.sides[side].inFlight, null);
    }
    assert.equal(match.reportMiss(old.punchId), null);
    assert.equal(match.reportHit(old.punchId), null);
    assert.deepEqual(match.snapshot(), reset);
    assert.equal(match.ingestGift(gift('late', { giftId: '5269' })).reason, 'duplicate-event');
    const next = match.nextPunch('right', 0);
    assert.ok(next, 'only a controller call dispatches the preserved queue');
    assert.equal(match.reportMiss(old.punchId), null);
    assert.equal(match.snapshot().sides.right.inFlight.punchId, next.punchId);
  }
});

test('preservePending carries unspent units only after explicit reset and rejects old punch IDs', () => {
  const match = new HediyeBoxMatch({ maxHealth: 5 });
  match.ingestGift(gift('ko', { repeatCount: 3 }));
  match.ingestGift(gift('opponent', { giftId: '5269', repeatCount: 2 }));
  const old = match.nextPunch('right', 0);
  hit(match, 'left', 0);
  match.ingestGift(gift('late', { giftId: '5269' }));
  const reset = match.resetRound({ preservePending: true });
  assert.equal(reset.sides.left.pendingPunches, 2);
  assert.equal(reset.sides.right.pendingPunches, 3);
  assert.equal(reset.sides.right.inFlight, null);
  assert.equal(match.reportHit(old.punchId), null);
  const fresh = match.nextPunch('right', 0);
  assert.notEqual(fresh.punchId, old.punchId);
  assert.equal(match.reportHit(old.punchId), null);
  assert.equal(match.snapshot().sides.left.health, 5);
  assert.equal(match.reportHit(fresh.punchId).knockout, true);
  assert.equal(match.snapshot().winner, 'right');
});

test('reset during an animation preserves by default; explicit discard retains streak high water', () => {
  const match = new HediyeBoxMatch();
  const combo = { giftType: 1, streakId: 'survives', repeatCount: 3 };
  match.ingestGift(gift('a', combo));
  const old = match.nextPunch('left', 0);
  match.resetRound();
  assert.equal(match.snapshot().sides.left.pendingPunches, 3);
  assert.equal(match.reportHit(old.punchId), null);
  assert.equal(match.reportMiss(old.punchId), null);
  match.resetRound({ preservePending: false });
  assert.equal(match.ingestGift(gift('final', { ...combo, repeatEnd: true })).addedPunches, 0);
  assert.equal(match.snapshot().sides.left.pendingPunches, 0);
  assert.equal(match.ingestGift(gift('next', { ...combo, repeatCount: 4 })).addedPunches, 1);
});

test('event retention is bounded LRU with duplicate access refreshing recency', () => {
  const match = new HediyeBoxMatch({ eventCacheSize: 2 });
  match.ingestGift(gift('a'));
  match.ingestGift(gift('b'));
  assert.equal(match.ingestGift(gift('a')).reason, 'duplicate-event');
  match.ingestGift(gift('c'));
  assert.equal(match.ingestGift(gift('a')).reason, 'duplicate-event');
  assert.equal(match.ingestGift(gift('b')).addedPunches, 1, 'evicted IDs are outside the documented window');
});

test('streak retention is bounded LRU; retained high water survives event-ID eviction', () => {
  const match = new HediyeBoxMatch({ eventCacheSize: 1, streakCacheSize: 2 });
  const combo = { giftType: 1, repeatCount: 3 };
  match.ingestGift(gift('a', { ...combo, streakId: 'a' }));
  match.ingestGift(gift('b', { ...combo, streakId: 'b' }));
  assert.equal(match.ingestGift(gift('a', { ...combo, streakId: 'a' })).addedPunches, 0);
  match.ingestGift(gift('c', { ...combo, streakId: 'c' }));
  assert.equal(match.ingestGift(gift('a-final', { ...combo, streakId: 'a' })).addedPunches, 0);
  assert.equal(match.ingestGift(gift('b-final', { ...combo, streakId: 'b' })).addedPunches, 3);
});

test('snapshot, emitted punches and caller-owned metadata cannot mutate internal state', () => {
  const match = new HediyeBoxMatch();
  match.ingestGift(gift('a', { profilePictureUrls: ['https://profiles.invalid/original.jpg'] }));
  const punch = match.nextPunch('left', 0);
  const punchId = punch.punchId;
  punch.damage = 999;
  punch.targetSide = 'left';
  const snapshot = match.snapshot();
  snapshot.status = 'finished';
  snapshot.sides.left.health = 0;
  snapshot.sides.left.leader.nickname = 'changed';
  snapshot.sides.left.leader.profilePictureUrls[0] = 'changed';
  snapshot.sides.left.inFlight.damage = 999;
  assert.equal(match.reportHit(punchId).damageApplied, 5);
  assert.equal(match.snapshot().sides.right.health, 95);
  assert.equal(match.snapshot().sides.left.health, 100);
  assert.equal(match.snapshot().sides.left.leader.nickname, 'Sender One');
  assert.equal(match.snapshot().sides.left.leader.profilePictureUrls[0], 'https://profiles.invalid/original.jpg');
});

test('invalid input and count overflow leave combat unchanged; invalid scheduler configuration throws', () => {
  const match = new HediyeBoxMatch();
  const before = match.snapshot();
  for (const event of [null, [], gift(''), gift('bad', { userId: '', uniqueId: '' }),
    gift('bad', { giftType: 1 }), ...[0, -1, 1.5, NaN, Infinity, true, '', Number.MAX_SAFE_INTEGER + 1]
      .map(repeatCount => gift('bad', { repeatCount }))]) {
    assert.equal(match.ingestGift(event).accepted, false);
  }
  assert.deepEqual(match.snapshot(), before);
  match.ingestGift(gift('max', { repeatCount: Number.MAX_SAFE_INTEGER }));
  const full = match.snapshot();
  assert.equal(match.ingestGift(gift('overflow')).reason, 'count-overflow');
  assert.deepEqual(match.snapshot(), full);
  assert.throws(() => match.nextPunch('unknown', 0), RangeError);
  assert.throws(() => match.nextPunch('left', NaN), RangeError);
  assert.throws(() => match.nextPunch('left', -1), RangeError);
  assert.throws(() => match.resetRound({ preservePending: 'yes' }), TypeError);
  for (const options of [{ maxHealth: 0 }, { punchDamage: -1 }, { punchIntervalMs: Infinity },
    { eventCacheSize: 0 }, { streakCacheSize: 1.5 }]) {
    assert.throws(() => new HediyeBoxMatch(options), RangeError);
  }
});

test('replaying an identical public API trace is deterministic', () => {
  function run() {
    const match = new HediyeBoxMatch();
    match.ingestGift(gift('a', { repeatCount: 2 }));
    const first = hit(match, 'left', 0);
    match.ingestGift(gift('a'));
    match.resetRound({ preservePending: true });
    const second = hit(match, 'left', 0);
    return { first, second, state: match.snapshot() };
  }
  assert.deepEqual(run(), run());
});
