'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createGameLibrary } = require('./game-library.cjs');
const { createMediaStudio } = require('./media-studio.cjs');
const { TikfinityBridge } = require('./tikfinity.cjs');
const { readMediaArchive } = require('./media-archive.cjs');
const bundledCatalog = require('./catalog-defaults.json');

const TTS_DEFAULTS = { enabled: false, names: true, volume: 0.7, rate: 1, pitch: 1, voiceURI: '', maxLength: 180, cooldownSeconds: 3, blockedWords: '' };
const httpsURL = value => { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Güvenli HTTPS adresi gerekli.'); return url.href; };

function createPlatform(ctx) {
    const { app, ipcMain, store, dialog, definitions } = ctx;
    const root = store.get('library_root_v1', path.join(app.getPath('userData'), 'games'));
    let catalog = store.get('content_catalog_v1', null);
    let catalogError = '';
    const controllers = new Map();
    let library;
    const send = (name, data) => ctx.getWindow()?.webContents.send(name, data);
    const known = id => definitions[id] && id !== 'crowdControl';
    const gameData = id => catalog?.games?.find(game => game.id === id) || bundledCatalog.games.find(game => game.id === id);
    function packageFor(id) {
        const def = definitions[id];
        if (!def) throw new Error('Oyun bulunamadı.');
        const published = gameData(id);
        if (published?.version && published.url) return { ...published, url: new URL(published.url, ctx.serverURL()).href,
            files: published.files?.map(file => ({ ...file, url: new URL(file.url, ctx.serverURL()).href })) };
        return { version: def.paketSurumu || 'legacy', url: new URL(`/download/game/${encodeURIComponent(def.klasor)}.zip`, ctx.serverURL()).href };
    }
    function makeLibrary(libraryRoot) {
        return createGameLibrary({ root: libraryRoot, definitions, resolveLegacy: ctx.resolveLegacy,
            validate: ctx.validate, extract: ctx.extract, getPackage: packageFor, isRunning: ctx.isRunning,
            preservePaths: id => definitions[id]?.minecraft || id === 'zombie-war'
                ? ['game-instance/config', 'game-instance/saves', 'game-instance/options.txt', 'game-instance/servers.dat', 'game-instance/resourcepacks']
                : ['settings.json', 'config.json', 'data', 'saves', 'state.json', 'public/settings.json'],
            onProgress: progress => send('workspace-progress', progress) });
    }
    library = makeLibrary(root);
    const mediaRoot = store.get('media_root_v1', fs.existsSync('D:/') ? 'D:/TikMNG-Medya' : path.join(app.getPath('videos'), 'TikMNG'));
    let studio = createMediaStudio({ store, root: mediaRoot, accessKey: ctx.accessKey, getChannel: ctx.getChannel,
        onEvent: event => send('workspace-media-event', event) });
    const bridge = new TikfinityBridge();
    bridge.on('status', status => ctx.setLiveStatus(status));
    bridge.on('event', (type, data) => {
        const profile = ctx.profile(data);
        ctx.event(type, type === 'gift' ? { ...profile, ...ctx.gift(data) }
            : { ...profile, ...data, message: data.comment || data.message || '', eventId: data.msgId || data.logId || '' });
    });
    function mediaURL(id = '') { return `http://tikmng.localhost:${ctx.port}/tikmng/media${id ? '/' + encodeURIComponent(id) : ''}?key=${ctx.accessKey}&channel=${encodeURIComponent(ctx.getChannel())}`; }
    function items() { return studio.list().map(item => ({ ...item, overlayUrl: mediaURL(item.id) })); }
    function statuses() {
        const result = {};
        for (const [id, def] of Object.entries(definitions)) {
            if (!known(id)) continue;
            const state = library.state(id);
            result[id] = { ...state, id, kurulu: state.installed, ad: gameData(id)?.title || def.ad, boyut: def.boyut,
                description: gameData(id)?.description || '', requirements: gameData(id)?.requirements || (def.minecraft ? 'Windows 10/11 64 bit, 8 GB RAM, en az 3 GB boş disk' : 'Windows 10/11 64 bit'),
                resources: gameData(id)?.resources || [] };
        }
        result.crowdControl = result['crowd-control'];
        return result;
    }
    async function refreshCatalog() {
        try {
            const response = await fetch(ctx.serverURL() + '/api/content/catalog', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
            if (!response.ok) throw new Error(`Katalog sunucusu: ${response.status}`);
            const next = await response.json();
            if (next.schemaVersion !== 1 || !Array.isArray(next.games) || !Array.isArray(next.media)
                || next.games.length > 100 || next.media.length > 2000) throw new Error('İçerik kataloğu okunamadı.');
            for (const game of next.games) {
                if (!known(game.id)) continue;
                if (game.url) httpsURL(new URL(game.url, ctx.serverURL()).href);
                if (game.sha256 && !/^[a-f\d]{64}$/i.test(game.sha256)) throw new Error('Paket doğrulama bilgisi geçersiz.');
            }
            catalog = next;
            store.set('content_catalog_v1', next);
            catalogError = '';
            send('workspace-catalog', { revision: next.revision });
        } catch (error) { catalogError = error.message; }
        return snapshot();
    }
    function snapshot() {
        return { games: Object.values(statuses()).filter((game, index, all) => all.findIndex(g => g.id === game.id) === index),
            libraryRoot: store.get('library_root_v1', root), mediaRoot: store.get('media_root_v1', mediaRoot), media: items(),
            remoteMedia: catalog?.media || [], catalogRevision: catalog?.revision || 0, catalogError, overlayUrl: mediaURL(),
            source: store.get('live_source_v1', 'direct'), tikfinityUrl: store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'),
            tts: { ...TTS_DEFAULTS, ...store.get('tts_settings_v1', {}) }, version: app.getVersion(), preview: Boolean(app.isTikMNGPreview) };
    }
    async function install(id, options = {}) {
        if (controllers.has(id)) return { basarili: false, hata: 'Bu oyun zaten indiriliyor.' };
        const controller = new AbortController();
        controllers.set(id, controller);
        try { await library.install(id, { ...options, signal: controller.signal }); return { basarili: true }; }
        catch (error) { return { basarili: false, hata: error.message }; }
        finally { controllers.delete(id); send('workspace-catalog', {}); }
    }
    const handle = (name, fn) => ipcMain.handle('workspace-' + name, async (_event, data = {}) => {
        try { return await fn(data); } catch (error) { return { error: error.message }; }
    });
    handle('snapshot', snapshot);
    handle('refresh', refreshCatalog);
    handle('install', ({ id, repair }) => install(id, { repair: Boolean(repair) }));
    handle('cancel', ({ id }) => { controllers.get(id)?.abort(); return { ok: true }; });
    handle('remove', async ({ id }) => { if (controllers.has(id)) throw new Error('Önce indirmeyi durdurun.'); await library.remove(id); return { ok: true }; });
    handle('folder', async ({ kind }) => {
        if (controllers.size) throw new Error('Klasör değiştirmeden önce indirmelerin bitmesini bekleyin.');
        const selection = await dialog.showOpenDialog(ctx.getWindow(), { title: kind === 'media' ? 'Medya klasörü' : 'Yeni oyunlar için klasör', properties: ['openDirectory', 'createDirectory'] });
        if (selection.canceled) return { canceled: true };
        const selected = selection.filePaths[0];
        if (kind === 'media') {
            const previousRoot = store.get('media_root_v1', mediaRoot);
            if (path.resolve(selected) !== path.resolve(previousRoot) && fs.existsSync(previousRoot)) {
                for (const file of fs.readdirSync(previousRoot, { withFileTypes: true })) {
                    if (!file.isFile() || !/^[a-f\d-]{36}\.(mp4|webm|mp3|wav|ogg)$/i.test(file.name)) continue;
                    const destination = path.join(selected, file.name);
                    if (!fs.existsSync(destination)) await fs.promises.copyFile(path.join(previousRoot, file.name), destination, fs.constants.COPYFILE_EXCL);
                    else {
                        const { hashFile } = require('./download.cjs');
                        if (await hashFile(destination) !== await hashFile(path.join(previousRoot, file.name))) throw new Error('Seçilen klasörde aynı adlı farklı bir medya var. Boş bir klasör seçin.');
                    }
                }
            }
            studio.close?.();
            studio = createMediaStudio({ store, root: selected, accessKey: ctx.accessKey, getChannel: ctx.getChannel, onEvent: event => send('workspace-media-event', event) });
            store.set('media_root_v1', selected);
        } else {
            // Existing installations stay discoverable after choosing another disk.
            const legacy = Object.fromEntries(Object.values(statuses()).filter(game => game.installed).map(game => [game.id, game.path]));
            store.set('library_previous_paths_v1', { ...store.get('library_previous_paths_v1', {}), ...legacy });
            library = makeLibrary(selected);
            store.set('library_root_v1', selected);
        }
        return snapshot();
    });
    handle('media-import', async () => {
        const result = await dialog.showOpenDialog(ctx.getWindow(), { title: 'Video veya ses ekle', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Video ve ses', extensions: ['mp4', 'webm', 'mp3', 'wav', 'ogg'] }] });
        if (!result.canceled) await studio.importFiles(result.filePaths);
        return snapshot();
    });
    async function importArchive(directory) {
        const files = await readMediaArchive(directory, progress => send('workspace-progress', {
            oyun: 'media', ...progress, message: `Arşiv doğrulanıyor: ${progress.completed}/${progress.total}`
        }));
        for (let start = 0; start < files.length; start += 64) {
            const batch = files.slice(start, start + 64);
            await studio.importFiles(batch.map(file => file.path), batch.map(({ title, category }) => ({ title, category })));
            send('workspace-progress', { oyun: 'media', phase: 'importing', completed: Math.min(start + 64, files.length), total: files.length,
                message: `Arşiv ekleniyor: ${Math.min(start + 64, files.length)}/${files.length}` });
        }
        send('workspace-progress', { oyun: 'media', phase: 'complete', message: `${files.length} medya eklendi.` });
        return snapshot();
    }
    handle('media-folder', async () => {
        const result = await dialog.showOpenDialog(ctx.getWindow(), { title: 'Video arşivi klasörünü seç', properties: ['openDirectory'] });
        if (result.canceled) return snapshot();
        return importArchive(result.filePaths[0]);
    });
    handle('media-save', async item => { await studio.save(item); return snapshot(); });
    handle('media-remove', async ({ id }) => { await studio.remove(id); return snapshot(); });
    handle('media-test', async ({ id }) => { await studio.test(id); return { ok: true }; });
    handle('media-remote', async ({ id }) => {
        const item = catalog?.media?.find(media => media.id === id);
        if (!item) throw new Error('Video katalogda bulunamadı.');
        const { download } = require('./download.cjs');
        const folder = path.join(store.get('media_root_v1', mediaRoot), 'Katalog');
        fs.mkdirSync(folder, { recursive: true });
        const url = httpsURL(new URL(item.url, ctx.serverURL()).href);
        const extension = new URL(url).pathname.toLowerCase().endsWith('.webm') ? '.webm' : '.mp4';
        const file = path.join(folder, crypto.createHash('sha256').update(id).digest('hex').slice(0, 20) + extension);
        await download(url, file, { sha256: item.sha256, bytes: item.bytes, onProgress: p => send('workspace-progress', { ...p, oyun: 'media' }) });
        const before = new Set(studio.list().map(media => media.id));
        await studio.importFiles([file]);
        const added = studio.list().find(media => !before.has(media.id));
        if (added) await studio.save({ ...added, title: item.title, category: item.category });
        return snapshot();
    });
    handle('source', async ({ source, endpoint }) => {
        if (!['direct', 'tikfinity'].includes(source)) throw new Error('Bağlantı kaynağı seçin.');
        if (source === 'tikfinity') require('./tikfinity.cjs').localEndpoint(endpoint);
        bridge.close();
        await ctx.closeDirect();
        store.set('live_source_v1', source);
        if (endpoint) store.set('tikfinity_url_v1', endpoint);
        return snapshot();
    });
    handle('tts', settings => {
        const result = { enabled: Boolean(settings.enabled), names: Boolean(settings.names), voiceURI: String(settings.voiceURI || '').slice(0, 200),
            volume: Math.max(0, Math.min(1, Number(settings.volume) || 0)), rate: Math.max(0.5, Math.min(2, Number(settings.rate) || 1)),
            pitch: Math.max(0.5, Math.min(2, Number(settings.pitch) || 1)), maxLength: Math.max(20, Math.min(500, Number(settings.maxLength) || 180)),
            cooldownSeconds: Math.max(1, Math.min(60, Number(settings.cooldownSeconds) || 3)), blockedWords: String(settings.blockedWords || '').slice(0, 2000) };
        store.set('tts_settings_v1', result);
        return snapshot();
    });
    const timer = setInterval(refreshCatalog, 5 * 60000); timer.unref();
    return { snapshot, statuses, install, pathFor: id => library.pathFor(id), refreshCatalog, importArchive,
        ingest(type, payload, channel) { studio.ingest(type, payload, channel); if (type === 'chat') send('workspace-chat', payload); },
        handleRequest: (...args) => studio.handleRequest(...args),
        connectTikfinity(username) { bridge.connect(store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'), username); },
        source: () => store.get('live_source_v1', 'direct'), disconnect: () => bridge.close(),
        close() { clearInterval(timer); bridge.close(); for (const controller of controllers.values()) controller.abort(); studio.close?.(); } };
}
module.exports = { createPlatform, TTS_DEFAULTS };
