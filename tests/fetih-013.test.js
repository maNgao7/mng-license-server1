import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const previous = read('content-bootstrap-pre-fetih-0.1.3.json');
const current = read('content-bootstrap-pre-fetih-0.1.4.json');

test('the shipped Fetih 0.1.3 catalog advances only the Fetih package', () => {
    const gameIndex = previous.games.findIndex(game => game.id === 'fetih');
    const oldGame = previous.games[gameIndex];
    const game = current.games[gameIndex];
    assert.equal(oldGame.version, '0.1.2');
    assert.equal(game.version, '0.1.3');
    assert.match(game.url, /\/fetih-0\.1\.3\/Fetih-Windows-x64\.zip$/);
    assert.match(game.sha256, /^[a-f0-9]{64}$/);
    assert.ok(game.bytes > 100_000_000);
    const expected = structuredClone(previous);
    expected.revision = 2026112102;
    expected.publishedAt = current.publishedAt;
    Object.assign(expected.games[gameIndex], {
        version: game.version, url: game.url, sha256: game.sha256, bytes: game.bytes
    });
    assert.deepEqual(current, expected);
});

test('Fetih 0.1.2 upgrades without overwriting custom admin changes', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const options = { allowReleasedBaseline: true };
    assert.deepEqual(upgradedBootstrapState(state, previous, current, options), { draft: current, published: current });
    state.draft.games.find(game => game.id === 'fetih').description = 'Yayıncının kendi açıklaması';
    assert.equal(upgradedBootstrapState(state, previous, current, options), null);
});
