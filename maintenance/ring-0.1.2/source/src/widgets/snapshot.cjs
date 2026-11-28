'use strict';

const kinds = ['fighters', 'queue', 'winners'];
const catalog = require('../../assets/gift-catalog.json');
const gifts = new Map(catalog.filter(gift => /^\d+$/.test(gift.id) && gift.file === gift.id + '.png')
  .map(({ id, name }) => [id, { id, name }]));
const text = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
// Keep the shared portrait engine's CDN families, plus the existing tiktokv host.
const portraitHosts = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokcdn-in.com', 'tiktokv.com', 'byteoversea.com',
  'ibytedtos.com', 'ibyteimg.com', 'muscdn.com', 'pstatp.com', 'douyinpic.com', 'douyincdn.com'];

function publicPortraits(person, resolvePortrait) {
  const alternatives = Array.isArray(person.profilePictureUrls) ? person.profilePictureUrls.slice(0, 8) : [];
  const portraits = [];
  for (const value of [person.portrait, person.profilePictureUrl, ...alternatives]) {
    if (typeof value === 'string' && value.startsWith('file:')) {
      const cached = resolvePortrait(value);
      if (cached) portraits.push(cached);
      continue;
    }
    if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('https://')) continue;
    let url;
    try { url = new URL(value); } catch { continue; }
    if (!url.username && !url.password && !url.port &&
        portraitHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) portraits.push(url.href);
  }
  return [...new Set(portraits)];
}

function profile(person, resolvePortrait) {
  if (!person) return null;
  const handle = text(person.uniqueId).replace(/^@+/, '');
  const name = text(person.nickname) || (handle && '@' + handle);
  if (!name) return null;
  const portraits = publicPortraits(person, resolvePortrait);
  return { name, handle, portrait: portraits[0] || '', portraitAlternatives: portraits.slice(1) };
}

// Accept the main process snapshot. Build new objects so private fields and later
// mutations of the game's objects cannot appear on a browser source.
function widgetSnapshot(state, resolvePortrait = () => '') {
  const audience = state?.audience;
  const fighters = ['left', 'right'].map((side, index) => {
    const fighter = profile(audience?.active?.[side], resolvePortrait);
    const ratio = state?.spectator?.health?.[index];
    const hp = Number.isFinite(ratio) && ratio >= 0 && ratio <= 1
      ? Math.round(100 * ratio) : null;
    const settings = audience?.settings;
    const giftId = (side === 'left' ? settings?.punchGiftIdLeft : settings?.punchGiftIdRight) || settings?.punchGiftId;
    return { side, fighter, hp: fighter ? hp : null, gift: gifts.get(String(giftId)) || null };
  });
  const queue = Array.isArray(audience?.queue) ? audience.queue : [];
  const queueRows = queue.slice(0, 10).flatMap(person => {
    const identity = profile(person, resolvePortrait);
    return identity ? [{ ...identity, coins: count(person.fps??person.coins) }] : [];
  });
  const standings = Array.isArray(state?.standings) ? state.standings : [];
  const rows = standings.slice(0, 5).filter(row => text(row?.label) && count(row.wins))
    .map(row => ({ name: text(row.label), wins: row.wins }));
  const champion = profile(state?.celebration?.fighter, resolvePortrait);
  return {
    fighters: { rows: fighters },
    queue: { rows: queueRows, total: queue.length },
    winners: { rows, champion: champion ? { ...champion, wins: count(state.celebration.wins) } : null }
  };
}

module.exports = { kinds, gifts, portraitHosts, widgetSnapshot };
