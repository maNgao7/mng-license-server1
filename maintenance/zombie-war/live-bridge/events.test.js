import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, explain } from './events.js';

test('modern gift schema preserves identity, gift ID and final repeat count', () => {
  const result = normalize('gift', { user: { uniqueId: 'viewer', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/avatar.png'] } }, giftId: 5655, giftDetails: { giftType: 1, diamondCount: 1 }, repeatEnd: true, repeatCount: 5, common: { msgId: '123' } });
  assert.equal(result.giftId, '5655'); assert.equal(result.count, 5); assert.equal(result.username, 'viewer');
  assert.equal(result.profile, 'https://p16.tiktokcdn.com/avatar.png'); assert.equal(result.id, '123');
});
test('unfinished streak preserves cumulative metadata for the ledger', () => {
  const event = normalize('gift', { giftDetails: { giftType: 1 }, groupId: 'group', repeatEnd: false });
  assert.equal(event.streak, true); assert.equal(event.repeatEnd, false); assert.equal(event.groupId, 'group');
});
test('legacy gift schema still works', () => {
  const result = normalize('gift', { uniqueId: 'legacy', giftId: 1, giftType: 0, repeatCount: 2, diamondCount: 10 });
  assert.equal(result.username, 'legacy'); assert.equal(result.coins, 10);
});
test('likes are incremental, not stream totals', () => assert.equal(normalize('like', { likeCount: 7, totalLikeCount: 999 }).count, 7));
test('protobuf displayId is the viewer username', () => assert.equal(normalize('follow', { user: { displayId: 'real_viewer' } }).username, 'real_viewer'));
test('bounded counts and no insecure avatar URLs', () => {
  const result = normalize('like', { likeCount: 999999, profilePictureUrl: 'http://localhost/secret' });
  assert.equal(result.count, 10000); assert.equal(result.profile, '');
});
test('actionable offline, timeout and authorization failures', () => {
  assert.match(explain(new Error('User is offline')), /canlı yayında değil/);
  assert.match(explain(new Error("The requested user isn't online :(")), /canlı yayında değil/);
  assert.match(explain(new Error('timeout')), /yanıt vermedi/);
  assert.match(explain(new Error('401 unauthorized')), /erişimi reddetti/);
});
