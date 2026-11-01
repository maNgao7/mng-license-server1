'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const patch=require('../renderer/widgets/state-patch.js');
const source=fs.readFileSync(path.join(__dirname,'../renderer/widgets/change-transport.js'),'utf8');
const origin='https://relay.test',prefix='/overlays/'+'A'.repeat(43),state=origin+prefix+'/api/widget/state?channel=alice&type=coinjar';
const revision='a'.repeat(32),nextRevision='b'.repeat(32),token='1'.repeat(32),nextToken='2'.repeat(32);
const snapshot={channel:'alice',activities:[],updatedAt:100,time:99,studio:{streamTimer:{serverNow:100,remainingMs:1500}},__stateRevision:revision,__stateToken:token};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function data(value){const result={...value};delete result.__stateRevision;delete result.__stateToken;return result;}
function delta(before,after){return {__stateRevision:after.__stateRevision,__stateToken:after.__stateToken,
    __statePatch:{version:1,base:before.__stateToken,operations:patch.diff(data(before),data(after))}};}
function harness(t,{helper=patch,responses=[],fetcher,hidden=false,preview=false}={}){
    const document=new EventTarget(),events=new EventTarget(),calls=[],timers=new Map(),maps=[];let timer=0;
    document.hidden=hidden;
    const context={document,location:{href:origin+prefix+'/widget-overlay.html'+(preview?'?preview=1':''),pathname:prefix+'/widget-overlay.html',origin,search:preview?'?preview=1':''},
        window:{TikMnGStatePatch:helper,fetch:(...args)=>{calls.push(args);if(fetcher)return fetcher(...args);
            const result=responses.shift();if(!result)throw new Error('Unexpected HTTP request');return Promise.resolve(result);}},
        URL,URLSearchParams,Response,AbortController,DOMException,TextEncoder,
        Map:class extends Map{constructor(...args){super(...args);maps.push(this);}},
        setTimeout:(callback,ms)=>{const id=++timer;timers.set(id,{callback,ms});return id;},
        clearTimeout:id=>timers.delete(id),addEventListener:(...args)=>events.addEventListener(...args)};
    vm.runInNewContext(source,context);
    const h={calls,timers,cache:maps[0],fetch:(...args)=>context.window.fetch(...args),exit:()=>events.dispatchEvent(new Event('pagehide')),
        visibility(hidden){document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));},
        expire(){for(const [id,{callback}] of [...timers]){timers.delete(id);callback();}}};
    t.after(h.exit);return h;
}
function pendingFetcher(){
    const pending=[];
    return {pending,fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{
        const abort=()=>reject(signal.reason||new DOMException('aborted','AbortError'));
        if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});
        pending.push({signal,resolve:result=>{signal.removeEventListener('abort',abort);resolve(result);}});
    })};
}
async function read(h,url=state,options){return (await h.fetch(url,options)).json();}
function params(h,index=-1){return new URL(h.calls.at(index)[0]).searchParams;}

test('v2 reconstructs exact full snapshots with opaque keyed arrays, deletions and replaced metadata',async t=>{
    const first={...snapshot,jarGifts:[{id:'old',amount:1}],obsolete:{remove:true},
        leaderboard:[{id:'one',name:'x'.repeat(500),score:1},{id:'two',name:'y'.repeat(500),score:2}]};
    const second={...snapshot,updatedAt:101,time:100,studio:{streamTimer:{serverNow:101,remainingMs:1499}},__stateToken:nextToken,
        leaderboard:[{id:'two',name:'y'.repeat(500),score:3},{id:'one',name:'x'.repeat(500),score:1}]};
    const third={...second,activities:[{id:'gift-now',createdAt:102}],__stateRevision:nextRevision,__stateToken:'3'.repeat(32)};
    const inspected=[],helper={apply(base,operations){inspected.push(JSON.parse(JSON.stringify(base)));return patch.apply(base,operations);}};
    const wire=delta(first,second);assert.ok(wire.__statePatch.operations.some(operation=>operation[0]===2));
    const h=harness(t,{helper,responses:[Response.json(first),Response.json(wire),new Response(null,{status:204}),Response.json(delta(second,third))]});
    assert.deepEqual(await read(h),first);assert.equal(params(h).get('patch'),'1');assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
    const projection=state+'&eventsAfter=10&history=0',rebuilt=await h.fetch(projection);
    assert.equal(rebuilt.headers.get('cache-control'),'no-store');assert.deepEqual(await rebuilt.json(),second);
    assert.deepEqual(inspected,[first],'the helper receives all fields of the exact previous parsed response');
    assert.equal(params(h).get('after'),revision);assert.equal(params(h).get('base'),token);
    assert.equal(params(h).get('eventsAfter'),'10');assert.equal(params(h).get('history'),'0');
    assert.deepEqual(await read(h,projection),second);assert.equal(params(h).get('after'),revision);assert.equal(params(h).get('base'),nextToken);
    const delivered=await read(h,projection);assert.deepEqual(delivered,third);assert.equal(h.calls.length,4);
    assert.equal(h.timers.size,0);assert.equal(Object.hasOwn(delivered,'__statePatch'),false);
});

test('without the helper requests remain v1; older servers without tokens retain exact projection keys',async t=>{
    const legacy={...snapshot};delete legacy.__stateToken;
    for(const helper of [null,patch]){
        const h=harness(t,{helper,responses:[Response.json(legacy),Response.json(legacy),Response.json(legacy),new Response(null,{status:204})]});
        for(const url of [state,state+'&eventsAfter=10',state+'&eventsAfter=10&history=0']){
            assert.deepEqual(await read(h,url),legacy);assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
            assert.equal(params(h).get('patch'),helper?'1':null);
        }
        assert.deepEqual(await read(h,state+'&history=0&eventsAfter=10'),legacy);assert.equal(params(h).get('after'),revision);assert.equal(params(h).has('base'),false);
    }
    const h=harness(t,{helper:{apply:null},responses:[Response.json(snapshot),new Response(null,{status:204})]});
    await read(h);assert.deepEqual(await read(h),snapshot);assert.equal(params(h).has('patch'),false);assert.equal(params(h).has('base'),false);
});

test('v2 cache shares only event cursor and history; other query and endpoint scopes stay bound',async t=>{
    const isolated=[state.replace('alice','bob'),state+'&screen=2',state+'&items=5',state+'&limit=5',state+'&wait=1',state+'&custom=1',
        state.replace('type=coinjar','type=game&game=race&mode=score'),state.replace('/api/widget/state','/api/widget/activity/state'),
        state.replace('/api/widget/state','/widget/state'),state+'&channel=bob',state+'&historyMode=0'];
    for(const url of isolated){
        const h=harness(t,{responses:[Response.json(snapshot),Response.json(snapshot)]});
        await read(h,state+'&eventsAfter=1&history=1');await read(h,url+'&eventsAfter=20&history=0');
        assert.equal(params(h).has('after'),false,url);assert.equal(params(h).has('base'),false,url);
    }
    const h=harness(t,{responses:[Response.json(snapshot),new Response(null,{status:204})]});
    await read(h,state+'&eventsAfter=1&history=1');await read(h,state+'&history=0&eventsAfter=20');
    assert.equal(params(h).get('after'),revision);assert.equal(params(h).get('base'),token);
});

test('v2 pending dedupe preserves cursor/history/cache semantics and each subscriber owns cancellation',async t=>{
    const f=pendingFetcher(),h=harness(t,f),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
    const one=new AbortController(),two=new AbortController(),three=new AbortController();
    const first=h.fetch(state+'&eventsAfter=10&history=1',{signal:one.signal});
    const duplicate=h.fetch(state+'&history=1&eventsAfter=10&t=2',{signal:two.signal});
    const cursor=h.fetch(state+'&eventsAfter=20&history=1'),history=h.fetch(state+'&eventsAfter=10&history=0',{signal:three.signal});
    const mode=h.fetch(state+'&eventsAfter=10&history=1',{cache:'reload'});
    assert.equal(h.calls.length,5,'only fully equivalent queries and cache modes join the same HTTP request');
    for(let i=1;i<5;i++)assert.equal(params(h,i).get('base'),token);
    one.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(f.pending[1].signal.aborted,false);
    three.abort();await assert.rejects(history,{name:'AbortError'});assert.equal(f.pending[3].signal.aborted,true);
    assert.equal(f.pending[2].signal.aborted,false);assert.equal(f.pending[4].signal.aborted,false);
    for(const i of [1,2,4])f.pending[i].resolve(new Response(null,{status:204}));
    for(const result of await Promise.all([duplicate,cursor,mode]))assert.deepEqual(await result.json(),snapshot);
    assert.equal(h.timers.size,0);
});

test('invalid patches evict and recover once on the identical scoped URL without after/base',async t=>{
    const after={...snapshot,activities:[{id:'gift-live'}],__stateRevision:nextRevision,__stateToken:nextToken};
    const valid=delta(snapshot,after),bad=[
        {...valid,__statePatch:{...valid.__statePatch,base:'wrong'}},
        {...valid,__statePatch:{...valid.__statePatch,version:2}},
        {...valid,__statePatch:{...valid.__statePatch,operations:{}}},
        {...valid,__statePatch:{...valid.__statePatch,operations:[[99,[]]]}},
        {...valid,__statePatch:{...valid.__statePatch,operations:[[0,[],[]]]}},
        {...valid,__statePatch:null},{...valid,__stateToken:''},{...valid,__stateToken:10},{...valid,__stateRevision:'bad'}
    ];
    for(const wire of bad){
        const h=harness(t,{responses:[Response.json(snapshot),Response.json(wire),Response.json(after),new Response(null,{status:204})]});
        const url=state+'&screen=2&items=10&eventsAfter=99&history=0';await read(h,url);
        assert.deepEqual(await read(h,url,{cache:'no-store'}),after);assert.equal(h.calls.length,3);
        const recovery=params(h);assert.equal(recovery.has('after'),false);assert.equal(recovery.has('base'),false);assert.equal(recovery.get('patch'),'1');
        for(const name of ['channel','type','screen','items','eventsAfter','history'])assert.equal(recovery.get(name),new URL(url).searchParams.get(name));
        assert.equal(h.calls[2][1].cache,'no-store');assert.equal(h.calls[1][1].signal,h.calls[2][1].signal);
        assert.deepEqual(await read(h,url),after);assert.equal(params(h).get('base'),nextToken);
    }
});

test('failed full recovery rejects without leaking a patch or replaying the evicted snapshot',async t=>{
    const bad=delta(snapshot,{...snapshot,__stateToken:nextToken});bad.__statePatch.base='wrong';
    const failures=[()=>Response.json(bad),()=>new Response(null,{status:204}),()=>new Response('offline',{status:503}),
        ()=>new Response('{broken'),()=>Response.json(null),()=>Response.json([]),()=>Response.json('invalid')];
    for(const failure of failures){
        const h=harness(t,{responses:[Response.json(snapshot),Response.json(bad),failure(),Response.json(snapshot)]});
        await read(h);await assert.rejects(h.fetch(state));assert.equal(h.calls.length,3);assert.equal(h.timers.size,0);
        assert.deepEqual(await read(h),snapshot);assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
    }
});

test('unexpected patches without a token or helper recover to a full v1 response',async t=>{
    const legacy=data(snapshot),wire=delta(snapshot,{...snapshot,__stateToken:nextToken});
    for(const helper of [null,patch]){
        const h=harness(t,{helper,responses:[Response.json(wire),Response.json(legacy),Response.json(legacy)]});
        assert.deepEqual(await read(h),legacy);assert.equal(h.calls.length,2);
        assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
        assert.deepEqual(await read(h),legacy);assert.equal(params(h).has('after'),false);
    }
});

test('coalesced recovery keeps cancellation isolated and an abandoned retry permits an immediate full request',async t=>{
    const f=pendingFetcher(),h=harness(t,f),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
    const one=new AbortController(),two=new AbortController(),first=h.fetch(state,{signal:one.signal}),second=h.fetch(state,{signal:two.signal});
    const bad=delta(snapshot,{...snapshot,__stateToken:nextToken});bad.__statePatch.base='wrong';
    f.pending[1].resolve(Response.json(bad));
    while(h.calls.length<3)await settle();
    assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);assert.equal(h.timers.size,1);
    one.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(f.pending[2].signal.aborted,false);
    two.abort();await assert.rejects(second,{name:'AbortError'});assert.equal(f.pending[2].signal.aborted,true);
    const fresh=h.fetch(state);assert.equal(h.calls.length,4);assert.equal(params(h).has('after'),false);
    f.pending[3].resolve(Response.json(snapshot));assert.deepEqual(await (await fresh).json(),snapshot);assert.equal(h.timers.size,0);
});

test('newer generations win the v2 cache even when an older delta finishes last',async t=>{
    const f=pendingFetcher(),h=harness(t,f),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
    const old=h.fetch(state+'&eventsAfter=10'),recent=h.fetch(state+'&eventsAfter=20');
    const older={...snapshot,activities:[{id:'old'}],__stateToken:nextToken},newer={...snapshot,activities:[{id:'new'}],__stateRevision:nextRevision,__stateToken:'3'.repeat(32)};
    f.pending[2].resolve(Response.json(delta(snapshot,newer)));assert.deepEqual(await (await recent).json(),newer);
    f.pending[1].resolve(Response.json(delta(snapshot,older)));assert.deepEqual(await (await old).json(),older);
    const next=h.fetch(state+'&history=0&eventsAfter=30');assert.equal(params(h).get('base'),newer.__stateToken);assert.equal(params(h).get('after'),nextRevision);
    f.pending[3].resolve(new Response(null,{status:204}));assert.deepEqual(await (await next).json(),newer);
});

test('a newer invalid response cannot be undone by an older full response, including v1 cache modes',async t=>{
    for(const helper of [null,patch]){
        const f=pendingFetcher(),h=harness(t,{...f,helper}),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
        const old=h.fetch(state,{cache:'no-store'}),recent=h.fetch(helper?state+'&eventsAfter=20':state,{cache:'reload'});
        f.pending[2].resolve(new Response('unavailable',{status:503}));assert.equal((await recent).status,503);
        f.pending[1].resolve(Response.json(snapshot));await old;
        const next=h.fetch(state);assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
        f.pending[3].resolve(Response.json(snapshot));await next;
    }
});

test('late parsing and an aborted request cannot repopulate the cache after a replacement request',async t=>{
    const f=pendingFetcher(),h=harness(t,f),abort=new AbortController();
    let release;const body=new Promise(resolve=>{release=resolve;});
    const old=h.fetch(state,{signal:abort.signal});f.pending[0].resolve({status:200,clone:()=>({text:()=>body})});await settle();
    abort.abort();await assert.rejects(old,{name:'AbortError'});
    const replacement=h.fetch(state),newer={...snapshot,__stateToken:nextToken};f.pending[1].resolve(Response.json(newer));await replacement;
    release(JSON.stringify(snapshot));await settle();
    const next=h.fetch(state);assert.equal(params(h).get('base'),nextToken);f.pending[2].resolve(new Response(null,{status:204}));
    assert.deepEqual(await (await next).json(),newer);
});

test('patch failures cannot mutate the saved exact base used by concurrent requests',async t=>{
    const f=pendingFetcher(),seen=[],helper={apply(base,operations){seen.push(JSON.parse(JSON.stringify(base)));if(operations[0]?.[0]===99){base.channel='corrupt';throw new Error('patch failed');}return patch.apply(base,operations);}};
    const h=harness(t,{...f,helper}),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
    const failed=h.fetch(state+'&eventsAfter=10'),healthy=h.fetch(state+'&eventsAfter=20'),after={...snapshot,__stateToken:nextToken};
    const bad=delta(snapshot,after);bad.__statePatch.operations=[[99,[]]];f.pending[1].resolve(Response.json(bad));
    while(h.calls.length<4)await settle();
    f.pending[2].resolve(Response.json(delta(snapshot,after)));assert.deepEqual(await (await healthy).json(),after);
    f.pending[3].resolve(Response.json(snapshot));await failed;assert.deepEqual(seen,[snapshot,snapshot]);
    const next=h.fetch(state);assert.equal(params(h).get('base'),nextToken);f.pending[4].resolve(new Response(null,{status:204}));await next;
});

test('v2 keeps the bounded cache and a full response without a token downgrades to exact v1 keys',async t=>{
    const legacy=data(snapshot);legacy.__stateRevision=revision;
    const h=harness(t,{responses:[...Array.from({length:6},()=>Response.json(snapshot)),Response.json(legacy),Response.json(legacy),new Response(null,{status:204})]});
    for(let screen=0;screen<5;screen++)await read(h,state+'&screen='+screen);
    await read(h,state+'&screen=0');assert.equal(params(h).has('base'),false,'the fifth scope evicts the oldest of four cached snapshots');
    await read(h,state+'&screen=0&eventsAfter=10');assert.equal(params(h).get('base'),token);
    await read(h,state+'&screen=0&eventsAfter=20');assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
    assert.deepEqual(await read(h,state+'&screen=0&eventsAfter=10'),legacy);assert.equal(params(h).get('after'),revision);assert.equal(params(h).has('base'),false);
});

test('oversized reconstructed states are delivered losslessly but do not become patch bases',async t=>{
    const large={...snapshot,padding:'x'.repeat(2*1024*1024),__stateToken:nextToken};
    const h=harness(t,{responses:[Response.json(snapshot),Response.json(delta(snapshot,large)),Response.json(snapshot)]});
    await read(h);assert.deepEqual(await read(h),large);await read(h);assert.equal(params(h).has('after'),false);assert.equal(params(h).has('base'),false);
});

test('750 KiB and near-2 MiB full and reconstructed bodies remain exact patch bases',async t=>{
    for(const bytes of [750*1024,2*1024*1024]){
        const first={...snapshot,rows:[{id:'photo',score:1,avatar:''}]};
        first.rows[0].avatar='a'.repeat(bytes-Buffer.byteLength(JSON.stringify(first)));
        const second={...first,rows:[{...first.rows[0],score:2}],__stateRevision:nextRevision,__stateToken:nextToken};
        const h=harness(t,{responses:[Response.json(first),Response.json(delta(first,second)),new Response(null,{status:204})]});
        assert.deepEqual(await read(h),first);assert.deepEqual(await read(h),second);
        assert.equal(params(h).get('base'),token);assert.deepEqual(await read(h),second);
        assert.equal(params(h).get('base'),nextToken);assert.equal(params(h).get('after'),nextRevision);
        assert.equal(h.cache.size,1);assert.equal([...h.cache.values()][0].bytes,bytes);
    }
});

test('browser cache accounts exact UTF-8 bytes, bounds total retention and clears invalidated scopes',async t=>{
    const bytes=2*1024*1024;
    const first={...snapshot,padding:'\u{1f525}'.repeat(300000)};
    first.padding+='a'.repeat(bytes-Buffer.byteLength(JSON.stringify(first)));
    assert.ok(JSON.stringify(first).length<bytes);
    const h=harness(t,{fetcher:async()=>Response.json(first)});
    for(let screen=0;screen<20;screen++){
        assert.deepEqual(await read(h,state+'&screen='+screen),first);
        const retained=[...h.cache.values()];
        assert.ok(retained.length<=4);assert.ok(retained.reduce((sum,saved)=>sum+saved.bytes,0)<=8*1024*1024);
        for(const saved of retained)assert.equal(saved.bytes,Buffer.byteLength(saved.body));
    }
    assert.equal([...h.cache.values()].reduce((sum,saved)=>sum+saved.bytes,0),8*1024*1024);
    await read(h,state+'&screen=0');assert.equal(params(h).has('base'),false);
    h.exit();assert.equal(h.cache.size,0);
    const tooManyBytes={...snapshot,padding:'\u{1f525}'.repeat(530000)};
    assert.ok(JSON.stringify(tooManyBytes).length<bytes);assert.ok(Buffer.byteLength(JSON.stringify(tooManyBytes))>bytes);
    const invalid=harness(t,{responses:[Response.json(first),Response.json(tooManyBytes),Response.json(first)]});
    await read(invalid);assert.deepEqual(await read(invalid),tooManyBytes);assert.equal(invalid.cache.size,0);
    await read(invalid);assert.equal(params(invalid).has('after'),false);assert.equal(params(invalid).has('base'),false);
    assert.equal([...invalid.cache.values()][0].bytes,bytes);
});

test('v2 timeout, preview suspension and source exit cancel requests while hidden live broadcasts continue',async t=>{
    for(const action of ['timeout','preview','exit']){
        const f=pendingFetcher(),h=harness(t,{...f,preview:action==='preview'}),seed=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await seed;
        const requests=[h.fetch(state),h.fetch(state)];assert.equal(h.timers.size,1);assert.equal(params(h).get('base'),token);
        if(action==='timeout')h.expire();else if(action==='preview')h.visibility(true);else h.exit();
        for(const request of requests)await assert.rejects(request,{name:'AbortError'});
        assert.equal(f.pending[1].signal.aborted,true);assert.equal(h.timers.size,0);
    }
    const f=pendingFetcher(),h=harness(t,{...f,hidden:true}),live=h.fetch(state);h.visibility(false);h.visibility(true);
    assert.equal(f.pending[0].signal.aborted,false);f.pending[0].resolve(Response.json(snapshot));assert.deepEqual(await (await live).json(),snapshot);
});

test('explicit protocol queries and non-state requests pass through without negotiating v2',async t=>{
    const f=pendingFetcher(),h=harness(t,f),urls=[state+'&patch=1',state+'&base='+token,state+'&after='+revision,state+'&transport=changes',
        state.replace('/state','/gift-assets/test.png'),state.replace('/api/widget/state','/tikmng/media/poll'),state.replace(origin,'https://other.test'),
        state.replace(prefix,'/overlays/'+'B'.repeat(43))];
    for(const url of urls){
        const options={signal:new AbortController().signal},request=h.fetch(url,options);assert.equal(h.calls.at(-1)[0],url);assert.equal(h.calls.at(-1)[1],options);
        f.pending.at(-1).resolve(Response.json({ok:true}));await request;
    }
});

test('real Chromium retains oversized full states and receives exact score deltas and bodyless idle replies',{
    skip:!process.env.PLAYWRIGHT_MODULE
},async t=>{
    const http=require('node:http'),{createWidgetChanges}=require('../lib/widget-changes.cjs');
    const {chromium}=require(process.env.PLAYWRIGHT_MODULE),feed=createWidgetChanges({interval:5,waitMs:30});
    const sent=[];let current;
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://localhost');
        if(url.pathname==='/change-transport.js'||url.pathname==='/state-patch.js'){
            res.setHeader('Content-Type','text/javascript');
            return res.end(url.pathname==='/change-transport.js'?source:fs.readFileSync(path.join(__dirname,'../renderer/widgets/state-patch.js')));
        }
        if(url.pathname==='/'){
            res.setHeader('Content-Type','text/html');
            return res.end('<!doctype html><script src="/state-patch.js"></script><script src="/change-transport.js"></script>');
        }
        const end=res.end;
        res.end=function(body,...args){
            const value=body?JSON.parse(body):null;
            sent.push({status:res.statusCode,bytes:body?Buffer.byteLength(body):0,patch:!!value?.__statePatch,
                after:url.searchParams.get('after'),base:url.searchParams.get('base')});
            return end.call(this,body,...args);
        };
        if(!feed.handle(req,res,url,()=>current)){res.writeHead(404);res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{feed.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
    t.after(()=>browser.close());
    const page=await browser.newPage(),base='http://127.0.0.1:'+server.address().port;
    const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
    const read=route=>page.evaluate(async url=>{
        const response=await fetch(url,{cache:'no-store'});
        return {status:response.status,cache:response.headers.get('cache-control'),value:await response.json()};
    },route);
    for(const bytes of [750*1024,2*1024*1024-256,2*1024*1024+1]){
        current={channel:'alice',rows:[{id:'photo',score:1,avatar:'data:image/png;base64,'}]};
        current.rows[0].avatar+='a'.repeat(bytes-Buffer.byteLength(JSON.stringify(current)));
        const route=base+'/api/widget/state?type=topliker&channel=alice&screen='+bytes;
        const first=await read(route),fullBytes=sent.at(-1).bytes;
        assert.deepEqual(data(first.value),current);assert.equal(first.cache,'no-store');assert.equal(sent.at(-1).patch,false);
        current={...current,rows:[{...current.rows[0],score:2}]};
        const next=await read(route),wire=sent.at(-1);
        assert.deepEqual(data(next.value),current);assert.equal(next.status,200);assert.equal(next.cache,'no-store');
        if(bytes<=2*1024*1024){
            assert.equal(wire.patch,true);assert.equal(wire.base,first.value.__stateToken);assert.equal(wire.after,first.value.__stateRevision);
            assert.ok(wire.bytes<512);assert.ok(wire.bytes<fullBytes/100);
            const idle=await read(route);assert.deepEqual(idle.value,next.value);
            assert.equal(sent.at(-1).status,204);assert.equal(sent.at(-1).bytes,0);
            t.diagnostic('Chromium '+bytes+'-byte state: '+fullBytes+'-byte full -> '+wire.bytes+'-byte exact score delta -> 0-byte idle.');
        }else{
            assert.equal(wire.patch,false);assert.equal(wire.after,null);assert.equal(wire.base,null);
            assert.ok(wire.bytes>2*1024*1024);
            t.diagnostic('Chromium above 2 MiB: explicit full fallback, exact avatar and score, no retained revision/base.');
        }
        assert.ok(feed.historyStats().bytes<=8*1024*1024);
    }
    assert.deepEqual(errors,[]);
});
