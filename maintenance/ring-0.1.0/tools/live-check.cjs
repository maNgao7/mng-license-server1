'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { AudienceQueue } = require('../src/audience-queue.cjs');
const { createHediyeBoxLive } = require('../src/live-client.cjs');
const username = process.argv[2] || 'tenhaa.34';
const reportFile = path.resolve(__dirname, '../qa/live-check.json');
const report = { schemaVersion: 2, startedAt: new Date().toISOString(), username,
  scope: 'live_events_and_audience_queue', nativePunchTested: false,
  connected: false, chatEvents: 0, receivedGiftPackets: 0, likeEvents: 0,
  eventsWithPortraitUrl: 0, participantsJoined: 0, chatJoins: 0, giftJoins: 0, statusHistory: [] };
const audience = new AudienceQueue({kingOfRing: true});
function observe(event, counter, ingest) {
  report[counter]++;
  if (event.profilePictureUrl) report.eventsWithPortraitUrl++;
  if (audience[ingest](event).joined) {
    report.participantsJoined++;
    if (ingest === 'ingestChat') report.chatJoins++;
    if (ingest === 'ingestGift') report.giftJoins++;
  }
}
let stopping = false;
const live = createHediyeBoxLive({
  onStatus(status) {
    report.connected ||= status.status === 'connected';
    const item = { status: status.status, reason: status.reason || '', message: status.message };
    if (JSON.stringify(item) !== JSON.stringify(report.statusHistory.at(-1))) {
      report.statusHistory.push(item); console.log(JSON.stringify(item));
    }
  },
  onChat: event => observe(event, 'chatEvents', 'ingestChat'),
  onLike: event => observe(event, 'likeEvents', 'ingestLike'),
  onGiftRaw: event => observe(event, 'receivedGiftPackets', 'ingestGift'),
});
function stop() {
  if (stopping) return;
  stopping = true; clearTimeout(timeout); live.close(); report.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(reportFile), {recursive:true});
  const temp = reportFile + '.tmp'; fs.writeFileSync(temp, JSON.stringify(report, null, 2)); fs.renameSync(temp, reportFile);
  const {statusHistory, ...summary} = report;
  console.log(JSON.stringify(summary));
  setTimeout(() => process.exit(0), 300).unref();
}
const timeout = setTimeout(stop, 60000);
live.start(username).catch(() => { console.log('Yayın kontrolü tamamlanamadı.'); stop(); });
process.once('SIGINT', stop);
