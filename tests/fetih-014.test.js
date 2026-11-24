import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const previous = read('content-bootstrap-pre-fetih-0.1.4.json');
const current = read('content-bootstrap-pre-hapisten-kac-0.2.1.json');

test('Fetih 0.1.4 replaces only the Fetih package in the live and web catalogs', () => {
    const expected = structuredClone(previous);
    const oldGame = expected.games.find(game => game.id === 'fetih');
    const game = current.games.find(game => game.id === 'fetih');
    assert.equal(oldGame.version, '0.1.3');
    assert.equal(game.version, '0.1.4');
    assert.match(game.url, /\/fetih-0\.1\.4\/Fetih-Windows-x64\.zip$/);
    assert.match(game.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(game.bytes) && game.bytes > 100_000_000);
    expected.revision = 2026112103;
    expected.publishedAt = current.publishedAt;
    Object.assign(oldGame, { version: game.version, url: game.url, sha256: game.sha256, bytes: game.bytes });
    assert.deepEqual(current, expected);
});

test('Fetih 0.1.4 applies to an untouched 0.1.3 catalog and preserves a custom draft', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const options = { allowReleasedBaseline: true };
    assert.deepEqual(upgradedBootstrapState(state, previous, current, options), { draft: current, published: current });
    state.draft.games.find(game => game.id === 'fetih').description = 'Özel açıklama';
    assert.equal(upgradedBootstrapState(state, previous, current, options), null);
});
