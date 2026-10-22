'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createGameLibrary } = require('./game-library.cjs');
const { createMediaStudio } = require('./media-studio.cjs');
const { TikfinityBridge } = require('./tikfinity.cjs');
const { readMediaArchive } = require('./media-archive.cjs');
const { createSpeechAudience, MODES: SPEECH_AUDIENCES } = require('./tts-audience.cjs');
const { createSpeechService, SPEECH_STYLE_IDS } = require('./speech-service.cjs');
const { loadContentCatalog } = require('./content-catalog.cjs');
const bundledCatalog = require('./catalog-defaults.json');

const TTS_DEFAULTS = { enabled: false, names: true, volume: 0.7, rate: 1, pitch: 1, voiceURI: '', voicePreset: 'natural', provider: '', allowOfflineFallback: false, audience: 'all', giftId: '7934', maxLength: 180, cooldownSeconds: 3, blockedWords: '' };
const httpsURL = value => { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Güvenli HTTPS adresi gerekli.'); return url.href; };

function createPlatform(ctx) {
    const { app, ipcMain, store, dialog, definitions } = ctx;
    const root = store.get('library_root_v1', path.join(app.getPath('userData'), 'games'));
    let catalog = store.get('content_catalog_v1', null);
    let catalogError = '';
    let catalogStatus = { source: catalog ? 'cache' : 'bundled', message: 'Kayıtlı içerikler kullanılıyor.', remoteAvailable: false };
    const controllers = new Map();
    const speechAudience = createSpeechAudience();
    let credentialError = '';
    let savedSpeech;
    try { savedSpeech = ctx.speechCredentials?.read(); } catch { credentialError = 'Kayıtlı ses hesabı açılamadı. Doğal ses hesabını yeniden bağlayın.'; }
    const speech = ctx.speechService || createSpeechService({ azure: savedSpeech || undefined });
    let library;
    const send = (name, data) => ctx.getWindow()?.webContents.send(name, data);
    const known = id => Object.hasOwn(definitions, id) && id !== 'crowdControl';
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
    let studio = createMediaStudio({ store, root: mediaRoot, accessKey: ctx.accessKey, getChannel: ctx.getChannel, getActiveGame: ctx.getActiveGame,
        onEvent: event => send('workspace-media-event', event) });
    const bridge = new TikfinityBridge();
    bridge.on('status', status => ctx.setLiveStatus(status));
    bridge.on('event', (type, data) => {
        const profile = ctx.profile(data);
        ctx.event(type, type === 'gift' ? { ...profile, ...ctx.gift(data) }
            : { ...profile, ...data, message: data.comment || data.message || '', eventId: data.msgId || data.logId || '' });
    });
    function mediaURL(id = '', gameId = '') { return `http://127.0.0.1:${ctx.port}/tikmng/media${id ? '/' + encodeURIComponent(id) : ''}?key=${ctx.accessKey}&channel=${encodeURIComponent(ctx.getChannel())}${gameId ? '&game=' + encodeURIComponent(gameId) : ''}`; }
    function items() { return studio.list().map(item => ({ ...item, overlayUrl: mediaURL(item.id, item.gameId),
        ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL(item.id, item.gameId)) } : {}) })); }
    function statuses() {
        const result = {};
        for (const [id, def] of Object.entries(definitions)) {
            if (!known(id)) continue;
            const state = library.state(id);
            result[id] = { ...state, id, kurulu: state.installed, ad: gameData(id)?.title || def.ad, boyut: def.boyut,
                description: gameData(id)?.description || '', requirements: gameData(id)?.requirements || (def.minecraft ? 'Windows 10/11 64 bit, 8 GB RAM, en az 3 GB boş disk' : 'Windows 10/11 64 bit'),
                resources: gameData(id)?.resources || [], overlayUrl: mediaURL('', id),
                ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL('', id)) } : {}) };
        }
        result.crowdControl = result['crowd-control'];
        return result;
    }
    async function refreshCatalog() {
        const result = await loadContentCatalog({ serverURL: ctx.serverURL, known, cached: catalog, bundled: bundledCatalog });
        catalog = result.catalog;
        catalogStatus = result.status;
        catalogError = result.status.degraded ? result.status.message : '';
        if (result.status.cacheable) store.set('content_catalog_v1', catalog);
        send('workspace-catalog', { revision: catalog.revision });
        return snapshot();
    }
    function snapshot() {
        return { games: Object.values(statuses()).filter((game, index, all) => all.findIndex(g => g.id === game.id) === index),
            libraryRoot: store.get('library_root_v1', root), mediaRoot: store.get('media_root_v1', mediaRoot), media: items(),
            remoteMedia: catalog?.media || [], catalogRevision: catalog?.revision || 0, catalogError, catalogStatus, overlayUrl: mediaURL(),
            ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL()), overlayTransport: ctx.getOverlayStatus?.() } : {}),
            source: store.get('live_source_v1', 'direct'), tikfinityUrl: store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'), activeGame: ctx.getActiveGame?.() || '',
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
        try { return await fn(data); } catch (error) { return { error: speechError(error), ...(error.code ? { code: error.code } : {}) }; }
    });
    function speechError(error) {
        return ({ VOICE_UNAVAILABLE: 'Seçilen Türkçe ses bu sistemde yok. Kullanılabilir bir ses seçin.',
            WINDOWS_UNAVAILABLE: 'Windows Türkçe konuşma sesi kullanılamıyor.', AZURE_NOT_CONFIGURED: 'Doğal sesler için Azure Speech hesabınızı bağlayın.',
            AZURE_CONFIGURATION: 'Ses hesabı ayarlarını kontrol edin.', AZURE_AUTH: 'Ses hesabının anahtarı veya bölgesi doğrulanamadı.',
            AZURE_LIMIT: 'Ses hesabının kullanım kotası doldu. Hesap limitini kontrol edin.', AZURE_UNAVAILABLE: 'Doğal ses hizmetine ulaşılamadı.',
            INVALID_AUDIO: 'Ses hizmetinden geçerli bir kayıt alınamadı.', SPEECH_CANCELLED: 'Ses durduruldu.',
            CREDENTIALS_UNAVAILABLE: 'Windows güvenli anahtar kaydı kullanılamıyor. Anahtar açık metin olarak kaydedilmedi.',
            CREDENTIALS_INVALID_REGION: 'Geçerli bir Azure Speech bölgesi yazın.', CREDENTIALS_INVALID_KEY: 'Ses hesabı anahtarını kontrol edin.',
            CREDENTIALS_CORRUPT: 'Kayıtlı ses hesabı açılamadı. Hesabı yeniden bağlayın.', CREDENTIALS_DECRYPT_FAILED: 'Ses hesabı bu Windows oturumunda açılamadı. Yeniden bağlayın.' })[error.code] || error.message;
    }
    handle('snapshot', snapshot);
    handle('refresh', refreshCatalog);
    handle('overlay-status', ({ gameId = '' } = {}) => ({ transport: ctx.getOverlayStatus?.(),
        url: ctx.broadcastURL?.(mediaURL('', validGame(gameId))) || '', ...studio.status(validGame(gameId)) }));
    handle('overlay-reconnect', () => { ctx.reconnectOverlay?.(); return snapshot(); });
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
                    if (!file.isFile() || !/^[a-f\d-]{36}\.(mp4|webm|mp3|wav|ogg|gif|png|jpe?g|webp)$/i.test(file.name)) continue;
                    const destination = path.join(selected, file.name);
                    if (!fs.existsSync(destination)) await fs.promises.copyFile(path.join(previousRoot, file.name), destination, fs.constants.COPYFILE_EXCL);
                    else {
                        const { hashFile } = require('./download.cjs');
                        if (await hashFile(destination) !== await hashFile(path.join(previousRoot, file.name))) throw new Error('Seçilen klasörde aynı adlı farklı bir medya var. Boş bir klasör seçin.');
                    }
                }
            }
            studio.close?.();
            studio = createMediaStudio({ store, root: selected, accessKey: ctx.accessKey, getChannel: ctx.getChannel, getActiveGame: ctx.getActiveGame, onEvent: event => send('workspace-media-event', event) });
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
    function validGame(gameId) {
        if (gameId && !known(gameId)) throw new Error('Oyun bulunamadı.');
        return gameId || '';
    }
    handle('media-import', async ({ gameId = '' } = {}) => {
        validGame(gameId);
        const result = await dialog.showOpenDialog(ctx.getWindow(), { title: 'Video, ses veya görsel ekle', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Medya', extensions: ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'gif', 'png', 'jpg', 'jpeg', 'webp'] }] });
        if (!result.canceled) {
            const before = new Set(studio.list().map(item => item.id));
            await studio.importFiles(result.filePaths);
            for (const item of studio.list().filter(item => !before.has(item.id))) await studio.save({ ...item, gameId });
        }
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
    handle('media-save', async item => { validGame(item.gameId); await studio.save(item); return snapshot(); });
    handle('media-duplicate', async ({ id, gameId = '' }) => { validGame(gameId); await studio.duplicate(id, { gameId, giftId: '', enabled: true }); return snapshot(); });
    handle('media-remove', async ({ id }) => { await studio.remove(id); return snapshot(); });
    handle('media-test', async ({ id }) => { const event = await studio.test(id); return { ok: true, receivers: studio.status(event.item.gameId, id).receivers }; });
    handle('media-status', ({ gameId = '' } = {}) => studio.status(validGame(gameId)));
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
            cooldownSeconds: Math.max(1, Math.min(60, Number(settings.cooldownSeconds) || 3)), blockedWords: String(settings.blockedWords || '').slice(0, 2000),
            audience: SPEECH_AUDIENCES.has(settings.audience) ? settings.audience : 'all',
            giftId: /^\d{1,20}$/.test(String(settings.giftId || '')) ? String(settings.giftId) : '7934',
            voicePreset: [...SPEECH_STYLE_IDS, 'child'].includes(settings.voicePreset) ? settings.voicePreset : 'natural',
            provider: ['', 'windows', 'azure'].includes(settings.provider) ? settings.provider : '', allowOfflineFallback: settings.allowOfflineFallback === true };
        store.set('tts_settings_v1', result);
        return snapshot();
    });
    handle('speech-status', async data => ({ ...await speech.status({ refresh: data.refresh === true }), credentialError }));
    handle('speech-synthesize', data => speech.synthesize({ text: data.text, voiceURI: data.voiceURI, voicePreset: data.voicePreset,
        provider: data.provider, rate: data.rate, allowOfflineFallback: data.allowOfflineFallback === true }));
    handle('speech-cancel', () => { speech.cancel(); return { ok: true }; });
    handle('speech-configure', async data => {
        if (!ctx.speechCredentials) throw new Error('Güvenli ses ayarları kullanılamıyor.');
        const config = ctx.speechCredentials.write({ key: data.key, region: data.region, clear: data.clear === true });
        credentialError = '';
        speech.configure(config || {});
        return speech.status({ refresh: true });
    });
    const timer = setInterval(refreshCatalog, 5 * 60000); timer.unref();
    return { snapshot, statuses, install, pathFor: id => library.pathFor(id), refreshCatalog, importArchive,
        ingest(type, payload, channel) {
            studio.ingest(type, payload, channel);
            if (channel !== ctx.getChannel()) return;
            speechAudience.observe(type, payload, channel);
            if (type === 'chat' && speechAudience.allows(payload, { ...TTS_DEFAULTS, ...store.get('tts_settings_v1', {}) }, channel)) send('workspace-chat', payload);
        },
        handleRequest: (...args) => studio.handleRequest(...args),
        connectTikfinity(username) { bridge.connect(store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'), username); },
        source: () => store.get('live_source_v1', 'direct'), disconnect: () => bridge.close(),
        close() { clearInterval(timer); bridge.close(); speech.cancel(); for (const controller of controllers.values()) controller.abort(); studio.close?.(); } };
}
module.exports = { createPlatform, TTS_DEFAULTS };
