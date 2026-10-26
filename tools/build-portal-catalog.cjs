'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const web = path.resolve(__dirname, '../web');
const launcher = path.resolve(process.argv[2] || '../launcher');
const catalog = JSON.parse(fs.readFileSync(path.join(web, 'game-catalog.json'), 'utf8'));
const current = JSON.parse(fs.readFileSync(path.join(launcher, 'renderer/assets/game-covers/artwork-current.json'), 'utf8'));
const sharp = require(process.env.SHARP_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;

async function main() {
  if (catalog.games.length !== 16 || new Set(catalog.games.map(game => game.id)).size !== 16) throw new Error('Expected 16 unique games.');
  const coverRoot = path.join(web, 'game-covers');
  fs.mkdirSync(coverRoot, {recursive:true});
  const manifest = [];
  for (const game of catalog.games) {
    if (current.covers.find(cover => cover.id === game.id)?.currentFile !== `${game.cover}.png`) throw new Error(`Outdated cover: ${game.id}`);
    const source = fs.readFileSync(path.join(launcher, 'renderer/assets/game-covers', `${game.cover}.png`));
    for (const width of [500, 1000]) {
      const target = path.join(coverRoot, `${game.cover}-${width}.webp`);
      await sharp(source).resize({width, withoutEnlargement:true}).webp({quality:84}).toFile(target);
      manifest.push({id:game.id, file:path.basename(target), bytes:fs.statSync(target).size, sourceSha256:crypto.createHash('sha256').update(source).digest('hex')});
    }
  }
  fs.writeFileSync(path.join(coverRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await sharp(path.join(launcher, 'renderer/assets/gift-guides/caahr.png')).resize({width:800, height:450, fit:'contain', background:'#0b1111'}).webp({quality:90}).toFile(path.join(web, 'designer-sample.webp'));
  const categories = [...new Set(catalog.games.map(game => game.category))];
  const cards = catalog.games.map(game => `
    <article class="catalog-card" data-game="${game.id}" data-category="${esc(game.category)}">
      <button class="catalog-open" data-game-open="${game.id}" aria-label="${esc(game.title)} oyununu incele">
        <div class="catalog-art"><img src="/game-covers/${game.cover}-500.webp" srcset="/game-covers/${game.cover}-500.webp 500w, /game-covers/${game.cover}-1000.webp 1000w" sizes="(max-width:600px) 100vw, (max-width:1000px) 50vw, 33vw" width="1000" height="667" loading="lazy" alt="${esc(game.title)} oyununa özel kapak">${game.isNew ? '<span class="catalog-new">Yeni</span>' : ''}<span class="catalog-art-arrow">${icon('arrow-up-right')}</span></div>
        <div class="catalog-copy"><span class="catalog-category">${esc(game.category)}</span><h3>${esc(game.title)}</h3><p>${esc(game.tagline)}</p><span class="catalog-command">Oyunu incele ${icon('arrow-right')}</span></div>
      </button>
    </article>`).join('');
  const section = `<section id="games" aria-labelledby="catalogTitle">
    <div class="container catalog-container">
      <div class="catalog-heading"><div><span class="catalog-eyebrow">TIKMNG OYUN KÜTÜPHANESİ</span><h2 id="catalogTitle">${esc(catalog.heading)}</h2><p>Yarış, rekabet, hayatta kalma. Sıradaki yayının oyununu seç.</p></div><label class="catalog-search">${icon('search')}<input type="search" id="gameSearch" placeholder="Oyun ara" aria-label="Oyun ara" autocomplete="off"><span class="catalog-search-count" aria-hidden="true">${catalog.games.length}</span></label></div>
      <div class="catalog-toolbar"><div class="catalog-filters" role="group" aria-label="Oyun kategorileri"><button type="button" data-filter="" aria-pressed="true">Tümü <span>${catalog.games.length}</span></button>${categories.map(category => `<button type="button" data-filter="${esc(category)}" aria-pressed="false">${esc(category)} <span>${catalog.games.filter(game => game.category === category).length}</span></button>`).join('')}</div><span id="catalogCount" role="status" aria-live="polite">${catalog.games.length} oyun</span></div>
      <div class="catalog-grid">${cards}</div>
      <div id="catalogEmpty" class="catalog-empty" hidden><h3>Oyun bulunamadı.</h3><button type="button" id="clearGameFilters">Filtreleri temizle</button></div>
      <p class="catalog-requirements">Windows 10 / 11 · Oyunlar ayrı indirilir. Bazı oyunlar Steam üzerinden temel oyun kurulumu gerektirir.</p>
    </div>
  </section>`;
  const announcement = `<aside class="release-band release-feature" aria-label="TikMnG yenilikleri"><div class="container"><img class="release-cover" src="/game-covers/minecraft-yilan-cover-v2-500.webp" alt="Minecraft Yılan Oyunu" width="144" height="96" loading="lazy"><div class="release-copy"><span class="release-pill">7.0.2 · YENİ OYUN</span><strong>Minecraft Yılan Oyunu</strong><p>${catalog.games.length} oyun, yenilenen widgetlar ve yayına özel hediye tasarımları.</p></div><button type="button" data-game-open="minecraft-snake-arena">Oyunu incele ${icon('arrow-up-right')}</button></div></aside>`;
  const giftBand = `<section class="designer-band" id="giftDesign" aria-labelledby="giftBandTitle"><div class="container"><div><span class="catalog-eyebrow">SENİN YAYININ, SENİN TASARIMIN</span><h2 id="giftBandTitle">Hediyelerin sahnede yerini alsın.</h2><p>Launcher'daki hediye tasarım aracı şimdi webde de aynı deneyimle. Düzenini seç, hediyelerini yerleştir, tasarımını kaydet ve şeffaf PNG olarak indir.</p><a href="/hediye-tasarimi" class="portal-command primary">${icon('gift')} Hediye tasarla ${icon('arrow-up-right')}</a></div><div class="designer-sample" aria-label="Örnek hediye tasarımı"><img src="/designer-sample.webp" width="800" height="450" loading="lazy" alt="Sesli Sürüş için hediye ve eylem başlıklarının yerleştirildiği örnek tasarım"></div></div></section>`;
  let html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  // Replace only the public game section; authentication and live demo code stay intact.
  const start = html.indexOf('<section id="games"');
  const how = html.indexOf('<section id="how"', start);
  const end = html.indexOf('</section>', start) + '</section>'.length;
  if (start < 0 || how < 0 || end <= start) throw new Error('Public catalogue boundaries missing.');
  html = html.slice(0, start) + html.slice(end);
  const generatedStart = html.indexOf('<!-- TIKMNG-CATALOG-ANNOUNCEMENT -->');
  if (generatedStart >= 0) {
    const generatedEnd = html.indexOf('<!-- /TIKMNG-CATALOG-ANNOUNCEMENT -->', generatedStart) + '<!-- /TIKMNG-CATALOG-ANNOUNCEMENT -->'.length;
    html = html.slice(0, generatedStart) + html.slice(generatedEnd);
  }
  const demo = html.indexOf('<section class="portal-demo"');
  html = html.slice(0, demo) + `<!-- TIKMNG-CATALOG-ANNOUNCEMENT -->\n${announcement}\n<!-- /TIKMNG-CATALOG-ANNOUNCEMENT -->\n\n${section}\n\n    ` + html.slice(demo);
  const oldGiftStart = html.indexOf('<!-- TIKMNG-DESIGNER-BAND -->');
  if (oldGiftStart >= 0) {
    const oldGiftEnd = html.indexOf('<!-- /TIKMNG-DESIGNER-BAND -->', oldGiftStart) + '<!-- /TIKMNG-DESIGNER-BAND -->'.length;
    html = html.slice(0, oldGiftStart) + html.slice(oldGiftEnd);
  }
  const howPosition = html.indexOf('<section id="how"');
  html = html.slice(0, howPosition) + `<!-- TIKMNG-DESIGNER-BAND -->\n${giftBand}\n<!-- /TIKMNG-DESIGNER-BAND -->\n\n    ` + html.slice(howPosition);
  const dataStart = html.indexOf('<script id="publicGameCatalog"');
  if (dataStart >= 0) {
    const dataEnd = html.indexOf('</script>', dataStart) + 9;
    html = html.slice(0, dataStart) + html.slice(dataEnd);
  }
  html = html.replace('</head>', `<script id="publicGameCatalog" type="application/json">${JSON.stringify(catalog).replace(/</g, '\\u003c')}</script>\n</head>`);
  html = html.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(web, 'index.html'), html.replace(/\n/g, '\r\n'));
  console.log(JSON.stringify({games:catalog.games.length, coverFiles:manifest.length, bytes:manifest.reduce((sum, file) => sum + file.bytes, 0)}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
