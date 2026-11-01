'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const WebSocket = require('ws');
const clean = value => String(value || '').trim().replace(/^@/,'').toLowerCase();

function createGameWidgetHost({specs, getTarget, getChannel, getSharedState, publicURL, port, accessKey,
    fetchImpl = globalThis.fetch, WebSocketImpl = WebSocket, retryMs = 1500} = {}) {
    const feeds = new Map(), images = new Map();
    const document = fs.readFileSync(path.join(__dirname,'../renderer/widgets/game.html'),'utf8');
    const local = (game,mode) => {
        const url = new URL(`http://127.0.0.1:${port}/widget-overlay.html`);
        for (const [name,value] of Object.entries({type:'game',game,mode,key:accessKey})) url.searchParams.set(name,value);
        return url.href;
    };
    function links(game) {
        const spec = Object.hasOwn(specs,game) ? specs[game] : null;
        if (!spec) return {ready:false,links:{},widgets:[]};
        const widgets = Object.entries(spec.modes).map(([mode,label]) => ({mode,label,url:publicURL(local(game,mode)) || ''}));
        return {ready:widgets.every(widget=>Boolean(widget.url)),links:Object.fromEntries(widgets.map(widget=>[widget.mode,widget.url])),widgets};
    }
    function reset(feed) {
        feed.closed = true; clearTimeout(feed.retry); clearTimeout(feed.poll);
        feed.controller?.abort();
        try { feed.socket?.terminate(); } catch {}
        for (const [id,image] of images) if (image.feed===feed) images.delete(id);
        feeds.delete(feed.game);
    }
    function validTarget(game,channel) {
        const target = getTarget(game);
        return target && Number.isInteger(target.port) && target.port > 0 && target.port <= 65535 &&
            clean(target.channel) === channel && target.identity ? target : null;
    }
    function ensure(game,channel) {
        const target = validTarget(game,channel), old = feeds.get(game);
        if (old && (!target || old.identity!==target.identity || old.channel!==channel || old.port!==target.port)) reset(old);
        if (!target) return null;
        if (feeds.has(game)) return feeds.get(game);
        const feed = {game,channel,port:target.port,identity:target.identity,values:{},online:false,closed:false,updatedAt:0};
        feeds.set(game,feed); connect(feed); return feed;
    }
    function current(feed) {
        const target = validTarget(feed.game,feed.channel);
        return !feed.closed && clean(getChannel())===feed.channel && target?.identity===feed.identity && target.port===feed.port;
    }
    function retry(feed) {
        feed.online=false; feed.values={};
        if (!current(feed)) { reset(feed); return; }
        if (!feed.retry) { feed.retry=setTimeout(()=>{feed.retry=null;connect(feed);},retryMs); feed.retry.unref?.(); }
    }
    function accept(feed,data) {
        if (!current(feed) || !data || typeof data!=='object') return false;
        const next = specs[feed.game].accept(data,feed.values);
        if (next) { feed.values=next; feed.updatedAt=Date.now(); }
        return Boolean(next);
    }
    function connect(feed) {
        if (!current(feed)) { reset(feed); return; }
        const spec = specs[feed.game];
        if (spec.http) {
            feed.controller=new AbortController();
            void (async()=>{
                try {
                    const response=await fetchImpl(`http://127.0.0.1:${feed.port}${spec.http}`,{redirect:'error',signal:AbortSignal.any([feed.controller.signal,AbortSignal.timeout(4000)])});
                    if (!response.ok) { await response.body?.cancel(); throw new Error('Upstream unavailable'); }
                    const raw=await boundedBody(response,1024*1024);
                    if (!current(feed)) return;
                    if (!accept(feed,JSON.parse(raw.toString('utf8')))) throw new Error('Invalid game widget state');
                    feed.online=true;
                    feed.poll=setTimeout(()=>connect(feed),1000); feed.poll.unref?.();
                } catch { if (!feed.closed) retry(feed); }
            })();
            return;
        }
        try {
            const socket=new WebSocketImpl(`ws://127.0.0.1:${feed.port}${spec.path||'/'}`,{handshakeTimeout:4000,maxPayload:1024*1024});
            feed.socket=socket;
            socket.on('open',()=>{
                if (!current(feed) || socket!==feed.socket) { socket.terminate(); return; }
                feed.online=true;
                for (const request of spec.requests || []) socket.send(JSON.stringify(request));
            });
            socket.on('message',raw=>{try{if(socket===feed.socket&&raw.length<=1024*1024)accept(feed,JSON.parse(raw.toString()));}catch{}});
            const lost=()=>{if(!feed.closed&&feed.socket===socket){feed.socket=null;try{socket.terminate();}catch{}retry(feed);}};
            socket.on('error',lost); socket.on('close',lost);
        } catch { retry(feed); }
    }
    function imageURL(feed,value) {
        if (typeof value!=='string' || value.length>4096 || !value) return '';
        try {
            const source=new URL(value,`http://127.0.0.1:${feed.port}`);
            const own=source.origin===`http://127.0.0.1:${feed.port}` && /^\/(?:api\/avatar|avatar|avatars|proxy-avatar)(?:\/|\?|$)/.test(source.pathname+source.search);
            const external=source.protocol==='https:' && /(^|\.)(?:tiktokcdn(?:-us|-eu)?\.com|byteoversea\.com|ibytedtos\.com|byteimg\.com|muscdn\.com)$/.test(source.hostname);
            if ((!own&&!external) || source.username || source.password || source.hash) return '';
            const id=crypto.createHash('sha256').update(feed.game+'\0'+feed.channel+'\0'+source.href).digest('hex');
            if (!images.has(id)) { if(images.size>=2048)images.delete(images.keys().next().value); images.set(id,{feed,source:source.href}); }
            return `/widget/gift-assets/gameavatar-${id}.png`;
        } catch { return ''; }
    }
    function snapshot(game,mode,channel) {
        const spec=Object.hasOwn(specs,game)?specs[game]:null;
        if (!spec || !Object.hasOwn(spec.modes,mode)) return null;
        const owner=clean(getChannel());
        if (!owner || clean(channel)!==owner) return {online:false,entries:[],label:spec.modes[mode]};
        const feed=ensure(game,owner);
        const values=feed?.online ? spec.rows(feed.values,mode,getSharedState?.()) : [];
        const entries=(Array.isArray(values)?values:[]).slice(0,200).map((item,index)=>({
            id:String(item.id||item.username||index).slice(0,100),name:String(item.name||item.nickname||item.username||'').slice(0,80),
            value:Math.max(0,Math.min(1e12,Number(item.value)||0)),unit:String(item.unit||'').slice(0,24),avatar:feed?imageURL(feed,item.avatar):''
        }));
        return {online:Boolean(feed?.online),entries,label:spec.modes[mode],updatedAt:feed?.updatedAt||0};
    }
    const reply=(req,res,status,value,type='application/json; charset=utf-8')=>{
        const data=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value));
        res.writeHead(status,{'Content-Type':type,'Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
        res.end(req.method==='HEAD'?undefined:data);
    };
    async function serveImage(req,res,id,channel) {
        const image=images.get(id);
        if (!image || image.feed.channel!==clean(channel) || !current(image.feed)) return reply(req,res,404,{});
        try {
            const response=await fetchImpl(image.source,{redirect:'error',signal:AbortSignal.timeout(5000)});
            if(!response.ok){await response.body?.cancel();return reply(req,res,502,{});}
            const bytes=await boundedBody(response,2*1024*1024);
            const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':
                bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':
                bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':null;
            if(!type)return reply(req,res,502,{});
            reply(req,res,200,bytes,type);
        } catch { reply(req,res,502,{}); }
    }
    function handleRequest(req,res,url,channel) {
        const avatar=/^\/widget\/gift-assets\/gameavatar-([a-f0-9]{64})\.png$/.exec(url.pathname);
        const doc=url.pathname==='/widget-overlay.html'&&url.searchParams.get('type')==='game';
        const state=['/widget/state','/api/widget/state'].includes(url.pathname)&&url.searchParams.get('type')==='game';
        const listing=url.pathname==='/api/widget/game-links';
        if(!avatar&&!doc&&!state&&!listing)return false;
        if(!['GET','HEAD'].includes(req.method)){reply(req,res,405,{});return true;}
        if(avatar){void serveImage(req,res,avatar[1],channel);return true;}
        const game=url.searchParams.get('game'),spec=Object.hasOwn(specs,game)?specs[game]:null;
        if(!spec){reply(req,res,404,{});return true;}
        if(listing){reply(req,res,200,links(game));return true;}
        const mode=url.searchParams.get('mode')||Object.keys(spec.modes)[0];
        if(!Object.hasOwn(spec.modes,mode)){reply(req,res,400,{});return true;}
        if(state){reply(req,res,200,snapshot(game,mode,channel));return true;}
        res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'");
        reply(req,res,200,document,'text/html; charset=utf-8'); return true;
    }
    return {links,snapshot,handleRequest,close(){for(const feed of [...feeds.values()])reset(feed);images.clear();}};
}

async function boundedBody(response,limit) {
    const chunks=[];let bytes=0;
    try {for await(const chunk of response.body){bytes+=chunk.length;if(bytes>limit)throw new Error('Response limit');chunks.push(Buffer.from(chunk));}}
    catch(error){await response.body?.cancel().catch(()=>{});throw error;}
    return Buffer.concat(chunks);
}
module.exports={createGameWidgetHost};
