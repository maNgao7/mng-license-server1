'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const crc32 = require('buffer-crc32');
const { download } = require('../lib/download.cjs');
const managerPath = path.resolve(__dirname, '../lib/chatterbox-pack-manager.cjs');
const source = fs.readFileSync(managerPath, 'utf8');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));

function zip(entries) {
    const locals = [], central = []; let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name), data = Buffer.from(entry.data || ''), crc = crc32.unsigned(data);
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
        local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
        const index = Buffer.alloc(46); index.writeUInt32LE(0x02014b50); index.writeUInt16LE(3 * 256 + 20, 4); index.writeUInt16LE(20, 6);
        index.writeUInt32LE(crc, 16); index.writeUInt32LE(data.length, 20); index.writeUInt32LE(data.length, 24); index.writeUInt16LE(name.length, 28);
        const mode = entry.mode ?? (entry.name.endsWith('/') ? 0o040755 : 0o100644);
        index.writeUInt32LE((mode * 65536) >>> 0, 38); index.writeUInt32LE(offset, 42);
        locals.push(local, name, data); central.push(index, name); offset += local.length + name.length + data.length;
    }
    const directory = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
}

async function fixture(t, options = {}) {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'tikmng-chatterbox-install-'));
    const root = path.join(base, 'voices', 'chatterbox-v3');
    const runtimeManifest = JSON.stringify({ testRuntime: true });
    const refsManifest = JSON.stringify({ voices: Array.from({ length: 10 }, (_, i) => ({ id: 'test-' + i })) });
    const runtimeEntries = options.runtimeEntries || [
        { name: 'runtime/python.exe', data: 'inert-unit-test-python' },
        { name: 'runtime-manifest.json', data: runtimeManifest },
        { name: 'licenses/PSF.txt', data: 'license-notice' }
    ];
    const refsEntries = options.refsEntries || [{ name: 'references/manifest.json', data: refsManifest }, { name: 'references/ref.flac', data: 'reference-audio' }];
    const blobs = new Map([['runtime.zip', zip(runtimeEntries)], ['references.zip', zip(refsEntries)], ['ve.pt', Buffer.from('unit-test-model')]]);
    const calls = [], observed = [], requests = [];
    const server = http.createServer((req, res) => {
        requests.push({ url: req.url, range: req.headers.range });
        const data = blobs.get(req.url.slice(1));
        if (!data) { res.writeHead(404); res.end(); return; }
        const offset = req.headers.range ? Number(/^bytes=(\d+)-$/.exec(req.headers.range)?.[1]) : 0;
        res.writeHead(offset ? 206 : 200, { 'content-length': data.length - offset, etag: '"test-fixture"',
            ...(offset ? { 'content-range': `bytes ${offset}-${data.length - 1}/${data.length}` } : {}) });
        res.end(data.subarray(offset));
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/`;
    const archives = ['runtime', 'references'].map(kind => {
        const data = blobs.get(kind + '.zip');
        return { name: kind + '.zip', bytes: data.length, sha256: hash(data), kind, maxFiles: options.maxFiles || 20, maxBytes: options.maxBytes || 10000 };
    });
    const catalog = { id: 'chatterbox-tr-v1', version: '1.0.0', name: 'Test', voices: 10,
        runtimeManifestSha256: hash(runtimeManifest), referencesManifestSha256: hash(refsManifest), archives,
        models: [{ name: 've.pt', bytes: blobs.get('ve.pt').length, sha256: hash(blobs.get('ve.pt')), url: url + 've.pt' }] };
    options.alterCatalog?.(catalog);
    const start = source.indexOf('const PACK = '), end = source.indexOf('\nconst failure =', start);
    const code = source.slice(0, start) + 'const PACK = ' + JSON.stringify(catalog) + ';' + source.slice(end);
    const loaded = { exports: {} };
    const wrapper = vm.runInNewContext('(function(require,module,exports,__dirname){' + code.replace(/const RELEASE = .*?;/, 'const RELEASE = ' + JSON.stringify(url) + ';') + '\n})',
        { Buffer, AbortController, process, setTimeout, clearTimeout });
    const requestModule = name => require(name.startsWith('./') ? path.resolve(path.dirname(managerPath), name) : name);
    wrapper(requestModule, loaded, loaded.exports, path.dirname(managerPath));
    let verifyCalls = 0;
    const factory = options.runtimeFactory || (({ root: target }) => ({ async status() {
        verifyCalls++;
        const available = fs.existsSync(path.join(target, 'runtime/python.exe')) && fs.existsSync(path.join(target, 'model-v3/ve.pt'));
        return { available, voices: available ? Array.from({ length: 10 }, (_, id) => ({ id: String(id) })) : [], reason: available ? null : 'CHATTERBOX_PACK_MISSING' };
    }, close() {} }));
    function manager(extra = {}) {
        return loaded.exports.createChatterboxPackManager({ root, runtimeFactory: factory,
            downloadFile: async (...args) => {
                calls.push(args); return options.downloadFile ? options.downloadFile(...args) : download(...args);
            }, onProgress: event => { observed.push(event); options.onProgress?.(event); }, ...extra });
    }
    const instance = manager();
    t.after(async () => { instance.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fsp.rm(base, { recursive: true, force: true }); });
    return { base, root, blobs, calls, observed, requests, catalog, manager, instance, get verifyCalls() { return verifyCalls; } };
}

test('production catalog has exact pinned sources, positive byte counts and no renderer-supplied URLs', () => {
    const { PACK, createChatterboxPackManager } = require(managerPath);
    assert.equal(PACK.archives.length, 2); assert.equal(PACK.models.length, 6); assert.ok(Object.isFrozen(PACK));
    assert.equal(PACK.archives[0].bytes, 465898682); assert.equal(PACK.archives[1].bytes, 2070014);
    const m = createChatterboxPackManager({ root: path.join(os.tmpdir(), 'not-created-chatterbox-test') });
    assert.equal(m.info().downloadBytes, 3676920620); assert.equal(m.info().downloadReady, true);
    for (const file of [...PACK.archives, ...PACK.models]) assert.match(file.sha256, /^[a-f0-9]{64}$/);
    for (const file of PACK.models) assert.match(file.url, /^https:\/\/huggingface\.co\/ResembleAI\/chatterbox\/resolve\/5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18\//);
    m.close();
});
test('sync info/catalog avoids readiness scans and accurately reports download progress', async t => {
    const f = await fixture(t); assert.equal(f.instance.info().installing, false); assert.equal(f.instance.catalog().downloadReady, true);
    assert.equal(f.verifyCalls, 0); await f.instance.install();
    assert.equal(f.instance.info().progress.phase, 'complete'); assert.equal(f.instance.info().progress.percent, 100);
    assert.equal(f.instance.info().progress.completedBytes, f.instance.info().downloadBytes);
    assert.ok(f.observed.some(p => p.phase === 'downloading')); assert.ok(f.observed.some(p => p.phase === 'verifying'));
});
test('full HTTP download, safe extraction, final validation and atomic activation succeed; reinstall uses existing pack', async t => {
    const f = await fixture(t); const result = await f.instance.install();
    assert.equal(result.installed, true); assert.equal(result.voices.length, 10); assert.equal(result.root, f.root);
    assert.equal(f.calls.length, 3); assert.equal((await f.instance.status()).installed, true);
    const receipt = JSON.parse(await fsp.readFile(path.join(f.root, 'pack-install.json'), 'utf8')); assert.equal(receipt.id, f.catalog.id);
    assert.equal(await fsp.readFile(path.join(f.root, 'licenses/PSF.txt'), 'utf8'), 'license-notice');
    await f.instance.install(); assert.equal(f.calls.length, 3, 'verified installed pack does not redownload');
    assert.ok(!(await fsp.readdir(path.dirname(f.root))).some(n => n.includes('staging-') || n.includes('previous-') || n.endsWith('.lock')));
});
test('download.cjs resumes a previously interrupted hash-bound asset', async t => {
    const f = await fixture(t); const cache = path.join(path.dirname(f.root), '.chatterbox-v3.downloads'); await fsp.mkdir(cache, { recursive: true });
    const first = f.catalog.archives[0];
    // Read the trusted per-fixture URL from the model URL's origin.
    const url = new URL(first.name, f.catalog.models[0].url).href;
    const file = path.join(cache, first.name), data = f.blobs.get(first.name), split = 40;
    await fsp.writeFile(file + '.part', data.subarray(0, split));
    await fsp.writeFile(file + '.part.json', JSON.stringify({ url, sha256: first.sha256, bytes: first.bytes, validator: '"test-fixture"', totalBytes: first.bytes }));
    await f.instance.install(); assert.ok(f.requests.some(r => r.range === `bytes=${split}-`));
    assert.equal(fs.existsSync(file + '.part'), false);
});
test('corrupt download fails before extraction and never activates a target', async t => {
    const f = await fixture(t, { downloadFile: async (_url, destination) => fsp.writeFile(destination, 'bad-data') });
    await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_DOWNLOAD_INTEGRITY' }); assert.equal(fs.existsSync(f.root), false);
    assert.equal(f.instance.info().progress.phase, 'error');
});
test('failed new pack verification preserves installed bytes and saves until validated replacement', async t => {
    const f = await fixture(t, { runtimeFactory: ({ root }) => ({ async status() { return { available: false, voices: [] }; }, close() {} }) });
    await fsp.mkdir(f.root, { recursive: true });
    await fsp.writeFile(path.join(f.root, 'pack-install.json'), JSON.stringify({ id: f.catalog.id, version: f.catalog.version }));
    await fsp.writeFile(path.join(f.root, 'saved.txt'), 'keep-existing');
    await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_PACK_INVALID' });
    assert.equal(await fsp.readFile(path.join(f.root, 'saved.txt'), 'utf8'), 'keep-existing');
    assert.equal(fs.existsSync(path.join(f.root, 'runtime')), false);
});
test('unrecognized occupied directory is never replaced', async t => {
    const f = await fixture(t); await fsp.mkdir(f.root, { recursive: true }); await fsp.writeFile(path.join(f.root, 'user.txt'), 'keep');
    await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_TARGET_OCCUPIED' });
    assert.equal(f.calls.length, 0); assert.equal(await fsp.readFile(path.join(f.root, 'user.txt'), 'utf8'), 'keep');
});
test('traversal, backslashes, Windows device names, links, duplicates and wrong archive scopes are rejected', async t => {
    for (const entry of [
        { name: '../escape.exe' }, { name: '/absolute.exe' }, { name: 'runtime\\escape.exe' },
        { name: 'runtime/CON.txt' }, { name: 'runtime/link', data: '../../escape', mode: 0o120777 },
        { name: 'references/wrong-scope.flac' }, { name: 'runtime/a.' }
    ]) {
        const f = await fixture(t, { runtimeEntries: [{ ...entry, data: entry.data || 'malicious' }] });
        await assert.rejects(f.instance.install(), err => /^CHATTERBOX_/.test(err.code)); assert.equal(fs.existsSync(f.root), false);
        assert.equal(fs.existsSync(path.join(f.base, 'escape.exe')), false);
    }
    const dup = await fixture(t, { runtimeEntries: [{ name: 'runtime/A.py', data: 'a' }, { name: 'runtime/a.py', data: 'b' }] });
    await assert.rejects(dup.instance.install(), { code: 'CHATTERBOX_ARCHIVE_INVALID' });
});
test('archive expansion and entry limits reject excessive payloads', async t => {
    for (const opts of [{ maxFiles: 1 }, { maxBytes: 4 }]) {
        const f = await fixture(t, opts); await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_ARCHIVE_INVALID' });
        assert.equal(fs.existsSync(f.root), false);
    }
});
test('manifest pins are checked after safe extraction even when archive itself has the expected hash', async t => {
    const f = await fixture(t, { alterCatalog: c => { c.referencesManifestSha256 = '0'.repeat(64); } });
    await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_DOWNLOAD_INTEGRITY' }); assert.equal(fs.existsSync(f.root), false);
});
test('cancel retains resumable cache, clears staging/lock and allows a subsequent install', { timeout: 10000 }, async t => {
    let entered = false, hold = true;
    const f = await fixture(t, { downloadFile: async (url, destination, options) => {
        if (!hold) return download(url, destination, options);
        entered = true; await fsp.writeFile(destination + '.part', 'partial');
        await new Promise((_, reject) => {
            const abort = () => reject(Object.assign(new Error('private URL/token'), { name: 'AbortError' }));
            options.signal.addEventListener('abort', abort, { once: true }); if (options.signal.aborted) abort();
        });
    } });
    const installing = f.instance.install(); const checked = assert.rejects(installing, { code: 'CHATTERBOX_INSTALL_CANCELLED' });
    const deadline = Date.now() + 2000; while (!entered && Date.now() < deadline) await turn(); assert.ok(entered);
    assert.equal(f.instance.info().installing, true); assert.equal((await f.instance.status()).installing, true);
    f.instance.cancel(); await checked;
    assert.equal(f.instance.info().progress.phase, 'cancelled');
    assert.ok(fs.existsSync(path.join(path.dirname(f.root), '.chatterbox-v3.downloads/runtime.zip.part')));
    hold = false; assert.equal((await f.instance.install()).available, true);
});
test('same-root instance lock and filesystem lock prevent overlapping installs', { timeout: 10000 }, async t => {
    let entered = false;
    const f = await fixture(t, { downloadFile: async (_url, _destination, options) => {
        entered = true; await new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error(), { name: 'AbortError' })), { once: true }));
    } });
    const first = f.instance.install(); const checked = assert.rejects(first, { code: 'CHATTERBOX_INSTALL_CANCELLED' });
    const deadline = Date.now() + 2000; while (!entered && Date.now() < deadline) await turn(); assert.ok(entered);
    const second = f.manager(); await assert.rejects(second.install(), { code: 'CHATTERBOX_INSTALL_BUSY' }); second.close(); f.instance.cancel(); await checked;
    const lockFile = path.join(path.dirname(f.root), '.chatterbox-v3.install.lock'); await fsp.writeFile(lockFile, 'other-process');
    await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_INSTALL_BUSY' }); assert.equal(await fsp.readFile(lockFile, 'utf8'), 'other-process');
});
test('observer exceptions never fail installation; public failures cannot leak provider messages', async t => {
    const f = await fixture(t, { onProgress: () => { throw new Error('observer'); } }); assert.equal((await f.instance.install()).available, true);
    const broken = await fixture(t, { downloadFile: async () => { throw new Error('https://private.invalid/secret'); } });
    await assert.rejects(broken.instance.install(), err => err.code === 'CHATTERBOX_INSTALL_FAILED' && !err.message.includes('secret'));
});
test('constructor rejects relative roots, closed/pre-aborted install fails without network access', async t => {
    const { createChatterboxPackManager } = require(managerPath);
    assert.throws(() => createChatterboxPackManager({ root: 'relative' }), { code: 'CHATTERBOX_ROOT_REQUIRED' });
    const f = await fixture(t), controller = new AbortController(); controller.abort();
    await assert.rejects(f.instance.install({ signal: controller.signal }), { code: 'CHATTERBOX_INSTALL_CANCELLED' });
    f.instance.close(); await assert.rejects(f.instance.install(), { code: 'CHATTERBOX_CLOSED' }); assert.equal(f.calls.length, 0);
});
