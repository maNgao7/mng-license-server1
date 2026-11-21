'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { once } = require('node:events');
const path = require('node:path');

const [executablePath, source, playwright, output] = process.argv.slice(2);
const { _electron } = require(playwright);
const Conf = require(path.join(source, 'node_modules/conf'));
const release = require(path.join(source, 'package.json'));
const games = require(path.join(source, 'lib/published-games.json')).games;

async function main() {
    fs.mkdirSync(output, { recursive: true });
    const profile = fs.mkdtempSync(path.join(output, 'profile-'));
    const store = new Conf({
        cwd: profile, configName: 'mng-config', projectVersion: release.version,
        encryptionKey: 'mng-electron-secret-key-2024',
    });
    store.set({
        lisans_kod: 'LOCAL-SNAKE-VIDEO-QA', preview_initialized_v1: true,
        library_root_v1: path.join(profile, 'games'), media_root_v1: path.join(profile, 'media'),
        tiktok_active_account: '', tiktok_accounts: [],
        widget_announcements_v1: { 'royal-widgets-20261028': true },
        game_announcements_v1: Object.fromEntries(games.map(game => ['game:' + game.id, true])),
    });
    const server = http.createServer((req, res) => {
        req.resume();
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/license/check') {
            return res.end(JSON.stringify({
                valid: true, isUnlimited: false, expiresAt: Date.now() + 3600000,
                remainingSeconds: 3600, remainingDays: 1 / 24,
            }));
        }
        if (req.url === '/api/version') return res.end(JSON.stringify({ latestVersion: release.version, minVersion: '1.0.0' }));
        res.writeHead(404).end('{}');
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const reserve = http.createServer().listen(0, '127.0.0.1');
    await once(reserve, 'listening');
    const port = reserve.address().port;
    await new Promise(resolve => reserve.close(resolve));
    const env = {
        ...process.env, MNG_TEST_PROFILE: profile, MNG_WIDGET_PORT: String(port),
        MNG_LICENSE_SERVER: 'http://127.0.0.1:' + server.address().port,
    };
    delete env.ELECTRON_RUN_AS_NODE;

    let launcher;
    try {
        launcher = await _electron.launch({ executablePath, env, timeout: 45000 });
        const page = await launcher.firstWindow();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.waitForFunction(() => Boolean(window.mngAPI?.workspace), null, { timeout: 25000 });
        await page.locator('#workspaceRoot').waitFor({ state: 'visible', timeout: 25000 });
        const announcements = page.locator('[data-announcement-close]:visible');
        while (await announcements.count()) await announcements.first().click();
        const library = page.locator('[data-workspace-view="games"]:visible').first();
        if (await library.count()) await library.click();
        const game = page.locator('button[data-open="minecraft-snake-arena"]:visible').first();
        await game.click({ timeout: 12000 });
        await page.locator('.game-detail-info h2').filter({ hasText: 'Minecraft Yılan Oyunu' }).waitFor();
        const button = page.getByRole('button', { name: /Kurulum videosunu izle/ });
        assert.equal(await button.getAttribute('data-url'), 'https://youtu.be/VGlRZRKygBE');
        await launcher.evaluate(({ shell }) => {
            shell.openExternal = async url => { globalThis.snakeVideoOpened = url; };
        });
        await button.click();
        for (let attempt = 0; attempt < 20; attempt++) {
            if (await launcher.evaluate(() => Boolean(globalThis.snakeVideoOpened))) break;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        const videoUrl = await launcher.evaluate(() => globalThis.snakeVideoOpened);
        assert.equal(videoUrl, 'https://youtu.be/VGlRZRKygBE');
        assert.equal(await launcher.evaluate(({ app }) => app.getVersion()), release.version);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, 'snake-launcher-video.png') });
        fs.writeFileSync(path.join(output, 'snake-launcher-result.json'), JSON.stringify({
            version: release.version, gameId: 'minecraft-snake-arena', videoUrl, rendererErrors: errors,
        }, null, 2) + '\n');
        console.log('Packaged game page and YouTube click passed.');
    } catch (error) {
        const page = launcher?.windows().find(window => !window.isClosed());
        await page?.screenshot({ path: path.join(output, 'snake-launcher-failure.png'), timeout: 3000 }).catch(() => {});
        throw error;
    } finally {
        await launcher?.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error.stack);
    process.exitCode = 1;
});
