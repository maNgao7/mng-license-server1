'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const yauzl = require('yauzl');
const { download, assertSafePath, safeRelativePath, assertSafeTree, checkDiskSpace, hashFile, throwIfAborted } = require('./download.cjs');
const { createChatterboxRuntime } = require('./chatterbox-runtime.cjs');

const RELEASE = 'https://github.com/maNgao7/mng-license-server1/releases/download/voice-pack-chatterbox-tr-v1/';
const REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18';
const REFERENCE_FILES = [
    ['d2-00331',187769,'7e0e671e3b2aa09917978d4eeecad77b962a18b11e4f98891f513f5aa5bf4807'],
    ['d2-00919',192041,'00363e96a14f23c9aacdaad06f9f7913b1e37af61f86e855ba5d79cd2ffb5ae0'],
    ['d1-00525',202413,'5877fb2297a5500907c3d2bcca4b6e1527bb7bf51121dc373250773a579ad5b5'],
    ['d1-02311',194906,'cd67127cc8138cea2311fd2dc2c26add8c0816a5d6fabbc42cc73eb073093d95'],
    ['d1-02057',236602,'cd580bd76b8214df2addccde97f26cccd099262db1d1de856c54ee1d4d2ba8a5'],
    ['d2-00703',205978,'24a70228c54d62271aa8ed73f9f368b1c7aeb73c95f5db4a4b39caf26cbcaf5e'],
    ['d1-01027',220601,'7719514529d2adb93af9113e1406e2bba74b408828868ef87acbb185ae5f7ab9'],
    ['d1-00884',161891,'be321cf26256b6dc8e4e628cc555cdc2d0a7cbbfaf7509d80128fbcf80a70036'],
    ['d1-00781',194750,'e152a6e2327b161e68af96aad722160b506c3f9e74332c6c7ead148be4e00b76'],
    ['d1-00727',272450,'73222052b5d6f7b5b0b8e383ce2f45cba343bcaad16f7cc83a31d00ab7909c1f']
];
const MODEL_FILES = [
    ['t3_mtl23ls_v3.safetensors', 2143989928, '5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953'],
    ['s3gen.pt', 1057165844, '9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3'],
    ['ve.pt', 5698626, '4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1'],
    ['conds.pt', 107374, '6552d70568833628ba019c6b03459e77fe71ca197d5c560cef9411bee9d87f4e'],
    ['Cangjie5_TC.json', 1920163, '7073fd9de919443ae88e0bd2449917a65fe54898a4413ed1edcc4b67f28bce8c'],
    ['grapheme_mtl_merged_expanded_v1.json', 69989, '69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf']
];
// Immutable download authority. This catalog is never supplied by renderer IPC.
const PACK = Object.freeze({
    id: 'chatterbox-tr-v1', version: '1.0.0', name: 'Chatterbox 10 Türkçe Ses', voices: 10,
    runtimeManifestSha256: 'bbe50d9d515bee7f0cc4d78f8352c55efce20f16c1137b33e994b7884edc8dc6',
    referencesManifestSha256: 'ab5a81b0b1a684d4b73bf6be0ff53646bedd0994bfbe8b1be25e27b65205950a',
    archives: Object.freeze([
        Object.freeze({ name: 'tikmng-chatterbox-runtime-win-x64-v1.zip', bytes: 465898682, sha256: 'e8f5f56181ec145377c448cfdb37568f7a769cc039399e79e1402e456b2336a5', kind: 'runtime', maxFiles: 31000, maxBytes: 2100000000 }),
        Object.freeze({ name: 'tikmng-chatterbox-references-tr-v1.zip', bytes: 2070014, sha256: 'd1e8ecee32a75c8c246d978aa3679fed8b6ee1d484889bc275e83d1c49b94960', kind: 'references', maxFiles: 20, maxBytes: 5000000 })
    ]),
    models: Object.freeze(MODEL_FILES.map(([name, bytes, sha256]) => Object.freeze({ name, bytes, sha256,
        url: `https://huggingface.co/ResembleAI/chatterbox/resolve/${REVISION}/${name}` }))),
    referenceManifest: Object.freeze({ name: 'tikmng-chatterbox-voices-tr-v1.json', bytes: 5809,
        sha256: 'ab5a81b0b1a684d4b73bf6be0ff53646bedd0994bfbe8b1be25e27b65205950a', url: RELEASE + 'tikmng-chatterbox-voices-tr-v1.json' }),
    references: Object.freeze(REFERENCE_FILES.map(([id, bytes, sha256]) => Object.freeze({ id, name: id + '.flac', bytes, sha256,
        url: RELEASE + `tikmng-chatterbox-voice-${id}-v1.flac` })))
});
const failure = code => Object.assign(new Error(code), { code });
const emit = (callback, value) => { try { callback?.(value); } catch {} };
const locks = new Set();

function allowedEntry(name, kind, directory) {
    const stem = directory ? name.slice(0, -1) : name;
    safeRelativePath(stem);
    if (kind === 'runtime') return stem.startsWith('runtime/') || stem.startsWith('licenses/')
        || (directory && ['runtime', 'licenses'].includes(stem)) || (!directory && stem === 'runtime-manifest.json');
    return stem.startsWith('references/') || (directory && stem === 'references');
}

/** Only new staging trees are accepted; every entry is validated before writing. */
async function extractArchive(archive, destination, spec, signal) {
    throwIfAborted(signal); assertSafePath(archive); assertSafePath(destination);
    const zip = await new Promise((resolve, reject) => yauzl.open(archive, { lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true },
        (error, value) => error ? reject(error) : resolve(value)));
    let stream, sink, settled = false, entries = 0, total = 0;
    const names = new Set();
    return new Promise((resolve, reject) => {
        const finish = error => {
            if (settled) return;
            settled = true; signal?.removeEventListener('abort', abort);
            stream?.destroy(); sink?.destroy(); zip.close();
            if (error) reject(error); else resolve();
        };
        const abort = () => finish(failure('CHATTERBOX_INSTALL_CANCELLED'));
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) return abort();
        zip.once('error', finish);
        zip.once('end', () => finish());
        zip.on('entry', entry => {
            (async () => {
                throwIfAborted(signal);
                const name = entry.fileName, directory = name.endsWith('/'), mode = entry.externalFileAttributes >>> 16;
                const type = mode & 0o170000;
                if (++entries > spec.maxFiles || !allowedEntry(name, spec.kind, directory) || (entry.generalPurposeBitFlag & 1)
                    || (type && type !== (directory ? 0o040000 : 0o100000)) || (entry.externalFileAttributes & 0x400)
                    || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0) throw failure('CHATTERBOX_ARCHIVE_INVALID');
                const key = name.replace(/\/$/, '').toLowerCase();
                if (names.has(key)) throw failure('CHATTERBOX_ARCHIVE_INVALID');
                names.add(key); total += entry.uncompressedSize;
                if (total > spec.maxBytes || (directory && entry.uncompressedSize !== 0)) throw failure('CHATTERBOX_ARCHIVE_INVALID');
                const target = assertSafePath(path.join(destination, ...name.replace(/\/$/, '').split('/')));
                const relative = path.relative(destination, target);
                if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw failure('CHATTERBOX_ARCHIVE_INVALID');
                await fsp.mkdir(directory ? target : path.dirname(target), { recursive: true });
                throwIfAborted(signal); assertSafePath(target);
                if (!directory) {
                    stream = await new Promise((done, fail) => zip.openReadStream(entry, (err, value) => err ? fail(err) : done(value)));
                    if (settled) { stream.destroy(); return; }
                    let received = 0;
                    const meter = new Transform({ transform(chunk, _encoding, done) {
                        received += chunk.length;
                        done(received > entry.uncompressedSize ? failure('CHATTERBOX_ARCHIVE_INVALID') : null, chunk);
                    } });
                    sink = fs.createWriteStream(target, { flags: 'wx' });
                    await pipeline(stream, meter, sink, { signal });
                    if (received !== entry.uncompressedSize) throw failure('CHATTERBOX_ARCHIVE_INVALID');
                    stream = undefined; sink = undefined;
                }
                if (!settled) zip.readEntry();
            })().catch(finish);
        });
        zip.readEntry();
    });
}

/** root is the final userData/voices/chatterbox-v3 directory, outside the app. */
function createChatterboxPackManager({ root, onProgress, downloadFile = download, runtimeFactory = createChatterboxRuntime } = {}) {
    if (typeof root !== 'string' || !path.isAbsolute(root) || typeof downloadFile !== 'function' || typeof runtimeFactory !== 'function') throw failure('CHATTERBOX_ROOT_REQUIRED');
    root = assertSafePath(path.resolve(root));
    if (root === path.parse(root).root || path.dirname(root) === path.parse(root).root && path.basename(root).length < 4) throw failure('CHATTERBOX_ROOT_REQUIRED');
    const parent = path.dirname(root), name = safeRelativePath(path.basename(root));
    const cache = assertSafePath(path.join(parent, '.' + name + '.downloads'));
    const lockPath = path.join(parent, '.' + name + '.install.lock');
    const files = [...PACK.archives.map(file => ({ ...file, url: RELEASE + file.name })), ...PACK.models];
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    let current, progress = null, closed = false, activeTotal = totalBytes, activeVoiceId;

    function info() {
        return { id: PACK.id, version: PACK.version, name: PACK.name, downloadBytes: totalBytes,
            commonBytes: PACK.archives[0].bytes + PACK.models.reduce((sum, file) => sum + file.bytes, 0) + (PACK.referenceManifest?.bytes || 0),
            voices: (PACK.references || []).map(({ id, bytes }) => ({ id, downloadBytes: bytes })),
            installing: Boolean(current), progress: progress && { ...progress },
            downloadReady: files.every(file => /^[a-f0-9]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes > 0) };
    }

    function report(phase, completedBytes, detail = {}) {
        progress = { id: activeVoiceId ? 'chatterbox:' + activeVoiceId : PACK.id, voiceId: activeVoiceId, phase, completedBytes, totalBytes: activeTotal,
            percent: phase === 'complete' ? 100 : Math.min(99, Math.max(0, Math.floor(completedBytes / Math.max(activeTotal, 1) * 100))), ...detail };
        emit(onProgress, { ...progress });
    }
    async function readiness(target) {
        assertSafePath(target);
        const runtime = runtimeFactory({ root: target });
        try { return await runtime.status({ refresh: true }); } finally { runtime.close(); }
    }
    async function releaseDownloads(selectedFiles) {
        // Only committed artifacts and their exact resume sidecars belong to this install.
        for (const file of selectedFiles) {
            for (const suffix of ['', '.part', '.part.json']) {
                try {
                    const filename = safeRelativePath(file.name + suffix);
                    if (path.basename(filename) !== filename) continue;
                    const target = assertSafePath(path.join(cache, filename));
                    if (!(await fsp.lstat(target)).isFile()) continue;
                    assertSafePath(target);
                    await fsp.unlink(target);
                } catch {} // Cache cleanup must not fail a verified installation.
            }
        }
        // rmdir leaves unknown files and directories intact, including known-looking folders.
        try { await fsp.rmdir(assertSafePath(cache)); } catch {}
    }
    async function status() {
        if (current) return { id: PACK.id, version: PACK.version, available: false, installed: false, installing: true, reason: null, voices: [], progress: progress && { ...progress }, downloadBytes: totalBytes };
        let state;
        try { state = await readiness(root); } catch { state = { available: false, voices: [], reason: 'CHATTERBOX_PACK_INVALID' }; }
        return { ...state, id: PACK.id, version: PACK.version, installed: Boolean(state.available), installing: false,
            progress: progress && { ...progress }, downloadBytes: totalBytes };
    }
    async function verifyReceipt() {
        if (!fs.existsSync(root)) return false;
        const state = await readiness(root);
        if (state.available || state.engineReady) return true;
        try {
            const receiptFile = assertSafePath(path.join(root, 'pack-install.json'));
            if ((await fsp.stat(receiptFile)).size > 4096) throw failure('CHATTERBOX_TARGET_OCCUPIED');
            const receipt = JSON.parse(await fsp.readFile(receiptFile, 'utf8'));
            if (receipt.id === PACK.id && receipt.version === PACK.version) return false;
        } catch {}
        throw failure('CHATTERBOX_TARGET_OCCUPIED');
    }
    async function install({ signal, voiceId } = {}) {
        if (closed) throw failure('CHATTERBOX_CLOSED');
        const reference = voiceId === undefined ? null : PACK.references?.find(file => file.id === voiceId);
        if (voiceId !== undefined && !reference) throw failure('CHATTERBOX_VOICE_INVALID');
        if (current || locks.has(root)) throw failure('CHATTERBOX_INSTALL_BUSY');
        const controller = new AbortController(), abort = () => controller.abort();
        if (signal?.aborted) throw failure('CHATTERBOX_INSTALL_CANCELLED');
        signal?.addEventListener('abort', abort, { once: true });
        current = controller; locks.add(root); activeVoiceId = voiceId; activeTotal = totalBytes;
        const staging = assertSafePath(path.join(parent, '.' + name + '.staging-' + crypto.randomUUID()));
        const backup = assertSafePath(path.join(parent, '.' + name + '.previous-' + crypto.randomUUID()));
        let lock, moved = false, committed = false;
        try {
            await fsp.mkdir(parent, { recursive: true }); assertSafePath(parent);
            try { lock = await fsp.open(assertSafePath(lockPath), 'wx'); } catch (err) {
                throw failure(err.code === 'EEXIST' ? 'CHATTERBOX_INSTALL_BUSY' : 'CHATTERBOX_INSTALL_IO');
            }
            report('verifying', 0);
            let existing;
            if (await verifyReceipt()) {
                existing = await readiness(root);
                if (reference ? existing.voices.some(voice => voice.id === voiceId) : existing.voices.length === PACK.voices) {
                    throwIfAborted(controller.signal);
                    await releaseDownloads(reference ? [reference] : files);
                    activeTotal = reference?.bytes || totalBytes; report('complete', activeTotal); return { ...existing, root, installed: true };
                }
            }
            const incremental = Boolean(reference && (existing?.engineReady || existing?.available));
            const selectedFiles = !reference ? files : incremental ? [reference] : [
                { ...PACK.archives[0], url: RELEASE + PACK.archives[0].name }, ...PACK.models, PACK.referenceManifest, reference
            ];
            activeTotal = selectedFiles.reduce((sum, file) => sum + file.bytes, 0);
            if (selectedFiles.some(file => !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0)) throw failure('CHATTERBOX_DOWNLOAD_NOT_READY');
            report('checking-space', 0);
            await checkDiskSpace(parent, incremental ? reference.bytes * 3 : activeTotal + PACK.archives[0].maxBytes + PACK.models.reduce((sum, file) => sum + file.bytes, 0));
            await fsp.mkdir(cache, { recursive: true }); assertSafePath(cache);
            await fsp.mkdir(staging); let completed = 0;
            for (const file of selectedFiles) {
                throwIfAborted(controller.signal);
                const cached = assertSafePath(path.join(cache, file.name));
                let valid = false;
                try { valid = (await fsp.stat(cached)).size === file.bytes && await hashFile(cached, controller.signal) === file.sha256; }
                catch (err) { if (err.code !== 'ENOENT') throw err; }
                if (!valid) await downloadFile(file.url, cached, { bytes: file.bytes, sha256: file.sha256, signal: controller.signal, timeoutMs: 30000, retries: 3,
                    onProgress: event => report('downloading', completed + (event.transferredBytes || 0), { file: file.name, speedBps: event.speedBps, etaSeconds: event.etaSeconds }) });
                if ((await fsp.stat(cached)).size !== file.bytes || await hashFile(cached, controller.signal) !== file.sha256) throw failure('CHATTERBOX_DOWNLOAD_INTEGRITY');
                completed += file.bytes; report('downloaded', completed, { file: file.name });
            }
            throwIfAborted(controller.signal);
            if (incremental) {
                // Only the requested speaker is added; the shared multi-GB engine never moves.
                const destination = assertSafePath(path.join(root, 'references', reference.name));
                const temporary = path.join(staging, reference.name);
                await fsp.copyFile(assertSafePath(path.join(cache, reference.name)), temporary, fs.constants.COPYFILE_EXCL);
                if (await hashFile(temporary, controller.signal) !== reference.sha256) throw failure('CHATTERBOX_DOWNLOAD_INTEGRITY');
                throwIfAborted(controller.signal);
                if (fs.existsSync(destination)) throw failure('CHATTERBOX_TARGET_OCCUPIED');
                await fsp.link(temporary, destination);
                try {
                    const ready = await readiness(root);
                    if (!ready.available || !ready.voices.some(voice => voice.id === voiceId)) throw failure('CHATTERBOX_PACK_INVALID');
                    throwIfAborted(controller.signal);
                    await releaseDownloads(selectedFiles);
                    report('complete', activeTotal); return { ...ready, root, installed: true };
                } catch (err) { await fsp.unlink(assertSafePath(destination)).catch(() => {}); throw err; }
            }
            report('extracting', activeTotal);
            for (const archive of reference ? [PACK.archives[0]] : PACK.archives) await extractArchive(path.join(cache, archive.name), staging, archive, controller.signal);
            if (reference) {
                await fsp.mkdir(path.join(staging, 'references'));
                await fsp.copyFile(assertSafePath(path.join(cache, PACK.referenceManifest.name)), path.join(staging, 'references', 'manifest.json'), fs.constants.COPYFILE_EXCL);
                await fsp.copyFile(assertSafePath(path.join(cache, reference.name)), path.join(staging, 'references', reference.name), fs.constants.COPYFILE_EXCL);
            }
            await fsp.mkdir(path.join(staging, 'model-v3'));
            for (const file of PACK.models) {
                throwIfAborted(controller.signal);
                const destination = assertSafePath(path.join(staging, 'model-v3', file.name));
                await fsp.copyFile(assertSafePath(path.join(cache, file.name)), destination, fs.constants.COPYFILE_EXCL);
                if (await hashFile(destination, controller.signal) !== file.sha256) throw failure('CHATTERBOX_DOWNLOAD_INTEGRITY');
            }
            const modelManifest = { repo: 'ResembleAI/chatterbox', revision: REVISION,
                files: PACK.models.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })) };
            await fsp.writeFile(path.join(staging, 'model-v3', 'tikmng-model-manifest.json'), JSON.stringify(modelManifest), { flag: 'wx' });
            await assertSafeTree(staging, controller.signal);
            if (await hashFile(path.join(staging, 'runtime-manifest.json'), controller.signal) !== PACK.runtimeManifestSha256
                || await hashFile(path.join(staging, 'references', 'manifest.json'), controller.signal) !== PACK.referencesManifestSha256) throw failure('CHATTERBOX_DOWNLOAD_INTEGRITY');
            report('verifying', activeTotal);
            const ready = await readiness(staging);
            if (!ready.available || (reference ? !ready.voices.some(voice => voice.id === voiceId) : ready.voices.length !== PACK.voices)) throw failure('CHATTERBOX_PACK_INVALID');
            throwIfAborted(controller.signal);
            await fsp.writeFile(path.join(staging, 'pack-install.json'), JSON.stringify({ id: PACK.id, version: PACK.version,
                runtimeManifestSha256: PACK.runtimeManifestSha256, referencesManifestSha256: PACK.referencesManifestSha256 }), { flag: 'wx' });
            if (fs.existsSync(root)) { await assertSafeTree(root, controller.signal); await fsp.rename(assertSafePath(root), backup); moved = true; }
            try { await fsp.rename(staging, assertSafePath(root)); committed = true; }
            catch (err) { if (moved) { await fsp.rename(backup, root); moved = false; } throw err; }
            await releaseDownloads(selectedFiles);
            report('complete', activeTotal);
            return { ...ready, root, installed: true };
        } catch (err) {
            const code = controller.signal.aborted || err.name === 'AbortError' ? 'CHATTERBOX_INSTALL_CANCELLED'
                : err.code?.startsWith('CHATTERBOX_') ? err.code : err.code === 'ENOSPC' ? 'CHATTERBOX_DISK_SPACE'
                : ['EUNSAFEPATH', 'EHASH', 'ESIZE'].includes(err.code) ? 'CHATTERBOX_DOWNLOAD_INTEGRITY' : 'CHATTERBOX_INSTALL_FAILED';
            report(code === 'CHATTERBOX_INSTALL_CANCELLED' ? 'cancelled' : 'error', progress?.completedBytes || 0, { reason: code });
            throw failure(code);
        } finally {
            if (committed && moved) { await assertSafeTree(backup).then(() => fsp.rm(backup, { recursive: true, force: true })).catch(() => {}); }
            if (fs.existsSync(staging)) await assertSafeTree(staging).then(() => fsp.rm(staging, { recursive: true, force: true })).catch(() => {});
            if (lock) { await lock.close(); await fsp.unlink(assertSafePath(lockPath)).catch(() => {}); }
            signal?.removeEventListener('abort', abort); current = undefined; locks.delete(root);
        }
    }
    function cancel() { current?.abort(); return { ok: true }; }
    return { info, catalog: info, status, install, cancel, close() { closed = true; cancel(); } };
}

module.exports = { createChatterboxPackManager, PACK };
