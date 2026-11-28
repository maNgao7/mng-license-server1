'use strict';

(() => {
  const api = window.hediyeBox;
  const byId = id => document.getElementById(id);
  const cameraButtons = [...document.querySelectorAll('[data-camera]')];
  const busy = new Set();
  const numberFormat = new Intl.NumberFormat('tr-TR');
  let state = null;
  let revision = 0;
  let readId = 0;
  const showCurrentChannel = window.bindChannelField(byId('username'));
  let unsubscribe;

  const text = value => typeof value === 'string' ? value.trim() : '';
  const count = value => Number.isSafeInteger(value) && value >= 0 ? numberFormat.format(value) : '—';
  const normalizedUsername = value => text(value).replace(/^@/, '').toLowerCase();
  const nativeReady = () => state?.native?.ready === true && state?.gameRunning === true;
  const cameraReady = () => nativeReady() && state.native.cameraHotkeys === true;

  function inlineError(group, message = '') {
    const element = byId(`${group}-error`);
    element.textContent = message;
    element.hidden = !message;
  }

  function panel(open) {
    byId('control-panel').hidden = !open;
    byId('panel-toggle').setAttribute('aria-expanded', String(open));
    byId('panel-toggle').setAttribute('aria-label', open ? 'Kontrol panelini kapat' : 'Kontrol panelini aç');
    byId('panel-toggle').title = open ? 'Kontrol panelini kapat' : 'Kontrol panelini aç';
    byId('panel-toggle').textContent = open ? '−' : '+';
  }

  function badge(id, label, tone) {
    byId(`${id}-status`).textContent = label;
    byId(`${id}-badge`).dataset.tone = tone;
  }

  function portraitUrl(value) {
    if (!text(value)) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function renderSide(side) {
    const data = state?.match?.sides?.[side];
    const leader = data?.leader;
    const nickname = text(leader?.nickname);
    const uniqueId = normalizedUsername(leader?.uniqueId);
    const name = nickname || (uniqueId ? `@${uniqueId}` : 'Lider bekleniyor');
    byId(`${side}-leader`).textContent = name;
    byId(`${side}-leader`).title = name;
    byId(`${side}-username`).textContent = nickname && uniqueId ? `@${uniqueId}` : '';
    byId(`${side}-initial`).textContent = nickname ? [...nickname][0].toLocaleUpperCase('tr-TR') : uniqueId ? [...uniqueId][0].toLocaleUpperCase('tr-TR') : '—';
    const portrait = byId(`${side}-portrait`);
    const url = portraitUrl(leader?.profilePictureUrl);
    if (url !== (portrait.dataset.source || '')) {
      portrait.dataset.source = url;
      portrait.hidden = true;
      if (url) portrait.src = url;
      else portrait.removeAttribute('src');
    }
    byId(`${side}-pending`).textContent = count(data?.pendingPunches);
    byId(`${side}-units`).textContent = count(data?.giftUnits);
  }

  function render() {
    const live = state?.live;
    const status = text(live?.status).toLowerCase();
    const liveLabels = {
      connected: ['Yayın bağlı', 'success'], connecting: ['Yayına bağlanıyor', 'waiting'],
      reconnecting: ['Yeniden bağlanıyor', 'waiting'], waiting: ['Yayın bekleniyor', 'waiting'],
      disconnected: ['Yayın bağlı değil', 'neutral'], idle: ['Yayın bağlı değil', 'neutral'],
      offline: ['Yayın çevrimdışı', 'neutral'], ended: ['Yayın sona erdi', 'neutral'],
      error: ['Yayın bağlantı hatası', 'error'],
    };
    const [liveLabel, liveTone] = liveLabels[status] || ['Yayın durumu bilinmiyor', 'neutral'];
    badge('live', liveLabel, liveTone);
    const ready = nativeReady();
    badge('native', !state ? 'Oyun kontrolü bilinmiyor' : ready ? 'Oyun kontrolü hazır' : 'Oyun kontrolü hazır değil', ready ? 'success' : 'neutral');
    const starting = state?.phase === 'starting';
    const gameLabel = !state ? 'Oyun durumu bilinmiyor' : state.gameRunning === true ? 'Oyun açık' : starting ? 'Oyun açılıyor' : 'Oyun kapalı';
    byId('game-status').textContent = gameLabel;
    byId('panel-game-status').textContent = gameLabel;
    byId('state-message').textContent = text(state?.message) || (!state ? 'Masaüstü bağlantısı bekleniyor.' : ready ? 'Oyun kontrolü hazır.' : state.gameRunning ? 'Oyun açık; yumruk bağlantısı henüz hazır değil.' : 'Oyunu açmak ve yayına bağlanmak için + panelini kullanın.');
    document.querySelector('.session-state').dataset.tone = state?.phase === 'error' ? 'error' : 'neutral';
    const channel = normalizedUsername(live?.username);
    byId('connect-message').textContent = [channel ? `@${channel}` : '', text(live?.message) || liveLabel].filter(Boolean).join(' · ');
    byId('connect-message').classList.toggle('inline-error', status === 'error');
    showCurrentChannel(channel);
    byId('connect-button').textContent = busy.has('connect') ? 'Bağlanıyor…' : status === 'connected' && normalizedUsername(byId('username').value) === channel ? 'Yeniden Bağlan' : 'Bağlan';
    byId('connect-button').disabled = busy.has('connect');
    byId('game-button').textContent = busy.has('game') ? state?.gameRunning ? 'Kapatılıyor…' : 'Açılıyor…' : state?.gameRunning ? 'Oyunu Kapat' : starting ? 'Açılışı Yeniden Dene' : 'Oyunu Aç';
    byId('game-button').disabled = busy.has('game');
    byId('native-message').textContent = !state ? 'Oyun kontrolü doğrulanmadı.' : ready ? 'Oyun kontrolü hazır.' : state.gameRunning ? 'Oyun çalışıyor; yumruk bağlantısı hazır değil.' : 'Oyun kapalı; yumruk bağlantısı hazır değil.';
    for (const side of ['left', 'right']) {
      renderSide(side);
      const punchCapability = side === 'left' ? 'punchLeft' : 'punchRight';
      const enabled = ready && state.native[punchCapability] === true;
      byId(`test-${side}`).disabled = !enabled || busy.has('test');
      byId(`test-${side}`).title = enabled ? 'TEST hediyesi gönder' : 'Bu tarafın yumruk bağlantısı hazır değil.';
    }
    byId('test-message').textContent = !ready ? 'Test için yumruk bağlantısı hazır olmalı.' : !state.native.punchLeft || !state.native.punchRight ? 'Yalnızca yumruk bağlantısı hazır taraf test edilebilir.' : 'TEST hediyesi gönderir. Sonuç oyundan doğrulanır.';
    for (const button of cameraButtons) {
      button.disabled = !cameraReady() || busy.has('camera');
      button.setAttribute('aria-pressed', String(cameraReady() && state.camera === button.dataset.camera));
      button.title = cameraReady() ? 'Kamera açısını değiştir' : 'Kamera kontrolü hazır değil.';
    }
    byId('camera-message').textContent = cameraReady() ? 'E · Arkadan   R · Birinci şahıs' : 'Kamera kontrolü hazır değil.';
  }

  function acceptState(next) {
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Masaüstünden geçerli durum alınamadı.');
    state = next;
    inlineError('bridge');
    render();
  }

  async function refresh() {
    if (typeof api?.getState !== 'function') throw new Error('Masaüstü bağlantısı bulunamadı. Uygulamayı masaüstü başlatıcısından açın.');
    const requestedAtRevision = revision;
    const request = ++readId;
    const next = await api.getState();
    if (requestedAtRevision === revision && request === readId) acceptState(next);
  }

  function errorText(error) {
    return text(error?.message) || text(error) || 'İşlem tamamlanamadı. Yeniden deneyin.';
  }

  async function action(group, method, ...args) {
    if (busy.has(group)) return;
    inlineError(group);
    busy.add(group);
    render();
    try {
      if (typeof api?.[method] !== 'function') throw new Error('Masaüstü bağlantısı bulunamadı. Uygulamayı masaüstü başlatıcısından açın.');
      const result = await api[method](...args);
      if (result?.ok === false || result?.success === false) throw new Error(text(result.message) || text(result.error?.message) || text(result.error) || 'İşlem kabul edilmedi.');
      await refresh();
    } catch (error) {
      inlineError(group, errorText(error));
      panel(true);
    } finally {
      busy.delete(group);
      render();
    }
  }

  function setCamera(camera) {
    if (cameraReady()) void action('camera', 'setCamera', camera);
  }

  byId('panel-toggle').addEventListener('click', () => panel(byId('control-panel').hidden));
  byId('username').addEventListener('input', () => {
    byId('username').removeAttribute('aria-invalid');
    inlineError('connect');
    render();
  });
  byId('connect-form').addEventListener('submit', event => {
    event.preventDefault();
    const username = normalizedUsername(byId('username').value);
    if (!/^[a-z0-9_.]{1,64}$/.test(username)) {
      byId('username').setAttribute('aria-invalid', 'true');
      inlineError('connect', 'Geçerli bir TikTok kullanıcı adı girin.');
      byId('username').focus();
      return;
    }
    byId('username').value = username;
    void action('connect', 'connect', username);
  });
  byId('game-button').addEventListener('click', () => void action('game', state?.gameRunning ? 'closeGame' : 'launchGame'));
  for (const side of ['left', 'right']) {
    byId(`test-${side}`).addEventListener('click', () => {
      if (!byId(`test-${side}`).disabled && nativeReady()) void action('test', 'testGift', side);
    });
    const portrait = byId(`${side}-portrait`);
    portrait.addEventListener('load', () => { portrait.hidden = false; });
    portrait.addEventListener('error', () => { portrait.hidden = true; });
  }
  for (const button of cameraButtons) button.addEventListener('click', () => setCamera(button.dataset.camera));
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    if (event.key === 'Escape' && !byId('control-panel').hidden) {
      panel(false);
      byId('panel-toggle').focus();
      return;
    }
    const key = event.key.toLowerCase();
    if (cameraReady() && (key === 'e' || key === 'r')) {
      event.preventDefault();
      setCamera(key === 'e' ? 'back' : 'first');
    }
  });

  render();
  try {
    if (typeof api?.onState === 'function') {
      unsubscribe = api.onState(next => {
        revision++;
        try { acceptState(next); }
        catch (error) { state = null; render(); inlineError('bridge', errorText(error)); }
      });
    }
  } catch (error) { inlineError('bridge', errorText(error)); }
  void refresh().catch(error => { inlineError('bridge', errorText(error)); });
  window.addEventListener('beforeunload', () => {
    if (typeof unsubscribe === 'function') unsubscribe();
  }, { once: true });
})();
