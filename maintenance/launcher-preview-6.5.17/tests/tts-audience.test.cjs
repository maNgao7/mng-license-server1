'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpeechAudience } = require('../lib/tts-audience.cjs');

test('selected gift is required; unrelated gift or viewer does not grant speech', () => {
    const audience = createSpeechAudience();const rule = { audience: 'gift', giftId: '7934' };
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: 'viewer', giftId: '5655' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: '@Viewer', giftId: '7934' }, 'host');
    assert.equal(audience.allows({ username: 'VIEWER' }, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'other' }, rule, 'host'), false);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'other-host'), false);
});
test('follow mode uses actual follow events, not joins or profile assertions', () => {
    const audience = createSpeechAudience();const rule = { audience: 'follow' };
    audience.observe('member', { username: 'viewer', isFollower: true }, 'host');
    assert.equal(audience.allows({ username: 'viewer', isFollower: true }, rule, 'host'), false);
    audience.observe('follow', { username: 'viewer' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
    audience.clear();assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
});
test('combined eligibility and bounded viewer records stay isolated', () => {
    const audience = createSpeechAudience({ limit: 2 });const rule = { audience: 'gift-or-follow', giftId: '7934' };
    audience.observe('gift', { username: 'first', giftId: '7934', giftType: 1, repeatEnd: false }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), false);
    audience.observe('gift', { username: 'first', giftId: '7934', giftType: 1, repeatEnd: true }, 'host');
    audience.observe('follow', { username: 'second' }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'second' }, rule, 'host'), true);
    audience.observe('follow', { username: 'third' }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), false);
    assert.equal(audience.allows({ username: 'anyone' }, { audience: 'all' }, 'host'), true);
});

test('gift entitlement lasts for the session and is revoked when the configured gift changes', () => {
    const audience = createSpeechAudience(), rule = { audience: 'gift', giftId: '7934' };
    audience.configure(rule);
    audience.observe('gift', { username: 'viewer', giftId: '7934' }, 'host');
    for (let index = 0; index < 20; index++) assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
    audience.configure({ ...rule, giftId: '5655' });
    assert.equal(audience.allows({ username: 'viewer' }, { ...rule, giftId: '5655' }, 'host'), false);
    audience.configure(rule);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: 'viewer', giftId: '7934' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
});
