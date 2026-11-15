import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createLatestInstallerResolver, registerInstallerDownloads } from '../release-downloads.js';

const url = (version, name = `TikMnG-Setup-${version}.exe`) => `https://github.com/maNgao7/mng-license-server1/releases/download/v${version}/${name}`;
const fallbackUrl = url('7.0.25');
const release = (version = '7.0.26', name = `TikMnG-Setup-${version}.exe`) => ({
    tag_name: `v${version}`, draft: false, prerelease: false,
    assets: [{ name, size: 123, state: 'uploaded', browser_download_url: url(version, name) }]
});
const response = body => ({ ok: true, json: async () => body });

test('a stale server resolves future versioned installers from only its GitHub repository', async () => {
    for (const version of ['7.0.26', '7.0.100', '8.1.0']) {
        const resolve = createLatestInstallerResolver({ fallbackUrl, fetchImpl: async (endpoint, options) => {
            assert.equal(endpoint, 'https://api.github.com/repos/maNgao7/mng-license-server1/releases/latest');
            assert.equal(options.redirect, 'error');
            assert.ok(options.signal instanceof AbortSignal);
            assert.equal(options.headers.Authorization, undefined);
            return response(release(version));
        } });
        assert.equal(await resolve(), url(version));
    }
    const name = 'TikMnG-Setup-v8.0.0-x64.exe';
    assert.equal(await createLatestInstallerResolver({ fallbackUrl, fetchImpl: async () => response(release('8.0.0', name)) })(), url('8.0.0', name));
});

test('concurrent requests share a lookup, cache hits avoid GitHub and expiry refreshes', async () => {
    let calls = 0, time = 100;
    let unblock;
    const barrier = new Promise(resolve => { unblock = resolve; });
    const resolve = createLatestInstallerResolver({ fallbackUrl, ttlMs: 1000, now: () => time, fetchImpl: async () => {
        calls++; await barrier; return response(release(calls === 1 ? '7.0.26' : '7.0.27'));
    } });
    const requests = Array.from({ length: 20 }, () => resolve());
    assert.equal(calls, 1); unblock();
    assert.deepEqual(await Promise.all(requests), Array(20).fill(url('7.0.26')));
    assert.equal(await resolve(), url('7.0.26')); assert.equal(calls, 1);
    time += 1000;
    assert.equal(await resolve(), url('7.0.27')); assert.equal(calls, 2);
});

test('outage and rate limit use a short retry cache and keep the newest known installer', async () => {
    let time = 100, calls = 0;
    const resolve = createLatestInstallerResolver({ fallbackUrl, ttlMs: 100, retryMs: 20, now: () => time, fetchImpl: async () => {
        calls++;
        if (calls === 1) return { ok: false, status: 403 };
        if (calls === 2) return response(release());
        throw new Error('offline');
    } });
    assert.equal(await resolve(), fallbackUrl);
    assert.equal(await resolve(), fallbackUrl); assert.equal(calls, 1);
    time += 20;
    assert.equal(await resolve(), url('7.0.26'));
    time += 100;
    assert.equal(await resolve(), url('7.0.26'));
    assert.equal(await resolve(), url('7.0.26')); assert.equal(calls, 3);
});

test('lookups time out and return the fallback without hanging a download', async () => {
    const resolve = createLatestInstallerResolver({ fallbackUrl, timeoutMs: 10, fetchImpl: async (endpoint, { signal }) => {
        await new Promise((done, reject) => {
            const timer = setTimeout(done, 500);
            signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
        });
        throw new Error('must abort first');
    } });
    assert.equal(await resolve(), fallbackUrl);
});

test('untrusted URLs, mismatched names, drafts, prereleases, malformed responses and downgrades cannot replace the fallback', async () => {
    const changes = [
        r => { r.draft = true; }, r => { r.prerelease = true; }, r => { r.assets = []; },
        r => { r.assets[0].name = 'other.exe'; }, r => { r.tag_name = 'v7.0.27'; },
        r => { r.assets[0].size = 0; }, r => { r.assets[0].state = 'new'; },
        ...[
            url('7.0.26').replace('https:', 'http:'),
            url('7.0.26').replace('github.com', 'github.com.attacker.test'),
            url('7.0.26').replace('maNgao7', 'other'),
            url('7.0.26').replace('mng-license-server1', 'other'),
            url('7.0.26').replace('github.com', 'user:pass@github.com'),
            url('7.0.26') + '?next=https://attacker.test', url('7.0.26') + '#fragment',
            url('7.0.26', 'TikMnG-7.0.26-Portable.exe'), url('7.0.26', 'TikMnG-Setup-7.0.26.exe.zip'),
            url('7.0.26').replace('/TikMnG-', '/%54ikMnG-')
        ].map(value => r => { r.assets[0].browser_download_url = value; })
    ];
    for (const change of changes) {
        const body = release(); change(body);
        assert.equal(await createLatestInstallerResolver({ fallbackUrl, fetchImpl: async () => response(body) })(), fallbackUrl);
    }
    for (const body of [null, {}, release('7.0.24')]) {
        assert.equal(await createLatestInstallerResolver({ fallbackUrl, fetchImpl: async () => response(body) })(), fallbackUrl);
    }
    assert.equal(await createLatestInstallerResolver({ fallbackUrl, fetchImpl: async () => { throw new SyntaxError('bad JSON'); } })(), fallbackUrl);
});

test('repository configuration and fallback URL reject unsafe owners and names', () => {
    for (const owner of ['../other', 'owner/name', 'owner?x', '', 'owner@host', 'owner%2fname'])
        assert.throws(() => createLatestInstallerResolver({ owner, fallbackUrl }));
    for (const repo of ['../other', 'name/path', 'name?x', '', '.', '..', 'name#hash'])
        assert.throws(() => createLatestInstallerResolver({ repo, fallbackUrl }));
    assert.throws(() => createLatestInstallerResolver({ fallbackUrl: fallbackUrl.replace('maNgao7', 'other') }));
});

test('both website setup routes redirect without browser caching and ignore caller destinations', async t => {
    const app = express();
    const resolve = createLatestInstallerResolver({ fallbackUrl, fetchImpl: async () => response(release('8.0.0')) });
    registerInstallerDownloads(app, resolve);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(done => server.once('listening', done));
    t.after(() => new Promise(done => server.close(done)));
    for (const route of ['/download/setup', '/download/setup-direct']) {
        const result = await fetch(`http://127.0.0.1:${server.address().port}${route}?url=https://attacker.test&owner=other`, { redirect: 'manual' });
        assert.equal(result.status, 302);
        assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.equal(result.headers.get('location'), url('8.0.0'));
        await result.arrayBuffer();
    }
});
