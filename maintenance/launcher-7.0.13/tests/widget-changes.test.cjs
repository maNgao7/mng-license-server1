'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {signature,createWidgetChanges}=require('../lib/widget-changes.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(t,options={}){
    const feed=createWidgetChanges({interval:10,waitMs:80,...options}),states={alice:{score:1},bob:{score:2}};
    const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.searchParams.get('key')!=='secret'){res.writeHead(403);return res.end();}if(!feed.handle(req,res,url,()=>states[url.searchParams.get('channel')||'alice'])){res.writeHead(400);res.end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>{feed.close();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
    const url=`http://127.0.0.1:${server.address().port}/widget/state?key=secret&transport=changes`;
    return {feed,states,url,get:(query='')=>fetch(url+query)};
}
test('revision ignores advancing clocks but not scores, pictures, settings or deadlines',()=>{
    const first={updatedAt:1,time:1,studio:{streamTimer:{running:true,serverNow:100,remainingMs:900,endsAt:1000},pk:{battleId:'b',status:'active',seenAt:1,players:[{id:'a',score:10,avatar:'one'}],teams:[{id:'t',memberIds:['a'],score:10}],wins:{t:1}}}};
    const second=structuredClone(first);second.updatedAt++;second.time++;second.studio.pk.seenAt++;second.studio.streamTimer.serverNow++;second.studio.streamTimer.remainingMs--;
    assert.equal(signature(first),signature(second));
    for(const change of [value=>value.studio.pk.players[0].score++,value=>value.studio.pk.players[0].avatar='two',value=>value.studio.pk.wins.t++,value=>value.studio.streamTimer.endsAt++]){const changed=structuredClone(first);change(changed);assert.notEqual(signature(first),signature(changed));}
    assert.equal(first.studio.streamTimer.serverNow,100,'hashing does not mutate the snapshot');
});
test('idle widget replies contain no body; changed scores arrive without a polling interval',async t=>{
    const f=await fixture(t),first=await f.get(),data=await first.json();assert.match(data.__stateRevision,/^[a-f0-9]{32}$/);
    const idle=await f.get('&after='+data.__stateRevision);assert.equal(idle.status,204);assert.equal(await idle.text(),'');assert.equal(idle.headers.get('cache-control'),'no-store');
    let done=false;const pending=f.get('&after='+data.__stateRevision).then(value=>{done=true;return value;});await delay(20);assert.equal(done,false);
    f.states.alice.score=5;assert.equal((await (await pending).json()).score,5);
});
test('waiting state is isolated by channel, capped, authenticated and disposed on cancellation',async t=>{
    const f=await fixture(t,{waitMs:1000,maxPending:1}),first=await (await f.get()).json(),controller=new AbortController();
    const waiting=fetch(f.url+'&after='+first.__stateRevision,{signal:controller.signal}).catch(()=>null);await delay(30);assert.equal(f.feed.pending(),1);
    assert.equal((await f.get()).status,503);controller.abort();await waiting;
    for(let i=0;i<50&&f.feed.pending();i++)await delay(10);assert.equal(f.feed.pending(),0);
    assert.equal((await (await f.get('&channel=bob')).json()).score,2);
    assert.equal((await fetch(f.url.replace('secret','wrong'))).status,403);assert.equal((await f.get('&after=invalid')).status,400);
    const pending=f.get('&after='+first.__stateRevision);await delay(30);f.feed.close();assert.equal((await pending).status,503);
});
function browserHarness({hidden=false,preview=false,responses=[],fetcher}={}){
    const listeners=new Map(),calls=[],document=new EventTarget();document.hidden=hidden;
    const context={window:{fetch:async(...args)=>{calls.push(args);return fetcher?fetcher(...args):responses.shift()||new Response('{}');}},document,location:{href:'https://relay.test/overlays/'+'A'.repeat(43)+'/widget/topgift',origin:'https://relay.test',search:preview?'?preview=1':''},URL,URLSearchParams,Response,AbortController,DOMException,setTimeout,clearTimeout,addEventListener:(name,fn)=>listeners.set(name,fn)};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/widgets/change-transport.js'),'utf8'),context);
    return {...context,calls,exit:()=>listeners.get('pagehide')(),visible(){document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));}};
}
test('browser restores cached state on 204 and does not wrap unrelated or cross-origin requests',async()=>{
    const revision='a'.repeat(32),body={score:7,__stateRevision:revision},h=browserHarness({responses:[Response.json(body),new Response(null,{status:204})]});
    const state='https://relay.test/overlays/'+'A'.repeat(43)+'/widget/state?type=topgift&t=1';
    assert.deepEqual(await (await h.window.fetch(state)).json(),body);assert.deepEqual(await (await h.window.fetch(state.replace('t=1','t=2'))).json(),body);
    assert.equal(new URL(h.calls[1][0]).searchParams.get('after'),revision);assert.equal(new URL(h.calls[1][0]).searchParams.has('t'),false);
    for(const url of ['https://external.test/widget/state','https://relay.test/tikmng/media/file/test']){await h.window.fetch(url);assert.equal(h.calls.at(-1)[0],url);}h.exit();
});
test('old publishers work unchanged and only hidden previews suspend requests',async()=>{
    const url='https://relay.test/widget/state',h=browserHarness({hidden:true,responses:[Response.json({score:1})]});
    assert.equal((await (await h.window.fetch(url)).json()).score,1);assert.equal(h.calls.length,1);h.exit();
    const preview=browserHarness({hidden:true,preview:true});const waiting=preview.window.fetch(url);await delay(10);assert.equal(preview.calls.length,0);preview.visible();await waiting;assert.equal(preview.calls.length,1);preview.exit();
    await assert.rejects(preview.window.fetch(url),{name:'AbortError'});
});
test('closed browser aborts outstanding transport requests',async()=>{
    const h=browserHarness({fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('closed','AbortError'))))});
    const request=h.window.fetch('https://relay.test/widget/state');await delay(1);const signal=h.calls[0][1].signal;h.exit();
    await assert.rejects(request,{name:'AbortError'});assert.equal(signal.aborted,true);
});

test('hiding a preview aborts its current request but never aborts a broadcast source',async()=>{
    for(const preview of [true,false]){
        const h=browserHarness({preview,fetcher:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('closed','AbortError'))))});
        const request=h.window.fetch('https://relay.test/widget/state');await delay(1);h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));
        assert.equal(h.calls[0][1].signal.aborted,preview);h.exit();await assert.rejects(request,{name:'AbortError'});
    }
});
