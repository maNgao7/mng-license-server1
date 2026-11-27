'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto = require('node:crypto');
const { assertSafePath } = require('./download.cjs');

function validCatalog(catalog) {
    return Array.isArray(catalog) && catalog.length > 0 &&
        catalog.every(gift => gift && typeof gift.id === 'string' && /^[1-9][0-9]*$/.test(gift.id) &&
            Number.isSafeInteger(Number(gift.id)) && gift.file === gift.id + '.png' &&
            typeof gift.name === 'string' && gift.name.trim().length > 0 &&
            Number.isSafeInteger(gift.coins) && gift.coins >= 0) &&
        new Set(catalog.map(gift => gift.id)).size === catalog.length;
}

async function authoritativeAssetFiles(bundledAssets) {
    const files = new Set();
    try {
        const catalog = JSON.parse((await fs.promises.readFile(path.join(bundledAssets, 'katalog_tam.json'), 'utf8')).replace(/^\uFEFF/, ''));
        if (!validCatalog(catalog)) return files;
        files.add('katalog_tam.json');
        for (const gift of catalog) files.add(gift.file);
        try {
            const presentation=JSON.parse(await fs.promises.readFile(path.join(bundledAssets,'visual-groups.json'),'utf8'));
            const validGroups=Array.isArray(presentation.groups)&&presentation.groups.every(group=>group&&typeof group.id==='string'&&Array.isArray(group.ids)&&group.ids.length&&group.ids.includes(group.id)&&group.ids.every(id=>typeof id==='string'));
            const ids=validGroups?presentation.groups.flatMap(group=>group.ids):[];
            const expected=new Set(catalog.map(gift=>gift.id));
            if(presentation.schemaVersion===1&&ids.length===expected.size&&new Set(ids).size===ids.length&&ids.every(id=>expected.has(id)))files.add('visual-groups.json');
        } catch(error) { if(error.code&&error.code!=='ENOENT')throw error; }
        try {
            const library = JSON.parse((await fs.promises.readFile(path.join(bundledAssets, '_kutuphane.json'), 'utf8')).replace(/^\uFEFF/, ''));
            const byId = new Map(catalog.map(gift => [gift.id, gift]));
            if (validCatalog(library) && library.length === catalog.length && library.every(gift => {
                const row = byId.get(gift.id);
                return row && row.file === gift.file && row.coins === gift.coins && row.name === gift.name;
            })) files.add('_kutuphane.json');
        } catch (error) { if (error.code && error.code !== 'ENOENT') throw error; }
    } catch (error) { if (error.code && error.code !== 'ENOENT') throw error; }
    return files;
}

const MAX_PARALLEL_COPIES = 12;
const inFlight = new Map();
const synchronized = new Map();
const metadataName = '.tikmng-shared-gifts-v1.json';

async function revision(file) {
    const stat = await fs.promises.lstat(file, { bigint: true });
    if (stat.isSymbolicLink()) throw new Error('Shared artwork must be a regular file.');
    return [stat.mtimeNs, stat.ctimeNs, stat.size, stat.ino].join(':');
}

async function stamp(source, target, fallback, files) {
    const parts = await Promise.all([
        revision(source), revision(path.join(source, 'katalog_tam.json')),
        revision(target), revision(path.join(target, 'katalog_tam.json')), revision(fallback)
    ]);
    for (let offset = 0; offset < files.length; offset += 32) {
        const batch = files.slice(offset, offset + 32).flatMap(file => [
            revision(path.join(source, file)), revision(path.join(target, file))
        ]);
        parts.push(...await Promise.all(batch));
    }
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

async function readMetadata(file, source, generation) {
    try {
        const stat = await fs.promises.lstat(file);
        if (!stat.isFile() || stat.size > 128 * 1024) return null;
        const value = JSON.parse(await fs.promises.readFile(file, 'utf8'));
        if (value.source !== source || value.generation !== generation || !/^[a-f0-9]{64}$/.test(value.stamp) ||
            !Array.isArray(value.files) || value.files.length > 4000 ||
            !value.files.every(name => typeof name === 'string' && /^(?:[1-9]\d{0,15}\.png|katalog_tam\.json|_kutuphane\.json|visual-groups\.json)$/.test(name))) return null;
        return value;
    } catch { return null; }
}

async function saveMetadata(file, value) {
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    try {
        await fs.promises.writeFile(temp, JSON.stringify(value), { flag: 'wx' });
        await fs.promises.rename(temp, file);
    } catch {
        // Read-only or locked cache directories still use the in-memory result.
    } finally { await fs.promises.rm(temp, { force: true }).catch(() => {}); }
}

async function copyAsset({ entry, source, target, authoritativeFiles }) {
    if (!entry.isFile()) return;
    const managed = authoritativeFiles.has(entry.name);
    if (!managed && !/\.(png|webp|jpe?g|gif)$/i.test(entry.name)) return;
    const destination = path.join(target, entry.name);
    if (!managed && fs.existsSync(destination)) return;
    assertSafePath(destination);
    const data = await fs.promises.readFile(path.join(source, entry.name));
    if (!managed) {
        try { await fs.promises.writeFile(destination, data, { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
        return;
    }
    let existing;
    try { existing = await fs.promises.readFile(destination); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing?.equals(data)) return;
    const temporary = destination + '.' + crypto.randomUUID() + '.tmp';
    try {
        await fs.promises.writeFile(temporary, data, { flag: 'wx' });
        await fs.promises.rename(temporary, destination);
    } finally { await fs.promises.rm(temporary, { force: true }).catch(() => {}); }
}

async function synchronize(source, target, fallback, key, generation) {
    const metadata = path.join(path.dirname(target), metadataName);
    const previous = synchronized.get(key) || (generation ? await readMetadata(metadata, source, generation) : null);
    if (previous && await stamp(source, target, fallback, previous.files).catch(() => '') === previous.stamp) return;
    await fs.promises.mkdir(target, { recursive: true });
    const authoritativeFiles = await authoritativeAssetFiles(source);
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    for (let i = 0; i < entries.length; i += MAX_PARALLEL_COPIES) {
        const batch = entries.slice(i, i + MAX_PARALLEL_COPIES);
        const results = await Promise.allSettled(batch.map(entry => copyAsset({ entry, source, target, authoritativeFiles })));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
    }
    if (!fs.existsSync(fallback)) {
        await fs.promises.mkdir(path.dirname(fallback), { recursive: true });
        try { await fs.promises.writeFile(fallback, await fs.promises.readFile(path.join(source, '5655.png')), { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    const files = entries.filter(entry => entry.isFile() && authoritativeFiles.has(entry.name)).map(entry => entry.name);
    const next = await stamp(source, target, fallback, files).catch(() => '');
    if (next) {
        const value = { source, generation, stamp: next, files };
        synchronized.set(key, value);
        if (synchronized.size > 64) synchronized.delete(synchronized.keys().next().value);
        if (generation) await saveMetadata(metadata, value);
    }
}

async function prepareSharedGameAssets({ gameDirectory, libraryRoot, bundledAssets, generation = '', gameId = '' }) {
    const root = path.resolve(libraryRoot);
    const game = path.resolve(gameDirectory);
    const relative = path.relative(root, game);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return Promise.resolve();
    const target = assertSafePath(path.join(path.dirname(game), 'tiktok-vs/public/assets/gift-images'));
    const fallback = assertSafePath(path.join(path.dirname(target), 'gift-catalog/balon-hediyesi.png'));
    assertSafePath(path.join(target, 'katalog_tam.json'));
    const source = path.resolve(bundledAssets);
    const key = source + '\0' + target + '\0' + generation;
    const operationKey = key + '\0' + gameId + '\0' + game;
    const pending = inFlight.get(operationKey);
    if (pending) return pending;
    const operation = (async () => {
        await synchronize(source, target, fallback, key, generation);
        if (['vs', 'puanlama'].includes(gameId)) {
            const local = assertSafePath(path.join(game, 'public/assets/gift-images'));
            if (path.resolve(local) !== path.resolve(target)) {
                await synchronize(source, local, fallback, source + '\0' + local + '\0' + generation, generation);
            }
        }
        if (['duck-hunt', 'frog-river'].includes(gameId)) {
            const localList = assertSafePath(path.join(game, 'gift-catalog.json'));
            if (!fs.existsSync(localList)) return;
            const catalog = JSON.parse(await fs.promises.readFile(path.join(source, 'katalog_tam.json'), 'utf8'));
            const existing = JSON.parse(await fs.promises.readFile(localList, 'utf8'));
            if (!validCatalog(catalog) || !Array.isArray(existing)) return;
            const ids = new Set(existing.map(row => String(row.id)));
            const missing = catalog.filter(row => !ids.has(row.id));
            if (missing.length) {
                const temporary = localList + '.' + crypto.randomUUID() + '.tmp';
                try {
                    await fs.promises.writeFile(temporary, JSON.stringify([...existing, ...missing]), { flag: 'wx' });
                    await fs.promises.rename(temporary, localList);
                } finally { await fs.promises.rm(temporary, { force: true }); }
            }
        }
    })().finally(() => inFlight.delete(operationKey));
    inFlight.set(operationKey, operation);
    return operation;
}
module.exports = { prepareSharedGameAssets };
