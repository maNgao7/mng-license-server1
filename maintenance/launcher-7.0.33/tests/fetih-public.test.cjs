const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const resources=require('../lib/game-resources.cjs');
const {validatePackageDirectory}=require('../lib/fetih-package.cjs');
test('Fetih is published with no local administrator archive or Steam prerequisite',()=>{
 const published=require('../lib/published-games.json').games.find(g=>g.id==='fetih');
 const game=require('../lib/catalog-defaults.json').games.find(g=>g.id==='fetih');
 assert.ok(published&&!published.adminOnly&&!published.definition.adminOnly);
 assert.equal(published.cover,'fetih-v1');
 assert.equal(game.version,'0.1.1');
 assert.match(game.url,/^https:\/\/github\.com\/maNgao7\/mng-license-server1\/releases\/download\/fetih-0\.1\.1\//);
 assert.equal(game.bytes,172735905);
 assert.equal('localArchive' in game,false);
 assert.match(game.requirements,/Steam veya başka bir oyun kurulumu gerekmez/);
 const main=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
 assert.ok(!main.includes('fetih-preview.cjs'));
 assert.ok(!fs.readFileSync(path.join(__dirname,'../lib/platform.cjs'),'utf8').includes('fetih-preview.cjs'));
});
test('Fetih original gift PNG remains byte-verified and available before installing the game',()=>{
 const {guide,data}=resources.readGuide('fetih');
 assert.equal(guide.width,6334);assert.equal(guide.height,1000);
 assert.equal(guide.bytes,1406321);
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),'9364b48c5fc83da761e47a7ee2e9ccf0e30cba0ac3d42b8a5482c73da561ce8f');
 assert.equal(validatePackageDirectory(null),false);
 assert.equal(validatePackageDirectory(path.join(__dirname,'missing-fetih')),false);
});
