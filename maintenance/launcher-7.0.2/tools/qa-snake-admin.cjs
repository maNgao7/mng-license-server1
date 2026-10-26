'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { PNG } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const { assertGameInstructions, pendingGameRuntimeChecks } = require('./qa-newgame-notes.cjs');
const { createGameAnnouncements } = require('../lib/game-announcements.cjs');
const resources = require('../lib/game-resources.cjs');
const renderer = path.resolve(__dirname, '../renderer');
const web = path.resolve('D:/TikMnG-Release-7.0.0-source/web');
const output = process.env.MNG_QA_OUTPUT || 'D:/TikMnG-Snake-Arena-Prototype/tools/qa/admin-ui-final';
fs.mkdirSync(output, { recursive: true });
const admin = require('../lib/admin-games.json').games[0];
const base = require('../lib/catalog-defaults.json');
const gifts = require('../renderer/gift-assets/katalog_tam.json');
const visualGroups=require('../renderer/gift-assets/visual-groups.json').groups;
const groupById=new Map(visualGroups.flatMap(g=>g.ids.map(id=>[id,g.id])));
const visibleGifts=require('../renderer/gift-catalog-view.js').group(gifts.map(g=>({...g,visualGroup:groupById.get(g.id)})));
const values = new Map(), calls = [];
const installedGames = new Set();
const viewports = [{ width: 1440, height: 960 }, { width: 1310, height: 900 }, { width: 900, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const coverSource = 'D:/TikMnG-Snake-Arena-Prototype/assets/minecraft-yilan-cover-v2.png';
const coverFile = path.join(renderer, 'assets/game-covers', admin.cover + '.png');
assert.equal(admin.cover, 'minecraft-yilan-cover-v2');
assert.equal(sha(fs.readFileSync(coverFile)), sha(fs.readFileSync(coverSource)), 'Final cover must be the clean v2, byte for byte');
const coverMetadata = require('../renderer/assets/game-covers/artwork-current.json').covers.find(cover => cover.id === admin.id);
assert.equal(coverMetadata.currentFile, admin.cover + '.png');
assert.equal(coverMetadata.sha256, sha(fs.readFileSync(coverFile)));
const sourceGuide = fs.readFileSync('D:/TikMnG-Snake-Arena-Prototype/assets/snake-gift-guide.png');
assert.equal(sha(resources.readGuide(admin.id).data), sha(sourceGuide));
let channel = 'qa-one', browser, server, packageReady = false, finishInstall, dismissMode = 'ok';
const announcements = createGameAnnouncements({ store: { get: (key, fallback) => values.get(key) ?? fallback, set: (key, value) => values.set(key, value) }, getChannel: () => channel, games: [admin] });
function snapshot() {
    const games = [...base.games.filter(game=>game.id!==admin.id), admin].map(game => ({ id: game.id, ad: game.title, description: game.description,
        installed: installedGames.has(game.id), installedVersion: installedGames.has(game.id) ? game.version : null, availableVersion: game.version, boyut: '', requirements: game.requirements || 'Windows 10/11',
        resources: [], giftGuide: resources.getGuide(game.id), cover: game.cover || '',
        minecraft: ['battle-royale', 'snow-war', 'zombie-war', admin.id].includes(game.id),
        downloadReady: game.id !== admin.id || packageReady }));
    return { games, gameAnnouncements: announcements.pending(), version: '7.0.1', preview: true, media: [], mediaAssets: [], audioLibrary: [], remoteMedia: [], soundEffects: [],
        tts: {}, source: 'direct', overlayUrl: 'http://127.0.0.1/qa', mediaDownloads: { active: [], pending: [] } };
}
async function call(action, data = {}) {
    calls.push({ action, data });
    if (action === 'speech-status') return { voices: [], packs: [], voiceLibrary: [], providers: {} };
    if (action === 'announcement-dismiss') {
        if(dismissMode==='reject')return {error:'QA disk write failed'};
        if(dismissMode==='hang')return new Promise(()=>{});
        return announcements.dismiss(data.id);
    }
    if (action === 'gift-guide-save') { assert.ok(resources.readGuide(data.id).data.length); return { saved: true }; }
    if (action === 'install') {
        assert.equal(packageReady, true); assert.equal(data.id, admin.id);
        await new Promise(resolve => { finishInstall = resolve; });
        installedGames.add(data.id); return { basarili: true };
    }
    return snapshot();
}
const html = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><link rel="stylesheet" href="/gift-guide.css"><body><div class="launcher"><main class="main"></main></div><script src="/vendor/lucide.js"></script><script src="/gift-catalog-view.js"></script><script src="/workspace.js"></script></body></html>';
async function assertLayout(page, label) {
    const layout = await page.evaluate(() => {
        const root = document.getElementById('workspaceBody');
        const selectors = '.game-detail-info h2,.game-detail-info>p,.game-setup li,.game-setup li p,.game-setup strong';
        const overflow = [...document.querySelectorAll(selectors)].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => ({ text: node.textContent, width: node.clientWidth, content: node.scrollWidth }));
        const notes = [...document.querySelectorAll('.game-setup li')].map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        const overlappingNotes = notes.some((a, i) => notes.some((b, j) => j > i && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
        return { pageFits: document.documentElement.scrollWidth <= innerWidth + 1, panelFits: !root || root.scrollWidth <= root.clientWidth + 1, overflow, overlappingNotes };
    });
    assert.equal(layout.pageFits, true, label + ' page width');
    assert.equal(layout.panelFits, true, label + ' panel width');
    assert.deepEqual(layout.overflow, [], label + ' text overflow');
    assert.equal(layout.overlappingNotes, false, label + ' overlapping preparation notes');
    return layout;
}
function changedPixels(first, second, panel) {
    const a=PNG.sync.read(first), b=PNG.sync.read(second);
    assert.equal(a.width,b.width); assert.equal(a.height,b.height);
    let changed=0;
    for(let y=0;y<a.height;y++) for(let x=0;x<a.width;x++) {
        if(panel&&x>=panel.left&&x<panel.right&&y>=panel.top&&y<panel.bottom)continue;
        const i=(y*a.width+x)*4;
        if(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>24)changed++;
    }
    return changed;
}
async function assertCelebration(page, viewport) {
    const modal=page.locator('#gameAnnouncement');
    await modal.locator('.announcement-gift').first().waitFor();
    await modal.evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>animation.pause()));
    const giftsShown=await modal.locator('.announcement-gift').evaluateAll(images=>Promise.all(images.map(async img=>{await img.decode();return {id:img.getAttribute('src').split('/').pop().replace('.png',''),width:img.naturalWidth};})));
    await modal.evaluate(node=>node.getAnimations({subtree:true}).forEach(animation=>animation.play()));
    assert.equal(giftsShown.length,24);
    assert.equal(new Set(giftsShown.map(g=>g.id)).size,24);
    assert.ok(giftsShown.every(g=>g.width>0&&gifts.some(source=>source.id===g.id)));
    const layout=await modal.evaluate(dialog=>{
        const root=dialog.getBoundingClientRect(),panel=dialog.querySelector('.announcement-panel'),p=panel.getBoundingClientRect();
        const ornaments=dialog.querySelector('.announcement-celebration');
        const controls=[...panel.querySelectorAll('header, h3, p, .detail-commands, button')].map(node=>{
            const r=node.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return {text:node.textContent,inside:r.left>=p.left&&r.right<=p.right+1&&r.top>=p.top&&r.bottom<=p.bottom+1,unobstructed:!!at&&(at===node||node.contains(at)||at.contains(node))};
        });
        const positions=[...ornaments.querySelectorAll('img')].map(img=>{const r=img.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
        return {panel:{left:p.left-root.left,right:p.right-root.left,top:p.top-root.top,bottom:p.bottom-root.top},controls,
            panelFits:panel.scrollHeight<=panel.clientHeight+1&&panel.scrollWidth<=panel.clientWidth+1,
            ariaHidden:ornaments.getAttribute('aria-hidden'),pointerEvents:getComputedStyle(ornaments).pointerEvents,
            leftGifts:positions.filter(pos=>pos.x<p.left).length,rightGifts:positions.filter(pos=>pos.x>p.right).length,
            distinctPositions:new Set(positions.map(pos=>`${Math.round(pos.x)},${Math.round(pos.y)}`)).size,
            quadrants:new Set(positions.map(pos=>(pos.x<root.left+root.width/2?'left':'right')+(pos.y<root.top+root.height/2?'Top':'Bottom'))).size};
    });
    assert.equal(layout.ariaHidden,'true');assert.equal(layout.pointerEvents,'none');
    assert.equal(layout.panelFits,true,`${viewport.width} modal content needs scrolling`);
    assert.ok(layout.controls.every(c=>c.inside&&c.unobstructed),JSON.stringify(layout.controls));
    assert.ok(layout.leftGifts>0&&layout.rightGifts>0,`${viewport.width} gifts spread left and right`);
    assert.equal(layout.quadrants,4,'gifts must cover 360 degrees');
    assert.equal(layout.distinctPositions,24,'each gift must occupy its own outward ray');
    const flight=await modal.locator('.announcement-gift').first().evaluate(image=>{
        const a=image.getAnimations()[0];a.pause();a.effect.updateTiming({delay:0});
        const sample=time=>{a.currentTime=time;const s=getComputedStyle(image),m=new DOMMatrix(s.transform);return {x:m.m41,y:m.m42,scale:m.a,offsetPath:s.offsetPath};};
        const early=sample(1200),late=sample(3200);a.play();return {early,late};
    });
    assert.equal(flight.early.offsetPath,'none','no circular orbit');
    assert.ok(flight.late.scale>flight.early.scale*2,'gifts grow toward the viewer');
    assert.ok(Math.hypot(flight.late.x,flight.late.y)>Math.hypot(flight.early.x,flight.early.y)*2,'gifts travel away from the centre');
    assert.ok(Math.abs(flight.early.x*flight.late.y-flight.early.y*flight.late.x)<1,'straight ray, not rotation');
    const imagesBefore=await modal.locator('.announcement-gift').evaluateAll(nodes=>nodes.map(n=>n.src));
    await modal.locator('.announcement-gift').first().evaluate(node=>node.dispatchEvent(new AnimationEvent('animationiteration',{animationName:'announcementGiftFlight',bubbles:true})));
    assert.notEqual(await modal.locator('.announcement-gift').first().getAttribute('src'),imagesBefore[0].split('/').slice(-2).join('/'),'new artwork between flights');
    const first=await modal.screenshot({path:path.join(output,`announcement-motion-a-${viewport.width}.png`),animations:'allow'});
    await page.waitForTimeout(450);
    const second=await modal.screenshot({path:path.join(output,`announcement-motion-b-${viewport.width}.png`),animations:'allow'});
    const animationPixels=changedPixels(first,second,layout.panel);
    assert.ok(animationPixels>100,`${viewport.width} decoration pixels unchanged: ${animationPixels}`);
    await page.emulateMedia({reducedMotion:'reduce'});
    const animations=await modal.locator('.announcement-celebration *').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationName));
    assert.ok(animations.every(name=>name==='none'));
    const reducedA=await modal.screenshot({path:path.join(output,`announcement-reduced-${viewport.width}.png`),animations:'allow'});
    await page.waitForTimeout(250);
    const reducedB=await modal.screenshot({animations:'allow'});
    const reducedMotionPixels=changedPixels(reducedA,reducedB);
    assert.equal(reducedMotionPixels,0,'reduced motion must stay static');
    assert.equal(await modal.locator('.announcement-gift').count(),24,'reduced motion retains real gift artwork');
    await assertLayout(page,`announcement ${viewport.width}`);
    await page.emulateMedia({reducedMotion:'no-preference'});
    return {giftsShown,animationPixels,reducedMotionPixels,flight,...layout};
}
async function main() {
    server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
        const isWeb = url.pathname.startsWith('/web/'), root = isWeb ? web : renderer;
        const file = path.resolve(root, '.' + decodeURIComponent(isWeb ? url.pathname.slice(4) : url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__call', call);
    await page.exposeFunction('__gifts', () => gifts.map(gift => ({ ...gift,visualGroup:groupById.get(gift.id), image: '/gift-assets/' + gift.file })));
    await page.addInitScript(() => {
        window.mngAPI = { workspace: (a, d) => window.__call(a, d), workspaceListen() {}, orbitHediyeKatalogu: () => window.__gifts(), widgetBilgisi: async () => ({ channel: 'qa', widgets: [], liveStatus: { status: 'disconnected' } }) };
        window.tiktokHesapPanelAc = () => {};
    });
    const viewportResults = [];
    for (const viewport of viewports) {
        values.delete('game_announcements_v1');
        channel = 'qa-' + viewport.width;
        await page.setViewportSize(viewport); await page.goto(origin);
        await page.locator('#gameAnnouncement[open]').waitFor();
        assert.equal(await page.locator('.library-card').count(), 16);
        assert.ok(await page.locator('[data-announcement-download]').isDisabled());
        await page.locator('#gameAnnouncement .announcement-panel>img').evaluate(image => image.decode());
        const modal = await page.locator('#gameAnnouncement').evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, contentFits: node.scrollWidth <= node.clientWidth }; });
        assert.ok(modal.left >= 0 && modal.right <= viewport.width && modal.top >= 0 && modal.bottom <= viewport.height, JSON.stringify({ viewport, modal }));
        assert.equal(modal.contentFits, true);
        assert.ok((await page.locator('#gameAnnouncement .announcement-panel>img').getAttribute('src')).includes('cover-v2'));
        await page.screenshot({ path: path.join(output, `announcement-${viewport.width}.png`) });
        const celebration=await assertCelebration(page,viewport);
        if (viewport.width <= 390) await page.keyboard.press('Escape');
        else await page.locator('[data-announcement-close]').click();
        await page.waitForFunction(() => !document.querySelector('#gameAnnouncement').open);
        await page.reload(); await page.locator('.library-card').nth(15).waitFor();
        assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0);
        const covers = await page.locator('.cover-button>img').evaluateAll(images => Promise.all(images.map(async image => { image.loading = 'eager'; await image.decode(); const box = image.getBoundingClientRect(); return { src: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight, displayWidth: box.width, displayHeight: box.height }; })));
        assert.equal(covers.length, 16); assert.equal(new Set(covers.map(cover => cover.src)).size, 16);
        assert.ok(covers.every(cover => cover.width > 0 && cover.height > 0 && cover.displayWidth > 0 && cover.displayHeight > 0));
        await assertLayout(page, `library ${viewport.width}`);
        await page.screenshot({ path: path.join(output, `library-${viewport.width}.png`) });
        await page.locator('[data-category="minecraft"]').click();
        assert.equal(await page.locator('.library-card').count(), 4);
        await page.locator(`[data-open="${admin.id}"]`).hover();
        const particleRoot = page.locator(`[data-game-id="${admin.id}"] .cover-gifts`);
        assert.equal(await particleRoot.locator('img').count(), 12);
        const hoverIds = await particleRoot.locator('img').evaluateAll(images => Promise.all(images.map(async image => { await image.decode(); return new URL(image.src).pathname.split('/').pop().replace('.png', ''); })));
        assert.ok(hoverIds.every(id => gifts.some(gift => gift.id === id)));
        const particle = particleRoot.locator('img').first();
        assert.equal(await particle.evaluate(node => getComputedStyle(node).animationDuration), '4.5s');
        const before = await particle.evaluate(node => getComputedStyle(node).offsetDistance);
        await page.waitForTimeout(200);
        assert.notEqual(await particle.evaluate(node => getComputedStyle(node).offsetDistance), before);
        await page.screenshot({ path: path.join(output, `minecraft-hover-${viewport.width}.png`) });
        await page.locator('[data-category="all"]').click();
        const details = [];
        for (const game of [...base.games.filter(game=>game.id!==admin.id), admin]) {
            await page.locator(`[data-open="${game.id}"]`).click();
            await page.locator('.game-detail-cover>img').evaluate(image => image.decode());
            assert.equal(await page.locator('.game-detail-info>p').textContent(), game.description);
            assert.equal(await page.locator('.game-setup li').count(), 6);
            assert.equal(await page.locator('[data-gift-guide]').count(), resources.getGuide(game.id) ? 1 : 0);
            const notes = await page.locator('.game-setup li p').allTextContents();
            const instructions=assertGameInstructions(game,notes);
            assert.equal(await page.locator('.game-detail').evaluate(node=>node.nextElementSibling.classList.contains('game-setup')),true,'notes immediately follow play/Steam/repair/guide commands');
            await assertLayout(page, `${game.id} ${viewport.width}`);
            await page.locator('.game-setup').screenshot({path:path.join(output,`controls-${game.id}-${viewport.width}.png`)});
            if (game.id === admin.id) {
                assert.ok(await page.locator('[data-install]').isDisabled());
                await page.screenshot({ path: path.join(output, `snake-detail-${viewport.width}.png`) });
                await page.locator('.game-setup').scrollIntoViewIfNeeded();
                await page.screenshot({ path: path.join(output, `snake-notes-${viewport.width}.png`) });
                await page.locator('[data-gift-guide]').click();
                assert.equal(calls.at(-1).action, 'gift-guide-save');
            }
            details.push({ id: game.id, decoded: true, notes: notes.length, instructions, layoutFits: true });
            await page.locator('[data-back]').click();
        }
        viewportResults.push({ ...viewport, coverDecodes: covers, details, celebration, modalFits: true, dismissalPersisted: true, hoverMoving: true, hoverIds });
        console.log(`Rendered ${viewport.width}x${viewport.height}: 16 covers/details, notes, persisted dismissal and moving source-only hover passed`);
    }
    channel = 'qa-download'; packageReady = true;
    values.delete('game_announcements_v1');
    await page.setViewportSize({ width: 1310, height: 900 });
    await page.reload(); await page.locator('#gameAnnouncement[open]').waitFor();
    await page.screenshot({ path: path.join(output, 'announcement-download-1310.png') });
    await page.locator('[data-announcement-download]').click();
    await page.waitForFunction(() => document.querySelector('[data-install]')?.disabled && document.querySelector('#detailProgress [role="status"]'));
    assert.equal(calls.filter(item => item.action === 'install').length, 1);
    await page.screenshot({ path: path.join(output, 'download-progress-1310.png') });
    assert.equal(typeof finishInstall, 'function'); finishInstall();
    await page.waitForFunction(() => document.querySelector('#workspaceNotice')?.textContent.includes('kurulumu tamamlandı'));
    await page.locator('[data-play="minecraft-snake-arena"]').waitFor();
    await page.screenshot({ path: path.join(output, 'download-complete-1310.png') });
    assert.equal(calls.filter(item => item.action === 'install').length, 1);
    await page.reload(); await page.locator('.library-card').first().waitFor();
    assert.equal(await page.locator('#gameAnnouncement[open]').count(), 0);
    for(const mode of ['reject','hang']){
        values.delete('game_announcements_v1');
        dismissMode=mode;channel='qa-close-'+mode;
        await page.reload();await page.locator('#gameAnnouncement[open]').waitFor();
        await page.locator('[data-announcement-open]').click();
        await page.locator('[data-back]').waitFor();
        assert.equal(await page.locator('#gameAnnouncement[open]').count(),0,'inspect closes before settings persistence: '+mode);
        await page.locator('[data-back]').click();
        assert.equal(await page.locator('.library-card').count(),16);
        assert.equal(await page.locator('#gameAnnouncement[open]').count(),0,'failed write must not re-trap the session');
    }
    dismissMode='ok';
    const builderResults = [];
    for (const viewport of [viewports[1], viewports[3], viewports[4]]) for (const prefix of ['', '/web']) {
        await page.setViewportSize(viewport);
        await page.goto(origin + prefix + '/gift-designer.html');
        await page.waitForSelector('html[data-ready="true"]');
        await page.locator('[data-add]').first().click();
        await page.waitForFunction(count => document.querySelectorAll('[data-gift]').length === count,visibleGifts.length);
        const renderedGifts = await page.locator('[data-gift]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.gift, name: node.querySelector('strong').textContent, coins: node.querySelector('small').textContent })));
        const sourceById = new Map(gifts.map(gift => [gift.id, gift]));
        assert.deepEqual(renderedGifts.map(gift => gift.id).sort(), visibleGifts.map(gift => gift.id).sort());
        for (const gift of renderedGifts) {
            assert.equal(gift.name, sourceById.get(gift.id).name);
            assert.ok(gift.coins.startsWith(sourceById.get(gift.id).coins.toLocaleString('tr-TR') + ' coin'));
        }
        assert.equal(await page.locator('#catalogCount').textContent(), `${visibleGifts.length} / ${visibleGifts.length} hediye`);
        for (const gift of [gifts[0], gifts[100], gifts.at(-1)]) {
            await page.locator('#giftSearch').fill(gift.id);
            const choice = page.locator(`[data-gift="${gift.id}"]`);
            await choice.locator('img').evaluate(image => { image.loading = 'eager'; return image.decode(); });
            assert.ok((await choice.locator('small').textContent()).startsWith(gift.coins.toLocaleString('tr-TR') + ' coin'));
        }
        await page.locator('#giftSearch').fill('');
        const catalogBounds = await page.locator('#catalogModal').evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, contentFits: node.scrollWidth <= node.clientWidth + 1 }; });
        assert.ok(catalogBounds.left >= 0 && catalogBounds.right <= viewport.width + 1 && catalogBounds.top >= 0 && catalogBounds.bottom <= viewport.height + 1, JSON.stringify({ viewport, catalogBounds }));
        assert.equal(catalogBounds.contentFits, true);
        await page.screenshot({ path: path.join(output, `builder-${prefix ? 'web' : 'launcher'}-${viewport.width}.png`) });
        await page.locator('#giftSearch').fill('17962');await page.locator('[data-gift="17962"]').click();
        assert.equal(await page.locator('#giftGrid img').count(),1,'variant choices repeat no artwork');
        assert.equal(await page.locator('[data-exact-gift]').count(),2);
        assert.ok((await page.locator('[data-exact-gift][data-gift="17957"]').textContent()).includes('4.918 coin'));
        await page.locator('[data-exact-gift][data-gift="17957"]').click();
        await page.locator('[data-pick]').first().waitFor();
        assert.ok((await page.locator('.zone-item small').first().textContent()).includes('4.918'));
        builderResults.push({ type: prefix ? 'web' : 'launcher', width: viewport.width, gifts: gifts.length, uniqueVisualCards:visibleGifts.length, variantsRetainExactPrices:true, allRenderedIdsNamesCoinsMatch: true, sampledImageIds: [gifts[0].id, gifts[100].id, gifts.at(-1).id], modalFits: true });
    }
    assert.deepEqual(errors, []);
    const result = { passed: true, games: 16, minecraftGames: 4, instructionsVerified: 16 * viewports.length, giftsPerBuilder: gifts.length, cover: admin.cover,
        coverEvidence: { source: coverSource, target: coverFile, sha256: sha(fs.readFileSync(coverFile)), sameBytes: true, typography: 'none in supplied v2', titleInUI: true },
        giftGuide: { sha256: sha(sourceGuide), descriptorVerified: true, commandGameId: admin.id }, viewportResults, builderResults,
        announcement: ['close-persisted-per-installation', 'escape-persisted', 'mobile-fit', 'download-uses-existing-installer','write-failure-not-blocking','hung-write-not-blocking','straight-growing-rays','changing-distinct-artwork'], hoverImages: 12, hoverSeconds: 4.5,
        download: { syntheticOnly: true, id: admin.id, singleRequest: true, progressDisabled: true, installedStateRendered: true, dismissedAfterReload: true },
        uiRevision:'individual-controls-and-celebration',pendingGameRuntimeChecks,
        syntheticProfileOnly: true, built: false, installed: false, mainPlatformEditedByThisRun: false, errors };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ passed: true, widths: viewports.map(viewport => viewport.width), detailChecks: result.instructionsVerified, builders: builderResults.length, errors }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); });
