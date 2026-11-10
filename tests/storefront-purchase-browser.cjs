const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const origin = 'http://storefront.test';
const web = path.resolve(__dirname, '../web');
const homepage = readFileSync(path.join(web, 'index.html'), 'utf8');
const closedSignal = '<meta name="tikmng-checkout" content="closed">';
let browser;

before(async () => {
    assert.ok(homepage.includes(closedSignal));
    browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
});
after(() => browser?.close());

function assertWhatsApp(href) {
    const url = new URL(href);
    assert.equal(url.origin + url.pathname, 'https://wa.me/tikmng');
    assert.match(url.searchParams.get('text'), /TikMnG/);
}

for (const width of [1280, 360]) {
    for (const ready of [true, false]) {
        test(`homepage purchase with Shopier ${ready ? 'ready' : 'closed'} at ${width}px`, async t => {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            t.after(() => page.close());
            const html = ready ? homepage.replace(closedSignal, '<meta name="tikmng-checkout" content="shopier">') : homepage;
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) return route.abort();
                if (url.pathname === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
                const asset = url.pathname === '/satin-al' ? 'shopier-checkout.html' : url.pathname;
                return route.fulfill({ path: path.join(web, asset) }).catch(() => route.fulfill({ status: 404 }));
            });
            await page.goto(origin);

            const hero = page.locator('.hero-cta-group');
            const purchase = hero.locator('.hero-license-cta');
            const whatsapp = hero.locator('.btn-whatsapp');
            const plans = page.locator('.plan-periods a');
            await plans.last().waitFor();
            assert.equal(await plans.count(), 7);
            assert.ok(await whatsapp.isVisible());
            assertWhatsApp(await whatsapp.getAttribute('href'));

            if (ready) {
                assert.equal(await purchase.textContent(), 'Shopier’de kartla satın al');
                assert.equal(await purchase.getAttribute('href'), '/satin-al');
                assert.equal(await whatsapp.locator('span').textContent(), 'WhatsApp @TikMnG');
                assert.equal(await whatsapp.evaluate(link => getComputedStyle(link).backgroundColor), 'rgb(16, 23, 25)');
                const purchaseBox = await purchase.boundingBox();
                const whatsappBox = await whatsapp.boundingBox();
                assert.ok(purchaseBox.x >= 0 && purchaseBox.x + purchaseBox.width <= width);
                assert.ok(purchaseBox.y <= whatsappBox.y);
                assert.match(await plans.first().getAttribute('href'), /^\/satin-al\?plan=individual-weekly$/);
                assert.equal(await page.locator('[data-license-order][href^="/satin-al?plan="]').count(), 2);

                await purchase.click();
                assert.equal(page.url(), `${origin}/satin-al`);
                const options = page.locator('#plan option');
                await options.last().waitFor({ state: 'attached', timeout: 5_000 });
                assert.equal(await options.count(), 7);
            } else {
                assert.equal(await purchase.getAttribute('href'), '#fiyatlandirma');
                assert.match(await whatsapp.textContent(), /WHATSAPP SİPARİŞ/);
                assert.equal(await whatsapp.evaluate(link => getComputedStyle(link).backgroundColor), 'rgb(37, 211, 102)');
                assert.equal(await page.locator('a[href^="/satin-al"]').count(), 0);
                for (const href of await page.locator('.plan-periods a, [data-license-order]').evaluateAll(links => links.map(link => link.href))) {
                    assertWhatsApp(href);
                }
            }
        });
    }
}
