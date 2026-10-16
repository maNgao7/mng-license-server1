import { randomUUID } from 'node:crypto';
import { normalize, explain, EventLedger } from './events.js';

// A generation isolates late callbacks from a broadcaster that was replaced or disconnected.
export class LiveSession {
  constructor(createConnection, eventNames, publish, timeoutMs = 30000) {
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
  }

  snapshot() {
    return { username: this.username, session: this.session, state: this.state, message: this.message };
  }

  setStatus(state, message) {
    this.state = state;
    this.message = message;
    this.publish({ type: 'status', ...this.snapshot() });
  }

  stopConnection() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = undefined;
    const connection = this.connection;
    this.connection = undefined;
    this.ledger = new EventLedger();
    try { connection?.disconnect(); } catch {}
  }

  disconnect() {
    this.stopConnection();
    this.username = '';
    this.session = '';
    this.setStatus('disconnected', 'Bağlantı kesildi.');
  }

  async connect(username, session = randomUUID()) {
    this.stopConnection();
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
        }
      });
      connection.on('disconnected', () => {
        if (!current()) return;
        this.stopConnection();
        this.setStatus('disconnected', `@${username} bağlantısı kesildi. Bağlan düğmesiyle tekrar deneyebilirsiniz.`);
      });
      await Promise.race([
        connection.connect(),
        new Promise((_, reject) => { this.timer = setTimeout(() => reject(new Error('timeout')), this.timeoutMs); })
      ]);
      if (!current()) { try { connection.disconnect(); } catch {} return; }
      clearTimeout(this.timer);
      this.timer = undefined;
      this.setStatus('connected', `@${username} canlı yayınına bağlandı. Oyuna girebilirsin.`);
    } catch (error) {
      if (!current()) return;
      this.stopConnection();
      this.setStatus('error', explain(error));
    }
  }
}
