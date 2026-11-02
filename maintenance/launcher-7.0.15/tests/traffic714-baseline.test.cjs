'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runBaseline, loopback } = require('../tools/qa-traffic714.cjs');

test('7.0.14 actual WS relay: identical 100-step full/gzip/delta workloads and Chrome gift recovery', { timeout: 120000 }, async t => {
  const result = await runBaseline();
  const { modes, workload } = result.traffic;
  for (const mode of Object.values(modes)) {
    assert.equal(mode.exactSnapshots, workload.frames);
    assert.equal(mode.uniqueActivityIds, workload.uniqueActivityIds);
    assert.equal(mode.duplicateDispatches, 0);
    assert.equal(mode.httpResponseBodyBytes, mode.relayCounterBodyBytes);
  }
  assert.equal(modes.gzipDelta.unchangedLeaderboardAvatarBytesInPatches, 0);
  assert.equal(modes.gzipDelta.idle204, 2);
  assert.ok(result.chrome.shippedRendererActivityIdsExactlyOnce > 30);
  assert.equal(result.chrome.duplicateActivityDispatches, 0);
  assert.equal(result.chrome.pendingAtEnd, 0);
  assert.deepEqual(result.chrome.externalRequests, []);
  assert.deepEqual(result.chrome.errors, []);
  t.diagnostic(JSON.stringify({ modes, recovery: result.recovery, chrome: result.chrome }));
});

test('QA request guard rejects external and credential-bearing destinations', () => {
  for (const url of ['https://example.com', 'http://example.com', 'ws://localhost', 'http://user:pass@127.0.0.1/']) {
    assert.throws(() => loopback(url));
  }
  assert.equal(loopback('http://127.0.0.1:1234/').hostname, '127.0.0.1');
});
