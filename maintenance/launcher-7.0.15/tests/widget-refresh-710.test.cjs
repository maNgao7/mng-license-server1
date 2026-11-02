'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {frames}=require('../lib/portrait-frames.cjs'),studio=require('../lib/widget-studio.cjs');
test('All six sculpted frames are validated and available on each requested widget',()=>{
    assert.equal(frames.length,6);for(const id of ['raconking','streambeauty','streamhandsome','myactions']){
        const field=studio.schema(id).find(field=>field.key==='portraitFrame');assert.equal(field.options.length,7);
        for(const frame of frames){assert.equal(studio.normalize(id,{portraitFrame:frame.id}).portraitFrame,frame.id);assert.ok(fs.statSync(path.join(__dirname,'../renderer/widgets/royal-assets',frame.file)).size>100000);}
        assert.equal(studio.normalize(id,{portraitFrame:'../../secrets'}).portraitFrame,'original');
    }
});
test('Commenters and likers join the audience without gifts and are never duplicated',()=>{
    const audience=require('../lib/widget-audience.cjs').createWidgetAudience();
    audience.observe('one','member',{username:'silent'});audience.observe('one','gift',{username:'gift_only'});
    for(let i=0;i<200;i++)audience.observe('one','chat',{username:'person'+i,nickname:'Person '+i});
    audience.observe('one','like',{username:'person1',likeCount:20});audience.observe('one','like',{username:'like_only',count:3});
    assert.equal(audience.rows('one').length,201);assert.equal(audience.rows('one').find(row=>row.username==='person1').totalLikes,20);
    assert.equal(audience.rows('two').length,0);audience.reset('one');assert.equal(audience.rows('one').length,0);
});
test('Widget portrait adapter retains original resolution, updates all consumers, and bounds work',async()=>{
    const widths=new Map(),values=new Map();let requests=0;
    class Cache{async get(urls){requests++;const image='./tikmng/media/file/12345678-1234-4234-8234-123456789abc';widths.set(image,{width:1080,height:1080});return image;}info(url){return widths.get(url)||{};}file(id){return '/safe/'+id+'.webp';}close(){}import(){throw new Error('unused');}}
    class Sources{async get(){return [];}close(){}}
    class Vs{cached(){return null;}async get(){return null;}close(){}}
    const engine={PortraitCache:Cache,ProfileSources:Sources,VsPortraits:Vs,portraitCandidates:data=>[{rank:3,urls:[data.avatar]}]};
    const portraits=require('../lib/widget-portraits.cjs').createWidgetPortraits({folder:'.',engine});
    portraits.observe({username:'alice',avatar:'original'});portraits.observe({username:'alice',avatar:'thumb'});await portraits.idle();
    assert.equal(requests,1);portraits.observe({username:'alice',avatar:'thumb'});await portraits.idle();assert.equal(requests,1);
    const snapshot=portraits.snapshot({activities:[{username:'alice'}],audience:[{username:'alice'}],studio:{royalLeaders:{raconking:{username:'alice'}},raconRanking:[{username:'alice',count:7}]}});
    for(const row of [snapshot.activities[0],snapshot.audience[0],snapshot.studio.royalLeaders.raconking,snapshot.studio.raconRanking[0]]){assert.equal(row.avatarWidth,1080);assert.match(row.avatar,/^\/widget\/gift-assets\/portrait-/);}
    assert.equal(snapshot.studio.raconRanking[0].count,7);assert.equal(portraits.file('../../secret'),'');portraits.close();
});
