'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {createEntryVideos,ruleSettings}=require('../lib/entry-videos.cjs');
const KEY='a'.repeat(32),STORE_KEY='entry_videos_v1';

function fixture(t){
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'tikmng-entry-any-'));
    const values=new Map(),services=[],events=[],client=crypto.randomUUID();
    let channel='publisher',fail=false;
    const store={get:(key,fallback)=>structuredClone(values.get(key)??fallback),set:(key,value)=>{
        if(fail)throw new Error('Storage failed');values.set(key,structuredClone(value));
    }};
    const make=()=>{
        const service=createEntryVideos({store,root:path.join(root,'library'),accessKey:KEY,getChannel:()=>channel,onEvent:event=>events.push(event)});
        services.push(service);return service;
    };
    const service=make();
    const poll=(extra={},target=service)=>{
        let body='',status;
        const params=new URLSearchParams({key:KEY,channel,game:'entry-videos',client,...extra});
        const res={setHeader(){},writeHead(code){status=code;},end(value){body=String(value||'');}};
        target.handleRequest({method:'GET',headers:{}},res,new URL('http://localhost/tikmng/media/poll?'+params));
        assert.equal(status,200,body);return JSON.parse(body);
    };
    const add=(settings={})=>service.save({scope:'any-sender',trigger:'gift',giftId:'5655',url:'https://video.example/intro.mp4',...settings});
    const gift=(id,settings={},target=service)=>target.ingest('gift',{username:'alice',giftId:'5655',eventId:id,...settings});
    const ack=(event,extra={},target=service)=>poll({ack:event.id,playback:'started',...extra},target);
    t.after(()=>{
        for(const service of services)service.close();
        const resolved=path.resolve(root),parent=path.resolve(os.tmpdir());
        assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('tikmng-entry-any-'));
        fs.rmSync(resolved,{recursive:true,force:true});
    });
    return {service,make,values,events,poll,add,gift,ack,setChannel:value=>channel=value,fail:value=>fail=value};
}

test('scope is explicit, legacy usernames remain required, and any-sender gifts cannot be limited',()=>{
    const legacy=ruleSettings({username:' @ALICE '});
    assert.equal(legacy.scope,'person');assert.equal(legacy.username,'alice');assert.equal(legacy.cooldownSeconds,600);
    assert.throws(()=>ruleSettings({trigger:'entry'}),/kullanıcı/);
    assert.throws(()=>ruleSettings({scope:'everyone',username:'alice'}),/kapsam/);
    const any=ruleSettings({scope:'any-sender',trigger:'gift',giftId:' 005655 ',oncePerLive:true,cooldownSeconds:86400});
    assert.equal(any.username,'');assert.equal(any.giftId,'5655');assert.equal(any.oncePerLive,false);assert.equal(any.cooldownSeconds,0);
    const person=ruleSettings({scope:'person',username:'bob',trigger:'gift',giftId:5655,oncePerLive:true,cooldownSeconds:90});
    assert.equal(person.oncePerLive,true);assert.equal(person.cooldownSeconds,90);
    for(const patch of [{giftId:''},{giftId:'0'},{giftId:{}},{oncePerLive:'true'},{cooldownSeconds:NaN}]){
        assert.throws(()=>ruleSettings({scope:'any-sender',trigger:'gift',giftId:'5655',...patch}));
    }
});

test('entry and comment rules normalize all senders and aliases without crossing triggers',t=>{
    const f=fixture(t),entry=f.add({trigger:'entry',cooldownSeconds:0}),comment=f.add({trigger:'comment',cooldownSeconds:0});
    assert.deepEqual(f.service.ingest('member',{username:'alice',eventId:'unverified'}),[]);
    f.service.beginSession('publisher','123');
    const a=f.service.ingest(' ENTRY ',{uniqueId:' @ALICE ',eventId:'join-a'});
    const b=f.service.ingest('MEMBER',{user:{username:'Bob'},eventId:'join-b'});
    const c=f.service.ingest('comment',{user:{uniqueId:'Carol'},content:'hello',eventId:'comment-a'});
    const d=f.service.ingest(' CHAT ',{username:'dave',comment:'hello',eventId:'comment-b'});
    assert.deepEqual([...a,...b].map(event=>event.item.id),[entry.id,entry.id]);
    assert.deepEqual([...c,...d].map(event=>event.item.id),[comment.id,comment.id]);
    assert.deepEqual(f.service.ingest('member',{username:'alice',eventId:'join-a'}),[]);
    assert.deepEqual(f.service.ingest('chat',{comment:' \t ',eventId:'empty'}),[]);
    assert.deepEqual(f.service.ingest('follow',{username:'alice',eventId:'wrong-trigger'}),[]);
    assert.deepEqual(f.poll().events.map(event=>event.trigger.type),['member','member','chat','chat']);
});

test('selected gift accepts every completed event, including nested and unnamed senders, while pending and playing',t=>{
    const f=fixture(t),item=f.add({oncePerLive:true,cooldownSeconds:600});f.service.beginSession('publisher','123');
    assert.equal(item.oncePerLive,false);assert.equal(item.cooldownSeconds,0);assert.equal(item.username,'');
    for(const payload of [
        {giftId:'5282',eventId:'wrong'},
        {giftId:'0',eventId:'invalid'},
        {giftId:'5655',giftType:1,repeatEnd:false,eventId:'streak'},
        {giftId:'5655',repeatEnd:0,eventId:'inferred-streak'},
        {gift:{id:'5655',giftType:1},eventId:'unfinished-nested'}
    ])assert.deepEqual(f.service.ingest('gift',payload),[]);
    const [a]=f.gift('streak',{giftType:1,repeatEnd:true,repeatCount:100});
    const [b]=f.service.ingest(' GIFT ',{user:{uniqueId:'BOB'},gift:{giftId:'005655',type:'1'},repeatEnd:'true',common:{msgId:'b'}});
    const [c]=f.service.ingest('gift',{giftDetails:{id:5655,giftType:0},eventId:'c'});
    const [d]=f.service.ingest('gift',{gift_id:5655n,username:'not a public username',eventId:'d'});
    assert.ok([a,b,c,d].every(Boolean));assert.equal(new Set([a,b,c,d].map(event=>event.id)).size,4);
    assert.deepEqual(f.poll().events.map(event=>event.id),[a,b,c,d].map(event=>event.id));
    f.ack(a);assert.deepEqual(f.poll().events.map(event=>event.id),[b,c,d].map(event=>event.id));
    const [e]=f.gift('e',{username:'carol'});assert.ok(e,'A playing video does not impose a cooldown');
    assert.deepEqual(f.gift('e',{username:'someone_else'}),[],'Source event IDs stay idempotent');
    assert.deepEqual(f.gift('streak',{giftType:1,repeatEnd:true}),[]);
    assert.equal(f.service.list()[0].nextEligibleAt,null);
    assert.ok(f.poll().events.every(event=>event.item.id===item.id&&event.item.gameId==='entry-videos'&&event.item.interrupt===false&&event.item.playLimit===0&&event.trigger.count===1));
});

test('more than one poll page survives individual acknowledgements and eventually drains in order',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');
    const queued=Array.from({length:80},(_,index)=>f.gift('burst-'+index)[0]);
    assert.equal(f.poll().events.length,64);
    assert.deepEqual(f.ack(queued[0]).events.map(event=>event.id),queued.slice(1,65).map(event=>event.id));
    for(const event of queued.slice(1))f.ack(event);
    assert.deepEqual(f.poll().events,[]);
    for(let index=0;index<80;index++)assert.deepEqual(f.gift('burst-'+index),[]);
});

test('receipts, queues and rules survive restart and reconnect; a verified new room resets receipts',t=>{
    const f=fixture(t),item=f.add();f.service.beginSession('publisher','123');
    const [a]=f.gift('a'),[b]=f.gift('b');f.ack(a);
    const restored=f.make();assert.equal(restored.beginSession('publisher','123'),false);
    assert.deepEqual(f.poll({},restored).events.map(event=>event.id),[b.id]);
    assert.deepEqual(f.gift('a',{},restored),[]);assert.deepEqual(f.gift('b',{},restored),[]);
    assert.equal(f.gift('c',{},restored).length,1);assert.equal(restored.list()[0].scope,'any-sender');
    assert.equal(restored.beginSession('publisher','456'),true);assert.equal(f.gift('a',{},restored).length,1);
    assert.equal(restored.list()[0].id,item.id);
    assert.deepEqual(restored.ingest('gift',{giftId:'5655',roomId:'123',eventId:'old-room'}),[]);
    assert.equal(restored.status().roomId,'456');
});

test('channel, game, item and preview scopes cannot consume another delivery',t=>{
    const f=fixture(t),a=f.add(),otherItem=f.add({giftId:'5282'});f.service.beginSession('publisher','123');
    const [event]=f.gift('same-id');
    for(const scope of [{channel:'other'},{game:'other-game'},{item:otherItem.id},{preview:'1'}])f.ack(event,scope);
    assert.deepEqual(f.poll().events.map(event=>event.id),[event.id]);
    assert.deepEqual(f.service.ingest('gift',{giftId:'5655',eventId:'wrong-account'},'other'),[]);
    f.setChannel('other');assert.deepEqual(f.service.list(),[]);assert.throws(()=>f.service.save({id:a.id,enabled:false}));
    const b=f.add();f.service.beginSession('other','789');const [otherEvent]=f.gift('same-id');
    assert.equal(otherEvent.item.id,b.id);f.ack(event);assert.equal(f.poll().events[0].id,otherEvent.id);
    f.setChannel('publisher');assert.deepEqual(f.poll().events.map(event=>event.id),[event.id]);
    f.ack(event);assert.deepEqual(f.poll().events,[]);
});

test('failures and late acknowledgements change only their delivery and retain playback errors',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');
    const [a]=f.gift('a'),[b]=f.gift('b');
    f.ack(a,{playback:'failed',failure:'blocked'});
    assert.equal(f.service.list()[0].playbackError,'blocked');assert.equal(f.service.list()[0].playedThisLive,false);
    assert.ok(f.poll().events.some(event=>event.id===b.id));
    f.ack(a);assert.equal(f.service.list()[0].playbackError,'');
    f.ack(a,{playback:'failed',failure:'network'});
    assert.equal(f.service.list()[0].playbackError,'');assert.deepEqual(f.poll().events.map(event=>event.id),[b.id]);
    f.ack(b,{playback:'failed',failure:'timeout'});assert.equal(f.service.list()[0].playbackError,'timeout');
    const [c]=f.gift('c');assert.equal(f.service.list()[0].playbackError,'');
    assert.deepEqual(f.poll().events.map(event=>event.id),[c.id]);
});

test('person once/cooldown behavior remains independent when an event also matches any sender',t=>{
    const f=fixture(t),person=f.add({scope:'person',username:'alice',oncePerLive:true,cooldownSeconds:600}),any=f.add();
    f.service.beginSession('publisher','123');const first=f.gift('first');
    assert.deepEqual(first.map(event=>event.item.id),[person.id,any.id]);
    assert.deepEqual(f.gift('second').map(event=>event.item.id),[any.id]);
    f.ack(first[0]);assert.equal(f.service.list().find(row=>row.id===person.id).playedThisLive,true);
    assert.equal(f.poll().events.length,2);assert.deepEqual(f.gift('third').map(event=>event.item.id),[any.id]);
    const limited=f.add({scope:'person',username:'bob',trigger:'comment',oncePerLive:false,cooldownSeconds:10});
    t.mock.timers.enable({apis:['Date'],now:Date.now()});
    const [comment]=f.service.ingest('chat',{username:'bob',comment:'hello',eventId:'comment'});f.ack(comment);
    assert.deepEqual(f.service.ingest('chat',{username:'bob',comment:'hello',eventId:'early'}),[]);
    t.mock.timers.tick(10000);
    assert.deepEqual(f.service.ingest('chat',{username:'bob',comment:'hello',eventId:'later'}).map(event=>event.item.id),[limited.id]);
});

test('legacy persisted v1/v2 rules migrate to person without losing media, settings or verified receipts',t=>{
    const f=fixture(t),item=f.add({scope:'person',username:'alice',trigger:'entry',oncePerLive:true,cooldownSeconds:60});
    f.service.beginSession('publisher','123');const [event]=f.service.ingest('member',{username:'alice',eventId:'first'});f.ack(event);
    const data=f.values.get(STORE_KEY);delete data.rules[0].scope;data.rules[0].trigger='follow';
    const restored=f.make(),row=restored.list()[0];
    assert.equal(row.scope,'person');assert.equal(row.trigger,'entry');assert.equal(row.id,item.id);assert.equal(row.remote,true);
    assert.equal(row.oncePerLive,true);assert.equal(row.cooldownSeconds,60);assert.equal(row.playedThisLive,true);
    assert.deepEqual(restored.ingest('member',{username:'alice',eventId:'second'}),[]);
    data.version=1;const migrated=f.make();assert.equal(migrated.list()[0].playedThisLive,false);
    assert.equal(migrated.ingest('member',{username:'alice',eventId:'new-after-v1'}).length,1);
    assert.equal(f.values.get(STORE_KEY).version,2);
});

test('overflow is explicit and bounded, does not consume an ID, and preserves all accepted events',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');
    const events=Array.from({length:256},(_,index)=>f.gift('cap-'+index)[0]);
    const before=structuredClone(f.values.get(STORE_KEY)),sent=f.events.length;
    assert.throws(()=>f.gift('overflow'),/kuyruğu dolu/);
    assert.deepEqual(f.values.get(STORE_KEY),before);assert.equal(f.events.length,sent);
    assert.equal(Object.keys(before.sessions.publisher.pending).length,256);assert.equal(f.poll().events.length,64);
    f.ack(events[0]);assert.equal(f.gift('overflow').length,1,'A refused ID can be retried after capacity returns');
    assert.deepEqual(f.gift('overflow'),[]);
    assert.equal(Object.keys(f.values.get(STORE_KEY).sessions.publisher.pending).length,256);
});

test('accepted any-sender gifts stay pending beyond five minutes and survive a late source or restart',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');
    t.mock.timers.enable({apis:['Date'],now:Date.now()});
    const [a]=f.gift('waiting-a'),[b]=f.gift('waiting-b');
    t.mock.timers.tick(300001);
    assert.equal(f.service.list()[0].pendingThisLive,true);
    assert.deepEqual(f.poll().events.map(event=>event.id),[a.id,b.id]);
    const restored=f.make(),[c]=f.gift('later',{},restored);
    assert.deepEqual(f.poll({},restored).events.map(event=>event.id),[a.id,b.id,c.id]);
    assert.deepEqual(f.gift('waiting-a',{},restored),[]);
    f.ack(a,{},restored);assert.deepEqual(f.poll({},restored).events.map(event=>event.id),[b.id,c.id]);
    f.ack(b,{},restored);f.ack(c,{},restored);assert.deepEqual(f.poll({},restored).events,[]);
});

test('gift IDs stay idempotent for the verified room beyond the recent receipt history cap',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');
    t.mock.timers.enable({apis:['Date'],now:Date.now()});
    const [played]=f.gift('played'),[waiting]=f.gift('waiting');f.ack(played);
    t.mock.timers.tick(10000);
    const data=f.values.get(STORE_KEY),receipts=data.sessions.publisher.receipts;
    for(let index=0;index<4096;index++)receipts['seed-'+index]=Date.now()-index-1;
    const restored=f.make();assert.equal(f.gift('fresh',{},restored).length,1);
    assert.deepEqual(f.gift('played',{},restored),[]);
    assert.deepEqual(f.gift('waiting',{},restored),[]);
    const session=f.values.get(STORE_KEY).sessions.publisher;
    assert.equal(Object.keys(session.receipts).length,4096);assert.equal(Object.keys(session.pending).length,2);
    assert.equal(f.poll({},restored).events[0].id,waiting.id);
    f.ack(waiting,{},restored);assert.deepEqual(f.gift('waiting',{},restored),[]);
    assert.equal(restored.beginSession('publisher','456'),true);assert.equal(f.gift('played',{},restored).length,1);
});

test('legacy pending deliveries remain deduplicated even without a retained recent receipt',t=>{
    const f=fixture(t);f.add();f.service.beginSession('publisher','123');const [waiting]=f.gift('waiting');
    const data=f.values.get(STORE_KEY);data.sessions.publisher.receipts={};delete data.sessions.publisher.giftReceipts;
    const restored=f.make();assert.deepEqual(f.gift('waiting',{},restored),[]);
    assert.deepEqual(f.poll({},restored).events.map(event=>event.id),[waiting.id]);
    f.ack(waiting,{},restored);assert.deepEqual(f.gift('waiting',{},restored),[]);
});

test('legacy person deliveries retain their existing pending expiry',t=>{
    const f=fixture(t);f.add({scope:'person',username:'alice'});f.service.beginSession('publisher','123');
    t.mock.timers.enable({apis:['Date'],now:Date.now()});f.gift('expired-person');
    t.mock.timers.tick(300001);assert.deepEqual(f.poll().events,[]);
    assert.equal(f.service.list()[0].pendingThisLive,false);
});

test('disabled rules, manual/test delivery and failed saves retain their existing boundaries',t=>{
    const f=fixture(t),item=f.add();f.service.beginSession('publisher','123');
    const manual=f.service.play(item.id),preview=f.service.test(item.id),[automatic]=f.gift('automatic');
    assert.deepEqual(f.poll({preview:'1'}).events.map(event=>event.id),[preview.id]);
    f.ack(manual);f.ack(preview);assert.equal(f.service.list()[0].playedThisLive,false);
    assert.deepEqual(f.poll().events.map(event=>event.id),[automatic.id]);
    const before=structuredClone(f.values.get(STORE_KEY));
    f.fail(true);assert.throws(()=>f.service.save({id:item.id,title:'changed'}),/Storage failed/);f.fail(false);
    assert.deepEqual(f.values.get(STORE_KEY),before);assert.equal(f.service.list()[0].scope,'any-sender');
    f.service.save({id:item.id,enabled:false});assert.deepEqual(f.gift('disabled'),[]);assert.deepEqual(f.poll().events,[]);
    f.service.save({id:item.id,enabled:true});assert.equal(f.gift('enabled').length,1);
    f.service.remove(item.id);assert.deepEqual(f.poll().events,[]);assert.deepEqual(f.service.list(),[]);
});

function overlayHarness(t,fixture){
    const timers=new Map(),elements=[],polls=[],listeners=new Map();let timerId=0;
    const stage={replaceChildren(element){this.child=element;}};
    class Element{
        constructor(){this.handlers=new Map();this.currentTime=0;this.duration=30;this.videoWidth=640;this.classList={add(){},remove(){}};elements.push(this);}
        setAttribute(){} removeAttribute(){} load(){} pause(){} remove(){this.removed=true;}
        addEventListener(name,fn){this.handlers.set(name,fn);} removeEventListener(name){this.handlers.delete(name);}
        dispatch(name){this.handlers.get(name)?.();} play(){return Promise.resolve();}
        requestVideoFrameCallback(fn){this.frame=fn;}
    }
    const document={hidden:false,getElementById:()=>stage,createElement:()=>new Element(),addEventListener(){},
        body:{dataset:{channel:'publisher',item:'',game:'entry-videos'},classList:{add(){}}}};
    const context={document,window:{addEventListener:(name,fn)=>listeners.set(name,fn)},
        location:{origin:'http://localhost',pathname:'/tikmng/media',search:'?key='+KEY+'&channel=publisher&game=entry-videos'},
        crypto,URL,URLSearchParams,AbortController,queueMicrotask,Date,
        setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:Date.now()+ms});return id;},clearTimeout(id){timers.delete(id);},
        fetch:async raw=>{
            const url=new URL(raw);polls.push(url);const params=Object.fromEntries(url.searchParams);delete params.wait;
            return {ok:true,json:async()=>fixture.poll(params)};
        }};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/studio/overlay.js'),'utf8'),context);
    t.after(()=>listeners.get('pagehide')?.());
    const settle=async()=>{for(let index=0;index<15;index++)await Promise.resolve();};
    async function advance(ms){
        await settle();const until=Date.now()+ms;
        for(;;){
            const next=[...timers].filter(([,timer])=>timer.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
            timers.delete(next[0]);t.mock.timers.tick(next[1].at-Date.now());next[1].fn();await settle();
        }
        t.mock.timers.tick(until-Date.now());await settle();
    }
    return {elements,polls,stage,settle,advance};
}

test('the actual overlay drains distinct gifts for one video across poll pages without repeats or queue loss',async t=>{
    const f=fixture(t);f.add({fade:false});f.service.beginSession('publisher','123');
    t.mock.timers.enable({apis:['Date'],now:Date.now()});
    const events=Array.from({length:80},(_,index)=>f.gift('overlay-'+index)[0]);
    const h=overlayHarness(t,f);await h.settle();
    for(let index=0;index<events.length;index++){
        assert.equal(h.elements.length,index+1);
        const video=h.stage.child;video.dispatch('loadedmetadata');video.dispatch('playing');video.frame();
        await h.advance(800);
        // Simulate a ten-second clip, so the tail waits well beyond the old five-minute expiry.
        await h.advance(9200);video.dispatch('ended');await h.settle();
    }
    await h.advance(1600);
    assert.equal(h.elements.length,events.length);
    assert.deepEqual(h.polls.filter(url=>url.searchParams.get('playback')==='started').map(url=>url.searchParams.get('ack')),events.map(event=>event.id));
    assert.deepEqual(f.poll().events,[]);assert.equal(f.service.list()[0].pendingThisLive,false);
    assert.equal(h.polls.some(url=>url.searchParams.get('playback')==='failed'),false);
    for(let index=0;index<events.length;index++)assert.deepEqual(f.gift('overlay-'+index),[]);
});

// Exercise the actual editor handlers with a small DOM, without Electron or a live account.
function editorHarness(items=[]){
    const nodes=new Map(),calls=[],confirmations=[];
    const attrs=text=>Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match=>[match[1],match[2]??true]));
    class Element{
        constructor(){this.hidden=false;this.disabled=false;this.handlers=new Map();this.firstChild={textContent:''};}
        set innerHTML(html){
            this.html=html;
            for(const match of html.matchAll(/<[\w-]+\b[^>]*\bid="([^"]+)"[^>]*>/g))nodes.set(match[1],new Element());
            const form=nodes.get('entryVideoForm');
            if(html.includes('<form id="entryVideoForm"')){
                form.fields=[];
                for(const match of html.matchAll(/<input\b([^>]*)>|<select\b([^>]*)>([\s\S]*?)<\/select>/g)){
                    const a=attrs(match[1]??match[2]),field=new Element();Object.assign(field,a);
                    if(!a.name)continue;
                    field.checked=!!a.checked;field.required=!!a.required;
                    if(match[2]!==undefined){const options=[...match[3].matchAll(/<option\b([^>]*)>/g)].map(option=>attrs(option[1]));field.value=(options.find(option=>option.selected)||options[0]).value;}
                    else field.value=a.value??'';
                    form.fields.push(field);
                }
                form.elements=new Proxy({}, {get:(_target,name)=>form.fields.find(field=>field.name===name)});
                form.reportValidity=()=>form.fields.every(field=>field.disabled||!field.required||!!field.value);
            }
        }
        get innerHTML(){return this.html||'';}
        append(element){nodes.set(element.id,element);}
        addEventListener(name,callback){this.handlers.set(name,callback);}
        replaceChildren(){this.html='';}
        querySelector(){return new Element();}
        querySelectorAll(){return [];}
        closest(){return this;}
        setAttribute(){}
        focus(){nodes.set('focused',this);}
        showModal(){this.open=true;}
        close(){this.open=false;this.handlers.get('close')?.();}
    }
    nodes.set('workspaceRoot',new Element());
    const copy=new Element();
    const document={getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelector:selector=>selector==='[data-entry-copy]'?copy:null};
    const context={window:{},document,URL,location:{href:'http://localhost/'},Date,confirm:message=>{confirmations.push(message);return true;}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/entry-videos.js'),'utf8'),context);
    const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    const page=context.window.TikMnGEntryVideos.create({call:async(action,data)=>{calls.push({action,data});return {entryVideos:items};},
        icon:()=>'',esc,notify(){},onSaved:async()=>{},chooseGift(){},giftMarkup:gift=>String(gift)});
    const data={entryVideos:items,entryVideoStatus:{},entryVideoUrl:''};page.render(new Element(),data);
    const click=(action,id)=>{
        const button={dataset:{['entry'+action[0].toUpperCase()+action.slice(1)]:id},hasAttribute:name=>name==='data-entry-'+action};
        nodes.get('entryVideoPage').onclick({target:{closest:()=>button}});
    };
    return {nodes,calls,confirmations,page,data,click,form:()=>nodes.get('entryVideoForm')};
}

function editorItem(settings={}){
    return {id:crypto.randomUUID(),username:'alice',title:'Intro',filename:'intro.mp4',trigger:'gift',giftId:'5655',
        oncePerLive:true,cooldownSeconds:600,volume:.8,enabled:true,fade:true,remote:true,url:'https://video.example/intro.mp4',previewUrl:'http://localhost/tikmng/media/preview',...settings};
}

test('editor keeps person rules editable and submits an unrestricted any-sender gift without a username',async()=>{
    const item=editorItem(),h=editorHarness([item]);h.click('edit',item.id);
    const form=h.form(),f=form.elements;
    assert.equal(f.scope.value,'person');assert.equal(f.username.required,true);assert.equal(f.username.value,'@alice');
    f.scope.value='any-sender';f.scope.onchange();
    assert.equal(f.username.required,false);assert.equal(f.username.disabled,true);assert.equal(h.nodes.get('entryUsernameField').hidden,true);
    assert.equal(f.oncePerLive.disabled,true);assert.equal(f.cooldownMinutes.disabled,true);assert.equal(h.nodes.get('entryEveryGiftHint').hidden,false);
    await form.onsubmit({preventDefault(){}});
    const saved=h.calls.find(call=>call.action==='entry-save').data;
    assert.equal(saved.scope,'any-sender');assert.equal(saved.username,'');assert.equal(saved.oncePerLive,false);assert.equal(saved.cooldownSeconds,0);
    assert.equal(saved.id,item.id);assert.equal(saved.giftId,'5655');
});

test('editor restores person validation and repeat controls when scope or trigger changes',async()=>{
    const item=editorItem({scope:'any-sender',username:'',oncePerLive:false,cooldownSeconds:0}),h=editorHarness([item]);h.click('edit',item.id);
    const form=h.form(),f=form.elements;
    f.trigger.value='comment';f.trigger.onchange();
    assert.equal(f.oncePerLive.disabled,false);assert.equal(f.cooldownMinutes.disabled,false);assert.equal(h.nodes.get('entryEveryGiftHint').hidden,true);
    f.scope.value='person';f.scope.onchange();assert.equal(f.username.required,true);assert.equal(f.username.disabled,false);
    await form.onsubmit({preventDefault(){}});assert.equal(h.calls.length,0,'Person scope still requires a username');
    f.username.value='@bob';f.oncePerLive.checked=true;f.oncePerLive.onchange();f.cooldownMinutes.value='5';
    await form.onsubmit({preventDefault(){}});
    const saved=h.calls[0].data;assert.equal(saved.scope,'person');assert.equal(saved.username,'@bob');assert.equal(saved.oncePerLive,true);assert.equal(saved.cooldownSeconds,300);
});

test('editor saves any-sender entry and comment rules with their own repeat settings',async()=>{
    for(const trigger of ['entry','comment']){
        const item=editorItem({scope:'any-sender',username:'',trigger,oncePerLive:false,cooldownSeconds:120}),h=editorHarness([item]);h.click('edit',item.id);
        const form=h.form(),f=form.elements;
        assert.equal(f.username.required,false);assert.equal(f.username.disabled,true);assert.equal(h.nodes.get('entryGiftField').hidden,true);
        assert.equal(f.oncePerLive.disabled,false);assert.equal(f.cooldownMinutes.disabled,false);
        await form.onsubmit({preventDefault(){}});
        const saved=h.calls[0].data;assert.equal(saved.scope,'any-sender');assert.equal(saved.username,'');assert.equal(saved.trigger,trigger);
        assert.equal(saved.oncePerLive,false);assert.equal(saved.cooldownSeconds,120);
    }
});

test('scope updates redraw list identity and use it in previews and removal prompts',async()=>{
    const item=editorItem(),h=editorHarness([item]);assert.match(h.nodes.get('entryVideoRows').innerHTML,/<strong>@alice<\/strong>/);
    const any={...item,scope:'any-sender'};h.page.update({...h.data,entryVideos:[any]});
    assert.match(h.nodes.get('entryVideoRows').innerHTML,/<strong>Herkes<\/strong>/);assert.match(h.nodes.get('entryVideoRows').innerHTML,/Tamamlanan her hediyede/);
    h.click('preview',item.id);assert.match(h.nodes.get('entryVideoEditor').innerHTML,/<h2>Herkes<\/h2>/);
    h.page.close();h.click('delete',item.id);await Promise.resolve();
    assert.match(h.confirmations[0],/^Herkes için/);assert.equal(h.calls[0].action,'entry-remove');
});
