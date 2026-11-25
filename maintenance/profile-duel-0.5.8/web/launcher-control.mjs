import { mountGiftPicker } from './gift-picker.mjs';
import { mountDurationControl } from './duration-control.mjs';

const duration = mountDurationControl(document.getElementById('duration'), document.getElementById('duration-unit'));

const key = new URL(location.href).searchParams.get('key') || '';
const endpoint = path => `${path}?key=${encodeURIComponent(key)}`;
const status = document.getElementById('connection-status');
const liveLabel = document.getElementById('live-state');
const result = document.getElementById('test-result');
const pause = document.getElementById('pause-round');
const next = document.getElementById('next-round');
const ownerInput = document.getElementById('owner-name');
const opponentInput = document.getElementById('opponent-name');
const widgetUrl = new URL('./widget', location.href); widgetUrl.search = '';
const widgetAddress = document.getElementById('widget-url');
const copyButton = document.getElementById('copy-url');
const connectButton = document.getElementById('connect-live');
let broadcastUrl = null;
let broadcastSupported = null;
let snapshot = null;
let eventNumber = 0;
let savedGiftConfig = {};
const saveGifts = document.getElementById('save-gifts');
const settingsStatus = document.getElementById('settings-status');
const giftPicker = mountGiftPicker({ endpoint, onChange: () => {
  settingsStatus.textContent = 'Seçim değişti. Uygulamak için kaydedin.';
} });

function applyGiftConfig(config) {
  savedGiftConfig = config;
  giftPicker.setConfig(config);
  for (const button of document.querySelectorAll('.gift-test[data-side]')) {
    const left = button.dataset.side === 'left';
    button.textContent = `${config[left ? 'roseGiftLabel' : 'tiktokGiftLabel'] || (left ? 'Gül' : 'TikTok')} · ${left ? 'sol' : 'sağ'}`;
  }
}
const editorUrl = new URL('./widget', location.href); editorUrl.searchParams.set('key', key);
document.querySelector('.preview-frame iframe').src = editorUrl.href;

function renderBroadcastUrl() {
  const changingAccount = connectButton.disabled && broadcastSupported;
  const url = changingAccount ? null : broadcastUrl;
  const message = url || (broadcastSupported
    ? 'HTTPS widget bağlantısı hazırlanıyor…'
    : 'Widget bağlantısı kontrol ediliyor…');
  if (widgetAddress.textContent !== message) widgetAddress.textContent = message;
  copyButton.disabled = !url;
}

async function post(path, body = {}) {
  const response = await fetch(endpoint(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.result?.reason || 'İşlem tamamlanamadı.');
  return data;
}

function render(state) {
  if (!state) return;
  duration.sync(state.durationSeconds);
  const previous = snapshot;
  snapshot = state;
  const phase = state.phase;
  if (!previous || previous.owner?.username !== state.owner?.username) ownerInput.value = state.owner?.username || '';
  if (!previous || previous.opponent?.username !== state.opponent?.username) opponentInput.value = state.opponent?.username || '';
  ownerInput.disabled = opponentInput.disabled = phase !== 'idle';
  document.getElementById('start-round').disabled = phase !== 'idle' || !state.owner || !state.opponent;
  status.textContent = ({ idle: 'Hazır', running: 'Tur yayında', paused: 'Duraklatıldı', finished: 'Tur tamamlandı' })[phase] || 'Bağlanıyor';
  pause.disabled = !['running', 'paused'].includes(phase);
  pause.textContent = phase === 'paused' ? 'Devam et' : 'Duraklat';
  next.disabled = phase !== 'finished';
  if (phase === 'finished' && state.lastResult) {
    const winner = state.lastResult.winner;
    result.textContent = winner ? `Kazanan @${winner.username} · ${state.lastResult.scores.left} : ${state.lastResult.scores.right}` : `Berabere · ${state.lastResult.scores.left} : ${state.lastResult.scores.right}`;
  }
}

let metaPending = false;
let latestMetaRequest = 0;
async function fetchLiveMeta() {
  const requestId = ++latestMetaRequest;
  metaPending = true;
  try {
    const response = await fetch(endpoint('./api/meta'), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Oyun oturumu doğrulanamadı.');
    const meta = await response.json();
    if (requestId !== latestMetaRequest) return meta;
    broadcastSupported = meta.broadcastUrlSupported === true;
    broadcastUrl = broadcastSupported ? meta.broadcastUrl || null : widgetUrl.href;
    renderBroadcastUrl();
    const live = meta.live || {}, diagnostics = meta.diagnostics || {};
    liveLabel.textContent = live.message || (live.status === 'connected' ? 'Yayın bağlantısı aktif' : live.reason || 'Ortak yayın bağlantısı bekleniyor');
    const count = value => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');
    document.getElementById('live-receipts').textContent = `${count(diagnostics.gifts)} hediye alındı · ${count(diagnostics.accepted)} puanlandı`;
    const reason = document.getElementById('live-gift-reason');
    reason.textContent = diagnostics.gifts > 0 && diagnostics.lastReason && diagnostics.lastReason !== 'Puan eklendi.' ? `Son hediye puanlanmadı: ${diagnostics.lastReason}` : '';
    reason.hidden = !reason.textContent;
    return meta;
  } finally { if (requestId === latestMetaRequest) metaPending = false; }
}

async function loadMeta() {
  const meta = await fetchLiveMeta();
  status.textContent = meta.live?.message || liveLabel.textContent;
  document.getElementById('synthetic-panel').hidden = !meta.allowSyntheticTest;
  applyGiftConfig(meta.giftConfig || {});
  giftPicker.setDisabled(false); saveGifts.disabled = false;
}

async function refresh() {
  try { const response = await fetch('./api/state', { cache: 'no-store' }); render(await response.json()); }
  catch { status.textContent = 'Oyun bağlantısı yenileniyor'; }
}

document.getElementById('start-round').addEventListener('click', async () => {
  try {
    const data = await post('./api/live/start', { left: ownerInput.value, opponent: opponentInput.value, durationSeconds: duration.readSeconds() });
    render(data.snapshot); result.textContent = 'Tur başladı. Seçili hediyeler ayarlarınıza göre puanlanır.';
  } catch (error) { result.textContent = error.message; }
});

connectButton.addEventListener('click', async () => {
  const username = document.getElementById('live-username').value.trim();
  connectButton.disabled = true;
  renderBroadcastUrl();
  try {
    const data = await post('./api/live/connect', { username }); render(data.snapshot);
    if (broadcastSupported) broadcastUrl = null;
    result.textContent = data.live?.status === 'connected' ? `@${data.owner.username} yayınına bağlanıldı. Oyuncuları fotoğraflı listeden seçin.` : (data.live?.message || `@${data.owner.username} yayını bekleniyor.`);
    await fetchLiveMeta();
  } catch (error) { result.textContent = error.message; }
  finally {
    connectButton.disabled = false;
    renderBroadcastUrl();
  }
});

pause.addEventListener('click', async () => {
  try { const data = await post('./api/live/pause'); render(data.snapshot); }
  catch (error) { result.textContent = error.message; }
});

next.addEventListener('click', async () => {
  try {
    const data = await post('./api/live/next');
    render(data.snapshot);
    result.textContent = data.snapshot.lastResult?.winner
      ? 'Kazanan kendi tarafında kaldı. Boş tarafa bir oyuncu seçin.'
      : 'Berabere. İki oyuncu da yeni tur için hazır.';
  }
  catch (error) { result.textContent = error.message; }
});

document.getElementById('reset-round').addEventListener('click', async () => {
  try { const data = await post('./api/live/reset'); render(data.snapshot); result.textContent = 'Skor ve tur sıfırlandı.'; }
  catch (error) { result.textContent = error.message; }
});

saveGifts.addEventListener('click', async () => {
  if (saveGifts.disabled) return;
  try {
    const config = giftPicker.getSettings();
    saveGifts.disabled = true; giftPicker.setDisabled(true); settingsStatus.textContent = 'Kaydediliyor…';
    const data = await post('./api/live/settings', config);
    applyGiftConfig(data.giftConfig || data.snapshot?.giftConfig || config);
    render(data.snapshot); settingsStatus.textContent = 'Hediye seçimleri kaydedildi.';
  } catch (error) { settingsStatus.textContent = error.message; }
  finally { saveGifts.disabled = false; giftPicker.setDisabled(false); }
});

copyButton.addEventListener('click', async () => {
  if (copyButton.disabled || !broadcastUrl) return;
  try { await navigator.clipboard.writeText(broadcastUrl); copyButton.textContent = 'Kopyalandı'; setTimeout(() => { copyButton.textContent = 'Bağlantıyı kopyala'; }, 1400); }
  catch { result.textContent = 'Tarayıcı bağlantıyı kopyalamaya izin vermedi.'; }
});

document.querySelectorAll('.gift-test[data-side]').forEach(button => button.addEventListener('click', async () => {
  const count = Math.max(1, Math.min(1000000, Math.trunc(Number(document.getElementById('test-coins').value)) || 1));
  const side = button.dataset.side;
  eventNumber++;
  try {
    const prefix = side === 'left' ? 'rose' : 'tiktok';
    const eventId = `preview-${Date.now()}-${eventNumber}`;
    const data = await post('./api/live/test-event', { eventId, giftId: savedGiftConfig[`${prefix}GiftIds`]?.[0], giftName: savedGiftConfig[`${prefix}GiftLabel`], coins: count, giftType: 1, repeatEnd: true, repeatCount: count, username: side === 'left' ? snapshot?.owner?.username : snapshot?.opponent?.username });
    const scored = data.snapshot?.activity.find(event => event.eventId === eventId);
    render(data.snapshot);
    result.textContent = scored ? `${scored.points} sentetik puan ön izlemeye eklendi.` : 'Sentetik hediye puanlanmadı.';
  } catch (error) { result.textContent = error.message; }
}));

const events = new EventSource('./api/events');
events.onmessage = event => { try { render(JSON.parse(event.data)); } catch {} };
events.onerror = () => { status.textContent = 'Oyun bağlantısı yenileniyor'; };
const metaTimer = setInterval(async () => {
  if (metaPending) return;
  try { await fetchLiveMeta(); }
  catch {
    const reason = document.getElementById('live-gift-reason');
    reason.textContent = 'Yayın durumu güncellenemedi. Yeniden deneniyor.'; reason.hidden = false;
  }
}, 3000);
window.addEventListener('pagehide', () => { events.close(); clearInterval(metaTimer); giftPicker.destroy(); }, { once: true });
loadMeta().then(refresh).catch(error => { status.textContent = error.message; });
