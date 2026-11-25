import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createLauncherServer } from '../src/server.mjs';

const { chromium } = createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const image = id => `./api/gift-image?id=${id}`;
const catalog = [
  { id: '5655', name: 'Gül', coins: 1, image: image('5655') },
  { id: '5269', name: 'TikTok', coins: 1, image: image('5269') },
  { id: '1001', name: 'Gökkuşağı', coins: 100, image: image('1001') },
  { id: '1002', name: 'Alkış', coins: 9, image: image('1002') },
  ...Array.from({ length: 65 }, (_, i) => ({ id: String(2000 + i), name: `Katalog hediyesi ${i}`, coins: i + 1, image: image(2000 + i) })),
];

async function setup(t, options = {}) {
  let receive, saved;
  const png = fs.readFileSync(new URL('../web/gifts/5655.png', import.meta.url));
  const host = await createLauncherServer({
    channel: 'host', subscribeSharedEvents: fn => { receive = fn; return () => {}; },
    getGiftCatalog: () => catalog, getGiftImage: () => png,
    getCachedProfile: username => ({ username, nickname: username }),
    giftConfig: { roseGiftIds: ['5655'], tiktokGiftIds: ['5269'], roseGiftLabel: 'Gül', tiktokGiftLabel: 'TikTok', roseGiftImage: image('5655'), tiktokGiftImage: image('5269') },
    allowSyntheticTest: true, onGiftConfig: config => { saved = config; }, ...options,
  });
  t.after(() => host.close());
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No browser module errors'));
  const key = new URL(host.controlUrl).searchParams.get('key');
  return { host, page, key, emit: event => receive('gift', event, { source: 'live', channel: 'host' }), saved: () => saved };
}

async function choose(page, side, name, id) {
  await page.locator(`[data-gift-slot="${side}"]`).click();
  await page.locator('#gift-picker-search').fill(name);
  await page.locator(`[data-gift-id="${id}"]`).click();
}

test('catalog images, Turkish search, pagination and exact saved settings work through the real endpoints', async t => {
  const { host, page, key, saved } = await setup(t);
  await page.goto(host.controlUrl);
  assert.equal(await page.locator('.gift-settings input:not([type="number"])').count(), 0, 'No URL, ID or name settings inputs');
  await page.waitForFunction(() => !document.querySelector('[data-gift-slot="left"]').disabled);
  assert.equal(await page.locator('#widget-url').textContent(), host.widgetUrl, 'Hosts without a relay keep the local widget link');
  assert.equal(await page.locator('#copy-url').isEnabled(), true);
  const leftPoints = page.getByLabel('Sol taraf · Hediye başına puan');
  const rightPoints = page.getByLabel('Sağ taraf · Hediye başına puan');
  assert.equal(await leftPoints.inputValue(), '');
  assert.equal(await rightPoints.inputValue(), '');
  assert.equal(await page.locator('[data-gift-slot="left"] strong').textContent(), 'Gül');
  const catalogRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/gifts');
  await page.locator('[data-gift-slot="left"]').click();
  assert.equal(new URL((await catalogRequest).url()).searchParams.get('key'), key);
  await page.locator('.gift-picker-more').waitFor();
  assert.equal(await page.locator('.gift-catalog-item').count(), 60);
  await page.locator('.gift-picker-more').click();
  assert.equal(await page.locator('.gift-catalog-item').count(), catalog.length);
  await page.locator('#gift-picker-search').fill('GOKKUSAGI');
  await page.locator('[data-gift-id="1001"]').waitFor();
  assert.equal(await page.locator('.gift-catalog-item').count(), 1);
  await page.locator('[data-gift-id="1001"] img').evaluate(img => img.decode());
  await page.locator('[data-gift-id="1001"]').click();
  await page.locator('[data-gift-slot="right"]').click();
  assert.equal(await page.locator('[data-gift-id="1001"]').isDisabled(), true, 'One gift cannot score both sides');
  await page.locator('#gift-picker-search').fill('alkis');
  await page.locator('[data-gift-id="1002"]').click();
  await leftPoints.fill('0');
  await page.locator('#save-gifts').click();
  await page.locator('#settings-status').filter({ hasText: 'pozitif bir tam sayı' }).waitFor();
  await leftPoints.fill('50');
  await rightPoints.fill('100');
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/live/settings');
  await page.locator('#save-gifts').click();
  const sent = await request;
  assert.equal(new URL(sent.url()).searchParams.get('key'), key);
  assert.deepEqual(sent.postDataJSON(), {
    roseGiftIds: ['1001'], roseGiftNames: [], tiktokGiftIds: ['1002'], tiktokGiftNames: [],
    roseGiftLabel: 'Gökkuşağı', tiktokGiftLabel: 'Alkış', roseGiftImage: image('1001'), tiktokGiftImage: image('1002'),
    rosePointsPerGift: 50, tiktokPointsPerGift: 100,
  });
  await page.locator('#settings-status').filter({ hasText: 'kaydedildi' }).waitFor();
  assert.equal(saved().roseUnitCoins, 100);
  assert.equal(saved().tiktokUnitCoins, 9);
  await page.reload();
  await page.locator('[data-gift-slot="left"] strong').filter({ hasText: 'Gökkuşağı' }).waitFor();
  assert.equal(await page.locator('[data-gift-slot="right"] strong').textContent(), 'Alkış');
  assert.equal(await leftPoints.inputValue(), '50');
  assert.equal(await rightPoints.inputValue(), '100');
  await page.locator('[data-gift-slot="left"] img').evaluate(img => img.decode());
  assert.equal(await page.locator('.gift-test[data-side="left"]').textContent(), 'Gökkuşağı · sol');
  const testRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/live/test-event');
  await page.locator('.gift-test[data-side="left"]').click();
  assert.equal((await testRequest).postDataJSON().giftId, '1001');
  await leftPoints.fill('');
  await page.locator('#save-gifts').click();
  await page.locator('#settings-status').filter({ hasText: 'kaydedildi' }).waitFor();
  assert.equal(saved().rosePointsPerGift, null);
  assert.equal(saved().tiktokPointsPerGift, 100);
  const unauthorized = await fetch(`${host.baseUrl}/api/gifts`);
  assert.equal(unauthorized.status, 403);
});

test('receipt polling reports ignored gifts without replacing unsaved choices or closing the catalog', async t => {
  const { host, page, emit, key } = await setup(t);
  await page.goto(host.controlUrl);
  await choose(page, 'left', 'gokkusagi', '1001');
  const leftPoints = page.getByLabel('Sol taraf · Hediye başına puan');
  await leftPoints.fill('50');
  await page.locator('[data-gift-slot="right"]').click();
  await page.locator('#gift-picker-search').fill('alkis');
  emit({ eventId: 'ignored-local-test', giftId: '9999', giftName: 'Başka hediye', coins: 3, username: 'giver', repeatEnd: true });
  await page.locator('#live-receipts').filter({ hasText: '1 hediye alındı · 0 puanlandı' }).waitFor();
  await page.locator('#live-gift-reason').filter({ hasText: 'Son hediye puanlanmadı:' }).waitFor();
  assert.equal(await page.locator('.gift-dialog').evaluate(node => node.open), true);
  assert.equal(await page.locator('#gift-picker-search').inputValue(), 'alkis');
  assert.equal(await leftPoints.inputValue(), '50');
  assert.equal(await page.locator('[data-gift-slot="left"] strong').textContent(), 'Gökkuşağı');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.gift-dialog').open);
  assert.equal(await page.locator('.gift-dialog').evaluate(node => node.open), false);
  assert.equal(await page.locator('[data-gift-slot="right"]').evaluate(node => node === document.activeElement), true);
  const state = await fetch(`${host.baseUrl}/api/state?key=${key}`).then(response => response.json());
  assert.equal(state.giftConfig.roseGiftIds[0], '5655', 'Draft does not mutate live settings');
  assert.equal(state.giftConfig.rosePointsPerGift, null);
  await page.locator('#save-gifts').click();
  await page.locator('#settings-status').filter({ hasText: 'kaydedildi' }).waitFor();
});

test('catalog failures retry, empty search stays useful, and failed saves preserve both draft and applied test gift', async t => {
  const { host, page } = await setup(t);
  let failCatalog = true;
  await page.route('**/api/gifts?*', route => failCatalog
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Katalog geçici olarak kullanılamıyor.' }) })
    : route.continue());
  await page.goto(host.controlUrl);
  await page.locator('[data-gift-slot="left"]').click();
  await page.locator('.gift-picker-status').filter({ hasText: 'geçici' }).waitFor();
  failCatalog = false; await page.locator('.gift-picker-retry').click();
  await page.locator('[data-gift-id="1001"]').waitFor();
  await page.locator('#gift-picker-search').fill('olmayan hediye');
  await page.locator('.gift-picker-empty').filter({ hasText: 'bulunamadı' }).waitFor();
  await page.locator('#gift-picker-search').fill('gokkusagi');
  await page.locator('[data-gift-id="1001"]').click();
  await page.route('**/api/live/settings?*', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Ayarlar şu anda kaydedilemedi.' }) }));
  await page.locator('#save-gifts').click();
  await page.locator('#settings-status').filter({ hasText: 'kaydedilemedi' }).waitFor();
  assert.equal(await page.locator('[data-gift-slot="left"] strong').textContent(), 'Gökkuşağı');
  assert.equal(await page.locator('#save-gifts').isEnabled(), true);
  const testRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/live/test-event');
  await page.locator('.gift-test[data-side="left"]').click();
  assert.equal((await testRequest).postDataJSON().giftId, '5655', 'Test uses applied gift after a failed save');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('[data-gift-slot="right"]').click();
  const fits = await page.locator('.gift-dialog').evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight && node.scrollWidth <= node.clientWidth;
  });
  assert.equal(fits, true, 'Catalog fits a narrow phone viewport');
  await page.keyboard.press('Escape');
});

test('a fresh control window can connect accounts and copy only the ready HTTPS broadcast URL', async t => {
  let relayUrl = 'http://widget.example/insecure';
  const relayLookups = new Set();
  const { host, page, key } = await setup(t, {
    channel: undefined,
    connectLive: async username => {
      relayUrl = null;
      return { status: 'connected', username };
    },
    getBroadcastURL: username => {
      relayLookups.add(username);
      return relayUrl;
    },
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async text => { window.copiedBroadcastUrl = text; } },
    });
  });
  await page.goto(host.controlUrl);
  const frame = page.frameLocator('.preview-frame iframe');
  const address = page.locator('#widget-url');
  const copy = page.locator('#copy-url');
  const connect = page.locator('#connect-live');
  await frame.getByRole('button', { name: 'Sol oyuncu seç' }).waitFor();
  await frame.getByRole('button', { name: 'Sağ oyuncu seç' }).waitFor();
  await address.filter({ hasText: 'HTTPS widget bağlantısı hazırlanıyor' }).waitFor();
  assert.equal(await copy.isDisabled(), true);
  assert.equal(await page.locator('#start-round').isDisabled(), true);
  assert.equal((await fetch(`${host.baseUrl}/api/meta`)).status, 403);
  const getMeta = () => fetch(`${host.baseUrl}/api/meta?key=${key}`).then(response => response.json());
  const pending = await getMeta();
  assert.equal(pending.broadcastUrlSupported, true);
  assert.equal(Object.hasOwn(pending, 'broadcastUrl'), false);
  assert.deepEqual([...relayLookups], ['']);

  const changeAccount = async username => {
    await page.locator('#live-username').fill(`@${username}`);
    await connect.click();
    await page.locator('#test-result').filter({ hasText: `@${username} yayınına bağlanıldı` }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#connect-live').disabled);
    assert.equal(host.getChannel(), username);
    assert.equal(host.getBroadcastState().owner, null);
    assert.equal(host.getBroadcastState().opponent, null);
  };
  await changeAccount('test_yayini');
  relayUrl = 'https://widget.example/live/abc';
  assert.equal((await getMeta()).broadcastUrl, relayUrl);
  await address.filter({ hasText: relayUrl }).waitFor();
  await copy.click();
  assert.equal(await page.evaluate(() => window.copiedBroadcastUrl), relayUrl);
  await copy.filter({ hasText: 'Kopyalandı' }).waitFor();
  assert.equal(await page.locator('.preview-frame iframe').getAttribute('src'), `${host.widgetUrl}?key=${key}`);
  await changeAccount('ikinci_yayin');
  await address.filter({ hasText: 'HTTPS widget bağlantısı hazırlanıyor' }).waitFor();
  assert.equal(await copy.isDisabled(), true);
  assert.deepEqual([...relayLookups], ['', 'test_yayini', 'ikinci_yayin']);
});
