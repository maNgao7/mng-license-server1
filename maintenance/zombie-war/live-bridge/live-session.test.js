import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { LiveSession } from './live-session.js';

function harness(timeoutMs = 200) {
  const connections = [], published = [];
  const session = new LiveSession(username => {
    const connection = new EventEmitter();
    connection.username = username;
    connection.pending = new Promise((resolve, reject) => { connection.finish = resolve; connection.fail = reject; });
    connection.connect = () => connection.pending;
    connection.disconnect = () => { connection.stopped = true; };
    connections.push(connection);
    return connection;
  }, [['gift', 'gift'], ['like', 'like'], ['follow', 'follow']], event => published.push(event), timeoutMs);
  return { session, connections, published };
}

test('startup is disconnected until a specific username is requested', () => {
  const h = harness();
  assert.equal(h.session.snapshot().username, '');
  assert.equal(h.session.snapshot().state, 'disconnected');
  assert.equal(h.connections.length, 0);
});

test('switching broadcaster ignores old events and a late connection completion', async () => {
  const h = harness();
  const first = h.session.connect('old_streamer', 'session-a');
  const a = h.connections[0];
  const second = h.session.connect('new_streamer', 'session-b');
  const b = h.connections[1];
  b.finish(); await second;
  a.finish(); await first;
  a.emit('gift', { giftId: 5655, repeatCount: 5 });
  a.emit('disconnected');
  a.emit('error', new Error('late error'));
  b.emit('gift', { giftId: 5655, repeatCount: 2, user: { uniqueId: 'viewer', avatarThumb: { urlList: ['https://example.com/profile.jpg'] } } });
  const gifts = h.published.filter(event => event.type === 'gift');
  assert.equal(a.stopped, true);
  assert.equal(h.session.snapshot().username, 'new_streamer');
  assert.equal(h.session.snapshot().state, 'connected');
  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].streamer, 'new_streamer');
  assert.equal(gifts[0].session, 'session-b');
  assert.equal(gifts[0].giftId, '5655');
  assert.equal(gifts[0].count, 2);
  assert.equal(gifts[0].profile, 'https://example.com/profile.jpg');
  h.session.disconnect();
});

test('manual disconnect cancels an in-flight connect and rejects all late events', async () => {
  const h = harness();
  const pending = h.session.connect('streamer', 'session-a');
  h.session.disconnect();
  h.connections[0].finish(); await pending;
  h.connections[0].emit('follow', { uniqueId: 'viewer' });
  assert.equal(h.session.snapshot().state, 'disconnected');
  assert.equal(h.session.snapshot().username, '');
  assert.equal(h.session.snapshot().session, '');
  assert.equal(h.published.filter(event => event.type === 'follow').length, 0);
});

test('failed or timed-out connections never schedule a reconnect', async () => {
  const h = harness(10);
  const pending = h.session.connect('offline', 'failed');
  h.connections[0].fail(new Error('User is offline')); await pending;
  assert.equal(h.session.snapshot().state, 'error');
  assert.match(h.session.snapshot().message, /canlı yayında değil/);
  await h.session.connect('timeout', 'timed-out');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(h.connections.length, 2);
  assert.equal(h.session.snapshot().state, 'error');
  assert.equal(h.session.timer, undefined);
});

test('like batches are never discarded when TikTok reuses a message ID', async () => {
  const h = harness();
  const pending = h.session.connect('first', 'a');
  h.connections[0].finish(); await pending;
  const event = { likeCount: 1, common: { msgId: 'same-id' }, uniqueId: 'viewer' };
  h.connections[0].emit('like', event); h.connections[0].emit('like', event);
  assert.equal(h.published.filter(event => event.type === 'like').length, 2);
  const ids = h.published.filter(event => event.type === 'like').map(event => event.dispatchId);
  assert.equal(new Set(ids).size, 2);
  h.session.disconnect();
});

test('duplicate gift callback is published once but separate gifts remain separate', async () => {
  const h = harness();
  const pending = h.session.connect('streamer', 'a');
  h.connections[0].finish(); await pending;
  const duplicate = { giftId: 5655, repeatCount: 1, common: { msgId: 'gift-1' }, uniqueId: 'viewer' };
  h.connections[0].emit('gift', duplicate);
  h.connections[0].emit('gift', duplicate);
  h.connections[0].emit('gift', { ...duplicate, common: { msgId: 'gift-2' } });
  const gifts = h.published.filter(event => event.type === 'gift');
  assert.equal(gifts.length, 2);
  assert.equal(new Set(gifts.map(event => event.dispatchId)).size, 2);
  h.session.disconnect();
});

test('transport disconnect and errors stop the session without reconnecting', async () => {
  const h = harness();
  const pending = h.session.connect('streamer', 'a');
  h.connections[0].finish(); await pending;
  h.connections[0].emit('disconnected');
  h.connections[0].emit('follow', { uniqueId: 'late' });
  assert.equal(h.connections[0].stopped, true);
  assert.equal(h.session.snapshot().state, 'disconnected');
  assert.equal(h.session.timer, undefined);
  assert.equal(h.published.filter(event => event.type === 'follow').length, 0);
});
