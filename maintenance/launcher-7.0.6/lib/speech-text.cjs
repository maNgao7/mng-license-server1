'use strict';

function normalizeSpeechText(value) {
    return String(value).normalize('NFKC')
        .replace(/^([\p{L}\p{N}_.]+):\s/u, (_match, name) => normalizeSpeechName(name) + ': ')
        .replace(/@([\p{L}\p{N}_.]+)/gu, (_match, name) => normalizeSpeechName(name))
        .replace(/\bTik\s*MNG(?:\s*Game\s*Launcher)?/gi, 'Tik. Em. En. Ge. Geym lonçır')
        .replace(/[\p{L}]+/gu, word => word.length > 1 && word === word.toLocaleUpperCase('tr-TR') ? word.toLocaleLowerCase('tr-TR') : word)
        .replace(/\s+/g, ' ').trim();
}

function normalizeSpeechName(value) {
    return String(value).normalize('NFKC').replace(/^@+/, '')
        .replace(/[_.]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '')
        .toLowerCase().replace(/\u0307/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { normalizeSpeechText, normalizeSpeechName };
