'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { wingTiers } = require('../lib/champion-art.json');
const { createStudio, definitions, normalize } = require('../lib/widget-studio.cjs');
const { applyRoute } = require('../lib/widget-document-route.cjs');

const wingId = 'topgift-frame-wings';
const tiers = settings => wingTiers.slice(1).map((_, index) => settings['wingTier' + (index + 1)]);

test('the visible wing scene resolves to topgift and publishes the original art and thresholds', () => {
    const definition = definitions.find(item => item.id === wingId);
    assert.equal(definition.catalogHidden, false);
    assert.equal(definition.fields.find(field => field.key === 'frameStyle').hidden, true);
    assert.equal(normalize(wingId, { frameStyle: 'gold' }).frameStyle, 'wings');
    const route = applyRoute(new URL('http://localhost/widget/view/' + wingId), definition);
    assert.equal(route.searchParams.get('type'), wingId);
    assert.equal(route.searchParams.get('engine'), 'topgift');
    assert.deepEqual(definition.wingTiers, wingTiers);
    assert.deepEqual(wingTiers.map(tier => tier.minCoins), [1, 100, 500, 1000, 5000, 10000]);
    assert.deepEqual(tiers(normalize(wingId)), [100, 500, 1000, 5000, 10000]);
    for (const { file } of wingTiers) {
        const bytes = fs.readFileSync(path.join(__dirname, '../renderer/gift-assets', file));
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    }
    for (const style of ['gold', 'crystal', 'ember', 'laurel', 'prism']) {
        const id = 'topgift-frame-' + style;
        assert.equal(normalize(id).frameStyle, style);
        assert.equal(definitions.find(item => item.id === id).wingTiers, undefined);
    }
});

test('the wing scene inherits only saved legacy thresholds and preserves its own overrides', () => {
    const values = new Map();
    const store = { get: (key, fallback) => values.get(key) ?? fallback, set: (key, value) => values.set(key, value) };
    const studio = createStudio(store, () => '');
    studio.save('first', 'topgift', {
        wingTier1: 10, wingTier2: 60, wingTier3: 220, wingTier4: 900, wingTier5: 3000, frameStyle: 'crystal', showGift: false
    });
    const inherited = studio.settings('first', wingId);
    assert.deepEqual(tiers(inherited), [10, 60, 220, 900, 3000]);
    assert.equal(inherited.frameStyle, 'wings');
    assert.equal(inherited.showGift, true);
    assert.deepEqual(tiers(studio.settings('second', wingId)), [100, 500, 1000, 5000, 10000]);

    studio.save('first', wingId, { wingTier3: 250, showGift: false });
    const restored = createStudio(store, () => '');
    assert.deepEqual(tiers(restored.settings('first', wingId)), [10, 60, 250, 900, 3000]);
    assert.deepEqual(tiers(restored.settings('first', 'topgift')), [10, 60, 220, 900, 3000]);
});
