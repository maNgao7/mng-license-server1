'use strict';

// Run with node tools/renderer-qa/check-launch.cjs. No real launcher main/preload is loaded.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'artifacts');

if (!process.versions.electron) {
    const { spawnSync } = require('node:child_process');
    fs.mkdirSync(output, { recursive: true });
    const profile = fs.mkdtempSync(path.join(output, 'isolated-profile-'));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const run = spawnSync(require(path.join(root, 'node_modules/electron')), [__filename, `--qa-profile=${profile}`], {
        cwd: root, env, stdio: 'inherit', windowsHide: true, timeout: 90000
    });
    assert.ok(profile.startsWith(output + path.sep), 'QA cleanup must stay inside its artifact directory');
    fs.rmSync(profile, { recursive: true, force: true });
    if (run.error) console.error(run.error.message);
    process.exitCode = run.status ?? 1;
} else {
    const { app, BrowserWindow, ipcMain, session } = require('electron');
    const profile = process.argv.find(value => value.startsWith('--qa-profile='))?.slice('--qa-profile='.length);
    assert.ok(profile && path.resolve(profile).startsWith(output + path.sep), 'An isolated QA profile is required');
    app.setPath('userData', profile);
    app.disableHardwareAcceleration();
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'lib/catalog-defaults.json'), 'utf8'));
    const games = catalog.games.map(game => ({ ...game, ad: game.title, installed: true, resources: [], boyut: 'QA', installedVersion: 'QA' }));
    const snapshot = { version: 'renderer-QA', preview: true, games, media: [], remoteMedia: [], mediaLibrary: [], audioLibrary: [], soundEffects: [], tts: {}, overlayTransport: { ready: false, message: 'QA' } };
    ipcMain.handle('renderer-qa-workspace', (_event, action) => {
        if (['snapshot', 'refresh'].includes(action)) return snapshot;
        if (action === 'speech-status') return { voices: [] };
        if (['media-status', 'overlay-status'].includes(action)) return { receivers: 0, configured: 0, transport: snapshot.overlayTransport };
        throw new Error(`Unexpected QA workspace action: ${action}`);
    });
    ipcMain.handle('renderer-qa-game-status', () => Object.fromEntries(games.map(game => [game.id, { kurulu: true }])));

    app.whenReady().then(async () => {
        const qaSession = session.fromPartition(`renderer-qa-${Date.now()}`);
        const externalRequests = [];
        qaSession.webRequest.onBeforeRequest((details, callback) => {
            const external = /^https?:|^wss?:/i.test(details.url);
            if (external) externalRequests.push(details.url);
            callback({ cancel: external });
        });
        const win = new BrowserWindow({ width: 1280, height: 900, show: false, useContentSize: true,
            webPreferences: { session: qaSession, preload: path.join(__dirname, 'preload.cjs'), sandbox: false,
                contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
        const consoleErrors = [];
        win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) consoleErrors.push(message); });
        const checks = [];
        const evaluate = code => win.webContents.executeJavaScript(code, true);
        const check = (name, value) => { assert.ok(value, name); checks.push(name); };
        const waitFor = async (code, label) => {
            const until = Date.now() + 6000;
            do {
                if (await evaluate(code)) return;
                await new Promise(resolve => setTimeout(resolve, 25));
            } while (Date.now() < until);
            throw new Error(`Timed out: ${label}`);
        };
        const capture = async name => {
            await evaluate(`Promise.all(Array.from(document.querySelectorAll('#gameLaunchOverlay img')).filter(img => !img.hidden).map(img => img.decode())).then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))`);
            const image = await win.webContents.capturePage();
            const pixels = image.toBitmap();
            const colors = new Set();
            for (let i = 0; i < pixels.length; i += 404) colors.add(pixels.subarray(i, i + 3).toString('hex'));
            check(`${name}: nonblank screenshot`, colors.size > 20);
            fs.writeFileSync(path.join(output, name + '.png'), image.toPNG());
        };
        const launch = async (id, options) => {
            const count = await evaluate('rendererQA.inspect().length');
            await evaluate(`window.qaLaunch = oyunuBaslat(${JSON.stringify(id)}, ${JSON.stringify(options)}); void 0`);
            await waitFor(`rendererQA.inspect().length === ${count + 1}`, 'backend invocation');
            return count;
        };
        const finish = async (index, result = { basarili: true }, error) => {
            await evaluate(`rendererQA.finish(${index}, ${JSON.stringify(result)}, ${JSON.stringify(error)}); void 0`);
            await waitFor('!window.tikmngGameLaunching && !document.getElementById("gameLaunchOverlay").open', 'launch cleanup');
        };
        const dialogFits = () => evaluate(`(() => {
            const dialog = document.getElementById('gameLaunchOverlay'), r = dialog.getBoundingClientRect();
            return r.width <= 460 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth;
        })()`);

        try {
            await win.loadFile(path.join(root, 'renderer/index.html'));
            await waitFor(`document.querySelectorAll('.library-card').length === ${games.length} && document.getElementById('licenseStatus').textContent !== 'Kontrol ediliyor...'`, 'synthetic workspace');

            for (const game of games) {
                await evaluate(`document.querySelector('[data-open="${game.id}"]').click(); void 0`);
                await waitFor(`document.querySelector('[data-play="${game.id}"]')`, game.id + ' detail');
                const before = await evaluate('rendererQA.inspect().length');
                const prompt = await evaluate(`(() => {
                    const button = document.querySelector('[data-play="${game.id}"]'); button.focus(); button.click();
                    const dialog = document.getElementById('gameLaunchOverlay');
                    return { open: dialog.open, focus: document.activeElement === dialog, disabled: button.disabled,
                        title: document.getElementById('gameLaunchTitle').textContent,
                        message: document.getElementById('gameLaunchMessage').textContent,
                        noPercent: !dialog.textContent.includes('%') && !dialog.querySelector('[aria-valuenow]') };
                })()`);
                check(game.id + ': immediate branded dialog and duplicate-click lock', prompt.open && prompt.focus && prompt.disabled && prompt.noPercent && prompt.title === game.ad && prompt.message === 'Oyun açılıyor, lütfen bekleyiniz');
                await waitFor(`rendererQA.inspect().length === ${before + 1}`, 'Play dispatch');
                await evaluate(`oynaButonu('${game.id}'); oyunuBaslat('${game.id}'); rendererQA.closed(); rendererQA.emit({oyun:'other-game',tip:'hazir'}); rendererQA.emit({oyun:'other-game',tip:'hata',mesaj:'Unrelated'}); void 0`);
                check(game.id + ': unrelated close/ready/error cannot end launch', await evaluate(`rendererQA.inspect().length === ${before + 1} && document.getElementById('gameLaunchOverlay').open && document.querySelector('[data-play="${game.id}"]').disabled`));
                const phase = 'Oyun motoru başlatılıyor; hazır sinyali bekleniyor...';
                await evaluate(`rendererQA.emit({oyun:'${game.id}',tip:'baslatiliyor',phase:'engine',mesaj:${JSON.stringify(phase)}}); void 0`);
                check(game.id + ': actual phase and compact bounds', await dialogFits() && await evaluate(`document.getElementById('gameLaunchPhase').textContent === ${JSON.stringify(phase)}`));
                if (game.id === 'battle-royale') {
                    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESCAPE' });
                    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESCAPE' });
                    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'TAB' });
                    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'TAB' });
                    await evaluate('new Promise(resolve => requestAnimationFrame(resolve))');
                    check('Escape/Tab preserve modal and focus', await evaluate(`document.getElementById('gameLaunchOverlay').open && (document.activeElement === document.body || document.getElementById('gameLaunchOverlay').contains(document.activeElement))`));
                    check('dialog blocks background focus', await evaluate(`(() => { document.querySelector('[data-workspace-view="games"]').focus(); return document.activeElement !== document.querySelector('[data-workspace-view="games"]'); })()`));
                    await capture('launch-desktop');
                }
                await evaluate(`rendererQA.emit({oyun:'${game.id}',tip:'hazir',phase:'ready'}); void 0`);
                await waitFor('!window.tikmngGameLaunching', 'ready event releases modal');
                check(game.id + ': focus and Play restored on actual ready', await evaluate(`!document.getElementById('gameLaunchOverlay').open && document.activeElement === document.querySelector('[data-play="${game.id}"]') && !document.activeElement.disabled`));
                await finish(before);
                await evaluate(`document.querySelector('[data-back]').click(); void 0`);
            }

            await evaluate(`rendererQA.configure({holdAccount:true}); void 0`);
            const count = await evaluate('rendererQA.inspect().length');
            await evaluate(`window.qaLaunch=oyunuBaslat('orbit'); void 0`);
            check('modal visible before slow account lookup; no invented backend phase', await evaluate(`document.getElementById('gameLaunchOverlay').open && document.getElementById('gameLaunchPhase').textContent === 'Yayın hesabı kontrol ediliyor' && rendererQA.inspect().length === ${count}`));
            await evaluate(`rendererQA.configure({holdAccount:false}); void 0`);
            await waitFor(`rendererQA.inspect().length === ${count + 1}`, 'release slow account lookup');
            await finish(count);

            let index = await launch('orbit');
            await evaluate(`rendererQA.emit({oyun:'orbit',tip:'hata',phase:'failed',mesaj:'QA readiness failed'}); void 0`);
            await waitFor('!window.tikmngGameLaunching', 'error event cleanup');
            check('backend error event is visible and restores controls', await evaluate(`!document.getElementById('gameLaunchOverlay').open && document.getElementById('workspaceNotice').textContent.includes('QA readiness failed')`));
            const next = await launch('vs');
            await evaluate(`rendererQA.finish(${index}, null, 'late old rejection'); void 0`);
            check('late old rejection cannot close a newer launch', await evaluate(`document.getElementById('gameLaunchOverlay').open && document.getElementById('gameLaunchTitle').textContent === 'TikTok VS Profil'`));
            await finish(next);

            index = await launch('orbit');
            await finish(index, { basarili: false, hata: 'QA IPC failure' });
            check('IPC failure is visible', await evaluate(`document.getElementById('workspaceNotice').textContent.includes('QA IPC failure')`));
            index = await launch('orbit');
            await finish(index, null, 'QA IPC rejected');
            check('IPC rejection is visible', await evaluate(`document.getElementById('workspaceNotice').textContent.includes('QA IPC rejected')`));
            await evaluate(`rendererQA.configure({accountError:true}); window.qaLaunch=oyunuBaslat('orbit'); void 0`);
            await waitFor('!window.tikmngGameLaunching', 'account failure cleanup');
            check('account failure cleans up and reports error', await evaluate(`!document.getElementById('gameLaunchOverlay').open && document.getElementById('workspaceNotice').textContent.includes('QA account lookup failed')`));
            await evaluate(`rendererQA.configure({accountError:false,active:'qa_selected',connected:'qa_live'}); document.getElementById('vsPlayBtn').disabled=true; void 0`);
            index = await launch('orbit', { tiktokUser: 'qa_direct', orbitTest: 'shatter', orbitSettings: { test: true } });
            check('direct options and explicit user preserved', await evaluate(`rendererQA.inspect()[${index}].options.tiktokUser === 'qa_direct' && rendererQA.inspect()[${index}].options.orbitTest === 'shatter' && rendererQA.inspect()[${index}].options.orbitSettings.test`));
            await finish(index);
            check('pre-existing disabled state preserved', await evaluate(`document.getElementById('vsPlayBtn').disabled`));
            index = await launch('orbit');
            check('connected account takes precedence', await evaluate(`rendererQA.inspect()[${index}].options.tiktokUser === 'qa_live'`));
            await finish(index);
            await evaluate(`rendererQA.configure({connected:''}); void 0`);
            index = await launch('orbit');
            check('selected account fallback preserved', await evaluate(`rendererQA.inspect()[${index}].options.tiktokUser === 'qa_selected'`));
            await finish(index);

            await evaluate(`document.querySelector('[data-open="vs"]').click(); void 0`);
            index = await launch('orbit');
            check('another game detail never supplies the wrong cover/name', await evaluate(`document.getElementById('gameLaunchTitle').textContent.includes('Orbit') && document.getElementById('gameLaunchCover').hidden`));
            await finish(index);

            await evaluate(`document.querySelector('[data-back]').click(); document.querySelector('[data-open="battle-royale"]').click(); void 0`);
            win.setContentSize(390, 844);
            index = await launch('battle-royale');
            await evaluate(`document.getElementById('workspaceNotice').hidden=true; rendererQA.emit({oyun:'battle-royale',tip:'baslatiliyor',phase:'engine',mesaj:'Oyun motoru başlatılıyor; hazır sinyali bekleniyor...'}); void 0`);
            check('narrow modal fits and cover loads', await dialogFits() && await evaluate(`document.getElementById('gameLaunchCover').naturalWidth > 0`));
            await capture('launch-narrow');
            win.webContents.setZoomFactor(1.5);
            check('modal fits at 150% zoom', await dialogFits());
            await capture('launch-zoom');
            win.webContents.setZoomFactor(1);
            win.webContents.debugger.attach('1.3');
            await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
            check('reduced motion stops spinner', await evaluate(`getComputedStyle(document.querySelector('.game-launch-indicator')).animationName === 'none'`));
            win.webContents.debugger.detach();
            await finish(index);

            win.setContentSize(1280, 900);
            await evaluate(`lisansEkraniGoster('Yayıncı hesabınız ve lisansınızla devam edin.'); void 0`);
            await waitFor('document.activeElement.id === "licenseInput"', 'login focus');
            const sloganBefore = await evaluate(`document.getElementById('licenseSlogan').textContent`);
            check('slogan directly follows platform line above fields', await evaluate(`(() => {
                const slogan = document.getElementById('licenseSlogan'), tagline = slogan.previousElementSibling;
                return tagline.textContent === 'Canlı Yayın Oyun Platformu' && slogan.getBoundingClientRect().top - tagline.getBoundingClientRect().bottom <= 12 && slogan.getBoundingClientRect().bottom < document.getElementById('licenseUsername').getBoundingClientRect().top;
            })()`));
            await capture('login-desktop');
            await waitFor(`document.getElementById('licenseSlogan').textContent !== ${JSON.stringify(sloganBefore)}`, 'existing slogans rotate on workspace login');
            check('login fields stay empty while slogan rotates', await evaluate(`document.getElementById('licenseInput').value === '' && document.getElementById('licenseUsername').value === '' && document.activeElement.id === 'licenseInput'`));
            win.setContentSize(390, 844);
            await evaluate(`document.getElementById('licensePage').scrollTop=0; void 0`);
            check('narrow login has no horizontal overflow', await evaluate(`document.getElementById('licensePage').scrollWidth <= innerWidth`));
            await capture('login-narrow');
            check('no external requests or real license traffic', externalRequests.length === 0);
            check('no renderer console errors', consoleErrors.length === 0);
            const report = { passed: checks.length, games: games.length, checks, externalRequests, consoleErrors, screenshots: fs.readdirSync(output).filter(name => name.endsWith('.png')) };
            fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
            console.log(JSON.stringify(report, null, 2));
        } catch (error) {
            console.error(error.stack);
            console.error(JSON.stringify({ consoleErrors, externalRequests }, null, 2));
            fs.writeFileSync(path.join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG());
            process.exitCode = 1;
        } finally {
            win.destroy();
            app.exit(process.exitCode || 0);
        }
    }).catch(error => { console.error(error); app.exit(1); });
}
