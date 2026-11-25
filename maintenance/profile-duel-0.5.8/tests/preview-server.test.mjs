import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../src/server.mjs';

test('local preview serves the overlay and scores repeated synthetic event IDs once', async () => {
  const preview = await createPreviewServer({ port: 0 });
  try {
    const health = await fetch(`${preview.baseUrl}/api/health`).then(response => response.json());
    assert.equal(health.mode, 'synthetic-preview');
    assert.equal(health.sessionOwner, 'launcher-only');

    const overlay = await fetch(`${preview.baseUrl}/widget`);
    assert.equal(overlay.status, 200);
    assert.match(await overlay.text(), /Sol oyuncu/);

    const startResponse = await fetch(`${preview.baseUrl}/api/preview/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: { username: 'kanal' }, opponent: { username: 'rakip' }, durationSeconds: 60 }),
    });
    assert.equal(startResponse.status, 200);

    const gift = {
      eventId: 'synthetic-gift-1', username: 'rakip', giftId: 'preview-tiktok', giftName: 'TikTok',
      giftType: 1, repeatEnd: true, repeatCount: 100, coins: 100,
    };
    for (let index = 0; index < 2; index++) {
      const response = await fetch(`${preview.baseUrl}/api/preview/event`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gift),
      });
      assert.equal(response.status, 200);
    }
    const unrelated = await fetch(`${preview.baseUrl}/api/preview/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'synthetic-unrelated', giftId: 'galaxy', giftName: 'Galaxy', coins: 500 }),
    });
    assert.equal(unrelated.status, 200);
    const finalState = await fetch(`${preview.baseUrl}/api/state`).then(response => response.json());
    assert.deepEqual(finalState.scores, { left: 0, right: 100 });
    assert.equal(finalState.owner.username, 'kanal');
    assert.equal(finalState.opponent.username, 'rakip');
  } finally {
    await preview.close();
  }
});
