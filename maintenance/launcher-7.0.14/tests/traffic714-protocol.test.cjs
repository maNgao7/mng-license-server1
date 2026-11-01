'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCustomFixture, verifyImmutableProtocol, record } = require('../tools/qa-traffic714.cjs');

test('7.0.14 actual WS relay: manifest module gzip and hash-named images preserve exact source bytes', { timeout: 30000 }, async t => {
  const fixture = await createCustomFixture();
  t.after(() => fixture.close());
  const result = await verifyImmutableProtocol(fixture);
  assert.equal(result.assets.length, 5);
  assert.ok(result.module.gzipBodyBytes < result.module.identityBodyBytes);
  record('traffic714-protocol.json', { passed: true, at: new Date().toISOString(), synthetic: true, productionRequests: 0,
    measurement: 'Actual loopback relay HTTP response body bytes; no invoice guarantee.', ...result });
  t.diagnostic(JSON.stringify(result));
});
