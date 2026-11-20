import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {upgradedBootstrapState} from '../content-bootstrap.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const previous=read('content-bootstrap-uslu-0.2.10.json');
const current=read('content-bootstrap-fetih-0.1.0.json');
test('Fetih adds one verified independent Windows package and preserves all other games',()=>{
 const game=current.games.find(g=>g.id==='fetih');
 assert.equal(game.version,'0.1.0');assert.equal(game.bytes,129621136);
 assert.equal(game.sha256,'b4ecf9a51132a6fb6f7e734805ced76b2dde14790dabda3015cb4e7204983a20');
 assert.match(game.url,/releases\/download\/v7\.0\.28\/Fetih-Windows-x64\.zip$/);
 assert.match(game.requirements,/Steam veya başka bir oyun kurulumu gerekmez/);
 assert.deepEqual(current.games.filter(g=>g.id!=='fetih'),previous.games);
 assert.deepEqual(current.media,previous.media);
});
test('Fetih publication upgrades the released baseline once and preserves personal changes',()=>{
 const state={draft:structuredClone(previous),published:structuredClone(previous)};
 const options={allowReleasedBaseline:true};
 const next=upgradedBootstrapState(state,previous,current,options);
 assert.deepEqual(next,{draft:current,published:current});
 assert.equal(upgradedBootstrapState(next,previous,current,options),null);
 state.draft.games[0].description='Özel taslak';
 state.published.games[1].description='Özel yayın';
 const retained=structuredClone(state);
 assert.equal(upgradedBootstrapState(state,previous,current,options),null);
 assert.deepEqual(state,retained);
});
