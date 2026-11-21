import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const previous = read('content-bootstrap-fetih-0.1.0.json');
const current = read('content-bootstrap-fetih-0.1.1.json');

test('Fetih 0.1.1 is a verified game-only update with the existing gift resource', () => {
    const before = previous.games.find(game => game.id === 'fetih');
    const after = current.games.find(game => game.id === 'fetih');
    assert.equal(before.version, '0.1.0');
    assert.equal(after.version, '0.1.1');
    assert.match(after.url, /\/fetih-0\.1\.1\/Fetih-Windows-x64\.zip$/);
    assert.match(after.sha256, /^[a-f0-9]{64}$/);
    assert.ok(after.bytes > 100_000_000);
    assert.deepEqual(after.resources, before.resources);
    assert.deepEqual(current.games.filter(game => game.id !== 'fetih'), previous.games.filter(game => game.id !== 'fetih'));
    assert.deepEqual(current.media, previous.media);
    assert.deepEqual(read('content-bootstrap-pre-fetih-0.1.2.json').games.find(game => game.id === 'fetih'), after);
});

test('the previous published baseline upgrades once and custom catalog changes are preserved', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const options = { allowReleasedBaseline: true };
    const updated = upgradedBootstrapState(state, previous, current, options);
    assert.deepEqual(updated, { draft: current, published: current });
    assert.equal(upgradedBootstrapState(updated, previous, current, options), null);
    state.draft.games[0].description = 'Özel taslak';
    assert.equal(upgradedBootstrapState(state, previous, current, options), null);
});
