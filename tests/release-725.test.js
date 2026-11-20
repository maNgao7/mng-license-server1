import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const json = file => JSON.parse(read(file));
const previous = json('content-bootstrap-7.0.24.json');
const current = json('content-bootstrap-7.0.25.json');
const withdrawn = new Set(['battle-game', 'penalty-kick', 'tightrope-balance']);

test('7.0.25 changes only the new game, Profile Duel and three retired defaults; media stays exact', () => {
    assert.equal(current.revision, 2026111501);
    assert.ok(current.revision > previous.revision);
    assert.equal(current.games.length, previous.games.length - withdrawn.size + 1);
    assert.deepEqual(current.media, previous.media);
    assert.deepEqual(current.launcher, previous.launcher);
    const unchanged = game => !withdrawn.has(game.id) && !['hapisten-kac', 'profile-duel'].includes(game.id);
    assert.deepEqual(current.games.filter(unchanged), previous.games.filter(unchanged));
    for (const id of withdrawn) assert.equal(current.games.some(game => game.id === id), false);
    for (const [id, version] of [['hapisten-kac', '0.2.0'], ['profile-duel', '0.5.7']]) {
        const game = current.games.find(game => game.id === id);
        assert.equal(game.version, version);
        assert.equal(game.url, `https://github.com/maNgao7/mng-license-server1/releases/download/v7.0.25/${id}.zip`);
        // Main supplies real integrity after packaging; never retain a previous ZIP's hash.
        assert.ok((game.sha256 === null && game.bytes === null) ||
            (/^[a-f0-9]{64}$/.test(game.sha256) && Number.isSafeInteger(game.bytes) && game.bytes > 0));
        assert.equal(game.files, undefined);
    }
    const game = current.games.find(game => game.id === 'hapisten-kac');
    assert.match(game.requirements, /Punch Your Way Out Demo.*5466880/);
    assert.equal(game.resources[0].url, 'https://store.steampowered.com/app/5466880/');
});

test('the exact 7.0.24 baseline upgrades once, while every personal draft and publication remains untouched', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const original = structuredClone(state);
    const next = upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true });
    assert.deepEqual(next, { draft: current, published: current });
    assert.deepEqual(state, original);
    assert.equal(upgradedBootstrapState(next, previous, current, { allowReleasedBaseline: true }), null);
    const changes = [
        c => { c.revision++; }, c => { c.publishedAt = null; }, c => { c.games.reverse(); },
        c => { c.games[0].description = 'Personal description'; }, c => { c.games[0].requirements = 'Personal requirement'; },
        c => { c.games[0].resources.push({ title: 'Personal guide', url: 'https://tikmng.com/personal' }); },
        c => { c.games.find(g => g.id === 'profile-duel').version = '0.5.99'; },
        c => { c.games.find(g => g.id === 'battle-game').title = 'Personal retired game'; },
        c => { c.games = c.games.filter(g => g.id !== 'penalty-kick'); },
        c => { c.media[0].title = 'Personal media'; }, c => { c.media.pop(); },
        c => { c.launcher = { version: '9.0.0' }; }
    ];
    for (const field of ['draft', 'published']) for (const change of changes) {
        const personal = structuredClone(original); change(personal[field]);
        const retained = structuredClone(personal);
        assert.equal(upgradedBootstrapState(personal, previous, current, { allowReleasedBaseline: true }), null);
        assert.deepEqual(personal, retained);
    }
});

test('website JSON, embedded catalog, static cards, counts and supplied Hapisten Kaç assets agree', () => {
    const catalog = json('web/game-catalog.json');
    const fallback = json('web/content-catalog-7.0.0.json');
    const html = read('web/index.html');
    assert.deepEqual(JSON.parse(html.match(/<script id="publicGameCatalog" type="application\/json">([\s\S]*?)<\/script>/)[1]), catalog);
    assert.deepEqual([...html.matchAll(/<article class="catalog-card" data-game="([^"]+)"/g)].map(match => match[1]), catalog.games.map(game => game.id));
    assert.equal(catalog.games.length, 18);
    assert.ok(html.includes(`${catalog.games.length} oyun. Her yayına başka bir heyecan.`));
    for (const game of [...catalog.games, ...fallback.games]) assert.equal(withdrawn.has(game.id), false);
    for (const id of ['hapisten-kac', 'profile-duel']) {
        assert.deepEqual(fallback.games.find(g => g.id === id), current.games.find(g => g.id === id));
    }
    const game = catalog.games.find(game => game.id === 'hapisten-kac');
    assert.equal(game.cover, 'hapisten-kac-v1');
    assert.match(game.requirements, /Punch Your Way Out Demo.*5466880/);
    assert.equal(game.steamUrl, 'https://store.steampowered.com/app/5466880/');
    for (const width of [480, 720, 1000, 1440]) assert.ok(fs.statSync(new URL(`../web/game-covers/${game.cover}-${width}.webp`, import.meta.url)).size > 0);
    assert.ok(fs.statSync(new URL('../web' + game.giftGuide, import.meta.url)).size > 0);
    assert.match(html, /<div>© 2026 TikMnG · v7\.0\.28\./);
    assert.match(html, /"softwareVersion": "7\.0\.28"/);
    assert.equal(json('package.json').version, '7.0.28');
    assert.equal(json('package-lock.json').packages[''].version, '7.0.28');
});
