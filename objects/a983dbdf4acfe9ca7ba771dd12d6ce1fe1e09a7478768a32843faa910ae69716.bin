import { randomUUID } from 'node:crypto';
import { normalize, explain, EventLedger } from './events.js';

// A generation isolates late callbacks from a broadcaster that was replaced or disconnected.
export class LiveSession {
  constructor(createConnection, eventNames, publish, timeoutMs = 30000, options = {}) {
    this.createConnection = createConnection;
    this.eventNames = eventNames;
    this.publish = publish;
    this.timeoutMs = timeoutMs;
    this.generation = 0;
    this.username = '';
    this.session = '';
    this.state = 'disconnected';
    this.message = 'Bağlantı yok';
    this.ledger = new EventLedger();
    this.autoReconnect = options.autoReconnect === true;
    this.retryDelays = options.retryDelays || [2000, 5000, 10000, 20000, 30000];
    this.retryAttempts = 0;
  }

  snapshot() {
    return { username: this.username, session: this.session, state: this.state, message: this.message, ...(this.nextRetryAt ? {nextRetryAt:this.nextRetryAt} : {}) };
  }

  setStatus(state, message) {
    this.state = state;
    this.message = message;
    this.publish({ type: 'status', ...this.snapshot() });
  }

  stopConnection() {
    this.generation++;
    clearTimeout(this.retryTimer); this.retryTimer = undefined; this.nextRetryAt = 0;
    clearTimeout(this.timer);
    this.timer = undefined;
    const connection = this.connection;
    this.connection = undefined;
    try { connection?.disconnect(); } catch {}
  }

  scheduleRetry() {
    if (!this.autoReconnect || !this.username || this.retryTimer) return;
    const generation=this.generation, username=this.username, session=this.session;
    const delay=Math.max(1,Math.min(30000,this.retryDelays[Math.min(this.retryAttempts++,this.retryDelays.length-1)]||30000));
    this.nextRetryAt=Date.now()+delay;
    this.retryTimer=setTimeout(()=>{
      this.retryTimer=undefined;
      if(generation===this.generation&&username===this.username&&session===this.session)void this.connect(username,session,true);
    },delay);
    this.setStatus('waiting',`${this.message} ${Math.ceil(delay/1000)} saniye sonra yeniden denenecek.`);
  }

  disconnect() {
    this.stopConnection();
    this.ledger = new EventLedger(); this.retryAttempts = 0;
    this.username = '';
    this.session = '';
    this.setStatus('disconnected', 'Bağlantı kesildi.');
  }

  async connect(username, session = randomUUID(), retrying = false) {
    this.stopConnection();
    if(!retrying){this.ledger=new EventLedger();this.retryAttempts=0;}
    this.username = username;
    this.session = session;
    const generation = this.generation;
    const current = () => generation === this.generation;
    this.setStatus('connecting', `@${username} canlı yayını aranıyor...`);
    try {
      const connection = this.createConnection(username);
      this.connection = connection;
      for (const [eventName, type] of this.eventNames) {
        connection.on(eventName, data => {
          if (!current() || this.state !== 'connected') return;
          const event = this.ledger.accept(normalize(type, data));
          if (!event) return;
          // One dispatch ID is shared by every local WebSocket client. The
          // Minecraft side uses it to reject duplicate delivery without
          // confusing two legitimate, rapid gifts from the same viewer.
          this.publish({ ...event, dispatchId: randomUUID(), streamer: username, session });
        });
      }
      connection.on('error', error => {
        if (current() && this.state === 'connected') {
          this.stopConnection();
          this.setStatus('error', explain(error));
          this.scheduleRetry();
        }
      });
      connection.on('disconnected', () => {
        if (!current()) return;
        this.stopConnection();
        this.setStatus('disconnected', `@${username} bağlantısı kesildi. Bağlan düğmesiyle tekrar deneyebilirsiniz.`);
        this.scheduleRetry();
      });
      await Promise.race([
        connection.connect(),
        new Promise((_, reject) => { this.timer = setTimeout(() => reject(new Error('timeout')), this.timeoutMs); })
      ]);
      if (!current()) { try { connection.disconnect(); } catch {} return; }
      clearTimeout(this.timer);
      this.timer = undefined;
      this.retryAttempts = 0;
      this.setStatus('connected', `@${username} canlı yayınına bağlandı. Oyuna girebilirsin.`);
    } catch (error) {
      if (!current()) return;
      this.stopConnection();
      this.setStatus('error', explain(error));
      this.scheduleRetry();
    }
  }
}
