'use strict';

const crypto = require('node:crypto');
const { wingTiers } = require('./champion-art.json');
const ranking = require('./gift-ranking.cjs');
const streamTimer = require('./stream-timer.cjs');
const { updatePK, visiblePK } = require('./pk-state.cjs');
const { createPKViewerCounts } = require('./pk-viewer-counts.cjs');
const { createPKNotifications, normalizeNativePKEvent } = require('./pk-notifications.cjs');
const { createPKEffectEvents } = require('./pk-effect-events.cjs');
const number = (key, label, value, min, max, step = 1) => ({ key, label, value, min, max, step, type: 'number' });
const toggle = (key, label, value = true) => ({ key, label, value, type: 'checkbox' });
const text = (key, label, value, type = 'text') => ({ key, label, value, type });
const select = (key, label, value, options) => ({ key, label, value, type: 'select', options });
const portraitFrame=()=>select('portraitFrame','Profil çerçevesi','original',require('./portrait-frames.cjs').options);
const common = [text('accent', 'Vurgu rengi', '#25f4ee', 'color'), select('background', 'Arka plan', 'transparent', [['transparent', 'Saydam']]), number('scale', 'Boyut (%)', 100, 40, 180), number('opacity', 'Saydamlik (%)', 100, 10, 100), number('offsetX', 'Yatay konum (px)', 0, -1000, 1000), number('offsetY', 'Dikey konum (px)', 0, -1000, 1000)];
const gift = [number('giftMinCoins', 'En az coin', 1, 1, 1000000), text('giftId', 'Hediye', '', 'gift')];
const sound = [toggle('sound', 'Ses efekti'), number('volume', 'Ses seviyesi (%)', 50, 0, 100)];
const wheel = [text('command', 'Sohbet komutu', '!wheel'), ...gift, number('duration', 'Donme suresi (sn)', 8, 2, 20), ...sound];
const fields = {
    pk: [select('players', 'PK gorunumu', 'auto', [['auto', 'Otomatik'], ['2', 'Iki yayinci'], ['4', 'Dort yayinci']]), select('layout', 'Puan gorunumu', 'teams', [['teams', 'Sol / sag takim'], ['players', 'Kisi puanlari']]), number('inset','Kenarlardan içeri (%)',8,0,20)],
    raconlist: [text('giftId', 'Siralama hediyesi', '', 'gift'), number('items', 'Sayfadaki kişi', 12, 3, 20), number('pageSeconds','Liste sayfa süresi (sn)',10,5,60), toggle('lighting', 'Çerçeve ışıkları'), toggle('animation', 'Siralama animasyonu'), text('rankingRows', 'Katılımcılar', [], 'ranking')],
    raconking: [text('giftId', 'Tahta geciren hediye', '6427', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    streambeauty: [text('giftId', 'Cerceveyi kazandiran hediye', '5655', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    streamhandsome: [text('giftId', 'Cerceveyi kazandiran hediye', '5282', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    likefountain: [number('particles', 'Her olayda kalp', 24, 5, 80), toggle('showAvatar', 'Profil fotograflari'), ...sound],
    topgift: [select('frameStyle', 'Çerçeve', 'wings', [['wings','Kanatlar'],['gold','Altın Hazine'],['crystal','Kristal Yörünge'],['ember','Alev Mührü'],['laurel','Altın Defne'],['prism','Kutup Prizması']]), toggle('showGift', 'Hediye ve coin'), select('entranceSound', 'Giriş sesi', 'shimmer', [['shimmer','Işıltı'],['gift-arrive','Yumuşak zil'],['wheel-win','Zafer'],['none','Kapalı']]), ...sound],
    coindrop: [...gift, number('particles', 'Her olayda coin', 40, 8, 100), ...sound],
    firework: [...gift, number('particles', 'Patlamadaki hediye', 32, 8, 72), number('duration', 'Gosterim (sn)', 5, 3, 12), ...sound],
    gifts: [number('items', 'Gorunur hediye', 5, 1, 7), ...gift, ...sound],
    myactions: [select('screen', 'Yayin ekrani', '1', Array.from({ length: 8 }, (_, i) => [String(i + 1), `Ekran ${i + 1}`])), select('event', 'Etkilesim', 'all', [['all', 'Tumu'], ['gift', 'Hediye'], ['follow', 'Takip'], ['like', 'Begeni'], ['subscribe', 'Abonelik'], ['share', 'Paylasim']]), number('likeThreshold', 'Kisi basina begeni esigi', 100, 1, 100000), number('duration', 'Gosterim (sn)', 5, 2, 15), ...gift, ...sound],
    wheel: [...wheel, text('segments', 'Sayilar (her satira bir dilim)', Array.from({ length: 30 }, (_, i) => String(i % 10)).join('\n'), 'textarea'), text('wheelColors', 'Dilim renkleri', '#25c8ba,#e2b84a,#252d32')],
    actionwheel: [...wheel, number('resultSeconds','Sonucu göster (sn)',4,2,20), toggle('allowCommand','Sohbet komutuyla çevir',false),number('extendSeconds','Süre uzat eylemi (sn)',60,1,86400), text('segments', 'Eylemler (her satira bir dilim)', 'Dans et\nSarki soyle\nYayın süresini uzat\nAlkis\nSohbet secsin\nJoker', 'textarea'), text('wheelColors', 'Dilim renkleri', '#ef4965,#24cbb7,#dfb447,#66b884')],
    topgifter: [number('items', 'Görünür destekçi', 9, 1, 9), select('layout', 'Görünüm', 'podium', [['podium', 'Kürsü ve liste'], ['list', 'Liste'], ['ribbon', 'Tek sütun · ışıklı şerit']])],
    streambuddies: [number('items', 'Aynı anda görünen kişi', 40, 1, 150), number('speed', 'Yurume hizi (%)', 100, 30, 250), toggle('showChat', 'Sohbet balonlari')],
    penalty: [...gift, number('goalChance', 'Gol olasiligi (%)', 70, 0, 100), number('duration', 'Sut suresi (sn)', 4, 2, 8), number('items', 'Skor listesi', 10, 1, 13), ...sound],
    coinjar: [...gift, number('capacity', 'Kavanoz birikim siniri', 200, 30, 220), number('giftSize', 'Hediye boyutu (%, 1 coin)', 25, 16, 40), text('jarTint', 'Cam rengi', '#b7edf2', 'color'), select('jarMascot', 'Kavanoz maskotu', 'none', [['none','Yok'],['cat','Kedi'],['bear','Pofuduk ayi'],['butterfly','Kelebek'],['duck','Yavru ordek'],['chicken','Tavuk']]), ...sound],
    giftpusher: [...gift, number('capacity', 'Fizik nesnesi siniri', 150, 30, 250), number('giftSize', 'Pul boyutu', 26, 18, 40), number('speed', 'Platform hizi (%)', 100, 40, 200), ...sound]
};
// Shared rank controls are copied, not aliased, so schemas remain independently editable.
fields.topliker = fields.topgifter.map(field => ({ ...field }));
fields.streamtimer=[number('baseSeconds','Başlangıç süresi (sn)',3600,0,31536000),toggle('running','Sayacı çalıştır',false),...Array.from({length:8},(_,i)=>[text('gift'+(i+1),(i+1)+'. hediye','','gift'),number('seconds'+(i+1),'Her adet için eklenecek saniye',60,1,86400)]).flat(),...sound];
for(const id of ['raconking','streambeauty','streamhandsome','myactions','raconlist'])fields[id].push(portraitFrame());
const definitions = [
    ['streamtimer','Yayın Süresi (Uzatma)','SÜRE','Birden fazla seçili hediyeyle uzayan yayın sayacı.'],
    ['pk', 'Canlı PK Skorları', 'SKOR', 'TikTok PK skorları: iki yayıncı veya ikiye iki düzen.'],
    ['raconlist', 'Racona Girenler', 'SIRALAMA', 'İlk üç kişi koltuklarda; diğerleri kullanıcı adı ve hediye adediyle listede.'],
    ['raconking', 'Racon Kralı', 'HEDİYE', 'Seçtiğin hediyeyi en son gönderen izleyici, ışıklı tahtın sahibi olur.'],
    ['streambeauty', 'Yayın Güzeli', 'HEDİYE', 'Seçilen hediyeyi son gönderenin profili, inci ve pembe altın çerçevede.'],
    ['streamhandsome', 'Yayın Yakışıklısı', 'HEDİYE', 'Seçilen hediyeyi son gönderenin profili, platin ve zümrüt çerçevede.'],
    ['likefountain', 'Beğeni Şelalesi', 'BEĞENİ', 'Beğeni kalpleri ve izleyici profilleri.'],
    ['topgift', 'Viral Benim', 'HEDİYE', 'Kanatlı lider profili ve yayının en değerli hediyesi.'],
    ['coindrop', 'Coin Yağmuru', 'ANİMASYON', 'Hediyelerle parlayan, fiziksel görünümlü coin yağmuru.'],
    ['firework', 'Hediye Havai Fişeği', 'ANİMASYON', 'Hediye görselleriyle patlayan havai fişek.'],
    ['gifts', 'Son Hediyeler', 'HEDIYE', 'Gonderen, hediye ve adet listesi.'],
    ['myactions', 'Etkileşim Bildirimleri', 'BİLDİRİM', 'Sekiz bağımsız ekranda takip, hediye ve abonelik.'],
    ['wheel', 'Sayı Çarkı', 'OYUN', 'Sohbet veya hediye ile dönen sayı çarkı.'],
    ['actionwheel', 'Eylem Çarkı', 'OYUN', 'Düzenlenebilir dilimler ve sonuç ekranı.'],
    ['topgifter', 'Coin Sıralaması', 'SIRALAMA', 'Taçlı lider, profiller ve coin toplamları.'],
    ['topliker', 'Beğeni Sıralaması', 'SIRALAMA', 'Yayının en çok beğenen izleyicileri.'],
    ['streambuddies', 'Yayın Arkadaşları', 'OYUN', 'Sohbet eden, yürüyen piksel karakterler.'],
    ['penalty', 'Penaltı', 'OYUN', 'Hediyeyle şut çek, gol ve kurtarış skorlarını izle.'],
    ['coinjar', 'Hediye Kavanozu', 'HEDIYE', 'Dusen, biriken ve tasan gercek hediye gorselleri.'],
    ['giftpusher', 'Hediye İtici', 'OYUN', 'Merkezden atılan top ve çarpışan hediye pulları.']
].map(([id, name, kind, description]) => ({ id, name, kind, description, studio: true, fields: [text('title','Özel başlık',''), toggle('showTitle','Başlığı yayında göster',false), ...common.map(field => id === 'coinjar' && field.key === 'background' ? { ...field, value: 'transparent' } : field), ...fields[id]] }));
definitions.push({id:'pkhub',name:'PK Arena',kind:'PK',category:'pk',studio:true,description:'Skorlar, eldiven kullanımı, kritik süre ve sonuç tek sahnede.',fields:[text('title','Özel başlık',''),toggle('showTitle','Başlığı yayında göster',false),...common,select('layout','Düzen','bar',[['bar','Skor şeridi'],['arena','Arena']]),toggle('showScores','Skorlar'),toggle('showGlove','Eldiven'),toggle('showMultiplier','Çarpan bildirimleri'),toggle('showResults','Sonuç'),toggle('showCountdown','Geri sayım'),number('duration','Bildirim süresi (sn)',6,2,12),toggle('sound','Ses',false),number('volume','Ses seviyesi (%)',40,0,100)]});
const expansion = require('./widget-expansion.cjs');
definitions.find(item=>item.id==='pkhub').fields.push(
    select('theme','Sahne temasi','inferno',[['inferno','Ates ve metal'],['rose','Pembe kristal'],['botanical','Cicek ve altin'],['platinum','Platin']]),
    number('impactScale','Carpan boyutu (%)',100,70,140),
    select('quality','Gorsel kalite','auto',[['auto','Otomatik'],['high','Yuksek'],['low','Hafif']])
);
definitions.push(...expansion.definitions);
definitions.push(...require('./widget-presets.cjs').createPresets(expansion.definitions));
const categoryFor = id => ['pk','pkhub'].includes(id)?'pk':['topgifter','topliker','raconlist'].includes(id)?'rankings':['streamtimer'].includes(id)?'goals':id==='coinjar'?'jars':['raconking','streambeauty','streamhandsome','topgift'].includes(id)?'portraits':['wheel','actionwheel','penalty','streambuddies','giftpusher'].includes(id)?'games':['coindrop','firework','likefountain'].includes(id)?'effects':'alerts';
for(const definition of definitions) definition.category ||= categoryFor(definition.id);
definitions.push(...require('./widget-scene-catalog.cjs').createSceneCatalog(definitions));
for (const definition of definitions) {
    if (definition.id === 'topgift' || definition.id === 'topgift-frame-wings') definition.wingTiers = wingTiers;
}
const ids = new Set(definitions.map(item => item.id));
const royalIds = new Set(['raconking', 'streambeauty', 'streamhandsome']);
const royalSceneIds = new Set(definitions.filter(item => royalIds.has(item.baseId || item.id)).map(item => item.id));
const cumulativeRoyalIds = new Set(definitions.filter(item => (item.baseId || item.id) === 'raconking').map(item => item.id));
const rankingIds = new Set(definitions.filter(item => (item.baseId || item.id) === 'raconlist').map(item => item.id));
const rankingPool = (data, id) => id === 'raconlist' ? data : data.sceneRankings?.[id] || {};
const cleanChannel = value => String(value || 'varsayilan').replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'varsayilan';
function schema(id) { return definitions.find(item => item.id === id)?.fields || []; }
function normalize(id, input = {}) {
    const result = {};
    const definition = definitions.find(item => item.id === id);
    if (definition?.scenePreset) input = { ...input, ...Object.fromEntries(Object.entries(definition.defaults).filter(([key]) => definition.fields.find(field => field.key === key)?.hidden)) };
    for (const field of schema(id)) {
        const raw = input[field.key] ?? field.value;
        if (field.type === 'ranking') continue;
        if (field.type === 'checkbox') result[field.key] = [true, 'true', 1, '1'].includes(raw);
        else if (field.type === 'number') result[field.key] = Math.max(field.min, Math.min(field.max, Number.isFinite(Number(raw)) ? Number(raw) : field.value));
        else if (field.type === 'color') result[field.key] = /^#[0-9a-f]{6}$/i.test(String(raw)) ? String(raw) : field.value;
        else if (field.type === 'select') result[field.key] = field.options.some(([key]) => key === String(raw)) ? String(raw) : field.value;
        else result[field.key] = String(raw).slice(0, field.key === 'segments' ? 2000 : field.key === 'title' ? 64 : 240);
    }
    if ((royalSceneIds.has(id) || rankingIds.has(id)) && !/^\d{1,12}$/.test(result.giftId)) result.giftId = '';
    // Keep existing coin thresholds without exposing the old six animation selectors.
    if ((definition?.baseId || id) === 'topgift') for (let tier = 1; tier < wingTiers.length; tier++) {
        const key = 'wingTier' + tier;
        const minimum = tier === 1 ? 1 : result['wingTier' + (tier - 1)] + 1;
        result[key] = Math.max(minimum, Math.min(999995 + tier, Math.round(Number(input[key]) || wingTiers[tier].minCoins)));
    }
    return result;
}
function slot(id, screen = '1') { return id === 'myactions' ? `${id}:${Math.max(1, Math.min(8, Number(screen) || 1))}` : id; }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest().readUInt32LE(0); }
function createStudio(store, imageFor) {
    const pkViewers = createPKViewerCounts();
    const pkStates = new Map();
    const pkStages = new Map();
    const pkEffects = new Map();
    function resetPKEffects(channel, roomId) {
        const name = cleanChannel(channel), previous = pkEffects.get(name);
        const model = previous?.model || createPKEffectEvents({ roomId });
        const scope = previous ? model.reset({ roomId }) : model.scope();
        pkEffects.set(name, { model, scope, roomId, battleId: null, activeSince: null, notifications: [] });
        if (pkEffects.size > 32) pkEffects.delete(pkEffects.keys().next().value);
    }
    function livePKStage(channel) {
        const name = cleanChannel(channel), live = pkStages.get(name)?.snapshot().live || null, effects = pkEffects.get(name);
        if (effects) {
            const at = Date.now();
            effects.notifications = effects.notifications.filter(note => note.expiresAt > at && note.battleId === live?.battleId &&
                live.status === 'active' && (live.endsAt === null || at < live.endsAt));
            if (live) live.notifications = [...live.notifications, ...effects.notifications]
                .sort((a, b) => a.occurredAt - b.occurredAt).slice(-24);
        }
        return live;
    }
    function ingestPKEffects(channel, type, message, { initial = false } = {}) {
        const name = cleanChannel(channel), effects = pkEffects.get(name), live = pkStages.get(name)?.snapshot().live;
        if (!effects || !live) return { accepted: false, reason: 'missing-battle', events: [] };
        const result = effects.model.ingestNative(type, message, { scope: effects.scope, battleId: live.battleId,
            status: live.status, participantIds: live.players.map(player => player.id), endsAt: live.endsAt, initial,
            activeSince: effects.battleId === live.battleId ? effects.activeSince : null });
        if (result.accepted) effects.notifications = [...effects.notifications, ...result.events].slice(-24);
        return result;
    }
    const pkStage = channel => {
        const name=cleanChannel(channel);
        if(!pkStages.has(name)){pkStages.set(name,createPKNotifications());if(pkStages.size>32)pkStages.delete(pkStages.keys().next().value);}
        return pkStages.get(name);
    };
    const pkProfiles = new Map();
    const tests = new Map();
    const cache = new Map();
    const key = channel => `widget_studio_v1__${cleanChannel(channel)}`;
    // electron-store decrypts its file per get; polling must not reread it per field.
    const read = channel => {
        const name = key(channel);
        if (!cache.has(name)) {
            cache.set(name, store.get(name, { settings: {}, scores: {}, resets: {} }));
            if (cache.size > 32) cache.delete(cache.keys().next().value);
        }
        return cache.get(name);
    };
    const settings = (channel, id, screen) => {
        const data = read(channel);
        const legacyId = /^pk-(gloves|dragon|wolf|lion|serpent|floral|flame|crystal|rainbow|platinum)$/.test(id)
            ? Object.keys(data.settings || {}).reverse().find(name => name.startsWith(id + '-') && ids.has(name)) : null;
        let saved = data.settings?.[slot(id, screen)] ?? data.settings?.[legacyId];
        if (id === 'topgift-frame-wings' && data.settings?.topgift) {
            // Existing wing thresholds carry over until the separate wing scene saves its own.
            const thresholds = wingTiers.slice(1).map((_, index) => 'wingTier' + (index + 1));
            const legacyThresholds = Object.fromEntries(thresholds.map(key => [key, data.settings.topgift[key]]));
            saved = { ...legacyThresholds, ...saved };
        }
        // The previous release saved the old default as an explicit value.
        let migrated = (data.designVersion || 0) < 2 && saved ? { ...saved, background: 'black', ...(['topgifter', 'topliker'].includes(id) ? { layout: 'podium' } : {}), ...(schema(id).some(field => field.key === 'sound') ? { sound: true } : {}) } : saved;
        if (id === 'coinjar' && (data.designVersion || 0) < 3) migrated = { ...migrated, background: 'transparent' };
        if (id === 'coinjar' && !data.jarSizingVersion && saved?.capacity === 140) migrated = { ...migrated, capacity:200 };
        if (migrated?.title === definitions.find(item=>item.id===id)?.name) migrated = {...migrated,title:''};
        return normalize(id, migrated);
    };
    function save(channel, id, input, screen) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const data = read(channel), value = normalize(id, (definitions.find(item=>item.id===id)?.baseId || id) === 'topgift' ? { ...settings(channel,id), ...input } : input);
        if (id === 'coinjar') data.jarSizingVersion = 1;
        if(id==='streamtimer')streamTimer.configure(data,value);
        // Validate all edits before changing the cached live state.
        const pool = rankingPool(data, id), editingRanking = rankingIds.has(id) && Object.hasOwn(input, 'rankingRows');
        if (editingRanking && Object.hasOwn(input, 'rankingRevision') && input.rankingRevision !== (pool.raconRevision || 0)) throw new Error('Havuz değişti. Ayarları yeniden açın.');
        const editedRows = editingRanking ? Object.hasOwn(input, 'rankingBase') ? ranking.mergeRows(input.rankingRows, input.rankingBase, pool.raconRanking) : ranking.normalizeRows(input.rankingRows, pool.raconRanking) : null;
        if (rankingIds.has(id)) {
            const changed = settings(channel, id).giftId !== value.giftId;
            if (changed) { pool.raconRanking = []; pool.raconReceipts = []; pool.raconRevision = (pool.raconRevision || 0) + 1; }
            else if (editedRows) { pool.raconRanking = editedRows; pool.raconRevision = (pool.raconRevision || 0) + 1; }
            if (id !== 'raconlist') { data.sceneRankings ||= {};data.sceneRankings[id] = pool; }
        }
        if (royalSceneIds.has(id) && settings(channel, id).giftId !== value.giftId) {
            data.royalLeaders ||= {}; delete data.royalLeaders[id];
            if (data.royalCounts) delete data.royalCounts[id];
            tests.delete(`${cleanChannel(channel)}:${id}`);
        }
        if ((data.designVersion || 0) < 3) {
            data.settings = Object.fromEntries(Object.keys(data.settings || {}).map(name => { const [type, index] = name.split(':'); return [name, settings(channel, type, index)]; }));
            data.designVersion = 3;
        }
        data.settings ||= {}; data.settings[slot(id, screen || value.screen)] = value;
        store.set(key(channel), data); return value;
    }
    function ingest(channel, item, { live = true } = {}) {
        if (item.type === 'like') {
            const data = read(channel); data.likeTotals ||= {};
            const name = String(item.username || '').toLowerCase();
            const previous = Object.hasOwn(data.likeTotals, name) ? Number(data.likeTotals[name]) || 0 : 0;
            const total = previous + Math.max(0, Number(item.count) || 0);
            Object.defineProperty(data.likeTotals, name, { value: total, enumerable: true, configurable: true, writable: true });
            const names = Object.keys(data.likeTotals);
            if (names.length > 20000) delete data.likeTotals[names[0]];
            item.likeAlerts = {};
            for (let screen = 1; screen <= 8; screen++) {
                const threshold = Math.max(1, Math.round(settings(channel, 'myactions', screen).likeThreshold));
                if (Math.floor(total / threshold) > Math.floor(previous / threshold)) item.likeAlerts[screen] = Math.floor(total / threshold) * threshold;
            }
            for (const definition of definitions.filter(entry => entry.scenePreset && entry.baseId === 'myactions')) {
                const threshold = Math.max(1, Math.round(settings(channel, definition.id).likeThreshold));
                if (Math.floor(total / threshold) > Math.floor(previous / threshold)) item.likeAlerts[definition.id] = Math.floor(total / threshold) * threshold;
            }
            store.set(key(channel), data); return;
        }
        if (item.type !== 'gift') return;
        const royalData = read(channel);
        if(streamTimer.ingest(royalData,item,settings(channel,'streamtimer'),settings(channel,'actionwheel'),limit=>crypto.randomInt(limit)))store.set(key(channel),royalData);
        let rankingChanged = false;
        for (const id of live ? rankingIds : []) {
            const pool = rankingPool(royalData, id);
            if (!ranking.ingestRanking(pool, item, settings(channel, id).giftId)) continue;
            rankingChanged = true;
            if (id !== 'raconlist') { royalData.sceneRankings ||= {};royalData.sceneRankings[id] = pool; }
        }
        let royalChanged = false;
        for (const id of live ? royalSceneIds : []) {
            const chosen = settings(channel, id).giftId;
            if (!chosen || chosen !== String(item.giftId)) continue;
            royalData.royalLeaders ||= {};
            if (cumulativeRoyalIds.has(id)) {
                royalData.royalCounts ||= {};
                const pool = royalData.royalCounts[id] ||= { version: 1, raconRanking: [], raconReceipts: [] };
                if (!ranking.ingestRanking(pool, item, chosen)) continue;
                const candidate = pool.raconRanking.find(row => row.username === String(item.username).replace(/^@/, '').toLowerCase());
                Object.assign(candidate, { id: item.id, giftId: chosen, giftName: item.giftName, giftImage: item.giftImage, createdAt: item.createdAt });
                const old = royalData.royalLeaders[id];
                royalData.royalLeaders[id] = { ...candidate, ...(old?.username === candidate.username ? { cachedAvatar: old.cachedAvatar, avatarWidth: old.avatarWidth } : {}) };
                royalChanged = true;
                continue;
            }
            const old = royalData.royalLeaders[id];
            if (old?.id === item.id) continue;
            const sameUser = old && cleanChannel(old.username) === cleanChannel(item.username);
            royalData.royalLeaders[id] = { id: item.id, username: item.username, nickname: item.nickname,
                avatar: item.avatar || (sameUser ? old?.avatar : '') || '', giftId: chosen, giftName: item.giftName, giftImage: item.giftImage,
                count: item.count, createdAt: item.createdAt, ...(sameUser ? { cachedAvatar: old.cachedAvatar, avatarWidth: old.avatarWidth } : {}) };
            royalChanged = true;
        }
        // Persist royalty even when the independent penalty gift filter rejects this event.
        if (royalChanged || rankingChanged) store.set(key(channel), royalData);
        const config = settings(channel, 'penalty');
        if (item.coins < config.giftMinCoins || (config.giftId && config.giftId !== String(item.giftId))) return royalChanged;
        const data = read(channel); data.scores ||= {};
        item.penaltyGoal = hash(item.id) % 100 < config.goalChance;
        const name = item.username.toLowerCase();
        const row = Object.hasOwn(data.scores, name) ? data.scores[name] : { username: item.username, nickname: item.nickname, avatar: item.avatar, goals: 0, shots: 0 };
        row.shots++; row.goals += item.penaltyGoal ? 1 : 0;
        row.nickname = item.nickname; row.avatar = item.avatar || row.avatar;
        Object.defineProperty(data.scores, name, { value: row, enumerable: true, configurable: true, writable: true });
        store.set(key(channel), data);
        return royalChanged;
    }

    function rememberRoyalPortrait(channel, username, portrait) {
        if (!portrait?.avatar || !/^\/widget\/gift-assets\/portrait-[a-f0-9-]{36}\.png$/.test(portrait.avatar) ||
            !Number.isFinite(portrait.avatarWidth) || portrait.avatarWidth <= 0) return false;
        const data = read(channel);
        let changed = false;
        for (const row of Object.values(data.royalLeaders || {})) {
            if (cleanChannel(row.username) !== cleanChannel(username) ||
                (row.cachedAvatar && Number(row.avatarWidth) >= portrait.avatarWidth)) continue;
            row.cachedAvatar = portrait.avatar;
            row.avatarWidth = portrait.avatarWidth;
            changed = true;
        }
        if (changed) store.set(key(channel), data);
        return changed;
    }
    function test(channel, id, screen) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const testKey = `${cleanChannel(channel)}:${slot(id, screen)}`;
        const now = Date.now(), config = settings(channel, id, screen), definition=definitions.find(item=>item.id===id), baseId=definition.baseId||id;
        const event = { id: `test-${crypto.randomUUID()}`, type: baseId === 'likefountain' ? 'like' : ['wheel', 'actionwheel'].includes(baseId) ? 'chat' : 'gift', username: 'tikmng_test', nickname: 'TikMnG Test', avatar: '', giftId: config.giftId || '5655', giftName: 'Test hediyesi', giftImage: imageFor('Gul', config.giftId || '5655'), count: 3, coins: Math.max(3, config.giftMinCoins || 1), message: config.command || 'Harika yayin!', createdAt: now };
        const previous = tests.get(testKey);
        const events = previous?.expiresAt > now ? previous.events : [];
        if (baseId === 'myactions') event.type = config.event !== 'all' ? config.event : ['gift', 'follow', 'like', 'subscribe', 'share'][events.length % 5];
        if (baseId === 'myactions' && event.type === 'like') { event.count = config.likeThreshold; event.likeAlerts = { [String(screen || config.screen)]: config.likeThreshold, ...(definition.scenePreset ? { [id]: config.likeThreshold } : {}) }; }
        if (id === 'topliker') event.type = 'like';
        if(definition?.expansion){event.type=definition.eventTypes[0]||'gift';if(event.type==='like')event.count=120;event.message=config.commandA||'Harika yayın!';}
        if (id === 'penalty') event.penaltyGoal = hash(event.id) % 100 < config.goalChance;
        const result = { events: [...events, event].slice(-24), expiresAt: now + 60000 };
        tests.set(testKey, result); return result;
    }
    function reset(channel, id, screen, baseline = {}) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const data = read(channel); data.resets ||= {}; data.resets[slot(id, screen)] = Date.now();
        data.baselines ||= {}; data.baselines[slot(id, screen)] = { totalCoins: Math.max(0, Number(baseline.totalCoins) || 0) };
        const definition=definitions.find(item=>item.id===id);
        if (['topgifter', 'topliker', 'streambuddies'].includes(id) || ['topLikes','topGifters'].includes(definition?.source)) {
            const likes=id==='topliker'||definition?.source==='topLikes';
            const metric = likes ? 'totalLikes' : 'totalCoins';
            const rows = likes ? baseline.topLikes : baseline.topGifters;
            data.baselines[slot(id, screen)].ranks = Object.fromEntries((rows || []).map(row => [row.username, Number(row[metric]) || 0]));
        }
        if(definition?.source==='stats')data.baselines[slot(id,screen)].stats=Object.fromEntries(['totalCoins','totalLikes','followers','totalShares','subscribers','totalGifts'].map(name=>[name,Math.max(0,Number(baseline[name])||0)]));
        if (id === 'penalty') data.scores = {};
        if (id === 'pk' || id === 'pkhub') {data.pkWins={};const active=pkStates.get(cleanChannel(channel));if(active)active.wins=Object.fromEntries((active.teams||[]).map(t=>[t.id,0]));pkStages.get(cleanChannel(channel))?.reset();const effects=pkEffects.get(cleanChannel(channel));if(effects)resetPKEffects(channel,effects.roomId);}
        if (id === 'streamtimer') { delete data.streamTimer;streamTimer.configure(data,settings(channel,id)); }
        if (rankingIds.has(id)) {
            const pool = rankingPool(data, id);pool.raconRanking = [];pool.raconReceipts = [];pool.raconRevision = (pool.raconRevision || 0) + 1;
            if (id !== 'raconlist') { data.sceneRankings ||= {};data.sceneRankings[id] = pool; }
        }
        if (royalSceneIds.has(id) && data.royalLeaders) delete data.royalLeaders[id];
        if (royalSceneIds.has(id) && data.royalCounts) delete data.royalCounts[id];
        store.set(key(channel), data); tests.delete(`${cleanChannel(channel)}:${slot(id, screen)}`);
    }
    function beginSession(channel, roomId, onNewSession = () => {}) {
        if (!/^[1-9]\d{0,31}$/.test(String(roomId || ''))) return false;
        const data = read(channel), room = String(roomId);
        if (pkEffects.get(cleanChannel(channel))?.roomId !== room) resetPKEffects(channel, room);
        if (data.session?.roomId === room) return false;
        // Only a verified new room resets live contents; settings remain intact.
        onNewSession(data.session || null);
        data.session = { roomId: room, startedAt: Date.now() };
        data.scores = {}; data.baselines = {}; data.resets = {}; data.likeTotals = {};
        // Racon is a durable per-publisher pool, independent of individual live rooms.
        pkStates.delete(cleanChannel(channel));
        pkStages.get(cleanChannel(channel))?.reset();
        for (const id of ids) {
            const slots = id === 'myactions' ? Array.from({ length: 8 }, (_, i) => slot(id, i + 1)) : [id];
            if (!rankingIds.has(id) && !royalSceneIds.has(id)) for (const name of slots) data.resets[name] = data.session.startedAt;
        }
        for (const name of tests.keys()) if (name.startsWith(`${cleanChannel(channel)}:`)) tests.delete(name);
        store.set(key(channel), data); return true;
    }
    function state(channel) {
        const data = read(channel), now = Date.now(), active = {};
        for (const [testKey, value] of tests) {
            if (value.expiresAt <= now) { tests.delete(testKey); continue; }
            const prefix = `${cleanChannel(channel)}:`;
            if (testKey.startsWith(prefix)) active[testKey.slice(prefix.length)] = value;
        }
        const configs = {};
        for (const id of ids) {
            if (id === 'myactions') for (let i = 1; i <= 8; i++) configs[slot(id, i)] = settings(channel, id, i);
            else configs[id] = settings(channel, id);
        }
        const leaders = Object.entries(data.royalLeaders || {}), name = cleanChannel(channel);
        const live = livePKStage(channel), pk = visiblePK(pkStates.get(name), now);
        const roomId = data.session?.roomId;
        return { settings: configs, tests: active, streamTimer:streamTimer.snapshot(data), session: data.session || null, resets: data.resets || {}, baselines: data.baselines || {}, royalLeaders: Object.fromEntries(leaders.filter(([id]) => royalIds.has(id))), sceneRoyalLeaders: Object.fromEntries(leaders.filter(([id]) => !royalIds.has(id))), raconRanking: ranking.ranked(data.raconRanking), raconRevision: data.raconRevision || 0, sceneRankings: Object.fromEntries(Object.entries(data.sceneRankings || {}).map(([id,pool]) => [id,{raconRanking:ranking.ranked(pool.raconRanking),raconRevision:pool.raconRevision||0}])), pk: pkViewers.project(name, roomId, live, pk), pkStage:pkViewers.project(name, roomId, live), penaltyScores: Object.values(data.scores || {}).sort((a, b) => b.goals - a.goals || a.shots - b.shots).slice(0, 13) };
    }
    function ingestPK(channel, message, context) {
        if (message?.common?.method === 'WebcastLinkMicBattleItemCard') return ingestPKEffects(channel, 'pk', message, context);
        const stage=pkStage(channel), result=stage.ingestNative('pk',message,{scope:stage.scope()});
        const effects = pkEffects.get(cleanChannel(channel)), live = stage.snapshot().live;
        if (effects && result.accepted && live) {
            if (effects.battleId !== live.battleId) {
                effects.battleId = live.battleId; effects.activeSince = null; effects.notifications = [];
            }
            const native = normalizeNativePKEvent('pk', message);
            // Anchor the gift interval to a native active observation in this verified room.
            if (effects.activeSince === null && String(message.common?.roomId) === effects.roomId && native?.data.status === 'active')
                effects.activeSince = native.occurredAt;
        }
        const name = cleanChannel(channel),profiles=require('./pk-profiles.cjs'),known=profiles.collectProfiles(message,pkProfiles.get(name));pkProfiles.set(name,known);if(pkProfiles.size>32)pkProfiles.delete(pkProfiles.keys().next().value);
        const next = updatePK(pkStates.get(name), {...message,anchorsInfo:[...profiles.anchors(known),...(message.anchorsInfo||[])]}, Date.now(), channel);
        if(next){const data=read(channel);data.pkWins||={};data.pkReceipts||=[];
            if(next.status==='finished'&&next.teams?.length===2&&!data.pkReceipts.includes(next.battleId)){
                const [a,b]=next.teams;if(a.score!==b.score){const winner=a.score>b.score?a:b,key=[...winner.memberIds].sort().join(':');data.pkWins[key]=(data.pkWins[key]||0)+1;}
                data.pkReceipts=[...data.pkReceipts,next.battleId].slice(-2048);store.set(key(channel),data);
            }
            next.wins=Object.fromEntries((next.teams||[]).map(team=>[team.id,data.pkWins[[...team.memberIds].sort().join(':')]||0]));
        }
        if (next) pkStates.set(name, next);
        if (pkStates.size > 32) pkStates.delete(pkStates.keys().next().value);
        if (result.accepted) pkViewers.ingestBattle(name, live, message);
        return result;
    }
    function setPKViewerSession(channel, roomId, connection, route) {
        pkViewers.setSession(cleanChannel(channel), roomId, connection, route);
    }
    function ingestPKViewer(channel, message) {
        pkViewers.ingestViewer(cleanChannel(channel), message);
    }
    return { settings, save, ingest, rememberRoyalPortrait, ingestPK, ingestPKEffects, setPKViewerSession, ingestPKViewer, test, reset, beginSession, state };
}
module.exports = { definitions, ids, royalIds, schema, normalize, slot, hash, createStudio };
