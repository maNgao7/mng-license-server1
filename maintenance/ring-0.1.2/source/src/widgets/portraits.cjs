'use strict';
const { createHash } = require('node:crypto');
const { open, realpath } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 32;

// Only the two existing live-client cache layouts can supply local images.
// Browser requests never supply a file path, owner URL or bearer credential.
function cacheFile(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:' || url.host || url.search || url.hash) return '';
    const file = fileURLToPath(url);
    const parts = path.relative(os.tmpdir(), file).split(path.sep);
    const owner = parts.length === 2 && /^hediye-box-portraits-[\w-]+$/.test(parts[0])
      && /^[a-f0-9]{64}\.(?:jpg|png|webp|gif)$/.test(parts[1]);
    const forza = path.dirname(file) === path.resolve('control/live/portraits')
      && /^tiktok-bridge-avatar-[a-f0-9]{64}\.png$/.test(path.basename(file));
    return owner || forza ? file : '';
  } catch { return ''; }
}

function imageMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'image/gif';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function createWidgetPortraits(onChange) {
  const entries = new Map();
  async function load(value, file, entry) {
    let handle;
    try {
      // Recheck the resolved path so a cache symlink cannot expose other files.
      const resolved = await realpath(file);
      if (!cacheFile(pathToFileURL(resolved).href)) return;
      handle = await open(resolved, 'r');
      const stat = await handle.stat();
      if (!stat.isFile() || !stat.size || stat.size > MAX_BYTES) return;
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length !== stat.size) return;
      const bytes = buffer.subarray(0, length), mime = imageMime(bytes);
      if (!mime || entries.get(value) !== entry) return;
      entry.bytes = bytes;
      entry.mime = mime;
      const digest = createHash('sha256').update(bytes).digest('hex');
      entry.id = [digest.slice(0, 8), digest.slice(8, 12), digest.slice(12, 16), digest.slice(16, 20), digest.slice(20, 32)].join('-');
      // Reuse the server's existing private portrait asset/cache contract.
      entry.url = '../gift-assets/portrait-' + entry.id + '.png';
      onChange();
    } catch {
      // A pending/missing image never blocks state or loses the HTTPS fallback.
    } finally {
      await handle?.close().catch(() => {});
      entry.loading = false;
      entry.retryAt = Date.now() + 1000;
    }
  }
  return {
    retain(values, preferred = new Set()) {
      for (const value of entries.keys()) if (!values.has(value)) entries.delete(value);
      const missing = [...preferred].filter(value => !entries.has(value) && cacheFile(value)).length;
      for (const value of entries.keys()) {
        if (entries.size + missing <= MAX_ENTRIES) break;
        if (!preferred.has(value)) entries.delete(value);
      }
    },
    resolve(value) {
      const file = cacheFile(value);
      if (!file) return '';
      let entry = entries.get(value);
      if (!entry) {
        if (entries.size >= MAX_ENTRIES) return '';
        entry = { url: '', loading: false, retryAt: 0 };
        entries.set(value, entry);
      }
      if (!entry.url && !entry.loading && Date.now() >= entry.retryAt) {
        entry.loading = true;
        void load(value, file, entry);
      }
      return entry.url;
    },
    get(id) {
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id || '')) return null;
      return [...entries.values()].find(entry => entry.id === id) || null;
    },
    clear() { entries.clear(); },
  };
}

module.exports = { createWidgetPortraits };
