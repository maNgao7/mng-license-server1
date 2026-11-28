'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AudienceQueue } = require('../src/audience-queue.cjs');
let sequence = 0;
const event = (name, extra = {}) => ({ userId: name, uniqueId: name, eventId: `maintenance-${++sequence}`, ...extra });
const chat = name => event(name, { comment: 'katıl' });
const like = (name, count, extra) => event(name, { likeCount: count, isDelta: true, ...extra });
const gift = (name, count = 1, extra) => event(name, { giftId: '5655', coinUnit: 1, repeatCount: count, ...extra });
const ids = q => q.snapshot().queue.map(user => user.id);
function fixture(settings = {}) {
  let now = 0;
  const q = new AudienceQueue({ kingOfRing: true, clock: () => now,
    settings: { likeJoin: true, followJoin: true, likeJoinThreshold: 100, ...settings } });
  q.ingestChat(chat('red')); q.ingestChat(chat('blue'));
  return { q, at: value => { now = value; } };
}

for (const winner of ['left', 'right']) test(`${winner} winner keeps FPS; loser resets every priority and rejoins the tail once`, () => {
  const { q } = fixture();
  const loser = winner === 'left' ? 'red' : 'blue';
  const winnerId = winner === 'left' ? 'blue' : 'red';
  for (const name of ['red', 'blue']) {
    q.ingestGift(gift(name, 20)); q.ingestLike(like(name, 299)); q.ingestFollow(event(name));
  }
  const streak = gift(loser, 3, { giftType: 1, streakId: 'defeated-streak' });
  q.ingestGift(streak);
  q.ingestChat(chat('early')); q.ingestGift(gift('next', 10));
  q.startRound();
  const state = q.finishRound(winner);
  assert.equal(state.active[winner].id, winnerId);
  assert.equal(state.active[winner].fps, 27);
  assert.deepEqual(ids(q), ['early', loser]);
  assert.deepEqual(['fps', 'coins', 'likeFps', 'followFps'].map(key => state.queue[1][key]), [0, 0, 0, 0]);
  assert.ok(state.queue[1].joinOrder > state.queue[0].joinOrder);
  assert.deepEqual(q.finishRound(winner), state, 'Repeated KO must not reset/rejoin twice');
  assert.equal(q.ingestGift(streak).reason, 'duplicate-event');
  assert.equal(q.ingestGift({ ...streak, eventId: `old-final-${winner}`, repeatEnd: true }).delta, 0);
  assert.equal(q.ingestFollow(event(loser)).addedFps, 0, 'Resetting priority cannot farm the one-time follow bonus');
  assert.equal(q.ingestLike(like(loser, 99)).addedFps, 0, 'Old rank remainder was cleared');
  assert.equal(q.ingestLike(like(loser, 1)).addedFps, 1);
  assert.deepEqual(ids(q), [loser, 'early']);
  q.ingestGift({ ...streak, eventId: `fresh-continuation-${winner}`, repeatCount: 5 });
  assert.equal(q.snapshot().queue[0].fps, 3, 'Only the two new streak units earn FPS');
});

test('defeat with no challenger queues at zero and requires another manual start', () => {
  const { q } = fixture(); q.startRound();
  const state = q.finishRound('right');
  assert.equal(state.phase, 'staging'); assert.equal(state.active.left, null);
  assert.deepEqual(ids(q), ['blue']);
  assert.equal(q.startRound().accepted, false);
  q.ingestChat(chat('blue'));
  assert.equal(q.startRound().accepted, true);
  assert.equal(q.snapshot().active.left.id, 'blue');
});

for (const source of ['gift', 'like', 'chat']) test(`solo winner plus queued loser fills on fresh ${source} activity and reports joined for native staging`, () => {
  const { q } = fixture({ participationMode: 'chat', likeJoin: false });
  const oldGift = gift('blue', 5, { giftType: 1, streakId: 'before-ko' });
  const oldLike = like('blue', 199);
  q.ingestGift(oldGift); q.ingestLike(oldLike); q.startRound(); q.finishRound('right');
  assert.equal(q.snapshot().active.left, null); assert.deepEqual(ids(q), ['blue']);
  assert.equal(q.ingestGift(oldGift).reason, 'duplicate-event');
  assert.equal(q.ingestLike(oldLike).reason, 'duplicate-event');
  assert.equal(q.ingestGift({ ...oldGift, eventId: `old-final-${source}`, repeatEnd: true }).delta, 0);
  assert.equal(q.snapshot().active.left, null, 'Old activity must not fill a vacancy');
  const result = source === 'gift' ? q.ingestGift(gift('blue', 3)) : source === 'like'
    ? q.ingestLike(like('blue', 100)) : q.ingestChat(chat('blue'));
  assert.equal(result.joined, true, 'Normal host uses joined to synchronize native lineup');
  assert.deepEqual(result.actions, [], 'Staging activity cannot punch before P');
  assert.deepEqual(q.lineup(), [true, true]);
  assert.equal(q.snapshot().active.left.id, 'blue'); assert.equal(q.snapshot().active.left.fps, source === 'gift' ? 3 : source === 'like' ? 1 : 0);
  assert.equal(q.snapshot().phase, 'staging'); assert.equal(q.snapshot().round, 1);
  assert.equal(q.startRound().accepted, true);
});

test('like-only waiter expires at exactly 60 seconds; replay cannot restore entry or partial rank', () => {
  const { q, at } = fixture();
  const packet = like('liker', 199); q.ingestLike(packet);
  at(59_999); assert.deepEqual(q.expireInactiveLikes(), { changed: false, count: 0 });
  at(60_000); assert.deepEqual(q.expireInactiveLikes(), { changed: true, count: 1 });
  assert.deepEqual(ids(q), []);
  assert.equal(q.ingestLike(packet).reason, 'duplicate-event');
  for (const flag of ['initial', 'isInitial', 'replay', 'isReplay', 'isTest']) q.ingestLike(like('liker', 100, { [flag]: true }));
  assert.deepEqual(ids(q), []);
  assert.equal(q.ingestLike(like('liker', 99)).joined, false);
  assert.equal(q.ingestLike(like('liker', 1)).joined, true);
  assert.equal(q.snapshot().queue[0].fps, 1);
  assert.deepEqual(q.expireInactiveLikes(), { changed: false, count: 0 });
});

test('expiry removes only like-only waiters and preserves gift/follow priority, plain joins and fighters', () => {
  const { q, at } = fixture();
  q.ingestChat(chat('plain'));
  q.ingestGift(gift('gifted', 10)); q.ingestLike(like('gifted', 299));
  q.ingestFollow(event('followed')); q.ingestLike(like('followed', 199));
  q.ingestLike(like('like-only', 399)); q.ingestLike(like('red', 500));
  q.startRound();
  at(59_999);
  q.ingestChat(event('gifted', { comment: 'hello' })); q.ingestGift(gift('gifted'));
  q.ingestLike(like('other-viewer', 100));
  at(60_000);
  assert.deepEqual(q.expireInactiveLikes(), { changed: true, count: 3 });
  assert.deepEqual(q.snapshot().queue.map(user => [user.id, user.fps]),
    [['gifted', 11], ['followed', 5], ['other-viewer', 1], ['plain', 0]]);
  assert.equal(q.snapshot().active.right.fps, 5, 'Active fighters do not expire');
  assert.equal(q.snapshot().phase, 'active');
  assert.equal(q.ingestLike(like('gifted', 1)).addedFps, 0, 'Mixed waiter loses its stale remainder too');
  assert.equal(q.ingestFollow(event('followed')).addedFps, 0);
  assert.deepEqual(q.expireInactiveLikes(), { changed: false, count: 0 });
});

test('only new personal real deltas refresh inactivity; even a sub-FPS delta refreshes', () => {
  const { q, at } = fixture();
  const packet = like('stale', 100); q.ingestLike(packet); q.ingestLike(like('fresh', 100));
  at(59_999);
  q.ingestLike(packet);
  for (const extra of [{ isDelta: false }, { isTest: true }, { initial: true }, { replay: true },
    { likeCount: 0 }, { likeCount: 1.5 }, { likeCount: undefined, totalLikeCount: 10000 }]) q.ingestLike(like('stale', 100, extra));
  assert.equal(q.ingestLike(like('fresh', 1)).addedFps, 0);
  at(60_000); assert.equal(q.expireInactiveLikes().count, 1);
  assert.deepEqual(ids(q), ['fresh']);
  at(119_998); assert.equal(q.expireInactiveLikes().changed, false);
  at(119_999); assert.equal(q.expireInactiveLikes().changed, true);
});

test('fresh likes arriving before a delayed sweep cannot reuse expired rank or join credit', () => {
  const { q, at } = fixture(); q.ingestLike(like('viewer', 199));
  at(60_000);
  const result = q.ingestLike(like('viewer', 99));
  assert.equal(result.joined, false); assert.equal(result.addedFps, 0); assert.equal(result.rosterChanged, true);
  assert.deepEqual(ids(q), []);
  assert.equal(q.ingestLike(like('viewer', 1)).joined, true);
  assert.equal(q.snapshot().queue[0].fps, 1);
  q.configure({ likeJoin: false }); at(120_000);
  assert.equal(q.ingestLike(like('viewer', 100)).rosterChanged, true);
  assert.deepEqual(ids(q), []);
});

test('manual removal accepts snapshot id/userId after identity promotion, clears priority and preserves dedupe', () => {
  const { q } = fixture();
  q.ingestLike({ uniqueId: 'viewer', eventId: 'handle-before-removal', likeCount: 199 });
  q.ingestLike(event('12345', { uniqueId: 'viewer', likeCount: 1 }));
  const packet = gift('12345', 5, { uniqueId: 'viewer', giftType: 1, streakId: 'removed-streak' });
  q.ingestGift(packet); q.ingestFollow(event('12345', { uniqueId: 'viewer' }));
  const profile = q.snapshot().queue[0]; assert.equal(profile.id, '12345');
  assert.deepEqual(q.removeWaiting(profile.id), { accepted: true });
  assert.deepEqual(q.removeWaiting(profile.userId), { accepted: false });
  assert.deepEqual(ids(q), []);
  assert.equal(q.ingestGift(packet).reason, 'duplicate-event');
  assert.equal(q.ingestGift({ ...packet, eventId: 'removed-final', repeatEnd: true }).delta, 0);
  assert.deepEqual(ids(q), []);
  q.ingestChat(event('12345', { uniqueId: 'viewer', comment: 'hello' }));
  assert.deepEqual(ids(q), []);
  assert.equal(q.ingestLike(event('12345', { uniqueId: 'viewer', likeCount: 99 })).joined, false);
  assert.equal(q.ingestLike(event('12345', { uniqueId: 'viewer', likeCount: 1 })).joined, true);
  assert.equal(q.snapshot().queue[0].fps, 1);
  assert.equal(q.ingestFollow(event('12345', { uniqueId: 'viewer' })).addedFps, 0);
  assert.deepEqual(q.removeWaiting('@VIEWER'), { accepted: true });
});

test('manual removal never removes staged/active fighters or unknown keys and leaves punch remainders intact', () => {
  const { q } = fixture({ punchSource: 'like', likeThreshold: 100, likePunchCount: 1 });
  q.ingestChat(chat('waiting')); q.ingestLike(like('waiting', 199));
  for (const key of ['red', 'blue', '@RED', '', null, undefined, {}, NaN, 'absent'])
    assert.deepEqual(q.removeWaiting(key), { accepted: false });
  q.startRound(); q.ingestLike(like('red', 99));
  const before = q.snapshot();
  assert.equal(q.removeWaiting('red').accepted, false); assert.deepEqual(q.snapshot(), before);
  assert.equal(q.removeWaiting('waiting').accepted, true);
  assert.equal(q.ingestLike(like('red', 1)).actions[0].count, 1);
});

test('removal keeps a retained streak high-water mark even after the event cache evicts its ID', () => {
  const q = new AudienceQueue({ kingOfRing: true, eventCacheSize: 2 });
  q.ingestChat(chat('red')); q.ingestChat(chat('blue'));
  const packet = gift('viewer', 30, { giftType: 1, streakId: 'retained' }); q.ingestGift(packet);
  assert.equal(q.removeWaiting('viewer').accepted, true);
  q.ingestChat(chat('first')); q.ingestChat(chat('second'));
  assert.equal(q.ingestGift(packet).delta, 0);
  assert.deepEqual(ids(q), ['first', 'second']);
  q.ingestGift({ ...packet, eventId: 'new-units', repeatCount: 31 });
  assert.deepEqual(q.snapshot().queue.map(user => [user.id, user.fps]), [['viewer', 1], ['first', 0], ['second', 0]]);
});

test('explicit expiry times are validated atomically and legacy queues retain their behavior', () => {
  const { q } = fixture(); q.ingestLike(like('viewer', 100)); const before = q.snapshot();
  for (const now of [-1, NaN, Infinity, '60000', null]) {
    assert.throws(() => q.expireInactiveLikes(now), RangeError); assert.deepEqual(q.snapshot(), before);
  }
  assert.equal(q.expireInactiveLikes(60_000).changed, true);
  assert.throws(() => new AudienceQueue({ clock: 1 }), TypeError);
  const legacy = new AudienceQueue();
  for (const name of ['one', 'two', 'waiting']) legacy.ingestChat(chat(name));
  assert.deepEqual(legacy.expireInactiveLikes(60_000), { changed: false, count: 0 });
  assert.equal(legacy.removeWaiting('waiting').accepted, true);
});
