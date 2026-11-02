'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sharp=require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),web=path.join(root,'web'),catalog=JSON.parse(fs.readFileSync(path.join(web,'game-catalog.json')));
const arena=catalog.games.find(game=>game.id==='yaratik-arena'),source='D:/TikMnG-CanEmAll-Prototype/assets/publishing';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
async function main(){
  assert.ok(arena);assert.equal(catalog.games.length,16);
  for(const width of [500,1000])await sharp(path.join(source,'yaratik-arena-cover-v1.png')).resize({width,withoutEnlargement:true}).webp({quality:84}).toFile(path.join(web,'game-covers',`yaratik-arena-v1-${width}.webp`));
  fs.mkdirSync(path.join(web,'gift-guides'),{recursive:true});
  fs.copyFileSync(path.join(source,'yaratik-arena-gifts.png'),path.join(web,'gift-guides/yaratik-arena.png'));
  let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
  if(!html.includes('data-game="yaratik-arena"')){
    const card=`<article class="catalog-card" data-game="yaratik-arena" data-category="${esc(arena.category)}"><button class="catalog-open" data-game-open="yaratik-arena" aria-label="Yaratık Arena oyununu incele"><div class="catalog-art"><img src="/game-covers/yaratik-arena-v1-500.webp" srcset="/game-covers/yaratik-arena-v1-500.webp 500w, /game-covers/yaratik-arena-v1-1000.webp 1000w" sizes="(max-width:600px) 100vw, (max-width:1000px) 50vw, 33vw" width="1000" height="563" loading="lazy" alt="Yaratık Arena oyun kapağı"><span class="catalog-new">Yeni</span><span class="catalog-art-arrow">${icon('arrow-up-right')}</span></div><div class="catalog-copy"><span class="catalog-category">${esc(arena.category)}</span><h3>Yaratık Arena</h3><p>${esc(arena.tagline)}</p><span class="catalog-command">Oyunu incele ${icon('arrow-right')}</span></div></button></article>`;
    assert.ok(html.includes('<div class="catalog-grid">'));html=html.replace('<div class="catalog-grid">','<div class="catalog-grid">'+card);
  }
  const start=html.indexOf('<!-- TIKMNG-CATALOG-ANNOUNCEMENT -->'),close='<!-- /TIKMNG-CATALOG-ANNOUNCEMENT -->',end=html.indexOf(close,start);
  assert.ok(start>=0&&end>start);
  const band=`<!-- TIKMNG-CATALOG-ANNOUNCEMENT -->\n<aside class="release-band release-feature" aria-label="TikMnG yenilikleri"><div class="container"><img class="release-cover" src="/game-covers/yaratik-arena-v1-500.webp" alt="Yaratık Arena" width="144" height="81" loading="lazy"><div class="release-copy"><span class="release-pill">7.0.15 · YENİ OYUN</span><strong>Yaratık Arena</strong><p>İzleyicilerin yaratıklarına karşı hayatta kal. Boss, destek ve vakumla silah geliştirme.</p></div><button type="button" data-game-open="yaratik-arena">Oyunu incele ${icon('arrow-up-right')}</button></div></aside>\n${close}`;
  html=html.slice(0,start)+band+html.slice(end+close.length);
  const tag='<script id="publicGameCatalog"',dataStart=html.indexOf(tag),dataEnd=html.indexOf('</script>',dataStart);
  assert.ok(dataStart>=0&&dataEnd>dataStart);
  html=html.slice(0,dataStart)+`<script id="publicGameCatalog" type="application/json">${JSON.stringify(catalog).replace(/</g,'\\u003c')}</script>`+html.slice(dataEnd+9);
  html=html.replace(/<h2 id="catalogTitle">[^<]*<\/h2>/,`<h2 id="catalogTitle">${esc(catalog.heading)}</h2>`)
    .replace(/(<span class="catalog-search-count" aria-hidden="true">)\d+(<\/span>)/,(_,a,b)=>a+catalog.games.length+b)
    .replace(/(<span id="catalogCount" role="status" aria-live="polite">)\d+ oyun(<\/span>)/,(_,a,b)=>a+catalog.games.length+' oyun'+b)
    .replace(/(data-filter="" aria-pressed="true">Tümü <span>)\d+(<\/span>)/,(_,a,b)=>a+catalog.games.length+b);
  if(!html.includes('data-filter="Hayatta Kalma"'))html=html.replace('</div><span id="catalogCount"',`<button type="button" data-filter="Hayatta Kalma" aria-pressed="false">Hayatta Kalma <span>1</span></button></div><span id="catalogCount"`);
  fs.writeFileSync(path.join(web,'index.html'),html);
  console.log(JSON.stringify({games:catalog.games.length,newGame:arena.id,steam:arena.steamUrl,originalGuidePreserved:true}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
