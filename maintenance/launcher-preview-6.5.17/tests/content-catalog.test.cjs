'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadContentCatalog, validateCatalog } = require('../lib/content-catalog.cjs');
const bundledCatalog = require('../lib/catalog-defaults.json');

const BASE = 'https://catalog.invalid';
const HASH = 'a'.repeat(64);
const known = id => ['alpha', 'beta'].includes(id);
const game = (overrides = {}) => ({ id: 'alpha', title: 'Alpha', version: '2.0.0', url: '/game.zip',
    sha256: HASH, bytes: 123, ...overrides });
const media = (overrides = {}) => ({ id: 'clip', title: 'Clip', category: 'Videos', url: '/clip.mp4',
    sha256: HASH, bytes: 456, ...overrides });
const file = (overrides = {}) => ({ path: 'public/data.json', url: '/data.json', sha256: HASH, bytes: 12, ...overrides });
const catalog = (revision = 7, overrides = {}) => ({ schemaVersion: 1, revision,
    publishedAt: '2026-10-22T10:00:00.000Z', games: [game()], media: [media()], ...overrides });
const validate = value => validateCatalog(value, { serverURL: BASE, known });
const missing = async () => new Response('Cannot GET /api/content/catalog', { status: 404 });
const offline = async () => { throw new Error('Network failure containing private diagnostic data'); };
const load = (overrides = {}) => loadContentCatalog({ serverURL: BASE, known,
    bundled: catalog(0), fetch: missing, ...overrides });

test('valid primary is preferred, normalized, and safe to persist', async () => {
    let calls = 0;
    const body = catalog(9);
    const before = structuredClone(body);
    const result = await load({ cached: catalog(8), fetch: async (url, options) => {
        calls++;
        assert.equal(url, BASE + '/api/content/catalog');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.redirect, 'error');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.referrerPolicy, 'no-referrer');
        assert.deepEqual(options.headers, { Accept: 'application/json' });
        assert.equal(options.signal.aborted, false);
        return Response.json(body);
    } });
    assert.equal(calls, 1);
    assert.equal(result.catalog.games[0].url, BASE + '/game.zip');
    assert.equal(result.catalog.media[0].url, BASE + '/clip.mp4');
    assert.deepEqual(body, before);
    assert.equal(result.status.source, 'remote');
    assert.equal(result.status.code, 'remote');
    assert.equal(result.status.revision, 9);
    assert.equal(result.status.remoteRevision, 9);
    assert.equal(result.status.httpStatus, 200);
    assert.equal(result.status.remoteAvailable, true);
    assert.equal(result.status.degraded, false);
    assert.equal(result.status.cacheable, true);
});

test('equal remote revision is still preferred; cache age alone never invalidates it', async () => {
    const result = await load({ cached: catalog(9, { publishedAt: '2020-01-01T00:00:00Z' }),
        fetch: async () => Response.json(catalog(9, { games: [game({ title: 'Primary title' })] })) });
    assert.equal(result.status.source, 'remote');
    assert.equal(result.catalog.games[0].title, 'Primary title');
});

test('an older primary cannot downgrade a newer published cache', async () => {
    const cached = catalog(40, { publishedAt: '2020-01-01T00:00:00Z' });
    const before = structuredClone(cached);
    const result = await load({ cached, fetch: async () => Response.json(catalog(2)) });
    assert.equal(result.catalog.revision, 40);
    assert.deepEqual(cached, before);
    assert.equal(result.status.source, 'cache');
    assert.equal(result.status.code, 'stale-remote');
    assert.equal(result.status.remoteAvailable, true);
    assert.equal(result.status.remoteRevision, 2);
    assert.equal(result.status.cacheable, false);
    assert.equal(result.status.degraded, true);
});

test('an older primary cannot downgrade a newer bundled revision either', async () => {
    const result = await load({ bundled: catalog(19), fetch: async () => Response.json(catalog(2)) });
    assert.equal(result.catalog.revision, 19);
    assert.equal(result.status.source, 'bundled');
    assert.equal(result.status.code, 'stale-remote');
    assert.equal(result.status.remoteAvailable, true);
    assert.equal(result.status.cacheable, false);
});

test('404 preserves old published cache and describes the missing service without raw errors', async () => {
    const cached = catalog(42, { publishedAt: '2020-01-01T00:00:00Z' });
    const before = structuredClone(cached);
    let calls = 0;
    const result = await load({ cached, fetch: async () => { calls++; return missing(); } });
    assert.equal(calls, 1);
    assert.equal(result.catalog.revision, 42);
    assert.equal(result.status.source, 'cache');
    assert.equal(result.status.code, 'not-published');
    assert.equal(result.status.httpStatus, 404);
    assert.equal(result.status.remoteAvailable, false);
    assert.equal(result.status.cacheable, false);
    assert.equal(result.status.degraded, true);
    assert.match(result.status.message, /sunucuda/);
    assert.doesNotMatch(result.status.message, /404|Cannot GET|updated|g\u00fcncellendi/i);
    assert.deepEqual(cached, before);
    result.catalog.games[0].title = 'Detached result';
    assert.deepEqual(cached, before);
});

test('404 without cache leaves the actual bundled catalog usable and unpublished', async () => {
    const result = await loadContentCatalog({ serverURL: BASE, fetch: missing });
    assert.equal(result.status.source, 'bundled');
    assert.equal(result.status.code, 'not-published');
    assert.equal(result.catalog.games.length, bundledCatalog.games.length);
    assert.equal(result.catalog.revision, 0);
    assert.equal(result.catalog.publishedAt, null);
    assert.equal(result.status.remoteAvailable, false);
    assert.equal(result.status.cacheable, false);
    assert.ok(result.catalog.games.every(item => new URL(item.url).protocol === 'https:'));
    assert.doesNotMatch(result.status.message, /updated|g\u00fcncellendi/i);
});

test('network errors preserve cache without exposing exception details', async () => {
    const result = await load({ cached: catalog(12), fetch: offline });
    assert.equal(result.catalog.revision, 12);
    assert.equal(result.status.source, 'cache');
    assert.equal(result.status.code, 'network');
    assert.equal(result.status.httpStatus, null);
    assert.equal(result.status.remoteAvailable, false);
    assert.doesNotMatch(JSON.stringify(result.status), /private diagnostic/);
});

test('other HTTP failures retain fallback and are not reported as missing deployment', async t => {
    for (const status of [401, 403, 429, 500, 503]) await t.test(String(status), async () => {
        const result = await load({ fetch: async () => new Response('Secret error', { status }) });
        assert.equal(result.status.source, 'bundled');
        assert.equal(result.status.code, 'http-error');
        assert.equal(result.status.httpStatus, status);
        assert.doesNotMatch(result.status.message, /Secret|401|403|429|500|503/);
    });
});

test('invalid cached data is rejected, and primary or bundle can recover', async () => {
    const cached = catalog(500, { games: [game({ url: 'http://unsafe.invalid/package.zip' })] });
    const result = await load({ cached, fetch: async () => Response.json(catalog(2)) });
    assert.equal(result.status.source, 'remote');
    assert.equal(result.catalog.revision, 2);
    assert.equal(result.status.cacheRejected, true);
    const fallback = await load({ cached, fetch: offline });
    assert.equal(fallback.status.source, 'bundled');
    assert.equal(fallback.status.cacheRejected, true);
});

test('invalid bundled data cannot displace a good cache; no usable sources returns explicit empty state', async () => {
    const invalidBundle = { schemaVersion: 2 };
    const cached = await load({ cached: catalog(12), bundled: invalidBundle });
    assert.equal(cached.status.source, 'cache');
    assert.equal(cached.status.bundledRejected, true);
    const empty = await load({ cached: false, bundled: invalidBundle });
    assert.equal(empty.status.source, 'none');
    assert.equal(empty.status.remoteAvailable, false);
    assert.equal(empty.status.degraded, true);
    assert.deepEqual(empty.catalog, { schemaVersion: 1, revision: 0, publishedAt: null, games: [], media: [] });
});

test('invalid primary schemas preserve a valid cache', async t => {
    const cases = {
        null: null,
        array: [],
        'wrong schema': catalog(9, { schemaVersion: 2 }),
        'missing revision': catalog(undefined, { revision: undefined }),
        'negative revision': catalog(-1),
        'fractional revision': catalog(1.1),
        'string revision': catalog('9'),
        'overflow revision': catalog(Number.MAX_SAFE_INTEGER + 1),
        'invalid publication': catalog(9, { publishedAt: 'not a date' }),
        'non-string publication': catalog(9, { publishedAt: 123 }),
        'missing games': catalog(9, { games: undefined }),
        'null media': catalog(9, { media: null }),
        'unknown root field': catalog(9, { extra: true }),
        'null game': catalog(9, { games: [null] }),
        'missing title': catalog(9, { games: [game({ title: undefined })] }),
        'null description': catalog(9, { games: [game({ description: null })] }),
        'null requirements': catalog(9, { games: [game({ requirements: null })] }),
        'null category': catalog(9, { media: [media({ category: null })] }),
        'unsafe title': catalog(9, { games: [game({ title: '<script>' })] }),
        'missing URL': catalog(9, { games: [game({ url: undefined })] }),
        'missing version': catalog(9, { games: [game({ version: undefined })] }),
        'invalid version': catalog(9, { games: [game({ version: '../2' })] }),
        'invalid hash': catalog(9, { games: [game({ sha256: 'xyz' })] }),
        'numeric hash': catalog(9, { games: [game({ sha256: 123 })] }),
        'invalid media hash': catalog(9, { media: [media({ sha256: 'xyz' })] }),
        'negative bytes': catalog(9, { media: [media({ bytes: -1 })] }),
        'fractional bytes': catalog(9, { games: [game({ bytes: 0.1 })] }),
        'string bytes': catalog(9, { games: [game({ bytes: '123' })] }),
        'oversized asset': catalog(9, { games: [game({ bytes: 100 * 1024 ** 3 + 1 })] }),
        'duplicate games': catalog(9, { games: [game(), game()] }),
        'duplicate media': catalog(9, { media: [media(), media()] }),
        'reserved ID': catalog(9, { games: [game({ id: 'constructor' })] }),
        'invalid ID': catalog(9, { games: [game({ id: '../alpha' })] }),
        'null resources': catalog(9, { games: [game({ resources: null })] }),
        'unknown game field': catalog(9, { games: [game({ surprise: true })] })
    };
    for (const [name, body] of Object.entries(cases)) await t.test(name, async () => {
        const result = await load({ cached: catalog(8), fetch: async () => Response.json(body) });
        assert.equal(result.catalog.revision, 8);
        assert.equal(result.status.source, 'cache');
        assert.equal(result.status.code, 'invalid-catalog');
        assert.equal(result.status.remoteAvailable, false);
        assert.equal(result.status.cacheable, false);
    });
});

test('all asset locations enforce HTTPS and reject credentials or ambiguous relative URLs', async t => {
    const unsafe = ['http://cdn.invalid/a', 'file:///C:/private', 'javascript:alert(1)', 'data:text/plain,x',
        'https://user:password@cdn.invalid/a', 'https://user@cdn.invalid/a', 'https://@cdn.invalid/a', '//cdn.invalid/a',
        '/\\cdn.invalid/a', 'https:\\cdn.invalid/a', 'https:cdn.invalid/a',
        'https:///cdn.invalid/a', 'https:////cdn.invalid/a',
        'https://cdn.invalid/a\n', ' https://cdn.invalid/a', 'https://cdn.invalid/a#fragment',
        '../package.zip', '/a/../package.zip', '/a/%2e%2e/package.zip', '/%2fcdn.invalid/a', '/%5ccdn.invalid/a',
        '/bad%0apath', '?url=https://cdn.invalid/a', '#fragment'];
    const locations = {
        game: url => catalog(9, { games: [game({ url })] }),
        media: url => catalog(9, { media: [media({ url })] }),
        resource: url => catalog(9, { games: [game({ resources: [{ title: 'Guide', url }] })] }),
        file: url => catalog(9, { games: [game({ files: [file({ url })] })] }),
        launcher: downloadUrl => catalog(9, { launcher: { version: '1.0.0', downloadUrl, sha256: HASH, bytes: 123 } })
    };
    for (const [name, make] of Object.entries(locations)) await t.test(name, () => {
        for (const url of unsafe) assert.throws(() => validate(make(url)), undefined, JSON.stringify(url));
    });
});

test('resources, files and media URLs normalize independently without changing input objects', () => {
    const input = catalog(7, { games: [game({ sha256: HASH.toUpperCase(),
        resources: [{ title: 'Guide', url: './guides/game.html' }], files: [file({ bytes: 0 })] })] });
    const before = structuredClone(input);
    const output = validate(input);
    assert.equal(output.games[0].resources[0].url, BASE + '/guides/game.html');
    assert.equal(output.games[0].files[0].url, BASE + '/data.json');
    assert.equal(output.games[0].files[0].bytes, 0);
    assert.equal(output.games[0].sha256, HASH);
    assert.deepEqual(input, before);
    assert.notEqual(output.games[0], input.games[0]);
    assert.notEqual(output.games[0].resources[0], input.games[0].resources[0]);
    assert.notEqual(output.games[0].files[0], input.games[0].files[0]);
});

test('legacy optional metadata and unknown game IDs are handled without weakening validation', () => {
    const value = catalog(7, { publishedAt: undefined, games: [game({ sha256: null, bytes: null }), game({ id: 'future-game' })] });
    const output = validate(value);
    assert.equal(output.publishedAt, null);
    assert.equal(output.games.length, 1);
    assert.equal(output.games[0].sha256, null);
    assert.deepEqual(output.games[0].resources, []);
    assert.throws(() => validate(catalog(7, { games: [game(), game({ id: 'future-game', url: 'http://unsafe.invalid/a' })] })));
    assert.throws(() => validate(catalog(7, { games: [game({ id: 'future-game' }), game({ id: 'future-game' })] })));
});

test('count limits apply before unknown IDs are filtered', () => {
    const games = Array.from({ length: 100 }, (_, i) => game({ id: 'unknown-' + i }));
    const clips = Array.from({ length: 2000 }, (_, i) => media({ id: 'clip-' + i }));
    const resources = Array.from({ length: 8 }, (_, i) => ({ title: 'Guide ' + i, url: '/guide-' + i }));
    const files = Array.from({ length: 256 }, (_, i) => file({ path: 'data-' + i }));
    assert.equal(validate(catalog(7, { games, media: clips })).media.length, 2000);
    assert.equal(validate(catalog(7, { games: [game({ resources, files })] })).games[0].files.length, 256);
    assert.throws(() => validate(catalog(7, { games: [...games, game({ id: 'one-more' })] })));
    assert.throws(() => validate(catalog(7, { media: [...clips, media({ id: 'one-more' })] })));
    assert.throws(() => validate(catalog(7, { games: [game({ resources: [...resources, resources[0]] })] })));
    assert.throws(() => validate(catalog(7, { games: [game({ files: [...files, file({ path: 'one-more' })] })] })));
});

test('patch manifests reject unsafe, duplicate, reserved and conflicting paths', async t => {
    const cases = {
        traversal: [file({ path: '../data.json' })],
        absolute: [file({ path: '/data.json' })],
        backslash: [file({ path: 'public\\data.json' })],
        'drive path': [file({ path: 'C:/data.json' })],
        'device path': [file({ path: 'public/CON.txt' })],
        'trailing space': [file({ path: 'public /data.json' })],
        'reserved marker': [file({ path: '.tikmng-package.json' })],
        'case duplicate': [file({ path: 'data.json' }), file({ path: 'DATA.JSON' })],
        'file versus parent': [file({ path: 'public' }), file()],
        'directory case collision': [file(), file({ path: 'Public/other.json' })],
        'missing hash': [file({ sha256: undefined })],
        'missing bytes': [file({ bytes: undefined })],
        'empty path': [file({ path: '' })]
    };
    for (const [name, files] of Object.entries(cases)) await t.test(name, () => {
        assert.throws(() => validate(catalog(7, { games: [game({ files })] })));
    });
});

test('server resolver is called once, preserves base path and rejects credentials before fetching', async t => {
    let calls = 0;
    const result = await load({ serverURL: () => { calls++; return BASE + '/prefix///'; }, fetch: async url => {
        assert.equal(url, BASE + '/prefix/api/content/catalog');
        return Response.json(catalog(7, { games: [game({ url: 'game.zip' })] }));
    } });
    assert.equal(calls, 1);
    assert.equal(result.catalog.games[0].url, BASE + '/prefix/game.zip');
    for (const serverURL of ['http://catalog.invalid', 'https://user:secret@catalog.invalid',
        'https://catalog.invalid?key=secret', 'https://catalog.invalid#secret', '//catalog.invalid',
        'https://catalog.invalid\n', undefined, () => { throw new Error('secret resolver failure'); }]) {
        await t.test(typeof serverURL === 'function' ? 'throwing resolver' : String(serverURL), async () => {
            let fetched = false;
            const output = await load({ serverURL, bundled: bundledCatalog, known: () => true,
                fetch: async () => { fetched = true; throw new Error('must not fetch'); } });
            assert.equal(fetched, false);
            assert.equal(output.status.code, 'invalid-server-url');
            assert.equal(output.status.source, 'bundled');
            assert.equal(output.status.remoteAvailable, false);
            assert.doesNotMatch(output.status.message, /secret/);
        });
    }
});

test('invalid server cannot hide a valid cache with absolute URLs', async () => {
    const cached = catalog(19, { games: [game({ url: 'https://cdn.invalid/game.zip' })],
        media: [media({ url: 'https://cdn.invalid/clip.mp4' })] });
    const result = await load({ serverURL: 'http://unsafe.invalid', cached });
    assert.equal(result.status.source, 'cache');
    assert.equal(result.catalog.revision, 19);
});

test('redirects and non-JSON responses cannot replace the cache', async t => {
    const cases = {
        'redirect status': () => new Response(null, { status: 302, headers: { Location: 'http://unsafe.invalid' } }),
        'followed redirect': () => ({ ok: true, status: 200, redirected: true, json: async () => catalog(9) }),
        'different final URL': () => ({ ok: true, status: 200, url: 'https://user:secret@cdn.invalid/catalog', json: async () => catalog(9) }),
        HTML: () => new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }),
        'wrong content type': () => new Response(JSON.stringify(catalog(9)), { headers: { 'Content-Type': 'text/plain' } }),
        'malformed JSON': () => new Response('{', { headers: { 'Content-Type': 'application/json' } })
    };
    for (const [name, response] of Object.entries(cases)) await t.test(name, async () => {
        const result = await load({ cached: catalog(8), fetch: async () => response() });
        assert.equal(result.status.source, 'cache');
        assert.equal(result.catalog.revision, 8);
        assert.equal(result.status.remoteAvailable, false);
        assert.doesNotMatch(result.status.message, /secret|Login/);
    });
});

test('minimal injected fetch responses work without global fetch or Response APIs', async () => {
    const result = await load({ fetch: async () => ({ ok: true, status: 200, json: async () => catalog(9) }) });
    assert.equal(result.status.source, 'remote');
    assert.equal(result.catalog.revision, 9);
    const unavailable = await load({ fetch: null });
    assert.equal(unavailable.status.source, 'bundled');
    assert.equal(unavailable.status.code, 'network');
});

test('response size is bounded by declared length, streaming size and injected JSON size', async t => {
    const max = 2 * 1024 * 1024;
    const cases = {
        'declared length': () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(max + 1) } }),
        'streamed length': () => new Response(' '.repeat(max + 1), { headers: { 'Content-Type': 'application/json' } }),
        'injected object': () => ({ ok: true, status: 200, json: async () => catalog(9, {
            games: [game({ description: 'x'.repeat(max + 1) })] }) })
    };
    for (const [name, response] of Object.entries(cases)) await t.test(name, async () => {
        const result = await load({ cached: catalog(8), fetch: async () => response() });
        assert.equal(result.status.code, 'invalid-catalog');
        assert.equal(result.catalog.revision, 8);
    });
});

test('deadline covers a fetcher or JSON body reader that ignores abort signals', async t => {
    for (const stage of ['fetch', 'body']) await t.test(stage, async () => {
        let signal;
        const result = await load({ cached: catalog(8), timeoutMs: 15, fetch: async (url, options) => {
            signal = options.signal;
            if (stage === 'fetch') return new Promise(() => {});
            return { ok: true, status: 200, json: () => new Promise(() => {}) };
        } });
        assert.equal(signal.aborted, true);
        assert.equal(result.status.source, 'cache');
        assert.equal(result.status.code, 'timeout');
        assert.equal(result.catalog.revision, 8);
        assert.equal(result.status.remoteAvailable, false);
    });
});

test('concurrent refreshes remain isolated and take the cache supplied by their caller', async () => {
    const results = await Promise.all([
        load({ cached: catalog(20), fetch: offline }),
        load({ cached: catalog(4), fetch: async () => Response.json(catalog(5)) })
    ]);
    assert.equal(results[0].catalog.revision, 20);
    assert.equal(results[0].status.source, 'cache');
    assert.equal(results[1].catalog.revision, 5);
    assert.equal(results[1].status.source, 'remote');
});
