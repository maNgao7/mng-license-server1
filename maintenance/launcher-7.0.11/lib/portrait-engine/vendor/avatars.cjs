'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const dns = require('node:dns');
const { createHash } = require('node:crypto');
const { OWN_AVATAR, regularFile, atomicWrite } = require('./storage.cjs');

const MAX_BYTES = 2 * 1024 * 1024;
const CDN_HOSTS = Object.freeze(['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com',
    'tiktokcdn-in.com', 'byteoversea.com', 'ibytedtos.com', 'ibyteimg.com', 'muscdn.com',
    'pstatp.com', 'douyinpic.com', 'douyincdn.com']);

function avatarUrl(value) {
    try {
        if (typeof value !== 'string' || value.length > 4096) return null;
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
        if (!CDN_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
        url.hash = '';
        return url;
    } catch { return null; }
}

function publicAddress(address) {
    if (address.includes(':')) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const [a, b] = parts;
    return a !== 0 && a !== 10 && a !== 127 && a < 224
        && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
        && !(a === 192 && [0, 168].includes(b)) && !(a === 100 && b >= 64 && b <= 127)
        && !(a === 198 && [18, 19, 51].includes(b)) && !(a === 203 && b === 0);
}

function safeLookup(host, options, callback) {
    dns.lookup(host, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some(item => !publicAddress(item.address))) return callback(new Error('non-public-cdn-address'));
        if (options.all) callback(null, addresses);
        else {
            const result = addresses.find(item => !options.family || item.family === options.family);
            if (!result) callback(new Error('cdn-address-family'));
            else callback(null, result.address, result.family);
        }
    });
}

function imageExtension(bytes) {
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
    if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'gif';
    return '';
}

function readHttps(url, signal, request = https.get) {
    return new Promise((resolve, reject) => {
        const req = request(url, { signal, lookup: safeLookup, timeout: 8000,
            headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif', 'User-Agent': 'TikMnG-Prototype-Avatar/1.0' } }, response => {
            const status = response.statusCode;
            if ([301, 302, 303, 307, 308].includes(status)) {
                const location = response.headers.location;
                response.destroy();
                resolve({ status, location });
                return;
            }
            if (status !== 200 || Number(response.headers['content-length']) > MAX_BYTES
                || !/^image\/(png|jpe?g|webp|gif)(?:;|$)/i.test(response.headers['content-type'] || '')) {
                response.destroy();
                reject(new Error('avatar-response-rejected'));
                return;
            }
            let size = 0;
            const chunks = [];
            response.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_BYTES) {
                    response.destroy();
                    reject(new Error('avatar-too-large'));
                } else chunks.push(chunk);
            });
            response.on('error', reject);
            response.on('aborted', () => reject(new Error('avatar-response-aborted')));
            response.on('end', () => resolve({ status, bytes: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('avatar-timeout')));
    });
}

async function downloadAvatar(value, { signal, request } = {}) {
    const deadline = AbortSignal.timeout(12000);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    let current = avatarUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
        if (!current) throw new Error('avatar-url-rejected');
        const response = await readHttps(current, combined, request);
        if (response.status === 200) {
            const extension = imageExtension(response.bytes);
            if (!extension || !response.bytes.length || response.bytes.length > MAX_BYTES) throw new Error('avatar-format-rejected');
            return { bytes: response.bytes, extension };
        }
        if (typeof response.location !== 'string') throw new Error('avatar-redirect-rejected');
        current = avatarUrl(new URL(response.location, current).href);
    }
    throw new Error('avatar-too-many-redirects');
}

async function convertAvatar(image, { signal } = {}) {
    if (signal?.aborted) throw new Error('avatar-cancelled');
    if (!Buffer.isBuffer(image.bytes) || image.bytes.length > MAX_BYTES || !imageExtension(image.bytes)) throw new Error('avatar-input-rejected');
    const sharp = require('sharp');
    const bytes = await sharp(image.bytes, { limitInputPixels: 16 * 1024 * 1024, sequentialRead: true,
        animated: false, pages: 1, failOn: 'warning' })
        .rotate().resize(256, 256, { fit: 'cover', withoutEnlargement: true })
        .png({ compressionLevel: 8 }).timeout({ seconds: 5 }).toBuffer();
    if (signal?.aborted) throw new Error('avatar-cancelled');
    if (bytes.length > MAX_BYTES || imageExtension(bytes) !== 'png') throw new Error('avatar-output-rejected');
    return { bytes, extension: 'png' };
}

class AvatarCache {
    constructor(directory, { onReady = () => {}, onIssue = () => {}, download = downloadAvatar, convert = convertAvatar,
        maxFiles = 512, maxTotalBytes = 64 * 1024 * 1024, maxQueue = 128, concurrency = 2 } = {}) {
        Object.assign(this, { directory, onReady, onIssue, download, convert });
        this.maxFiles = Math.min(2000, Math.max(1, maxFiles));
        this.maxTotalBytes = maxTotalBytes;
        this.maxQueue = Math.min(2000, Math.max(1, maxQueue));
        this.concurrency = Math.min(this.maxQueue, Math.max(1, concurrency));
        this.queue = [];
        this.pending = new Map();
        this.announced = new Set();
        this.active = 0;
        this.closed = false;
        this.trim();
    }

    files() {
        return fs.readdirSync(this.directory).filter(name => OWN_AVATAR.test(name)).map(name => {
            const file = path.join(this.directory, name);
            return { file, stat: regularFile(file) };
        });
    }

    trim(reserveBytes = 0, reserveFiles = 0) {
        const files = this.files().sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);
        let total = files.reduce((sum, item) => sum + item.stat.size, 0);
        let count = files.length;
        for (const item of files) {
            if (count + reserveFiles <= this.maxFiles && total + reserveBytes <= this.maxTotalBytes) break;
            fs.unlinkSync(item.file);
            total -= item.stat.size;
            count--;
        }
        if (reserveBytes > this.maxTotalBytes) throw new Error('avatar-cache-capacity');
    }

    request(profile, epoch) {
        if (this.closed || !profile.username) return;
        const url = profile.avatarUrls.map(avatarUrl).find(Boolean);
        if (!url) return;
        const key = JSON.stringify([epoch, profile.username, url.href]);
        if (this.pending.has(key) || this.announced.has(key)) return;
        if (this.pending.size >= this.maxQueue) {
            this.onIssue('avatar-overflow', `Avatar work capacity ${this.maxQueue} reached; portrait was not queued.`);
            return;
        }
        const task = { key, epoch, username: profile.username, url: url.href, controller: new AbortController() };
        this.pending.set(key, task);
        this.queue.push(task);
        this.pump();
    }

    pump() {
        while (!this.closed && this.active < this.concurrency && this.queue.length) {
            const task = this.queue.shift();
            this.active++;
            void this.run(task).catch(() => {
                if (!task.controller.signal.aborted) this.onIssue('avatar-download', 'A real avatar could not be cached.');
            }).finally(() => {
                if (this.pending.get(task.key) === task) this.pending.delete(task.key);
                this.active--;
                this.pump();
            });
        }
    }

    async run(task) {
        const digest = createHash('sha256').update(task.url).digest('hex');
        const existing = this.files().find(item => path.basename(item.file) === `tiktok-bridge-avatar-${digest}.png`);
        let file = existing?.file;
        if (existing && (existing.stat.size > MAX_BYTES || imageExtension(fs.readFileSync(file)) !== 'png')) {
            fs.unlinkSync(file);
            file = undefined;
        }
        if (!file) {
            const downloaded = await this.download(task.url, { signal: task.controller.signal });
            if (task.controller.signal.aborted || this.closed) return;
            const image = await this.convert(downloaded, { signal: task.controller.signal });
            if (task.controller.signal.aborted || this.closed) return;
            if (image.bytes.length > MAX_BYTES || image.bytes.length > this.maxTotalBytes
                || image.extension !== 'png' || imageExtension(image.bytes) !== 'png') throw new Error('avatar-format-rejected');
            this.trim(image.bytes.length, 1);
            file = path.join(this.directory, `tiktok-bridge-avatar-${digest}.${image.extension}`);
            atomicWrite(file, image.bytes);
        }
        if (task.controller.signal.aborted || this.closed) return;
        fs.utimesSync(file, new Date(), new Date());
        this.onReady({ kind: 'avatar', epoch: task.epoch, username: task.username, avatarFile: file });
        this.announced.add(task.key);
        if (this.announced.size > this.maxFiles) this.announced.delete(this.announced.values().next().value);
    }

    reset() {
        for (const task of this.pending.values()) task.controller.abort();
        this.pending.clear();
        this.queue.length = 0;
        this.announced.clear();
    }

    close() { this.closed = true; this.reset(); }
}

module.exports = { MAX_BYTES, CDN_HOSTS, avatarUrl, publicAddress, safeLookup, imageExtension, downloadAvatar, convertAvatar, AvatarCache };
