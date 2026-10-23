import express from 'express';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Settings,actions,InputError,validate,defaults,validateGraphics,validateAppearance,standardRules,standardWarnings,rulesRevision} from './lib/settings.mjs';
import {Spectators} from './lib/spectators.mjs';
import {Avatars} from './lib/avatars.mjs';
import {Commands} from './lib/commands.mjs';
import {GiftCatalog} from './lib/catalog.mjs';
import {GiftDispatch} from './lib/gift-dispatch.mjs';
import {LiveSession} from './lib/live.mjs';
import {TikTokLiveConnection,WebcastEvent} from 'tiktok-live-connector';
const ROOT=import.meta.dirname;
function SettingsTestRule(body){if(!actions.some(a=>a.id===body.action)&&body.action!=='backward')throw new InputError('Bu eylem kullanılamıyor.');return validate({...defaults(),rules:[{...body,id:'offline-test',giftId:''}]}).rules[0];}
export async function createServer(options={}){
  const data=options.data||process.env.TIKMNG_CAAHR_DATA_DIR||path.join(process.env.LOCALAPPDATA||ROOT,'TikMnG-CAAAHR');await mkdir(data,{recursive:true});
  const settings=await new Settings(path.join(data,'settings.json')).load();
  let token;try{token=(await readFile(path.join(data,'token'),'utf8')).trim();}catch{token=randomBytes(32).toString('hex');await writeFile(path.join(data,'token'),token);}
  const catalog=await new GiftCatalog(options.catalogRoot||process.env.TIKMNG_CAAHR_CATALOG_ROOT||path.join(ROOT,'../tiktok-vs')).load(),commands=new Commands();
  const checkStandard=()=>{for(const rule of standardRules().filter(r=>r.enabled)){const gift=catalog.byId.get(rule.giftId);if(!gift||gift.id!==rule.giftId||!gift.image.endsWith('/'+rule.giftId+'.png'))throw new InputError('Standart hediye katalogda doğrulanamadı: '+rule.giftId,409);}};
  checkStandard();
  if(!settings.loaded)await settings.save(settings.value);
  const dispatch=new GiftDispatch({catalog,commands,settings});
  const avatars=new Avatars({fetcher:options.avatarFetcher}),spectators=new Spectators({avatars});
  const signKey=(process.env.EULER_API_KEY||'').trim();
  const live=new LiveSession({createConnection:options.createConnection||(username=>new TikTokLiveConnection(username,{processInitialData:false,enableExtendedGiftInfo:false,...(signKey?{signApiKey:signKey}:{})})),names:[[WebcastEvent.GIFT,'gift'],[WebcastEvent.MEMBER,'member'],[WebcastEvent.CHAT,'chat'],[WebcastEvent.LIKE,'like']],changed:()=>{},publish:event=>{
    spectators.accept(event);dispatch.accept(event);
  }});
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const local=['127.0.0.1','::1','::ffff:127.0.0.1'];
    if(!local.includes(req.socket.remoteAddress))return res.sendStatus(403);
    try{const host=new URL('http://'+req.headers.host);if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname)||Number(host.port)!==req.socket.localPort)return res.sendStatus(403);if(req.headers.origin&&new URL(req.headers.origin).origin!==host.origin)return res.sendStatus(403);}catch{return res.sendStatus(403);}
    res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'");next();
  });
  app.use(express.json({limit:'128kb'}));
  const route=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
  app.use('/mod',(req,res,next)=>{const candidate=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,''));const expected=Buffer.from(token);if(candidate.length!==expected.length||!timingSafeEqual(candidate,expected))return res.sendStatus(403);next();});
  const menuState=()=>({settings:settings.value,actions,connection:live.snapshot(),pending:commands.pending.length,history:commands.history,recentGifts:dispatch.snapshot(),catalogCount:catalog.gifts.length,standardWarnings,rulesRevision:rulesRevision(settings.value.rules)});
  app.get(['/api/state','/mod/state'],(_req,res)=>{commands.prune();res.json({product:'tikmng-caaahr-voice',protocol:15,...menuState(),spectators:spectators.snapshot(),game:{...commands.game,online:commands.online()}});});
  const save=route(async(req,res)=>{const saved=await settings.save(req.body);res.json({ok:true,settings:saved});});
  app.put('/api/settings',save);app.post('/mod/settings',save);
  app.get(['/api/standard-gifts','/mod/standard-gifts'],(_req,res)=>res.json({rules:standardRules(),warnings:standardWarnings,revision:rulesRevision(settings.value.rules)}));
  app.post(['/api/standard-gifts','/mod/standard-gifts'],route(async(req,res)=>{checkStandard();const saved=await settings.applyStandard(req.body);res.json({ok:true,settings:saved,warnings:standardWarnings});}));
  app.post('/mod/appearance',route(async(req,res)=>{const appearance=validateAppearance(req.body);await settings.update(current=>({...current,appearance}));res.json({ok:true,appearance});}));
  app.post('/mod/graphics',route(async(req,res)=>{const graphics=validateGraphics(req.body);if(!graphics.configured)throw new InputError('Görüntü ayarı onaylanmadı.');await settings.update(current=>({...current,graphics}));res.json({ok:true,graphics});}));
  app.get(['/api/gifts','/mod/gifts'],(req,res)=>{const gifts=catalog.search(String(req.query.q||''));res.json(req.path.startsWith('/mod/')?{gifts}:gifts);});
  app.post(['/api/connect','/mod/connect'],(req,res,next)=>{try{res.json(live.connect(req.body.username));}catch(e){next(e);}});
  app.post(['/api/disconnect','/mod/disconnect'],(_req,res)=>{live.disconnect();res.json({ok:true});});
  app.post(['/api/test','/mod/test'],(req,res,next)=>{try{const rule=settings.value.rules.find(r=>r.id===req.body.id);if(!rule)throw new InputError('Önce kuralı kaydedin.');res.json(commands.add(rule));}catch(e){next(e);}});
  app.post(['/api/test-action','/mod/test-action'],(req,res,next)=>{try{
    const rule=SettingsTestRule(req.body);res.json(commands.add(rule));
  }catch(e){next(e);}});
  app.post(['/api/test-gift','/mod/test-gift'],(req,res,next)=>{try{
    const rule=settings.value.rules.find(r=>r.enabled&&r.giftId===req.body.giftId);
    if(!rule)throw new InputError('Bu hediyeye kayıtlı ve açık bir eylem yok.');
    res.json(commands.add(rule));
  }catch(e){next(e);}});
  app.post('/mod/poll',(req,res,next)=>{try{const batch=commands.heartbeat(req.body);res.json({voice:settings.value.voice,commands:batch,spectators:spectators.snapshot(),...(req.body.ui?{menu:menuState()}:{}),...(req.body.catalogLoaded===false?{gifts:catalog.gifts}:{})});}catch(e){next(e);}});
  app.post('/mod/ack',(req,res)=>res.json({ok:commands.finish(req.body.id,req.body.ok,req.body.message)}));
  app.use('/catalog-assets',express.static(catalog.assets,{dotfiles:'deny',index:false}));
  app.get('/avatars/:key.png',route(async(req,res)=>{if(!/^[a-f0-9]{32}$/.test(req.params.key))return res.sendStatus(404);const buffer=await avatars.load(req.params.key);if(!buffer)return res.sendStatus(404);res.set('Cache-Control','private, max-age=300').type('png').send(buffer);}));
  app.get('/vendor/lucide.js',(_req,res)=>res.sendFile(path.join(ROOT,'node_modules/lucide/dist/umd/lucide.js')));
  app.get('/favicon.ico',(_req,res)=>res.sendStatus(204));
  app.get('/api/gift-guide/download',(_req,res,next)=>res.download(path.join(ROOT,'public/assets/voice-driving-gifts.png'),'voice-driving-gifts.png',error=>{if(error)next(error);}));
  app.use(express.static(path.join(ROOT,'public'),{dotfiles:'deny'}));
  app.use((_req,res)=>res.sendStatus(404));
  app.use((error,_req,res,_next)=>res.status(error.status||400).json({error:error instanceof InputError?error.message:'İşlem tamamlanamadı. Ayarları kontrol edin.'}));
  const server=http.createServer(app);
  return {settings,commands,catalog,live,dispatch,server,listen:port=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address());});}),close:()=>new Promise(resolve=>{live.stop();server.closeAllConnections();server.close(resolve);})};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){const backend=await createServer();const address=await backend.listen(4051);console.log(`TikMnG CAAAHR: http://127.0.0.1:${address.port}`);for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>backend.close().then(()=>process.exit(0)));}
