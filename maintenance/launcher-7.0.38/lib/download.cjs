"use strict";

const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

function failure(code, message) {
    return Object.assign(new Error(message), { code });
}

function abortError() {
    return Object.assign(new Error("Operation aborted"), { name: "AbortError", code: "ABORT_ERR" });
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError();
}

function safeRelativePath(value) {
    if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/")) {
        throw failure("EUNSAFEPATH", "Expected a safe relative path");
    }
    const parts = value.split("/");
    if (parts.some(part => !part || part === "." || part === ".." ||
        /[\x00-\x1f\x7f<>:"|?*]/.test(part) || /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) {
        throw failure("EUNSAFEPATH", `Unsafe path: ${value}`);
    }
    return value;
}

// Check every existing ancestor as well as the leaf (junctions count as links).
function assertSafePath(target) {
    const absolute = path.resolve(target);
    const root = path.parse(absolute).root;
    let current = root;
    for (const part of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
        current = path.join(current, part);
        let stat;
        try { stat = fs.lstatSync(current); } catch (error) {
            if (error.code === "ENOENT") continue;
            throw error;
        }
        if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
            throw failure("EUNSAFEPATH", `Links and special files are forbidden: ${current}`);
        }
        if (current !== absolute && !stat.isDirectory()) {
            throw failure("EUNSAFEPATH", `Path ancestor is not a directory: ${current}`);
        }
    }
    return absolute;
}

function ensureDirectory(dir) {
    assertSafePath(dir);
    fs.mkdirSync(dir, { recursive: true });
    assertSafePath(dir);
}

async function assertSafeTree(dir, signal) {
    assertSafePath(dir);
    let bytes = 0;
    const pending = [dir];
    while (pending.length) {
        throwIfAborted(signal);
        const current = pending.pop();
        const stat = await fsp.lstat(current);
        if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
            throw failure("EUNSAFEPATH", `Links and special files are forbidden: ${current}`);
        }
        if (stat.isFile()) {
            bytes += stat.size;
            if (!Number.isSafeInteger(bytes)) throw failure("EOVERFLOW", "Tree is too large");
        } else {
            for (const entry of await fsp.readdir(current)) {
                safeRelativePath(entry);
                pending.push(path.join(current, entry));
            }
        }
    }
    return bytes;
}

async function checkDiskSpace(dir, bytes = 0) {
    assertSafePath(dir);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw failure("EINVAL", "Invalid disk size");
    const stat = await fsp.statfs(dir, { bigint: true });
    const available = stat.bavail * stat.bsize;
    // Keep a small reserve for filesystem metadata, pointers, and unknown-size streams.
    if (available < BigInt(bytes) + 16n * 1024n * 1024n) {
        throw failure("ENOSPC", "Insufficient free disk space");
    }
}

async function hashFile(file, signal) {
    assertSafePath(file);
    throwIfAborted(signal);
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(file, { signal });
    for await (const chunk of stream) hash.update(chunk);
    throwIfAborted(signal);
    return hash.digest("hex");
}

function emit(callback, value) {
    // An observer must never change the outcome of an installation.
    try { callback?.(value); } catch {}
}

function numericSize(value) {
    if (value === undefined || value === null) return null;
    if (!Number.isSafeInteger(value) || value < 0) throw failure("EINVAL", "Invalid byte count");
    return value;
}

function headerSize(value) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
    const size = Number(value);
    return Number.isSafeInteger(size) ? size : null;
}

function validateUrl(value) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw failure("EINVAL", "Only HTTP(S) download URLs without credentials are supported");
    }
    return url;
}

async function responseFor(value, headers, signal, timeoutMs, redirects = 0) {
    throwIfAborted(signal);
    const url = validateUrl(value);
    if (redirects > 8) throw failure("EREDIRECT", "Too many redirects");
    const response = await new Promise((resolve, reject) => {
        const req = (url.protocol === "https:" ? https : http).get(url, {
            headers: { "User-Agent": "MNG-Game-Library", "Accept-Encoding": "identity", ...headers },
            signal
        }, res => {
            clearTimeout(headerTimer);
            res.on("error", () => {});
            resolve(res);
        });
        const timedOut = () => req.destroy(failure("ETIMEDOUT", "Download timed out"));
        const headerTimer = setTimeout(timedOut, timeoutMs);
        req.setTimeout(timeoutMs, timedOut);
        req.on("error", error => { clearTimeout(headerTimer); reject(error); });
        req.on("close", () => clearTimeout(headerTimer));
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.destroy();
        if (!response.headers.location) throw failure("EREDIRECT", "Redirect has no location");
        const next = validateUrl(new URL(response.headers.location, url).href);
        if (url.protocol === "https:" && next.protocol !== "https:") {
            throw failure("EREDIRECT", "Insecure download redirect");
        }
        return responseFor(next, headers, signal, timeoutMs, redirects + 1);
    }
    return response;
}

function waitRetry(ms, signal) {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(abortError()); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
        signal?.addEventListener("abort", abort, { once: true });
    });
}

/** Download to destination.part, verify, then atomically rename to destination.
 * A failed/aborted transfer retains resumable data. SHA/size failures discard it.
 * options: {sha256?, bytes?, signal?, onProgress?, retries?, timeoutMs?, retryDelayMs?, oyun?}.
 */
async function downloadFile(url, destination, options = {}) {
    url = validateUrl(url).href;
    destination = assertSafePath(destination);
    const expectedBytes = numericSize(options.bytes);
    const expectedHash = options.sha256 == null ? null : String(options.sha256).toLowerCase();
    if (expectedHash !== null && !/^[a-f0-9]{64}$/.test(expectedHash)) {
        throw failure("EINVAL", "Invalid SHA-256");
    }
    const { signal, onProgress } = options;
    const retries = options.retries ?? 3;
    const timeoutMs = options.timeoutMs ?? 30000;
    const retryDelayMs = options.retryDelayMs ?? 250;
    if (!Number.isInteger(retries) || retries < 0 || retries > 10 ||
        !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
        !Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw failure("EINVAL", "Invalid download options");
    throwIfAborted(signal);
    ensureDirectory(path.dirname(destination));
    const part = `${destination}.part`;
    const metadataFile = `${part}.json`;
    const reset = async () => {
        for (const file of [part, metadataFile]) {
            assertSafePath(file);
            await fsp.rm(file, { force: true });
        }
    };
    let networkBytes = 0;
    const started = performance.now();
    let transferred = 0;
    let total = expectedBytes;
    const report = (phase = "downloading", message = "Downloading file") => {
        const seconds = Math.max((performance.now() - started) / 1000, 0.001);
        const speedBps = networkBytes / seconds;
        emit(onProgress, {
            oyun: options.oyun ?? null, phase, message,
            percent: total === null ? null : total === 0 ? 100 : Math.min(100, transferred / total * 100),
            transferredBytes: transferred, totalBytes: total, speedBps,
            etaSeconds: total !== null && speedBps > 0 ? Math.max(0, (total - transferred) / speedBps) : null
        });
    };
    for (let attempt = 0; attempt <= retries; attempt++) {
        let response;
        try {
            throwIfAborted(signal);
            for (const file of [part, metadataFile, destination]) assertSafePath(file);
            let metadata;
            try { metadata = JSON.parse(await fsp.readFile(metadataFile, "utf8")); } catch (error) {
                if (!['ENOENT', 'EISDIR'].includes(error.code) && !(error instanceof SyntaxError)) throw error;
            }
            let offset = 0;
            try { offset = (await fsp.stat(part)).size; } catch (error) { if (error.code !== "ENOENT") throw error; }
            if (!metadata || metadata.url !== url || metadata.sha256 !== expectedHash ||
                metadata.bytes !== expectedBytes || (!metadata.validator && !expectedHash)) {
                await reset();
                offset = 0;
                metadata = null;
            }
            total = expectedBytes ?? (Number.isSafeInteger(metadata?.totalBytes) ? metadata.totalBytes : null);
            transferred = offset;
            const verifyAndActivate = async () => {
                throwIfAborted(signal);
                const size = (await fsp.stat(part)).size;
                if ((total !== null && size !== total) || (expectedBytes !== null && size !== expectedBytes)) {
                    throw failure("ESIZE", `Download size mismatch: received ${size}, expected ${total}`);
                }
                const sha256 = await hashFile(part, signal);
                if (expectedHash && sha256 !== expectedHash) throw failure("EHASH", "Download SHA-256 mismatch");
                const handle = await fsp.open(part, "r+");
                try { await handle.sync(); } finally { await handle.close(); }
                throwIfAborted(signal);
                assertSafePath(destination);
                await fsp.rename(part, destination);
                await fsp.rm(metadataFile, { force: true }).catch(() => {});
                transferred = size;
                report("complete", "Download complete");
                return { path: destination, bytes: size, sha256 };
            };
            if (offset > 0 && total !== null && offset === total) return await verifyAndActivate();
            if (total !== null && offset > total) { await reset(); offset = 0; }
            await checkDiskSpace(path.dirname(destination), total === null ? 0 : total - offset);
            const headers = {};
            if (offset) {
                headers.Range = `bytes=${offset}-`;
                if (metadata?.validator) headers["If-Range"] = metadata.validator;
            }
            response = await responseFor(url, headers, signal, timeoutMs);
            const status = response.statusCode;
            if (status !== 200 && status !== 206) {
                if (status === 416) { await reset(); throw failure("ERANGE", "Server rejected resume range"); }
                const error = failure("EHTTP", `Download failed (HTTP ${status})`);
                error.retryable = status === 408 || status === 429 || status >= 500;
                throw error;
            }
            if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
                throw failure("EBADRESPONSE", "Encoded download responses are unsupported");
            }
            const length = headerSize(response.headers["content-length"]);
            const etag = response.headers.etag;
            const validator = typeof etag === "string" && /^"[^\r\n]*"$/.test(etag) ? etag :
                (typeof response.headers["last-modified"] === "string" &&
                Number.isFinite(Date.parse(response.headers["last-modified"])) ? response.headers["last-modified"] : null);
            if (status === 206) {
                const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers["content-range"] || "");
                if (!offset || !range || range.slice(1).some(n => !Number.isSafeInteger(Number(n))) ||
                    Number(range[1]) !== offset || Number(range[2]) < offset || Number(range[3]) <= Number(range[2]) ||
                    (length !== null && Number(range[2]) - offset + 1 !== length) ||
                    (metadata?.validator && validator && metadata.validator !== validator)) {
                    await reset();
                    throw failure("ERANGE", "Invalid download resume response");
                }
                total = Number(range[3]);
            } else {
                offset = 0;
                total = length;
            }
            if (expectedBytes !== null && total !== null && total !== expectedBytes) {
                throw failure("ESIZE", "Content length disagrees with package byte count");
            }
            total = expectedBytes ?? total;
            await checkDiskSpace(path.dirname(destination), total === null ? 0 : total - offset);
            await fsp.writeFile(metadataFile, JSON.stringify({ url, sha256: expectedHash, bytes: expectedBytes, validator, totalBytes: total }));
            transferred = offset;
            report();
            let diskCheckAt = transferred + 8 * 1024 * 1024;
            const meter = new Transform({
                transform(chunk, encoding, done) {
                    transferred += chunk.length;
                    networkBytes += chunk.length;
                    if (total !== null && transferred > total) return done(failure("ESIZE", "Download exceeds expected size"));
                    report();
                    if (transferred >= diskCheckAt) {
                        diskCheckAt = transferred + 8 * 1024 * 1024;
                        checkDiskSpace(path.dirname(destination)).then(() => done(null, chunk), done);
                    } else done(null, chunk);
                }
            });
            assertSafePath(part);
            await pipeline(response, meter, fs.createWriteStream(part, { flags: offset ? "a" : "w" }), { signal });
            if (!response.complete) throw failure("ECONNRESET", "Download response was interrupted");
            return await verifyAndActivate();
        } catch (error) {
            response?.destroy();
            if (signal?.aborted || error.name === "AbortError") throw abortError();
            if (["EHASH", "ESIZE"].includes(error.code)) await reset();
            const retryable = error.retryable ?? !["EINVAL", "EUNSAFEPATH", "ENOSPC", "EACCES", "EPERM", "EISDIR", "EBADRESPONSE", "EREDIRECT"].includes(error.code);
            if (!retryable || attempt === retries) throw error;
            await waitRetry(Math.min(retryDelayMs * 2 ** attempt, 2000), signal);
        }
    }
}

module.exports = {
    download: downloadFile, downloadFile, assertSafePath, safeRelativePath, assertSafeTree, ensureDirectory,
    checkDiskSpace, hashFile, failure, abortError, throwIfAborted, numericSize, emit
};
