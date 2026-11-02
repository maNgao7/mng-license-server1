'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const q = require('./commands.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { passed: false, checks: [], views: [] };
let before;
function anchored(s) {
    assert.equal(s.failed, false);
    assert.equal(s.hudError, '');
    assert.equal(s.creatureHealthNumbers, false);
    assert.equal(s.creatureBadgeAnchorMode, 'head-attached');
    assert.ok(s.drawnCreatureBars > 0, 'At least one real head label is visible');
    assert.ok(s.drawnCreatureBars <= (s.width >= 1180 ? 24 : 16));
    assert.ok(s.consideredCreatureBadges <= 96);
    const { creatureBarBounds: bars, profileBounds: portraits, profileAnchors: anchors, creatureBadgeBounds: badges } = s;
    assert.equal(bars.length, anchors.length);
    assert.equal(portraits.length, bars.length);
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i], p = portraits[i], a = anchors[i];
        assert.ok(Math.abs(b.x + b.width / 2 - a.x) < .02, 'Bar stays centered on the actual projected head');
        assert.ok(Math.abs(b.y + b.height - (a.y - 3)) < .02, 'No vertical fan-out or viewport clamping');
        assert.ok(Math.abs(p.x + p.width / 2 - a.x) < .02);
        assert.ok(Math.abs(p.y + p.height - (b.y - 3)) < .02);
        assert.ok(b.height <= 9 && b.height >= 7, 'Compact graphical bar without health text');
        assert.equal(p.width, p.height, 'Portrait remains circular, never stretched');
        assert.ok(p.width >= 12 && p.width <= 34);
        for (let j = 0; j < i; j++) {
            const c = badges[j], d = badges[i];
            assert.ok(!(c.x < d.x + d.width && c.x + c.width > d.x && c.y < d.y + d.height && c.y + c.height > d.y), 'No overlapping labels');
        }
    }
    if (s.healthDrawn) {
        assert.ok(s.healthBounds.width > 420 && s.healthBounds.height > 74, 'Player health HUD is larger');
        assert.ok(s.height - s.healthBounds.y - s.healthBounds.height >= 50, 'Player health HUD is raised');
    }
}
async function capture(label, width, height) {
    await q.send('resolution', { width, height });
    await sleep(500);
    const s = await q.send('capture');
    s.width = width; s.height = height;
    anchored(s);
    report.views.push({ label, width, height, visible: s.drawnCreatureBars, hidden: s.reservedHudProfiles,
        portraitWidths: s.profileBounds.map(p => p.width), file: 'capture-' + s.seq + '.png' });
}
async function main() {
    await q.wait(s => s.ready && s.version === '0.1.21', 'Hotfix ready');
    before = JSON.parse(fs.readFileSync('../userdata/mod-settings.json'));
    await q.send('lock', { enabled: true });
    await q.send('live-events-pause', { enabled: true });
    await q.send('menu', { open: false });
    await q.send('auto-play', { enabled: false });
    await q.send('reset');
    await q.send('combat-settings', { enabled: false });
    await q.send('view', { x: 0, z: -14, yaw: 0, pitch: 0 });
    await q.send('auto-fixture', { level: 0, count: 100, distance: -5 });
    await sleep(1000);
    for (const [width, height] of [[1920, 1080], [1280, 720], [800, 600]]) await capture('dense-crowd-near', width, height);
    report.checks.push('Near dense crowd: every drawn bar and portrait stays centered directly above its native creature, with no overlap or health numbers at all three resolutions.');
    await q.send('view', { x: 0, z: -24, yaw: 0, pitch: 0 });
    for (const [width, height] of [[1920, 1080], [1280, 720], [800, 600]]) await capture('dense-crowd-far', width, height);
    report.checks.push('Moving away cannot fan labels into a detached grid; distance-scaled indicators remain attached and crowded labels hide.');
    await q.send('view', { x: 8, z: -20, yaw: -25, pitch: 0 });
    await capture('oblique-camera', 1280, 720);
    report.checks.push('Rotating/moving the camera preserves exact world-head attachment; graphical health bars and enlarged player HUD render without HUD errors.');
    report.passed = true;
}
main().catch(error => { report.error = error.stack; report.state = q.state(); console.error(error); process.exitCode = 1; }).finally(async () => {
    if (before) {
        await q.send('reset');
        await q.send('combat-settings', { enabled: before.EnemyAttacks, playerHealth: before.PlayerHealth, damage: before.CreatureDamage,
            interval: before.CreatureAttackInterval, scale: before.CreatureScale });
        await q.send('resolution', { width: 1280, height: 720 });
        assert.deepEqual(JSON.parse(fs.readFileSync('../userdata/mod-settings.json')), before);
    }
    fs.writeFileSync('labels-hotfix-result.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
});
