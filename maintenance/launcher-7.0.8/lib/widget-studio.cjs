'use strict';

const crypto = require('node:crypto');
const number = (key, label, value, min, max, step = 1) => ({ key, label, value, min, max, step, type: 'number' });
const toggle = (key, label, value = true) => ({ key, label, value, type: 'checkbox' });
const text = (key, label, value, type = 'text') => ({ key, label, value, type });
const select = (key, label, value, options) => ({ key, label, value, type: 'select', options });
const common = [text('accent', 'Vurgu rengi', '#25f4ee', 'color'), select('background', 'Arka plan', 'transparent', [['transparent', 'Saydam']]), number('scale', 'Boyut (%)', 100, 40, 180), number('opacity', 'Saydamlik (%)', 100, 10, 100), number('offsetX', 'Yatay konum (px)', 0, -1000, 1000), number('offsetY', 'Dikey konum (px)', 0, -1000, 1000)];
const gift = [number('giftMinCoins', 'En az coin', 1, 1, 1000000), text('giftId', 'Hediye', '', 'gift')];
const sound = [toggle('sound', 'Ses efekti'), number('volume', 'Ses seviyesi (%)', 50, 0, 100)];
const wheel = [text('command', 'Sohbet komutu', '!wheel'), ...gift, number('duration', 'Donme suresi (sn)', 8, 2, 20), ...sound];
const fields = {
    raconking: [text('giftId', 'Tahta geciren hediye', '6427', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    streambeauty: [text('giftId', 'Cerceveyi kazandiran hediye', '5655', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    streamhandsome: [text('giftId', 'Cerceveyi kazandiran hediye', '5282', 'gift'), toggle('showGift', 'Hediye gorseli'), toggle('showUsername', 'Baslikta kullanici adi'), toggle('titleAnimation', 'Harf animasyonu'), number('titleInterval', 'Yazi dongusu (sn)', 5, 3, 30), toggle('lighting', 'Isik ve pariltilar')],
    likefountain: [number('particles', 'Her olayda kalp', 24, 5, 80), toggle('showAvatar', 'Profil fotograflari'), ...sound],
    topgift: [toggle('showGift', 'Hediye ve coin'), ...[100,500,1000,5000,10000].map((coins,i)=>number('wingTier'+(i+1), (i+2)+'. kanat / en az coin',coins,1,1000000)), ...sound],
    coindrop: [...gift, number('particles', 'Her olayda coin', 40, 8, 100), ...sound],
    firework: [...gift, number('particles', 'Patlamadaki hediye', 32, 8, 72), number('duration', 'Gosterim (sn)', 5, 3, 12), ...sound],
    gifts: [number('items', 'Gorunur hediye', 5, 1, 7), ...gift, ...sound],
    myactions: [select('screen', 'Yayin ekrani', '1', Array.from({ length: 8 }, (_, i) => [String(i + 1), `Ekran ${i + 1}`])), select('event', 'Etkilesim', 'all', [['all', 'Tumu'], ['gift', 'Hediye'], ['follow', 'Takip'], ['like', 'Begeni'], ['subscribe', 'Abonelik'], ['share', 'Paylasim']]), number('likeThreshold', 'Kisi basina begeni esigi', 100, 1, 100000), number('duration', 'Gosterim (sn)', 5, 2, 15), ...gift, ...sound],
    wheel: [...wheel, text('segments', 'Sayilar (her satira bir dilim)', Array.from({ length: 30 }, (_, i) => String(i % 10)).join('\n'), 'textarea'), text('wheelColors', 'Dilim renkleri', '#25c8ba,#e2b84a,#252d32')],
    actionwheel: [...wheel, text('segments', 'Eylemler (her satira bir dilim)', 'Dans et\nSarki soyle\nTekrar cevir\nAlkis\nSohbet secsin\nJoker', 'textarea'), text('wheelColors', 'Dilim renkleri', '#ef4965,#24cbb7,#dfb447,#66b884')],
    topgifter: [number('items', 'Gorunur destekci', 9, 1, 9), select('layout', 'Gorunum', 'podium', [['podium', 'Kursu ve liste'], ['list', 'Liste']])],
    streambuddies: [number('items', 'Karakter sayisi', 10, 1, 13), number('speed', 'Yurume hizi (%)', 100, 30, 250), toggle('showChat', 'Sohbet balonlari')],
    penalty: [...gift, number('goalChance', 'Gol olasiligi (%)', 70, 0, 100), number('duration', 'Sut suresi (sn)', 4, 2, 8), number('items', 'Skor listesi', 10, 1, 13), ...sound],
    coinjar: [...gift, number('capacity', 'Kavanoz birikim siniri', 140, 30, 220), number('giftSize', 'Hediye boyutu', 25, 16, 40), text('jarTint', 'Cam rengi', '#b7edf2', 'color'), ...sound],
    giftpusher: [...gift, number('capacity', 'Fizik nesnesi siniri', 150, 30, 250), number('giftSize', 'Pul boyutu', 26, 18, 40), number('speed', 'Platform hizi (%)', 100, 40, 200), ...sound]
};
// Shared rank controls are copied, not aliased, so schemas remain independently editable.
fields.topliker = fields.topgifter.map(field => ({ ...field }));
const definitions = [
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
].map(([id, name, kind, description]) => ({ id, name, kind, description, studio: true, fields: [...common.map(field => id === 'coinjar' && field.key === 'background' ? { ...field, value: 'transparent' } : field), ...fields[id]] }));
const ids = new Set(definitions.map(item => item.id));
const royalIds = new Set(['raconking', 'streambeauty', 'streamhandsome']);
const cleanChannel = value => String(value || 'varsayilan').replace(/^@/, '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'varsayilan';
function schema(id) { return definitions.find(item => item.id === id)?.fields || []; }
function normalize(id, input = {}) {
    const result = {};
    for (const field of schema(id)) {
        const raw = input[field.key] ?? field.value;
        if (field.type === 'checkbox') result[field.key] = [true, 'true', 1, '1'].includes(raw);
        else if (field.type === 'number') result[field.key] = Math.max(field.min, Math.min(field.max, Number.isFinite(Number(raw)) ? Number(raw) : field.value));
        else if (field.type === 'color') result[field.key] = /^#[0-9a-f]{6}$/i.test(String(raw)) ? String(raw) : field.value;
        else if (field.type === 'select') result[field.key] = field.options.some(([key]) => key === String(raw)) ? String(raw) : field.value;
        else result[field.key] = String(raw).slice(0, field.key === 'segments' ? 2000 : 240);
    }
    if (royalIds.has(id) && !/^\d{1,12}$/.test(result.giftId)) result.giftId = '';
    if (id === 'topgift') for (let i=1;i<=5;i++) result['wingTier'+i]=Math.max(i===1?1:result['wingTier'+(i-1)]+1,Math.min(999995+i,Math.round(result['wingTier'+i])));
    return result;
}
function slot(id, screen = '1') { return id === 'myactions' ? `${id}:${Math.max(1, Math.min(8, Number(screen) || 1))}` : id; }
function hash(value) { return crypto.createHash('sha256').update(String(value)).digest().readUInt32LE(0); }
function createStudio(store, imageFor) {
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
        const data = read(channel), saved = data.settings?.[slot(id, screen)];
        // The previous release saved the old default as an explicit value.
        let migrated = (data.designVersion || 0) < 2 && saved ? { ...saved, background: 'black', ...(['topgifter', 'topliker'].includes(id) ? { layout: 'podium' } : {}), ...(schema(id).some(field => field.key === 'sound') ? { sound: true } : {}) } : saved;
        if (id === 'coinjar' && (data.designVersion || 0) < 3) migrated = { ...migrated, background: 'transparent' };
        return normalize(id, migrated);
    };
    function save(channel, id, input, screen) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const data = read(channel), value = normalize(id, input);
        if (royalIds.has(id) && settings(channel, id).giftId !== value.giftId) {
            data.royalLeaders ||= {}; delete data.royalLeaders[id];
            tests.delete(`${cleanChannel(channel)}:${id}`);
        }
        if ((data.designVersion || 0) < 3) {
            data.settings = Object.fromEntries(Object.keys(data.settings || {}).map(name => { const [type, index] = name.split(':'); return [name, settings(channel, type, index)]; }));
            data.designVersion = 3;
        }
        data.settings ||= {}; data.settings[slot(id, screen || value.screen)] = value;
        store.set(key(channel), data); return value;
    }
    function ingest(channel, item) {
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
            store.set(key(channel), data); return;
        }
        if (item.type !== 'gift') return;
        const royalData = read(channel);
        for (const id of royalIds) {
            const chosen = settings(channel, id).giftId;
            if (!chosen || chosen !== String(item.giftId)) continue;
            royalData.royalLeaders ||= {};
            if (royalData.royalLeaders[id]?.id === item.id) continue;
            royalData.royalLeaders[id] = { id: item.id, username: item.username, nickname: item.nickname,
                avatar: item.avatar || '', giftId: chosen, giftName: item.giftName, giftImage: item.giftImage,
                count: item.count, createdAt: item.createdAt };
        }
        // Persist royalty even when the independent penalty gift filter rejects this event.
        if (royalData.royalLeaders) store.set(key(channel), royalData);
        const config = settings(channel, 'penalty');
        if (item.coins < config.giftMinCoins || (config.giftId && config.giftId !== String(item.giftId))) return;
        const data = read(channel); data.scores ||= {};
        item.penaltyGoal = hash(item.id) % 100 < config.goalChance;
        const name = item.username.toLowerCase();
        const row = Object.hasOwn(data.scores, name) ? data.scores[name] : { username: item.username, nickname: item.nickname, avatar: item.avatar, goals: 0, shots: 0 };
        row.shots++; row.goals += item.penaltyGoal ? 1 : 0;
        row.nickname = item.nickname; row.avatar = item.avatar || row.avatar;
        Object.defineProperty(data.scores, name, { value: row, enumerable: true, configurable: true, writable: true });
        store.set(key(channel), data);
    }
    function test(channel, id, screen) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const testKey = `${cleanChannel(channel)}:${slot(id, screen)}`;
        const now = Date.now(), config = settings(channel, id, screen);
        const event = { id: `test-${crypto.randomUUID()}`, type: id === 'likefountain' ? 'like' : ['wheel', 'actionwheel'].includes(id) ? 'chat' : 'gift', username: 'tikmng_test', nickname: 'TikMnG Test', avatar: '', giftId: config.giftId || '5655', giftName: 'Test hediyesi', giftImage: imageFor('Gul', config.giftId || '5655'), count: 3, coins: Math.max(3, config.giftMinCoins || 1), message: config.command || 'Harika yayin!', createdAt: now };
        const previous = tests.get(testKey);
        const events = previous?.expiresAt > now ? previous.events : [];
        if (id === 'myactions') event.type = config.event !== 'all' ? config.event : ['gift', 'follow', 'like', 'subscribe', 'share'][events.length % 5];
        if (id === 'myactions' && event.type === 'like') { event.count = config.likeThreshold; event.likeAlerts = { [String(screen || config.screen)]: config.likeThreshold }; }
        if (id === 'topliker') event.type = 'like';
        if (id === 'penalty') event.penaltyGoal = hash(event.id) % 100 < config.goalChance;
        const result = { events: [...events, event].slice(-24), expiresAt: now + 60000 };
        tests.set(testKey, result); return result;
    }
    function reset(channel, id, screen, baseline = {}) {
        if (!ids.has(id)) throw new Error('Bilinmeyen widget');
        const data = read(channel); data.resets ||= {}; data.resets[slot(id, screen)] = Date.now();
        data.baselines ||= {}; data.baselines[slot(id, screen)] = { totalCoins: Math.max(0, Number(baseline.totalCoins) || 0) };
        if (['topgifter', 'topliker', 'streambuddies'].includes(id)) {
            const metric = id === 'topliker' ? 'totalLikes' : 'totalCoins';
            const rows = id === 'topliker' ? baseline.topLikes : baseline.topGifters;
            data.baselines[slot(id, screen)].ranks = Object.fromEntries((rows || []).map(row => [row.username, Number(row[metric]) || 0]));
        }
        if (id === 'penalty') data.scores = {};
        if (royalIds.has(id) && data.royalLeaders) delete data.royalLeaders[id];
        store.set(key(channel), data); tests.delete(`${cleanChannel(channel)}:${slot(id, screen)}`);
    }
    function beginSession(channel, roomId, onNewSession = () => {}) {
        if (!/^\d+$/.test(String(roomId || ''))) return false;
        const data = read(channel), room = String(roomId);
        if (data.session?.roomId === room) return false;
        // Only a verified new room resets live contents; settings remain intact.
        onNewSession(data.session || null);
        data.session = { roomId: room, startedAt: Date.now() };
        data.scores = {}; data.baselines = {}; data.resets = {}; data.likeTotals = {}; data.royalLeaders = {};
        for (const id of ids) {
            const slots = id === 'myactions' ? Array.from({ length: 8 }, (_, i) => slot(id, i + 1)) : [id];
            for (const name of slots) data.resets[name] = data.session.startedAt;
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
        return { settings: configs, tests: active, session: data.session || null, resets: data.resets || {}, baselines: data.baselines || {}, royalLeaders: data.royalLeaders || {}, penaltyScores: Object.values(data.scores || {}).sort((a, b) => b.goals - a.goals || a.shots - b.shots).slice(0, 13) };
    }
    return { settings, save, ingest, test, reset, beginSession, state };
}
module.exports = { definitions, ids, royalIds, schema, normalize, slot, hash, createStudio };
