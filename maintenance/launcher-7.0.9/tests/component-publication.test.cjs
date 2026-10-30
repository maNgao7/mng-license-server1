const test = require('node:test'), assert = require('node:assert/strict');
const { componentAssetURL } = require('../tools/component-publication.cjs');
test('GitHub component assets use consistent hash buckets, arbitrary HTTPS mirrors remain supported', () => {
    const name = 'a'.repeat(64) + '.bin';
    assert.equal(componentAssetURL('https://github.com/owner/repo/releases/download/components/', name),
        'https://github.com/owner/repo/releases/download/components-a/' + name);
    assert.equal(componentAssetURL('https://cdn.example/components', name), 'https://cdn.example/components/' + name);
    assert.throws(() => componentAssetURL('https://cdn.example/', '../escape'));
    assert.throws(() => componentAssetURL('http://cdn.example/', name));
});
