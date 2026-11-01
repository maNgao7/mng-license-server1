'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const renderer = path.resolve(__dirname, '../renderer');
const output = 'D:/TikMnG-Launcher-Test-Raporu';
const index = fs.readFileSync(path.join(renderer, 'index.html'), 'utf8');
const start = index.indexOf('    <div class="license-page"');
const end = index.indexOf('    <!-- OTOMATİK GÜNCELLEME', start);
assert.ok(start >= 0 && end > start);
const markup = index.slice(start, end).replace('style="display:none"', 'style="display:flex"');
const application = fs.readFileSync(path.join(renderer, 'app.js'), 'utf8');
const functionStart = application.indexOf('async function lisansDogrula()');
const functionEnd = application.indexOf('// =====================================================================', functionStart);
const validateSource = application.slice(functionStart, functionEnd);
const calls = [];
let browser;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-v3.css"><link rel="stylesheet" href="/license-entry.css"><body>${markup}<script src="/license-entry.js"></script></body></html>`);
        return;
    }
    const file = path.resolve(renderer, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(renderer + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__entryCall', (type, value) => {
        calls.push({ type, value });
        return type === 'validate' ? { gecerli: value === 'SYNTHETIC-VALID', hata: 'Geçersiz lisans kodu.' } : { basarili: true };
    });
    await page.addInitScript(() => { window.mngAPI = { tiktokHesaplari: async () => ({ accounts: [], active: '' }) }; });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.evaluate('(function(){' + validateSource + `
        window.API={lisansDogrula:v=>window.__entryCall('validate',v),tiktokHesapKaydet:v=>window.__entryCall('account',v),tiktokBaglan:v=>window.__entryCall('connect',v)};
        window.lisansDurumu=null;window.bekleyenUygulama=null;
        window.anaEkraniGoster=()=>window.__entryCall('home');window.lisansUIGuncelle=()=>{};window.tiktokHesaplariniYukle=async()=>{};
        window.licenseInputTemizle=()=>{};
        window.lisansDogrula=lisansDogrula;
    })();`);
    await page.locator('#licenseBtn').click();assert.equal(calls.length, 0);
    assert.match(await page.locator('#licenseError').innerText(), /kullanıcı/);
    await page.locator('#licenseUsername').fill('synthetic_qa');await page.locator('#licenseInput').fill('WRONG');
    await page.locator('#licenseBtn').click();await page.waitForFunction(()=>document.getElementById('licenseBtn').disabled===false);
    assert.equal(calls.filter(item=>item.type==='account').length, 0);
    await page.locator('#licenseInput').fill('SYNTHETIC-VALID');await page.locator('#licenseInput').press('Enter');
    await page.waitForFunction(()=>document.getElementById('licenseBtn').textContent==='Giriş yap');
    assert.deepEqual(calls.map(item=>item.type), ['validate','validate','account','connect','home']);
    assert.equal(calls.find(item=>item.type==='account').value, 'synthetic_qa');
    await page.locator('#licenseError').evaluate(el=>el.classList.remove('visible'));
    await page.locator('#licenseInput').fill('');await page.locator('#licenseUsername').fill('');
    await page.evaluate(()=>{const img=new Image();img.src='/assets/streamer-entry-v3.png';return img.decode();});
    for (const width of [1440, 960, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1), false);
        await page.screenshot({ path: path.join(output, 'yayinci-girisi-' + width + '.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('License entry QA passed: 3 widths, generated asset, username validation, invalid license blocked, valid license then account/connect, Enter single-submit. Isolated synthetic API only.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
