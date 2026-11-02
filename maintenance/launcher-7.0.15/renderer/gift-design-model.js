(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TikMNGGiftDesign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const layouts = {
    classic: { name: 'Klasik (Üst + Sol + Sağ)', regions: ['top', 'left', 'right'] },
    'top-only': { name: 'Sadece Üst', regions: ['top'] },
    'side-only': { name: 'Sadece Yan', regions: ['left'] },
    'both-sides': { name: 'İki Yan', regions: ['left', 'right'] },
    'double-side': { name: 'Çift Sütun Yan', regions: ['left', 'left-secondary'] },
    'double-top': { name: 'Çift Satır Üst', regions: ['top', 'top-secondary'] }
  };
  const fonts = ['Luckiest Guy', 'Arial', 'Helvetica', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Impact'];
  const ranges = { giftSize: [25, 250], giftGap: [5, 200], textGap: [-100, 100], lineGap: [-20, 20], fontSize: [6, 72], strokeWidth: [0, 20], autoBlur: [0, 20] };
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const defaults = () => ({ giftSize: 75, giftGap: 40, textGap: -10, lineGap: -5, fontSize: 24, fontFamily: 'Luckiest Guy', textColor: '#ffffff', strokeColor: '#000000', strokeWidth: 3, autoBlur: 0, grayscale: false });
  function normalizeDesign(raw = {}) {
    const settings = defaults(), input = raw.settings || {};
    for (const [key, [min, max]] of Object.entries(ranges)) settings[key] = number(input[key], settings[key], min, max);
    settings.fontFamily = fonts.includes(input.fontFamily) ? input.fontFamily : settings.fontFamily;
    settings.textColor = color(input.textColor, settings.textColor);
    settings.strokeColor = color(input.strokeColor, settings.strokeColor);
    settings.grayscale = input.grayscale === true;
    const seen = new Set();
    return {
      version: 1, id: String(raw.id || id()).slice(0, 100), name: String(raw.name || '').slice(0, 120),
      updatedAt: Number(raw.updatedAt) || Date.now(), layout: layouts[raw.layout] ? raw.layout : 'classic', settings,
      items: (Array.isArray(raw.items) ? raw.items : []).slice(0, 100).map(item => {
        let uid = String(item.uid || id()).slice(0, 100);
        if (seen.has(uid)) uid = id();
        seen.add(uid);
        return { uid, region: ['top', 'top-secondary', 'left', 'left-secondary', 'right'].includes(item.region) ? item.region : 'top',
          giftId: String(item.giftId || '').slice(0, 40),
          lines: (Array.isArray(item.lines) && item.lines.length ? item.lines : [{ text: '' }]).slice(0, 6).map(line => ({ text: String(line.text || '').slice(0, 400), textColor: color(line.textColor, null), strokeColor: color(line.strokeColor, null) })) };
      })
    };
  }
  function migrateLegacyV605(records) {
    return (Array.isArray(records) ? records : []).map(old => {
      const s = old.settings || {};
      return normalizeDesign({ ...old, layout: ({ top: 'top-only', sides: 'both-sides' })[s.layoutType] || 'classic',
        settings: { ...s, fontFamily: fonts.includes(s.fontFamily) ? s.fontFamily : 'Arial', fontSize: s.textSize, autoBlur: s.shadowBlur },
        items: (old.items || []).map(item => ({ uid: item.uid, region: item.region, giftId: item.gift?.id,
          lines: [{ text: item.gift?.name || '' }, { text: `${Number(item.gift?.coins) || 0} coin`, textColor: '#ffd84d' }, ...(item.caption ? [{ text: item.caption, textColor: item.captionColor }] : [])] })) });
    });
  }
  function layoutDesign(raw, measure = (text, size) => Array.from(text).length * size * 0.65) {
    const design = normalizeDesign(raw), s = design.settings;
    const pad = Math.ceil(s.strokeWidth + s.autoBlur * 2 + 8);
    const groups = Object.fromEntries(layouts[design.layout].regions.map(region => [region, []]));
    for (const item of design.items) {
      if (!groups[item.region]) continue;
      const lines = item.lines.filter(line => line.text.trim());
      const width = Math.max(s.giftSize, ...lines.map(line => Math.min(600, measure(line.text, s.fontSize, s.fontFamily))));
      const lineHeight = s.fontSize * 1.25, step = Math.max(2, lineHeight + s.lineGap);
      const textY = s.giftSize + s.textGap;
      const top = Math.min(0, lines.length ? textY : 0);
      const height = Math.max(s.giftSize, lines.length ? textY + (lines.length - 1) * step + lineHeight : 0) - top;
      groups[item.region].push({ ...item, width: width + pad * 2, height: height + pad * 2,
        image: { x: (width - s.giftSize) / 2 + pad, y: pad - top, width: s.giftSize, height: s.giftSize },
        lines: lines.map((line, index) => ({ ...line, x: width / 2 + pad, y: textY + index * step - top + pad, maxWidth: width, fontSize: s.fontSize })) });
    }
    const rowWidth = items => items.reduce((sum, item) => sum + item.width, 0) + Math.max(0, items.length - 1) * s.giftGap;
    const columnHeight = items => items.reduce((sum, item) => sum + item.height, 0) + Math.max(0, items.length - 1) * s.giftGap;
    const columnWidth = items => Math.max(0, ...items.map(item => item.width));
    const topHeight = groups.top?.length ? Math.max(...groups.top.map(item => item.height)) : 0;
    const secondaryHeight = groups['top-secondary']?.length ? Math.max(...groups['top-secondary'].map(item => item.height)) : 0;
    const leftWidth = columnWidth(groups.left || []), rightWidth = columnWidth(groups.right || []), secondWidth = columnWidth(groups['left-secondary'] || []);
    const width = Math.ceil(Math.max(1080, rowWidth(groups.top || []), rowWidth(groups['top-secondary'] || []), leftWidth + rightWidth + secondWidth + s.giftGap * 2 + 400));
    const sideY = topHeight ? topHeight + s.giftGap : 0;
    const height = Math.ceil(Math.max(200, topHeight + secondaryHeight + (secondaryHeight && topHeight ? s.giftGap : 0), sideY + Math.max(columnHeight(groups.left || []), columnHeight(groups.right || []), columnHeight(groups['left-secondary'] || []))));
    if (width > 8192 || height > 8192 || width * height > 33554432) throw new Error('Tasarım çok büyük. Hediye boyutunu, mesafeyi veya hediye sayısını azaltın.');
    const items = [];
    for (const [region, group] of Object.entries(groups)) {
      const horizontal = region.startsWith('top');
      let cursor = horizontal ? 0 : sideY;
      for (const item of group) {
        const x = horizontal ? cursor : region === 'right' ? width - rightWidth + (rightWidth - item.width) / 2 : region === 'left-secondary' ? leftWidth + s.giftGap + (secondWidth - item.width) / 2 : (leftWidth - item.width) / 2;
        const y = horizontal ? region === 'top-secondary' ? topHeight + (topHeight ? s.giftGap : 0) : 0 : cursor;
        items.push({ ...item, x, y });
        cursor += (horizontal ? item.width : item.height) + s.giftGap;
      }
    }
    return { width, height, items };
  }
  function filename(name) {
    const value = String(name || 'TikMnG Hediye Tasarımı').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 100) || 'TikMnG';
    return (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value) ? 'TikMnG-' : '') + value + '.png';
  }
  return { defaults, normalizeDesign, activeRegions: layout => (layouts[layout] || layouts.classic).regions.slice(), layoutDesign, migrateLegacyV605, filename, layouts, fonts, ranges, id };
});
