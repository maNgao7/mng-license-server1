'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { showNativeWindow } = require('../lib/native-window.cjs');

test('only the owned numeric PID is restored by a hidden bounded helper', async () => {
    const result = await showNativeWindow(12345, { platform: 'win32', execute(file, args, options, callback) {
        assert.match(file, /powershell.exe$/);
        assert.equal(options.windowsHide, true);
        assert.ok(options.timeout <= 70000);
        const source = Buffer.from(args.at(-1), 'base64').toString('utf16le');
        assert.match(source, /\$gamePid=12345/);
        assert.match(source, /IsWindowVisible/);
        assert.ok(!source.includes('Stop-Process'));
        callback(null, '{"pid":12345,"visible":true,"foreground":true}');
    } });
    assert.equal(result.visible, true);
});
test('invalid or unrelated PIDs and invisible windows cannot be marked ready', async () => {
    for (const pid of [0, -1, NaN, '123', process.pid]) await assert.rejects(showNativeWindow(pid));
    await assert.rejects(showNativeWindow(12345, { platform: 'win32', execute(_file, _args, _options, done) { done(null, '{"pid":99,"visible":true}'); } }));
    await assert.rejects(showNativeWindow(12345, { platform: 'win32', execute(_file, _args, _options, done) { done(null, '{"pid":12345,"visible":false}'); } }));
});
