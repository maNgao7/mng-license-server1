'use strict';
const fs = require('node:fs');
const path = require('node:path');

class WinStandings {
  constructor(file, report = () => {}) {
    this.file = file;
    this.report = report;
    this.rows = new Map();
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved.version === 1 && Array.isArray(saved.rows)) {
        for (const row of saved.rows) {
          if (typeof row?.id === 'string' && typeof row.label === 'string' &&
              Number.isSafeInteger(row.wins) && row.wins > 0) this.rows.set(row.id, row);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') report('Galibiyet kaydı okunamadı.');
    }
    this.refresh();
  }
  refresh() {
    this.top = [...this.rows.values()].sort((a,b) => b.wins-a.wins || a.label.localeCompare(b.label,'tr')).slice(0,5);
  }
  persist(rows) {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    fs.writeFileSync(this.file+'.tmp', JSON.stringify({version:1, rows}));
    fs.renameSync(this.file+'.tmp', this.file);
  }
  reset() {
    this.persist([]);
    this.rows.clear();
    this.refresh();
  }
  record(fighter) {
    const handle = fighter.uniqueId?.replace(/^@/,'').toLowerCase();
    const alias = handle && '@'+handle;
    const id = fighter.userId || alias || fighter.id;
    const label = alias || fighter.nickname || String(id);
    const wins = 1 + (this.rows.get(id)?.wins || 0) + (alias && alias !== id ? this.rows.get(alias)?.wins || 0 : 0);
    if (alias && alias !== id) this.rows.delete(alias);
    this.rows.set(id,{id,label,wins});
    this.refresh();
    try {
      this.persist([...this.rows.values()]);
    } catch { this.report('Galibiyet sıralaması diske kaydedilemedi.'); }
    return wins;
  }
}
module.exports = { WinStandings };
