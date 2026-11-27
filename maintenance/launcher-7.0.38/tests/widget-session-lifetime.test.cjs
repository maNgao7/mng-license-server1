'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const fc = require(process.env.TIKMNG_FAST_CHECK || 'fast-check');
const { createStudio } = require('../lib/widget-studio.cjs');
const { scopedWidgetSnapshot } = require('../lib/widget-snapshot.cjs');
const { createWidgetPortraits } = require('../lib/widget-portraits.cjs');

const avatar = '/widget/gift-assets/portrait-11111111-1111-1111-1111-111111111111.png';
const gift = (id, username, count, giftId = '6427') => ({
    id, username, nickname: username, type: 'gift', giftId, count, coins: count, createdAt: Date.now()
});
function fixture() {
    const disk = new Map();
    const store = {
        get: (key, fallback) => structuredClone(disk.get(key) ?? fallback),
        set: (key, value) => disk.set(key, structuredClone(value)),
        batch: work => work()
    };
    return { store, reopen: () => createStudio(store, () => '') };
}

test('Racon follows the latest matching live sender across restarts and rooms', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 30 }), actions => {
        const { reopen } = fixture();
        let studio = reopen();
        studio.beginSession('host', '111');
        const first = gift('first', 'first_user', 20);
        studio.ingest('host', first);
        let holder = 'first_user', room = 111;
        actions.forEach((action, index) => {
            if (action === 1) {
                holder = 'new_user_' + index;
                studio.ingest('host', gift('event-' + index, holder, 1));
            }
            if (action === 2) studio.beginSession('host', String(++room));
            if (action === 3) studio = reopen();
            if (action === 4) studio.ingest('host', first);
            if (action === 5) studio.ingest('host', gift('test-' + index, 'test_user', 100), { live: false });
            if (action === 6) studio.ingest('host', gift('other-' + index, 'other_user', 100, '1'));
            assert.equal(studio.state('host').royalLeaders.raconking.username, holder);
        });
    }), { numRuns: 30 });
});

test('copied Racon link receives the saved portrait and rejects a delayed portrait from a former holder', () => {
    const { reopen } = fixture();
    const studio = reopen();
    studio.ingest('host', gift('a', 'first_user', 10));
    assert.equal(studio.rememberRoyalPortrait('host', 'first_user', { avatar, avatarWidth: 720 }), true);
    const restored = reopen();
    restored.beginSession('host', '222');
    const state = scopedWidgetSnapshot({ channel: 'host', studio: restored.state('host') }, 'raconking');
    assert.equal(state.studio.royalLeaders.raconking.cachedAvatar, avatar);
    restored.ingest('host', gift('b', 'second_user', 1));
    assert.equal(restored.rememberRoyalPortrait('host', 'first_user', { avatar, avatarWidth: 1080 }), false);
    assert.equal(restored.state('host').royalLeaders.raconking.cachedAvatar, undefined);
});

test('cached portrait can render again when TikTok source URL is absent after restart', () => {
    const portraitPath = '/local/portrait.png';
    const engine = {
        PortraitCache: class { file() { return portraitPath; } close() {} },
        ProfileSources: class { close() {} }, VsPortraits: class { close() {} }
    };
    const portraits = createWidgetPortraits({ engine });
    try {
        const projected = portraits.row({ username: 'holder', avatar: '', cachedAvatar: avatar, avatarWidth: 720 });
        assert.equal(projected.avatar, avatar);
        assert.equal(projected.avatarWidth, 720);
        assert.equal(projected.cachedAvatar, undefined);
    } finally { portraits.close(); }
});

test('Viral Benim and highest-gift pools reset on a verified new room only', () => {
    const { store, reopen } = fixture();
    const studio = reopen();
    const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
    const start = source.indexOf('function widgetYayinOturumunuBaslat');
    const end = source.indexOf('function widgetTikTokOturumuOlustur', start);
    const state = {
        widgetChannel: 'host', widgetHealthRoom: '', widgetStreamHealth: { reset() {} },
        widgetStudio: studio, widgetKanaliniTemizle: value => value, platform: null, store,
        widgetStoreKey: key => key, widgetAudience: { reset() {} }, widgetHavuzlariniKaydet() {},
        widgetPool: {}, widgetLikePool: {}, widgetLeaderboardPool: {}, widgetActivityPool: [],
        widgetJarPool: [], widgetMetaPool: {}
    };
    const update = vm.runInNewContext(source.slice(start, end) + '\nwidgetYayinOturumunuBaslat', state);
    const connect = roomId => update({ status: 'connected', username: 'host', roomId });
    connect('111');
    state.widgetPool = { champion: { username: 'top' } };
    state.widgetLeaderboardPool = { top: { username: 'top' } };
    state.widgetMetaPool.topStreak = { username: 'top' };
    studio.ingest('host', gift('racon', 'holder', 1));
    assert.equal(update({ status: 'waiting', reason: 'offline', username: 'host' }), false);
    connect('111');
    assert.equal(state.widgetPool.champion.username, 'top');
    assert.equal(state.widgetLeaderboardPool.top.username, 'top');
    assert.equal(state.widgetMetaPool.topStreak.username, 'top');
    connect('222');
    assert.equal(state.widgetPool.champion, undefined);
    assert.equal(state.widgetLeaderboardPool.top, undefined);
    assert.equal(state.widgetMetaPool.topStreak, null);
    assert.equal(studio.state('host').royalLeaders.raconking.username, 'holder');
});
