"use strict";

const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const {
    downloadFile, assertSafePath, safeRelativePath, assertSafeTree, ensureDirectory,
    checkDiskSpace, hashFile, failure, throwIfAborted, emit
} = require("./download.cjs");
const { manifestFiles, contentDescriptor, parseContentPackage, containsPath, RUNTIME_REFERENCE } = require("./game-content.cjs");

function versionIsNewer(available, installed) {
    if (!available || available === installed) return false;
    if (!installed) return true;
    const parse = value => /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
    const a = parse(available), b = parse(installed);
    if (!a || !b) return available !== installed;
    const av = a[1].split(".").map(Number), bv = b[1].split(".").map(Number);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
        if ((av[i] || 0) !== (bv[i] || 0)) return (av[i] || 0) > (bv[i] || 0);
    }
    if (!a[2] || !b[2]) return Boolean(b[2]) && !a[2];
    const ap = a[2].split("."), bp = b[2].split(".");
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        if (ap[i] === undefined || bp[i] === undefined) return bp[i] === undefined;
        if (ap[i] === bp[i]) continue;
        const an = /^\d+$/.test(ap[i]), bn = /^\d+$/.test(bp[i]);
        if (an && bn) return Number(ap[i]) > Number(bp[i]);
        if (an !== bn) return !an;
        return ap[i] > bp[i];
    }
    return false;
}

function defaultPreservedPaths(id, definition) {
    const paths = ["settings.json", "saves", "options.txt", "euler-api-key.txt"];
    if (definition.minecraft || ["battle-royale", "snow-war", "zombie-war"].includes(id)) {
        paths.push("game-instance/config", "game-instance/saves", "game-instance/options.txt",
            "game-instance/optionsof.txt", "game-instance/servers.dat", "game-instance/resourcepacks",
            "game-instance/shaderpacks", "game-instance/screenshots");
    }
    if (definition.configFile) {
        safeRelativePath(definition.configFile);
        paths.push(`game-instance/config/${definition.configFile}`);
    }
    if (definition.klasor === "tiktok-vs" || ["vs", "puanlama"].includes(id)) {
        paths.push(".gift-slots.json", ".coin-data.json", ".gift-catalog.json");
    }
    if (id === "pony-life") paths.push("data/pony-live.json");
    if (id === "gelene-gecene") paths.push("unturned_mng_config.json");
    return paths;
}

function readJson(file) {
    assertSafePath(file);
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

async function atomicJson(file, value, signal) {
    assertSafePath(file);
    ensureDirectory(path.dirname(file));
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    let handle;
    try {
        handle = await fsp.open(temporary, "wx", 0o600);
        await handle.writeFile(JSON.stringify(value, null, 2));
        await handle.sync();
        await handle.close();
        handle = null;
        throwIfAborted(signal);
        assertSafePath(file);
        await fsp.rename(temporary, file);
    } finally {
        await handle?.close().catch(() => {});
        await fsp.rm(temporary, { force: true }).catch(() => {});
    }
}

function archiveTools() {
    const extract = require("extract-zip");
    // Resolve the parser through extract-zip so the parent needs just one dependency.
    const yauzl = createRequire(require.resolve("extract-zip"))("yauzl");
    return { extract, yauzl };
}

async function inspectArchive(file, destination, signal) {
    const { yauzl } = archiveTools();
    assertSafePath(file);
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        yauzl.open(file, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
            if (error) return reject(error);
            let settled = false;
            let bytes = 0;
            let count = 0;
            const entries = new Map();
            const fail = error => {
                if (settled) return;
                settled = true;
                signal?.removeEventListener("abort", abort);
                zip.close();
                reject(error);
            };
            const abort = () => { try { throwIfAborted(signal); } catch (error) { fail(error); } };
            signal?.addEventListener("abort", abort, { once: true });
            zip.on("error", fail);
            zip.on("entry", entry => {
                try {
                    throwIfAborted(signal);
                    if (++count > 250000) throw failure("EARCHIVE", "Archive contains too many entries");
                    const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
                    const directory = entry.fileName.endsWith("/") || mode === 0o040000 ||
                        (entry.versionMadeBy >>> 8 === 0 && entry.externalFileAttributes === 16);
                    if (mode && mode !== 0o040000 && mode !== 0o100000) {
                        throw failure("EUNSAFEPATH", "Archive links and special files are forbidden");
                    }
                    if (entry.generalPurposeBitFlag & 1) throw failure("EARCHIVE", "Encrypted archives are unsupported");
                    const relative = safeRelativePath(entry.fileName.replace(/\/$/, ""));
                    const key = relative.normalize("NFC").toLowerCase();
                    if (entries.has(key)) throw failure("EUNSAFEPATH", "Duplicate archive path");
                    entries.set(key, { relative, directory });
                    if (!directory) {
                        bytes += entry.uncompressedSize;
                        if (!Number.isSafeInteger(bytes)) throw failure("EARCHIVE", "Archive is too large");
                    }
                    zip.readEntry();
                } catch (error) { fail(error); }
            });
            zip.on("end", () => {
                if (settled) return;
                try {
                    // Include implicit parents to reject file/directory and case aliases before writing.
                    const parents = new Map();
                    for (const [key, entry] of entries) {
                        const parts = entry.relative.split("/");
                        for (let i = 1; i < parts.length; i++) {
                            const relative = parts.slice(0, i).join("/");
                            const parent = relative.normalize("NFC").toLowerCase();
                            if ((entries.has(parent) && (!entries.get(parent).directory || entries.get(parent).relative !== relative)) ||
                                (parents.has(parent) && parents.get(parent) !== relative)) {
                                throw failure("EUNSAFEPATH", "Conflicting archive paths");
                            }
                            parents.set(parent, relative);
                        }
                        if (parents.has(key) && (!entry.directory || parents.get(key) !== entry.relative)) {
                            throw failure("EUNSAFEPATH", "Conflicting archive paths");
                        }
                    }
                    throwIfAborted(signal);
                    checkDiskSpace(destination, bytes).then(() => {
                        if (settled) return;
                        settled = true;
                        signal?.removeEventListener("abort", abort);
                        resolve(bytes);
                    }, fail);
                } catch (error) { fail(error); }
            });
            if (signal?.aborted) abort();
            if (!settled) zip.readEntry();
        });
    });
}

/** Independent CJS library. state/pathFor and validate/resolveLegacy are synchronous.
 * getPackage, extract, isRunning and preservePaths may be asynchronous.
 * remove writes a tombstone: existing versions and external legacy data are retained.
 * state consults synchronous catalog readers; async readers use metadata cached by install,
 * falling back to definition.paketSurumu/version. Metadata errors never hide playable games.
 */
function createGameLibrary(options) {
    const { definitions, resolveLegacy = () => null, validate, getPackage, onProgress,
        isRunning = () => false, preservePaths = () => [], extract } = options;
    if (typeof options.root !== "string" || !path.isAbsolute(options.root)) throw failure("EINVAL", "root must be absolute");
    if (!definitions || typeof validate !== "function" || typeof getPackage !== "function") {
        throw failure("EINVAL", "definitions, validate and getPackage are required");
    }
    const root = assertSafePath(options.root);
    const base = path.join(root, ".game-library");
    const records = new Map();
    const available = new Map();
    const inFlight = new Map();
    const packages = new Map();
    const runtimeTasks = new Map();
    let asyncPackageReader = getPackage.constructor?.name === "AsyncFunction";
    const entries = Array.isArray(definitions) ? definitions.map(def => [def.id, def]) : Object.entries(definitions);
    for (const [alias, definition] of entries) {
        safeRelativePath(alias);
        const id = definition.id || alias;
        const key = String(definition.klasor || id).normalize("NFC").toLowerCase();
        if (safeRelativePath(key).includes("/") || safeRelativePath(id).includes("/")) {
            throw failure("EUNSAFEPATH", "Game identifiers must be single path components");
        }
        const directory = path.join(base, key);
        records.set(alias, { id, key, definition, directory, pointer: path.join(directory, "active.json") });
        if (!packages.has(key)) packages.set(key, id);
    }
    for (const record of [...records.values()]) {
        if (!records.has(record.id)) records.set(record.id, record);
    }
    // Different aliases for one physical package must share a lock and activation pointer.
    const recordFor = id => {
        const record = records.get(id);
        if (!record) throw failure("EINVAL", `Unknown game: ${id}`);
        return record;
    };
    function pointerFor(record) {
        const pointer = readJson(record.pointer);
        if (!pointer) return null;
        if (pointer.schema !== 1 || (pointer.directory !== undefined &&
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(pointer.directory)) ||
            (pointer.removed !== true && (typeof pointer.version !== "string" || !pointer.directory))) {
            throw failure("EUNSAFEPATH", "Invalid library activation pointer");
        }
        return pointer;
    }
    function legacyFor(record) {
        const result = resolveLegacy(record.id);
        if (result?.then) throw failure("EINVAL", "resolveLegacy must be synchronous");
        const dir = typeof result === "string" ? result : result?.path;
        if (!dir) return null;
        if (!path.isAbsolute(dir)) throw failure("EUNSAFEPATH", "Legacy paths must be absolute");
        assertSafePath(dir);
        if (!fs.existsSync(dir)) return null;
        return { path: path.resolve(dir), version: typeof result?.version === "string" ? result.version : null };
    }
    function sourceFor(record, includeRemoved = false) {
        const pointer = pointerFor(record);
        if (pointer?.removed && !includeRemoved) return null;
        if (pointer?.directory) {
            const dir = assertSafePath(path.join(record.directory, "versions", pointer.directory));
            if (fs.existsSync(dir)) return { path: dir, version: pointer.version || null };
        }
        return legacyFor(record);
    }
    function valid(dir, id) {
        assertSafePath(dir);
        const result = validate(dir, id);
        if (result?.then) throw failure("EINVAL", "validate must be synchronous for state/pathFor");
        return Boolean(result);
    }
    function installedVersion(source) {
        if (source.version) return source.version;
        for (const name of [".tikmng-package.json", "mng-version.json"]) {
            try {
                const marker = readJson(path.join(source.path, name));
                if (typeof marker?.version === "string") return marker.version;
            } catch (error) { if (error.code === "EUNSAFEPATH") throw error; }
        }
        return null;
    }
    function stateFor(record, refreshAvailability = true) {
        if (refreshAvailability && !asyncPackageReader) {
            try {
                const pkg = getPackage(packages.get(record.key));
                if (pkg?.then) {
                    asyncPackageReader = true;
                    Promise.resolve(pkg).catch(() => {});
                } else if (typeof pkg?.version === "string" && pkg.version.trim()) {
                    available.set(record.key, pkg.version);
                }
            } catch {}
        }
        const source = sourceFor(record);
        const installed = Boolean(source && valid(source.path, record.id));
        const version = installed ? installedVersion(source) : null;
        const availableVersion = available.get(record.key) || record.definition.paketSurumu || record.definition.version || null;
        return { installed, installedVersion: version, availableVersion,
            updateAvailable: installed && versionIsNewer(availableVersion, version), path: installed ? source.path : null };
    }
    const state = id => stateFor(recordFor(id));
    const pathFor = id => state(id).path;
    async function assertNotRunning(record) {
        for (const candidate of records.values()) {
            if (candidate.key === record.key && await isRunning(candidate.id)) {
                throw failure("EBUSY", "Close the game before changing its installation");
            }
        }
    }
    function progress(id, phase, message, metrics = {}) {
        emit(onProgress, { percent: null, transferredBytes: 0,
            totalBytes: null, speedBps: 0, etaSeconds: null, ...metrics, oyun: id, phase, message });
    }
    async function copyTree(source, destination, signal) {
        await assertSafeTree(source, signal);
        assertSafePath(destination);
        await fsp.cp(source, destination, { recursive: true, force: true, dereference: false,
            filter: entry => { throwIfAborted(signal); assertSafePath(entry); return true; } });
        await assertSafeTree(destination, signal);
    }
    async function preservedPaths(record) {
        const extra = await preservePaths(record.id) || [];
        if (!Array.isArray(extra)) throw failure("EINVAL", "preservePaths must return an array");
        const all = [...defaultPreservedPaths(record.id, record.definition), ...extra].map(safeRelativePath);
        return [...new Set(all)].filter(relative => !all.some(parent => relative.startsWith(`${parent}/`)));
    }
    async function preserve(source, destination, paths, signal) {
        if (!source) return;
        for (const relative of paths) {
            throwIfAborted(signal);
            const from = assertSafePath(path.join(source, relative));
            if (!fs.existsSync(from)) continue;
            const to = assertSafePath(path.join(destination, relative));
            // Replace this mutable subtree rather than merging stale package defaults into saves.
            await assertSafeTree(from, signal);
            if (fs.existsSync(to)) {
                await assertSafeTree(to, signal);
                await fsp.rm(to, { recursive: true, force: true });
            }
            ensureDirectory(path.dirname(to));
            await copyTree(from, to, signal);
        }
    }
    async function findPackageRoot(staging, id, signal) {
        let layer = [staging];
        for (let depth = 0; depth <= 3; depth++) {
            const matches = layer.filter(dir => valid(dir, id));
            if (matches.length > 1) throw failure("EPACKAGE", "Archive has multiple possible game roots");
            if (matches.length === 1) return matches[0];
            const next = [];
            for (const dir of layer) {
                throwIfAborted(signal);
                for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
                    if (entry.isDirectory() && !entry.name.startsWith(".")) next.push(path.join(dir, entry.name));
                }
            }
            layer = next;
        }
        throw failure("EPACKAGE", "Package is missing required game files");
    }
    async function matches(file, descriptor, signal) {
        assertSafePath(file);
        let stat;
        try { stat = await fsp.stat(file); } catch (error) {
            if (["ENOENT", "ENOTDIR"].includes(error.code)) return false;
            throw error;
        }
        return stat.isFile() && stat.size === descriptor.bytes && await hashFile(file, signal) === descriptor.sha256;
    }
    async function cachedDownload(descriptor, cached, signal, onProgress) {
        if (await matches(cached, descriptor, signal)) return;
        await downloadFile(descriptor.url, cached, { sha256: descriptor.sha256, bytes: descriptor.bytes, signal, onProgress });
    }
    async function verifyFileTree(directory, files, signal, exact = true, runtimeCache = false) {
        if (!fs.existsSync(directory)) return false;
        await assertSafeTree(directory, signal);
        let good = true;
        const expected = new Set(files.map(file => file.path));
        const visit = async (dir, prefix = '') => {
            for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
                throwIfAborted(signal);
                const relative = prefix + entry.name;
                if (entry.isDirectory()) await visit(path.join(dir, entry.name), relative + '/');
                else if (!expected.has(relative) && !(runtimeCache && /^assets\/skins\/[a-f0-9]{2}\/[a-f0-9]{40}$/i.test(relative))) good = false;
            }
        };
        if (exact) await visit(directory);
        await require('./transfer-pool.cjs').transferPool(files, async (file, verifySignal) => {
            if (!await matches(path.join(directory, file.path), file, verifySignal)) good = false;
        }, { signal, concurrency: 4 });
        return good;
    }
    async function unpackVerified(archive, directory, files, signal) {
        const unpackedBytes = await inspectArchive(archive, directory, signal);
        if (unpackedBytes !== files.reduce((sum, file) => sum + file.bytes, 0)) {
            throw failure('EPACKAGE', 'Archive size disagrees with content manifest');
        }
        await archiveTools().extract(archive, { dir: directory });
        if (!await verifyFileTree(directory, files, signal)) throw failure('EHASH', 'Archive contents disagree with content manifest');
    }
    async function ensureSharedRuntime(record, component, source, signal) {
        const digest = component.id;
        if (runtimeTasks.has(digest)) {
            await runtimeTasks.get(digest);
            throwIfAborted(signal);
            return path.join(base, 'shared-runtimes', digest, 'runtime');
        }
        const task = (async () => {
            const shared = path.join(base, 'shared-runtimes');
            ensureDirectory(shared);
            const final = assertSafePath(path.join(shared, digest));
            const runtime = path.join(final, 'runtime');
            const receipt = path.join(final, '.tikmng-runtime-complete.json');
            progress(record.id, 'runtime-checking', 'Checking shared Java and game engine');
            if (readJson(receipt)?.sha256 === digest && await verifyFileTree(runtime, component.files, signal, true, true)) return runtime;
            // Never replace a shared component while another managed game may use it.
            if (fs.existsSync(final)) {
                for (const candidate of records.values()) {
                    if (await isRunning(candidate.id)) throw failure('EBUSY', 'Close all games before repairing the shared engine');
                }
            }
            const lock = assertSafePath(path.join(shared, digest + '.lock'));
            let handle;
            try { handle = await fsp.open(lock, 'wx', 0o600); }
            catch (error) {
                if (error.code === 'EEXIST') throw failure('EBUSY', 'Another launcher is preparing the shared game engine');
                throw error;
            }
            const stage = path.join(shared, 'stage-' + crypto.randomUUID());
            const backup = path.join(shared, 'repair-' + crypto.randomUUID());
            const cached = path.join(shared, digest + '.zip');
            let movedOld = false;
            try {
                await handle.writeFile(JSON.stringify({ pid: process.pid }));
                ensureDirectory(stage);
                const stagedRuntime = path.join(stage, 'runtime');
                ensureDirectory(stagedRuntime);
                const total = component.files.reduce((sum, file) => sum + file.bytes, 0);
                await checkDiskSpace(shared, total + component.archive.bytes);
                let legacyRuntime;
                if (source) { try { legacyRuntime = require('./runtime-location.cjs').runtimeDirectory(source); } catch {} }
                if (legacyRuntime && await verifyFileTree(legacyRuntime, component.files, signal, false)) {
                    progress(record.id, 'runtime-preparing', 'Reusing verified installed game engine');
                    await require('./transfer-pool.cjs').transferPool(component.files, async (file, copySignal) => {
                        throwIfAborted(copySignal);
                        const target = assertSafePath(path.join(stagedRuntime, file.path));
                        ensureDirectory(path.dirname(target));
                        await fsp.copyFile(assertSafePath(path.join(legacyRuntime, file.path)), target, fs.constants.COPYFILE_FICLONE);
                    }, { signal, concurrency: 4 });
                    if (!await verifyFileTree(stagedRuntime, component.files, signal)) throw failure('EHASH', 'Copied runtime failed verification');
                } else {
                    progress(record.id, 'runtime-downloading', 'Downloading shared game engine (once)', { totalBytes: component.archive.bytes });
                    await cachedDownload(component.archive, cached, signal, metrics => progress(record.id,
                        'runtime-downloading', 'Downloading shared game engine (once)', metrics));
                    progress(record.id, 'runtime-preparing', 'Preparing shared game engine');
                    await unpackVerified(cached, stagedRuntime, component.files, signal);
                }
                await atomicJson(path.join(stage, '.tikmng-runtime-complete.json'), { schema: 1, sha256: digest }, signal);
                throwIfAborted(signal);
                if (fs.existsSync(final)) { await fsp.rename(final, backup); movedOld = true; }
                try { await fsp.rename(stage, final); }
                catch (error) { if (movedOld) await fsp.rename(backup, final); throw error; }
                // The verified component is retained independently of any game's active pointer.
                if (fs.existsSync(cached)) await fsp.unlink(assertSafePath(cached));
                return runtime;
            } finally {
                if (fs.existsSync(stage)) {
                    await assertSafeTree(stage);
                    await fsp.rm(stage, { recursive: true, force: true });
                }
                // Corrupt pre-repair data is not a rollback for a game; retain it for diagnostics.
                await handle.close();
                await fsp.unlink(assertSafePath(lock));
            }
        })();
        runtimeTasks.set(digest, task);
        try { return await task; } finally { runtimeTasks.delete(digest); }
    }
    async function installManifest(record, pkg, source, candidate, downloads, paths, signal, repair) {
        let files = manifestFiles(pkg.files, { allowControl: true });
        const control = contentDescriptor(files);
        let content;
        if (control) {
            const cached = path.join(downloads, `${control.sha256}.manifest`);
            progress(record.id, "checking", "Checking content manifest");
            await cachedDownload(control, cached, signal);
            let manifest;
            try { manifest = JSON.parse(await fsp.readFile(cached, "utf8")); } catch {
                throw failure("EMANIFEST", "Invalid content manifest JSON");
            }
            content = parseContentPackage(manifest, { packageId: record.key, version: pkg.version });
            files = content.files;
        }
        if (content?.runtime) {
            await ensureSharedRuntime(record, content.runtime, source, signal);
            await atomicJson(path.join(candidate, RUNTIME_REFERENCE), { schema: 1, sha256: content.runtime.id }, signal);
        }
        const preserved = source ? paths.filter(relative => fs.existsSync(assertSafePath(path.join(source, relative)))) : [];
        // Existing mutable subtrees replace defaults in their entirety. Never fetch
        // a publisher's settings only to overwrite them with the user's settings.
        const managed = files.filter(file => !preserved.some(relative => containsPath(relative, file.path)));
        if (managed.some(file => preserved.some(relative => containsPath(file.path, relative)))) {
            throw failure("EMANIFEST", "Package file conflicts with preserved data");
        }
        const total = files.reduce((sum, file) => sum + file.bytes, 0);
        const sourceBytes = source && !control ? await assertSafeTree(source, signal) : 0;
        await checkDiskSpace(record.directory, total + sourceBytes);
        // Complete manifests build an exact new package, dropping obsolete code.
        // Legacy inline lists remain additive patches for catalog compatibility.
        if (source && !control) await copyTree(source, candidate, signal);
        if (content?.payloadArchive && (!source || content.archiveOnly)) {
            const cached = path.join(downloads, content.payloadArchive.sha256 + '.payload.zip');
            await cachedDownload(content.payloadArchive, cached, signal, metrics => progress(record.id,
                'downloading', 'Downloading game-specific content', metrics));
            // The generated runtime reference is not publisher-controlled archive content.
            const reference = path.join(candidate, RUNTIME_REFERENCE);
            const referenceValue = readJson(reference);
            if (referenceValue) await fsp.unlink(reference);
            try { await unpackVerified(cached, candidate, files, signal); }
            finally { if (referenceValue) await atomicJson(reference, referenceValue, signal); }
            await fsp.unlink(assertSafePath(cached));
            return { candidate, metrics: { updateMode: 'shared-runtime', packageBytes: total,
                sharedRuntimeBytes: content.runtime.files.reduce((sum, file) => sum + file.bytes, 0),
                transferredBytes: content.payloadArchive.bytes, totalBytes: content.payloadArchive.bytes, reusedBytes: 0 } };
        }
        const plan = [];
        const missing = new Map();
        let reusedBytes = 0;
        progress(record.id, "verifying", repair ? "Checking repair files" : "Checking existing file hashes");
        await require('./transfer-pool.cjs').transferPool(managed, async (file, verifySignal) => {
            throwIfAborted(verifySignal);
            const from = control && source ? assertSafePath(path.join(source, file.path)) : path.join(candidate, file.path);
            const cached = path.join(downloads, `${file.sha256}.file`);
            let reuse;
            if (await matches(from, file, verifySignal)) reuse = from;
            else if (await matches(cached, file, verifySignal)) reuse = cached;
            if (reuse) reusedBytes += file.bytes;
            else {
                if (typeof file.url !== "string" || !file.url) throw failure("EMANIFEST", `No URL for missing/changed file: ${file.path}`);
                const previous = missing.get(file.sha256);
                if (previous && previous.bytes !== file.bytes) throw failure("EMANIFEST", "Conflicting sizes for one content hash");
                missing.set(file.sha256, previous || file);
            }
            plan.push({ file, from: reuse || cached });
        }, { signal, concurrency: 4 });
        const transferTotal = [...missing.values()].reduce((sum, file) => sum + file.bytes, 0);
        const metrics = { updateMode: control ? "content" : "files", packageBytes: total, reusedBytes,
            changedFiles: missing.size, totalBytes: transferTotal };
        let completed = 0;
        progress(record.id, "downloading", "Downloading changed game content", { ...metrics,
            percent: transferTotal === 0 ? 100 : 0 });
        const activeTransfers = new Map();
        const transferStarted = performance.now();
        await require('./transfer-pool.cjs').transferPool([...missing.values()], async (file, transferSignal) => {
            throwIfAborted(transferSignal);
            const cached = path.join(downloads, `${file.sha256}.file`);
            await downloadFile(file.url, cached, { sha256: file.sha256, bytes: file.bytes, signal: transferSignal,
                onProgress: downloadMetrics => {
                    activeTransfers.set(file.sha256, downloadMetrics.transferredBytes);
                    const transferredBytes = completed + [...activeTransfers.values()].reduce((a,b)=>a+b,0);
                    const speedBps = transferredBytes / Math.max(.001,(performance.now()-transferStarted)/1000);
                    progress(record.id, "downloading", `Downloading ${file.path}`, {
                        ...metrics, transferredBytes, totalBytes: transferTotal, speedBps,
                        percent: transferTotal === 0 ? 100 : transferredBytes / transferTotal * 100,
                        etaSeconds: speedBps > 0 ? Math.max(0,(transferTotal-transferredBytes)/speedBps) : null
                    });
                } });
            activeTransfers.delete(file.sha256);
            completed += file.bytes;
        }, { signal, concurrency: 4 });
        progress(record.id, "verifying", "Preparing verified game content", { ...metrics, transferredBytes: completed });
        await require('./transfer-pool.cjs').transferPool(plan, async ({ file, from }, prepareSignal) => {
            throwIfAborted(prepareSignal);
            const target = assertSafePath(path.join(candidate, file.path));
            if (from !== target) {
                if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
                    await assertSafeTree(target, prepareSignal);
                    await fsp.rm(target, { recursive: true, force: true });
                }
                ensureDirectory(path.dirname(target));
                // A reflink is copy-on-write; no hardlinks to writable old versions/cache.
                await fsp.copyFile(from, target, fs.constants.COPYFILE_FICLONE);
            }
            if (!await matches(target, file, prepareSignal)) throw failure("EHASH", `Staged content changed: ${file.path}`);
        }, { signal, concurrency: 4 });
        return { candidate, metrics: { ...metrics, transferredBytes: completed } };
    }
    async function performInstall(record, { repair = false, signal } = {}) {
        let staging;
        let activated = false;
        try {
            throwIfAborted(signal);
            await assertNotRunning(record);
            progress(record.id, "checking", "Checking package information");
            const pkg = await getPackage(packages.get(record.key), { hasExisting: Boolean(sourceFor(record, true)) });
            throwIfAborted(signal);
            if (!pkg || typeof pkg.version !== "string" || !pkg.version.trim() || pkg.version.length > 200) {
                throw failure("EPACKAGE", "Package version is required");
            }
            available.set(record.key, pkg.version);
            const currentState = stateFor(record, false);
            if (!repair && currentState.installed && !versionIsNewer(pkg.version, currentState.installedVersion)) {
                progress(record.id, "complete", "Game already up to date", { percent: 100 });
                return currentState;
            }
            const source = sourceFor(record, true);
            if (source) await assertSafeTree(source.path, signal);
            const paths = await preservedPaths(record);
            ensureDirectory(record.directory);
            const versions = path.join(record.directory, "versions");
            const downloads = path.join(record.directory, "downloads");
            const stagingParent = path.join(record.directory, "staging");
            for (const dir of [versions, downloads, stagingParent]) ensureDirectory(dir);
            await checkDiskSpace(record.directory);
            const nonce = crypto.randomUUID();
            staging = path.join(stagingParent, nonce);
            ensureDirectory(staging);
            let candidate;
            let transferMetrics = {};
            if (pkg.files !== undefined) {
                ({ candidate, metrics: transferMetrics } = await installManifest(record, pkg, source?.path, staging, downloads, paths, signal, repair));
            } else {
                const identity = crypto.createHash("sha256").update(JSON.stringify([pkg.version, pkg.url, pkg.sha256, pkg.bytes])).digest("hex");
                const zip = path.join(downloads, `${identity}.zip`);
                await downloadFile(pkg.url, zip, { sha256: pkg.sha256, bytes: pkg.bytes, signal,
                    onProgress: metrics => progress(record.id, "downloading", "Downloading game package", metrics) });
                progress(record.id, "extracting", "Checking archive paths and available space");
                await inspectArchive(zip, staging, signal);
                throwIfAborted(signal);
                // Preflight rejects every unsafe entry before either extractor can write anything.
                if (extract) await extract(zip, staging);
                else await archiveTools().extract(zip, { dir: staging });
                throwIfAborted(signal);
                await assertSafeTree(staging, signal);
                candidate = await findPackageRoot(staging, record.id, signal);
                const marker = readJson(path.join(candidate, ".tikmng-package.json"));
                if (marker?.version && String(marker.version) !== pkg.version) throw failure("EPACKAGE", "Archive version disagrees with package version");
            }
            progress(record.id, "preserving", "Preserving game settings and saves");
            let preservedBytes = 0;
            if (source) {
                for (const relative of paths) {
                    const from = assertSafePath(path.join(source.path, relative));
                    if (fs.existsSync(from)) preservedBytes += await assertSafeTree(from, signal);
                }
            }
            await checkDiskSpace(record.directory, preservedBytes);
            await preserve(source?.path, candidate, paths, signal);
            progress(record.id, "validating", "Validating staged installation");
            await assertSafeTree(candidate, signal);
            if (!valid(candidate, record.id)) throw failure("EPACKAGE", "Staged installation failed validation");
            await atomicJson(path.join(candidate, ".tikmng-package.json"), {
                game: record.key, version: pkg.version, installedAt: new Date().toISOString()
            }, signal);
            await assertNotRunning(record);
            throwIfAborted(signal);
            const previous = pointerFor(record);
            const finalPath = assertSafePath(path.join(versions, nonce));
            progress(record.id, "activating", "Activating verified game version");
            await fsp.rename(candidate, finalPath);
            // The only commit point. A failed rename leaves the previous pointer untouched.
            await atomicJson(record.pointer, { schema: 1, directory: nonce, version: pkg.version,
                previous: previous?.directory ? { directory: previous.directory, version: previous.version } : null }, signal);
            activated = true;
            progress(record.id, "complete", "Game installation complete", { ...transferMetrics, percent: 100 });
            return { installed: true, installedVersion: pkg.version, availableVersion: pkg.version,
                updateAvailable: false, path: finalPath };
        } catch (error) {
            progress(record.id, error.name === "AbortError" ? "cancelled" : "error", error.message);
            throw error;
        } finally {
            // Never remove legacy trees or any version, including unreferenced verified versions.
            if (staging && fs.existsSync(staging)) {
                try {
                    assertSafePath(staging);
                    await assertSafeTree(staging);
                    await fsp.rm(staging, { recursive: true, force: true });
                } catch (error) {
                    if (!activated) progress(record.id, "cleanup", `Staging retained: ${error.message}`);
                }
            }
        }
    }
    function install(id, settings) {
        const record = recordFor(id);
        const pending = inFlight.get(record.key);
        if (pending?.type === "install") return pending.operation;
        if (pending) return Promise.reject(failure("EBUSY", "Library removal is in progress"));
        const operation = performInstall(record, settings);
        inFlight.set(record.key, { type: "install", operation });
        operation.then(() => inFlight.delete(record.key), () => inFlight.delete(record.key));
        return operation;
    }
    async function remove(id) {
        const record = recordFor(id);
        if (inFlight.has(record.key)) throw failure("EBUSY", "An installation is already in progress");
        const operation = (async () => {
            await assertNotRunning(record);
            const pointer = pointerFor(record);
            await atomicJson(record.pointer, { ...pointer, schema: 1, removed: true });
            progress(record.id, "removed", "Game removed from active library");
            return state(id);
        })();
        inFlight.set(record.key, { type: "remove", operation });
        try { return await operation; } finally { inFlight.delete(record.key); }
    }
    return { state, pathFor, install, remove };
}

module.exports = { createGameLibrary };
