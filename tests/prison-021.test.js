import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
test('Hapisten Kaç 0.2.1 updates only the verified game and leaves launcher and other games intact', () => {
    const previous = read('content-bootstrap-pre-hapisten-kac-0.2.1.json');
    const current = read('content-bootstrap-pre-fetih-0.1.5.json');
    const oldGame = previous.games.find(game => game.id === 'hapisten-kac');
    const game = current.games.find(game => game.id === oldGame.id);
    assert.equal(oldGame.version, '0.2.0');
    assert.equal(game.version, '0.2.1');
    assert.equal(game.sha256, '876caec9ad6732f29cc36ed71bdd972e173595ecdb88811538fc3dd7ac2afe9b');
    assert.equal(game.bytes, 123799413);
    for (const key of ['version', 'url', 'sha256', 'bytes']) oldGame[key] = game[key];
    previous.revision = 2026112401;
    previous.publishedAt = current.publishedAt;
    assert.deepEqual(current, previous);
});
