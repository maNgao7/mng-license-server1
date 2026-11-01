'use strict';
const crypto = require('node:crypto');
const WebSocket = require('ws');

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const MEDIA = new RegExp(`^/tikmng/media(?:/(?:client\\.(?:js|css)|events|poll|${UUID}|file/${UUID}))?$`);
const WIDGET = new Set(['/widget-overlay.html','/widget/overlay','/widget/overlay.html','/widget-top-gift.html','/widget/top-gift',
    '/widget/top-gift.html','/widget-top-likes.html','/widget/top-likes','/widget/top-likes.html','/widget-leaderboard.html',
    '/widget/leaderboard','/widget/leaderboard.html','/widget-gift-feed.html','/widget/gift-feed','/widget/gift-feed.html',
    '/widget-activity.html','/widget/activity','/widget/activity.html','/widget/state','/api/widget/state',
    '/widget/top-gift/state','/api/widget/top-gift/state','/widget/top-likes/state','/api/widget/top-likes/state',
    '/widget/leaderboard/state','/api/widget/leaderboard/state','/widget/activity/state','/api/widget/activity/state',
    '/widget/vendor/matter.js','/widget/physical-jar.js','/assets/widgets/glass-gift-jar.png']);

function allowedPath(value) {
    if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f#]/.test(value)) return false;
    const pathname = value.split('?')[0];
    if (/%|(?:^|\/)\.\.(?:\/|$)/.test(pathname)) return false;
    return MEDIA.test(pathname) || WIDGET.has(pathname) || /^\/widget\/gift-assets\/[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp)$/.test(pathname);
}

function createOverlayBridge({ store, serverURL, port, accessKey, getCredentials, getChannel, onStatus = () => {},
    namespace = 'stable', fetchImpl = globalThis.fetch, WebSocketImpl = WebSocket, allowInsecureForTests = false } = {}) {
    let state = { status: 'idle', ready: false, message: 'HTTPS yayın bağlantısı henüz hazırlanmadı.', nextRetryAt: null };
    let selected = '', generation = 0, socket = null, retry = null, renew = null, heartbeat = null, pendingSession = null, attempt = 0;
    let publicBase = '', ticketExpiresAt = 0;
    const requests = new Map();
    const current = () => ({ ...state, publicBase: state.ready ? publicBase : '', channel: selected });
    const publish = (status, message, extra = {}) => { state = { ...state, status, ready: status === 'connected', message, nextRetryAt: null, ...extra }; try { onStatus(current()); } catch {} };
    function endpoint() {
        const url = new URL(typeof serverURL === 'function' ? serverURL() : serverURL);
        if ((url.protocol !== 'https:' && !(allowInsecureForTests && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw new Error('Güvenli yayın sunucusu adresi gerekli.');
        return url.origin;
    }
    function installation() {
        let value = store.get('overlay_installation_v1', '');
        if (!/^[a-f0-9]{32}$/.test(value)) { value = crypto.randomBytes(16).toString('hex'); store.set('overlay_installation_v1', value); }
        return value + '_' + namespace.replace(/[^A-Za-z0-9_-]/g,'').slice(0,20);
    }
    function abortRequests() { for (const request of requests.values()) { request.controller.abort(); request.resume?.(); } requests.clear(); }
    function disconnect() {
        clearTimeout(retry);clearTimeout(renew);clearInterval(heartbeat);retry=renew=heartbeat=null;
        pendingSession?.abort();pendingSession=null;abortRequests();
        const previous=socket;socket=null;if(previous) { try { previous.close(); } catch {} }
    }
    function stop() { generation++;selected='';attempt=0;disconnect();publish('idle','HTTPS yayın bağlantısı kapalı.'); }
    function schedule(version, reason, delay) {
        if (version !== generation || !selected) return;
        disconnect();
        const wait = delay ?? Math.min(60000, 3000 * 2 ** Math.min(attempt++,5)) + Math.floor(Math.random()*1000);
        publish('retrying',reason,{ nextRetryAt: Date.now()+wait });
        retry=setTimeout(()=>connect(version),wait);retry.unref?.();
    }
    function send(ws, value) {
        if (ws !== socket || ws.readyState !== 1) return false;
        try { ws.send(JSON.stringify(value));return true; } catch { return false; }
    }
    async function capacity(ws, entry) {
        while (!entry.controller.signal.aborted && socket===ws && (entry.paused || ws.bufferedAmount>1024*1024)) {
            await new Promise(resolve=>{ const timer=setTimeout(resolve,25);entry.resume=()=>{clearTimeout(timer);resolve();}; });
        }
        if (entry.controller.signal.aborted || ws!==socket) throw new Error('Request canceled');
    }
    async function forward(ws, message, version) {
        if (version!==generation || !ID.test(message.id||'') || requests.has(message.id)) return;
        if (!['GET','HEAD'].includes(message.method) || !allowedPath(message.path) || requests.size>=64) {
            send(ws,{type:'headers',id:message.id,status:400,headers:{'content-type':'text/plain'}});send(ws,{type:'end',id:message.id});return;
        }
        const controller=new AbortController(),entry={controller,paused:false,resume:null};requests.set(message.id,entry);
        let bodyReader, timeout=setTimeout(()=>controller.abort(),30000);
        try {
            const target=new URL(message.path,`http://127.0.0.1:${port}`);
            target.searchParams.set('key',accessKey);target.searchParams.set('channel',selected);
            const headers={'x-tikmng-overlay-base':'/overlays/'+new URL(publicBase).pathname.split('/').pop()};
            for(const name of ['range','last-event-id']) {
                const value=message.headers?.[name];if(typeof value==='string'&&value.length<300&&!/[\r\n]/.test(value))headers[name]=value;
            }
            const response=await fetchImpl(target.href,{method:message.method,headers,redirect:'manual',signal:controller.signal});
            const outgoing={};
            for(const name of ['content-type','content-length','content-range','accept-ranges','cache-control','content-security-policy','referrer-policy','x-content-type-options']) {
                const value=response.headers.get(name);if(value)outgoing[name]=value;
            }
            if(response.status===307){const location=response.headers.get('location');try{const redirect=new URL(location);if(redirect.protocol==='https:'&&!redirect.username&&!redirect.password)outgoing.location=redirect.href;else throw new Error();}catch{throw new Error('Unsafe redirect');}}
            send(ws,{type:'headers',id:message.id,status:response.status,headers:outgoing});
            clearTimeout(timeout);timeout=null;
            if(message.method==='HEAD'||!response.body){send(ws,{type:'end',id:message.id});return;}
            bodyReader=response.body.getReader();
            let bytes=0;const stream=response.headers.get('content-type')?.includes('text/event-stream');
            // A long, progressing video is healthy; limit idle time, not total play time.
            const armIdle=()=>{clearTimeout(timeout);if(!stream)timeout=setTimeout(()=>controller.abort(),120000);};
            armIdle();
            while(true){
                await capacity(ws,entry);const result=await bodyReader.read();if(result.done)break;
                armIdle();
                bytes+=result.value.byteLength;if(!stream&&bytes>512*1024*1024)throw new Error('Response limit');
                for(let index=0;index<result.value.byteLength;index+=48*1024){await capacity(ws,entry);if(!send(ws,{type:'chunk',id:message.id,data:Buffer.from(result.value.subarray(index,index+48*1024)).toString('base64')}))throw new Error('Disconnected');}
            }
            send(ws,{type:'end',id:message.id});
        }catch{if(ws===socket){send(ws,{type:'error',id:message.id});}}
        finally{clearTimeout(timeout);try{await bodyReader?.cancel();}catch{}if(requests.get(message.id)===entry)requests.delete(message.id);}
    }
    async function connect(version) {
        if(version!==generation||!selected)return;
        disconnect();publish('connecting','Güvenli HTTPS yayın bağlantısı hazırlanıyor.');
        const controller=new AbortController();pendingSession=controller;
        let origin;
        try {
            origin=endpoint();const credentials=await getCredentials();
            if(version!==generation||controller.signal.aborted)return;
            if(!credentials?.licenseCode||!credentials?.deviceId){publish('license-required','HTTPS yayın bağlantısı için lisansını etkinleştir.');return;}
            const response=await fetchImpl(origin+'/api/overlay/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({licenseCode:credentials.licenseCode,deviceId:credentials.deviceId,installationId:installation(),channel:selected}),redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
            if(version!==generation)return;
            if(response.status===404){await response.body?.cancel();schedule(version,'Yayın sunucusundaki HTTPS servisi henüz güncellenmemiş.',60000);return;}
            if([401,403].includes(response.status)){await response.body?.cancel();publish('license-required','HTTPS yayın bağlantısı için lisans doğrulanamadı. Lisansını yeniden kontrol et.');return;}
            if(!response.ok){await response.body?.cancel();throw new Error('Server unavailable');}
            const data=await response.json();
            if(!TOKEN.test(data.token||'')||typeof data.ticket!=='string'||data.ticket.length>4096||!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now()+30000||data.path!=='/overlays/'+data.token||data.protocolVersion!==1)throw new Error('Invalid session');
            if(version!==generation)return;
            publicBase=origin+data.path;ticketExpiresAt=data.expiresAt;
            const wsURL=new URL('/api/overlay/bridge',origin);wsURL.protocol=wsURL.protocol==='https:'?'wss:':'ws:';
            const ws=new WebSocketImpl(wsURL.href,{headers:{Authorization:'Bearer '+data.ticket},maxPayload:128*1024,handshakeTimeout:15000});socket=ws;
            ws.on('open',()=>{
                if(version!==generation||socket!==ws)return;
                attempt=0;publish('connected','Güvenli HTTPS yayın bağlantısı hazır.');
                renew=setTimeout(()=>connect(version),Math.max(10000,ticketExpiresAt-Date.now()-30000));renew.unref?.();
                let alive=true;ws.on('pong',()=>{alive=true;});heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;try{ws.ping();}catch{ws.terminate();}},20000);heartbeat.unref?.();
            });
            ws.on('message',raw=>{
                if(version!==generation||socket!==ws)return;
                let message;try{message=JSON.parse(raw.toString());}catch{return;}
                if(message.type==='request')forward(ws,message,version).catch(()=>{});
                else if(message.type==='cancel'){requests.get(message.id)?.controller.abort();requests.get(message.id)?.resume?.();}
                else if(message.type==='flow'){const entry=requests.get(message.id);if(entry){entry.paused=message.paused===true;if(!entry.paused)entry.resume?.();}}
            });
            const lost=()=>{if(version===generation&&socket===ws)schedule(version,'HTTPS yayın bağlantısı koptu; yeniden bağlanılıyor.');};
            ws.on('close',lost);ws.on('error',lost);
        }catch{if(version===generation&&!controller.signal.aborted)schedule(version,'Yayın sunucusuna ulaşılamıyor; yeniden denenecek.');}
        finally{if(pendingSession===controller)pendingSession=null;}
    }
    function start(channel=getChannel?.()) {
        const clean=String(channel||'').replace(/^@/,'').trim().toLowerCase();
        if(!/^[a-z0-9._-]{1,64}$/.test(clean)||clean==='varsayilan'){stop();return current();}
        if(selected===clean&&['connected','connecting','retrying'].includes(state.status))return current();
        generation++;disconnect();selected=clean;attempt=0;connect(generation).catch(()=>{});return current();
    }
    function urlFor(localURL) {
        if(!state.ready||!publicBase)return '';
        const raw=typeof localURL==='string'&&/^http:\/\/(?:127\.0\.0\.1|localhost):\d+(\/.*)$/i.exec(localURL);
        if(!raw||!allowedPath(raw[1].split('#')[0]))return '';
        try{const url=new URL(localURL);if(url.protocol!=='http:'||url.username||url.password||!['127.0.0.1','localhost'].includes(url.hostname)||Number(url.port)!==port||!allowedPath(url.pathname+url.search))return '';url.searchParams.delete('key');url.searchParams.delete('channel');return publicBase+url.pathname+url.search;}catch{return '';}
    }
    return { start,stop,close:stop,status:current,urlFor };
}
module.exports={createOverlayBridge,allowedPath};
