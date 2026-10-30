'use strict';

const { safeRelativePath } = require('./download.cjs');
const defaultCatalog = require('./catalog-defaults.json');

const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 100 * 1024 ** 3;
const EMPTY_CATALOG = { schemaVersion: 1, revision: 0, publishedAt: null, games: [], media: [] };

function invalid() { throw new Error('Invalid content catalog.'); }

function fields(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
        || Object.keys(value).some(key => !allowed.includes(key))) invalid();
}

function text(value, max, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())
        || /[<>\x00-\x08\x0b-\x1f\x7f]/.test(value)) invalid();
    return value.trim();
}

function httpsURL(value, base) {
    if (typeof value !== 'string' || !value || value.length > 2048
        || /[\s\\\x00-\x1f\x7f<>]/.test(value) || value.startsWith('//')) invalid();
    const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
    if (absolute && (!/^https:\/\/[^/]/i.test(value) || value.split('/')[2].includes('@'))) invalid();
    if (!absolute) {
        let pathname;
        try { pathname = decodeURIComponent(value.split(/[?#]/)[0]); } catch { invalid(); }
        if (/^[?#]/.test(value) || pathname.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(pathname)
            || /(?:^|\/)\.\.(?:\/|$)/.test(pathname)) invalid();
    }
    let url;
    try { url = new URL(value, base); } catch { invalid(); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) invalid();
    if (!absolute && url.origin !== new URL(base).origin) invalid();
    return url.href;
}

function serverBase(value) {
    const url = new URL(httpsURL(value));
    if (url.search) invalid();
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.href;
}

function integrity(item, required = false) {
    const sha256 = item.sha256 ?? null;
    const bytes = item.bytes ?? null;
    if ((required && sha256 === null) || (sha256 !== null
        && (typeof sha256 !== 'string' || !/^[a-f\d]{64}$/i.test(sha256)))) invalid();
    if ((required && bytes === null) || (bytes !== null
        && (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_ASSET_BYTES))) invalid();
    return { sha256: sha256?.toLowerCase() ?? null, bytes };
}

function version(value) {
    if (typeof value !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,39}$/.test(value)) invalid();
    return value;
}

function list(value, max, parse) {
    if (!Array.isArray(value) || value.length > max) invalid();
    return Array.from(value, parse);
}

function identified(items, max, parse) {
    const ids = new Set();
    return list(items, max, item => {
        if (!item || typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(item.id)
            || ['__proto__', 'constructor', 'prototype'].includes(item.id) || ids.has(item.id)) invalid();
        ids.add(item.id);
        return parse(item);
    });
}

function patchFiles(items, base) {
    const paths = new Set();
    const parents = new Map();
    const result = list(items, 256, file => {
        fields(file, ['path', 'url', 'sha256', 'bytes']);
        const relative = text(file.path, 240);
        if (relative !== file.path) invalid();
        safeRelativePath(relative);
        const key = relative.normalize('NFC').toLowerCase();
        if (key === '.tikmng-package.json' || paths.has(key)) invalid();
        paths.add(key);
        return { path: relative, url: httpsURL(file.url, base), ...integrity(file, true) };
    });
    // Match the installer's case-insensitive file and directory collision rules.
    for (const file of result) {
        const parts = file.path.split('/');
        for (let i = 1; i < parts.length; i++) {
            const parent = parts.slice(0, i).join('/');
            const key = parent.normalize('NFC').toLowerCase();
            if (paths.has(key) || (parents.has(key) && parents.get(key) !== parent)) invalid();
            parents.set(key, parent);
        }
    }
    return result;
}

/** Validate all entries before filtering unknown games; return a detached, URL-normalized catalog. */
function validateCatalog(value, { serverURL, known = () => true } = {}) {
    fields(value, ['schemaVersion', 'revision', 'publishedAt', 'games', 'media', 'launcher']);
    if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
        || (value.publishedAt != null && (typeof value.publishedAt !== 'string'
            || value.publishedAt.length > 40 || !Number.isFinite(Date.parse(value.publishedAt))))) invalid();
    if (Buffer.byteLength(JSON.stringify(value)) > MAX_CATALOG_BYTES) invalid();
    let base;
    try { base = serverBase(serverURL); } catch { /* Absolute URLs remain usable without a valid server. */ }
    const games = identified(value.games, 100, item => {
        fields(item, ['id', 'title', 'description', 'version', 'url', 'sha256', 'bytes', 'requirements', 'resources', 'files', 'format']);
        if (item.format !== undefined && item.format !== 'shared-runtime-v2') invalid();
        return {
            id: item.id, title: text(item.title, 120), description: text(item.description === undefined ? '' : item.description, 2000, true),
            version: version(item.version), url: httpsURL(item.url, base), ...integrity(item),
            requirements: text(item.requirements === undefined ? '' : item.requirements, 1000, true),
            resources: list(item.resources === undefined ? [] : item.resources, 8, resource => {
                fields(resource, ['title', 'url']);
                return { title: text(resource.title, 120), url: httpsURL(resource.url, base) };
            }),
            ...(item.files === undefined ? {} : { files: patchFiles(item.files, base) }),
            ...(item.format ? { format: item.format } : {})
        };
    });
    const media = identified(value.media, 2000, item => {
        fields(item, ['id', 'title', 'category', 'url', 'sha256', 'bytes']);
        return { id: item.id, title: text(item.title, 120), category: text(item.category === undefined ? '' : item.category, 60, true),
            url: httpsURL(item.url, base), ...integrity(item) };
    });
    const catalog = { schemaVersion: 1, revision: value.revision, publishedAt: value.publishedAt ?? null,
        games: games.filter(game => known(game.id)), media };
    if (value.launcher !== undefined) {
        const item = value.launcher;
        fields(item, ['version', 'downloadUrl', 'sha256', 'bytes', 'changelog']);
        catalog.launcher = { version: version(item.version), downloadUrl: httpsURL(item.downloadUrl, base),
            ...integrity(item, true), changelog: text(item.changelog === undefined ? '' : item.changelog, 4000, true) };
    }
    return catalog;
}

function usable(value, options) {
    if (value == null) return null;
    try { return validateCatalog(value, options); } catch { return null; }
}

async function readCatalog(response) {
    const length = response.headers?.get('content-length');
    if (length && Number(length) > MAX_CATALOG_BYTES) invalid();
    const type = response.headers?.get('content-type');
    if (type && !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(type)) invalid();
    if (!response.body?.getReader) return response.json();
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_CATALOG_BYTES) {
                reader.cancel().catch(() => {});
                invalid();
            }
            chunks.push(Buffer.from(value));
        }
        return JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
    } finally { reader.releaseLock(); }
}

const MESSAGES = {
    remote: 'Sunucudaki i\u00e7erik katalo\u011fu kullan\u0131l\u0131yor.',
    'not-published': 'Katalog hizmeti sunucuda hen\u00fcz kullan\u0131ma a\u00e7\u0131lmam\u0131\u015f.',
    network: 'Katalog sunucusuna ula\u015f\u0131lamad\u0131.',
    timeout: 'Katalog sunucusu zaman\u0131nda yan\u0131t vermedi.',
    'http-error': 'Katalog hizmeti \u015fu anda kullan\u0131lam\u0131yor.',
    'invalid-catalog': 'Sunucudan gelen katalog do\u011frulanamad\u0131.',
    'invalid-server-url': 'G\u00fcvenli bir katalog sunucusu adresi gerekli.',
    'stale-remote': 'Sunucudaki katalog kullan\u0131lan s\u00fcr\u00fcmden eski; mevcut s\u00fcr\u00fcm korundu.'
};

/**
 * No persistence or global state: pass the latest cache on every refresh.
 * source: remote | cache | bundled | none. Only cacheable results should be persisted.
 * remoteAvailable means a valid primary response, even when its revision was rejected.
 * httpStatus/code are diagnostics; message is safe for display and never claims a fallback was updated.
 */
async function loadContentCatalog({ serverURL, known = () => true, cached = null, bundled = defaultCatalog,
    fetch: fetchCatalog = globalThis.fetch, timeoutMs = 10000 } = {}) {
    let base;
    try { base = serverBase(typeof serverURL === 'function' ? serverURL() : serverURL); } catch { /* Use local fallback. */ }
    const options = { serverURL: base, known };
    const cache = usable(cached, options);
    const bundle = usable(bundled, options);
    const useCache = cache && (!bundle || cache.revision >= bundle.revision);
    const fallback = useCache ? cache : bundle;
    const source = useCache ? 'cache' : bundle ? 'bundled' : 'none';
    let code = base ? 'network' : 'invalid-server-url';
    let httpStatus = null;
    let remoteAvailable = false;
    let remoteRevision = null;
    const result = (catalog, selectedSource, selectedCode) => {
        const suffix = { cache: 'Son ge\u00e7erli kay\u0131tl\u0131 katalog kullan\u0131l\u0131yor.',
            bundled: 'Uygulamayla gelen katalog kullan\u0131l\u0131yor.', none: 'Kullan\u0131labilir i\u00e7erik katalo\u011fu bulunamad\u0131.' };
        return { catalog, status: {
            source: selectedSource, code: selectedCode,
            message: [MESSAGES[selectedCode], suffix[selectedSource]].filter(Boolean).join(' '),
            remoteAvailable, degraded: selectedSource !== 'remote', cacheable: selectedSource === 'remote',
            revision: catalog.revision, remoteRevision, httpStatus,
            cacheRejected: cached != null && cache === null, bundledRejected: bundled != null && bundle === null
        } };
    };
    if (base && typeof fetchCatalog === 'function') {
        const endpoint = new URL('api/content/catalog', base).href;
        const controller = new AbortController();
        const deadline = Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000 ? timeoutMs : 10000;
        let timer;
        let timedOut = false;
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
                reject(new Error('Catalog request timed out.'));
            }, deadline);
        });
        try {
            // Bound the entire fetch/body read, including injected fetchers that ignore AbortSignal.
            const operation = (async () => {
                const response = await fetchCatalog(endpoint, { signal: controller.signal, cache: 'no-store',
                    credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json', 'X-TikMnG-Content': 'shared-runtime-v2' } });
                if (timedOut) return null;
                httpStatus = Number.isInteger(response?.status) ? response.status : null;
                if (!response?.ok) {
                    code = httpStatus === 404 ? 'not-published' : 'http-error';
                    return null;
                }
                code = 'invalid-catalog';
                if (response.redirected || (response.url && response.url !== endpoint)) invalid();
                const body = await readCatalog(response);
                if (timedOut) return null;
                return validateCatalog(body, options);
            })();
            const remote = await Promise.race([operation, timeout]);
            if (remote) {
                remoteAvailable = true;
                remoteRevision = remote.revision;
                if (fallback && remote.revision < fallback.revision) code = 'stale-remote';
                else return result(remote, 'remote', 'remote');
            }
        } catch { if (timedOut) code = 'timeout'; }
        finally {
            clearTimeout(timer);
            controller.abort();
        }
    }
    return result(fallback || { ...EMPTY_CATALOG, games: [], media: [] }, source, code);
}

module.exports = { loadContentCatalog, validateCatalog };
