'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runSources } = require('../tools/qa-traffic714.cjs');

test('7.0.14 real Chrome sources: 100 rank changes reuse original image URLs; measure reload and second source', { timeout: 90000 }, async t => {
  const result = await runSources();
  assert.equal(result.scoreChanges, 100);
  assert.equal(result.exactSnapshots, 100);
  assert.equal(result.retainedAvatarElements, 9);
  assert.ok(result.imageBodiesByteIdenticalToSource && result.originalHTTPSURLPreservedWithoutRequest);
  assert.deepEqual(result.unchangedImagePublisherRequestsDuringUpdates, []);
  assert.deepEqual(result.externalRequests, []);
  assert.deepEqual(result.errors, []);
  t.diagnostic(JSON.stringify({ firstLoad: result.firstLoad, updates: result.updates, reload: result.reload, secondSource: result.secondSource }));
});
