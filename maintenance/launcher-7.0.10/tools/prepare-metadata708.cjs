'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=path.resolve(__dirname,'..'),repository=path.resolve(source,'../..');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),write=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
for(const file of ['package.json','package-lock.json']){
    const target=path.join(source,file),data=read(target);data.version='7.0.8';if(data.packages?.[''])data.packages[''].version='7.0.8';write(target,data);
}
const defaults=path.join(repository,'content-defaults.json'),previous=read(defaults);
const baseline=path.join(repository,'content-bootstrap-7.0.7.json');if(!fs.existsSync(baseline))write(baseline,previous);
const catalog={...previous,revision:Math.max(9,previous.revision),publishedAt:'2026-10-28T13:00:00.000Z',games:previous.games.filter(game=>game.id!=='crowd-control')};
assert.equal(catalog.games.length,15);write(defaults,catalog);write(path.join(source,'lib/catalog-defaults.json'),catalog);
const artworkFile=path.join(source,'renderer/assets/game-covers/artwork-current.json'),artwork=read(artworkFile);artwork.covers=artwork.covers.filter(row=>row.id!=='crowd-control');write(artworkFile,artwork);
const workspaceFile=path.join(source,'renderer/workspace.js');fs.writeFileSync(workspaceFile,fs.readFileSync(workspaceFile,'utf8').replace("'crowd-control':'crowd-control-v4',",''));
const webCatalog=path.join(repository,'web/game-catalog.json'),web=read(webCatalog);web.revision='20261028-7.0.8';web.games=web.games.filter(game=>game.id!=='crowd-control');web.heading='15 oyun. Her yayına başka bir heyecan.';write(webCatalog,web);
const htmlFile=path.join(repository,'web/index.html');let html=fs.readFileSync(htmlFile,'utf8');
html=html.replace(/(<script id="publicGameCatalog" type="application\/json">)[\s\S]*?(<\/script>)/,(_,open,close)=>open+JSON.stringify(web).replace(/</g,'\\u003c')+close);
html=html.replace(/\s*<article class="catalog-card" data-game="crowd-control"[\s\S]*?<\/article>/,'');
html=html.replace(/\b16 oyun\b/g,'15 oyun').replace(/(catalog-search-count[^>]*>)16(<)/,(_,before,after)=>before+'15'+after).replace(/(data-filter=""[^>]*>Tümü <span>)16(<)/,(_,before,after)=>before+'15'+after);
html=html.replace(/(<button[^>]*data-filter="Aksiyon &amp; Strateji"[^>]*>[\s\S]*?<span>)3(<\/span>)/,(_,before,after)=>before+'2'+after);
fs.writeFileSync(htmlFile,html);
for(const name of ['entry-videos.test.cjs','entry-overlay.test.cjs','royal-state.test.cjs']){
    const input=fs.readFileSync(path.join('D:/TikMnG-Entry-Videos-Reliability-20261028',name),'utf8');
    fs.writeFileSync(path.join(source,'tests',name),input.replaceAll('./source/lib/','../lib/').replaceAll("'source/renderer/","'../renderer/"));
}
console.log(JSON.stringify({version:'7.0.8',games:catalog.games.length,media:catalog.media.length,removedOnly:'crowd-control'}));
