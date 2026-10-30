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

const TTS_DEFAULTS = { enabled: false, names: false, volume: 0.7, rate: 1, pitch: 1, voiceURI: '', voicePreset: 'natural', provider: '', allowOfflineFallback: false, audience: 'all', allowedUsers: '', giftId: '7934', maxLength: 180, cooldownSeconds: 3, blockedWords: '', profanityFilter:true, prefixEnabled:false, messagePrefix:'.' };
const httpsURL = value => { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Güvenli HTTPS adresi gerekli.'); return url.href; };

function createPlatform(ctx) {
    ctx.traceStartup?.('platform-entered');
    const { app, ipcMain, store, dialog, definitions } = ctx;
    const root = store.get('library_root_v1', path.join(app.getPath('userData'), 'games'));
    let catalog = store.get('content_catalog_v1', null);
    if (!catalog || catalog.revision < bundledCatalog.revision) catalog = bundledCatalog;
    let catalogError = '';
    let catalogStatus = { source: catalog === bundledCatalog ? 'bundled' : 'cache', message: 'Kayıtlı içerikler kullanılıyor.', remoteAvailable: false };
    const controllers = new Map();
    const resources = ctx.gameResources || require('./game-resources.cjs').createGameResources();
    const guideMetadata = new Map();
    for (const id of Object.keys(definitions)) {
        try { guideMetadata.set(id, resources.getGuide(id)); } catch { guideMetadata.set(id, null); }
    }
    ctx.traceStartup?.('platform-guides-ready');
    const speechAudience = createSpeechAudience();
    const storedTTS = store.get('tts_settings_v1', {});
    if (storedTTS.names || storedTTS.provider==='chatterbox' || String(storedTTS.voiceURI||'').startsWith('chatterbox:')) store.set('tts_settings_v1', { ...storedTTS, names: false,
        ...(storedTTS.provider==='chatterbox'||String(storedTTS.voiceURI||'').startsWith('chatterbox:')?{provider:'offline',voiceURI:'offline:okur-tr-v1:default'}:{}) });
    const ttsSettings = () => ({ ...TTS_DEFAULTS, ...store.get('tts_settings_v1', {}), names: false });
    speechAudience.configure(ttsSettings());
    let credentialError = '';
    let savedSpeech;
    try { savedSpeech = ctx.speechCredentials?.read(); } catch { credentialError = 'Kayıtlı ses hesabı açılamadı. Doğal ses hesabını yeniden bağlayın.'; }
    const voicePacks = ctx.voicePacks || require('./voice-pack-manager.cjs').createVoicePackManager({
        root: path.join(app.getPath('userData'), 'voices', 'v1'),
        bundledFrontend: path.join(__dirname, 'voice-assets', 'okur-frontend.wasm'),
        onProgress: progress => ctx.getWindow()?.webContents.send('workspace-voice-progress', progress)
    });
    const central = ctx.getSpeechCredentials ? require('./central-speech.cjs').createCentralSpeech({ serverURL: ctx.serverURL, getCredentials: ctx.getSpeechCredentials }) : undefined;
    const speech = ctx.speechService || createSpeechService({ azure: savedSpeech || undefined, voicePacks, central });
    ctx.traceStartup?.('platform-speech-ready');
    const speechStatus = async refresh => ({ ...await speech.status({ refresh }), credentialError, voiceLibrary:[] });
    let library;
    const send = (name, data) => ctx.getWindow()?.webContents.send(name, data);
    const adminGames = app.isTikMNGPreview ? require('./admin-games.json').games.filter(game => definitions[game.id]) : [];
    const releasedGames = require('./published-games.json').games.filter(game => definitions[game.id] && !definitions[game.id].adminOnly);
    const previewPackages = require('./preview-package.cjs').createPreviewPackages({ enabled: Boolean(app.isTikMNGPreview),
        games: adminGames, port: ctx.port, accessKey: ctx.accessKey });
    ctx.traceStartup?.('platform-packages-ready');
    const announcements = require('./game-announcements.cjs').createGameAnnouncements({ store, getChannel: ctx.getChannel, games: [...releasedGames, ...adminGames.filter(game=>!releasedGames.some(released=>released.id===game.id))] });
    const widgetAnnouncements = require('./widget-announcements.cjs').createWidgetAnnouncements(store);
    const known = id => Object.hasOwn(definitions, id) && !['crowd-control','crowdControl'].includes(id) && (!definitions[id].adminOnly || app.isTikMNGPreview);
    const gameData = id => {
        const admin = adminGames.find(game => game.id === id);
        const published = catalog?.games?.find(game => game.id === id) || bundledCatalog.games.find(game => game.id === id);
        return admin ? { ...published, ...admin, ...(admin.package || {}) } : { ...published, ...releasedGames.find(game=>game.id===id) };
    };
    function packageFor(id, context = {}) {
        const def = definitions[id];
        if (!def) throw new Error('Oyun bulunamadı.');
        const published = gameData(id);
        const localPreview = previewPackages.descriptor(id);
        if (localPreview) {
            if(context.hasExisting===false && localPreview.format !== 'shared-runtime-v2'){const {files,...archive}=localPreview;return archive;}
            return localPreview;
        }
        if (def.adminOnly && !published?.package) return { version: def.paketSurumu, url: null };
        if (published?.version && published.url) {
            const result={ ...published, url: new URL(published.url, ctx.serverURL()).href,
                files: published.files?.map(file => ({ ...file, url: new URL(file.url, ctx.serverURL()).href })) };
            if(context.hasExisting===false && result.format !== 'shared-runtime-v2')delete result.files;
            return result;
        }
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
    ctx.traceStartup?.('platform-library-ready');
    const mediaRoot = store.get('media_root_v1', process.env.MNG_TEST_PROFILE ? path.join(app.getPath('userData'), 'media') : fs.existsSync('D:/') ? 'D:/TikMNG-Medya' : path.join(app.getPath('videos'), 'TikMNG'));
    let studio = createMediaStudio({ store, root: mediaRoot, accessKey: ctx.accessKey, getChannel: ctx.getChannel, getActiveGame: ctx.getActiveGame,
        onEvent: event => send('workspace-media-event', event) });
    const entryRoot=store.get('entry_video_root_v1',path.join(mediaRoot,'entry-videos'));
    if(!store.get('entry_video_root_v1',''))store.set('entry_video_root_v1',entryRoot);
    const entryVideos=require('./entry-videos.cjs').createEntryVideos({store,root:entryRoot,accessKey:ctx.accessKey,getChannel:ctx.getChannel,
        onEvent:()=>send('workspace-entry-status',entryVideos.status())});
    ctx.traceStartup?.('platform-media-ready');
    const mediaDownloads = require('./media-downloads.cjs').createMediaDownloads({store,
        getRoot: () => store.get('media_root_v1',mediaRoot), getStudio: () => studio,
        onChange: status => send('workspace-media-downloads',status), onAsset: () => send('workspace-catalog',{})});
    const bridge = new TikfinityBridge();
    bridge.on('status', status => {if(status.status==='connected'&&status.roomId)entryVideos.beginSession(ctx.getChannel(),status.roomId);ctx.setLiveStatus(status);});
    bridge.on('event', (type, data) => {
        const profile = ctx.profile(data);
        ctx.event(type, type === 'gift' ? { ...profile, ...ctx.gift(data) }
            : { ...data, ...profile, message: data.content ?? data.comment ?? data.message ?? '', eventId: data.eventId || data.msgId || data.common?.msgId || data.logId || '' });
    });
    function mediaURL(id = '', gameId = '') { return `http://127.0.0.1:${ctx.port}/tikmng/media${id ? '/' + encodeURIComponent(id) : ''}?key=${ctx.accessKey}&channel=${encodeURIComponent(ctx.getChannel())}${gameId ? '&game=' + encodeURIComponent(gameId) : ''}`; }
    function items() { return studio.list().map(item => ({ ...item, overlayUrl: mediaURL(item.id, item.gameId),
        ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL(item.id, item.gameId)) } : {}) })); }
    function sounds() { return studio.listSounds().map(item => ({ ...item,
        overlayUrl: new URL(item.previewUrl, mediaURL()).href })); }
    function assets() { return studio.listAssets().map(item => ({ ...item,
        overlayUrl: new URL(item.previewUrl, mediaURL()).href })); }
    function statuses() {
        const result = {};
        for (const [id, def] of Object.entries(definitions)) {
            if (!known(id)) continue;
            const state = library.state(id);
            const component = previewPackages.descriptor(id) || gameData(id);
            if(id==='caahr'&&state.installed){const version=require('./native-game.cjs').voiceDrivingVersion(state.path);if(version){state.installedVersion=version;if(state.availableVersion===version)state.updateAvailable=false;}}
            result[id] = { ...state, id, kurulu: state.installed, ad: gameData(id)?.title || def.ad,
                boyut: component?.format === 'shared-runtime-v2' ? `${Math.ceil(component.bytes / 1048576)} MB + ortak motor` : def.boyut,
                minecraft: Boolean(def.minecraft || id === 'zombie-war'), cover: gameData(id)?.cover || '',
                downloadReady: !def.adminOnly || Boolean(previewPackages.descriptor(id) || (gameData(id)?.package?.url && gameData(id)?.package?.sha256 && Number.isSafeInteger(gameData(id)?.package?.bytes))),
                description: gameData(id)?.description || '', requirements: gameData(id)?.requirements || (def.minecraft ? 'Windows 10/11 64 bit, 8 GB RAM, en az 3 GB boş disk' : 'Windows 10/11 64 bit'),
                resources: gameData(id)?.resources || [], giftGuide: guideMetadata.get(id) || null, overlayUrl: mediaURL('', id),
                ...(ctx.gameWidgetLinks ? {gameWidgets:ctx.gameWidgetLinks(id)} : {}),
                ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL('', id)) } : {}) };
        }
        if (result['crowd-control']) result.crowdControl = result['crowd-control'];
        return result;
    }
    async function refreshCatalog() {
        const result = await loadContentCatalog({ serverURL: ctx.serverURL, known, cached: store.get('content_catalog_v1',null), bundled: bundledCatalog });
        catalog = result.catalog;
        catalogStatus = result.status;
        catalogError = result.status.degraded ? result.status.message : '';
        if (result.status.cacheable) store.set('content_catalog_v1', catalog);
        if (app.isPackaged) mediaDownloads.start(catalog.media || []);
        send('workspace-catalog', { revision: catalog.revision });
        return snapshot();
    }
    function snapshot() {
        return { games: Object.values(statuses()).filter((game, index, all) => all.findIndex(g => g.id === game.id) === index),
            libraryRoot: store.get('library_root_v1', root), mediaRoot: store.get('media_root_v1', mediaRoot), media: items(),
            remoteMedia: catalog?.media || [], mediaDownloads:mediaDownloads.snapshot(), mediaAssets: assets(), audioLibrary: sounds(), soundEffects: require('./sound-effects.cjs').CATALOG, catalogRevision: catalog?.revision || 0, catalogError, catalogStatus, overlayUrl: mediaURL(),
            ...(ctx.broadcastURL ? { broadcastUrl: ctx.broadcastURL(mediaURL()), overlayTransport: ctx.getOverlayStatus?.() } : {}),
            source: store.get('live_source_v1', 'direct'), tikfinityUrl: store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'), activeGame: ctx.getActiveGame?.() || '',
            voiceLibrary: [],
            entryVideos:entryVideos.list().map(item=>({...item,previewUrl:new URL(item.previewUrl,mediaURL()).href})),
            entryVideoUrl:ctx.broadcastURL?ctx.broadcastURL(mediaURL('','entry-videos')):'',entryVideoLocalUrl:mediaURL('','entry-videos'),entryVideoStatus:entryVideos.status(),
            tts: ttsSettings(), version: app.getVersion(), preview: Boolean(app.isTikMNGPreview), gameAnnouncements: announcements.pending(), widgetAnnouncements: widgetAnnouncements.pending() };
    }
    async function install(id, options = {}) {
        if (!known(id)) return { basarili: false, hata: 'Oyun bulunamadı.' };
        if (definitions[id].adminOnly && !statuses()[id]?.downloadReady) return { basarili: false, hata: 'Oyun paketi hazırlanıyor. Yönetici paketi hazır olduğunda indirme açılacak.' };
        if(id==='caahr'&&!packageFor(id).sha256)return {basarili:false,hata:'Sesli Sürüş eklenti paketi henüz yayımlanmadı. Steam demosu ayrı kurulur.'};
        if (controllers.has(id)) return { basarili: false, hata: 'Bu oyun zaten indiriliyor.' };
        const controller = new AbortController();
        controllers.set(id, controller);
        const resumeMedia = await mediaDownloads.suspend();
        try { await library.install(id, { ...options, signal: controller.signal }); return { basarili: true }; }
        catch (error) { return { basarili: false, hata: error.message }; }
        finally { resumeMedia();controllers.delete(id); send('workspace-catalog', {}); }
    }
    const handle = (name, fn) => ipcMain.handle('workspace-' + name, async (_event, data = {}) => {
        try { return await fn(data); } catch (error) { return { error: speechError(error), ...(error.code ? { code: error.code } : {}) }; }
    });
    function speechError(error) {
        return ({ VOICE_UNAVAILABLE: 'Seçilen Türkçe ses bu sistemde yok. Kullanılabilir bir ses seçin.',
            WINDOWS_UNAVAILABLE: 'Windows Türkçe konuşma sesi kullanılamıyor.', OFFLINE_UNAVAILABLE: 'Çevrimdışı ses üretilemedi. Ses paketini yeniden indirin.', VOICE_PACK_REQUIRED: 'Önce çevrimdışı ses paketini indirin.', AZURE_NOT_CONFIGURED: 'Doğal sesler için Azure Speech hesabınızı bağlayın.',
            AZURE_CONFIGURATION: 'Ses hesabı ayarlarını kontrol edin.', AZURE_AUTH: 'Ses hesabının anahtarı veya bölgesi doğrulanamadı.',
            AZURE_LIMIT: 'Ses hesabının kullanım kotası doldu. Hesap limitini kontrol edin.', AZURE_UNAVAILABLE: 'Doğal ses hizmetine ulaşılamadı.',
            INVALID_AUDIO: 'Ses hizmetinden geçerli bir kayıt alınamadı.', SPEECH_CANCELLED: 'Ses durduruldu.',
            CHATTERBOX_PACK_MISSING: 'Doğal Türkçe ses paketinin klasörünü seçin.', CHATTERBOX_NOT_INSTALLED: 'Doğal Türkçe ses paketi henüz kurulu değil.',
            CHATTERBOX_PACK_INVALID: 'Ses paketi eksik veya doğrulanamadı. Doğrulanmış TikMnG paketini seçin.', CHATTERBOX_RUNTIME_UNTRUSTED: 'Ses motorunun güvenlik doğrulaması başarısız. Paket çalıştırılmadı.',
            CHATTERBOX_TIMEOUT: 'Yerel ses üretimi zaman aşımına uğradı. Daha kısa bir metin deneyin.', CHATTERBOX_BUSY: 'Yerel ses sırası dolu. Biraz bekleyin.',
            CHATTERBOX_FAILED: 'Yerel ses üretilemedi.', CHATTERBOX_UNAVAILABLE: 'Yerel ses motoru başlatılamadı.', CHATTERBOX_INVALID_AUDIO: 'Yerel ses kaydı doğrulanamadı.',
            CHATTERBOX_INSTALL_CANCELLED: 'Ses paketi indirmesi durduruldu.', CHATTERBOX_INSTALL_BUSY: 'Ses paketi zaten indiriliyor.',
            CHATTERBOX_DOWNLOAD_NOT_READY: 'Ses paketi indirme kaynağı henüz yayımlanmamış.', CHATTERBOX_DISK_SPACE: 'Ses paketi için yeterli disk alanı yok.',
            CHATTERBOX_TARGET_OCCUPIED: 'Ses paketinin hedef klasörü başka dosyalar içeriyor. Mevcut dosyalar değiştirilmedi.',
            CHATTERBOX_DOWNLOAD_INTEGRITY: 'Ses paketi doğrulanamadı. İndirmeyi yeniden deneyin.', CHATTERBOX_INSTALL_FAILED: 'Ses paketi indirilemedi. Bağlantıyı kontrol edip yeniden deneyin.',
            CREDENTIALS_UNAVAILABLE: 'Windows güvenli anahtar kaydı kullanılamıyor. Anahtar açık metin olarak kaydedilmedi.',
            CREDENTIALS_INVALID_REGION: 'Geçerli bir Azure Speech bölgesi yazın.', CREDENTIALS_INVALID_KEY: 'Ses hesabı anahtarını kontrol edin.',
            CREDENTIALS_CORRUPT: 'Kayıtlı ses hesabı açılamadı. Hesabı yeniden bağlayın.', CREDENTIALS_DECRYPT_FAILED: 'Ses hesabı bu Windows oturumunda açılamadı. Yeniden bağlayın.' })[error.code] || error.message;
    }
    handle('snapshot', snapshot);
    handle('announcement-dismiss', ({ id }) => id === require('./widget-announcements.cjs').ID ? widgetAnnouncements.dismiss(id) : announcements.dismiss(id));
    handle('refresh', refreshCatalog);
    handle('overlay-status', ({ gameId = '' } = {}) => ({ transport: ctx.getOverlayStatus?.(),
        url: ctx.broadcastURL?.(mediaURL('', validGame(gameId))) || '', ...studio.status(validGame(gameId)) }));
    handle('overlay-reconnect', () => { ctx.reconnectOverlay?.(); return snapshot(); });
    handle('install', ({ id, repair }) => install(id, { repair: Boolean(repair) }));
    handle('cancel', ({ id }) => { controllers.get(id)?.abort(); return { ok: true }; });
    handle('remove', async ({ id }) => { if (controllers.has(id)) throw new Error('Önce indirmeyi durdurun.'); await library.remove(id); return { ok: true }; });
    handle('gift-guide-save', async ({ id }) => {
        if (!known(id)) throw new Error('Oyun bulunamadı.');
        const guide = resources.getGuide(id);
        if (!guide) throw new Error('Bu oyun için hazır hediye görseli henüz eklenmemiş.');
        const selection = await dialog.showSaveDialog(ctx.getWindow(), { title: 'Hazır hediye görselini indir',
            defaultPath: guide.filename, filters: [{ name: 'PNG görsel', extensions: ['png'] }] });
        if (selection.canceled || !selection.filePath) return { canceled: true };
        return resources.downloadGuide(id, selection.filePath, { overwrite: true });
    });
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
    handle('media-sound-add', async ({ id, gameId = '' } = {}) => {
        validGame(gameId);
        const sound = require('./sound-effects.cjs').getSound(id);
        const [item] = await studio.importFiles([sound.path], [{ title: sound.title, category: sound.category }]);
        await studio.save({ ...item, gameId });
        return snapshot();
    });
    handle('media-import', async ({ gameId = '', kind = '' } = {}) => {
        validGame(gameId);
        if (!['', 'audio', 'video', 'image'].includes(kind)) throw new Error('Medya türü geçersiz.');
        const extensions = kind === 'audio' ? ['mp3', 'wav', 'ogg'] : kind === 'video' ? ['mp4', 'webm'] : kind === 'image' ? ['gif', 'png', 'jpg', 'jpeg', 'webp'] : ['mp4', 'webm', 'mp3', 'wav', 'ogg', 'gif', 'png', 'jpg', 'jpeg', 'webp'];
        const result = await dialog.showOpenDialog(ctx.getWindow(), { title: kind === 'audio' ? 'Ses efektleri ekle' : 'Video, ses veya görsel ekle', properties: ['openFile', 'multiSelections'], filters: [{ name: kind === 'audio' ? 'Ses dosyaları' : 'Medya', extensions }] });
        if (!result.canceled) {
            const before = new Set(studio.list().map(item => item.id));
            await studio.importFiles(result.filePaths, kind === 'video' ? result.filePaths.map(() => ({ category: 'Kendi Videolarım' })) : []);
            for (const item of studio.list().filter(item => !before.has(item.id))) await studio.save({ ...item, gameId });
        }
        return snapshot();
    });
    async function importArchive(directory) {
        const channel = ctx.getChannel();
        const files = await readMediaArchive(directory, progress => send('workspace-progress', {
            oyun: 'media', ...progress, message: `Arşiv doğrulanıyor: ${progress.completed}/${progress.total}`
        }));
        for (let start = 0; start < files.length; start += 64) {
            if (ctx.getChannel() !== channel) throw new Error('Arşiv eklenirken yayın hesabı değişti. Yeni hesapta tekrar deneyin.');
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
    handle('media-library-add', ({ id, gameId = '' }) => { studio.addAsset(id, { gameId: validGame(gameId) }); return snapshot(); });
    handle('media-duplicate', async ({ id, gameId = '' }) => { validGame(gameId); await studio.duplicate(id, { gameId, giftId: '', enabled: true }); return snapshot(); });
    handle('media-remove', async ({ id }) => { await studio.remove(id); return snapshot(); });
    handle('media-test', async ({ id }) => { const event = await studio.test(id); return { ok: true, receivers: studio.status(event.item.gameId, id).receivers }; });
    handle('media-status', ({ gameId = '' } = {}) => studio.status(validGame(gameId)));
    handle('entry-pick',async()=>{
        const result=await dialog.showOpenDialog(ctx.getWindow(),{title:'Özel giriş videosu seç',properties:['openFile'],filters:[{name:'Video',extensions:['mp4','webm']}]});
        if(result.canceled||!result.filePaths[0])return {canceled:true};
        const asset=await entryVideos.importAsset(result.filePaths[0]);
        return {...asset,previewUrl:new URL(asset.previewUrl,mediaURL()).href};
    });
    handle('entry-save',input=>{entryVideos.save(input);return snapshot();});
    handle('entry-remove',({id})=>{entryVideos.remove(id);return snapshot();});
    handle('entry-test',({id})=>{entryVideos.test(id);return {ok:true,...entryVideos.status()};});
    handle('entry-status',()=>entryVideos.status());
    handle('entry-reset',({id})=>{entryVideos.reset(id);return snapshot();});
    handle('media-background', async ({enabled}) => {await mediaDownloads.setEnabled(enabled);mediaDownloads.start(catalog?.media||[]);return snapshot();});
    handle('media-remote', async ({ id, gameId = '' }) => {
        validGame(gameId);
        const channel = ctx.getChannel();
        const item = catalog?.media?.find(media => media.id === id);
        if (!item) throw new Error('Video katalogda bulunamadı.');
        const asset = await mediaDownloads.ensure({...item,url:httpsURL(new URL(item.url,ctx.serverURL()).href)});
        if(ctx.getChannel() !== channel)throw new Error('Yayın hesabı değişti. Medya kütüphanede hazır; yeniden eyleme ekleyin.');
        studio.addAsset(asset.id,{gameId});
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
        const result = { enabled: Boolean(settings.enabled), names: false, voiceURI: String(settings.voiceURI || '').slice(0, 200),
            volume: Math.max(0, Math.min(1, Number(settings.volume) || 0)), rate: Math.max(0.5, Math.min(2, Number(settings.rate) || 1)),
            pitch: Math.max(0.5, Math.min(2, Number(settings.pitch) || 1)), maxLength: Math.max(20, Math.min(500, Number(settings.maxLength) || 180)),
            cooldownSeconds: Math.max(1, Math.min(60, Number(settings.cooldownSeconds) || 3)), blockedWords: String(settings.blockedWords || '').slice(0, 2000),
            profanityFilter:settings.profanityFilter!==false,prefixEnabled:settings.prefixEnabled===true,messagePrefix:require('./speech-message.cjs').PREFIXES.has(settings.messagePrefix)?settings.messagePrefix:'.',
            audience: SPEECH_AUDIENCES.has(settings.audience) ? settings.audience : 'all',
            allowedUsers: String(settings.allowedUsers || '').slice(0, 4000),
            giftId: /^\d{1,20}$/.test(String(settings.giftId || '')) ? String(settings.giftId) : '7934',
            voicePreset: [...SPEECH_STYLE_IDS, 'child'].includes(settings.voicePreset) ? settings.voicePreset : 'natural',
            provider: ['', 'windows', 'azure', 'offline', 'tikmng'].includes(settings.provider) ? settings.provider : '', allowOfflineFallback: settings.allowOfflineFallback === true };
        if(result.voiceURI.startsWith('chatterbox:'))throw new Error('Bu ses kaldırıldı. Okur veya Ema seçin.');
        speechAudience.configure(result);
        store.set('tts_settings_v1', result);
        return snapshot();
    });
    handle('speech-status', data => speechStatus(data.refresh === true));
    handle('speech-preview-save', async data => {
        const resources = ctx.speechPreviews || require('./speech-preview-resources.cjs').createSpeechPreviewResources();
        const preview = resources.get(data.voiceURI);
        const selection = await dialog.showSaveDialog(ctx.getWindow(), { title: 'Ses ön izlemesini indir', defaultPath: path.join(app.getPath('downloads'), preview.filename), filters: [{ name: 'WAV ses', extensions: ['wav'] }] });
        if (selection.canceled || !selection.filePath) return { canceled: true };
        await fs.promises.writeFile(selection.filePath, preview.data);
        return { saved: true };
    });
    handle('speech-pack-install', async ({ id }) => { await voicePacks.install(id); return speechStatus(true); });
    handle('speech-pack-remove', async ({ id }) => { speech.cancel(); await voicePacks.remove(id); return speechStatus(true); });
    handle('speech-pack-cancel', ({ id }) => voicePacks.cancel(id));
    handle('speech-natural-install', async data => {
        throw Object.assign(new Error('Bu büyük ses motoru kaldırıldı. Okur veya Ema seçin.'),{code:'VOICE_ENGINE_RETIRED'});
    });
    handle('speech-natural-cancel', () => ({ok:true}));
    handle('speech-local-select', async () => {
        throw Object.assign(new Error('Okur veya Ema küçük ses paketini seçin.'),{code:'VOICE_ENGINE_RETIRED'});
    });
    handle('speech-synthesize', data => speech.synthesize({ text: data.text, voiceURI: data.voiceURI, voicePreset: data.voicePreset,
        provider: data.provider, rate: data.rate, allowOfflineFallback: data.allowOfflineFallback === true }));
    handle('speech-cancel', () => { speech.cancel(); return { ok: true }; });
    handle('speech-configure', async data => {
        if (!ctx.speechCredentials) throw new Error('Güvenli ses ayarları kullanılamıyor.');
        const config = ctx.speechCredentials.write({ key: data.key, region: data.region, clear: data.clear === true });
        credentialError = '';
        speech.configure(config || {});
        return speechStatus(true);
    });
    const timer = setInterval(refreshCatalog, 5 * 60000); timer.unref();
    const mediaTimer = app.isPackaged ? setTimeout(() => mediaDownloads.start(catalog?.media||[]),3000) : null;
    mediaTimer?.unref();
    return { snapshot, statuses, install, pathFor: id => library.pathFor(id), refreshCatalog, importArchive,
        beginLive(channel,roomId){const changed=entryVideos.beginSession(channel,roomId);if(changed){speechAudience.clear();send('workspace-entry-status',entryVideos.status());}return changed;},
        ingest(type, payload, channel) {
            studio.ingest(type, payload, channel);
            try{entryVideos.ingest(type,payload,channel);}catch(error){send('workspace-entry-status',{...entryVideos.status(),error:error.message});}
            if (channel !== ctx.getChannel()) return;
            speechAudience.observe(type, payload, channel);
            if (type === 'chat' && speechAudience.allows(payload, ttsSettings(), channel)) {const message=require('./speech-message.cjs').prepareSpeechMessage(payload.message??payload.comment??payload.content,ttsSettings());if(message)send('workspace-chat',{...payload,message,speechPrepared:true});}
        },
        handleRequest: (req,res,url) => previewPackages.handleRequest(req,res,url) || (entryVideos.ownsRequest(url)?entryVideos.handleRequest(req,res,url):studio.handleRequest(req,res,url)),
        connectTikfinity(username) { bridge.connect(store.get('tikfinity_url_v1', 'ws://127.0.0.1:21213/'), username); },
        source: () => store.get('live_source_v1', 'direct'), disconnect: () => bridge.close(),
        async priorityDownload(work) {const resume=await mediaDownloads.suspend();try{return await work();}finally{resume();}},
        close() { clearInterval(timer);clearTimeout(mediaTimer);mediaDownloads.close(); bridge.close(); speech.cancel(); speech.close?.(); voicePacks.close(); for (const controller of controllers.values()) controller.abort(); studio.close?.();entryVideos.close(); } };
}
module.exports = { createPlatform, TTS_DEFAULTS };
