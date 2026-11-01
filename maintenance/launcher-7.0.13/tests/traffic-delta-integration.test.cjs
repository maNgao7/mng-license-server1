'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorkload, createFixture, runHttpComparison, runHttpRecovery } = require('../tools/qa-delta-traffic.cjs');

test('real local HTTP/WebSocket relay: identical busy payloads are lossless and gzip+delta reduces bytes', { timeout: 30000 }, async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const workload = buildWorkload();
  assert.deepEqual(buildWorkload(), workload, 'All comparison modes replay exactly the same deterministic workload');
  assert.equal(workload.frames.filter(frame => frame.label === 'reset').length, 1);
  assert.ok(workload.avatarURLBytes.every(bytes => bytes > 1500));
  assert.ok(workload.eventIds.length > workload.historyLimit * 5, 'Burst history must slide many times');
  const report = await runHttpComparison(fixture, workload);
  for (const mode of Object.values(report.modes)) {
    assert.equal(mode.exactSnapshots, workload.frames.length);
    assert.equal(mode.uniqueActivityIds, workload.eventIds.length);
    assert.equal(mode.duplicateDispatches, 0);
    assert.equal(mode.httpResponseBodyBytes, mode.relayCounterBodyBytes);
  }
  assert.equal(report.modes.full.gzipResponses, 0);
  assert.equal(report.modes.gzip.patchResponses, 0);
  assert.equal(report.modes.gzipDelta.idle204, 2);
  assert.equal(report.modes.gzipDelta.unchangedLeaderboardAvatarBytesInPatches, 0, 'Score deltas must reuse large unchanged leaderboard URLs');
  assert.ok(report.modes.gzipDelta.publisherToRelayWebSocketFrameBytes < report.modes.gzip.publisherToRelayWebSocketFrameBytes);
  t.diagnostic(JSON.stringify({ synthetic: true, bill: false, ...report }));
});

test('real local HTTP relay: pending deltas, idle204, dropped response, unknown base, v1 and WebSocket reconnect', { timeout: 20000 }, async t => {
  const fixture = await createFixture();
  t.after(() => fixture.close());
  const result = await runHttpRecovery(fixture);
  assert.equal(result.pendingAtEnd, 0);
  assert.equal(result.idle204BodyBytes, 0);
  assert.ok(result.badBaseFullFallback && result.discardedDeltaRecoveredExactly && result.reconnectFullResync && result.v1Unchanged);
  t.diagnostic(JSON.stringify(result));
});
