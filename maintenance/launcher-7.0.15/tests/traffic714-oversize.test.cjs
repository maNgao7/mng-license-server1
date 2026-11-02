'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runOversize } = require('../tools/qa-traffic714.cjs');

test('7.0.14 actual HTTP/WS and Chrome: roughly 750 KiB snapshots still negotiate lossless score/gift deltas', { timeout: 60000 }, async t => {
  const result = await runOversize();
  assert.ok(result.snapshotJsonBytes.min > 512 * 1024);
  assert.ok(result.traffic.modes.gzipDelta.patchResponses > 0);
  assert.ok(result.chrome.patchResponses > 0);
  assert.equal(result.chrome.uniqueGiftIds, result.traffic.workload.uniqueActivityIds);
  assert.equal(result.chrome.duplicateGiftDispatches, 0);
  t.diagnostic(JSON.stringify({ snapshotJsonBytes: result.snapshotJsonBytes, modes: result.traffic.modes, chrome: result.chrome }));
});
