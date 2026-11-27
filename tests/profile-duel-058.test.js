import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));

test('Profile Duel 0.5.8 replaces only its ZIP in the released catalog and remains in current defaults', () => {
    const expected = read('content-bootstrap-pre-profile-duel-0.5.8.json');
    const defaults = read('content-bootstrap-pre-ring-0.1.0.json');
    assert.equal(expected.revision, 2026112501);
    assert.ok(Date.parse(defaults.publishedAt) > Date.parse(expected.publishedAt));

    const previous = expected.games.find(game => game.id === 'profile-duel');
    const { sha256, bytes } = defaults.games.find(game => game.id === 'profile-duel');
    assert.equal(previous.version, '0.5.7');
    assert.notEqual(sha256, previous.sha256);
    assert.match(sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(bytes) && bytes > 0);
    Object.assign(previous, {
        version: '0.5.8',
        url: 'https://github.com/maNgao7/mng-license-server1/releases/download/profile-duel-0.5.8/profile-duel.zip',
        sha256,
        bytes
    });
    expected.revision = 2026112502;
    expected.publishedAt = defaults.publishedAt;
    assert.deepEqual(defaults, expected);
    for (const file of ['content-defaults.json', 'web/content-catalog-7.0.0.json']) {
        assert.deepEqual(read(file).games.find(game => game.id === 'profile-duel'), previous, file);
    }
});
