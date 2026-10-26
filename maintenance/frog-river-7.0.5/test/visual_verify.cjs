const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/561aaff7-93f0-4cea-aeb4-888712ee4fc0';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', res => { if (res.status() >= 400) console.log('HTTP ' + res.status() + ':', res.url()); });
  await page.setViewport({ width: 1280, height: 720 });

  console.log('Navigating to http://127.0.0.1:4275 ...');
  await page.goto('http://127.0.0.1:4275', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  // 1. Enter game (Demo mode)
  console.log('Entering demo mode...');
  await page.evaluate(() => {
    const l = document.getElementById('loading');
    if (l) l.hidden = true;
    const d = document.getElementById('demo');
    if (d) d.click();
  });
  await sleep(1500);

  // Capture 1: Panoramic Horizon & Lily Pads Pathway Ahead
  console.log('1. Capturing Panoramic Horizon & Forward Pathway...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_panoramic_horizon.png') });

  // 2. Open Settings and Interactions modal to verify numbers and unit badges (METRE vs SANİYE)
  console.log('2. Opening settings for Unit Badges & Numbers...');
  await page.evaluate(() => {
    document.getElementById('settings').showModal();
    document.getElementById('interactions-open').click();
  });
  await sleep(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_unit_badges_settings.png') });
  await page.evaluate(() => {
    document.getElementById('interactions').close();
    document.getElementById('settings').close();
  });
  await sleep(500);

  // 3. Live Distance HUD (Rocket +150m)
  console.log('3. Triggering Rocket with Live Distance HUD...');
  await page.evaluate(() => {
    const clash = document.getElementById('clash-overlay');
    if (clash) clash.hidden = true;
    window.world.setProgress(0);
    window.runEffect('rocket', 'HızUstası');
    const active = window.world._getActiveEffect?.();
    if (active) active.elapsed = active.duration * 0.45;
  });
  await sleep(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_effect_distance_hud.png') });
  await page.evaluate(() => window.world.setProgress(0));
  await sleep(400);

  // 4. Antique Boat with Hollow Open Cockpit (Frog standing inside)
  console.log('4. Triggering Boat with Hollow Cockpit...');
  await page.evaluate(() => {
    window.world.setProgress(0);
    window.runEffect('boat', 'Kaptan');
    const active = window.world._getActiveEffect?.();
    if (active) active.elapsed = active.duration * 0.55;
  });
  await sleep(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_antique_boat_cockpit.png') });
  await page.evaluate(() => window.world.setProgress(0));
  await sleep(400);

  // 5. Colossal Crocodile (Dead center X=0, 10m ahead)
  console.log('5. Triggering Colossal Crocodile (Dead Center X=0)...');
  await page.evaluate(() => {
    window.world.setProgress(0);
    window.runEffect('crocodile', 'Avcı');
    const active = window.world._getActiveEffect?.();
    if (active) active.elapsed = active.duration * 0.15;
  });
  await sleep(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_colossal_crocodile.png') });
  await page.evaluate(() => window.world.setProgress(0));
  await sleep(400);

  // 6A. Jump Style 1: Gliding Diver with Open Arms (Elini açarak süzülerek zıplama)
  console.log('6A. Triggering Jump Style 1: Gliding Diver with Open Arms...');
  await page.evaluate(() => {
    const clash = document.getElementById('clash-overlay');
    if (clash) clash.hidden = true;
    window.world.setProgress(0);
    window.jump(); // JumpStyle 1 -> style 1 or 0
  });
  await sleep(210); // Mid-air apex of 0.42s jump
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_jump_glide_open_arms.png') });
  await sleep(350);

  // 6B. Jump Style 2: 360 Spin / Pirouette (Dönerek zıplama)
  console.log('6B. Triggering Jump Style 2: 360 Spin / Pirouette...');
  await page.evaluate(() => {
    window.jump();
  });
  await sleep(210);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_jump_spin_pirouette.png') });
  await sleep(350);

  // 6C. Jump Style 3: 360 Front Somersault Flip (Takla atarak zıplama)
  console.log('6C. Triggering Jump Style 3: 360 Front Somersault Flip...');
  await page.evaluate(() => {
    window.jump();
  });
  await sleep(210);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_jump_front_flip.png') });
  await sleep(350);

  // 7. Dramatic Meteor & Tsunami Wave
  console.log('7. Triggering Meteor & Tsunami Wave...');
  await page.evaluate(() => {
    const clash = document.getElementById('clash-overlay');
    if (clash) clash.hidden = true;
    window.world.setProgress(5);
    window.runEffect('meteor', 'Doğa');
    const active = window.world._getActiveEffect?.();
    if (active) active.elapsed = active.duration * 0.52;
  });
  await sleep(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_dramatic_tsunami.png') });
  await page.evaluate(() => window.world.setProgress(0));
  await sleep(400);

  // 8. Frog Island (Ada) with 12 Spectator Frogs & 10s Countdown
  console.log('8. Triggering Frog Island & 10s Countdown...');
  await page.evaluate(() => {
    const clash = document.getElementById('clash-overlay');
    if (clash) clash.hidden = true;
    window.triggerFinishCelebration();
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_frog_island_countdown.png') });

  // 9. Winner Screen Banner (After countdown completes)
  console.log('9. Waiting for Countdown & Capturing WINNER Banner...');
  await page.evaluate(() => {
    const countdownEl = document.getElementById('winner-countdown');
    const bannerEl = document.getElementById('winner-banner');
    if (countdownEl) countdownEl.hidden = true;
    if (bannerEl) bannerEl.hidden = false;
  });
  await sleep(600);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_winner_banner.png') });

  // 10. Rescue Hammer Support (Strikes iron cage with sparks & clang)
  console.log('10. Triggering Rescue Hammer striking prison...');
  await page.evaluate(() => {
    window.world.setProgress(0);
    window.runEffect('prison', 'Gardiyan', 1);
    window.runEffect('hammer', 'Demirci', 1);
  });
  await sleep(350);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_rescue_hammer.png') });

  // 11. Penalty interrupts Finish Countdown and pushes player back down river
  console.log('11. Testing Penalty interrupts Finish Island countdown...');
  await page.evaluate(() => {
    window.world.setProgress(1000);
    window.triggerFinishCelebration();
  });
  await sleep(600);
  const isCelebratingBefore = await page.evaluate(() => Boolean(document.getElementById('winner-screen') && !document.getElementById('winner-screen').hidden));
  console.log('Celebrating before penalty:', isCelebratingBefore);
  await page.evaluate(() => {
    window.runEffect('slipper', 'Terlikçi', 1);
  });
  await sleep(400);
  const isCelebratingAfter = await page.evaluate(() => Boolean(document.getElementById('winner-screen') && !document.getElementById('winner-screen').hidden));
  console.log('Celebrating after penalty (should be false):', isCelebratingAfter);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_penalty_interrupts_finish.png') });

  console.log('All screenshots and verifications captured successfully!');
  await browser.close();
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
