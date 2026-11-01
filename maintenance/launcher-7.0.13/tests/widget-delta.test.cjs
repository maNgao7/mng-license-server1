'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const { diff, apply } = require('../renderer/widgets/state-patch.js');
const { createWidgetDelta } = require('../lib/widget-delta.cjs');
const { createWidgetChanges } = require('../lib/widget-changes.cjs');
const clone = value => JSON.parse(JSON.stringify(value));
const person = (id, score = 1) => ({ id, username: 'user_' + id, score, avatar: 'https://example.invalid/original/' + id + '/'.repeat(600), data: { flag: true } });
const query = (patch = {}) => {
    const url = new URL('http://localhost/api/widget/state?key=private&channel=one&type=topliker&patch=1');
    for (const [key, value] of Object.entries(patch)) url.searchParams.set(key, value);
    return url;
};
const revision = n => n.toString(16).padStart(32, '0');

test('state patches preserve scalars, objects, removals, arrays and full-resolution avatar strings exactly', () => {
    for (const [before, after] of [
        [null, { score: 1 }], [{ old: true, data: { x: 1 } }, { data: { x: 2, added: 'Işık ☕' } }],
        [[1, 2, 3], [3, 2, 1]], [[1], []], [{ a: [true, false] }, { a: [null, true, 3] }],
        [{ rows: [person('a'), person('b')] }, { rows: [person('a', 10), person('b')] }]
    ]) {
        const saved = clone(before), patch = diff(before, after);
        assert.ok(patch); assert.deepEqual(apply(before, patch), after); assert.deepEqual(before, saved);
    }
});

test('keyed array patches prepend gifts, remove old rows and reorder rankings without resending unchanged profiles', () => {
    const before = { rows: Array.from({ length: 60 }, (_, i) => person(String(i), i)) };
    const after = { rows: [person('new', 1), { ...before.rows[3], score: 200 }, before.rows[0], ...before.rows.slice(1, 3), ...before.rows.slice(4, 58)] };
    const patch = diff(before, after);
    assert.deepEqual(apply(before, patch), after);
    assert.ok(JSON.stringify(patch).length < JSON.stringify(after).length / 10);
    assert.ok(patch.some(operation => operation[0] === 2));
    assert.deepEqual(before.rows.map(row => row.id), Array.from({ length: 60 }, (_, i) => String(i)));
});

test('duplicate IDs and unkeyed rows use exact safe fallback rather than ambiguous row references', () => {
    for (const [a, b] of [
        [[person('same', 1), person('same', 2)], [person('same', 2), person('same', 1)]],
        [[{ score: 1 }], [{ score: 2 }, { score: 3 }]],
        [[{ username: '__proto__', score: 1 }], [{ username: 'constructor', score: 2 }]]
    ]) assert.deepEqual(apply(a, diff(a, b)), b);
});

test('prototype-like own properties stay ordinary JSON data and cannot traverse prototypes', () => {
    const before = JSON.parse('{"__proto__":{"score":1},"constructor":{"value":1}}');
    const after = JSON.parse('{"__proto__":{"score":2},"constructor":{"value":3},"toString":"name"}');
    assert.deepEqual(apply(before, diff(before, after)), after);
    assert.equal({}.score, undefined);
    assert.throws(() => apply({}, [[0, ['__proto__', 'polluted'], true]]));
    assert.equal({}.polluted, undefined);
});

test('malformed, oversized and invalid references fail closed without mutating their base', () => {
    const before = { rows: [person('a')], nested: { score: 1 } }, saved = clone(before);
    for (const operations of [
        [[3, [], {}]], [[1, []]], [[1, ['rows', 0]]], [[0, ['rows', 9], {}]],
        [[0, ['missing', 'score'], 2]], [[2, ['rows'], [9]]], [[2, ['rows'], [0, 0]]],
        [[2, ['rows'], [{ index: 0, patch: [[0, ['missing', 'score'], 2]] }]]],
        [[0, Array(33).fill('nested'), true]], Array.from({ length: 2049 }, () => [0, ['nested', 'score'], 2])
    ]) { assert.throws(() => apply(before, operations)); assert.deepEqual(before, saved); }
    assert.equal(diff({}, Object.fromEntries(Array.from({ length: 2050 }, (_, i) => ['k' + i, i]))), null);
});

test('deterministic changing rankings and gift histories round-trip through hundreds of patches', () => {
    let state = { rows: Array.from({ length: 20 }, (_, i) => person(String(i), i)), events: [], clock: 0 };
    for (let n = 0; n < 350; n++) {
        const next = clone(state);
        next.rows[n % 20].score += 17;
        if (n % 3 === 0) next.rows.reverse();
        if (n % 7 === 0) next.rows[0].data = { text: 'Yeni hediye ' + n };
        next.events.unshift({ id: 'gift-' + n, count: n % 9 + 1, at: Math.floor(n / 3) });
        next.events = next.events.slice(0, 60); next.clock++;
        const patch = diff(state, next);
        assert.ok(patch); assert.deepEqual(apply(state, patch), next);
        state = next;
    }
});

test('wire delta requires exact scoped base token and semantic revision; unknown bases return complete snapshots', () => {
    const history = createWidgetDelta(), state = { rows: Array.from({ length: 9 }, (_, i) => person(String(i))), clock: 1 };
    const first = JSON.parse(history.encode(state, revision(1), query()));
    assert.match(first.__stateToken, /^[a-f0-9]{32}$/);
    const next = clone(state); next.rows[1].score = 200;
    const url = query({ after: revision(1), base: first.__stateToken });
    const patch = JSON.parse(history.encode(next, revision(2), url));
    assert.equal(patch.__statePatch.base, first.__stateToken);
    const rebuilt = apply(first, patch.__statePatch.operations);
    rebuilt.__stateRevision = patch.__stateRevision; rebuilt.__stateToken = patch.__stateToken;
    assert.deepEqual(rebuilt, { ...next, __stateRevision: revision(2), __stateToken: patch.__stateToken });
    for (const changed of [{ channel: 'two' }, { type: 'topgifter' }, { screen: '2' }, { key: 'other' }, { items: '5' }, { after: revision(9) }, { base: revision(0) }]) {
        const scoped = query({ after: revision(1), base: first.__stateToken, ...changed });
        const result = JSON.parse(history.encode(next, revision(3), scoped));
        assert.equal(result.__statePatch, undefined); assert.deepEqual(result.rows, next.rows);
    }
});

test('exact wire tokens distinguish metadata omitted from semantic revisions, including advancing clocks', () => {
    const history = createWidgetDelta(), a = { rows: [person('a')], time: 1 }, b = { ...a, time: 2 };
    const first = JSON.parse(history.encode(a, revision(1), query()));
    const second = JSON.parse(history.encode(b, revision(1), query()));
    assert.notEqual(first.__stateToken, second.__stateToken);
    const next = { rows: [person('a', 2)], time: 3 };
    for (const base of [first, second]) {
        const patch = JSON.parse(history.encode(next, revision(2), query({ after: revision(1), base: base.__stateToken })));
        assert.equal(apply(base, patch.__statePatch.operations).time, 3);
    }
});

test('event cursor/history transitions can delta without mixing channels or losing same-timestamp gifts', () => {
    const history = createWidgetDelta(), state = { rows: [person('a')], activities: Array.from({ length: 60 }, (_, i) => ({ id: 'g' + i, createdAt: 100 })) };
    const first = JSON.parse(history.encode(state, revision(1), query({ history: '1' })));
    const next = { rows: state.rows, activities: [{ id: 'new-1', createdAt: 101 }, { id: 'new-2', createdAt: 101 }, state.activities[0]] };
    const result = JSON.parse(history.encode(next, revision(2), query({ after: revision(1), base: first.__stateToken, history: '0', eventsAfter: '100' })));
    const decoded = result.__statePatch ? apply(first, result.__statePatch.operations) : result;
    assert.deepEqual(decoded.activities, next.activities);
});

test('history is bounded by count, serialized bytes, age and snapshot size; eviction safely falls back to full', () => {
    let now = 1;
    const history = createWidgetDelta({ now: () => now, maxEntries: 2, maxBytes: 10000, ttlMs: 50, maxSnapshotBytes: 2000 });
    const state = { rows: [person('a')] }, first = JSON.parse(history.encode(state, revision(1), query()));
    for (let i = 2; i < 9; i++) history.encode({ rows: [person('a', i)] }, revision(i), query());
    assert.ok(history.stats().entries <= 2); assert.ok(history.stats().bytes <= 10000);
    assert.equal(JSON.parse(history.encode({ rows: [person('a', 10)] }, revision(10), query({ after: revision(1), base: first.__stateToken }))).__statePatch, undefined);
    now = 52; assert.equal(history.stats().entries, 0);
    history.encode({ large: 'x'.repeat(10000) }, revision(20), query()); assert.equal(history.stats().entries, 0);
    history.encode(state, revision(21), query()); history.clear(); assert.deepEqual(history.stats(), { entries: 0, bytes: 0 });
});

test('v1 remains unchanged and small v2 responses choose full JSON when delta overhead costs more', () => {
    const history = createWidgetDelta(), url = query(); url.searchParams.delete('patch');
    assert.deepEqual(JSON.parse(history.encode({ score: 1 }, revision(1), url)), { score: 1, __stateRevision: revision(1) });
    const first = JSON.parse(history.encode({ score: 1 }, revision(1), query()));
    const next = JSON.parse(history.encode({ score: 2 }, revision(2), query({ after: revision(1), base: first.__stateToken })));
    assert.equal(next.__statePatch, undefined); assert.equal(next.score, 2);
});

test('real changes endpoint wakes patches, holds idle bodyless, validates bases and clears history on close', async t => {
    let state = { rows: Array.from({ length: 9 }, (_, i) => person(String(i))) };
    const changes = createWidgetChanges({ interval: 5, waitMs: 30 });
    const server = http.createServer((req, res) => changes.handle(req, res, new URL(req.url, 'http://localhost'), () => state));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { changes.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const url = query({ transport: 'changes' });
    const first = await (await fetch(origin + url.pathname + url.search)).json();
    url.searchParams.set('after', first.__stateRevision); url.searchParams.set('base', first.__stateToken);
    let waiting = fetch(origin + url.pathname + url.search);
    await new Promise(resolve => setTimeout(resolve, 10)); state = clone(state); state.rows[2].score = 123;
    const result = await (await waiting).json(); assert.ok(result.__statePatch);
    assert.equal(apply(first, result.__statePatch.operations).rows[2].score, 123);
    url.searchParams.set('after', result.__stateRevision); url.searchParams.set('base', result.__stateToken);
    const idle = await fetch(origin + url.pathname + url.search); assert.equal(idle.status, 204); assert.equal(await idle.text(), '');
    url.searchParams.set('base', 'bad'); assert.equal((await fetch(origin + url.pathname + url.search)).status, 400);
    assert.ok(changes.historyStats().entries); changes.close(); assert.deepEqual(changes.historyStats(), { entries: 0, bytes: 0 });
});
