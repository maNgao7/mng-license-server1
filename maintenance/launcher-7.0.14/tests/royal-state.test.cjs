'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudio, normalize, royalIds } = require('../lib/widget-studio.cjs');
const { createWidgetAnnouncements, ID } = require('../lib/widget-announcements.cjs');
function fixture() {
    const data = new Map(); const store = {get:(key,fallback)=>structuredClone(data.get(key)??fallback),set:(key,value)=>data.set(key,structuredClone(value))};
    return {store,studio:createStudio(store,(name,id)=>'/widget/gift-assets/'+id+'.png')};
}
const event=(id,giftId,avatar='https://example.invalid/profile.jpg')=>({id,type:'gift',username:id,nickname:id,avatar,giftId,giftName:'Gift',giftImage:'/widget/gift-assets/'+giftId+'.png',coins:1,count:1,createdAt:Date.now()});
test('selected gifts replace only their own royal owner; latest wins regardless of coin value',()=>{
    const {studio}=fixture();
    studio.ingest('one',event('first','6427'));studio.ingest('one',event('beauty','5655'));studio.ingest('one',event('handsome','5282'));
    const before=studio.state('one');assert.equal(Object.keys(before.royalLeaders).length,3);
    studio.ingest('one',{...event('unrelated','999999'),coins:100000});assert.deepEqual(studio.state('one').royalLeaders,before.royalLeaders);
    studio.ingest('one',event('latest','6427'));assert.equal(studio.state('one').royalLeaders.raconking.username,'latest');
    assert.deepEqual(studio.state('one').royalLeaders.streambeauty,before.royalLeaders.streambeauty);
    assert.deepEqual(studio.state('two').royalLeaders,{});
});
test('test events are isolated from real broadcast owners; duplicate receipts cannot overwrite them',()=>{
    const {studio}=fixture();const original=event('live','6427');studio.ingest('one',original);
    studio.test('one','raconking');assert.equal(studio.state('one').royalLeaders.raconking.id,'live');
    studio.ingest('one',{...original,username:'duplicate'});assert.equal(studio.state('one').royalLeaders.raconking.username,'live');
});
test('gift changes clear only that frame, saved owners survive restart, reset and new room behave independently',()=>{
    const {studio,store}=fixture();studio.ingest('one',event('first','6427'));studio.ingest('one',event('beauty','5655'));
    const reopened=createStudio(store,()=> '');assert.equal(reopened.state('one').royalLeaders.raconking.id,'first');
    reopened.save('one','raconking',{giftId:'5282'});assert.equal(reopened.state('one').royalLeaders.raconking,undefined);
    assert.equal(reopened.state('one').royalLeaders.streambeauty.id,'beauty');
    reopened.reset('one','raconking');assert.equal(reopened.state('one').royalLeaders.streambeauty.id,'beauty');
    reopened.beginSession('one','123');assert.deepEqual(reopened.state('one').royalLeaders,{});
    assert.equal(reopened.settings('one','raconking').giftId,'5282');
    reopened.ingest('one',event('new','5282'));assert.equal(reopened.beginSession('one','123'),false);assert.equal(reopened.state('one').royalLeaders.raconking.id,'new');
});
test('empty gift disables a frame and invalid options cannot create a broad all-gifts rule',()=>{
    const {studio}=fixture();for(const id of royalIds){assert.equal(normalize(id,{giftId:'<script>'}).giftId,'');studio.save('one',id,{giftId:''});}
    studio.ingest('one',event('any','6427'));assert.deepEqual(studio.state('one').royalLeaders,{});
});
test('the new widget announcement persists once per installation without touching existing data',()=>{
    const {store}=fixture();store.set('game_announcements_v1',{old:true});store.set('saved',{giftId:'5655'});
    const first=createWidgetAnnouncements(store);assert.equal(first.pending().length,1);first.dismiss(ID);
    assert.deepEqual(createWidgetAnnouncements(store).pending(),[]);assert.deepEqual(store.get('game_announcements_v1'),{old:true});assert.deepEqual(store.get('saved'),{giftId:'5655'});
    assert.throws(()=>first.dismiss('other'));
});
