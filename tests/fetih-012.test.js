import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const previous = read('content-bootstrap-pre-fetih-0.1.2.json');
const current = read('content-defaults.json');

test('Fetih 0.1.2 updates only the Fetih package in both catalogs', () => {
    const oldFetih = previous.games.find(game => game.id === 'fetih');
    const fetih = current.games.find(game => game.id === 'fetih');
    assert.equal(oldFetih.version, '0.1.1');
    assert.equal(fetih.version, '0.1.2');
    assert.match(fetih.url, /\/fetih-0\.1\.2\/Fetih-Windows-x64\.zip$/);
    assert.match(fetih.sha256, /^[a-f0-9]{64}$/);
    assert.ok(fetih.bytes > 100_000_000);
    assert.deepEqual(fetih.resources, oldFetih.resources);
    assert.deepEqual(current.games.filter(game => game.id !== 'fetih'), previous.games.filter(game => game.id !== 'fetih'));
    assert.deepEqual(current.media, previous.media);
    assert.deepEqual(current, read('web/content-catalog-7.0.0.json'));
});

test('the shipped catalog upgrades and a custom draft is preserved', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    const options = { allowReleasedBaseline: true };
    assert.deepEqual(upgradedBootstrapState(state, previous, current, options), { draft: current, published: current });
    state.draft.games.find(game => game.id === 'fetih').description = 'Özel taslak';
    assert.equal(upgradedBootstrapState(state, previous, current, options), null);
});
