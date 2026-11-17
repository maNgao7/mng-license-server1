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

for (const width of [1440, 360]) {
    test(`trial gift opens, copies and closes at ${width}px`, async t => {
        const site = 'http://localhost';
        const code = 'MNG-DENEME-1234ABCD';
        const page = await browser.newPage({ viewport: { width, height: 850 } });
        t.after(() => page.close());
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: site });
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin !== site) return route.abort();
            if (url.pathname === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: homepage });
            if (url.pathname === '/api/promo-license') return route.fulfill({ json: { code, days: 7 } });
            return route.fulfill({ path: path.join(web, url.pathname) }).catch(() => route.fulfill({ status: 404 }));
        });
        await page.goto(site);
        const gift = page.getByRole('button', { name: 'Sürpriz Kutu' });
        await gift.waitFor();
        if (width > 720) {
            const download = await page.getByRole('link', { name: 'Hemen İndir' }).boundingBox();
            const button = await gift.boundingBox();
            assert.ok(download.x + download.width <= button.x);
            assert.ok(button.x + button.width <= width);
        }
        await gift.click();
        const dialog = page.getByRole('dialog', { name: '7 gün ücretsiz deneme' });
        await dialog.waitFor();
        assert.equal(await dialog.getByLabel('Deneme lisans kodun').inputValue(), code);
        const bounds = await dialog.boundingBox();
        assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2);
        assert.ok(Math.abs(bounds.y + bounds.height / 2 - 425) < 12);
        await dialog.getByRole('button', { name: 'Kopyala' }).click();
        await dialog.getByText('Lisans kodu kopyalandı.').waitFor();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
        if (width > 720 && process.env.TRIAL_SCREENSHOT) {
            await page.screenshot({ path: process.env.TRIAL_SCREENSHOT, animations: 'disabled' });
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await gift.evaluate(element => document.activeElement === element), true);
    });
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
                assert.match(await whatsapp.textContent(), /WhatsApp destek/);
                assert.equal(await whatsapp.evaluate(link => getComputedStyle(link).backgroundColor), 'rgb(37, 211, 102)');
                const purchaseLinks = await page.locator('.plan-periods a, [data-license-order]').evaluateAll(links => links.map(link => link.href));
                assert.equal(purchaseLinks.length, 9);
                assert.deepEqual(purchaseLinks.map(href => new URL(href).pathname), [
                    '/tikmng/52768054', '/tikmng/52768056', '/tikmng/52768054', '/tikmng/52768058',
                    '/tikmng/52768059', '/tikmng/52768060', '/tikmng/52768061', '/tikmng/52768062', '/tikmng/52768058',
                ]);
                assert.ok(purchaseLinks.every(href => new URL(href).origin === 'https://www.shopier.com'));
                const orderActions = page.locator('#shopier-order-support .shopier-order-actions a');
                assert.equal(await orderActions.count(), 2);
                for (const [index, plan] of ['Haftalık', 'Aylık'].entries()) {
                    const action = orderActions.nth(index);
                    await action.scrollIntoViewIfNeeded();
                    const href = await action.getAttribute('href');
                    assertWhatsApp(href);
                    const message = new URL(href).searchParams.get('text');
                    assert.ok(message.includes(`TikMnG Bireysel ${plan} lisansı`));
                    assert.match(message, /\nShopier sipariş numaram: .*\nTikTok kullanıcı adım: @/);
                    const box = await action.boundingBox();
                    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 44);
                }
            }
        });
    }
}
