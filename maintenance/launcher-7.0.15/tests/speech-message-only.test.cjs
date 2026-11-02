'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {prepareSpeechMessage}=require('../lib/speech-message.cjs');
const source = fs.readFileSync(path.join(__dirname, '../renderer/workspace.js'), 'utf8');
const line = source.split(/\r?\n/).find(line => line.trim().startsWith('function chat(payload)'));

function fixture(settings = {}) {
    const state = { data: { tts: { enabled: true, names: true, cooldownSeconds: 3, maxLength: 180, blockedWords: '', ...settings } },
        lastUsers: new Map(), queue: [] };
    const rendererChat = vm.runInNewContext(line + '\nchat', { state, speechAvailable: () => true, speakNext() {}, updateSpeechStatus() {}, Date });
    const chat=payload=>{const message=prepareSpeechMessage(payload.message||payload.comment,state.data.tts);if(message)rendererChat({...payload,message,speechPrepared:true});};
    return { state, chat };
}

test('comment speech is message-only even if an old snapshot still has names enabled', () => {
    const f = fixture();
    f.chat({ username: 'ABC_123', nickname: 'Different Display Name', message: 'Merhaba, iyi yayinlar.' });
    assert.equal(f.state.queue.length, 1);
    assert.equal(f.state.queue[0].text, 'Merhaba, iyi yayinlar.');
    assert.equal(f.state.queue[0].settings.names, false);
    assert.equal(f.state.lastUsers.has('abc_123'), true, 'Normalized identity is retained for cooldown, not narration');
});

test('message-only narration preserves length, command, URL, blocked-word and per-viewer cooldown guards', () => {
    const f = fixture({ maxLength: 5, blockedWords: 'blocked' });
    f.chat({ username: 'first', message: '!command' });
    f.chat({ username: 'first', message: 'blocked word' });
    f.chat({ username: 'first', message: 'https://example.invalid' });
    assert.equal(f.state.queue.length, 0);
    f.chat({ username: 'first', message: 'Hello world' });
    f.chat({ username: 'first', message: 'second comment' });
    f.chat({ uniqueId: 'second', comment: 'Other comment' });
    assert.deepEqual(Array.from(f.state.queue, item => item.text), ['Hello', 'Other']);
});
