import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createLauncherServer } from '../src/server.mjs';

const { chromium } = createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('compact broadcast fits short canvases and reveals the right winner before returning them to their side', async t => {
  const portraits = path.resolve('../tikmng-arcade-racing/control/live/portraits');
  const images = fs.readdirSync(portraits).filter(name => name.endsWith('.png'));
  let receive;
  const server = await createLauncherServer({
    channel: 'test_host',
    subscribeSharedEvents: listener => { receive = listener; return () => {}; },
    getCachedProfile: username => ({
      username, nickname: username === 'test_host' ? 'Deniz' : 'Arda', avatarUrl: './api/portrait?username=' + username,
    }),
    getPortrait: username => fs.readFileSync(path.join(portraits, images[username === 'test_host' ? 0 : 1])),
  });
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: chrome });
  t.after(() => browser.close());
  const errors = [];
  const output = path.resolve('tests/artifacts');
  fs.mkdirSync(output, { recursive: true });
  const cases = [
    { viewport: { width: 1152, height: 760 }, reducedMotion: 'no-preference' },
    { viewport: { width: 1100, height: 760 }, reducedMotion: 'no-preference' },
    { viewport: { width: 390, height: 780 }, reducedMotion: 'reduce' },
    { viewport: { width: 320, height: 180 }, reducedMotion: 'no-preference' },
    { viewport: { width: 960, height: 250 }, reducedMotion: 'no-preference' },
    { viewport: { width: 960, height: 250 }, reducedMotion: 'reduce' },
  ];
  const pages = await Promise.all(cases.map(async options => {
    const page = await browser.newPage(options);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.widgetUrl);
    await page.locator('.duel-stage[data-phase="idle"]').waitFor();
    return page;
  }));

  const key = new URL(server.controlUrl).searchParams.get('key');
  const post = async (route, body) => {
    const response = await fetch(`${server.baseUrl}/api/live/${route}?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  await post('start', { opponent: 'test_guest', durationSeconds: 10 });
  const live = { source: 'live', channel: 'test_host' };
  const gift = (giftId, count) => receive('gift', {
    eventId: 'gift-' + giftId, giftId, coins: count, repeatCount: count, giftType: 1, repeatEnd: true,
  }, live);
  gift('5655', 20);
  gift('5269', 50);
  gift('999999', 500);
  gift('5269', 50);
  assert.deepEqual(server.getBroadcastState().scores, { left: 20, right: 50 });

  await Promise.all(pages.map(async (page, index) => {
    const { viewport, reducedMotion } = cases[index];
    await page.waitForFunction(() => document.querySelector('#left-score').textContent === '20'
      && document.querySelector('#right-score').textContent === '50'
      && [...document.querySelectorAll('.duelist .portrait')].every(image => !image.hidden && image.naturalWidth > 0));
    const geometry = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const stage = rect('.duel-stage');
      const portraits = [...document.querySelectorAll('.duelist .portrait')].map(image => image.getBoundingClientRect());
      return {
        width: stage.width, height: stage.height, top: stage.top, bottom: stage.bottom,
        portraits: portraits.map(box => ({ width: box.width, height: box.height, x: box.x })),
        captionBottom: rect('#right-handle').bottom,
        clippedCaptions: [...document.querySelectorAll('.player-caption strong, .user-handle')]
          .some(label => label.clientHeight < parseFloat(getComputedStyle(label).fontSize)),
        railBottom: rect('.balance-rail').bottom,
        portraitTop: rect('.portrait-wrap').top,
        railLeft: rect('.balance-rail').left, railRight: rect('.balance-rail').right,
        portraitLeft: rect('.duelist-left .portrait-wrap').left, portraitRight: rect('.duelist-right .portrait-wrap').right,
        captionGap: rect('.player-caption').top - rect('.portrait-wrap').bottom,
        timer: rect('#timer').toJSON(), center: rect('.versus-column').toJSON(),
        stageBackground: getComputedStyle(document.querySelector('.duel-stage')).backgroundColor,
        pageBackground: getComputedStyle(document.body).backgroundColor,
        barColors: ['.balance-rail i', '.balance-rail'].map(selector => getComputedStyle(document.querySelector(selector)).backgroundImage),
      };
    });
    assert.ok(geometry.width <= 448 && geometry.height <= Math.min(236, viewport.height), JSON.stringify(geometry));
    assert.ok(geometry.top >= 0 && geometry.bottom <= viewport.height);
    assert.ok(geometry.captionBottom <= geometry.bottom && geometry.railBottom <= geometry.portraitTop);
    assert.equal(geometry.clippedCaptions, false);
    assert.ok(geometry.portraits.every(box => box.width >= 80 && box.width <= 156 && box.height === box.width));
    assert.ok(geometry.portraits[0].x < geometry.portraits[1].x);
    assert.equal(geometry.pageBackground, 'rgba(0, 0, 0, 0)');
    assert.equal(geometry.stageBackground, 'rgba(0, 0, 0, 0)');
    assert.match(geometry.barColors[0], /rgb\(239, 75, 87\)/);
    assert.match(geometry.barColors[1], /rgb\(57, 216, 135\)/);
    assert.ok(Math.abs(geometry.railLeft - geometry.portraitLeft) < 1 && Math.abs(geometry.railRight - geometry.portraitRight) < 1);
    assert.ok(geometry.captionGap >= 0 && geometry.captionGap <= 4);
    assert.ok(geometry.timer.top >= geometry.center.top && geometry.timer.bottom <= geometry.center.bottom);
    assert.equal(await page.locator('.versus-word, .side-label').count(), 0);
    const share = await page.locator('.balance-rail i').evaluate(node => parseFloat(node.style.width));
    assert.ok(Math.abs(share - 28.57) < .02);
    const motion = await page.locator('.balance-rail').evaluate(rail => ({
      flame: getComputedStyle(rail, '::after').animationName,
      trailingFlame: getComputedStyle(rail, '::before').animationName,
      transition: getComputedStyle(rail.firstElementChild).transitionProperty,
    }));
    assert.deepEqual(motion, reducedMotion === 'reduce'
      ? { flame: 'none', trailingFlame: 'none', transition: 'none' }
      : { flame: 'leader-flame', trailingFlame: 'none', transition: 'width' });
    assert.equal(await page.locator('.gift-chip img').count(), 2);
    const gifts = await page.locator('.gift-chip').evaluateAll(chips => chips.map(chip => {
      const { width, height } = chip.getBoundingClientRect();
      return { width, height };
    }));
    assert.ok(gifts.every(box => box.width <= 28 && Math.abs(box.width - box.height) < 1), JSON.stringify(gifts));
    await page.locator('#gift-flash:empty').waitFor({ state: 'attached' });
    if (viewport.width === 960 && reducedMotion !== 'reduce') {
      await page.screenshot({ path: path.join(output, 'duel-compact-running.png'), omitBackground: true });
    }
    if (viewport.width === 1152) {
      await page.screenshot({ path: path.join(output, 'duel-widget-1152x760.png'), omitBackground: true });
    }
  }));

  await Promise.all(pages.map(async (page, index) => {
    const { viewport, reducedMotion } = cases[index];
    const reveal = page.locator('.winner-reveal');
    await reveal.waitFor({ timeout: 15000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('.winner-portrait img');
      return !image.hidden && image.naturalWidth > 0;
    });
    assert.equal(await reveal.locator('.winner-handle').textContent(), '@test_guest');
    assert.equal(await reveal.locator('.winner-wing').count(), 2);
    assert.equal(await page.locator('#left-avatar').getAttribute('src'), null);
    assert.equal(await page.locator('#left-handle').textContent(), '');
    const still = reducedMotion === 'reduce';
    const animation = await reveal.locator('.winner-wing').first().evaluate(node => getComputedStyle(node).animationName);
    assert.equal(animation, still ? 'none' : 'victory-wing');

    if (viewport.width === 960) {
      const capture = (name) => page.screenshot({
        path: path.join(output, `duel-compact-victory-${name}.png`),
        omitBackground: true,
        timeout: 3500,
      });
      if (still) {
        assert.equal(await reveal.evaluate(node => node.getAnimations({ subtree: true }).length), 0);
        assert.equal(await reveal.locator('.winner-sparks').evaluate(node => getComputedStyle(node).display), 'none');
        await capture('reduced');
      } else {
        const pose = (time) => reveal.evaluate((node, ms) => {
          for (const effect of node.getAnimations({ subtree: true })) {
            effect.pause();
            effect.currentTime = ms;
          }
          const rect = selector => node.querySelector(selector).getBoundingClientRect().toJSON();
          return {
            wings: [...node.querySelectorAll('.wing-flight')].map(wing => wing.getBoundingClientRect().toJSON()),
            sparks: [...node.querySelectorAll('.winner-spark')].map(spark => Number(getComputedStyle(spark).opacity)),
            rays: Number(getComputedStyle(node.querySelector('.winner-rays')).opacity),
            portrait: rect('.winner-portrait'),
            label: rect('.winner-label'),
            handle: rect('.winner-handle'),
            stage: node.parentElement.getBoundingClientRect().toJSON(),
          };
        }, time);
        const open = await pose(480);
        await capture('open');
        const flap = await pose(780);
        await capture('flap');
        const rebound = await pose(1100);
        const widths = [open, flap, rebound].map(frame => frame.wings[0].width);
        assert.ok(widths[0] > widths[1] * 1.2 && widths[2] > widths[1] * 1.15, `Wing widths: ${widths.join(', ')}`);
        assert.ok(open.wings[1].right - open.wings[0].left > open.stage.width * .65);
        for (const wing of [...open.wings, ...rebound.wings]) {
          assert.ok(wing.top >= 6 && wing.bottom <= 244, `Wing bounds: ${wing.top}–${wing.bottom}`);
        }
        assert.ok(open.sparks.some(opacity => opacity > .85) && open.rays > .75);
        assert.ok(open.portrait.width >= 100 && Math.abs(open.portrait.x + open.portrait.width / 2 - 480) <= 1);
        assert.ok(open.label.top >= 0 && open.handle.bottom < 250);
        await reveal.evaluate(node => node.getAnimations({ subtree: true }).forEach(effect => effect.play()));
      }
    }
    await reveal.waitFor({ state: 'hidden', timeout: 3700 });
    assert.equal(await page.locator('#right-handle').textContent(), '@test_guest');
    assert.equal(await page.locator('#right-avatar').isVisible(), true);
    assert.equal(await page.locator('#left-fallback').isVisible(), true);
  }));

  const result = server.getBroadcastState();
  assert.equal(result.phase, 'finished');
  assert.equal(result.lastResult.winnerSide, 'right');
  assert.equal(result.owner, null);
  assert.equal(result.opponent.username, 'test_guest');
  receive('member', { username: 'test_host' }, live);
  const { snapshot: next } = await post('next', {});
  assert.equal(next.phase, 'idle');
  assert.equal(next.owner, null);
  assert.equal(next.opponent.username, 'test_guest');
  assert.deepEqual(next.scores, { left: 0, right: 0 });
  assert.deepEqual(errors, []);
});

test('compact empty, paused and leading states keep the clock central and effects on the leading bar only', async t => {
  const server = await createLauncherServer({ channel: 'test_host', autoSelectOwner: false, subscribeSharedEvents: () => () => {} });
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: chrome });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 960, height: 250 } });
  await page.route('**/widget.mjs', route => route.fulfill({
    contentType: 'text/javascript',
    body: "import { mountDuelWidget } from './widget-view.mjs'; window.renderDuel = mountDuelWidget(document, { localPortraits: false }).render;",
  }));
  await page.goto(server.widgetUrl);
  await page.waitForFunction(() => typeof window.renderDuel === 'function');
  const render = snapshot => page.evaluate(state => window.renderDuel(state), snapshot);
  const empty = { phase: 'idle', remainingMs: 120000, scores: { left: 0, right: 0 } };
  await render(empty);
  assert.deepEqual(await page.locator('.player-caption strong').allTextContents(), ['Bir oyuncu seç', 'Bir oyuncu seç']);
  const output = path.resolve('tests/artifacts');
  fs.mkdirSync(output, { recursive: true });
  await page.locator('.duel-stage').screenshot({ path: path.join(output, 'duel-compact-empty.png'), omitBackground: true });
  const running = { ...empty, phase: 'running', owner: { username: 'deniz' }, opponent: { username: 'arda', nickname: 'Arda' } };
  await render(running);
  assert.equal(await page.locator('#left-name').textContent(), 'deniz');
  const flames = () => page.locator('.balance-rail').evaluate(rail => ['::before', '::after'].map(pseudo => {
    const css = getComputedStyle(rail, pseudo);
    return { name: css.animationName, opacity: Number(css.opacity) };
  }));
  assert.deepEqual(await flames(), [{ name: 'none', opacity: 0 }, { name: 'none', opacity: 0 }]);
  for (const [scores, leader] of [[{ left: 10, right: 3 }, 0], [{ left: 10, right: 30 }, 1], [{ left: 50, right: 0 }, 0], [{ left: 0, right: 50 }, 1]]) {
    await render({ ...running, scores });
    const effects = await flames();
    assert.equal(effects[leader].name, 'leader-flame');
    assert.deepEqual(effects[1 - leader], { name: 'none', opacity: 0 });
    const flame = await page.locator('.balance-rail').evaluate((rail, leader) => {
      const css = getComputedStyle(rail, leader === 0 ? '::before' : '::after');
      const width = parseFloat(css.width), height = parseFloat(css.height);
      const split = rail.clientWidth * parseFloat(rail.style.getPropertyValue('--flame-share')) / 100;
      const left = leader === 0 ? parseFloat(css.left) : rail.clientWidth - parseFloat(css.right) - width;
      return { width, height, insideLeading: leader === 0 ? left >= 0 && left + width <= split : left >= split && left + width <= rail.clientWidth };
    }, leader);
    assert.ok(flame.width <= 12 && flame.height <= 14 && flame.insideLeading, JSON.stringify(flame));
  }
  await render({ ...running, phase: 'paused', remainingMs: 87000, scores: { left: 10, right: 30 } });
  assert.equal(await page.locator('#phase').textContent(), 'DURAKLATILDI');
  assert.equal(await page.locator('#timer').textContent(), '01:27');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#timer').textContent(), '01:27');
  assert.deepEqual(await flames(), [{ name: 'none', opacity: 0 }, { name: 'none', opacity: 0 }]);
  const alignment = await page.locator('#phase').evaluate(label => {
    const box = label.getBoundingClientRect(), center = document.querySelector('.versus-column').getBoundingClientRect();
    return { center: Math.abs(box.x + box.width / 2 - (center.x + center.width / 2)), fits: label.scrollWidth <= label.clientWidth };
  });
  assert.ok(alignment.center < 1 && alignment.fits);
  await page.locator('.duel-stage').screenshot({ path: path.join(output, 'duel-compact-paused.png'), omitBackground: true });
  await render(empty);
  assert.equal(await page.locator('#timer').textContent(), '02:00');
  assert.equal(await page.locator('#left-avatar').getAttribute('src'), null);
  await render({ ...running, phase: 'finished', scores: { left: 50, right: 0 } });
  assert.deepEqual(await flames(), [{ name: 'none', opacity: 0 }, { name: 'none', opacity: 0 }]);
});

test('the relay-shaped result uses the selected portrait, reveals once, and cancels on a new snapshot', async t => {
  const server = await createLauncherServer({ channel: 'test_host', subscribeSharedEvents: () => () => {} });
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: chrome });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.route('**/widget.mjs', route => route.fulfill({
    contentType: 'text/javascript',
    body: "import { mountDuelWidget } from './widget-view.mjs'; window.renderDuel = mountDuelWidget(document, { localPortraits: false }).render;",
  }));
  await page.goto(server.widgetUrl);
  await page.waitForFunction(() => typeof window.renderDuel === 'function');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const render = snapshot => page.evaluate(state => window.renderDuel(state), snapshot);
  const reveal = page.locator('.winner-reveal');
  const left = { username: 'sol', nickname: 'Sol', avatarUrl: './gifts/5655.png' };
  const right = { username: 'sag', nickname: 'Sağ' };
  const finished = {
    phase: 'finished', owner: left, opponent: null, lastResult: { winner: { username: 'sol', avatarUrl: '/unrewritten-result.png' } },
  };
  await render(finished);
  assert.equal(await reveal.isHidden(), true, 'Loading an old result does not replay its reveal');
  await render({ phase: 'running', owner: left, opponent: right });
  await render({ phase: 'finished', owner: left, opponent: right, lastResult: { winner: null } });
  assert.equal(await reveal.isHidden(), true);
  assert.equal(await page.locator('#right-handle').textContent(), '@sag');
  await render({ phase: 'running', owner: left, opponent: right });
  await render(finished);
  await reveal.waitFor();
  assert.match(await reveal.locator('img').getAttribute('src'), /\/gifts\/5655\.png$/);
  await render(finished);
  assert.equal(await reveal.isVisible(), true);
  await render({ phase: 'idle', owner: null, opponent: right });
  assert.equal(await reveal.isHidden(), true);
  assert.equal(await reveal.locator('img').getAttribute('src'), null);
  assert.equal(await page.locator('#left-avatar').getAttribute('src'), null);
  assert.equal(await page.locator('#right-handle').textContent(), '@sag');
  assert.equal(requests.some(url => url.includes('api/portrait') || url.includes('unrewritten-result')), false);
});

