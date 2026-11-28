'use strict';

// No command may claim success just because the event queue accepted a gift.
// The original game's native adapter must prove each capability separately.
const NATIVE_CAPABILITIES = Object.freeze({
  game: 'Online Boxing 3D Demo',
  buildSha256: '9132d5631f59661f8bde912d6b1e5b9788c24fd7031bb1aa81d16b298b293e67',
  readPhysics: true,
  punchLeft: false,
  punchRight: false,
  healthReadback: false,
  headProjection: false,
  cameraHotkeys: false,
  directMatchStart: true,
  ready: false,
});

function requireNativeAdapter(adapter) {
  const capabilities = adapter?.capabilities;
  if (!capabilities?.ready || !capabilities.punchLeft || !capabilities.punchRight
    || !capabilities.healthReadback || typeof adapter.punch !== 'function') {
    const error = new Error('Orijinal oyunla yumruk bağlantısı henüz doğrulanmadı.');
    error.code = 'NATIVE_ADAPTER_NOT_READY';
    throw error;
  }
  return adapter;
}
module.exports = { NATIVE_CAPABILITIES, requireNativeAdapter };
