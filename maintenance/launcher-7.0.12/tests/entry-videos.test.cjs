'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {createEntryVideos}=require('../lib/entry-videos.cjs');
const KEY='a'.repeat(32);
function poll(service,extra={}){
    let body='',status=0;const params=new URLSearchParams({key:KEY,channel:'publisher',game:'entry-videos',client:crypto.randomUUID(),...extra});
    const res={setHeader(){},writeHead(code){status=code;},end(value){body=String(value||'');}};
    service.handleRequest({method:'GET',headers:{}},res,new URL('http://localhost/tikmng/media/poll?'+params));
    assert.equal(status,200,body);return JSON.parse(body);
}
function confirm(service,extra={}){for(const event of poll(service,extra).events)poll(service,{...extra,ack:event.id,playback:'started'});}
function fixture(t){
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-entry-'));
    const values=new Map([['media_studio_v1',{version:1,items:[{title:'Existing unrelated data'}]}]]);
    let channel='publisher',fail=false;
    const store={get:(key,fallback)=>structuredClone(values.get(key)??fallback),set:(key,value)=>{if(fail)throw new Error('Storage failed');values.set(key,structuredClone(value));}};
    const events=[],services=[];
    const make=()=>{const service=createEntryVideos({store,root:path.join(root,'library'),accessKey:KEY,getChannel:()=>channel,onEvent:event=>events.push(event)});services.push(service);return service;};
    const service=make();
    t.after(()=>{for(const service of services)service.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
    const add=(username,trigger='entry',settings={})=>service.save({username,trigger,url:'https://video.example/intro.mp4',...settings});
    return {root,service,make,values,events,add,setChannel:value=>channel=value,fail:value=>fail=value};
}
test('exact usernames, trigger filters, independent videos and once-per-live rules',t=>{
    const f=fixture(t),a=f.add('@ALICE'),b=f.add('alice'),c=f.add('bob','comment'),d=f.add('alice','gift',{giftId:'5655'});
    assert.equal(f.service.ingest('member',{username:'alice'}).length,0,'No unverified room playback');
    assert.equal(f.service.beginSession('publisher','1234567890'),true);
    assert.equal(f.service.ingest('member',{username:'alicex',eventId:'bad'}).length,0);
    assert.equal(f.service.ingest('member',{uniqueId:'Alice',eventId:'join'}).length,2);
    assert.equal(f.service.ingest('member',{username:'alice',eventId:'rejoin'}).length,0);
    assert.equal(f.service.ingest('chat',{username:'bob',message:'',eventId:'empty'}).length,0);
    assert.equal(f.service.ingest('chat',{username:'bob',message:'hello',eventId:'comment'}).length,1);
    assert.equal(f.service.ingest('gift',{username:'alice',giftId:'5282',eventId:'wrong'}).length,0);
    assert.equal(f.service.ingest('gift',{username:'alice',giftId:'5655',giftType:1,repeatEnd:false,eventId:'streak'}).length,0);
    assert.equal(f.service.ingest('gift',{username:'alice',giftId:'5655',giftType:1,repeatEnd:true,eventId:'final',repeatCount:100}).length,1);
    assert.equal(f.service.list().some(row=>row.playedThisLive),false,'Dispatch is not proof of playback');
    confirm(f.service);
    assert.deepEqual(f.service.list().filter(row=>row.playedThisLive).map(row=>row.id).sort(),[a.id,b.id,c.id,d.id].sort());
    assert.equal(f.events.filter(event=>event.type==='studio:play').every(event=>event.test===false&&event.item.gameId==='entry-videos'),true);
    assert.deepEqual(f.values.get('media_studio_v1'),{version:1,items:[{title:'Existing unrelated data'}]});
});

test('Entry rules repeat after the configured ten minutes, not before, including after restart',t=>{
    const f=fixture(t),item=f.add('alice','entry',{oncePerLive:false,cooldownSeconds:600});f.service.beginSession('publisher','987');
    const original=Date.now;let now=original();Date.now=()=>now;t.after(()=>{Date.now=original;});
    assert.equal(f.service.ingest('member',{username:'alice',eventId:'first'}).length,1);confirm(f.service);
    now+=599999;assert.equal(f.service.ingest('member',{username:'alice',eventId:'early'}).length,0);
    const restored=f.make();now++;assert.equal(restored.ingest('member',{username:'alice',eventId:'allowed'}).length,1);confirm(restored);
    assert.equal(restored.list()[0].oncePerLive,false);assert.equal(restored.list()[0].cooldownSeconds,600);assert.ok(restored.list()[0].nextEligibleAt>now);
    restored.save({id:item.id,oncePerLive:true});now+=1000000;assert.equal(restored.ingest('member',{username:'alice',eventId:'once-only'}).length,0);
});
test('reconnect/restart retain receipts; a new room resets each viewer, tests do not consume receipts',t=>{
    const f=fixture(t),item=f.add('alice');
    f.service.beginSession('publisher','123');
    f.service.test(item.id);assert.equal(f.service.list()[0].playedThisLive,false);
    assert.equal(f.service.ingest('member',{username:'alice',eventId:'a'}).length,1);
    confirm(f.service);
    assert.equal(f.service.beginSession('publisher','123'),false);
    const restored=f.make();assert.equal(restored.ingest('member',{username:'alice',eventId:'b'}).length,0);
    assert.equal(restored.beginSession('publisher','456'),true);
    assert.equal(restored.ingest('member',{username:'alice',eventId:'c'}).length,1);
    assert.equal(restored.beginSession('publisher','offline'),false);
});
test('any interaction excludes join, repeat rules dedupe final receipts, and account settings stay separate',t=>{
    const f=fixture(t),item=f.add('alice','interaction',{oncePerLive:false,cooldownSeconds:0});
    f.service.beginSession('publisher','123');
    assert.equal(f.service.ingest('member',{username:'alice',eventId:'join'}).length,0);
    for(const type of ['chat','gift','follow','like','share','subscribe']){
        const event={username:'alice',message:'hello',giftId:'5655',eventId:type};
        assert.equal(f.service.ingest(type,event).length,1);assert.equal(f.service.ingest(type,event).length,0);
        confirm(f.service);
    }
    f.setChannel('other');assert.deepEqual(f.service.list(),[]);assert.throws(()=>f.service.remove(item.id));
    assert.throws(()=>f.add('alice','follow'));
    f.add('alice','entry');f.service.beginSession('other','789');assert.equal(f.service.ingest('member',{username:'alice',eventId:'new'}).length,1);
    f.setChannel('publisher');assert.equal(f.service.list().length,1);
});

test('entry waits for a real player acknowledgement, survives a late source and restart',t=>{
    const f=fixture(t),item=f.add('alice');f.service.beginSession('publisher','123');
    const [event]=f.service.ingest('member',{username:'alice',eventId:'join-before-source'});
    assert.equal(f.service.list()[0].playedThisLive,false);assert.equal(f.service.list()[0].pendingThisLive,true);
    const late=poll(f.service);assert.deepEqual(late.events.map(event=>event.id),[event.id]);
    assert.deepEqual(poll(f.service,{cursor:late.cursor}).events.map(event=>event.id),[event.id]);
    assert.equal(poll(f.service,{preview:'1',ack:event.id,playback:'started'}).events.length,0);
    assert.equal(f.service.list()[0].playedThisLive,false,'Preview cannot consume a live intro');
    const restored=f.make();assert.equal(poll(restored).events[0].id,event.id);
    poll(restored,{channel:'wrong',ack:event.id,playback:'started'});assert.equal(restored.list()[0].playedThisLive,false);
    poll(restored,{ack:event.id,playback:'started'});assert.equal(restored.list()[0].playedThisLive,true);
    assert.equal(poll(restored).events.length,0);assert.equal(restored.ingest('member',{username:'alice',eventId:'again'}).length,0);
    restored.reset(item.id);assert.equal(restored.list()[0].playedThisLive,false);
    assert.equal(restored.ingest('member',{username:'alice',eventId:'reset-entry'}).length,1);
});

test('failed video does not consume first entry, and next entry retries with a new delivery',t=>{
    const f=fixture(t);f.add('alice');f.service.beginSession('publisher','123');
    const [first]=f.service.ingest('member',{username:'alice',eventId:'join'});
    poll(f.service,{ack:first.id,playback:'failed',failure:'blocked'});
    assert.equal(f.service.list()[0].playedThisLive,false);assert.equal(f.service.list()[0].playbackError,'blocked');
    const [second]=f.service.ingest('member',{username:'alice',eventId:'rejoin'});assert.notEqual(first.id,second.id);
    poll(f.service,{ack:second.id,playback:'started'});assert.equal(f.service.list()[0].playedThisLive,true);assert.equal(f.service.list()[0].playbackError,'');
});

test('legacy unconfirmed play markers are migrated without losing user videos',t=>{
    const f=fixture(t),item=f.add('alice');f.service.beginSession('publisher','123');
    const data=f.values.get('entry_videos_v1');data.version=1;data.rules[0].trigger='follow';data.sessions.publisher.played[item.id]=123;
    const restored=f.make();assert.equal(restored.list()[0].id,item.id);assert.equal(restored.list()[0].trigger,'entry');assert.equal(restored.list()[0].playedThisLive,false);
    assert.equal(restored.ingest('member',{username:'alice',eventId:'entry-after-upgrade'}).length,1);
});

test('one receiver failure cannot override another receiver successful playback',t=>{
    const f=fixture(t);f.add('alice');f.service.beginSession('publisher','123');
    const [event]=f.service.ingest('member',{username:'alice',eventId:'join'});
    poll(f.service,{ack:event.id,playback:'failed',failure:'network'});
    poll(f.service,{ack:event.id,playback:'started'});
    assert.equal(f.service.list()[0].playedThisLive,true);assert.equal(f.service.list()[0].playbackError,'');
    poll(f.service,{ack:event.id,playback:'failed',failure:'network'});
    assert.equal(f.service.list()[0].playedThisLive,true);assert.equal(poll(f.service).events.length,0);
});

test('delayed old-room events cannot roll back a verified session',t=>{
    const f=fixture(t);f.add('alice');f.service.beginSession('publisher','456');
    assert.equal(f.service.ingest('member',{username:'alice',roomId:'123',eventId:'old'}).length,0);
    assert.equal(f.service.status().roomId,'456');
    assert.equal(f.service.ingest('member',{username:'alice',roomId:'456',eventId:'current'}).length,1);
});
test('invalid inputs and failing saves do not corrupt existing rules or media',t=>{
    const f=fixture(t),item=f.add('alice','gift',{giftId:'5655'}),before=structuredClone(f.values.get('entry_videos_v1'));
    for(const patch of [{username:'Alice<script>'},{trigger:'unsupported'},{trigger:'gift',giftId:''},{url:'javascript:alert(1)'},{volume:2},{oncePerLive:'true'}]){
        assert.throws(()=>f.service.save({id:item.id,...patch}));assert.deepEqual(f.values.get('entry_videos_v1'),before);
    }
    f.fail(true);assert.throws(()=>f.service.save({id:item.id,username:'changed'}));f.fail(false);
    assert.equal(f.service.list()[0].username,'alice');assert.deepEqual(f.values.get('entry_videos_v1'),before);
});
test('file uploads, replacement and removal preserve stable video IDs and owned assets',async t=>{
    const f=fixture(t),file=path.join(f.root,'first.mp4');fs.writeFileSync(file,'0123456789');
    const asset=await f.service.importAsset(file),item=f.service.save({username:'alice',assetId:asset.id});
    assert.ok(asset.previewUrl.startsWith('/tikmng/media/library/'));
    assert.equal(f.service.list()[0].remote,false);
    const second=path.join(f.root,'second.webm');fs.writeFileSync(second,'webm bytes');
    const replacement=await f.service.importAsset(second);
    const changed=f.service.save({id:item.id,assetId:replacement.id});
    assert.equal(changed.id,item.id);assert.equal(changed.filename,'second.webm');
    const restored=f.make();assert.equal(restored.list()[0].id,item.id);
    assert.equal(restored.ownsRequest(new URL('http://localhost/tikmng/media/file/'+item.id)),true);
    assert.equal(restored.ownsRequest(new URL('http://localhost/tikmng/media?game=entry-videos')),true);
    assert.equal(restored.ownsRequest(new URL('http://localhost/tikmng/media?game=snow-war')),false);
    restored.remove(item.id);assert.deepEqual(restored.list(),[]);
    assert.ok(fs.readdirSync(path.join(f.root,'library')).length>0,'Uploaded user assets are retained');
});
test('dedicated authenticated poll and file routes carry only entry events, with byte ranges',async t=>{
    const f=fixture(t),file=path.join(f.root,'clip.mp4');fs.writeFileSync(file,'0123456789');
    const asset=await f.service.importAsset(file),item=f.service.save({username:'alice',assetId:asset.id});
    f.service.beginSession('publisher','123');
    const server=http.createServer((req,res)=>f.service.handleRequest(req,res,new URL(req.url,'http://localhost')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const base='http://127.0.0.1:'+server.address().port;
    const params=new URLSearchParams({key:KEY,channel:'publisher',game:'entry-videos',client:crypto.randomUUID()});
    const initial=await (await fetch(base+'/tikmng/media/poll?'+params)).json();assert.deepEqual(initial.events,[]);
    f.service.ingest('member',{username:'alice',eventId:'join'});params.set('cursor',initial.cursor);
    const after=await(await fetch(base+'/tikmng/media/poll?'+params)).json();assert.equal(after.events.length,1);assert.equal(after.events[0].item.id,item.id);
    const response=await fetch(base+'/tikmng/media/file/'+item.id+'?key='+KEY+'&channel=publisher',{headers:{range:'bytes=2-5'}});
    assert.equal(response.status,206);assert.equal(await response.text(),'2345');
    assert.equal((await fetch(base+'/tikmng/media?game=entry-videos')).status,403);
});
