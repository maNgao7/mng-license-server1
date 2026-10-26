'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const project='C:/Users/User/Desktop/MNG-TikTok-Game';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function avatar(value){try{const u=new URL(value);return u.protocol==='https:'&& !u.username&&!u.password&& /\.(tiktokcdn(?:-us|-eu)?\.com|byteoversea\.com|ibytedtos\.com|muscdn\.com)$/.test(u.hostname)?u.href:'';}catch{return '';}}
function row(value){return {id:String(value.id||'').slice(0,80),name:String(value.name||value.id||'').slice(0,48),profile:avatar(value.profile),mass:Math.max(0,Math.min(1e6,Number(value.mass)||0)),wins:Math.max(0,Math.min(1e6,Number(value.wins)||0))};}
async function createWidgetServer({directory,accessKey,credentials,serverURL,relay=true}={}){
  const file=path.join(directory,'snake-widget.json');fs.mkdirSync(directory,{recursive:true});
  let saved={};try{saved=read(file);}catch{}
  const store={get:(key,fallback)=>saved[key]??fallback,set:(key,value)=>{saved[key]=value;const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(saved));fs.renameSync(tmp,file);}};
  const key=accessKey||store.get('localKey','')||crypto.randomBytes(24).toString('base64url');
  if(!accessKey)store.set('localKey',key);
  let snapshot={snakes:[],winners:[],updatedAt:0},bridge;
  const html=fs.readFileSync(path.join(__dirname,'widget.html'),'utf8');
  const reply=(res,status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(typeof value==='string'?value:JSON.stringify(value));};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.searchParams.get('key')!==key){reply(res,403,{error:'Unauthorized'});return;}
    if(url.pathname==='/snapshot'&&req.method==='POST'){
      let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>128*1024){reply(res,413,{error:'Too large'});req.destroy();return;}body+=chunk;}
      try{const data=JSON.parse(body);snapshot={snakes:(Array.isArray(data.snakes)?data.snakes:[]).slice(0,96).map(row).sort((a,b)=>b.mass-a.mass),winners:(Array.isArray(data.winners)?data.winners:[]).slice(0,512).map(row).sort((a,b)=>b.wins-a.wins),updatedAt:Date.now()};reply(res,200,{ok:true});}catch{reply(res,400,{error:'Invalid data'});}return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,{error:'Read only'});return;}
    if(url.pathname==='/api/widget/state'||url.pathname==='/widget/state'){reply(res,200,{...snapshot,online:Date.now()-snapshot.updatedAt<5000});return;}
    if(url.pathname==='/widget-overlay.html'){
      const base=String(req.headers['x-tikmng-overlay-base']||'');
      const prefix=/^\/overlays\/[A-Za-z0-9_-]{43}$/.test(base)?base:'';
      const stateURL=prefix+'/api/widget/state'+(prefix?'':'?key='+key);
      res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src https: data:; base-uri 'none'; object-src 'none'");
      reply(res,200,html.replace('__STATE_URL__',JSON.stringify(stateURL)), 'text/html; charset=utf-8');return;
    }
    if(url.pathname==='/status'){
      const local=type=>`http://127.0.0.1:${server.address().port}/widget-overlay.html?type=${type}&key=${key}`;
      const status=bridge?.status();reply(res,200,{ready:Boolean(status?.ready),message:status?.message||'Yerel widget hazir',sizeURL:bridge?.urlFor(local('snake-size'))||local('snake-size'),winsURL:bridge?.urlFor(local('snake-wins'))||local('snake-wins'),secure:Boolean(status?.ready)});return;
    }
    reply(res,404,{error:'Not found'});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  if(relay){
    const packaged=fs.existsSync(path.join(__dirname,'lib/overlay-bridge.cjs'));
    const {createOverlayBridge}=require(packaged?path.join(__dirname,'lib/overlay-bridge.cjs'):path.join(project,'launcher/lib/overlay-bridge.cjs'));
    bridge=createOverlayBridge({store,serverURL:serverURL||fs.readFileSync(packaged?path.join(__dirname,'license-server.txt'):path.join(project,'launcher/license-server.txt'),'utf8').trim(),port:server.address().port,accessKey:key,
      getCredentials:credentials||(()=>{try{const c=read(path.join(require('node:os').homedir(),'Documents/MNG TikTok Game/license-backup.json'));return {licenseCode:c.code,deviceId:c.deviceId};}catch{return {};}}),namespace:'snake-prototype',getChannel:()=> 'snake-arena'});
    bridge.start('snake-arena');
  }
  return {port:server.address().port,key,status:()=>bridge?.status(),close:()=>{bridge?.close();server.closeAllConnections();server.close();}};
}
module.exports={createWidgetServer};
