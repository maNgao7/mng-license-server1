import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, explain, EventLedger } from './events.js';

test('modern gift schema preserves identity, gift ID and final repeat count', () => {
  const result = normalize('gift', { user: { uniqueId: 'viewer', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/avatar.png'] } }, giftId: 5655, giftDetails: { giftType: 1, diamondCount: 1 }, repeatEnd: true, repeatCount: 5, common: { msgId: '123' } });
  assert.equal(result.giftId, '5655'); assert.equal(result.count, 5); assert.equal(result.username, 'viewer');
  assert.equal(result.profile, 'https://p16.tiktokcdn.com/avatar.png'); assert.equal(result.id, '123');
});
test('unfinished streak never dispatches', () => assert.equal(normalize('gift', { giftDetails: { giftType: 1 }, repeatEnd: false }), null));
test('legacy gift schema still works', () => {
  const result = normalize('gift', { uniqueId: 'legacy', giftId: 1, giftType: 0, repeatCount: 2, diamondCount: 10 });
  assert.equal(result.username, 'legacy'); assert.equal(result.coins, 10);
});

test('avatar lookup skips an empty large avatar and uses the jpeg source', () => {
  const result = normalize('follow', { user: {
    uniqueId: 'viewer', avatarLarge: { urlList: [] },
    avatarJpg: { urlList: ['https://p16.tiktokcdn.com/signed-avatar'] }
  } });
  assert.equal(result.profile, 'https://p16.tiktokcdn.com/signed-avatar');
});
test('likes are incremental, not stream totals', () => assert.equal(normalize('like', { uniqueId:'viewer',likeCount: 7, totalLikeCount: 999 }).count, 7));
test('protobuf displayId is the viewer username', () => assert.equal(normalize('follow', { user: { displayId: 'real_viewer' } }).username, 'real_viewer'));
test('bounded counts and no insecure avatar URLs', () => {
  const result = normalize('like', { uniqueId:'viewer',likeCount: 999999, profilePictureUrl: 'http://localhost/secret' });
  assert.equal(result.count, 10000); assert.equal(result.profile, '');
});
test('flat normalized usernames and nested users remain independent gift teams',()=>{
  const ledger=new EventLedger();
  const a=normalize('gift',{username:'alpha',user:{nickname:'Same name'},giftId:5655,repeatCount:1,msgId:'same'});
  const b=normalize('gift',{username:'beta',user:{nickname:'Same name'},giftId:5655,repeatCount:1,msgId:'same'});
  assert.equal(ledger.accept(a).username,'alpha');assert.equal(ledger.accept(b).username,'beta');
  assert.equal(normalize('gift',{user:{nickname:'Same name',id:'123'},giftId:5655}).username,'izleyici_123');
  assert.equal(normalize('gift',{user:{nickname:'Same name',id:'456'},giftId:5655}).username,'izleyici_456');
  assert.equal(normalize('gift',{user:{nickname:'Same name'},giftId:5655}),null);
});
test('actionable offline, timeout and authorization failures', () => {
  assert.match(explain(new Error('User is offline')), /canlı yayında değil/);
  assert.match(explain(new Error("The requested user isn't online :(")), /canlı yayında değil/);
  assert.match(explain(new Error('timeout')), /yanıt vermedi/);
  assert.match(explain(new Error('401 unauthorized')), /erişimi reddetti/);
});
test('one gift group is delivered once even when TikTok changes the order id', () => {
  const ledger = new EventLedger();
  const sample = orderId => normalize('gift', {
    uniqueId: 'viewer', giftId: 5282, groupId: 'live-group', orderId,
    repeatCount: 1, giftType: 0
  });
  assert.equal(ledger.accept(sample('first')).count, 1);
  assert.equal(ledger.accept(sample('second')), null);
  assert.equal(ledger.accept(normalize('gift', {
    uniqueId: 'viewer', giftId: 5282, groupId: 'next-group', orderId: 'third', repeatCount: 1
  })).count, 1);
});
test('cumulative gift groups dispatch only their incremental difference', () => {
  const ledger = new EventLedger();
  const gift = count => normalize('gift', {
    uniqueId: 'viewer', giftId: 5655, groupId: 'streak', repeatCount: count, giftType: 1, repeatEnd: true
  });
  assert.equal(ledger.accept(gift(2)).count, 2);
  assert.equal(ledger.accept(gift(2)), null);
  assert.equal(ledger.accept(gift(5)).count, 3);
});
