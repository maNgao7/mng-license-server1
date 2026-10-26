import express from 'express';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { normalizeLiveEvent } from './live-events.js';

const root = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
const settingsFile = process.env.FROG_SETTINGS_FILE || resolve(root, 'settings.json');
const moduleRoot = existsSync(resolve(root,'node_modules/three')) ? resolve(root,'node_modules') : resolve(root,'..','node_modules');
export async function startServer(port = Number(process.env.FROG_PORT || 4275), connectionFactory = (name, options) => new TikTokLiveConnection(name, options)) {
  const app = express(), server = createServer(app), token = randomBytes(32).toString('hex');
  createRequire(import.meta.url)('./launcher-widget-links.cjs').mountWidgetLinks(app, { gameId: 'frog-river' });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  let current, generation = 0;
  let live = { status: 'disconnected', username: '', message: 'Henüz bağlı değil' };
  const broadcast = data => { const raw=JSON.stringify(data); for(const ws of sockets.clients) if(ws.readyState===1 && ws.bufferedAmount<128000) ws.send(raw); };
  const status = next => { live={...live,...next}; broadcast({type:'status',...live}); };
  function key() {
    if(process.env.EULER_API_KEY) return process.env.EULER_API_KEY.trim();
    for(const p of [resolve(root,'euler-api-key.txt'),resolve(process.env.USERPROFILE||'', 'Desktop/MNG-TikTok-Game/apps/tiktok-vs/euler-api-key.txt')]) {
      try { const k=readFileSync(p,'utf8').trim(); if(k)return k; } catch {}
    }
  }
  function disconnect() { generation++; const old=current; current=null; try { old?.disconnect(); } catch {} status({status:'disconnected',message:'Bağlantı kapatıldı'}); }
  async function connect(name) {
    name=String(name||'').trim().replace(/^@/,'');
    if(!/^[a-zA-Z0-9_.]{2,32}$/.test(name)) throw new Error('Geçerli bir TikTok kullanıcı adı yaz.');
    disconnect(); const gen=++generation;
    status({status:'connecting',username:name,message:'Canlı yayın aranıyor…'});
    const c=connectionFactory(name,{signApiKey:key()}); current=c;
    const guard=fn=>d=>{ if(gen===generation) fn(d); };
    c.on('error',guard(()=>status({status:'error',message:'Yayın bağlantısında hata oluştu. Tekrar bağlan.'})));
    c.on('disconnected',guard(()=>status({status:'disconnected',message:'Yayın bağlantısı kesildi. Tekrar bağlan.'})));
    c.on(WebcastEvent.STREAM_END || 'streamEnd',guard(()=>{ status({status:'disconnected',message:'Canlı yayın sona erdi.'}); }));
    for(const [event,type] of [[WebcastEvent.GIFT,'gift'],[WebcastEvent.LIKE,'like'],[WebcastEvent.FOLLOW,'follow'],[WebcastEvent.MEMBER,'member']]) {
      c.on(event,guard(d=>{
        if(type==='gift' && d.giftType===1 && !d.repeatEnd) return;
        const event=normalizeLiveEvent(type,d);
        if(event)broadcast(event);
      }));
    }
    let timeout;
    try {
      await Promise.race([c.connect().then(result=>{if(gen!==generation)c.disconnect();return result;}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),25000);})]);
      if(gen!==generation){c.disconnect();return;}
      status({status:'connected',username:name,message:'Canlı yayına bağlandı'});
    } catch {
      if(gen===generation){generation++;try{c.disconnect();}catch{}current=null;status({status:'error',message:'Bağlanılamadı. Yayının açık olduğunu kontrol et. TikTok erişimi veya bağlantı hizmeti de yanıt vermiyor olabilir.'});}
    } finally {clearTimeout(timeout);}
  }
  app.disable('x-powered-by');
  app.use(express.json({limit:'32kb'}));
  app.use((req,res,next)=>{if(!['127.0.0.1','localhost'].includes((req.headers.host||'').split(':')[0]))return res.sendStatus(403);next();});
  app.get('/api/session',(_,res)=>res.set('Cache-Control','no-store').json({token,live}));
  app.get('/api/health',(_,res)=>res.json({app:'mng-frog-river',version}));
  app.get('/api/settings',(_,res)=>{
    try {
      if(existsSync(settingsFile)) return res.set('Cache-Control','no-store').json(JSON.parse(readFileSync(settingsFile,'utf8')));
    } catch {}
    res.json({});
  });
  app.post('/api/settings',(req,res)=>{
    try {
      const data = req.body;
      if(data && typeof data === 'object'){
        const jsonStr = JSON.stringify(data, null, 2);
        writeFileSync(settingsFile, jsonStr, 'utf8');
        const mirrors = [
          resolve(root, '../../launcher/dist/win-unpacked/resources/apps/frog-river/settings.json'),
          resolve('C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/frog-river/settings.json'),
          resolve('C:/Users/User/Documents/Codex/2026-09-29/imdi-bizim-bir-projemiz-vard-bir-2/apps/frog-river/settings.json')
        ];
        (process.env.FROG_SETTINGS_FILE ? [] : mirrors).forEach(m => {
          try { if (existsSync(dirname(m))) writeFileSync(m, jsonStr, 'utf8'); } catch {}
        });
        return res.json({ ok: true, saved: true });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
    res.status(400).json({ error: 'Geçersiz veri' });
  });
  app.post('/api/connect',(req,res)=>{if(req.headers['x-session-token']!==token)return res.sendStatus(403);connect(req.body.username).catch(e=>status({status:'error',message:e.message}));res.json({ok:true});});
  app.post('/api/disconnect',(req,res)=>{if(req.headers['x-session-token']!==token)return res.sendStatus(403);disconnect();res.json({ok:true});});
  app.get('/api/catalog',(_,res)=>{try{res.json(JSON.parse(readFileSync(resolve(root,'gift-catalog.json'),'utf8')));}catch{res.status(503).json({error:'Hediye kataloğu bulunamadı'});}});
  app.use('/vendor/three',express.static(resolve(moduleRoot,'three')));
  app.use('/vendor/lucide',express.static(resolve(moduleRoot,'lucide/dist/umd')));
  const catalogAssetsPath = resolve(root,'..','tiktok-vs','public','assets');
  app.use('/catalog-assets',express.static(catalogAssetsPath,{maxAge:'30d',immutable:true}));
  app.use(express.static(resolve(root,'public')));
  server.on('upgrade',(req,socket,head)=>{
    let url,origin;try{url=new URL(req.url,'http://localhost');origin=new URL(req.headers.origin);}catch{socket.destroy();return;}
    if(!['localhost','127.0.0.1'].includes(origin.hostname)||url.pathname!='/live'||url.searchParams.get('token')!==token){socket.destroy();return;}
    sockets.handleUpgrade(req,socket,head,ws=>{sockets.emit('connection',ws);ws.send(JSON.stringify({type:'status',...live}));});
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
  return {server,port:server.address().port,close(){disconnect();for(const ws of sockets.clients)ws.close();sockets.close();server.close();}};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) startServer().then(s=>console.log(`MNG Frog River: http://127.0.0.1:${s.port}`)).catch(e=>{console.error(e.message);process.exitCode=1;});
