'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runCustom } = require('../tools/qa-traffic714.cjs');

test('7.0.14 real Chrome/WS: 100 gift changes per custom frame retain scene and immutable assets', { timeout: 180000 }, async t => {
  const result = await runCustom();
  for (const style of Object.values(result.styles)) {
    assert.equal(style.scoreGiftChanges, 100);
    assert.equal(style.uniqueGiftDispatches, 100);
    assert.equal(style.duplicateGiftDispatches, 0);
    assert.ok(style.stableCanvas && style.stableHost);
    assert.equal(style.newWebGLContextsDuringUpdates, 0);
    assert.deepEqual(style.publisherAssetRequestsDuringUpdates, []);
    assert.ok(Array.isArray(style.reloadImmutablePublisherRequests));
    assert.ok(Array.isArray(style.reloadImmutableDownloads));
  }
  assert.equal(result.productionRequests, 0);
  assert.deepEqual(result.externalRequests, []);
  assert.deepEqual(result.errors, []);
  t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(result.styles).map(([kind, row]) => [kind, { initial: row.initial, updates: row.updates, reload: row.reload }]))));
});
