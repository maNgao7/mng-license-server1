'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { hashFile } = require('./download.cjs');

const MEDIA = /\.(mp4|webm|mp3|wav|ogg)$/i;
const LIMIT = 1000;

function within(root, file) {
    const relative = path.relative(root, file);
    return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}

function displayText(value, max, field) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
        throw new Error(`Arşivdeki ${field} geçersiz.`);
    }
    return value;
}

async function readMediaArchive(folder, onProgress = () => {}) {
    const root = await fs.promises.realpath(folder);
    const manifest = path.join(root, 'manifest.json');
    const files = [];
    if (fs.existsSync(manifest)) {
        const stat = await fs.promises.stat(manifest);
        if (stat.size > 4 * 1024 * 1024) throw new Error('Arşiv listesi çok büyük.');
        const entries = JSON.parse((await fs.promises.readFile(manifest, 'utf8')).replace(/^\uFEFF/, ''));
        if (!Array.isArray(entries) || entries.length > LIMIT) throw new Error('Arşiv listesi okunamadı.');
        const seen = new Set();
        for (const entry of entries) {
            if (!entry || typeof entry.relativePath !== 'string' || !MEDIA.test(entry.relativePath)
                || entry.relativePath.includes('\\') || entry.relativePath.includes(':')
                || entry.relativePath.split('/').some(part => !part || part === '.' || part === '..')) {
                throw new Error('Arşivde güvenli olmayan bir dosya yolu var.');
            }
            const file = path.resolve(root, entry.relativePath);
            const real = await fs.promises.realpath(file);
            if (!within(root, file) || !within(root, real)) throw new Error('Medya arşiv klasörünün dışında.');
            const key = process.platform === 'win32' ? real.toLowerCase() : real;
            if (seen.has(key)) throw new Error('Arşivde aynı dosya birden fazla kez listelenmiş.');
            seen.add(key);
            const title = displayText(entry.title, 160, 'video adı');
            const category = displayText(entry.category, 80, 'kategori');
            const info = await fs.promises.stat(real);
            if (!info.isFile() || !Number.isSafeInteger(entry.bytes) || info.size !== entry.bytes
                || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
                throw new Error(`Arşiv dosyası eksik veya değişmiş: ${title}`);
            }
            if ((await hashFile(real)).toLowerCase() !== entry.sha256.toLowerCase()) {
                throw new Error(`Arşiv dosyası doğrulanamadı: ${title}`);
            }
            files.push({ path: real, title, category });
            onProgress({ phase: 'verifying', completed: files.length, total: entries.length });
        }
    } else {
        async function scan(directory, depth = 0) {
            if (depth > 6) throw new Error('Arşiv klasörleri çok iç içe.');
            for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
                if (entry.isSymbolicLink()) continue;
                if (entry.isDirectory()) await scan(path.join(directory, entry.name), depth + 1);
                else if (entry.isFile() && MEDIA.test(entry.name)) {
                    if (files.length >= LIMIT) throw new Error('Arşiv çok büyük; bir kategori klasörü seçin.');
                    files.push({ path: path.join(directory, entry.name),
                        title: displayText(path.basename(entry.name, path.extname(entry.name)), 160, 'video adı'),
                        category: displayText(path.basename(directory), 80, 'kategori') });
                }
            }
        }
        await scan(root);
    }
    return files;
}

module.exports = { readMediaArchive };
