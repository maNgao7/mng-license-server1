'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Minecraft Yılan Oyunu uses its own YouTube link on the game detail page', () => {
    const workspace = fs.readFileSync(path.join(__dirname, '../renderer/workspace.js'), 'utf8');
    const links = [...workspace.matchAll(/^\s*'([^']+)': '(https:\/\/youtu\.be\/[\w-]+)',?\s*$/gm)];
    assert.deepEqual(links.filter(([, id]) => id === 'minecraft-snake-arena').map(([, , url]) => url),
        ['https://youtu.be/VGlRZRKygBE']);
    assert.deepEqual(links.filter(([, id]) => id === 'fetih').map(([, , url]) => url),
        ['https://youtu.be/v1PtHDv3VhM']);
    assert.match(workspace, /const videoUrl = gameVideoLinks\[g\.id\]/);
    assert.match(workspace, /hariciLinkAc\(el\.dataset\.url\)/);
});
