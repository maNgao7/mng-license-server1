const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/561aaff7-93f0-4cea-aeb4-888712ee4fc0';

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('http://127.0.0.1:4275', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#demo');
  await page.click('#demo');
  await new Promise(r => setTimeout(r, 1500));

  console.log('Testing 800m boat boost...');
  await page.evaluate(() => {
    // Trigger 800m boat cruise
    window.runEffect('boat', 'Kaptan800');
  });

  // Fast forward into mid cruise (e.g. 350m ahead)
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    const active = window.world._getActiveEffect?.();
    if (active) active.elapsed = active.duration * 0.45; // 45% through 800m cruise
  });

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_1000m_fast_cruise.png') });
  console.log('1000m fast cruise screenshot captured successfully!');

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
