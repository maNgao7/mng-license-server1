import fs from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1040, height: 690 }, deviceScaleFactor: 1 });
  const png = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  await page.setContent(`<!doctype html><html lang="tr"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px 40px;background:#151b21;color:#f2f5f8;font:15px Arial,sans-serif}
    h1{font-size:23px;margin:0 0 8px}p{color:#c0ccd5;margin:0 0 18px;font-size:13px}
    h2{font-size:15px;margin:14px 0 8px}img{display:block;width:960px;height:250px;background:#080d12}
  </style><h1>Teke Tek Profil · 0.5.6 → 0.5.7</h1>
  <p>Aynı 960 × 250 tuval · Yerel test görselleri · Eski görüntü arşivdeki 0.5.6 referansıdır.</p>
  <h2>Önce · 0.5.6</h2><img alt="Arşivdeki önceki widget" src="${png('qa/duel-scorebar-056.png')}">
  <h2>Sonra · 0.5.7</h2><img alt="Kompakt kırmızı yeşil widget" src="${png('tests/artifacts/duel-compact-running.png')}">
  </html>`);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path: 'tests/artifacts/duel-comparison-056-057.png' });
  console.log('Saved tests/artifacts/duel-comparison-056-057.png');
} finally {
  await browser.close();
}
