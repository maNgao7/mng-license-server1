'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), q = require('./commands.cjs');
const original = JSON.parse(fs.readFileSync('settings-before-0.1.12.json', 'utf8'));
const defaults = {ComboEnabled: true, GiftNoticesEnabled: true, CleanupGoalEnabled: true, CleanupTarget: 100, RoundSummaryEnabled: true};
const checks = [], captures = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function healthy(s) { assert.equal(s.failed, false); for (const key of ['hudError', 'autoError', 'missionBoardError']) assert.equal(s[key], '', key); }
async function fresh(timed = true) {
  await q.send('lock', {enabled: true}); await q.send('live-events-pause', {enabled: true});
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false});
  await q.send('reset'); await q.send('reset');
  await q.send('crowd-settings', {timed, total: original.MaxCreatures, physical: original.PhysicalCreatures, seconds: original.RoundSeconds, target: original.KillTarget});
  await q.send('highlight-settings', {combo: true, notices: true, cleanup: true, cleanupTarget: 3, recap: true});
  await q.send('view', {x: 0, z: 0, yaw: 0, pitch: 0});
}
async function snap(label) { const s = await q.send('capture'); healthy(s); captures.push({label, file: `capture-${s.seq}.png`}); return s; }
async function restore() {
  await q.send('auto-play', {enabled: false}); await q.send('menu', {open: false}); await q.send('last-recap', {open: false});
  await q.send('reset'); await q.send('reset');
  await q.send('crowd-settings', {timed: original.TimedMode, total: original.MaxCreatures, physical: original.PhysicalCreatures,
    seconds: original.RoundSeconds, target: original.KillTarget, winGoal: original.WinGoal});
  await q.send('highlight-settings', {combo: original.ComboEnabled ?? true, notices: original.GiftNoticesEnabled ?? true,
    cleanup: original.CleanupGoalEnabled ?? true, cleanupTarget: original.CleanupTarget ?? 100, recap: original.RoundSummaryEnabled ?? true});
  await q.send('resolution', {width: 1280, height: 720}); await q.send('view', {x: 0, z: 0, yaw: 90, pitch: -6});
  await q.send('lock', {enabled: false}); await q.send('live-events-pause', {enabled: false});
}
async function main() {
  await q.wait(s => s.ready && !s.failed && s.version === '0.1.13', 'native highlights startup', 45000);
  await q.send('native-resume'); await fresh();
  await q.send('auto-fixture', {level: 0, count: 12, distance: 5}); await q.send('kill', {count: 12});
  let s = await snap('combo-12');
  assert.equal(s.highlights.Kills, 12); assert.equal(s.highlights.Combo, 12); assert.equal(s.highlights.BestCombo, 12); assert.equal(s.comboDrawn, true);
  await q.send('kill', {count: 12}); assert.equal(q.state().highlights.Kills, 12);
  await q.send('menu', {open: true, tab: 3, optionPage: 4}); await sleep(3300); await q.send('audio-probe');
  assert.equal(q.state().highlights.Combo, 12);
  await q.send('menu', {open: false}); await sleep(3300); await q.send('audio-probe');
  assert.equal(q.state().highlights.Combo, 0); assert.equal(q.state().highlights.BestCombo, 12);
  checks.push('Only actual deaths increase combo; duplicate death attempts do not; the three-second streak pauses in B and expires without losing the best');

  await fresh(false); await q.send('auto-fixture', {level: 2, count: 8, distance: 7});
  const collected = q.state().vacuumCollected; await q.send('auto-play', {enabled: true});
  await q.wait(s => s.Alive === 0 && s.bodies === 8 || s.failed || s.autoError,
    'real attacks without premature automatic cleanup', 60000); healthy(q.state());
  assert.equal(q.state().vacuumCollected, collected);
  assert.equal(q.state().highlights.Kills, 8); assert.equal(q.state().highlights.Collected, 0);
  assert.equal(q.state().highlights.CleanupComplete, false); assert.equal(q.state().highlights.HighestWeapon, 2);
  await q.wait(s => s.Won, 'normal winner with optional cleanup side goal', 16000);
  await q.send('menu', {open: true, tab: 3, optionPage: 4});
  const result = q.state().lastRoundRecap;
  assert.equal(result.Kills, 8); assert.equal(result.Collected, 0); assert.equal(result.Won, true); assert.equal(result.HighestWeapon, 2);
  assert.ok(result.Seconds > 0); assert.ok(result.BestCombo > 0);
  await q.send('highlight-settings', {cleanup: false}); assert.deepEqual(q.state().lastRoundRecap, result);
  await q.send('gift', {id: '5655', repeatCount: 2, user: 'qa_result_notice'});
  await sleep(500); await q.send('audio-probe');
  assert.equal(q.state().giftNoticesPending, 1); assert.equal(q.state().queuedRoundCreatures, original.Actions[0].Count * 2);
  for (const width of [1280, 800]) {
    await q.send('resolution', {width, height: width === 800 ? 600 : 720});
    await q.send('menu', {open: false}); await sleep(200); s = await snap('winner-recap-' + width);
    assert.equal(s.recapDrawn, true); assert.deepEqual(s.lastRoundRecap, result);
    await q.send('menu', {open: true, tab: 3, optionPage: 4});
  }
  checks.push('Eight genuine kills produce an immutable accurate winner recap; the optional cleanup goal does not block a win or bypass the hundred-body automatic threshold');
  await q.send('round-reset'); await q.send('menu', {open: false});
  s = await q.wait(s => s.activeGiftNotice?.User === 'qa_result_notice', 'result-screen gift feedback survives into next round');
  assert.equal(s.activeGiftNotice.Repeats, 2); assert.equal(s.lastRoundRecap.Kills, 8);
  checks.push('Gifts received during the result screen keep both their real actions and their queued notification for the next round');

  await fresh(); await q.send('gift', {id: '5655', repeatCount: 10, user: 'qa_stream_gift_with_a_long_username'});
  s = await snap('gift-notice-with-avatar-and-gift');
  assert.equal(s.activeGiftNotice.Repeats, 10); assert.equal(s.activeGiftNotice.Effect, '+' + original.Actions[0].Count * 10 + ' YARATIK');
  assert.equal(s.giftNoticeDrawn, true); assert.equal(s.activeGiftNotice.Live, false);
  const files = fs.readdirSync('../userdata/avatars').filter(f => f.endsWith('.png'));
  const unique = 'qa-notice-' + Date.now(), before = s.giftNoticesReceived;
  await q.send('notice-event', {eventId: unique, ...(files.length ? {avatarFile: path.resolve('../userdata/avatars', files[0])} : {})});
  const after = q.state().giftNoticesReceived, amount = q.state().Alive + q.state().pending;
  await q.send('notice-event', {eventId: unique});
  assert.equal(after, before + 1); assert.equal(q.state().giftNoticesReceived, after); assert.equal(q.state().Alive + q.state().pending, amount);
  await sleep(4100); s = await snap('gift-notice-cached-real-avatar'); assert.equal(s.activeGiftNotice.User, 'qa_notice');
  if (files.length) assert.ok(s.loadedLivePortraits > 0);
  for (let i = 0; i < 12; i++) await q.send('gift', {id: '5655', repeatCount: 1, user: 'qa_burst_' + i});
  assert.ok(q.state().giftNoticesPending <= 8);
  checks.push('Gift feedback uses the correct gift/repeat/accepted creature count; native event deduplication prevents duplicate actions and toasts; the visual queue is bounded');

  await fresh(); await q.send('crowd-settings', {total: 10, physical: 10});
  await q.send('gift', {id: '5655', repeatCount: 100, user: 'qa_limit'}); s = await snap('gift-admission-clamped');
  assert.equal(s.activeGiftNotice.Effect, '+10 YARATIK'); assert.equal(s.logicalAlive, 10);
  await q.send('gift', {id: '5655', repeatCount: 1, user: 'qa_full'}); await sleep(4100); s = await snap('gift-limit-full');
  assert.equal(s.activeGiftNotice.Effect, 'YARATIK SINIRI DOLU');
  await q.send('highlight-settings', {combo: false, notices: false, cleanup: false, recap: false});
  s = await snap('optional-overlays-off'); assert.equal(s.comboDrawn, false); assert.equal(s.cleanupDrawn, false); assert.equal(s.giftNoticeDrawn, false);
  checks.push('Toasts never claim unaccepted creatures at the admission limit; all optional overlays can be disabled without changing game actions');

  await fresh(true); await q.send('crowd-settings', {seconds: 1, target: 2});
  await q.send('auto-fixture', {level: 0, count: 1, distance: 5}); await q.send('challenge-start');
  await q.wait(s => s.roundTimedOut, 'native timed loss recap', 16000); await q.send('menu', {open: true, tab: 3, optionPage: 4});
  assert.equal(q.state().lastRoundRecap.Won, false); assert.equal(q.state().lastRoundRecap.Kills, 0);
  for (const width of [1280, 800]) {
    await q.send('resolution', {width, height: width === 800 ? 600 : 720});
    await q.send('last-recap', {open: false}); await snap('broadcast-options-' + width);
    await q.send('last-recap', {open: true}); await snap('last-round-in-B-' + width);
  }
  checks.push('A timed loss produces its own accurate recap; B keeps the last result available, and the new settings/result layouts render at 800x600 and 1280x720');
  await restore();
  assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json', 'utf8')), {...defaults, ...original});
  healthy(q.state());
  checks.push('Every previous setting and gift binding is preserved; only five optional highlight settings are added');
  fs.writeFileSync('highlights-result.json', JSON.stringify({passed: true, checks, captures, nativeTests: true, purchasedTikTokGiftsTested: false}, null, 2));
  console.log(JSON.stringify({passed: true, checks, captures}));
}
main().catch(async error => {
  const state = q.state(); try { await restore(); } catch {}
  fs.writeFileSync('highlights-result.json', JSON.stringify({passed: false, checks, captures, error: error.stack, state}, null, 2));
  console.error(error); process.exitCode = 1;
});
