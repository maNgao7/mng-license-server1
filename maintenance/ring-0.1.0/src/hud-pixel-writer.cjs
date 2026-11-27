'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HEADER_BYTES = 64;
const MAX_WIDTH = 3840, MAX_HEIGHT = 2160;
const MAGIC = 0x48474e4d;
// One producer and one native reader. An odd sequence marks an incomplete frame.
// Drop busy frames instead of letting painting build an unbounded upload queue.
function createHudPixelWriter({ directory = os.tmpdir(), onError = () => {} } = {}) {
  const folder = fs.mkdtempSync(path.join(directory, 'tikmng-hud-'));
  const file = path.join(folder, 'frame.bgra');
  const fd = fs.openSync(file, 'wx+');
  fs.ftruncateSync(fd, HEADER_BYTES + MAX_WIDTH * MAX_HEIGHT * 4);
  const initial = Buffer.alloc(HEADER_BYTES);
  initial.writeUInt32LE(MAGIC, 0); initial.writeUInt32LE(1, 4);
  fs.writeSync(fd, initial, 0, initial.length, 0);
  let sequence = 0, busy = false, closed = false, inFlight = Promise.resolve();
  async function writeAll(buffer, offset) {
    let written = 0;
    while (written < buffer.length) {
      const size = await new Promise((resolve, reject) => fs.write(fd, buffer, written,
        buffer.length - written, offset + written, (error, count) => error ? reject(error) : resolve(count)));
      if (!size) throw new Error('Oyun göstergeleri yazılamadı.');
      written += size;
    }
  }
  function publish(width, height, pixels) {
    if (closed || busy) return false;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > MAX_WIDTH || height > MAX_HEIGHT || !Buffer.isBuffer(pixels) || pixels.length !== width * height * 4) {
      throw new TypeError('Geçersiz oyun gösterge karesi.');
    }
    busy = true;
    sequence = (sequence + 2) >>> 0;
    const header = Buffer.from(initial);
    header.writeUInt32LE(sequence | 1, 8);
    header.writeUInt32LE(width, 12); header.writeUInt32LE(height, 16);
    header.writeUInt32LE(width * 4, 20); header.writeBigUInt64LE(BigInt(Date.now()), 24);
    inFlight = (async () => {
      await writeAll(header, 0);
      await writeAll(pixels, HEADER_BYTES);
      const committed = Buffer.allocUnsafe(4); committed.writeUInt32LE(sequence, 0);
      await writeAll(committed, 8);
    })().catch(onError).finally(() => { busy = false; });
    return true;
  }
  return {
    file, publish, get busy() { return busy; },
    async flush() { await inFlight; },
    async close() {
      if (closed) return; closed = true;
      await inFlight;
      fs.closeSync(fd);
      fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    },
  };
}
module.exports = { createHudPixelWriter, HEADER_BYTES, MAX_WIDTH, MAX_HEIGHT, MAGIC };
