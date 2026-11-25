import { mountDurationControl } from './duration-control.mjs';

const form = document.getElementById('setup-form');
const duration = mountDurationControl(document.getElementById('duration'), document.getElementById('duration-unit'));
const statusLabel = document.getElementById('connection-status');
const resultOutput = document.getElementById('test-result');
const pauseButton = document.getElementById('pause-button');
const widgetUrl = new URL('./widget', location.href).href;
document.getElementById('widget-url').textContent = widgetUrl;

let roundStarted = false;
let giftSequence = 0;

async function request(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.reason || 'İşlem tamamlanamadı.');
  return data;
}

function formProfile(data, prefix) {
  return {
    username: data.get(prefix),
    nickname: data.get(`${prefix}Name`),
    avatarUrl: data.get(`${prefix}Avatar`),
  };
}

function render(snapshot) {
  if (!snapshot) return;
  duration.sync(snapshot.durationSeconds);
  const phases = { idle: 'Ön izleme hazır', running: 'Test turu çalışıyor', paused: 'Test turu duraklatıldı', finished: 'Tur tamamlandı' };
  statusLabel.textContent = phases[snapshot.phase] || 'Ön izleme';
  pauseButton.disabled = !['running', 'paused'].includes(snapshot.phase);
  pauseButton.textContent = snapshot.phase === 'paused' ? 'Devam et' : 'Duraklat';
  roundStarted = ['running', 'paused', 'finished'].includes(snapshot.phase);
}

async function refresh() {
  try {
    const response = await fetch('./api/state', { cache: 'no-store' });
    render(await response.json());
  } catch {
    statusLabel.textContent = 'Ön izleme sunucusuna ulaşılamıyor';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  try {
    const response = await request('./api/preview/start', {
      owner: formProfile(data, 'owner'),
      opponent: formProfile(data, 'opponent'),
      durationSeconds: duration.readSeconds(),
    });
    render(response.snapshot);
    resultOutput.textContent = 'Tur başladı. Her iki taraf 0 puandan başlıyor.';
  } catch (error) {
    resultOutput.textContent = error.message;
  }
});

pauseButton.addEventListener('click', async () => {
  try {
    const response = await request('./api/preview/pause', {});
    render(response.snapshot);
  } catch (error) {
    resultOutput.textContent = error.message;
  }
});

document.getElementById('reset-button').addEventListener('click', async () => {
  try {
    const response = await request('./api/preview/reset', {});
    render(response.snapshot);
    resultOutput.textContent = 'Puanlar sıfırlandı; taraflar ve olay tekilleştirme kaydı korundu.';
  } catch (error) {
    resultOutput.textContent = error.message;
  }
});

document.querySelectorAll('[data-gift]').forEach(button => button.addEventListener('click', async () => {
  if (!roundStarted) {
    resultOutput.textContent = 'Önce turu başlat.';
    return;
  }
  const rose = button.dataset.gift === 'rose';
  const formData = new FormData(form);
  giftSequence++;
  try {
    const response = await request('./api/preview/event', {
      eventId: `preview-${Date.now()}-${giftSequence}`,
      giftId: rose ? '5655' : 'preview-other',
      giftName: rose ? 'Gül' : 'Test hediyesi',
      giftType: 1,
      repeatEnd: true,
      repeatCount: 100,
      username: rose ? String(formData.get('owner')).replace(/^@/, '') : String(formData.get('opponent')).replace(/^@/, ''),
      nickname: rose ? formData.get('ownerName') : formData.get('opponentName'),
    });
    render(response.snapshot);
    resultOutput.textContent = 'Sentetik hediye olayı gönderildi. Seri adedi puan çarpanı olarak kullanılmadı.';
  } catch (error) {
    resultOutput.textContent = error.message;
  }
}));

document.getElementById('copy-url').addEventListener('click', async event => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(widgetUrl);
    button.textContent = 'Kopyalandı';
    setTimeout(() => { button.textContent = 'Bağlantıyı kopyala'; }, 1500);
  } catch {
    resultOutput.textContent = 'Tarayıcı bağlantıyı kopyalamaya izin vermedi.';
  }
});

const events = new EventSource('./api/events');
events.onmessage = event => {
  try { render(JSON.parse(event.data)); } catch {}
};
events.onerror = () => { statusLabel.textContent = 'Ön izleme bağlantısı yenileniyor'; };
refresh();
