import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const previous = read('content-bootstrap-7.0.16.json');
const current = read('content-defaults.json');
const updated = new Map([['yaratik-arena', '0.1.29'], ['turkish-forza-05', '0.5.1']]);

test('7.0.17 advances only the two game downloads from the unmodified 7.0.16 catalog', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const next = upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true });
    assert.ok(next);
    assert.equal(next.published.revision, current.revision);
    assert.deepEqual(next.published.games.filter(g => !updated.has(g.id)), previous.games.filter(g => !updated.has(g.id)));
    assert.deepEqual(next.published.media, previous.media);
    for (const [id, version] of updated) {
        const game = next.published.games.find(g => g.id === id);
        assert.equal(game.version, version);
        assert.match(game.url, new RegExp('/v7\\.0\\.17/' + id + '\\.zip$'));
        assert.match(game.sha256, /^[a-f0-9]{64}$/);
    }
    state.draft.games[0].description = 'Edited by administrator';
    assert.equal(upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true }), null);
});
