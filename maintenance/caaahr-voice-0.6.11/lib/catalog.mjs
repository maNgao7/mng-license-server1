import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

export const fold = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0131/g, 'i').replace(/[_\s-]+/g, ' ').trim();

export class GiftCatalog {
  constructor(root) { this.root = root; this.assets = path.join(root, 'public', 'assets'); this.gifts = []; this.byId = new Map(); }
  async load() {
    const merged = new Map();
    for (const file of [path.join(this.root, '.gift-catalog.json'), path.join(this.assets, 'gift-images', 'katalog_tam.json')]) {
      let entries;
      try { entries = JSON.parse(await readFile(file, 'utf8')); } catch { continue; }
      if (!Array.isArray(entries)) continue;
      for (const row of entries) {
        if (!row || typeof row !== 'object' || !row.id) continue;
        const id = String(row.id), previous = merged.get(id) || {};
        merged.set(id, { ...previous, ...row, tiktokIds: [...new Set([...(previous.tiktokIds || []), ...(Array.isArray(row.tiktokIds) ? row.tiktokIds.map(String) : []), id])] });
      }
    }
    for (const row of merged.values()) {
      const candidates = [row.image, row.file && `gift-images/${row.file}`, `gift-images/${row.id}.png`, 'gift-catalog/balon-hediyesi.png'];
      let image = '';
      for (const candidate of candidates) {
        if (typeof candidate !== 'string' || /^https?:/i.test(candidate)) continue;
        const relative = candidate.replace(/^\/catalog-assets\//, '').replace(/^\/?assets\//, '');
        const resolved = path.resolve(this.assets, relative);
        if (!resolved.startsWith(`${path.resolve(this.assets)}${path.sep}`)) continue;
        try { await access(resolved); image = `/catalog-assets/${relative.split(/[\\/]/).map(encodeURIComponent).join('/')}`; break; } catch {}
      }
      const gift = { id: String(row.id), name: String(row.trName || row.name || row.id), origName: String(row.name || ''), coins: Math.max(0, Number(row.coins) || 0), image, tiktokIds: row.tiktokIds };
      this.gifts.push(gift);
      for (const id of gift.tiktokIds) this.byId.set(String(id), gift);
    }
    this.gifts.sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));
    return this;
  }
  find(id, name,coins=0) {
    const known=this.byId.get(String(id||''));if(known)return known;
    const q=fold(name);if(!q)return undefined;
    const matches=this.gifts.filter(g=>(fold(g.name)===q||fold(g.origName)===q)&&(!coins||g.coins===coins));
    return matches.length===1?matches[0]:undefined;
  }
  search(query = '') {
    const q = fold(query).slice(0, 120);
    const alias = { gul: 'rose', cay: 'tea', donut: 'doughnut' }[q];
    return this.gifts.filter(g => !q || [g.id, g.name, g.origName, ...g.tiktokIds].some(v => fold(v).includes(q) || (alias && fold(v).includes(alias))));
  }
  enrich(event) {
    if (event.type !== 'gift') return event;
    const gift = this.find(event.giftId, event.giftName,event.coins);
    return gift ? { ...event, giftId: gift.id, giftName: gift.name, coins: gift.coins, giftImage: gift.image } : event;
  }
}
