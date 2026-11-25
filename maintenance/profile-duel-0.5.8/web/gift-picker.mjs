// This chooser only edits gift settings; it never owns a live connection.
export function mountGiftPicker({ endpoint, onChange = () => {} }) {
  const cards = [...document.querySelectorAll('[data-gift-slot]')];
  const selected = { left: null, right: null };
  const pointsInputs = {};
  for (const input of document.querySelectorAll('[data-gift-points]')) {
    pointsInputs[input.dataset.giftPoints] = input;
    input.addEventListener('input', onChange);
  }
  let side = 'left', catalog = null, loading = false, disabled = true, limit = 60;
  let request = null, destroyed = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'gift-dialog';
  dialog.setAttribute('aria-labelledby', 'gift-picker-title');
  dialog.innerHTML = `<div class="gift-picker-heading"><div><p>HEDİYE KATALOĞU</p><h2 id="gift-picker-title">Bir hediye seç</h2></div><button class="gift-picker-close" type="button" aria-label="Hediye kataloğunu kapat">×</button></div><label class="gift-picker-search-label" for="gift-picker-search">Hediye ara</label><input id="gift-picker-search" class="gift-picker-search" type="search" placeholder="Hediye adı yazın…" autocomplete="off"><p class="gift-picker-status" role="status" aria-live="polite"></p><div class="gift-picker-grid" aria-label="Hediyeler"></div><button class="button gift-picker-retry" type="button" hidden>Yeniden dene</button>`;
  document.body.append(dialog);
  const search = dialog.querySelector('input');
  const list = dialog.querySelector('.gift-picker-grid');
  const status = dialog.querySelector('.gift-picker-status');
  const retry = dialog.querySelector('.gift-picker-retry');
  const fold = value => String(value).toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');

  function giftArt(gift) {
    const art = document.createElement('span');
    art.className = 'gift-choice-art';
    art.setAttribute('aria-hidden', 'true');
    art.textContent = '🎁';
    if (gift?.image) {
      try {
        const url = new URL(gift.image, location.href);
        if (url.protocol === 'https:' || (url.origin === location.origin && url.protocol === 'http:')) {
          const image = document.createElement('img');
          image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
          image.addEventListener('load', () => art.classList.add('has-image'));
          image.addEventListener('error', () => { image.remove(); art.classList.remove('has-image'); });
          image.src = url.href; art.append(image);
        }
      } catch { /* Keep the visible fallback when an image is unavailable. */ }
    }
    return art;
  }

  function renderCards() {
    for (const card of cards) {
      const slot = card.dataset.giftSlot, gift = selected[slot];
      const direction = slot === 'left' ? 'Sol' : 'Sağ';
      const copy = document.createElement('span'); copy.className = 'gift-choice-copy';
      const label = document.createElement('small'); label.textContent = `${direction.toLocaleUpperCase('tr')} TARAF`;
      const name = document.createElement('strong'); name.textContent = gift?.name || 'Hediye seç';
      const action = document.createElement('span'); action.textContent = 'Katalogdan değiştir ↗';
      copy.append(label, name, action); card.replaceChildren(giftArt(gift), copy);
      card.setAttribute('aria-label', `${direction} taraf hediyesi: ${gift?.name || 'Hediye seç'}. Kataloğu aç`);
      card.disabled = disabled;
    }
  }

  function rows() {
    if (!catalog) return;
    const query = fold(search.value.trim());
    const found = catalog.filter(gift => fold(gift.name).includes(query));
    const other = selected[side === 'left' ? 'right' : 'left'];
    const nodes = found.slice(0, limit).map(gift => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'gift-catalog-item'; button.dataset.giftId = gift.id;
      button.disabled = gift.id === other?.id;
      button.setAttribute('aria-pressed', String(gift.id === selected[side]?.id));
      const name = document.createElement('strong'); name.textContent = gift.name;
      const coins = document.createElement('span'); coins.className = 'gift-catalog-coins';
      coins.textContent = Number.isFinite(gift.coins) ? `${gift.coins.toLocaleString('tr-TR')} coin` : 'Coin bilgisi yok';
      const note = document.createElement('small');
      note.textContent = button.disabled ? 'Diğer tarafta seçili' : gift.id === selected[side]?.id ? 'Seçili' : 'Seç';
      button.append(giftArt(gift), name, coins, note);
      button.addEventListener('click', () => {
        if (disabled) return;
        selected[side] = { ...gift }; renderCards(); dialog.close(); onChange();
      });
      return button;
    });
    if (!nodes.length) {
      const empty = document.createElement('p'); empty.className = 'gift-picker-empty';
      empty.textContent = query ? 'Bu aramada hediye bulunamadı. Başka bir ad deneyin.' : 'Hediye kataloğu şu anda boş.';
      nodes.push(empty);
    }
    if (found.length > limit) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'button gift-picker-more';
      more.textContent = 'Daha fazla hediye göster'; more.onclick = () => { limit += 60; rows(); }; nodes.push(more);
    }
    list.replaceChildren(...nodes);
    list.setAttribute('aria-busy', 'false');
    status.textContent = `${found.length} hediye · ${side === 'left' ? 'Sol' : 'Sağ'} taraf için seçin`;
  }

  async function loadCatalog() {
    if (loading || destroyed) return;
    loading = true; retry.hidden = true; list.replaceChildren(); list.setAttribute('aria-busy', 'true');
    status.textContent = 'Hediye görselleri yükleniyor…';
    request = new AbortController();
    const timeout = setTimeout(() => request?.abort(), 15000);
    try {
      const response = await fetch(endpoint('./api/gifts'), { cache: 'no-store', signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Hediye kataloğu yüklenemedi.');
      const gifts = Array.isArray(data) ? data : data.gifts;
      if (!Array.isArray(gifts)) throw new Error('Hediye kataloğu okunamadı.');
      const seen = new Set();
      catalog = gifts.flatMap(gift => {
        const id = String(gift?.id ?? '').trim(), name = String(gift?.name ?? '').trim();
        if (!id || !name || seen.has(id)) return [];
        seen.add(id);
        return [{ id, name, coins: gift.coins == null ? null : Number(gift.coins), image: typeof gift.image === 'string' ? gift.image : '' }];
      });
      if (destroyed) return;
      for (const slot of ['left', 'right']) {
        const gift = catalog.find(row => row.id === selected[slot]?.id);
        if (gift) selected[slot] = { ...selected[slot], ...gift };
      }
      renderCards(); rows();
    } catch (error) {
      if (destroyed) return;
      catalog = null;
      status.textContent = error.name === 'AbortError' ? 'Hediye kataloğu zamanında yanıt vermedi. Yeniden deneyin.' : error.message;
      retry.hidden = false; list.setAttribute('aria-busy', 'false');
    } finally { clearTimeout(timeout); loading = false; request = null; }
  }

  function open(event) {
    if (disabled) return;
    side = event.currentTarget.dataset.giftSlot; limit = 60; search.value = '';
    dialog.querySelector('h2').textContent = `${side === 'left' ? 'Sol' : 'Sağ'} taraf · Hediye seç`;
    dialog.showModal(); search.focus();
    if (catalog) rows(); else void loadCatalog();
  }
  for (const card of cards) card.addEventListener('click', open);
  dialog.querySelector('.gift-picker-close').onclick = () => dialog.close();
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
  });
  search.oninput = () => { limit = 60; list.scrollTop = 0; rows(); };
  retry.onclick = () => { void loadCatalog(); };

  return {
    setConfig(config = {}) {
      for (const [slot, prefix, fallback] of [['left', 'rose', 'Gül'], ['right', 'tiktok', 'TikTok']]) {
        const id = String(config[`${prefix}GiftIds`]?.[0] ?? '');
        selected[slot] = { id, name: config[`${prefix}GiftLabel`] || fallback, image: config[`${prefix}GiftImage`] || '' };
        pointsInputs[slot].value = config[`${prefix}PointsPerGift`] ?? '';
      }
      renderCards();
    },
    setDisabled(value) {
      disabled = value;
      for (const input of Object.values(pointsInputs)) input.disabled = disabled;
      renderCards();
      if (disabled && dialog.open) dialog.close();
    },
    getSettings() {
      const { left, right } = selected;
      if (!left?.id || !right?.id) throw new Error('Her iki taraf için katalogdan bir hediye seçin.');
      if (left.id === right.id) throw new Error('İki taraf için farklı hediyeler seçin.');
      if (Object.values(pointsInputs).some(input => !input.validity.valid)) {
        throw new Error('Hediye başına puan pozitif bir tam sayı olmalıdır. Coin puanlaması için alanı boş bırakın.');
      }
      return { roseGiftIds: [left.id], roseGiftNames: [], tiktokGiftIds: [right.id], tiktokGiftNames: [],
        roseGiftLabel: left.name, tiktokGiftLabel: right.name, roseGiftImage: left.image, tiktokGiftImage: right.image,
        rosePointsPerGift: pointsInputs.left.value ? pointsInputs.left.valueAsNumber : null,
        tiktokPointsPerGift: pointsInputs.right.value ? pointsInputs.right.valueAsNumber : null };
    },
    destroy() {
      destroyed = true;
      request?.abort();
      dialog.remove();
      for (const card of cards) card.removeEventListener('click', open);
      for (const input of Object.values(pointsInputs)) input.removeEventListener('input', onChange);
    },
  };
}
