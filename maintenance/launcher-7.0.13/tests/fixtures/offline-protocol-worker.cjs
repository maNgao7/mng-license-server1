'use strict';
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
assert.ok(process.argv.includes('--jsonl'));
let sequence = 0, active = false;
readline.createInterface({ input: process.stdin }).on('line', async line => {
    const input = JSON.parse(line);
    fs.appendFileSync(path.join(input.root, 'jobs.jsonl'), JSON.stringify({ pid: process.pid, text: input.text }) + '\n');
    assert.equal(active, false, 'Overlapping inference on one worker');
    active = true;
    if (input.text === 'hang') return;
    if (input.text === 'exit') process.exit(4);
    if (input.text === 'bad-json') { process.stdout.write('private/path/secret\n'); return; }
    if (input.text === 'stderr') { process.stderr.write(Buffer.alloc(65537, 65)); return; }
    if (input.text === 'overflow') { process.stdout.write(Buffer.alloc(17 * 1024 * 1024, 65)); return; }
    if (input.text === 'error') {
        process.stdout.write(JSON.stringify({ v: 1, id: input.id, error: 'private/path/secret' }) + '\n');
        return;
    }
    if (input.text.startsWith('slow')) await new Promise(resolve => setTimeout(resolve, 200));
    const payload = Buffer.from(JSON.stringify({ pid: process.pid, sequence: ++sequence, ...input }));
    const audio = Buffer.alloc(44 + payload.length);
    audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
    audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
    audio.writeUInt32LE(48000, 24); audio.writeUInt32LE(96000, 28); audio.writeUInt16LE(2, 32);
    audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(payload.length, 40);
    payload.copy(audio, 44);
    const message = JSON.stringify({ v: 1, id: input.id, audio: audio.toString('base64') }) + '\n';
    if (input.text === 'wrong-id') { process.stdout.write(message.replace('"id":"' + input.id + '"', '"id":"999999"')); return; }
    if (input.text === 'bad-audio') { process.stdout.write(JSON.stringify({ v: 1, id: input.id, audio: 'AAAA' }) + '\n'); return; }
    active = false;
    if (input.text === 'split') {
        const middle = Math.floor(message.length / 2);
        process.stdout.write(message.slice(0, middle));
        setImmediate(() => process.stdout.write(message.slice(middle)));
    } else process.stdout.write(message);
});
