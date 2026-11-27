'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assertSafePath } = require('./download.cjs');

const required = [
    'Rezervuar.exe', 'live-runtime/node.exe', 'live-runtime/bridge.cjs',
    'live-runtime/lib/server.cjs', 'live-runtime/gift-assets/katalog_tam.json'
];

function validatePackageDirectory(directory) {
    try {
        return required.every(relative => {
            const entry = fs.statSync(assertSafePath(path.join(directory, relative)));
            return entry.isFile() && entry.size > 0;
        });
    } catch { return false; }
}

module.exports = { validatePackageDirectory };
