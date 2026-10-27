'use strict';
const fs = require('node:fs');
const path = require('node:path');

async function main() {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const { app, nativeImage } = require('electron');
    await app.whenReady();
    const assets = path.resolve(__dirname, '../renderer/assets');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
        await page.goto(require('node:url').pathToFileURL(path.join(assets, 'brand-v3.svg')).href);
        await page.screenshot({ path: path.join(assets, 'logo-v3.png'), omitBackground: true });
        const source = nativeImage.createFromPath(path.join(assets, 'logo-v3.png'));
        const sizes = [256, 128, 64, 48, 32, 16];
        const images = sizes.map(size => source.resize({ width: size, height: size, quality: 'best' }).toPNG());
        const header = Buffer.alloc(6 + sizes.length * 16);
        header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
        let offset = header.length;
        images.forEach((png, index) => { const entry = 6 + index * 16, size = sizes[index];
            header.writeUInt8(size === 256 ? 0 : size, entry); header.writeUInt8(size === 256 ? 0 : size, entry + 1);
            header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
            header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += png.length;
        });
        fs.writeFileSync(path.join(assets, 'icon-v3.ico'), Buffer.concat([header, ...images]));
    } finally { await browser.close(); app.quit(); }
}
main().catch(error => { console.error(error); require('electron').app.exit(1); });
