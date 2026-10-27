'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { verifyArchive } = require('../tools/verify-game-archives.cjs');

async function archive(t, method, payload, filename = 'runtime/natives/jna123.dll.x') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'game-archive-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const name = Buffer.from(filename), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10); central.writeUInt32LE(payload.length, 20); central.writeUInt16LE(name.length, 28);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + payload.length, 16);
    const file = path.join(root, 'game.zip');
    await fs.writeFile(file, Buffer.concat([local, name, payload, central, name, end]));
    return file;
}

test('release preflight reproduces the reported empty stored-file ZIP error without relaxing validation', async t => {
    await assert.rejects(verifyArchive(await archive(t, 0, Buffer.from([3, 0]))),
        /compressed\/uncompressed size mismatch for stored file: 2 != 0/);
});

test('release preflight accepts genuinely empty stored and valid deflated entries', async t => {
    for (const [method, payload] of [[0, Buffer.alloc(0)], [8, Buffer.from([3, 0])]]) {
        const result = await verifyArchive(await archive(t, method, payload));
        assert.equal(result.entries, 1); assert.equal(result.bytes, 0);
        assert.equal(result.files.values().next().value.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    }
});

test('release preflight rejects traversal before reading archive contents', async t => {
    await assert.rejects(verifyArchive(await archive(t, 0, Buffer.alloc(0), '../escape')), /invalid relative path|Unsafe path/);
});
