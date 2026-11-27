'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLiveReport } = require('../lib/live-report.cjs');
test('support report excludes accounts, room IDs, URLs and credentials even in malformed diagnostic fields', () => {
    const report = createLiveReport();
    for (let attempt = 0; attempt < 90; attempt++) report.record({
        status: 'error', reason: 'dns', attempt, username: 'PRIVATE', roomId: 'PRIVATE',
        message: 'Authorization: PRIVATE', diagnostic: { stage: 'PRIVATE',
            codes: ['ENOTFOUND', 'PRIVATE'], httpStatuses: [403, 'PRIVATE'] }
    });
    const text = report.text({ version: '7.0.37-dev', platform: 'win32', arch: 'x64' });
    assert.equal(text.includes('PRIVATE'), false);
    assert.equal(JSON.parse(text).entries.length, 40);
    assert.deepEqual(JSON.parse(text).entries[0].codes, ['ENOTFOUND']);
});
test('event traffic does not overwrite connection transitions in the support report', () => {
    const report = createLiveReport();
    report.record({ status: 'connecting', reason: 'connecting', attempt: 1 });
    for (let i = 0; i < 1000; i++) report.record({ status: 'connected', reason: 'connected', attempt: 1, lastEventAt: i });
    assert.equal(JSON.parse(report.text({})).entries.length, 2);
});
