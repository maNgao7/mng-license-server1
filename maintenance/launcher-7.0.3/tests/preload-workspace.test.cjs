'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load() {
    let api; const calls = [];
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), {
        require(name) {
            assert.equal(name, 'electron');
            return { contextBridge: { exposeInMainWorld(_name, exposed) { api = exposed; } },
                ipcRenderer: { invoke: async (...args) => { calls.push(args); return { ok: true }; }, on() {}, removeListener() {} } };
        }
    });
    return { api, calls };
}
test('announcement dismissal crosses the real preload allowlist', async () => {
    const { api, calls } = load();
    assert.deepEqual(await api.workspace('announcement-dismiss', { id: 'new-game' }), { ok: true });
    assert.equal(calls[0][0], 'workspace-announcement-dismiss');
    assert.equal(calls[0][1].id, 'new-game');
});
test('unknown workspace calls remain denied', async () => {
    const { api, calls } = load();
    await assert.rejects(api.workspace('arbitrary-code'), /Geçersiz/);
    assert.equal(calls.length, 0);
});
