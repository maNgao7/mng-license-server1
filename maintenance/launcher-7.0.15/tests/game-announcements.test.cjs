'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGameAnnouncements } = require('../lib/game-announcements.cjs');
const games = require('../lib/admin-games.json').games;

test('dismissal survives restarts, account changes and new versions of the same game without changing other settings', () => {
    const data = { unrelated: { assignments: ['5303'], installedGames: ['orbit'] } };
    const store = { get: (key, fallback) => data[key] ?? fallback, set: (key, value) => { data[key] = value; } };
    let channel = 'Alice';
    const create = () => createGameAnnouncements({ store, getChannel: () => channel, games });
    assert.equal(create().pending().length, 1);
    create().dismiss(games[0].announcementId);
    assert.deepEqual(create().pending(), []);
    channel = '@ALICE'; assert.deepEqual(create().pending(), []);
    channel = 'Bob'; assert.deepEqual(create().pending(), []);
    channel = ''; assert.deepEqual(create().pending(), []);
    assert.deepEqual(create().pending(), []);
    assert.deepEqual(data.unrelated, { assignments: ['5303'], installedGames: ['orbit'] });
    const nextVersion = createGameAnnouncements({store,games:[{...games[0],announcementId:'new-version-of-same-game'}]});
    assert.deepEqual(nextVersion.pending(),[]);
    const newGame = createGameAnnouncements({store,games:[{...games[0],id:'different-game',announcementId:'different-game'}]});
    assert.equal(newGame.pending().length,1);
    const freshInstall = createGameAnnouncements({ store: { get: (_key, fallback) => fallback }, getChannel: () => 'Alice', games });
    assert.equal(freshInstall.pending().length, 1);
});

test('legacy account-scoped dismissal is honored on every account after migration',()=>{
    const legacy={['old-account-hash:'+games[0].announcementId]:true};
    const store={get:()=>legacy,set:(_key,value)=>Object.assign(legacy,value)};
    assert.deepEqual(createGameAnnouncements({store,getChannel:()=> 'another',games}).pending(),[]);
    assert.equal(legacy['game:'+games[0].id],true);
    assert.deepEqual(createGameAnnouncements({store,games:[{...games[0],announcementId:'next-version'}]}).pending(),[]);
});

test('unknown announcements are rejected and stable installations have no preview announcement writes', () => {
    const store = { get() { throw Error('Unexpected store access'); }, set() { throw Error('Unexpected write'); } };
    const stable = createGameAnnouncements({ store, games: [] });
    assert.deepEqual(stable.pending(), []);
    assert.throws(() => stable.dismiss('../unknown'));
});
