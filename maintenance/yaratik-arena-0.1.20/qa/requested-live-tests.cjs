'use strict';
const fs = require('node:fs');
const { probe } = require('../bridge/probe.cjs');
async function main() {
  const report = { accounts: [], mode: 'receive-only real SDK; isolated roots; no chat or gift sending', startedAt: new Date().toISOString() };
  for (const name of ['rasimbisakin', 'ozgurkarip', 'sapkali.adam', 'maskeli.jokey', 'swkdcn']) {
    const result = await probe(name);
    report.accounts.push(result);
    fs.writeFileSync('requested-live-result.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ username: name, connected: result.connected, status: result.status, reason: result.reason || result.failure, gifts: result.terminalGiftsObserved, avatars: result.avatarEventsObserved, received: result.received }));
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync('requested-live-result.json', JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
