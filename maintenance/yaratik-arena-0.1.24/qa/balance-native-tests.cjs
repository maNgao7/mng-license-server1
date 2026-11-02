'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const q = require('./commands.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
function check(name, ok) { assert.ok(ok, name); checks.push(name); }
async function level(n) { while (q.state().level < n) await q.send('up'); while (q.state().level > n) await q.send('down'); }
const body = user => q.state().combatTestBodies.find(c => c.Username === user);
(async () => {
  let error;
  try {
    await q.wait(s => s.ready && !s.failed && s.version === '0.1.24', 'Version 0.1.24 ready', 45000);
    await q.send('lock', {enabled:true}); await q.send('live-events-pause', {enabled:true});
    await q.send('auto-play', {enabled:false}); await q.send('menu', {open:false}); await q.send('reset');
    await q.send('combat-settings', {enabled:false});
    await q.send('team-fixture', {user:'qa_scaled',kind:'spawn',x:18,z:18});
    check('base normal health stays twelve', body('qa_scaled').maxHealth === 12);
    await q.send('hit', {damage:6}); check('fixture is wounded', body('qa_scaled').health === 6);
    await level(1); check('existing enemy scales without healing its ratio', body('qa_scaled').maxHealth === 18 && body('qa_scaled').health === 9);
    await level(0); check('downgrade cannot weaken the same round', body('qa_scaled').maxHealth === 18);
    await level(6); check('rocket tier scales normal maximum to 137', body('qa_scaled').maxHealth === 137);
    await q.send('team-fixture', {user:'qa_new_scaled',kind:'spawn',x:-18,z:18});
    check('new creatures share current tier health', body('qa_new_scaled').health === 137);
    await q.send('reset'); await level(6);
    await q.send('team-fixture', {user:'qa_rocket',kind:'spawn',x:18,z:18});
    await q.send('hit', {damage:1000}); check('native rocket leaves ten health on its first lethal hit', body('qa_rocket')?.health === 10);
    await q.send('hit', {damage:1000}); check('second rocket kills normally', !body('qa_rocket'));
    await q.send('reset');
    await q.send('team-fixture', {user:'qa_base_reset',kind:'spawn',x:18,z:18});
    check('fresh round resets normal scaling', body('qa_base_reset').maxHealth === 12);
    await q.send('team-fixture', {user:'qa_boss',kind:'boss',x:14,z:18});
    await q.send('team-fixture', {user:'qa_bigboss',kind:'bigboss',x:-14,z:18});
    check('boss receives ten percent extra health', body('qa_boss').maxHealth === 264);
    check('Big Boss receives ten percent extra health', body('qa_bigboss').maxHealth === 528);
    check('every hostile receives five percent movement increase', q.state().combatTestBodies.every(c => Math.abs(c.moveSpeed / c.baseMoveSpeed - 1.26) < .00001));
    await q.send('reset'); const expired = q.state().expiredHelpers;
    await q.send('team-fixture', {user:'qa_expiring',kind:'helper',x:18,z:18});
    check('helper still has twenty health and holds its weapon', body('qa_expiring').maxHealth === 20 && body('qa_expiring').armed);
    await sleep(1100); const remaining = body('qa_expiring').HelperRemaining;
    check('helper clock advances during play', remaining < 20 && remaining > 17);
    await q.send('menu', {open:true}); const paused = body('qa_expiring').HelperRemaining;
    await sleep(1200); check('menu pauses helper lifetime', Math.abs(body('qa_expiring').HelperRemaining - paused) < .05);
    await q.send('menu', {open:false}); await q.wait(s => s.expiredHelpers === expired + 1, 'Helper expires in native game', 23000);
    check('expired helper leaves no active body or friendly reference', !body('qa_expiring') && q.state().creaturePointerCount === 0 && q.state().helperCount === 0);
    await q.send('team-fixture', {user:'qa_reused',kind:'helper',x:18,z:18});
    check('pooled helper gets a fresh twenty second lifetime', body('qa_reused').HelperRemaining > 19);
    check('no native gameplay errors', !q.state().failed && !q.state().survivalError && !q.state().autoError);
  } catch (e) { error = e.stack; process.exitCode = 1; }
  finally {
    const result = {passed:!error,timestamp:new Date().toISOString(),checks,error};
    fs.writeFileSync(path.join(process.env.TIKMNG_ARENA_QA_ROOT || __dirname,'balance-native-result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    try { await q.send('reset'); } catch {}
  }
})();
