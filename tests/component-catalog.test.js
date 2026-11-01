import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { componentCatalog } from '../component-catalog.js';
const old = { revision: 100, games: [{ id: 'snow-war', version: '7.0.4', title: 'Snow', url: 'https://example.test/legacy.zip' },
    { id: 'battle-royale', version: '7.0.4', title: 'Royale', url: 'https://example.test/legacy2.zip' }] };
const rollout = { enabled: true, revision: 101, games: [{ id: 'snow-war', previousVersion: '7.0.4', version: '7.0.5', url: 'https://example.test/payload.zip',
    bytes: 123, sha256: 'a'.repeat(64), files: [{ path: '.tikmng-content.json', bytes: 1000, sha256: 'b'.repeat(64), url: 'https://example.test/manifest.json' }] }] };
test('old launchers receive unchanged compatible catalog; only explicit capability selects new format', () => {
    assert.equal(componentCatalog(old, undefined, rollout), old);
    assert.equal(componentCatalog(old, 'unknown', rollout), old);
    assert.equal(componentCatalog(old, 'shared-runtime-v2', { ...rollout, enabled: false }), old);
    const next = componentCatalog(old, 'shared-runtime-v2', rollout);
    assert.equal(next.games[0].format, 'shared-runtime-v2'); assert.equal(next.games[0].version, '7.0.5');
    assert.equal(next.games[1], old.games[1]); assert.equal(old.games[0].version, '7.0.4');
});
test('administrator newer package is not overridden and bad manifests fail closed', () => {
    const published = { ...old, games: [{ ...old.games[0], version: '7.0.6' }] };
    assert.equal(componentCatalog(published, 'shared-runtime-v2', rollout).games[0].version, '7.0.6');
    const bad = structuredClone(rollout); bad.games[0].files[0].url = 'http://public.invalid/file';
    assert.equal(componentCatalog(old, 'shared-runtime-v2', bad), old);
});

test('invalid payload integrity never replaces a working published package', () => {
    for (const [key, value] of [['sha256', 'invalid'], ['bytes', 0], ['bytes', -1], ['bytes', 1.5]]) {
        const bad = structuredClone(rollout); bad.games[0][key] = value;
        assert.equal(componentCatalog(old, 'shared-runtime-v2', bad), old);
    }
});

test('7.0.6 Snow rollout preserves legacy clients, unrelated descriptors and administrator versions', () => {
    const current=JSON.parse(fs.readFileSync(new URL('../content-components.json',import.meta.url),'utf8'));
    const published={...old,media:[{id:'unchanged'}]};
    const next=componentCatalog(published,'shared-runtime-v2',current);
    assert.equal(next.games[0].version,'7.0.6');
    assert.equal(next.games[0].bytes,105812215);
    assert.equal(next.games[0].sha256,'b8cae611264a6518c1ff9d3ac358b1bdf1230c81cd6e11346387f33265882dc2');
    assert.equal(next.media,published.media);
    assert.equal(componentCatalog(published,undefined,current),published);
    const customized={...published,games:[{...old.games[0],version:'7.0.7'},old.games[1]]};
    assert.equal(componentCatalog(customized,'shared-runtime-v2',current).games[0],customized.games[0]);
    for(const id of ['battle-royale','minecraft-snake-arena','zombie-war']){
        const original=current.games.find(game=>game.id===id);
        assert.equal(original.version,id==='battle-royale'?'7.0.5':id==='minecraft-snake-arena'?'0.17.0':'6.5.18');
    }
});
