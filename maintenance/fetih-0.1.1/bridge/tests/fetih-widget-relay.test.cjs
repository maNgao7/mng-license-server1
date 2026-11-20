'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const { setTimeout: delay } = require('node:timers/promises');

const serverRoot = process.env.MNG_QA_RELAY_PATH;
const playwright = process.env.PLAYWRIGHT_MODULE;

test('Fetih publishes both browser sources via the TikMnG relay without reloading standings', {
    skip: !serverRoot || !playwright, timeout: 30000
}, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fetih-relay-test-'));
    const script = path.resolve(__dirname, '../country-leaders-widget.cjs');
    const world = path.join(root, 'world-v1.json');
    const dataFile = path.join(root, 'widget-armies-v1.json');
    const licenseFile = path.join(root, 'license-backup.json');
    const statusFile = path.join(root, 'widget-link-v1.json');
    const army = { name: 'Deniz', soldiers: 3000, tanks: 7, helicopters: 4, jets: 3 };
    await fs.writeFile(world, JSON.stringify({ countryLeaders: { deniz: { displayName: 'Deniz', wins: 2 } } }));
    await fs.writeFile(dataFile, JSON.stringify({ rows: [army] }));
    await fs.writeFile(licenseFile, JSON.stringify({ code: 'LOCAL-FETIH-QA', deviceId: '1234567890abcdef' }));

    const child = spawn(process.execPath, [script, world, String(process.pid), '0'], { windowsHide: true });
    const childExit = once(child, 'exit');
    const output = createInterface({ input: child.stdout });
    const { registerOverlayRelay } = await import(pathToFileURL(path.join(serverRoot, 'overlay-relay.js')));
    const express = require(path.join(serverRoot, 'node_modules/express'));
    const app = express();
    const server = http.createServer(app);
    const relay = registerOverlayRelay(app, { secret: 'solely-local-fetih-relay-test-key',
        authorize: input => input.licenseCode === 'LOCAL-FETIH-QA' && input.deviceId === '1234567890abcdef',
        revalidate: () => true });
    relay.attach(server);
    const listening = once(server, 'listening');
    server.listen(0, '127.0.0.1');
    let publisher, browser;
    t.after(async () => {
        await browser?.close();
        publisher?.close();
        await relay.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        child.kill();
        await childExit;
        await fs.rm(root, { recursive: true, force: true });
    });
    const [local] = await Promise.race([once(output, 'line'), childExit.then(() => { throw Error('Widget service exited'); })]);
    await listening;
    const target = `http://127.0.0.1:${server.address().port}`;
    const start = () => require(script).startPublisher({
        statusFile, licenseFile, port: Number(new URL(local).port), serverURL: target, allowInsecureForTests: true
    });
    async function readLinks() {
        for (let attempt = 0; attempt < 100; attempt++) {
            const packet = await fs.readFile(statusFile, 'utf8').then(JSON.parse, () => null);
            if (packet?.status === 'connected') return packet.links;
            await delay(60);
        }
        throw Error('Widget publisher did not connect');
    }
    publisher = await start();
    const urls = await readLinks();
    assert.match(urls['fetih-liderler'], /\/overlays\/[A-Za-z0-9_-]{43}\/widget\/view\/fetih-liderler$/);
    assert.match(urls['fetih-ordular'], /\/overlays\/[A-Za-z0-9_-]{43}\/widget\/view\/fetih-ordular$/);

    browser = await require(playwright).chromium.launch({ executablePath: process.env.MNG_QA_CHROME });
    const victoryPage = await browser.newPage();
    await victoryPage.goto(urls['fetih-liderler']);
    await victoryPage.getByText('×2').waitFor();
    const armyPage = await browser.newPage();
    await armyPage.goto(urls['fetih-ordular']);
    await armyPage.getByText('Deniz', { exact: true }).waitFor();
    await armyPage.evaluate(() => { globalThis.staysInThisDocument = true; });
    const before = await armyPage.waitForResponse(response => response.status() === 204);
    assert.equal(new URL(before.url()).searchParams.get('type'), 'fetih-ordular');
    const next = dataFile + '.next';
    await fs.writeFile(next, JSON.stringify({ rows: [{ ...army, jets: 9 }] }));
    await fs.rename(next, dataFile);
    await armyPage.getByRole('cell', { name: '9', exact: true }).waitFor();
    assert.equal(await armyPage.evaluate(() => staysInThisDocument), true);

    publisher.close();
    await delay(150);
    publisher = await start();
    assert.deepEqual(await readLinks(), urls);
});
