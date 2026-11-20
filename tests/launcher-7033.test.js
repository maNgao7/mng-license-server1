import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'));

test('the revision updates only Snake and Arena and migrates the shipped baseline', () => {
    const old = read('content-bootstrap-fetih-0.1.1.json');
    const updated = read('content-defaults.json');
    const changed = updated.games.filter((game, index) => game.version !== old.games[index].version);
    assert.deepEqual(changed.map(game => [game.id, game.version]),
        [['yaratik-arena', '0.1.32'], ['minecraft-snake-arena', '0.16.1']]);
    assert.deepEqual(updated.media, old.media);
    assert.deepEqual(updated, read('web/content-catalog-7.0.0.json'));
    for (const game of changed) {
        assert.match(game.sha256, /^[a-f0-9]{64}$/);
        assert.ok(game.bytes > 0);
    }
    const state = { published: structuredClone(old), draft: structuredClone(old) };
    assert.deepEqual(upgradedBootstrapState(state, old, updated, { allowReleasedBaseline: true }),
        { published: updated, draft: updated });
    state.draft.games[0].description += ' Özel taslak.';
    assert.equal(upgradedBootstrapState(state, old, updated, { allowReleasedBaseline: true }), null);
});
