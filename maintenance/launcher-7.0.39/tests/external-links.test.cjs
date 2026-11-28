'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createExternalLinkOpener } = require('../lib/external-links.cjs');
const demo = 'https://store.steampowered.com/app/4793540/';

function fixture(available = true, failure) {
    const calls = [];
    const open = createExternalLinkOpener({ steamAvailable: async () => available, openExternal: async url => {
        calls.push(url);
        if (failure?.(url)) throw Error('fixture launch failed');
    } });
    return { open, calls };
}

test('Ring demo opens its Steam store page once, without launching/installing the game', async () => {
    const f = fixture();
    assert.deepEqual(await f.open(demo), { basarili: true, target: 'steam' });
    assert.deepEqual(f.calls, ['steam://store/4793540']);
});
test('missing Steam registration goes straight to the official HTTPS page', async () => {
    const f = fixture(false);
    assert.equal((await f.open(demo)).target, 'browser');
    assert.deepEqual(f.calls, [demo]);
});
test('failed Steam opening falls back to HTTPS once', async () => {
    const f = fixture(true, url => url.startsWith('steam:'));
    assert.equal((await f.open(demo)).target, 'browser');
    assert.deepEqual(f.calls, ['steam://store/4793540', demo]);
});
test('failed protocol detection still opens the HTTPS page', async () => {
    const urls = [];
    const open = createExternalLinkOpener({ steamAvailable: async () => { throw Error('registry unavailable'); }, openExternal: async url => urls.push(url) });
    await open(demo);
    assert.deepEqual(urls, [demo]);
});
test('other game store pages also open their own matching Steam app, including slugs', async () => {
    const f = fixture();
    await f.open('https://store.steampowered.com/app/304930/Unturned/?l=turkish');
    assert.deepEqual(f.calls, ['steam://store/304930']);
});
test('videos, ordinary HTTPS links and lookalike domains remain browser links', async () => {
    const urls = ['https://www.youtube.com/watch?v=Il6t2jrBy1c', 'https://store.steampowered.com.evil.example/app/4793540/', 'https://store.steampowered.com:444/app/4793540/'];
    const open = createExternalLinkOpener({ steamAvailable: async () => { throw Error('must not probe'); }, openExternal: async url => urls.shift() === url || assert.fail(url) });
    for (const url of [...urls]) assert.equal((await open(url)).target, 'browser');
    assert.deepEqual(urls, []);
});
test('untrusted direct protocols and credential-bearing URLs remain rejected', async () => {
    const f = fixture();
    for (const url of ['steam://run/4793540', 'steam://install/4793540', 'file:///C:/test.exe', 'javascript:alert(1)', 'http://store.steampowered.com/app/4793540/', 'https://user:pass@store.steampowered.com/app/4793540/', 'invalid', null]) {
        await assert.rejects(f.open(url), /HTTPS/);
    }
    assert.deepEqual(f.calls, []);
});
test('browser failures surface to the existing launcher error notice', async () => {
    const f = fixture(false, () => true);
    await assert.rejects(f.open(demo), /fixture launch failed/);
    assert.deepEqual(f.calls, [demo]);
});
