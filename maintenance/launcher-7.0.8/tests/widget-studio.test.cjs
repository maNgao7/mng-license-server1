'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { definitions, normalize, createStudio, hash } = require('../lib/widget-studio.cjs');
function fixture() {
    const data = new Map();
    const store = { get: (key, fallback) => structuredClone(data.get(key) ?? fallback), set: (key, value) => data.set(key, structuredClone(value)) };
    return { data, studio: createStudio(store, (_name, id) => `/widget/gift-assets/${id}.png`) };
}
test('17 unique studio widgets have complete defaults and validated schemas', () => {
    assert.equal(definitions.length, 17); assert.equal(new Set(definitions.map(x => x.id)).size, 17);
    for (const item of definitions) {
        assert.ok(item.fields.length >= 5);
        assert.equal(new Set(item.fields.map(x => x.key)).size, item.fields.length, item.id);
        for (const field of item.fields) assert.notEqual(normalize(item.id)[field.key], undefined);
    }
    assert.equal(normalize('penalty', { goalChance: 200, duration: -1 }).goalChance, 100);
    assert.equal(normalize('penalty', { duration: NaN }).duration, 4);
    assert.equal(normalize('coinjar', { sound: 'false', accent: 'javascript:1', unknown: 1 }).sound, false);
    assert.equal(normalize('coinjar', { accent: 'red' }).accent, '#25f4ee');
    assert.equal(normalize('coinjar', { unknown: 1 }).unknown, undefined);
});
test('jar schema no longer exposes sender, ranking or coin labels from legacy settings',()=>{
    const settings=normalize('coinjar',{showCount:true,showAlert:true,showJarRanking:true});
    for(const key of ['showCount','showAlert','showJarRanking']){
        assert.equal(settings[key],undefined);assert.ok(!definitions.find(item=>item.id==='coinjar').fields.some(field=>field.key===key));
    }
});
test('settings survive service recreation, are scoped by account and all eight screens', () => {
    const { studio, data } = fixture();
    for (let screen = 1; screen <= 8; screen++) studio.save('@one', 'myactions', { screen: String(screen), duration: screen + 2 }, screen);
    studio.save('two', 'myactions', { duration: 14 }, 1);
    const restored = createStudio({ get: (key, fallback) => structuredClone(data.get(key) ?? fallback), set: (key, value) => data.set(key, structuredClone(value)) }, () => '');
    assert.equal(restored.settings('one', 'myactions', '8').duration, 10);
    assert.equal(restored.settings('two', 'myactions', '1').duration, 14);
    assert.equal(restored.settings('one', 'myactions', '1').duration, 3);
    assert.throws(() => restored.save('one', 'not-a-widget', {}));
});
test('individual test events never modify persistent live stats or scores', () => {
    const { studio, data } = fixture(), before = JSON.stringify([...data]);
    for (const { id } of definitions) studio.test('one', id, '1');
    assert.equal(JSON.stringify([...data]), before);
    assert.equal(Object.keys(studio.state('one').tests).length, 17);
    assert.equal(Object.keys(studio.state('two').tests).length, 0);
    assert.deepEqual(studio.state('one').penaltyScores, []);
});
test('polling decrypts the account store once, not once per widget per request', () => {
    let reads = 0;
    const studio = createStudio({ get: (_k, fallback) => { reads++; return fallback; }, set() {} }, () => '');
    for (let i = 0; i < 50; i++) studio.state('one');
    assert.equal(reads, 1);
    studio.state('two'); assert.equal(reads, 2);
});
test('penalty uses exact gift ID and coin filters; reset remains widget/account scoped', () => {
    const { studio } = fixture();
    studio.save('one', 'penalty', { giftId: '5655', giftMinCoins: 5, goalChance: 100 });
    const event = { id: 'g1', type: 'gift', giftId: '5655', username: 'a', nickname: 'A', coins: 5 };
    studio.ingest('one', { ...event, coins: 1 }); studio.ingest('one', { ...event, giftId: 'wrong' });
    assert.deepEqual(studio.state('one').penaltyScores, []);
    studio.ingest('one', event); assert.equal(event.penaltyGoal, true);
    assert.equal(studio.state('one').penaltyScores[0].goals, 1);
    studio.test('one', 'firework'); studio.test('two', 'penalty');
    studio.reset('one', 'penalty');
    assert.deepEqual(studio.state('one').penaltyScores, []);
    assert.ok(studio.state('one').tests.firework); assert.ok(studio.state('two').tests.penalty);
    assert.equal(hash('same'), hash('same'));
});
test('TikTok names matching Object properties remain ordinary scoreboard entries', () => {
    const { studio } = fixture();
    for (const username of ['constructor', '__proto__', 'toString']) studio.ingest('one', { id: username, type:'gift', giftId:'5655', username, coins:1 });
    assert.equal(studio.state('one').penaltyScores.length, 3);
    assert.ok(studio.state('one').penaltyScores.every(row => row.shots === 1));
});
test('new room resets live contents once; reconnect and settings persist across restarts', () => {
    const { studio, data } = fixture();let resets=0;
    studio.save('one','coinjar',{ giftSize:31, volume:35 });
    studio.ingest('one',{id:'before',type:'gift',username:'a',giftId:'5655',coins:1});
    studio.test('one','coinjar');studio.test('two','coinjar');
    assert.equal(studio.beginSession('one','offline',()=>resets++),false);
    assert.equal(studio.beginSession('one','1234567890123456789',()=>resets++),true);
    assert.equal(resets,1);assert.deepEqual(studio.state('one').penaltyScores,[]);
    assert.equal(studio.state('one').tests.coinjar,undefined);assert.ok(studio.state('two').tests.coinjar);
    assert.equal(studio.settings('one','coinjar').giftSize,31);
    studio.ingest('one',{id:'after',type:'gift',username:'a',giftId:'5655',coins:1});
    assert.equal(studio.beginSession('one','1234567890123456789',()=>resets++),false);
    assert.equal(studio.state('one').penaltyScores[0].shots,1);
    const restored=createStudio({get:(k,d)=>structuredClone(data.get(k)??d),set:(k,v)=>data.set(k,structuredClone(v))},()=> '');
    assert.equal(restored.beginSession('one','1234567890123456789',()=>resets++),false);
    assert.equal(restored.beginSession('one','2234567890123456789',()=>resets++),true);
    assert.equal(resets,2);assert.deepEqual(restored.state('one').penaltyScores,[]);
    assert.equal(restored.settings('one','coinjar').volume,35);
});
test('old saved list/mute defaults migrate once and later explicit choices survive', () => {
    const { studio, data } = fixture();
    data.set('widget_studio_v1__one',{settings:{topgifter:{layout:'list'},coinjar:{sound:false,giftSize:34}}});
    assert.equal(studio.settings('one','topgifter').layout,'podium');
    assert.equal(studio.settings('one','coinjar').background,'transparent');
    assert.equal(studio.settings('one','coinjar').sound,true);
    studio.save('one','coinjar',{sound:false,background:'transparent',giftSize:34});
    assert.equal(studio.settings('one','topgifter').layout,'podium');
    assert.equal(studio.settings('one','coinjar').sound,false);
    assert.equal(studio.settings('one','coinjar').background,'transparent');
    assert.equal(studio.settings('one','coinjar').giftSize,34);
});
test('action wheel gift picker persists exact and unknown IDs; empty means all gifts', () => {
    const { studio }=fixture();
    const field=definitions.find(item=>item.id==='actionwheel').fields.find(item=>item.key==='giftId');assert.equal(field.type,'gift');
    studio.save('one','actionwheel',{giftId:'5655'});assert.equal(studio.settings('one','actionwheel').giftId,'5655');
    studio.save('one','actionwheel',{giftId:'999999999'});assert.equal(studio.settings('one','actionwheel').giftId,'999999999');
    studio.save('one','actionwheel',{giftId:''});assert.equal(studio.settings('one','actionwheel').giftId,'');
});

test('all broadcast widgets ignore obsolete black settings and preserve other settings', () => {
    const { studio, data } = fixture();
    data.set('widget_studio_v1__one', { designVersion:2, settings:{coinjar:{background:'black',giftSize:31,sound:false}} });
    assert.equal(studio.settings('one','coinjar').background,'transparent');
    assert.equal(studio.settings('one','coinjar').sound,false);
    studio.save('one','coinjar',{background:'black',giftSize:31});
    assert.equal(data.get('widget_studio_v1__one').designVersion,3);
    assert.equal(studio.settings('one','coinjar').background,'transparent');
    for(const {id} of definitions){studio.save('one',id,{background:'black'});assert.equal(studio.settings('one',id).background,'transparent');}
});

test('wing coin thresholds are ordered, bounded and persist independently by account', () => {
    const {studio,data}=fixture();
    const saved=studio.save('one','topgift',{wingTier1:10,wingTier2:50,wingTier3:200,wingTier4:800,wingTier5:2000});
    assert.equal(saved.wingTier3,200);assert.equal(studio.settings('two','topgift').wingTier3,1000);
    const restored=createStudio({get:(k,d)=>structuredClone(data.get(k)??d),set:(k,v)=>data.set(k,structuredClone(v))},()=> '');
    assert.equal(restored.settings('one','topgift').wingTier5,2000);
    const bounded=studio.save('one','topgift',{wingTier1:1000000,wingTier2:1,wingTier3:1,wingTier4:1,wingTier5:1});
    assert.equal(bounded.wingTier5,1000000);
    for(let i=2;i<=5;i++)assert.ok(bounded['wingTier'+i]>bounded['wingTier'+(i-1)]);
});

test('like alerts accumulate per person, use configurable screen thresholds, and survive reconnect', () => {
    const { studio, data } = fixture();
    studio.beginSession('one','1234567890');
    studio.save('one','myactions',{likeThreshold:50},2);
    const like=(username,count)=>{const event={id:Math.random().toString(),type:'like',username,count};studio.ingest('one',event);return event;};
    assert.deepEqual(like('a',15).likeAlerts,{});
    assert.deepEqual(like('b',90).likeAlerts,{'2':50});
    assert.deepEqual(like('a',70).likeAlerts,{'2':50});
    const event=like('a',15);assert.equal(event.likeAlerts['1'],100);assert.equal(event.likeAlerts['2'],100);
    const restored=createStudio({get:(k,d)=>structuredClone(data.get(k)??d),set:(k,v)=>data.set(k,structuredClone(v))},()=> '');
    restored.beginSession('one','1234567890');
    const next={type:'like',username:'a',count:99};restored.ingest('one',next);assert.equal(next.likeAlerts['1'],undefined);
    const crossed={type:'like',username:'a',count:1};restored.ingest('one',crossed);assert.equal(crossed.likeAlerts['1'],200);
    restored.beginSession('one','2234567890');const fresh={type:'like',username:'a',count:15};restored.ingest('one',fresh);assert.deepEqual(fresh.likeAlerts,{});
    for(const username of ['__proto__','constructor']){const event={type:'like',username,count:100};restored.ingest('one',event);assert.equal(event.likeAlerts['1'],100);}
});
