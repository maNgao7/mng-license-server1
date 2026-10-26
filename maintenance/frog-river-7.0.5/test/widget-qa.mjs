import { execute, assert, until, freePort } from '../../pony-life/tests/widget-qa-support.mjs';

await execute('frog-river', async qa => {
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const settings = await qa.fixture('synthetic-settings.json', { goal: 500, wins: 3, targetWins: 10, volume: 0, quality: 'low', username: '' });
  const env = { FROG_PORT: String(port), FROG_SETTINGS_FILE: settings };
  let server = await qa.server('server.js', env, 'mng-frog-river', port);
  await qa.check('no standalone widget or leaderboard route is advertised or served', async () => {
    for (const route of ['/widget', '/widget.html', '/api/leaderboard', '/api/widget-state']) {
      const r = await fetch(base + route); assert.equal(r.status, 404); qa.report.urls.push(`${base}${route} [404: no such contract]`);
    }
  });
  const page = await qa.page(base);
  await qa.check('actual game document, isolated synthetic settings, assets and nonblank 3D canvas', async () => {
    await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
    assert.equal(await page.locator('#wins-count').innerText(), '3');
    assert.equal(await page.locator('#target').innerText(), '500');
    await until(() => page.evaluate(() => window.__qaFrames.includes('status')));
    await qa.canvas(page, 'initial-game'); await qa.capture(page, 'initial-game');
    for (const route of ['/vendor/three/build/three.module.js', '/vendor/lucide/lucide.js', '/world.js', '/assets/river_valley_bg.jpg']) assert.equal((await fetch(base + route)).status, 200);
  });
  await qa.check('authenticated WS initial status and reconnect after owned server restart', async () => {
    const session = await qa.json(`${base}/api/session`);
    const ws = await qa.socket(`ws://127.0.0.1:${port}/live?token=${encodeURIComponent(session.token)}`, base);
    await until(() => ws.frames.some(f => f.type === 'status' && f.status === 'disconnected'));
    ws.close(); await server.stop();
    server = await qa.server('server.js', env, 'mng-frog-river', port);
    await until(() => page.evaluate(() => window.__qaFrames.filter(t => t === 'status').length >= 2));
    const reloaded = await qa.json(`${base}/api/settings`); assert.equal(reloaded.wins, 3);
    await qa.capture(page, 'recovered-game');
  });
  await qa.check('settings writes stay in the explicit isolated file and browser runtime is clean', async () => {
    await qa.json(`${base}/api/settings`, { goal: 600, wins: 4, volume: 0, quality: 'low' });
    assert.equal((await qa.json(`${base}/api/settings`)).wins, 4);
    assert(qa.report.pages.every(p => !p.pageErrors.length && !p.localErrors.length));
  });
});
