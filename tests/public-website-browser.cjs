const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const origin = process.env.MNG_WEBSITE_ORIGIN;
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/game-catalog.json'), 'utf8'));
let browser;

before(async () => {
    assert.ok(origin, 'Set MNG_WEBSITE_ORIGIN to the locally running website.');
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
});
after(() => browser?.close());

for (const [width, height, hero] of [
    [390, 844, '/portal-hero-mobile-v3.webp'],
    [1440, 900, '/portal-hero-1672-v3.webp']
]) {
    test('prioritized responsive hero and catalogue at ' + width + 'px', async t => {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        t.after(() => context.close());
        const page = await context.newPage();
        const errors = [];
        const requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => requests.push(request.url()));

        assert.equal((await page.goto(origin)).status(), 200);
        assert.equal(await page.locator('h1').textContent().then(text => text.trim()), 'TikMnG');
        assert.equal(await page.locator('.hero-art img').evaluate(async image => {
            await image.decode();
            return new URL(image.currentSrc).pathname;
        }), hero);
        assert.equal(await page.locator('.hero-art img').getAttribute('fetchpriority'), 'high');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(requests.filter(url => url.includes('/portal-hero-')).map(url => new URL(url).pathname), [hero]);
        assert.ok(requests.every(url => !/fonts\.googleapis|fonts\.gstatic|\/vendor\/lucide\.js/.test(url)));

        const card = page.locator('.catalog-open[data-game-open="hapisten-kac"]');
        await card.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.equal(await dialog.locator('h2').textContent(), 'Hapisten Kaç');
        assert.equal(await dialog.getByRole('link', { name: 'Oyun sayfasını aç' }).getAttribute('href'), '/oyunlar/hapisten-kac');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#portalDetail').open);
        assert.equal(await card.evaluate(link => link === document.activeElement), true);
        assert.deepEqual(errors, []);
    });
}

test('canonical game pages follow real links and render without scripts', async t => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    t.after(() => context.close());
    const page = await context.newPage();
    await page.goto(origin);
    const links = await page.locator('.catalog-card a.catalog-open').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')));
    assert.deepEqual(links, catalog.games.map(game => '/oyunlar/' + game.id));
    const sitemap = await page.request.get(origin + '/sitemap.xml');
    assert.equal(sitemap.ok(), true);
    const xml = await sitemap.text();
    const paths = await page.evaluate(value => {
        const doc = new DOMParser().parseFromString(value, 'application/xml');
        if (doc.querySelector('parsererror')) throw Error(doc.querySelector('parsererror').textContent);
        return Array.from(doc.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9', 'loc'), loc => loc.textContent);
    }, xml);

    for (const [index, game] of catalog.games.entries()) {
        await page.locator('.catalog-open').nth(index).click();
        assert.equal(new URL(page.url()).pathname, links[index]);
        assert.equal(await page.locator('h1').textContent(), game.title);
        assert.equal(await page.locator('.summary').textContent(), game.description);
        assert.equal(await page.locator('main ul li').count(), game.features.length);
        assert.equal(await page.locator('head link[rel=canonical]').getAttribute('href'), 'https://tikmng.com' + links[index]);
        assert.ok(paths.includes('https://tikmng.com' + links[index]));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.ok(await page.locator('.game-cover').evaluate(async image => {
            await image.decode();
            return image.naturalWidth > 0;
        }));
        if (game.id === 'hapisten-kac') {
            assert.equal(await page.locator('a[href="https://store.steampowered.com/app/5466880/"]').count(), 1);
            assert.equal(await page.locator('a[download][href="/gift-guides/TikMnG-Hapisten-Kac-Hediyeler.png"]').count(), 1);
        }
        await page.getByRole('link', { name: 'Tüm oyunlar' }).click();
        assert.equal(new URL(page.url()).hash, '#games');
    }
});
