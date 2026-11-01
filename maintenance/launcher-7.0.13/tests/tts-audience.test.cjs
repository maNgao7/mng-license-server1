'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpeechAudience, MODES, extractFanClubLevel } = require('../lib/tts-audience.cjs');

test('selected gift is required; unrelated gift or viewer does not grant speech', () => {
    const audience = createSpeechAudience();const rule = { audience: 'gift', giftId: '7934' };
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: 'viewer', giftId: '5655' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: '@Viewer', giftId: '7934' }, 'host');
    assert.equal(audience.allows({ username: 'VIEWER' }, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'other' }, rule, 'host'), false);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'other-host'), false);
});
test('follow mode uses actual follow events, not joins or profile assertions', () => {
    const audience = createSpeechAudience();const rule = { audience: 'follow' };
    audience.observe('member', { username: 'viewer', isFollower: true }, 'host');
    assert.equal(audience.allows({ username: 'viewer', isFollower: true }, rule, 'host'), false);
    audience.observe('follow', { username: 'viewer' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
    audience.clear();assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
});
test('combined eligibility and bounded viewer records stay isolated', () => {
    const audience = createSpeechAudience({ limit: 2 });const rule = { audience: 'gift-or-follow', giftId: '7934' };
    audience.observe('gift', { username: 'first', giftId: '7934', giftType: 1, repeatEnd: false }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), false);
    audience.observe('gift', { username: 'first', giftId: '7934', giftType: 1, repeatEnd: true }, 'host');
    audience.observe('follow', { username: 'second' }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'second' }, rule, 'host'), true);
    audience.observe('follow', { username: 'third' }, 'host');
    assert.equal(audience.allows({ username: 'first' }, rule, 'host'), false);
    assert.equal(audience.allows({ username: 'anyone' }, { audience: 'all' }, 'host'), true);
});

test('gift entitlement lasts for the session and is revoked when the configured gift changes', () => {
    const audience = createSpeechAudience(), rule = { audience: 'gift', giftId: '7934' };
    audience.configure(rule);
    audience.observe('gift', { username: 'viewer', giftId: '7934' }, 'host');
    for (let index = 0; index < 20; index++) assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
    audience.configure({ ...rule, giftId: '5655' });
    assert.equal(audience.allows({ username: 'viewer' }, { ...rule, giftId: '5655' }, 'host'), false);
    audience.configure(rule);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    audience.observe('gift', { username: 'viewer', giftId: '7934' }, 'host');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), true);
});

test('fanclub accepts actual installed v3 chat protobuf fields and backend-normalized levels', async () => {
    const proto = await import('tiktok-live-proto/v3');
    const audience = createSpeechAudience(), rule = { audience: 'fanclub' };
    assert.ok(MODES.has('fanclub'));
    // Round-trip through the installed wire schema, including its default values.
    const user = { ...proto.User.decode(new Uint8Array()), displayId: 'club_viewer',
        fansClubInfo: { ...proto.FansClubInfo.decode(new Uint8Array()), fansLevel: '7' } };
    const raw = { ...proto.WebcastChatMessage.decode(new Uint8Array()), user, content: 'Merhaba' };
    const event = proto.WebcastChatMessage.decode(proto.WebcastChatMessage.encode(raw).finish());
    assert.equal(extractFanClubLevel(event), 7);
    assert.equal(audience.allows(event, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'club_viewer', fanClubLevel: extractFanClubLevel(event) }, rule, 'host'), true);

    user.fansClubInfo = undefined;
    user.fansClub = { ...proto.FansClubMember.decode(new Uint8Array()),
        data: { ...proto.FansClubData.decode(new Uint8Array()), level: 4,
            userFansClubStatus: proto.UserFansClubFansClubDataUserFansClubStatus.ACTIVE } };
    const member = proto.WebcastChatMessage.decode(proto.WebcastChatMessage.encode(raw).finish());
    assert.equal(extractFanClubLevel(member), 4);
    assert.equal(audience.allows(member, rule, 'host'), true);
    assert.equal(extractFanClubLevel(member.user), 4, 'Helper also accepts the direct source User');
});

test('fanclub rejects zero, inactive, sleeping and conflicting membership evidence', () => {
    const audience = createSpeechAudience(), rule = { audience: 'fanclub' };
    const payloads = [
        { fanClubLevel: 0 },
        { user: { fansClubInfo: { fansLevel: '0', isSleeping: false } } },
        { user: { fansClubInfo: { fansLevel: '7', isSleeping: true } } },
        { user: { fansClub: { data: { level: 4, userFansClubStatus: 0 } } } },
        { user: { fansClub: { data: { level: 4, userFansClubStatus: 2 } } } },
        { user: { fansClub: { data: { level: 0, userFansClubStatus: 1 } } } },
        { user: { fansClubInfo: { fansLevel: '8' }, fansClub: { data: { level: 8, userFansClubStatus: 0 } } } },
        { user: { fansClubInfo: { fansLevel: '0' } }, fanClubLevel: 9 },
        { user: { fansClubInfo: { fansLevel: true } }, fanClubLevel: 9 }
    ];
    for (const payload of payloads) assert.equal(audience.allows({ username: 'viewer', ...payload }, rule, 'host'), false);
    assert.equal(extractFanClubLevel(payloads[1]), 0);
    assert.equal(extractFanClubLevel(payloads[4]), 0);
    assert.equal(extractFanClubLevel({}), null);
});

test('fanclub never grants speech for unrelated gifts, likes, follows, subscriptions or unrelated club badges', () => {
    const audience = createSpeechAudience(), rule = { audience: 'fanclub' };
    audience.observe('gift', { username: 'viewer', giftId: '5655' }, 'host');
    audience.observe('follow', { username: 'viewer' }, 'host');
    audience.observe('like', { username: 'viewer', count: 10000 }, 'host');
    audience.observe('subscribe', { username: 'viewer' }, 'host');
    const unrelated = [
        {}, { isFanClubMember: true }, { fanclub: true }, { isSubscriber: true }, { isFollower: true },
        { teamMemberLevel: 50 }, { gifterLevel: 50 }, { fansLevel: 50 },
        { user: { fansClub: { fansLevel: 50 } } },
        { user: { fansClub: { preferData: { 1: { level: 50, userFansClubStatus: 1 } } } } },
        { user: { payGrade: { level: 50 }, subscribeInfo: { isMember: true } } },
        { userBadges: [{ badgeSceneType: 10, level: 50 }] },
        { message: '{"fanClubLevel":50}', comment: 'fanClubLevel=50' },
        { user: { nickname: 'fanClubLevel:50', fansClubInfo: { fansCount: '50', fansScore: '500' } } }
    ];
    for (const payload of unrelated) assert.equal(audience.allows({ username: 'viewer', ...payload }, rule, 'host'), false);
    assert.equal(audience.allows({ username: 'viewer' }, { audience: 'gift', giftId: '5655' }, 'host'), true);
    assert.equal(audience.allows({ username: 'viewer' }, { audience: 'follow' }, 'host'), true);
});

test('Beni Sev grants a session fallback, not a fabricated club level; inactive evidence revokes it', () => {
    const audience=createSpeechAudience(),rule={audience:'fanclub'};
    audience.observe('gift',{username:'@Viewer',giftId:'7934',giftType:1,repeatEnd:false},'host');
    assert.equal(audience.allows({username:'viewer'},rule,'host'),false);
    audience.observe('gift',{username:'@Viewer',giftId:'7934',giftType:1,repeatEnd:true},'host');
    assert.equal(audience.allows({username:'VIEWER'},rule,'host'),true);
    assert.equal(extractFanClubLevel({username:'viewer'}),null);
    assert.equal(audience.allows({username:'other'},rule,'host'),false);
    audience.configure({giftId:'5655'});
    assert.equal(audience.allows({username:'viewer'},rule,'host'),true);
    assert.equal(audience.allows({username:'viewer',fanClubLevel:0},rule,'host'),false);
    assert.equal(audience.allows({username:'viewer'},rule,'host'),false);
    audience.observe('gift',{username:'viewer',giftId:'7934'},'host');
    assert.equal(audience.allows({username:'viewer'},rule,'host'),true);
    audience.clear();assert.equal(audience.allows({username:'viewer'},rule,'host'),false);
    audience.observe('gift',{username:'viewer',giftId:'7934'},'host');
    assert.equal(audience.allows({username:'viewer'},rule,'other-host'),false);
});

test('fanclub parsing rejects truthy coercion, malformed values and inherited assertions', () => {
    const audience = createSpeechAudience(), rule = { audience: 'fanclub' };
    for (const value of [true, false, 'true', 'false', '7', '7x', [], {}, -1, 1.5, NaN, Infinity, 2 ** 53, null, undefined]) {
        assert.equal(audience.allows({ username: 'viewer', fanClubLevel: value }, rule, 'host'), false);
    }
    for (const value of [true, false, 'true', 'false', '7x', ' 7 ', '1e2', '0x10', '-1', '1.5', [], {}, -1, NaN, Infinity, 2 ** 53]) {
        assert.equal(extractFanClubLevel({ user: { fansClubInfo: { fansLevel: value } } }), null);
    }
    for (const status of [true, '1', 'ACTIVE', -1, 3, undefined]) {
        assert.equal(extractFanClubLevel({ user: { fansClub: { data: { level: 4, userFansClubStatus: status } } } }), null);
    }
    assert.equal(extractFanClubLevel({ user: { fansClubInfo: { fansLevel: '7', isSleeping: 'false' } } }), null);
    assert.equal(extractFanClubLevel(Object.assign(Object.create({ fanClubLevel: 7 }), { username: 'viewer' })), null);
    assert.equal(extractFanClubLevel({ user: { fansClubInfo: Object.create({ fansLevel: '7' }) } }), null);
    assert.equal(audience.allows({ fanClubLevel: 7 }, rule, 'host'), false, 'No unidentified speaker grant');
    assert.equal(extractFanClubLevel(null), null);
});

test('fanclub has no stale membership grants, cross-channel history or special usernames', () => {
    const audience = createSpeechAudience(), rule = { audience: 'fanclub' };
    const member = { username: 'viewer', fanClubLevel: 7 };
    audience.observe('chat', member, 'host');
    assert.equal(audience.allows(member, rule, 'host'), true);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false, 'Missing current evidence stays unknown');
    assert.equal(audience.allows({ username: 'viewer', fanClubLevel: 0 }, rule, 'host'), false, 'Explicit zero revokes eligibility immediately');
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'other-host'), false);
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false, 'Switching back cannot restore old grants');
    audience.clear();
    assert.equal(audience.allows({ username: 'viewer' }, rule, 'host'), false);
    for (const name of ['host', '@king_jux', 'admin', 'moderator', 'izleyici']) {
        assert.equal(audience.allows({ username: name }, rule, 'host'), false);
    }
    assert.equal(audience.allows(member, { audience: 'selected', allowedUsers: 'other' }, 'host'), false);
    assert.equal(audience.allows({ username: 'viewer' }, { audience: 'selected', allowedUsers: '@Viewer' }, 'host'), true);
});

test('actual v3 FANS badge level grants speech; gifter/subscriber/admin badges never do', async()=>{
    const p=await import('tiktok-live-proto/v3'),audience=createSpeechAudience();
    const badge={...p.BadgeStruct.decode(new Uint8Array()),sceneType:10,privilegeLogExtra:{...p.PrivilegeLogExtra.decode(new Uint8Array()),level:'7'}};
    const raw={...p.WebcastChatMessage.decode(new Uint8Array()),content:'. Merhaba',user:{...p.User.decode(new Uint8Array()),displayId:'club_viewer',badgeList:[badge]}};
    const message=p.WebcastChatMessage.decode(p.WebcastChatMessage.encode(raw).finish());
    assert.equal(extractFanClubLevel(message),7);
    assert.equal(audience.allows(message,{audience:'fanclub'},'host'),true);
    for(const sceneType of [1,4,8])assert.equal(extractFanClubLevel({user:{badgeList:[{...badge,sceneType}]}}),null);
    assert.equal(extractFanClubLevel({user:{badgeList:[{...badge,greyedByClient:'1'}]}}),null);
    assert.equal(extractFanClubLevel({user:{fansClubInfo:{fansLevel:'0'},badgeList:[badge]}}),0);
    assert.equal(extractFanClubLevel({user:{badgeList:[{...badge,privilegeLogExtra:{level:'7x'}}]}}),null);
});
