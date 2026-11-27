'use strict';

function normalizeRows(rows, previous = []) {
    if (!Array.isArray(rows) || rows.length > 5000) throw new Error('Siralama listesi gecersiz.');
    const known = new Map(previous.map(row => [row.username, row])), result = [], names = new Set();
    for (const input of rows) {
        const username = String(input.username || '').replace(/^@/, '').trim().toLowerCase();
        const count = Number(input.count);
        if (!/^[a-z0-9._]{1,65}$/.test(username) || !Number.isSafeInteger(count) || count < 1 || count > 1e12 || names.has(username)) throw new Error('Kullanici adi veya hediye adedi gecersiz.');
        names.add(username);
        result.push({ username, nickname: String(input.nickname || known.get(username)?.nickname || username).slice(0, 100),
            avatar: known.get(username)?.avatar || '', count, updatedAt: known.get(username)?.updatedAt || Date.now() });
    }
    return result;
}

function ingestRanking(data, item, giftId) {
    if (!giftId || String(item.giftId) !== giftId || !item.username || item.type !== 'gift') return false;
    if (Number(item.giftType) === 1 && item.repeatEnd !== true && item.repeatEnd !== 1) return false;
    const receipt = String(item.id || '');
    if (!receipt || (data.raconReceipts || []).includes(receipt)) return false;
    const username = String(item.username).replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,65}$/.test(username)) return false;
    const count = Math.max(1, Math.min(1000000, Math.floor(Number(item.count) || 1)));
    data.raconRanking ||= [];
    let row = data.raconRanking.find(row => row.username === username);
    if (!row) {
        if (data.raconRanking.length >= 5000) return false;
        row = { username, count: 0 }; data.raconRanking.push(row);
    }
    Object.assign(row, { nickname: String(item.nickname || username).slice(0, 100), avatar: item.avatar || row.avatar || '',
        count: Math.min(1e12, row.count + count), updatedAt: Number(item.createdAt) || Date.now() });
    data.raconReceipts = [...(data.raconReceipts || []), receipt].slice(-2048);
    return true;
}

function ranked(rows) { return [...(rows || [])].sort((a, b) => b.count - a.count || a.updatedAt - b.updatedAt || a.username.localeCompare(b.username)); }
function mergeRows(editedRows, baseRows, currentRows = []) {
    const edited = normalizeRows(editedRows, currentRows), base = normalizeRows(baseRows, currentRows);
    const result = new Map(currentRows.map(row => [row.username, { ...row }]));
    const previous = new Map(base.map(row => [row.username, row]));
    const wanted = new Set(edited.map(row => row.username));
    for (const row of base) if (!wanted.has(row.username)) result.delete(row.username);
    // Apply manual count changes as deltas so gifts received while editing survive.
    for (const row of edited) {
        const old = previous.get(row.username), live = result.get(row.username);
        if (old && !live) throw new Error('Havuz değişti. Ayarları yeniden açın.');
        const count = Math.min(1e12, (live?.count || 0) + row.count - (old?.count || 0));
        if (count < 1) throw new Error('X adedi en az 1 olmalı. Kişiyi kaldırmak için sil düğmesini kullanın.');
        result.set(row.username, { ...(live || row), count });
    }
    return normalizeRows([...result.values()], currentRows);
}
module.exports = { normalizeRows, ingestRanking, ranked, mergeRows };
