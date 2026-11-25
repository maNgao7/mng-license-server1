import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createLauncherServer} from '../src/server.mjs';
const {chromium}=createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('photo picker selects and removes each side; broadcast stays clean and compact in tall layouts',async t=>{
 const portrait=fs.readFileSync(path.resolve('../widget-overhaul-preview-20261105/renderer/assets/game-covers/profile-duel-v1.png'));
 let receive;
 const host=await createLauncherServer({channel:'host',subscribeSharedEvents:fn=>{receive=fn;return()=>{};},
  getCachedProfile:username=>({username,nickname:username,avatarUrl:'./api/portrait?username='+username}),getPortrait:()=>portrait,
  getParticipants:()=>[{username:'giver',coins:15},{username:'writer',commented:true},{username:'liker',totalLikes:50}]});
 t.after(()=>host.close());
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:1000}});await page.goto(host.controlUrl);
 const frame=page.frameLocator('.preview-frame iframe');await frame.locator('.player-remove').first().waitFor();
 await frame.locator('[aria-label="Sol profili kaldır"]').click();
 const pick = frame.locator('[aria-label="Sol oyuncu seç"]');
 const caption = await pick.evaluate(button => {
  const label = button.parentElement.querySelector('.player-caption').getBoundingClientRect();
  const portrait = button.parentElement.querySelector('.portrait-wrap').getBoundingClientRect();
  const bounds = button.getBoundingClientRect(), css = getComputedStyle(button);
  return { gap: label.top - portrait.bottom, color: css.color, fontSize: css.fontSize,
   x: label.x + label.width / 2 - bounds.x, y: label.y + label.height / 2 - bounds.y };
 });
 assert.ok(caption.gap >= 0 && caption.gap <= 4);
 assert.equal(caption.color, 'rgba(0, 0, 0, 0)');
 assert.equal(caption.fontSize, '0px', 'Selection text appears in the caption, without a duplicate over the portrait');
 await pick.click({ position: { x: caption.x, y: caption.y } });
 await page.locator('.profile-dialog[open]').waitFor();
 await page.locator('[data-person="giver"]').click();
 await frame.locator('#left-handle').filter({hasText:'@giver'}).waitFor();
 await frame.locator('[aria-label="Sağ oyuncu seç"]').click();
 await page.locator('[data-group="chat"]').click();
 assert.equal(await page.locator('[data-person="giver"]').count(),0);
 await page.locator('[data-person="writer"]').click();
 await frame.locator('#right-handle').filter({hasText:'@writer'}).waitFor();
 await frame.locator('[aria-label="Sağ profili kaldır"]').click();
 await frame.locator('[aria-label="Sağ oyuncu seç"]').click();
 await page.locator('[data-group="like"]').click();
 await page.locator('[data-person="liker"]').click();
 await frame.locator('#right-handle').filter({hasText:'@liker'}).waitFor();
 const namesFit=await frame.locator('#right-handle').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight);
 assert.equal(namesFit,true,'Names fit inside the actual 16:9 control preview canvas');
 await frame.locator('[aria-label="Sağ profili kaldır"]').click();
 await frame.locator('[aria-label="Sağ oyuncu seç"]').click();
 await page.locator('[data-group="like"]').click();
 await page.locator('[data-person="liker"]').click();
 await frame.locator('#right-avatar[src]').waitFor();
 receive('chat',{username:'new_writer'},{source:'live',channel:'host'});
 const publicPage=await browser.newPage({viewport:{width:1584,height:1278}});await publicPage.goto(host.widgetUrl);
 await publicPage.locator('#left-handle').filter({hasText:'@giver'}).waitFor();
 await publicPage.waitForFunction(()=>[...document.querySelectorAll('.portrait')].every(i=>i.complete&&i.naturalWidth));
 await publicPage.waitForTimeout(900);
 assert.equal(await publicPage.locator('.player-select,.player-remove,.profile-dialog').count(),0);
 const geometry=await publicPage.evaluate(()=>{
  const rect=selector=>document.querySelector(selector).getBoundingClientRect();
  return {gap:rect('.portrait-wrap').top-rect('.balance-rail').bottom,profileGap:rect('.duelist-right .portrait-wrap').left-rect('.duelist-left .portrait-wrap').right,
   giftInside:rect('#left-gift').top>rect('.portrait-wrap').top,giftWidth:rect('#left-gift').width,labelVisible:getComputedStyle(document.querySelector('.gift-chip span')).display!=='none'};
 });
 assert.ok(geometry.gap>=0&&geometry.gap<=4,JSON.stringify(geometry));assert.ok(geometry.profileGap<=136);assert.equal(geometry.giftInside,true);assert.ok(geometry.giftWidth>=18&&geometry.giftWidth<=28);assert.equal(geometry.labelVisible,false);
 fs.mkdirSync(path.resolve('tests/artifacts'),{recursive:true});
 await publicPage.screenshot({path:path.resolve('tests/artifacts/duel-tall-compact.png'),omitBackground:true});
 await page.locator('#start-round').click();
 await frame.locator('.duel-stage[data-phase="running"]').waitFor();
 assert.equal(await frame.locator('.player-remove:visible').count(),0);
 const key=new URL(host.controlUrl).searchParams.get('key');
 const mutation=await fetch(host.baseUrl+'/api/live/player?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({side:'left',username:null})});assert.equal(mutation.status,409);
});

test('picker keeps native portraits and stable rows, and retries missing photos in chat and likes', async t => {
  const portrait = fs.readFileSync(path.resolve('../widget-overhaul-preview-20261105/renderer/assets/game-covers/profile-duel-v1.png'));
  const ready = new Set();
  let receive;
  const host = await createLauncherServer({
    channel: 'host',
    subscribeSharedEvents: fn => { receive = fn; return () => {}; },
    getCachedProfile: username => ({ username, avatarUrl: `./api/portrait?username=${username}&v=0` }),
    getPortrait: username => ready.has(username) ? portrait : null,
  });
  t.after(() => host.close());
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.route('https://portrait.test/**', route => route.request().url().endsWith('/giver.png')
    ? route.fulfill({ contentType: 'image/png', body: portrait }) : route.fulfill({ status: 404 }));
  const live = { source: 'live', channel: 'host' };
  const gift = (username, eventId, avatar) => receive('gift', { username, eventId, avatar, coins: 1 }, live);
  gift('giver', 'initial', 'https://portrait.test/giver.png');
  receive('chat', { username: 'writer', avatar: 'https://portrait.test/missing.png' }, live);
  receive('like', { username: 'liker', count: 20 }, live);
  await page.goto(host.controlUrl);
  const frame = page.frameLocator('.preview-frame iframe');
  await frame.locator('[aria-label="Sağ oyuncu seç"]').click();
  const giver = page.locator('[data-person="giver"]');
  await giver.locator('img[data-ready]').waitFor();
  assert.equal(await giver.locator('img').getAttribute('src'), 'https://portrait.test/giver.png');
  await giver.evaluate(row => { row.dataset.original = 'true'; row.focus(); });
  gift('giver', 'stats-only');
  gift('another', 'new-row');
  await page.locator('[data-person="another"]').waitFor();
  assert.equal(await giver.getAttribute('data-original'), 'true');
  assert.equal(await giver.evaluate(row => row === document.activeElement), true);
  await giver.locator('img[data-ready]').waitFor();

  for (const [group, username] of [['chat', 'writer'], ['like', 'liker']]) {
    const miss = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/portrait' && url.searchParams.get('username') === username && response.status() === 404;
    });
    await page.locator(`[data-group="${group}"]`).click();
    await miss;
    ready.add(username);
    const photo = page.locator(`[data-person="${username}"] img[data-ready]`);
    await photo.waitFor({ timeout: 3500 });
    assert.match(await photo.getAttribute('src'), /retry=/);
  }
  await page.locator('[data-group="chat"]').click();
  await page.locator('[data-person="writer"]').click();
  await frame.locator('#right-handle').filter({ hasText: '@writer' }).waitFor();
  await frame.locator('#right-avatar:not([hidden])').waitFor();
});

test('full-window player picker stays usable on either side, across resizing and long lists', async t => {
  const portrait = fs.readFileSync(path.resolve('../widget-overhaul-preview-20261105/renderer/assets/game-covers/profile-duel-v1.png'));
  const people = Array.from({length: 85}, (_, i) => ({
    username: 'viewer' + String(i).padStart(2, '0'),
    nickname: 'İzleyici ' + String(i).padStart(2, '0'),
    coins: 100 - i, commented: true, totalLikes: i + 1,
  }));
  const host = await createLauncherServer({
    channel: 'host', subscribeSharedEvents: () => () => {},
    getParticipants: () => people,
    getCachedProfile: username => ({username, avatarUrl: './api/portrait?username=' + username}),
    getPortrait: () => portrait,
  });
  t.after(() => host.close());
  const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 2560, height: 1440}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(host.controlUrl);
  const frame = page.frameLocator('.preview-frame iframe');
  const dialog = page.locator('.profile-dialog');
  const left = frame.locator('[aria-label="Sol oyuncu seç"]');
  const right = frame.locator('[aria-label="Sağ oyuncu seç"]');
  await left.click();
  await page.locator('[data-person="viewer00"]').waitFor();
  assert.equal(await frame.locator('.profile-dialog').count(), 0, 'Dialog must escape the clipped preview iframe');
  assert.equal(await page.locator('.picker-person').count(), 40);
  assert.equal(await page.locator('.picker-search').evaluate(e => e === document.activeElement), true);
  async function geometry(side, width, height) {
    const box = await dialog.boundingBox();
    const preview = await page.locator('.preview-frame').boundingBox();
    assert.ok(box.height > height * .9 && box.height > preview.height, JSON.stringify(box));
    assert.ok(box.y >= 0 && box.y + box.height <= height + 1);
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
    assert.ok(side === 'left' ? box.x <= 24 : width - box.x - box.width <= 24.1);
    const list = await page.locator('.picker-people').boundingBox();
    assert.ok(list.height > height * .5, JSON.stringify(list));
    const search = await page.locator('.picker-search').boundingBox();
    assert.ok(search.y > box.y && search.y + search.height < list.y);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await geometry('left', 2560, 1440);
  fs.mkdirSync(path.resolve('tests/artifacts'), {recursive:true});
  await page.screenshot({path:path.resolve('tests/artifacts/picker-left-058.png')});
  await page.locator('.picker-more').click();
  assert.equal(await page.locator('.picker-person').count(), 80);
  await page.locator('[data-person="viewer65"]').click();
  await frame.locator('#left-handle').filter({hasText:'@viewer65'}).waitFor();
  await right.click();
  await page.locator('[data-person="viewer00"]').waitFor();
  await geometry('right', 2560, 1440);
  await page.locator('.picker-search').fill('viewer65');
  assert.equal(await page.locator('[data-person="viewer65"]').isDisabled(), true, 'Same player cannot be selected for both sides');
  await page.locator('.picker-search').fill('not-present');
  await page.locator('.picker-empty').filter({hasText:'Bu aramada profil bulunamadı.'}).waitFor();
  await page.locator('.picker-search').fill('');
  await page.locator('[data-group="chat"]').click();
  await page.locator('.picker-search').fill('viewer84');
  await page.locator('[data-person="viewer84"]').click();
  await frame.locator('#right-handle').filter({hasText:'@viewer84'}).waitFor();
  await right.click();
  await page.locator('[data-person="viewer00"]').waitFor();
  await page.screenshot({path:path.resolve('tests/artifacts/picker-right-058.png')});
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.profile-dialog').open &&
    document.querySelector('iframe[data-profile-editor]').contentDocument.activeElement?.getAttribute('aria-label') === 'Sağ oyuncu seç');
  assert.equal(await right.evaluate(e => e === document.activeElement), true, 'Escape restores focus to the preview selection button');
  for (const viewport of [{width:1152,height:760},{width:390,height:780}]) {
    await page.setViewportSize(viewport);
    await left.click();
    await page.locator('[data-person="viewer00"]').waitFor();
    await geometry('left', viewport.width, viewport.height);
    await page.locator('.picker-close').click();
    await right.click();
    await page.locator('[data-person="viewer00"]').waitFor();
    await geometry('right', viewport.width, viewport.height);
    await page.locator('.picker-more').click();
    await page.locator('.picker-more').click();
    assert.equal(await page.locator('.picker-person').count(), 85);
    await page.locator('[data-person="viewer80"]').click();
    await frame.locator('#right-handle').filter({hasText:'@viewer80'}).waitFor();
  }
  // A keyed widget opened outside its launcher retains a working local picker.
  const widget = await browser.newPage({viewport:{width:1000,height:800}});
  await widget.goto(host.widgetUrl + '?key=' + new URL(host.controlUrl).searchParams.get('key'));
  await widget.locator('[aria-label="Sol oyuncu seç"]').click();
  await widget.locator('[data-person="viewer00"]').waitFor();
  assert.equal(await widget.locator('.profile-dialog[open]').count(), 1);
  await widget.close();
  assert.deepEqual(errors, []);
});
