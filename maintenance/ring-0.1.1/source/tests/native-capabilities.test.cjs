'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { NATIVE_CAPABILITIES, requireNativeAdapter } = require('../src/native-capabilities.cjs');
test('read-only native probe cannot be mistaken for working combat integration', () => {
  assert.equal(NATIVE_CAPABILITIES.readPhysics, true);
  assert.equal(NATIVE_CAPABILITIES.ready, false);
  assert.throws(() => requireNativeAdapter({ capabilities: NATIVE_CAPABILITIES }),
    { code: 'NATIVE_ADAPTER_NOT_READY' });
});
test('both punches and real health readback are required before dispatching gifts', () => {
  const adapter = { punch() {}, capabilities: { ready: true, punchLeft: true, punchRight: false, healthReadback: true } };
  assert.throws(() => requireNativeAdapter(adapter), { code: 'NATIVE_ADAPTER_NOT_READY' });
  adapter.capabilities.punchRight = true;
  assert.equal(requireNativeAdapter(adapter), adapter);
});
