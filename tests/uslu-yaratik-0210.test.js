import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const json = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const previous = json('content-bootstrap-7.0.26.json');
const current = json('content-bootstrap-uslu-0.2.10.json');
const id = 'rezervuar-01';

test('Uslu Yaratık 0.2.10 updates exactly one game package independently of the launcher', () => {
    const oldGame = previous.games.find(game => game.id === id);
    const game = current.games.find(game => game.id === id);
    assert.equal(oldGame.version, '0.2.9');
    assert.equal(previous.revision, 2026111601);
    assert.equal(current.revision, 2026111602);
    assert.ok(Number.isFinite(Date.parse(current.publishedAt)));
    assert.deepEqual(game, {
        ...oldGame, version: '0.2.10', bytes: 133790898,
        sha256: '9af0e88b203d39b846399665a61fbce1551b4438b0c45177048b28647c299c8b',
        url: 'https://github.com/maNgao7/mng-license-server1/releases/download/uslu-yaratik-0.2.10/uslu-yaratik.zip',
    });
    assert.deepEqual(current, {
        ...previous, revision: current.revision, publishedAt: current.publishedAt,
        games: previous.games.map(item => item.id === id ? game : item),
    });
    assert.deepEqual(current.games.find(game => game.id === id), json('web/content-catalog-7.0.0.json').games.find(game => game.id === id));
    assert.equal(json('package.json').version, '7.0.33');
});

test('the exact 7.0.26 catalog upgrades once without mutating the previous state', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const upgraded = upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true });
    assert.deepEqual(upgraded, { draft: current, published: current });
    assert.deepEqual(state, { draft: previous, published: previous });
    assert.notEqual(upgraded.draft, upgraded.published);
    assert.equal(upgradedBootstrapState(upgraded, previous, current, { allowReleasedBaseline: true }), null);
});

test('custom Uslu Yaratık packages, other games, media and pending edits are retained', () => {
    const edits = [
        catalog => catalog.games.find(game => game.id === id).url = 'https://github.com/custom/uslu.zip',
        catalog => catalog.games.find(game => game.id === id).version = '0.2.9-personal',
        catalog => catalog.games.find(game => game.id !== id).title = 'Personal game title',
        catalog => catalog.media[0].title = 'Personal video',
        catalog => catalog.revision++,
    ];
    for (const field of ['draft', 'published']) for (const edit of edits) {
        const state = { draft: structuredClone(previous), published: structuredClone(previous) };
        edit(state[field]);
        const retained = structuredClone(state);
        assert.equal(upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true }), null);
        assert.deepEqual(state, retained);
    }
});
