'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const asar=require('D:/TikMnG-Genel-Guncelleme-20261112/launcher-release/node_modules/@electron/asar');
const root=path.resolve(__dirname,'..'),release=path.resolve(root,'../release');
const archive=path.join(release,'win-unpacked/resources/app.asar');
const packaged=file=>asar.extractFile(archive,path.normalize(file));
assert.equal(JSON.parse(packaged('package.json')).version,'7.0.25');
for(const file of ['main.js','preload.js','lib/platform.cjs','lib/prison-package.cjs','lib/steam-installation-cache.cjs','lib/entry-videos.cjs','renderer/entry-videos.js','renderer/workspace.js','lib/catalog-defaults.json','lib/published-games.json','lib/game-resources.json','renderer/assets/game-covers/hapisten-kac-v1.png'])assert.ok(packaged(file).equals(fs.readFileSync(path.join(root,file))),file);
const catalog=JSON.parse(packaged('lib/catalog-defaults.json'));
for(const id of ['battle-game','penalty-kick','tightrope-balance'])assert.ok(!catalog.games.some(g=>g.id===id));
const hash=(name,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(fs.readFileSync(path.join(release,name))).digest(encoding);
for(const id of ['profile-duel','hapisten-kac']){
 const game=catalog.games.find(g=>g.id===id),name=id+'.zip';
 assert.equal(game.sha256,hash(name));assert.equal(game.bytes,fs.statSync(path.join(release,name)).size);
}
const setup='TikMnG-Setup-7.0.25.exe';const latest=fs.readFileSync(path.join(release,'latest.yml'),'utf8');
assert.match(latest,/^version: 7\.0\.25\b/);assert.ok(latest.includes('path: '+setup));assert.ok(latest.includes('sha512: '+hash(setup,'sha512','base64')));assert.ok(latest.includes('size: '+fs.statSync(path.join(release,setup)).size));
const names=[setup,setup+'.blockmap','TikMnG-7.0.25-Portable.exe','latest.yml','profile-duel.zip','hapisten-kac.zip'];
const report={version:'7.0.25',utc:new Date().toISOString(),verified:true,files:names.map(name=>({name,bytes:fs.statSync(path.join(release,name)).size,sha256:hash(name)}))};
fs.writeFileSync(path.join(release,'manifest-7.0.25.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
