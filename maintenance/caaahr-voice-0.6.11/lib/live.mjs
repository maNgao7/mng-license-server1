import { randomUUID } from 'node:crypto';
import { EventLedger, normalize } from './events.mjs';
import { InputError } from './settings.mjs';
import { readFile } from 'node:fs/promises';

export async function loadEulerKey(file, environmentKey = '') {
  if (environmentKey?.trim()) return environmentKey.trim();
  try { return (await readFile(file, 'utf8')).trim(); } catch { return ''; }
}

export function liveError(error) {
  const raw = String(error?.message || error?.exception?.message || '');
  if (/offline|not live|not currently live|isn't online|not online/i.test(raw)) return 'Bu hesap şu anda canlı yayında değil.';
  if (/429|rate.limit/i.test(raw)) return 'TikTok bağlantı limiti aşıldı. Biraz bekleyip tekrar deneyin.';
  if (/timeout|timed out|ETIMEDOUT/i.test(raw)) return 'TikTok bağlantısı zaman aşımına uğradı.';
  if (/401|403|key|sign|unauthorized|premium/i.test(raw)) return 'TikTok bağlantı servisi erişimi reddetti.';
  if (/not found|unique.?id|invalid.*user/i.test(raw)) return 'TikTok kullanıcı adı bulunamadı.';
  return 'TikTok bağlantısı kurulamadı. Kullanıcı adını ve ağ bağlantısını kontrol edin.';
}

export function transient(error) {
  const raw = String(error?.message || error?.exception?.message || '');
  if (/offline|not live|not currently live|isn't online|not online|401|403|429|key|sign|unauthorized|premium|not found|invalid|rate.limit/i.test(raw)) return false;
  return /timeout|timed out|network|socket|disconnect|ECONN|ENET|EHOST|EAI_AGAIN|fetch failed/i.test(raw);
}

export class LiveSession {
  constructor({ createConnection, names, publish, changed, timeoutMs = 30000, retryDelays = [1000, 3000, 8000] }) {
    Object.assign(this, { createConnection, names, publish, changed, timeoutMs, retryDelays });
    this.generation = 0; this.retries = 0; this.status = { state: 'disconnected', username: '', message: 'Bağlantı yok.', session: '' };
    this.ledger = new EventLedger();
  }
  snapshot() { return { ...this.status, status: this.status.state, connected: this.status.state === 'connected', error: this.status.state === 'error' ? this.status.message : null }; }
  set(state, message) {
    this.status = { ...this.status, state, message };
    this.publish({ id: randomUUID(), type: 'connection', count: 1, timestamp: Date.now(), source: 'live', ...this.status });
    this.changed();
  }
  stop() {
    this.generation++; clearTimeout(this.timer); this.timer = null;
    clearTimeout(this.retryTimer); this.retryTimer = null;
    this.cancelWait?.(); this.cancelWait = null;
    const previous = this.connection; this.connection = null;
    try { Promise.resolve(previous?.disconnect()).catch(() => {}); } catch {}
  }
  disconnect() {
    this.stop(); this.ledger = new EventLedger();
    this.status.username = ''; this.status.session = '';
    this.retries = 0; this.set('disconnected', 'Bağlantı kesildi.');
  }
  failure(error) {
    this.stop();
    if (transient(error) && this.retries < Math.min(3, this.retryDelays.length)) {
      const delay = this.retryDelays[this.retries++];
      this.set('reconnecting', `Bağlantı kesildi. Yeniden deneniyor (${this.retries}/3)...`);
      this.retryTimer = setTimeout(() => { this.retryTimer = null; this.set('connecting', 'TikTok yayınına yeniden bağlanılıyor...'); this.pending = this.attempt(); }, delay);
      this.retryTimer.unref?.();
    } else this.set('error', liveError(error));
  }
  connect(rawUsername) {
    if (typeof rawUsername !== 'string') throw new InputError('Geçerli bir TikTok kullanıcı adı gerekli.');
    const username = rawUsername.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{2,32}$/.test(username)) throw new InputError('Geçerli bir TikTok kullanıcı adı gerekli.');
    this.stop(); this.ledger = new EventLedger();
    this.retries = 0;
    this.status.username = username; this.status.session = randomUUID();
    this.set('connecting', 'TikTok yayınına bağlanılıyor...');
    this.pending = this.attempt();
    return this.snapshot();
  }
  async attempt() {
    const username = this.status.username;
    const generation = this.generation;
    const current = () => generation === this.generation;
      try {
        const connection = this.createConnection(username); this.connection = connection;
        for (const [name, type] of this.names) {
          if (!name) continue;
          connection.on(name, data => {
            if (!current() || this.status.state !== 'connected') return;
            if (type === 'social' && !/follow/i.test(String(data.displayType || data.action || data.label || ''))) return;
            const event = this.ledger.accept(normalize(type === 'social' ? 'follow' : type, data));
            if (event) this.publish(event);
          });
        }
        connection.on('error', error => {
          if (!current()) return;
          this.failure(error);
        });
        connection.on('disconnected', () => { if (current()) this.failure(new Error('network disconnected')); });
        connection.on('streamEnd', () => { if (current()) { this.stop(); this.set('disconnected', 'TikTok canlı yayını sona erdi.'); } });
        await Promise.race([connection.connect(), new Promise((resolve, reject) => {
          this.cancelWait = resolve;
          this.timer = setTimeout(() => reject(new Error('timeout')), this.timeoutMs); this.timer.unref?.();
        })]);
        if (!current()) { try { Promise.resolve(connection.disconnect()).catch(() => {}); } catch {} return; }
        clearTimeout(this.timer); this.timer = null; this.cancelWait = null;
        this.set('connected', 'TikTok canlı yayınına bağlandı.');
      } catch (error) { if (current()) this.failure(error); }
  }
}
