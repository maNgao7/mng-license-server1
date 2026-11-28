'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AudienceQueue } = require('../src/audience-queue.cjs');
let sequence = 0;
const event = (userId, extra = {}) => ({ userId, eventId: 'like-rule-' + (++sequence), ...extra });
const like = (userId, likeCount) => event(userId, { likeCount, isDelta: true });
function fixture(settings = {}) {
  const queue = new AudienceQueue({ kingOfRing: true, settings: { punchSource: 'all', ...settings } });
  for (const user of ['red', 'blue']) queue.ingestChat(event(user, { comment: 'katıl' }));
  return queue;
}

test('fresh rules default to 100 personal likes for two punches with independent per-punch damage', () => {
  const defaults = new AudienceQueue().snapshot().settings;
  assert.deepEqual([defaults.punchSource, defaults.likeThreshold, defaults.likePunchCount, defaults.likeDamage], ['gift', 100, 2, 15]);
  const queue = fixture();
  assert.deepEqual(queue.ingestLike(like('red', 99)).actions, []);
  queue.startRound();
  assert.deepEqual(queue.ingestLike(like('red', 99)).actions, []);
  assert.deepEqual(queue.ingestLike(like('blue', 99)).actions, []);
  const packet = like('red', 1);
  const [action] = queue.ingestLike(packet).actions;
  assert.deepEqual([action.side, action.count, action.damage], ['right', 2, 15]);
  assert.equal(queue.ingestLike(packet).reason, 'duplicate-event');
  assert.equal(queue.ingestLike(like('red', 250)).actions[0].count, 4);
  queue.configure({ likeDamage: 7 });
  const [next] = queue.ingestLike(like('red', 50)).actions;
  assert.deepEqual([next.count, next.damage], [2, 7]);
  assert.equal(queue.ingestLike(like('blue', 1)).actions[0].count, 2);
});

test('saved one-punch and custom multipliers survive unrelated saves and settings reloads', () => {
  for (const [likeThreshold, likePunchCount] of [[10, 1], [42, 7]]) {
    const queue = fixture({ likeThreshold, likePunchCount, likeDamage: 11 });
    const saved = queue.configure({ followJoin: true, giftDamage: { '5655': 23 } }).settings;
    const restored = new AudienceQueue({ kingOfRing: true, settings: JSON.parse(JSON.stringify(saved)) });
    assert.deepEqual(restored.snapshot().settings, saved);
    assert.deepEqual([saved.likeThreshold, saved.likePunchCount, saved.likeDamage], [likeThreshold, likePunchCount, 11]);
    queue.startRound();
    const [action] = queue.ingestLike(like('red', likeThreshold)).actions;
    assert.deepEqual([action.count, action.damage], [likePunchCount, 11]);
  }
});

test('changing punch count clears both fighters punch remainders but preserves entry, queue FPS and event history', () => {
  const queue = fixture({ likeJoin: true, likeJoinThreshold: 5 });
  queue.startRound();
  const prior = like('red', 99);
  queue.ingestLike(prior);
  queue.ingestLike(like('blue', 99));
  queue.ingestLike(like('waiting', 4));
  queue.configure({ likePunchCount: 3 });
  assert.equal(queue.ingestLike(prior).reason, 'duplicate-event');
  for (const user of ['red', 'blue']) {
    const result = queue.ingestLike(like(user, 1));
    assert.deepEqual(result.actions, []);
    assert.equal(result.addedFps, 1);
    assert.equal(queue.ingestLike(like(user, 99)).actions[0].count, 3);
  }
  assert.equal(queue.ingestLike(like('waiting', 1)).joined, true);
  assert.equal(queue.snapshot().queue[0].userId, 'waiting');
});

test('unchanged punch count and unrelated saves preserve the current threshold remainder', () => {
  const queue = fixture();
  queue.startRound();
  queue.ingestLike(like('red', 99));
  queue.configure({ likePunchCount: 2, likeDamage: 23, followJoin: true });
  const [action] = queue.ingestLike(like('red', 1)).actions;
  assert.deepEqual([action.count, action.damage], [2, 23]);
});

test('punch count validation is atomic, accepts 1 and 100, and bounds huge batches', () => {
  const queue = fixture();
  queue.startRound();
  queue.ingestLike(like('red', 99));
  const before = queue.snapshot();
  for (const value of [0, -1, 1.5, 101, '2', null, NaN, Infinity]) {
    assert.throws(() => queue.configure({ likeThreshold: 7, likePunchCount: value, likeDamage: 9 }), RangeError);
    assert.deepEqual(queue.snapshot(), before);
  }
  assert.equal(queue.ingestLike(like('red', 1)).actions[0].count, 2);
  for (const count of [1, 100]) {
    queue.configure({ likePunchCount: count });
    assert.equal(queue.ingestLike(like('red', 100)).actions[0].count, count);
  }
  assert.equal(queue.ingestLike(like('red', Number.MAX_SAFE_INTEGER)).actions[0].count, 1_000_000);
});
