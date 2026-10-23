(() => {
  'use strict';
  const $ = id => document.getElementById(id), M = window.TikMNGGiftDesign;
  const KEY = 'tikmng-gift-designs-v1', LEGACY = 'mng-gift-designs-v605';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const icon = name => `<i data-lucide="${name}"></i>`;
  const icons = () => window.lucide?.createIcons();
  const names = { top: 'Üst Alan', 'top-secondary': 'İkinci Üst Alan', left: 'Sol Alan', 'left-secondary': 'İkinci Sol Sütun', right: 'Sağ Alan' };
  const labels = { giftSize: 'Hediye boyutu', giftGap: 'Hediye mesafesi', textGap: 'Yazı mesafesi', lineGap: 'Satır arası', fontSize: 'Yazı boyutu', strokeWidth: 'Kontur kalınlığı', autoBlur: 'Oto blur' };
  const regionIcons = { top: 'panel-top', 'top-secondary': 'rows-2', left: 'panel-left', 'left-secondary': 'columns-2', right: 'panel-right' };
  const state = { design: M.normalizeDesign(), catalog: [], byId: new Map(), images: new Map(), dirty: false, savedPage: 0, pick: null, line: null, revision: 0, dragging: null, storageReady: true };
  const canvas = $('designCanvas'), ctx = canvas.getContext('2d');
  const imageUrl = gift => 'gift-assets/' + encodeURIComponent(gift.file);
  function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function changed() { state.dirty = true; $('saveState').textContent = 'Kaydedilmemiş değişiklikler'; $('saveState').dataset.state = 'dirty'; draw(); }
  function readSaved() {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) throw new Error('Kayıt biçimi okunamadı. Mevcut kayıtlar korunuyor.');
      return records.map(M.normalizeDesign);
    }
    const old = localStorage.getItem(LEGACY);
    if (!old) return [];
    const legacy = JSON.parse(old);
    if (!Array.isArray(legacy)) throw new Error('Eski tasarımlar okunamadı. Mevcut kayıtlar korunuyor.');
    const records = M.migrateLegacyV605(legacy);
    localStorage.setItem(KEY, JSON.stringify(records));
    return records;
  }
  function writeSaved(records) {
    if (!state.storageReady) throw new Error('Kayıt alanına erişilemiyor. PNG indirebilirsiniz; mevcut kayıtlar değiştirilmedi.');
    localStorage.setItem(KEY, JSON.stringify(records));
  }
  async function confirmAction(text, actionLabel = 'Devam et') {
    $('confirmMessage').textContent = text;
    $('confirmAccept').textContent = actionLabel;
    const dialog = $('confirmModal');
    dialog.showModal();
    return new Promise(resolve => {
      function finish(value) { dialog.close(); dialog.removeEventListener('cancel', cancel); $('confirmAccept').onclick = null; $('confirmCancel').onclick = null; resolve(value); }
      function cancel(event) { event.preventDefault(); finish(false); }
      $('confirmAccept').onclick = () => finish(true);
      $('confirmCancel').onclick = () => finish(false);
      dialog.addEventListener('cancel', cancel);
    });
  }
  async function discard() { return !state.dirty || confirmAction('Kaydetmediğiniz değişiklikler var. Kaydetmeden devam edilsin mi?'); }
  function syncControls() {
    $('designName').value = state.design.name;
    $('layoutType').value = state.design.layout;
    for (const [key, value] of Object.entries(state.design.settings)) {
      if ($(key).type === 'checkbox') $(key).checked = value;
      else $(key).value = value;
    }
    $('editorTitle').textContent = state.design.name || 'Yeni Hediye Tasarımı';
    $('saveState').textContent = state.dirty ? 'Kaydedilmemiş değişiklikler' : '';
    $('saveState').dataset.state = state.dirty ? 'dirty' : 'saved';
    renderZones(); draw();
  }
  function renderZones() {
    $('zones').innerHTML = M.activeRegions(state.design.layout).map(region => {
      const items = state.design.items.filter(item => item.region === region);
      return `<section class="zone" data-zone="${region}"><div class="zone-header"><h2>${icon(regionIcons[region])}${names[region]}</h2><small>${items.length} hediye</small></div><div class="zone-list">${items.map(itemMarkup).join('') || '<p class="zone-empty">Henüz hediye yok</p>'}</div><button class="zone-add" data-add="${region}">${icon('plus')}Yeni hediye ekle</button></section>`;
    }).join('');
    icons();
  }
  function itemMarkup(item) {
    const gift = state.byId.get(item.giftId);
    return `<article class="zone-item" data-uid="${esc(item.uid)}"><div class="item-head"><button class="icon drag-handle" draggable="true" title="Sürükleyerek sırala" aria-label="Sürükleyerek sırala">${icon('grip-vertical')}</button><button class="gift-pick" data-pick="${esc(item.uid)}" title="Hediyeyi değiştir">${gift ? `<img src="${imageUrl(gift)}" alt=""><span><b>${esc(gift.name)}</b><small>${gift.coins.toLocaleString('tr-TR')} coin</small></span>` : '<span>Hediye seç</span>'}</button><button class="icon" data-move="-1" title="Yukarı taşı" aria-label="Yukarı taşı">${icon('chevron-up')}</button><button class="icon" data-move="1" title="Aşağı taşı" aria-label="Aşağı taşı">${icon('chevron-down')}</button><button class="icon danger" data-remove="${esc(item.uid)}" title="Hediyeyi sil" aria-label="Hediyeyi sil">${icon('trash-2')}</button></div>${item.lines.map((line, index) => `<div class="caption-row"><input data-caption="${index}" aria-label="${esc(gift?.name || 'Hediye')} ${index + 1}. satır" maxlength="400" value="${esc(line.text)}" placeholder="${index ? 'Yeni satır giriniz' : 'Yazı gir...'}"><button class="icon" data-color="${index}" title="Renk ayarları" aria-label="${index + 1}. satır renkleri">${icon('palette')}</button>${index === 0 ? `<button class="icon" data-add-line ${item.lines.length >= 6 ? 'disabled' : ''} title="Yeni satır ekle" aria-label="Yeni satır ekle">${icon('plus')}</button>` : `<button class="icon" data-remove-line="${index}" title="Satırı kaldır" aria-label="Satırı kaldır">${icon('x')}</button>`}</div>`).join('')}</article>`;
  }
  function moveItem(uid, direction) {
    const item = state.design.items.find(entry => entry.uid === uid);
    const siblings = state.design.items.filter(entry => entry.region === item.region);
    const index = siblings.indexOf(item), target = siblings[index + direction];
    if (!target) return;
    const from = state.design.items.indexOf(item), to = state.design.items.indexOf(target);
    [state.design.items[from], state.design.items[to]] = [state.design.items[to], state.design.items[from]];
    changed(); renderZones();
  }
  function filterCatalog() {
    const query = $('giftSearch').value.trim().toLocaleLowerCase('tr-TR');
    const gifts = state.catalog.filter(gift => [gift.name, gift.originalName, gift.id, gift.coins].some(value => String(value).toLocaleLowerCase('tr-TR').includes(query)));
    $('catalogCount').textContent = `${gifts.length} / ${state.catalog.length} hediye`;
    const currentGift = state.design.items.find(item => item.uid === state.pick?.uid)?.giftId;
    $('giftGrid').innerHTML = gifts.map(gift => `<button class="gift-card" data-gift="${esc(gift.id)}"${gift.id === currentGift ? ' aria-current="true"' : ''}>${gift.id === currentGift ? `<span class="gift-selected" aria-hidden="true">${icon('circle-check')}</span>` : ''}<img loading="lazy" src="${imageUrl(gift)}" alt=""><strong>${esc(gift.name)}</strong><small>${gift.coins.toLocaleString('tr-TR')} coin</small></button>`).join('') || '<p class="saved-empty">Hediye bulunamadı.</p>';
    icons();
    $('giftGrid').scrollTop = 0;
  }
  function openCatalog(region, uid = '') {
    if (!state.catalog.length) { message('Hediye kataloğu yüklenemedi. Sayfayı yeniden açın.', true); return; }
    if (!uid && state.design.items.length >= 100) { message('En fazla 100 hediye eklenebilir.', true); return; }
    state.pick = { region, uid };
    $('giftSearch').value = ''; filterCatalog(); $('catalogModal').showModal(); $('giftSearch').focus();
  }
  function loadImage(gift) {
    const url = imageUrl(gift);
    if (!state.images.has(url)) state.images.set(url, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => { state.images.delete(url); reject(new Error(`${gift.name} görseli yüklenemedi.`)); };
      image.src = url;
    }));
    return state.images.get(url);
  }
  async function paint(target, document) {
    const design = M.normalizeDesign(document), s = design.settings;
    await window.document.fonts.load(`400 ${s.fontSize}px "${s.fontFamily}"`);
    const active = design.items.filter(item => M.activeRegions(design.layout).includes(item.region));
    const images = new Map(await Promise.all(active.map(async item => {
      const gift = state.byId.get(item.giftId);
      if (!gift) throw new Error(`Hediye katalogda bulunamadı: ${item.giftId}`);
      return [item.uid, await loadImage(gift)];
    })));
    const measureCtx = window.document.createElement('canvas').getContext('2d');
    const layout = M.layoutDesign(design, (text, size, font) => { measureCtx.font = `400 ${size}px "${font}"`; return measureCtx.measureText(text).width; });
    target.width = layout.width; target.height = layout.height;
    const context = target.getContext('2d');
    for (const item of layout.items) {
      context.save(); context.translate(item.x, item.y);
      const img = images.get(item.uid), box = item.image;
      const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      context.filter = s.grayscale ? 'grayscale(1)' : 'none';
      context.drawImage(img, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h);
      context.filter = 'none'; context.textAlign = 'center'; context.textBaseline = 'top'; context.lineJoin = 'round';
      context.font = `400 ${s.fontSize}px "${s.fontFamily}"`;
      context.lineWidth = s.strokeWidth * 2;
      context.shadowColor = s.strokeColor; context.shadowBlur = s.autoBlur;
      for (const line of item.lines) {
        context.strokeStyle = line.strokeColor || s.strokeColor; context.fillStyle = line.textColor || s.textColor;
        if (s.strokeWidth) context.strokeText(line.text, line.x, line.y, line.maxWidth);
        context.fillText(line.text, line.x, line.y, line.maxWidth);
      }
      context.restore();
    }
    return layout;
  }
  async function draw() {
    const revision = ++state.revision;
    try {
      const offscreen = document.createElement('canvas'), layout = await paint(offscreen, state.design);
      if (revision !== state.revision) return;
      canvas.width = layout.width; canvas.height = layout.height; ctx.drawImage(offscreen, 0, 0);
      $('canvasSize').textContent = `${layout.width} × ${layout.height} px`;
      $('emptyPreview').hidden = layout.items.length > 0;
    } catch (error) { if (revision === state.revision) message(error.message, true); }
  }
  async function downloadDesign(design, button) {
    if (!design.name.trim()) { message('Önce tasarım adını girin.', true); $('designName').focus(); return; }
    if (!design.items.some(item => M.activeRegions(design.layout).includes(item.region))) { message('Görünen alanlardan birine hediye ekleyin.', true); return; }
    button.disabled = true;
    try {
      const output = document.createElement('canvas'); await paint(output, design);
      const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG oluşturulamadı.');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.download = M.filename(design.name); link.href = url; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      message('Şeffaf PNG hazırlandı.');
    } catch (error) { message(error.message, true); } finally { button.disabled = false; }
  }
  function saveDesign() {
    if (!state.design.name.trim()) { message('Tasarım adını girin.', true); $('designName').focus(); return; }
    try {
      const document = M.normalizeDesign({ ...state.design, name: state.design.name.trim(), updatedAt: Date.now() });
      const records = readSaved();
      writeSaved([document, ...records.filter(record => record.id !== document.id)]);
      state.design = document; state.dirty = false; $('saveState').textContent = 'Kaydedildi'; $('saveState').dataset.state = 'saved';
      message('Tasarım kaydedildi.'); $('editorTitle').textContent = document.name;
    } catch (error) { message('Kaydedilemedi: ' + error.message, true); }
  }
  function renderSaved() {
    try {
      const records = readSaved(), query = $('savedSearch').value.trim().toLocaleLowerCase('tr-TR');
      const filtered = records.filter(record => record.name.toLocaleLowerCase('tr-TR').includes(query)).sort((a, b) => b.updatedAt - a.updatedAt);
      const pages = Math.max(1, Math.ceil(filtered.length / 20)); state.savedPage = Math.min(state.savedPage, pages - 1);
      $('savedCount').textContent = `${records.length} tasarım`;
      $('savedList').innerHTML = filtered.slice(state.savedPage * 20, (state.savedPage + 1) * 20).map(record => `<article class="saved-item"><div><b>${esc(record.name)}</b><small>${esc(M.layouts[record.layout].name)} · ${record.items.length} hediye · ${new Date(record.updatedAt).toLocaleString('tr-TR')}</small></div><button data-saved-download="${esc(record.id)}">${icon('download')}İndir</button><button data-edit="${esc(record.id)}">${icon('pencil')}Düzenle</button><button class="icon danger" data-delete="${esc(record.id)}" title="Tasarımı sil" aria-label="${esc(record.name)} tasarımını sil">${icon('trash-2')}</button></article>`).join('') || '<p class="saved-empty">Tasarım bulunamadı.</p>';
      $('savedPages').innerHTML = `<button class="icon" data-page="-1" ${state.savedPage === 0 ? 'disabled' : ''} title="Önceki sayfa" aria-label="Önceki sayfa">${icon('chevron-left')}</button><span>${state.savedPage + 1} / ${pages} · ${filtered.length} tasarım</span><button class="icon" data-page="1" ${state.savedPage === pages - 1 ? 'disabled' : ''} title="Sonraki sayfa" aria-label="Sonraki sayfa">${icon('chevron-right')}</button>`; icons();
    } catch (error) { message(error.message, true); }
  }
  $('layoutType').innerHTML = Object.entries(M.layouts).map(([key, value]) => `<option value="${key}">${value.name}</option>`).join('');
  $('fontFamily').innerHTML = M.fonts.map(font => `<option>${font}</option>`).join('');
  $('numericFields').innerHTML = Object.entries(M.ranges).map(([key, [min, max]]) => `<label>${labels[key]}<span class="stepper"><button data-step="${key}" data-delta="-1" title="${labels[key]} azalt" aria-label="${labels[key]} azalt">${icon('minus')}</button><input id="${key}" type="number" min="${min}" max="${max}" step="1" aria-label="${labels[key]}"><button data-step="${key}" data-delta="1" title="${labels[key]} artır" aria-label="${labels[key]} artır">${icon('plus')}</button></span></label>`).join('');
  $('designName').oninput = () => { state.design.name = $('designName').value; $('editorTitle').textContent = state.design.name || 'Yeni Hediye Tasarımı'; changed(); };
  $('layoutType').onchange = () => { state.design.layout = $('layoutType').value; renderZones(); changed(); };
  for (const key of Object.keys(M.defaults())) {
    $(key).addEventListener('input', () => {
      if ($(key).type === 'number' && $(key).value === '') return;
      state.design.settings[key] = $(key).type === 'checkbox' ? $(key).checked : $(key).value;
      state.design.settings = M.normalizeDesign(state.design).settings; changed();
    });
    $(key).addEventListener('change', () => { if ($(key).type !== 'checkbox') $(key).value = state.design.settings[key]; });
  }
  $('numericFields').onclick = event => {
    const button = event.target.closest('[data-step]'); if (!button) return;
    const input = $(button.dataset.step); input.value = Number(state.design.settings[input.id]) + Number(button.dataset.delta);
    input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('change'));
  };
  $('zones').oninput = event => {
    if (!event.target.matches('[data-caption]')) return;
    const item = state.design.items.find(entry => entry.uid === event.target.closest('[data-uid]').dataset.uid);
    item.lines[Number(event.target.dataset.caption)].text = event.target.value; changed();
  };
  $('zones').onclick = event => {
    const button = event.target.closest('button'); if (!button) return;
    const uid = button.closest('[data-uid]')?.dataset.uid, item = state.design.items.find(entry => entry.uid === uid);
    if (button.hasAttribute('data-add')) return openCatalog(button.dataset.add);
    if (button.hasAttribute('data-pick')) return openCatalog(item.region, uid);
    if (button.hasAttribute('data-move')) return moveItem(uid, Number(button.dataset.move));
    if (button.hasAttribute('data-color')) {
      const index = Number(button.dataset.color), line = item.lines[index]; state.line = { uid, index };
      $('lineColor').value = line.textColor || state.design.settings.textColor; $('lineStroke').value = line.strokeColor || state.design.settings.strokeColor;
      $('colorsModal').showModal(); return;
    }
    if (button.hasAttribute('data-add-line') && item.lines.length < 6) item.lines.push({ text: '', textColor: null, strokeColor: null });
    else if (button.hasAttribute('data-remove-line')) item.lines.splice(Number(button.dataset.removeLine), 1);
    else if (button.hasAttribute('data-remove')) state.design.items = state.design.items.filter(entry => entry.uid !== uid);
    else return;
    changed(); renderZones();
  };
  $('zones').ondragstart = event => {
    if (!event.target.closest('.drag-handle')) { event.preventDefault(); return; }
    state.dragging = event.target.closest('[data-uid]').dataset.uid;
    event.dataTransfer.setData('text/plain', state.dragging); event.dataTransfer.effectAllowed = 'move';
  };
  $('zones').ondragover = event => { if (state.dragging && event.target.closest('.zone-item')) event.preventDefault(); };
  $('zones').ondrop = event => {
    event.preventDefault(); const target = event.target.closest('[data-uid]');
    const from = state.design.items.findIndex(item => item.uid === state.dragging), to = state.design.items.findIndex(item => item.uid === target?.dataset.uid);
    if (from >= 0 && to >= 0 && from !== to && state.design.items[from].region === state.design.items[to].region) {
      const [item] = state.design.items.splice(from, 1); state.design.items.splice(to, 0, item); changed(); renderZones();
    }
    state.dragging = null;
  };
  $('zones').ondragend = () => { state.dragging = null; };
  $('giftSearch').oninput = filterCatalog;
  $('giftGrid').onclick = event => {
    const button = event.target.closest('[data-gift]'); if (!button || !state.pick) return;
    const giftId = button.dataset.gift;
    if (state.pick.uid) state.design.items.find(item => item.uid === state.pick.uid).giftId = giftId;
    else state.design.items.push({ uid: M.id(), region: state.pick.region, giftId, lines: [{ text: '', textColor: null, strokeColor: null }] });
    $('catalogModal').close(); changed(); renderZones();
  };
  for (const [input, field] of [['lineColor', 'textColor'], ['lineStroke', 'strokeColor']]) $(input).oninput = () => {
    const item = state.design.items.find(entry => entry.uid === state.line?.uid);
    if (item) { item.lines[state.line.index][field] = $(input).value; changed(); }
  };
  $('resetLineColors').onclick = () => {
    const item = state.design.items.find(entry => entry.uid === state.line?.uid);
    if (item) { Object.assign(item.lines[state.line.index], { textColor: null, strokeColor: null }); changed(); $('colorsModal').close(); }
  };
  document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
  $('saveBtn').onclick = saveDesign;
  $('downloadBtn').onclick = () => downloadDesign(structuredClone(state.design), $('downloadBtn'));
  $('designsBtn').onclick = () => { renderSaved(); $('designsModal').showModal(); };
  $('savedSearch').oninput = () => { state.savedPage = 0; renderSaved(); };
  $('resetSearch').onclick = () => { $('savedSearch').value = ''; state.savedPage = 0; renderSaved(); };
  $('savedPages').onclick = event => { const button = event.target.closest('[data-page]'); if (button) { state.savedPage += Number(button.dataset.page); renderSaved(); } };
  $('savedList').onclick = async event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      const records = readSaved(), id = button.dataset.edit || button.dataset.delete || button.dataset.savedDownload;
      const design = records.find(record => record.id === id); if (!design) return;
      if (button.dataset.edit && await discard()) { state.design = design; state.dirty = false; $('designsModal').close(); syncControls(); message(''); }
      if (button.dataset.savedDownload) await downloadDesign(design, button);
      if (button.dataset.delete && await confirmAction(`“${design.name}” tasarımı silinsin mi?`, 'Sil')) { writeSaved(records.filter(record => record.id !== id)); renderSaved(); message('Tasarım silindi.'); }
    } catch (error) { message(error.message, true); }
  };
  $('newBtn').onclick = async () => { if (await discard()) { state.design = M.normalizeDesign(); state.dirty = false; syncControls(); message(''); $('designName').focus(); } };
  async function goBack() {
    if (!await discard()) return;
    state.dirty = false;
    if (window.parent !== window) window.parent.postMessage({ type: 'mng-close-gift-designer' }, location.origin === 'null' ? '*' : location.origin);
    else location.href = '/';
  }
  $('closeDesigner').onclick = goBack; $('backBtn').onclick = goBack;
  document.querySelector('.brand').onclick = event => { event.preventDefault(); goBack(); };
  window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
  async function init() {
    try { readSaved(); } catch (error) { state.storageReady = false; message(error.message, true); }
    syncControls(); icons();
    try {
      const response = await fetch('gift-assets/katalog_tam.json'); if (!response.ok) throw new Error('Katalog indirilemedi.');
      const raw = await response.json();
      state.catalog = raw.filter(gift => gift.file && !/[\\/]/.test(gift.file)).map(gift => ({ id: String(gift.id), name: String(gift.trName || gift.name || 'Hediye'), originalName: String(gift.name || ''), coins: Math.max(0, Number(gift.coins) || 0), file: gift.file })).sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name, 'tr'));
      state.byId = new Map(state.catalog.map(gift => [gift.id, gift])); draw();
      document.documentElement.dataset.ready = 'true';
    } catch (error) { message('Hediye kataloğu açılamadı: ' + error.message, true); }
  }
  init();
})();
