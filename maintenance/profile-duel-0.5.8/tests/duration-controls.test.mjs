import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import fc from 'fast-check';
import { durationToSeconds } from '../web/duration-control.mjs';
import { createLauncherServer, createPreviewServer } from '../src/server.mjs';

const { chromium } = createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('duration conversion preserves legacy seconds, decimal minutes and existing bounds', () => {
  assert.equal(durationToSeconds(120), 120);
  assert.equal(durationToSeconds('125', 'seconds'), 125);
  assert.equal(durationToSeconds(2, 'minutes'), 120);
  assert.equal(durationToSeconds('1.5', 'minutes'), 90);
  assert.equal(durationToSeconds(10 / 60, 'minutes'), 10);
  assert.equal(durationToSeconds(60, 'minutes'), 3600);
  assert.equal(durationToSeconds(1.01, 'minutes'), 61);
  for (const [value, unit] of [['', 'seconds'], [9, 'seconds'], [3601, 'seconds'], [.1, 'minutes'], [61, 'minutes'], ['abc', 'minutes'], [Infinity, 'seconds'], [2, 'hours']]) {
    assert.throws(() => durationToSeconds(value, unit), RangeError);
  }
});

test('fast-check preserves actual whole seconds through minute conversion', () => {
  fc.assert(fc.property(fc.integer({ min: 10, max: 3600 }), seconds => {
    assert.equal(durationToSeconds(seconds / 60, 'minutes'), seconds);
    assert.equal(durationToSeconds(seconds, 'seconds'), seconds);
  }), { numRuns: 1000, seed: 20261115 });
});

test('both control pages convert units before starting real server timers', async t => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  t.after(() => browser.close());
  for (const mode of ['preview', 'launcher']) await t.test(mode, async t => {
    const host = mode === 'preview'
      ? await createPreviewServer({ port: 0 })
      : await createLauncherServer({ channel: 'host', subscribeSharedEvents: () => () => {} });
    t.after(() => host.close());
    const page = await browser.newPage({ viewport: { width: 1152, height: 760 } });
    t.after(() => page.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = () => fetch(`${host.baseUrl}/api/state`).then(response => response.json());
    if (mode === 'launcher') {
      const key = new URL(host.controlUrl).searchParams.get('key');
      const response = await fetch(`${host.baseUrl}/api/live/player?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side: 'right', username: 'guest' }),
      });
      assert.equal(response.status, 200);
    }
    await page.goto(mode === 'preview' ? host.baseUrl : host.controlUrl);
    if (mode === 'launcher') await page.locator('#start-round:enabled').waitFor();
    const input = page.locator('#duration'), unit = page.locator('#duration-unit');
    const start = page.locator(mode === 'preview' ? 'button[type="submit"]' : '#start-round');
    const reset = page.locator(mode === 'preview' ? '#reset-button' : '#reset-round');
    const pause = page.locator(mode === 'preview' ? '#pause-button' : '#pause-round');
    assert.equal(await unit.inputValue(), 'seconds');
    assert.equal(await input.inputValue(), '120');
    await unit.selectOption('minutes');
    assert.equal(await input.inputValue(), '2');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (mode === 'launcher') {
      fs.mkdirSync('tests/artifacts', { recursive: true });
      await page.screenshot({ path: 'tests/artifacts/duel-control-1152x760.png' });
    }
    await input.fill('1.5');
    await start.click();
    await pause.locator(':scope:enabled').waitFor();
    let snapshot = await state();
    assert.equal(snapshot.durationSeconds, 90);
    assert.ok(snapshot.remainingMs > 85000 && snapshot.remainingMs <= 90000);
    await pause.click();
    await page.getByRole('button', { name: 'Devam et', exact: true }).waitFor();
    const frozen = (await state()).remainingMs;
    await page.waitForTimeout(350);
    assert.equal((await state()).remainingMs, frozen);
    await pause.click();
    await page.getByRole('button', { name: 'Duraklat', exact: true }).waitFor();
    assert.equal((await state()).phase, 'running');
    await reset.click();
    await pause.locator(':scope:disabled').waitFor();
    await unit.selectOption('seconds');
    assert.equal(await input.inputValue(), '90');
    await input.fill('125');
    await unit.selectOption('minutes');
    assert.ok(Math.abs(Number(await input.inputValue()) - 125 / 60) < 1e-10);
    await unit.selectOption('seconds');
    assert.equal(await input.inputValue(), '125');
    // Subsequent SSE snapshots must not overwrite an edit for the next round.
    await page.waitForTimeout(350);
    assert.equal(await input.inputValue(), '125');
    await start.click();
    await pause.locator(':scope:enabled').waitFor();
    assert.equal((await state()).durationSeconds, 125);
    await reset.click();
    await pause.locator(':scope:disabled').waitFor();
    await unit.selectOption('minutes');
    for (const invalid of ['', '.1', '61']) {
      await input.fill(invalid);
      await start.click();
      assert.equal((await state()).phase, 'idle');
    }
    await input.fill('0.5');
    await start.click();
    await pause.locator(':scope:enabled').waitFor();
    assert.equal((await state()).durationSeconds, 30);
    await reset.click();
    await pause.locator(':scope:disabled').waitFor();
    for (const [minutes, seconds] of [[10 / 60, 10], [1.01, 61], [60, 3600]]) {
      await input.fill(String(minutes));
      await start.click();
      await pause.locator(':scope:enabled').waitFor();
      snapshot = await state();
      assert.equal(snapshot.durationSeconds, seconds);
      assert.ok(snapshot.remainingMs > (seconds - 5) * 1000 && snapshot.remainingMs <= seconds * 1000);
      await reset.click();
      await pause.locator(':scope:disabled').waitFor();
    }
    await input.fill('');
    await unit.selectOption('seconds');
    assert.equal(await input.inputValue(), '', 'Switching units preserves an empty edit');
    await start.click();
    assert.equal((await state()).phase, 'idle');
    snapshot = await state();
    assert.deepEqual(snapshot.scores, { left: 0, right: 0 });
    assert.deepEqual(errors, []);
  });
});
