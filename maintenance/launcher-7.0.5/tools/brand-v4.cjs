'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');

const assets = path.resolve(__dirname, '../renderer/assets');
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function encodeIco(frames) {
    const directory = Buffer.alloc(6 + frames.length * 16);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(frames.length, 4);
    let offset = directory.length;
    frames.forEach(({ size, png }, index) => {
        const entry = 6 + index * 16;
        directory[entry] = size === 256 ? 0 : size;
        directory[entry + 1] = size === 256 ? 0 : size;
        directory.writeUInt16LE(1, entry + 4);
        directory.writeUInt16LE(32, entry + 6);
        directory.writeUInt32LE(png.length, entry + 8);
        directory.writeUInt32LE(offset, entry + 12);
        offset += png.length;
    });
    return Buffer.concat([directory, ...frames.map(frame => frame.png)]);
}

async function verifyIco(ico) {
    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), sizes.length);
    let expectedOffset = 6 + sizes.length * 16;
    const report = [];
    for (let index = 0; index < sizes.length; index++) {
        const entry = 6 + index * 16;
        const size = ico[entry] || 256;
        const length = ico.readUInt32LE(entry + 8);
        const offset = ico.readUInt32LE(entry + 12);
        assert.equal(size, sizes[index]);
        assert.equal(ico[entry + 1] || 256, size);
        assert.equal(ico.readUInt16LE(entry + 6), 32);
        assert.equal(offset, expectedOffset);
        assert.ok(offset + length <= ico.length);
        const png = ico.subarray(offset, offset + length);
        assert.ok(png.subarray(0, 8).equals(pngSignature));
        const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, size);
        assert.equal(info.height, size);
        const colors = { blue: 0, black: 0, red: 0, transparent: 0 };
        for (let pixel = 0; pixel < data.length; pixel += 4) {
            const [r, g, b, a] = data.subarray(pixel, pixel + 4);
            if (a === 0) colors.transparent++;
            if (a < 200) continue;
            if (b > 130 && g > 75 && r < 75) colors.blue++;
            if (r < 75 && g < 75 && b < 75) colors.black++;
            if (r > 160 && g < 100 && b < 130) colors.red++;
        }
        assert.ok(Object.values(colors).every(count => count > 0), `Missing brand color/alpha at ${size}px`);
        report.push({ size, bytes: length, sha256: sha256(png), colors });
        expectedOffset += length;
    }
    assert.equal(expectedOffset, ico.length);
    return report;
}

async function preview(frames) {
    const width = 1160;
    const height = 600;
    const sheet = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="580" height="600" fill="#f1f3f5"/><rect x="580" width="580" height="600" fill="#17191d"/>
      <g font-family="Arial,sans-serif" font-size="18"><text x="36" y="38" fill="#111111">TikMnG / Brand v4 / Light desktop</text><text x="616" y="38" fill="#ffffff">TikMnG / Brand v4 / Dark desktop</text></g>
    </svg>`);
    const layers = [];
    for (const left of [36, 616]) {
        layers.push({ input: await sharp(path.join(assets, 'brand-v4.svg')).resize(280, 280).png().toBuffer(), left, top: 70 });
        let x = left;
        for (const size of [16, 20, 24, 32, 40, 48, 64, 96]) {
            layers.push({ input: frames.find(frame => frame.size === size).png, left: x, top: 390 + 96 - size });
            x += size + 20;
        }
        const labels = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="520" height="70"><g fill="${left === 36 ? '#111111' : '#ffffff'}" font-family="Arial,sans-serif" font-size="15"><text x="0" y="24">16 / 20 / 24 / 32 / 40 / 48 / 64 / 96 px (actual size)</text><text x="0" y="54">Blue m #009ed0 / Black N #111111 / Red g #ed2449</text></g></svg>`);
        layers.push({ input: labels, left, top: 508 });
    }
    await sharp(sheet).composite(layers).png().toFile(path.join(assets, 'brand-v4-preview.png'));
}

async function main() {
    const source = fs.readFileSync(path.join(assets, 'brand-v4.svg'));
    assert.ok(!/<(?:text|image)\b/i.test(source.toString()), 'Source must contain only local vector geometry');
    const preserved = ['brand-v3.svg', 'logo-v3.png', 'icon-v3.ico'].map(name => ({ name, sha256: sha256(fs.readFileSync(path.join(assets, name))) }));
    const frames = [];
    for (const size of sizes) {
        const png = await sharp(source, { density: 1152 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
        frames.push({ size, png });
    }
    await sharp(source, { density: 1152 }).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(path.join(assets, 'icon-v4.png'));
    const ico = encodeIco(frames);
    const verified = await verifyIco(ico);
    fs.writeFileSync(path.join(assets, 'icon-v4.ico'), ico);
    await preview(frames);
    for (const original of preserved) assert.equal(sha256(fs.readFileSync(path.join(assets, original.name))), original.sha256);
    const manifest = { source: 'brand-v4.svg', png: 'icon-v4.png', ico: 'icon-v4.ico', preview: 'brand-v4-preview.png', sha256: sha256(ico), frames: verified, preserved };
    fs.writeFileSync(path.join(assets, 'brand-v4-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({ ico: manifest.ico, png: manifest.png, sha256: manifest.sha256, sizes, preserved }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
