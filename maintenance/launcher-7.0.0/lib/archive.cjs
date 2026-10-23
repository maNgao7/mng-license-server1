'use strict';
const fs = require('node:fs');
const path = require('node:path');
const extract = require('extract-zip');

async function extractGameArchive(zip, destination) {
    const root = path.resolve(destination);
    fs.mkdirSync(root, { recursive: true });
    if (fs.readdirSync(root).length) throw new Error('Paket yalnızca boş bir geçici klasöre açılabilir.');
    let bytes = 0;
    let entries = 0;
    await extract(zip, { dir: root, onEntry(entry) {
        const name = entry.fileName.replace(/\\/g, '/');
        const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
        const resolved = path.resolve(root, name);
        if (name.includes('\0') || name.includes(':') || path.isAbsolute(name) || mode === 0xa000
            || (mode && ![0x4000, 0x8000].includes(mode))
            || !resolved.startsWith(root + path.sep)) throw new Error('Paket güvenli olmayan bir dosya yolu veya bağlantı içeriyor.');
        if (++entries > 100000 || (bytes += entry.uncompressedSize) > 12 * 1024 ** 3) throw new Error('Paket açılma sınırını aşıyor.');
    } });
}
module.exports = { extractGameArchive };
