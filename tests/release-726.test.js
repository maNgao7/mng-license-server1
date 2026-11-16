import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { upgradedBootstrapState } from '../content-bootstrap.js';

const json = name => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const previous = json('content-bootstrap-7.0.25.json');
const current = json('content-bootstrap-7.0.26.json');
const versions = { vs: '7.0.3', puanlama: '7.0.3', orbit: '7.0.4', 'duck-hunt': '7.0.3', 'pony-life': '7.0.3', 'frog-river': '7.0.6' };

test('7.0.26 publishes six shared connection updates with verified incremental content', () => {
    assert.equal(current.revision, 2026111601);
    assert.deepEqual(current.media, previous.media);
    assert.deepEqual(current.launcher, previous.launcher);
    for (const game of current.games) {
        if (!versions[game.id]) {
            assert.deepEqual(game, previous.games.find(item => item.id === game.id));
            continue;
        }
        assert.equal(game.version, versions[game.id]);
        assert.match(game.sha256, /^[a-f0-9]{64}$/);
        assert.ok(game.bytes > 0);
        assert.ok(game.url.includes('/v7.0.26/'));
        for (const file of ['launcher-live-client.cjs', 'launcher-live.mjs']) {
            const patch = game.files.find(item => item.path === file);
            assert.ok(patch);
            assert.match(patch.sha256, /^[a-f0-9]{64}$/);
            assert.ok(patch.bytes > 0);
        }
        const patchBytes = game.files.reduce((sum, file) => sum + file.bytes, 0);
        assert.ok(patchBytes < 1024 * 1024);
    }
});

test('released defaults upgrade atomically and personal changes remain authoritative', () => {
    const state = { draft: structuredClone(previous), published: structuredClone(previous) };
    assert.deepEqual(upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true }),
        { draft: current, published: current });
    state.draft.games[0].description = 'Saved personal content';
    assert.equal(upgradedBootstrapState(state, previous, current, { allowReleasedBaseline: true }), null);
});
