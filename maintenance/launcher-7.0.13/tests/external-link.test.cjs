'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('ipcMain.handle("harici-link-ac",');
const end = source.indexOf('// Lisans Do\u011frula ve Aktifle\u015ftir', start);
assert.ok(start >= 0 && end > start);
const steam = 'https://store.steampowered.com/app/4745400/CAAAHR_Demo/';

function fixture(openExternal) {
    let handler;
    vm.runInNewContext(source.slice(start, end), {
        URL, ipcMain: { handle(name, callback) { assert.equal(name, 'harici-link-ac'); handler = callback; } },
        shell: { openExternal }
    });
    return data => handler({}, data);
}

test('Steam download opens the verified demo, not the full game', async () => {
    const opened = [];
    const handle = fixture(async url => opened.push(url));
    assert.equal((await handle({ url: steam })).basarili, true);
    assert.deepEqual(opened, [steam]);
});

test('external links reject executable, local, malformed and credential-bearing URLs', async () => {
    const handle = fixture(async () => assert.fail('Unsafe link must not open'));
    for (const url of [undefined, 123, {}, '', 'not-a-url', 'javascript:alert(1)', 'file:///C:/Windows/notepad.exe',
        'http://example.com', 'steam://install/4745400', 'https://user:password@example.com', 'x'.repeat(4097)]) {
        await assert.rejects(handle({ url }), /HTTPS/);
    }
});

test('browser launch errors are reported instead of claiming success', async () => {
    const handle = fixture(async () => { throw new Error('Browser unavailable'); });
    await assert.rejects(handle({ url: steam }), /Browser unavailable/);
});
