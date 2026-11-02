'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict');
const sharp = require('../bridge/node_modules/sharp');
const q = require('./commands.cjs');
const captures = [], sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  await q.send('lock', { enabled: false });
  await q.send('native-resume');
  for (const [width, height] of [[1280, 720], [800, 600]]) {
    await q.send('resolution', { width, height }); await sleep(400);
    for (const view of [{ tab: 0 }, { tab: 1 }, { tab: 1, actionPage: 1 }, { tab: 1, addingAction: true }, { tab: 2 }, { tab: 3, optionPage: 0 }, { tab: 3, optionPage: 1 }, { tab: 3, optionPage: 2 }, { tab: 3, optionPage: 3 }]) {
      await q.send('menu', { open: true, addingAction: false, actionPage: 0, ...view });
      await q.wait(s => s.menuRendered, 'Native menu render');
      assert.equal(q.state().hudError, ''); assert.equal(q.state().failed, false);
      const seq = (await q.send('capture')).seq;
      captures.push({ width, height, ...view, seq });
      const header = await sharp('capture-' + seq + '.png').extract({ left: Math.floor((width - Math.min(1100, width - 40)) / 2) + 1, top: Math.floor((height - Math.min(640, height - 32)) / 2) + 1, width: Math.min(1100, width - 40) - 2, height: 70 }).png().toBuffer();
      const stats = await sharp(header).stats();
      assert.ok(stats.channels[0].mean > 160 && stats.channels[1].mean > 150, 'Native cream brand header is visible, not faded');
    }
  }
  await q.send('menu', { open: false, addingAction: false });
  await q.send('resolution', { width: 1280, height: 720 });
  fs.writeFileSync('menu-visual-result.json', JSON.stringify({ passed: true, captures }, null, 2));
  console.log(JSON.stringify({ passed: true, screenshots: captures.length, captures }));
}
main().catch(async error => { try { await q.send('menu', { open: false, addingAction: false }); await q.send('lock', { enabled: false }); } catch {} console.error(error); process.exitCode = 1; });
