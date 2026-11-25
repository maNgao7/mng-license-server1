import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const read = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const before = read('content-bootstrap-pre-fetih-0.1.5.json');
const after = read('content-bootstrap-pre-profile-duel-0.5.8.json');

test('the Fetih 0.1.5 release catalog updates its package and guide and preserves other games', () => {
    const expected = structuredClone(before);
    const oldGame = expected.games.find(game => game.id === 'fetih');
    const game = after.games.find(game => game.id === 'fetih');
    assert.equal(oldGame.version, '0.1.4');
    assert.equal(game.version, '0.1.5');
    assert.equal(game.url, 'https://github.com/maNgao7/mng-license-server1/releases/download/fetih-0.1.5/Fetih-Windows-x64.zip');
    assert.match(game.sha256, /^[a-f0-9]{64}$/);
    assert.notEqual(game.sha256, oldGame.sha256);
    assert.ok(Number.isSafeInteger(game.bytes) && game.bytes > 100_000_000);
    const guide = read('web/game-catalog.json').games.find(item => item.id === 'fetih').wishesGuide;
    assert.deepEqual(game.resources, [{ title: 'İzleyici dilekleri', url: 'https://tikmng.com' + guide }]);
    oldGame.resources = game.resources;
    for (const field of ['version', 'url', 'sha256', 'bytes']) oldGame[field] = game[field];
    expected.revision = 2026112501;
    expected.publishedAt = after.publishedAt;
    assert.deepEqual(after, expected);
});

test('upgrading the previous live catalog preserves pending edits and only migrates once', () => {
    const options = { allowReleasedBaseline: true };
    const state = { draft: structuredClone(before), published: structuredClone(before) };
    const upgraded = upgradedBootstrapState(state, before, after, options);
    assert.deepEqual(upgraded, { draft: after, published: after });
    assert.equal(upgradedBootstrapState(upgraded, before, after, options), null);
    state.draft.games.find(game => game.id === 'fetih').title = 'Özel başlık';
    assert.equal(upgradedBootstrapState(state, before, after, options), null);
});
