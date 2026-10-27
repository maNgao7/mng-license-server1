'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSpeechText, normalizeSpeechName } = require('../lib/speech-text.cjs');

test('capitalized chat words are ordinary Turkish words, not spelling requests', () => {
    assert.equal(normalizeSpeechText('MERHABA DÜNYA İYİ YAYINLAR!'), 'merhaba dünya iyi yayınlar!');
    assert.equal(normalizeSpeechText('Merhaba güzel dünya'), 'Merhaba güzel dünya');
});
test('mentions and optional names lose handle separators and capitalization', () => {
    assert.equal(normalizeSpeechText('@KING_JUX merhaba @GOSSIP.GIRL'), 'king jux merhaba gossip girl');
    assert.equal(normalizeSpeechName('@King_Jux.07'), 'king jux 07');
    assert.equal(normalizeSpeechText('KING_JUX: MERHABA'), 'king jux: merhaba');
});
test('brand pronunciation has separated letters instead of emenge', () => {
    assert.equal(normalizeSpeechText("Tik MNG Game Launcher'a hoş geldiniz."), "Tik. Em. En. Ge. Geym lonçır'a hoş geldiniz.");
    assert.equal(normalizeSpeechText('Tik. Em. En. Ge. Geym lonçır'), 'Tik. Em. En. Ge. Geym lonçır');
});
