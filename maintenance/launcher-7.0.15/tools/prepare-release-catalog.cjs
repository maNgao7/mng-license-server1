'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validateCatalog}=require('../lib/content-catalog.cjs');
const media=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.0-media/manifest.json','utf8'));
const web=JSON.parse(fs.readFileSync('D:/TikMnG-Release-7.0.0-source/web/game-catalog.json','utf8'));
const filename=path.resolve(__dirname,'../lib/catalog-defaults.json');
const catalog=JSON.parse(fs.readFileSync(filename,'utf8'));
catalog.revision=1;catalog.publishedAt='2026-10-23T14:30:00Z';
for(const game of catalog.games){const publicGame=web.games.find(item=>item.id===game.id);if(publicGame){game.description=publicGame.description;if(game.id==='caahr')game.requirements=publicGame.requirements;}}
Object.assign(catalog.games.find(game=>game.id==='caahr'),{
  version:'0.6.11',url:'https://github.com/maNgao7/mng-license-server1/releases/download/game-caahr-0.6.11/voice-driving-0.6.11.zip',
  bytes:52163999,sha256:'2e95c3c4a63b9ef8366ecdb2cb0b93bd1e3dd2f8010b671d9f82a0b290bfe22e'
});
catalog.media=media.media.map(({id,title,category,url,sha256,bytes})=>({id,title,category,url,sha256,bytes}));
const result=validateCatalog(catalog,{serverURL:'https://mng-license-server1.onrender.com'});
fs.writeFileSync(filename,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('D:/TikMnG-Release-7.0.0-source/web/content-catalog-7.0.0.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({revision:result.revision,games:result.games.length,media:result.media.length,bytes:Buffer.byteLength(JSON.stringify(result))}));
