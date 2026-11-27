"use strict";

const { safeRelativePath, numericSize, failure } = require("./download.cjs");
const crypto = require('node:crypto');

// One ordinary catalog file points at a complete manifest, bypassing the catalog's
// 256-file limit without adding fields that older catalog validators reject.
const CONTENT_PATH = ".tikmng-content.json";
const RUNTIME_REFERENCE = ".tikmng-runtime.json";
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 100000;
const pathKey = value => value.normalize("NFC").toLowerCase();
const containsPath = (parent, child) => pathKey(child) === pathKey(parent) || pathKey(child).startsWith(`${pathKey(parent)}/`);

function contentURL(value) {
    let url;
    try { url = new URL(value); } catch { throw failure("EMANIFEST", "Invalid content URL"); }
    const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
        url.username || url.password || url.hash) throw failure("EMANIFEST", "Content requires HTTPS");
    return url.href;
}

function manifestFiles(files, { requireURLs = false, allowControl = false } = {}) {
    if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) {
        throw failure("EMANIFEST", "Manifest must contain a bounded file list");
    }
    const seen = new Map();
    let total = 0;
    const result = files.map(file => {
        if (!file || typeof file !== "object" || Array.isArray(file)) throw failure("EMANIFEST", "Invalid manifest file");
        const relative = safeRelativePath(file.path);
        const key = pathKey(relative);
        if (relative.length > 240 || containsPath(".tikmng-package.json", relative) || containsPath(RUNTIME_REFERENCE, relative) ||
            (!allowControl && containsPath(CONTENT_PATH, relative)) || seen.has(key)) {
            throw failure("EMANIFEST", "Duplicate or reserved manifest path");
        }
        const sha256 = typeof file.sha256 === "string" ? file.sha256.toLowerCase() : "";
        const bytes = numericSize(file.bytes);
        if (!/^[a-f0-9]{64}$/.test(sha256) || bytes === null) {
            throw failure("EMANIFEST", "Every manifest file requires SHA-256 and bytes");
        }
        total += bytes;
        if (!Number.isSafeInteger(total)) throw failure("EMANIFEST", "Manifest is too large");
        seen.set(key, relative);
        return { path: relative, sha256, bytes,
            ...(file.url === undefined && !requireURLs ? {} : { url: contentURL(file.url) }) };
    });
    const parents = new Map();
    for (const file of result) {
        const parts = file.path.split("/");
        for (let i = 1; i < parts.length; i++) {
            const parent = parts.slice(0, i).join("/");
            const key = pathKey(parent);
            if (seen.has(key) || (parents.has(key) && parents.get(key) !== parent)) {
                throw failure("EMANIFEST", "Conflicting manifest paths");
            }
            parents.set(key, parent);
        }
    }
    return result;
}

function contentDescriptor(files) {
    const control = files?.filter(file => containsPath(CONTENT_PATH, file.path));
    if (!control?.length) return null;
    if (files.length !== 1 || control[0].path !== CONTENT_PATH || control[0].bytes > MAX_MANIFEST_BYTES) {
        throw failure("EMANIFEST", "Content manifest must be the sole catalog file and fit the size limit");
    }
    contentURL(control[0].url);
    return control[0];
}

function parseContentManifest(value, { packageId, version } = {}) {
    if (!value || ![1, 2].includes(value.schemaVersion) || value.type !== "tikmng-game-content" ||
        value.package !== packageId || value.version !== version) {
        throw failure("EMANIFEST", "Content manifest package/version mismatch");
    }
    return manifestFiles(value.files, { requireURLs: !(value.schemaVersion === 2 && value.payloadMode === 'archive' && value.payloadArchive) });
}

function archiveDescriptor(value) {
    if (!value || !/^[a-f0-9]{64}$/.test(value.sha256 || '') ||
        !Number.isSafeInteger(value.bytes) || value.bytes <= 0) {
        throw failure('EMANIFEST', 'Archive requires SHA-256 and bytes');
    }
    return { sha256: value.sha256, bytes: value.bytes, url: contentURL(value.url) };
}

function parseContentPackage(value, expected) {
    const files = parseContentManifest(value, expected);
    if (value.schemaVersion === 1) {
        if (value.runtime || value.payloadArchive || value.payloadMode) throw failure('EMANIFEST', 'Components require schema 2');
        return { files };
    }
    if (value.payloadMode !== undefined && (value.payloadMode !== 'archive' || !value.payloadArchive)) throw failure('EMANIFEST', 'Invalid payload transfer mode');
    if (!value.runtime || files.some(file => containsPath('runtime', file.path))) {
        throw failure('EMANIFEST', 'Shared runtime cannot overlap game files');
    }
    const runtimeFiles = manifestFiles(value.runtime.files);
    for (const required of ['java/bin/java.exe', 'profile.json', 'client.jar']) {
        if (!runtimeFiles.some(file => file.path === required && file.bytes > 0)) {
            throw failure('EMANIFEST', 'Incomplete shared Java/Minecraft runtime');
        }
    }
    if (runtimeFiles.some(file => containsPath('.tikmng-runtime-complete.json', file.path))) {
        throw failure('EMANIFEST', 'Reserved runtime receipt');
    }
    // ZIP metadata/order may differ even when every runtime file is identical.
    const id = crypto.createHash('sha256').update(JSON.stringify([...runtimeFiles]
        .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
        .map(({ path, sha256, bytes }) => ({ path, sha256, bytes })))).digest('hex');
    return { files, runtime: { id, archive: archiveDescriptor(value.runtime.archive), files: runtimeFiles },
        ...(value.payloadMode === 'archive' ? { archiveOnly: true } : {}),
        ...(value.payloadArchive ? { payloadArchive: archiveDescriptor(value.payloadArchive) } : {}) };
}

module.exports = { CONTENT_PATH, MAX_MANIFEST_BYTES, manifestFiles, contentDescriptor,
    parseContentManifest, parseContentPackage, archiveDescriptor, RUNTIME_REFERENCE, contentURL, containsPath, pathKey };
