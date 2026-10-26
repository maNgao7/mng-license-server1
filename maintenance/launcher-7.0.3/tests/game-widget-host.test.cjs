'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {WebSocketServer}=require('ws');
const {createGameWidgetHost}=require('../lib/game-widget-host.cjs');
const specs=require('../lib/game-widget-specs.cjs');
const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Expected state unavailable');};

test('all game modes keep their exact metric and explicit empty snapshots',()=>{
    const samples={
        orbit:[{type:'leaderboard',entries:[{id:'a',mass:42}]},{type:'winner-update',winnersList:[{id:'a',count:3}]}],
        'crowd-control':[{type:'leaderboard',entries:[{id:'a',pts:11}]},{type:'killers',entries:[{id:'a',kills:4}]}],
        'battle-game':[{type:'army-leaderboard',entries:[{id:'a',soldiers:8}]},{type:'tournament-winners',entries:[{id:'a',count:2}]}],
        'duck-hunt':[{type:'leaderboard',survivors:[{id:'a',escapeCount:6}],victims:[{id:'a',deathCount:9}]}],
        'pony-life':[{players:[{id:'a',distance:120}],wins:[{id:'a',count:4}]}],
        'penalty-kick':[{type:'init-leaderboard',goalkeepers:[{username:'a',saves:7}],teams:{galatasaray:9}}],
        'tightrope-balance':[{left:[['a',{totalKg:11}]],right:[['b',{totalKg:4}]]}],
        vs:[{type:'battleState',state:{leftUsername:'a',leftScore:15,rightUsername:'b',rightScore:9,leftTally:[{name:'a'},{name:'a'}]}}],
        puanlama:[{type:'puanlamaState',state:{gosterilenKullanici:{uniqueId:'a'},oylar:[{puan:8},{puan:10}]}},{type:'giftState',entries:[{uniqueId:'a',coins:100}]}]
    };
    const expected={orbit:[42,3],'crowd-control':[4],'battle-game':[8,2],'duck-hunt':[6,9],'pony-life':[120,4],'penalty-kick':[7,7,9],'tightrope-balance':[11,4,11,11],vs:[15,2],puanlama:[9,100]};
    for(const [game,spec] of Object.entries(specs)){
        let state={};for(const sample of samples[game])state=spec.accept(sample,state)||state;
        Object.keys(spec.modes).forEach((mode,index)=>{assert.equal(spec.rows(state,mode)[0].value,expected[game][index],game+'/'+mode);assert.deepEqual(spec.rows({},mode),[],game+' empty '+mode);});
    }
});

test('real WS input, read-only routes, disconnection, account isolation and recovery',async()=>{
    const server=http.createServer(),wss=new WebSocketServer({server});
    let value=1,channel='host_a',identity={},target;
    wss.on('connection',socket=>socket.send(JSON.stringify({type:'leaderboard',entries:[{id:'viewer',nickname:'Viewer',mass:value,avatar:'http://169.254.169.254/secret'}]})));
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    target={port:server.address().port,channel,identity};
    const host=createGameWidgetHost({specs,getTarget:()=>target,getChannel:()=>channel,port:5000,accessKey:'isolated-widget-test',publicURL:url=>'https://public.invalid/overlays/'+ 'A'.repeat(43)+new URL(url).pathname+new URL(url).search.replace(/&key=[^&]+/,''),retryMs:10});
    const response=(method,path)=>new Promise(resolve=>{const headers={};const req={method};const res={setHeader:(k,v)=>headers[k]=v,writeHead:(status,h)=>{res.status=status;Object.assign(headers,h);},end:body=>resolve({status:res.status,headers,body:body?.toString()||''})};assert.equal(host.handleRequest(req,res,new URL(path,'http://localhost'),channel),true);});
    try{
        assert.equal(host.links('orbit').ready,true);assert.deepEqual(host.links('__proto__').links,{});
        await wait(()=>host.snapshot('orbit','ranking',channel).entries.length===1);
        const first=host.snapshot('orbit','ranking',channel);assert.equal(first.entries[0].value,1);assert.equal(first.entries[0].avatar,'');
        assert.equal((await response('POST','/api/widget/state?type=game&game=orbit&mode=ranking')).status,405);
        assert.equal((await response('GET','/api/widget/state?type=game&game=__proto__')).status,404);
        assert.equal((await response('GET','/api/widget/state?type=game&game=orbit&mode=bad')).status,400);
        const head=await response('HEAD','/widget-overlay.html?type=game&game=orbit&mode=ranking');assert.equal(head.status,200);assert.equal(head.body,'');
        value=9;for(const socket of wss.clients)socket.terminate();
        await wait(()=>host.snapshot('orbit','ranking',channel).entries[0]?.value===9);
        assert.equal(host.snapshot('orbit','ranking','other').online,false);
        channel='host_b';assert.equal(host.snapshot('orbit','ranking',channel).online,false);
        target={...target,channel,identity:{}};
        await wait(()=>host.snapshot('orbit','ranking',channel).entries[0]?.value===9);
        target=null;assert.equal(host.snapshot('orbit','ranking',channel).online,false);
    }finally{host.close();for(const socket of wss.clients)socket.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}
});

test('HTTP schema failure clears stale rows and valid raster avatars stay account-scoped',async()=>{
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==','base64');
    let channel='host_a',invalid=false,target={port:4051,channel,identity:{}};
    const requested=[];
    const host=createGameWidgetHost({specs,getTarget:()=>target,getChannel:()=>channel,port:5000,accessKey:'isolated-test',publicURL:()=>'',retryMs:10,
        fetchImpl:async url=>{requested.push(url);return url.endsWith('/api/widget-state')?Response.json(invalid?{error:'bad schema'}:{players:[{id:'a',nickname:'Raster',distance:4,avatar:'/api/avatar/a'}],wins:[]}):new Response(png,{headers:{'content-type':'image/png'}});}});
    const serve=pathname=>new Promise(resolve=>{const res={writeHead:status=>{res.status=status;},end:body=>resolve({status:res.status,body})};assert.equal(host.handleRequest({method:'GET'},res,new URL(pathname,'http://localhost'),channel),true);});
    try{
        await wait(()=>host.snapshot('pony-life','ranking',channel).entries.length===1);
        const avatar=host.snapshot('pony-life','ranking',channel).entries[0].avatar;
        assert.match(avatar,/^\/widget\/gift-assets\/gameavatar-[a-f0-9]{64}\.png$/);
        const image=await serve(avatar);assert.equal(image.status,200);assert.deepEqual(image.body,png);
        invalid=true;
        await wait(()=>!host.snapshot('pony-life','ranking',channel).online);
        assert.deepEqual(host.snapshot('pony-life','ranking',channel).entries,[]);
        channel='host_b';assert.equal((await serve(avatar)).status,404);
        assert.ok(requested.includes('http://127.0.0.1:4051/api/avatar/a'));
    }finally{host.close();}
});
