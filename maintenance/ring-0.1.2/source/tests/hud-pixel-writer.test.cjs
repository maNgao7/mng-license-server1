'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHudPixelWriter, HEADER_BYTES, MAGIC } = require('../src/hud-pixel-writer.cjs');

test('native HUD commits complete BGRA frames and drops busy frames without a backlog', async () => {
  const errors = [];
  const writer = createHudPixelWriter({ onError: error => errors.push(error) });
  const file = writer.file;
  try {
    const pixels = Buffer.from([20, 40, 60, 128, 0, 0, 0, 0]);
    assert.equal(writer.publish(2, 1, pixels), true);
    assert.equal(writer.publish(2, 1, Buffer.alloc(8)), false);
    await writer.flush();
    const fd = fs.openSync(file, 'r');
    const bytes = Buffer.alloc(HEADER_BYTES + pixels.length);
    fs.readSync(fd, bytes); fs.closeSync(fd);
    assert.equal(bytes.readUInt32LE(0), MAGIC);
    assert.equal(bytes.readUInt32LE(4), 1);
    assert.equal(bytes.readUInt32LE(8), 2);
    assert.deepEqual([12, 16, 20].map(offset => bytes.readUInt32LE(offset)), [2, 1, 8]);
    assert.deepEqual(bytes.subarray(HEADER_BYTES), pixels);
    assert.equal(writer.publish(1, 1, pixels.subarray(0, 4)), true);
    await writer.flush();
    assert.deepEqual(errors, []);
  } finally { await writer.close(); }
  assert.equal(fs.existsSync(file), false);
  assert.equal(writer.publish(1, 1, Buffer.alloc(4)), false);
});

test('native HUD rejects unsafe dimensions and truncated frames before writing', async () => {
  const writer = createHudPixelWriter();
  try {
    for (const [width, height, pixels] of [[0, 10, Buffer.alloc(0)], [3841, 1, Buffer.alloc(0)],
      [1, 2161, Buffer.alloc(0)], [1, 1, Buffer.alloc(3)], [1.5, 1, Buffer.alloc(4)]]) {
      assert.throws(() => writer.publish(width, height, pixels), TypeError);
    }
  } finally { await writer.close(); }
});
