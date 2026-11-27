'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const net = require('node:net');
const { _electron } = require(process.env.FETIH_QA_PLAYWRIGHT || 'playwright');
const defaults = require('../lib/catalog-defaults.json');
const version = require('../package.json').version;
const [priorExe, currentExe, qa, cert, key] = process.argv.slice(2);
const sourceGame = id => structuredClone(defaults.games.find(game => game.id === id));
const fetih = sourceGame('fetih');
const legacy = fetih.resources.find(resource => resource.url.endsWith('/TikMnG-Fetih-Hediyeler.png'));
assert.ok(legacy, '7.0.35 catalog reference');
const canonical = { title: 'İzleyici dilekleri', url: 'https://tikmng.com/rehber/fetih-izleyici-dilekleri.html' };
const extra = { title: 'Örnek yayın düzeni', url: 'https://example.org/setup.pdf' };
const other = sourceGame('orbit');
other.resources = [legacy, extra];
const catalog = { ...defaults, revision: defaults.revision + 100, media: [], games: [fetih, other] };
fetih.resources = [legacy, extra];

async function run() {
    fs.mkdirSync(qa, { recursive: true });
    const profile = fs.mkdtempSync(path.join(qa, 'upgrade-profile-'));
    let offline = false;
    const server = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (request, response) => {
        request.resume();
        const pathname = new URL(request.url, 'https://localhost').pathname;
        response.setHeader('Content-Type', 'application/json');
        if (pathname === '/api/content/catalog' && !offline) return response.end(JSON.stringify(catalog));
        if (['/api/license/verify','/api/license/check'].includes(pathname)) {
            return response.end(JSON.stringify({ valid: true, isUnlimited: false, expiresAt: Date.now() + 3600000,
                remainingSeconds: 3600, activationToken: 'isolated-ui-fixture' }));
        }
        response.writeHead(404).end('{}');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const portProbe = net.createServer();
    await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
    const widgetPort = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(widgetPort),
        MNG_LICENSE_SERVER: 'https://127.0.0.1:' + server.address().port, NODE_EXTRA_CA_CERTS: cert };
    delete env.ELECTRON_RUN_AS_NODE;
    let app, page;
    async function launch(executablePath, expected) {
        app = await _electron.launch({ executablePath, env, timeout: 60000 });
        const identity = await app.evaluate(({app}) => ({
            version: app.getVersion(), packaged: app.isPackaged, preview: app.isTikMNGPreview, profile: app.getPath('userData')
        }));
        assert.deepEqual(identity, {version: expected, packaged: true, preview: false, profile});
        page = await app.firstWindow();
        const closeAnnouncement = page.locator('#gameAnnouncement[open] [data-announcement-close]');
        await page.addLocatorHandler(closeAnnouncement, () => closeAnnouncement.click(), { noWaitAfter: true });
        await page.waitForFunction(() => Boolean(window.mngAPI));
    }
    async function refresh() { return page.evaluate(() => window.mngAPI.workspace('refresh')); }
    async function openDetail(id) {
        if (await page.locator('[data-back]').isVisible()) await page.locator('[data-back]').click();
        await page.locator('[data-open="' + id + '"]').first().click();
        await page.locator('.game-detail').waitFor();
    }
    async function checkResources(expected) {
        const section = page.locator('section.detail-band').filter({has: page.getByRole('heading', {name:'Yayın Dosyaları', exact:true})});
        assert.deepEqual(await section.locator('[data-url]').evaluateAll(nodes => nodes.map(node => ({
            title: node.innerText.trim(), url: node.dataset.url
        }))), expected);
    }
    async function checkFetihPage() {
        const body = page.locator('#workspaceBody');
        assert.doesNotMatch(await body.innerText(), /hazır hediye görseli/i);
        assert.equal(await body.locator('[data-gift-guide], [data-url*="TikMnG-Fetih-Hediyeler"], a[href*="TikMnG-Fetih-Hediyeler"]').count(), 0);
        assert.equal(await body.getByRole('button', {name:'İzleyici dilekleri', exact:true}).count(), 1);
        await checkResources([extra]);
    }
    try {
        await launch(priorExe, '7.0.35');
        await page.locator('#licenseInput').waitFor();
        assert.equal((await page.evaluate(() => window.mngAPI.lisansDogrula('FETIH-LOCAL-QA'))).gecerli, true);
        assert.equal((await refresh()).catalogStatus.source, 'remote');
        await page.reload();
        await openDetail('fetih');
        await checkResources([legacy, extra]);
        assert.ok(await page.locator('[data-gift-guide="fetih"]').count() > 0);
        await app.close();
        app = null;
        offline = true;
        await launch(currentExe, version);
        const cached = await refresh();
        assert.equal(cached.catalogStatus.source, 'cache');
        assert.deepEqual(cached.games.find(game => game.id === 'fetih').resources, [legacy, extra]);
        await openDetail('fetih');
        await checkFetihPage();
        const steps = page.locator('.game-setup li');
        assert.deepEqual(await steps.locator('.setup-step-number').allTextContents(), ['1','2','3','4','5','6']);
        assert.match(await steps.nth(1).innerText(), /İhlal riskini azaltma rehberinde.*video ayarları ve sessiz örnek klip/s);
        assert.equal(await page.locator('.game-guide-video').getAttribute('data-url'), 'https://youtu.be/v1PtHDv3VhM');
        await page.locator('.game-setup').screenshot({path:path.join(qa, 'fetih-setup.png')});
        await page.getByRole('button', {name:'İzleyici dilekleri', exact:true}).click();
        const dialog = page.getByRole('dialog', {name:'Böyle yapmanızı öneririm'});
        const photo = dialog.getByRole('img', {name:'İzleyici Dilekleri panelinde örnek hediye ve eylem eşleşmeleri'});
        assert.deepEqual(await photo.evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; }), [423,990]);
        await dialog.screenshot({path:path.join(qa, 'fetih-wishes.png')});
        await dialog.getByRole('button', {name:'Kapat'}).click();
        assert.equal(await dialog.isVisible(), false);
        offline = false;
        catalog.revision++;
        fetih.resources = [canonical, extra];
        const updated = await refresh();
        assert.equal(updated.catalogStatus.source, 'remote');
        assert.deepEqual(updated.games.find(game => game.id === 'fetih').resources, [canonical, extra]);
        await page.reload();
        await openDetail('fetih');
        await checkFetihPage();
        await openDetail('orbit');
        await checkResources([legacy, extra]);
        assert.equal(await page.locator('[data-gift-guide="orbit"]').count(), 1);
        const result = { baseline:'7.0.35', version, packaged:true, preview:false, sameIsolatedProfile:true,
            catalogCases:['legacy remote on 7.0.35','legacy cache on upgrade','refreshed guide on 7.0.36'],
            canonicalGuideURL:canonical.url, unrelatedFetihResource:true, otherGameResources:true, guideSteps:6, dialogImage:[423,990], dialogClose:true };
        fs.writeFileSync(path.join(qa, 'fetih-launcher-release-result.json'), JSON.stringify(result,null,2)+'\n');
        console.log(JSON.stringify(result));
    } finally {
        if (app) await app.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
