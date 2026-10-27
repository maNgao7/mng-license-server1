'use strict';

const yauzl = require('yauzl');
const crypto = require('node:crypto');
const { safeRelativePath } = require('../lib/download.cjs');

function verifyArchive(file, { metadataOnly = false } = {}) {
    return new Promise((resolve, reject) => yauzl.open(file, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
        if (error) return reject(error);
        const files = new Map();
        let entries = 0, bytes = 0, marker = null;
        const fail = error => { zip.close(); reject(error); };
        zip.on('error', fail);
        zip.on('entry', entry => {
            try {
                safeRelativePath(entry.fileName.replace(/\/$/, ''));
                if (files.has(entry.fileName)) throw new Error('Duplicate archive entry: ' + entry.fileName);
            } catch (error) { fail(error); return; }
            entries++;
            if (metadataOnly || entry.fileName.endsWith('/')) {
                files.set(entry.fileName, { bytes: entry.uncompressedSize }); zip.readEntry(); return;
            }
            zip.openReadStream(entry, (error, stream) => {
                if (error) { fail(error); return; }
                const hash = crypto.createHash('sha256');
                let size = 0, text = '';
                stream.on('error', fail);
                stream.on('data', chunk => {
                    hash.update(chunk); size += chunk.length;
                    if (entry.fileName === '.tikmng-package.json' && text.length < 4096) text += chunk;
                });
                stream.on('end', () => {
                    if (size !== entry.uncompressedSize) { fail(new Error('Expanded size mismatch: ' + entry.fileName)); return; }
                    try { if (entry.fileName === '.tikmng-package.json') marker = JSON.parse(text); }
                    catch (error) { fail(error); return; }
                    bytes += size; files.set(entry.fileName, { bytes: size, sha256: hash.digest('hex') }); zip.readEntry();
                });
            });
        });
        zip.on('end', () => resolve({ entries, bytes, marker, files }));
        zip.readEntry();
    }));
}

module.exports = { verifyArchive };
if (require.main === module) (async () => {
    for (const file of process.argv.slice(2)) {
        const result = await verifyArchive(file);
        console.log(JSON.stringify({ file, entries: result.entries, bytes: result.bytes, marker: result.marker }));
    }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
