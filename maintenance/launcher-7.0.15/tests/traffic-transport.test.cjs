'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http');
const {createWidgetChanges}=require('../lib/widget-changes.cjs');
const source=fs.readFileSync(path.join(__dirname,'../renderer/widgets/change-transport.js'),'utf8');
const token='A'.repeat(43),prefix='/overlays/'+token,origin='https://relay.test';
const state=origin+prefix+'/api/widget/state?type=coinjar&channel=alice';
const revision='a'.repeat(32),snapshot={channel:'alice',activities:[],__stateRevision:revision};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(t,{hidden=false,preview=false,responses=[],fetcher,base=origin}={}){
    const document=new EventTarget(),events=new EventTarget(),calls=[],timers=new Map();let timerId=0;
    document.hidden=hidden;
    const context={document,location:{href:base+prefix+'/widget-overlay.html'+(preview?'?preview=1':''),pathname:prefix+'/widget-overlay.html',origin:base,search:preview?'?preview=1':''},
        window:{fetch:(...args)=>{calls.push(args);return fetcher?fetcher(...args):Promise.resolve(responses.shift()||Response.json({}));}},
        URL,URLSearchParams,Response,AbortController,DOMException,TextEncoder,
        setTimeout:(callback,ms)=>{const id=++timerId;timers.set(id,{callback,ms});return id;},clearTimeout:id=>timers.delete(id),
        addEventListener:(...args)=>events.addEventListener(...args)};
    vm.runInNewContext(source,context);
    const h={...context,calls,timers,fetch:(...args)=>context.window.fetch(...args),exit:()=>events.dispatchEvent(new Event('pagehide')),
        visibility(hidden){document.hidden=hidden;document.dispatchEvent(new Event('visibilitychange'));},
        expire(){for(const [id,timer] of [...timers]){timers.delete(id);timer.callback();}}};
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

test('legacy interval refreshes share a long poll and independently consumable responses',async t=>{
    const f=pendingFetcher(),h=harness(t,f);
    const first=h.fetch(state);f.pending[0].resolve(Response.json(snapshot));await (await first).json();
    const requests=Array.from({length:13},(_,index)=>h.fetch(state+'&t='+index));
    assert.equal(h.calls.length,2,'13 interval ticks create one waiting HTTP request');
    assert.equal(new URL(h.calls[1][0]).searchParams.get('after'),revision);
    assert.equal(h.timers.size,1);
    f.pending[1].resolve(new Response(null,{status:204}));
    const responses=await Promise.all(requests);
    assert.equal(new Set(responses).size,13);
    for(const result of responses){assert.equal(result.headers.get('cache-control'),'no-store');assert.deepEqual(await result.json(),snapshot);}
    assert.equal(h.timers.size,0);
    const next=h.fetch(state);assert.equal(h.calls.length,3,'completion does not introduce a polling delay');
    f.pending[2].resolve(Response.json({...snapshot,activities:[{id:'gift-now',createdAt:10}],__stateRevision:'b'.repeat(32)}));
    assert.equal((await (await next).json()).activities[0].id,'gift-now');
    t.diagnostic('Unchanged-state interval burst: 13 HTTP requests -> 1 (92.3% fewer); 0 response body bytes from 204.');
});

test('one subscriber cannot cancel another; canceling the last permits an immediate fresh poll',async t=>{
    const f=pendingFetcher(),h=harness(t,f),one=new AbortController(),two=new AbortController();
    const first=h.fetch(state,{signal:one.signal}),second=h.fetch(state,{signal:two.signal});
    one.abort();await assert.rejects(first,{name:'AbortError'});
    assert.equal(f.pending[0].signal.aborted,false);
    f.pending[0].resolve(Response.json(snapshot));assert.deepEqual(await (await second).json(),snapshot);
    const last=new AbortController(),abandoned=h.fetch(state,{signal:last.signal});
    last.abort();await assert.rejects(abandoned,{name:'AbortError'});assert.equal(f.pending[1].signal.aborted,true);
    const fresh=h.fetch(state);assert.equal(h.calls.length,3);
    f.pending[2].resolve(new Response(null,{status:204}));assert.deepEqual(await (await fresh).json(),snapshot);
    const canceled=new AbortController();canceled.abort();
    await assert.rejects(h.fetch(state,{signal:canceled.signal}),{name:'AbortError'});assert.equal(h.calls.length,3);
});

test('only previews suspend traffic, and hidden interval ticks share one bounded wait',async t=>{
    const f=pendingFetcher(),h=harness(t,{...f,hidden:true,preview:true});
    const waiting=Array.from({length:20},()=>h.fetch(state));
    assert.equal(h.calls.length,0);assert.equal(h.timers.size,1);
    h.visibility(false);await settle();assert.equal(h.calls.length,1);assert.equal(h.timers.size,1);
    h.visibility(true);for(const request of waiting)await assert.rejects(request,{name:'AbortError'});
    assert.equal(f.pending[0].signal.aborted,true);assert.equal(h.timers.size,0);
    const resume=h.fetch(state);assert.equal(h.calls.length,1);h.visibility(false);await settle();
    assert.equal(h.calls.length,2);f.pending[1].resolve(Response.json(snapshot));await resume;
    const broadcast=pendingFetcher(),live=harness(t,{...broadcast,hidden:true});
    const delivery=live.fetch(state);live.visibility(false);live.visibility(true);
    assert.equal(broadcast.pending[0].signal.aborted,false);
    broadcast.pending[0].resolve(Response.json(snapshot));assert.deepEqual(await (await delivery).json(),snapshot);
});

test('source exit cancels waiting previews and active broadcasts; reload starts without a revision',async t=>{
    for(const hidden of [false,true]){
        const f=pendingFetcher(),h=harness(t,{...f,preview:hidden,hidden});
        const requests=[h.fetch(state),h.fetch(state)];h.exit();
        for(const request of requests)await assert.rejects(request,{name:'AbortError'});
        assert.equal(h.timers.size,0);assert.ok(f.pending.every(request=>request.signal.aborted));
        h.visibility(false);await settle();assert.equal(h.calls.length,hidden?0:1);
        await assert.rejects(h.fetch(state),{name:'AbortError'});
    }
    const original=harness(t,{responses:[Response.json(snapshot)]});await original.fetch(state);original.exit();
    const reload=harness(t,{responses:[Response.json(snapshot)]});await reload.fetch(state);
    assert.equal(new URL(reload.calls[0][0]).searchParams.has('after'),false);
});

test('canonical query order deduplicates, while channels, screens, games, cursors and history stay isolated',async t=>{
    const f=pendingFetcher(),h=harness(t,f);
    const urls=[state,origin+prefix+'/api/widget/state?channel=alice&type=coinjar&t=2',
        state.replace('alice','bob'),state+'&screen=2',state+'&eventsAfter=10',state+'&eventsAfter=20',state+'&history=0',
        state.replace('type=coinjar','type=game&game=race&mode=score'),state.replace('type=coinjar','type=game&game=race&mode=wins')];
    const requests=urls.map(url=>h.fetch(url));assert.equal(h.calls.length,urls.length-1);
    for(const [index,request] of f.pending.entries())request.resolve(Response.json({...snapshot,marker:index}));
    const values=await Promise.all(requests.map(async request=>(await request).json()));
    assert.equal(values[0].marker,values[1].marker);assert.equal(new Set(values.map(value=>value.marker)).size,urls.length-1);
});

test('advancing event cursors and dropping history never reuse a revision for a different projection',async t=>{
    const h=harness(t,{responses:[Response.json({...snapshot,jarGifts:[{id:'saved'}]}),Response.json(snapshot),Response.json(snapshot),Response.json(snapshot),new Response(null,{status:204})]});
    for(const url of [state,state+'&eventsAfter=10',state+'&eventsAfter=20',state+'&eventsAfter=20&history=0']){
        await h.fetch(url);assert.equal(new URL(h.calls.at(-1)[0]).searchParams.has('after'),false);
    }
    assert.deepEqual(await (await h.fetch(state+'&history=0&eventsAfter=20')).json(),snapshot);
    assert.equal(new URL(h.calls.at(-1)[0]).searchParams.get('after'),revision);
});

test('unsupported, malformed, oversized and failed responses invalidate old cached revisions',async t=>{
    const invalid=[Response.json({channel:'alice',score:99}),Response.json({...snapshot,__stateRevision:'invalid'}),new Response('{broken'),
        Response.json({...snapshot,padding:'x'.repeat(2*1024*1024)}),new Response('offline',{status:503}),Response.json(snapshot,{status:201}),Response.json(snapshot,{status:206})];
    for(const result of invalid){
        const expected=await result.clone().text();
        const h=harness(t,{responses:[Response.json(snapshot),result,new Response(null,{status:204})]});
        await h.fetch(state);const received=await h.fetch(state);
        assert.equal(received.status,result.status);assert.equal(await received.text(),expected);
        const next=await h.fetch(state);assert.equal(new URL(h.calls[2][0]).searchParams.has('after'),false);
        assert.equal(next.status,204,'an uncached 204 must never replay the stale state');
    }
});

test('old publishers keep their poll cadence and cache remains bounded across source queries',async t=>{
    const h=harness(t,{responses:[Response.json({score:1}),Response.json({score:2}),...Array.from({length:5},()=>Response.json(snapshot)),new Response(null,{status:204})]});
    assert.equal((await (await h.fetch(state)).json()).score,1);assert.equal((await (await h.fetch(state)).json()).score,2);
    assert.equal(h.calls.length,2);assert.equal(new URL(h.calls[1][0]).searchParams.has('after'),false);
    for(let screen=1;screen<=5;screen++)await h.fetch(state+'&screen='+screen);
    await h.fetch(state+'&screen=1');assert.equal(new URL(h.calls.at(-1)[0]).searchParams.has('after'),false);
});

test('only ordinary same-origin state GETs opt in; credentials, explicit cursors and other routes pass through',async t=>{
    const h=harness(t),otherPrefix='/overlays/'+'B'.repeat(43);
    const cases=[
        [state.replace(origin,'https://external.test'),{}],[state.replace(prefix,otherPrefix),{}],
        [origin+prefix+'/api/widget/state/extra',{}],[origin+prefix+'/api/widget/gift-assets/test.png',{}],
        [origin+prefix+'/tikmng/media/poll',{}],[state,{method:'HEAD'}],[state,{method:'POST',body:'{}'}],
        [state,{headers:{Authorization:'test'}}],[state,{credentials:'omit'}],[state,{mode:'no-cors'}],
        [state+'&transport=changes&after='+revision,{}],[state+'&after='+revision,{}]
    ];
    for(const [url,options] of cases){await h.fetch(url,options);assert.equal(h.calls.at(-1)[0],url);assert.equal(h.calls.at(-1)[1],options);}
    for(const route of ['/widget/state','/api/widget/state','/widget/top-gift/state','/api/widget/top-likes/state','/widget/leaderboard/state','/api/widget/activity/state']){
        await h.fetch(origin+prefix+route);assert.equal(new URL(h.calls.at(-1)[0]).searchParams.get('transport'),'changes');
    }
});

test('the network timeout aborts the shared request and all subscribers can retry immediately',async t=>{
    const f=pendingFetcher(),h=harness(t,f),first=h.fetch(state),second=h.fetch(state);
    assert.deepEqual([...h.timers.values()].map(timer=>timer.ms),[14000]);h.expire();
    await assert.rejects(first,{name:'AbortError'});await assert.rejects(second,{name:'AbortError'});
    assert.equal(f.pending[0].signal.aborted,true);assert.equal(h.timers.size,0);
    const retry=h.fetch(state);assert.equal(h.calls.length,2);f.pending[1].resolve(Response.json(snapshot));await retry;
});

test('real local HTTP delivers gifts and resets promptly, with one request per interval burst',async t=>{
    const feed=createWidgetChanges({interval:10,waitMs:250}),states={alice:{channel:'alice',activities:[],studio:{resets:{coinjar:0}}},bob:{channel:'bob',activities:[]}};
    const received=[],sent=[];let observed;
    const server=http.createServer((req,res)=>{
        const url=new URL(req.url,'http://localhost'),end=res.end;
        received.push(url);observed?.();observed=null;
        res.end=function(body,...args){sent.push({status:res.statusCode,bytes:body?Buffer.byteLength(body):0});return end.call(this,body,...args);};
        if(!feed.handle(req,res,url,()=>states[url.searchParams.get('channel')])){res.writeHead(400);res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{feed.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
    const base='http://127.0.0.1:'+server.address().port,h=harness(t,{base,fetcher:fetch}),url=state.replace(origin,base);
    await (await h.fetch(url)).json();
    const started=new Promise(resolve=>{observed=resolve;}),burst=Array.from({length:20},(_,i)=>h.fetch(url+'&t='+i));
    await started;assert.equal(received.length,2);assert.equal(feed.pending(),1);
    const at=performance.now();states.alice.activities=[{id:'gift-live',createdAt:Date.now()}];
    for(const response of await Promise.all(burst))assert.equal((await response.json()).activities[0].id,'gift-live');
    const giftLatencyMs=Math.round(performance.now()-at);assert.ok(giftLatencyMs<1000,'gift reaches all subscribers within one second');
    assert.equal(received.length,2);assert.equal(sent.length,2);
    states.alice={channel:'alice',activities:[],studio:{resets:{coinjar:Date.now()}}};
    const reset=await (await h.fetch(url)).json();assert.deepEqual(reset.activities,[]);assert.ok(reset.studio.resets.coinjar>0);
    const idle=await (await h.fetch(url)).json();assert.deepEqual(idle,reset);assert.deepEqual(sent.at(-1),{status:204,bytes:0});
    const bob=await (await h.fetch(url.replace('alice','bob'))).json();assert.equal(bob.channel,'bob');assert.equal(received.at(-1).searchParams.has('after'),false);
    const reload=harness(t,{base,fetcher:fetch});await reload.fetch(url);assert.equal(received.at(-1).searchParams.has('after'),false);
    t.diagnostic(JSON.stringify({localOnly:true,intervalRefreshes:20,httpRequests:1,requestReductionPercent:95,idleResponseBodyBytes:0,giftLatencyMs,resetDelivered:true,channelIsolated:true,reloadUncached:true}));
});
