'use strict';
const fs = require('node:fs');
const path = require('node:path');
const fold = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
function loadCatalog(directory) {
    const rows = JSON.parse(fs.readFileSync(path.join(directory, 'katalog_tam.json'), 'utf8'));
    if (!Array.isArray(rows)) throw new Error('catalog-schema');
    const seen = new Set();
    const entries = rows.map(row => {
        const id = String(row.id), file = String(row.file || `${id}.png`);
        if (!/^\d{1,20}$/.test(id) || seen.has(id) || !/^\d{1,20}\.png$/.test(file)) throw new Error('catalog-entry');
        seen.add(id);
        const fullPath = path.join(directory, file);
        if (!fs.statSync(fullPath).isFile()) throw new Error('catalog-image');
        return { item: { id, name: String(row.trName || row.name), coins: Number(row.coins) || 0, image: `/gift/${id}.png` },
            file: fullPath, search: fold([id, row.name, row.trName].join(' ')) };
    });
    const files = new Map(entries.map(entry => [entry.item.id, entry.file]));
    return { file: id => files.get(id), query(search = '', offset = 0, limit = 60) {
        const needle = fold(search);
        const matches = entries.filter(entry => entry.search.includes(needle));
        return { items: matches.slice(offset, offset + limit).map(entry => entry.item), total: matches.length };
    } };
}
module.exports = { loadCatalog };
