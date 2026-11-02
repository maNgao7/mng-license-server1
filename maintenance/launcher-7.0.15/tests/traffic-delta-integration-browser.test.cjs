'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, runBrowserVerification } = require('../tools/qa-delta-traffic.cjs');

test('Chrome over actual local WebSocket relay: lossless bursts, nine visible rows, gift latency and full recovery', { timeout: 90000 }, async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const result = await runBrowserVerification(fixture);
  assert.equal(result.visibleLeaderboardRows, 9);
  assert.equal(result.duplicateActivityDispatches, 0);
  assert.ok(result.uniqueActivityIds > 60 && result.stableAvatarElements && result.resetClearsVisibleRows);
  assert.ok(result.shippedRendererActivityIdsExactlyOnce > 30);
  assert.ok(result.giftLatencyMs < 1800 && result.giftVisible && result.pkScoreAndExplicitZero);
  assert.ok(result.reconnectFullResync && result.recovery['bad-base'].fullResync && result.recovery['bad-operation'].fullResync);
  assert.equal(result.pendingAtEnd, 0);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.externalRequests, []);
  t.diagnostic(JSON.stringify({ synthetic: true, bill: false, ...result }));
});
