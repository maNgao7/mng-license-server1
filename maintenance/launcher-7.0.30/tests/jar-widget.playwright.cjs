'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');
const { _electron, chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createOverlayBridge } = require('../lib/overlay-bridge.cjs');

test('jar links restore stored gifts and show new gifts once through the broadcast relay', { timeout: 65000 }, async t => {
    const launcherRoot = path.resolve(__dirname, '..');
    const serverRoot = path.resolve(process.env.MNG_QA_SERVER || path.join(launcherRoot, '../server'));
    const { registerOverlayRelay } = await import(pathToFileURL(path.join(serverRoot, 'overlay-relay.js')));
    const express = require(path.join(serverRoot, 'node_modules/express'));
    const app = express();
    const relay = registerOverlayRelay(app, { secret: crypto.randomBytes(32), authorize: () => 'qa-owner' });
    const server = http.createServer(app);
    relay.attach(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const relayOrigin = `http://127.0.0.1:${server.address().port}`;
    const reservation = http.createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tikmng-jar-test-'));
    const accessKey = crypto.randomBytes(16).toString('hex');
    const env = { ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(port),
        MNG_WIDGET_ACCESS_KEY: accessKey, MNG_LICENSE_SERVER: relayOrigin };
    delete env.ELECTRON_RUN_AS_NODE;
    const values = new Map();
    const bridge = createOverlayBridge({ store: values, serverURL: relayOrigin, port, accessKey,
        allowInsecureForTests: true, getCredentials: () => ({ licenseCode: 'QA', deviceId: 'qa-device' }) });
    let desktop, browser;
    t.after(async () => {
        await browser?.close();
        bridge.close();
        await desktop?.close();
        await relay.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(profile, { recursive: true, force: true });
    });
    const args = process.env.MNG_QA_PACKAGED === '1' ? ['--tikmng-preview'] : [launcherRoot, '--tikmng-preview'];
    desktop = await _electron.launch({ executablePath: process.env.MNG_QA_ELECTRON, args, env });
    const window = await desktop.firstWindow();
    const origin = `http://127.0.0.1:${port}`;
    function localURL(pathname, type) {
        const url = new URL(pathname, origin);
        url.searchParams.set('key', accessKey);
        if (type) url.searchParams.set('type', type);
        return url;
    }
    async function gift(eventId, count) {
        const res = await fetch(localURL('/api/widget/event'), { method: 'POST', body: JSON.stringify({
            type: 'gift', eventId, username: 'qa_viewer', giftId: '5655', giftName: 'Gül',
            giftType: 1, repeatEnd: true, count, coins: count
        }) });
        assert.equal(res.status, 200);
    }
    const channel = 'jar_qa';
    // Set the active profile via the existing renderer API, without connecting to a live room.
    assert.equal((await window.evaluate(username => window.mngAPI.tiktokHesapKaydet(username), channel)).basarili, true);
    await gift('stored-combo', 3);
    const storedAt = Date.now();
    const snapshot = localURL('/api/widget/state', 'jar-bell');
    const read = async url => (await fetch(url)).json();
    assert.equal((await read(snapshot)).jarGifts.length, 3);
    snapshot.searchParams.set('transport', 'changes');
    assert.equal((await read(snapshot)).jarGifts.length, 3);
    snapshot.searchParams.set('history', '0');
    assert.equal((await read(snapshot)).jarGifts, undefined);

    bridge.start(channel);
    for (let n = 0; !bridge.status().ready && n < 100; n++) await delay(100);
    assert.ok(bridge.status().ready, 'local relay connects');
    browser = await chromium.launch({ executablePath: process.env.MNG_QA_CHROME, headless: true });
    const savedPages = [];
    await delay(Math.max(0, 2300 - (Date.now() - storedAt)));
    for (const id of ['jar-classic', 'jar-bell', 'jar-cat']) {
        const url = bridge.urlFor(localURL('/widget-overlay.html', id).href, { namedWidget: id });
        assert.ok(url.endsWith('/widget/view/' + id));
        const page = await browser.newPage();
        await page.goto(url);
        await page.waitForFunction(() => window.__widgetDiagnostics?.bodies === 3);
        await page.evaluate(() => {
            const circle = Matter.Bodies.circle;
            window.qaGiftBodiesSpawned = 0;
            Matter.Bodies.circle = (...args) => {
                window.qaGiftBodiesSpawned++;
                return circle(...args);
            };
        });
        savedPages.push({ id, page });
    }
    await gift('new-combo', 2);
    await gift('new-combo', 2);
    assert.equal((await read(localURL('/api/widget/state', 'jar-bell'))).jarGifts.length, 5);
    for (const { id, page } of savedPages) {
        try {
            await page.waitForFunction(() => window.qaGiftBodiesSpawned >= 2, null, { timeout: 14000 });
        } catch (error) {
            const diagnostics = await page.evaluate(() => {
                const { bodies, seen, failures, inJarBodies, frameCount } = window.__widgetDiagnostics || {};
                return { bodies, seen, failures, inJarBodies, frameCount,
                    live: state.activities?.map(({ id, coins, count, createdAt }) => ({ id, coins, count, createdAt })),
                    bodiesById: [...physicsEntries.keys()], spawned: window.qaGiftBodiesSpawned, overflow: physics?.overflowTotal,
                    pending: physics?.jarQueue?.length, cursor: eventCursor, jarLoaded };
            });
            throw new Error(`${id} ${JSON.stringify(diagnostics)}`, { cause: error });
        }
        assert.equal(await page.evaluate(() => window.qaGiftBodiesSpawned), 2);
        await page.reload();
        await page.waitForFunction(() => window.__widgetDiagnostics?.bodies >= 4);
    }
    assert.equal((await window.evaluate(() => window.mngAPI.widgetStudioSifirla('jar-bell'))).basarili, true);
    const bell = savedPages.find(({ id }) => id === 'jar-bell').page;
    await bell.waitForFunction(() => window.__widgetDiagnostics?.bodies === 0);
    await gift('after-reset', 1);
    await bell.waitForFunction(() => window.__widgetDiagnostics?.bodies === 1);
});
