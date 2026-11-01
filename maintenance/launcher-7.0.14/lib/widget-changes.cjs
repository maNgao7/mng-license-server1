'use strict';
const crypto=require('node:crypto');
function signature(value){
 const stable={...value};delete stable.updatedAt;delete stable.time;
 if(stable.studio){stable.studio={...stable.studio};const timer=stable.studio.streamTimer;if(timer)stable.studio.streamTimer={...timer,serverNow:0,...(timer.running?{remainingMs:0}:{})};const pk=stable.studio.pk;if(pk)stable.studio.pk={id:pk.id,battleId:pk.battleId,status:pk.status,endsAt:pk.endsAt,wins:pk.wins,players:pk.players?.map(({id,username,nickname,avatar,score})=>({id,username,nickname,avatar,score})),teams:pk.teams?.map(({id,memberIds,score})=>({id,memberIds,score}))};}
 return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0,32);
}
function createWidgetChanges({interval=200,waitMs=10000,maxPending=64}={}){
 const delta=require('./widget-delta.cjs').createWidgetDelta();
 const groups=new Map();let pending=0,timer=null,closed=false;
 function stop(){if(!pending&&timer){clearInterval(timer);timer=null;}}
 function remove(waiter){if(!waiter.group.waiters.delete(waiter))return;pending--;clearTimeout(waiter.timeout);waiter.res.off('close',waiter.close);if(!waiter.group.waiters.size)groups.delete(waiter.key);stop();}
 function reply(waiter,value,revision,status=200){remove(waiter);if(waiter.res.destroyed||waiter.res.writableEnded)return;waiter.res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});waiter.res.end(status===204?undefined:status===200?delta.encode(value,revision,waiter.url):JSON.stringify({...value,__stateRevision:revision}));}
 function tick(){for(const group of [...groups.values()]){try{const value=group.read(),revision=signature(value);for(const waiter of [...group.waiters])if(waiter.after!==revision)reply(waiter,value,revision);}catch{for(const waiter of [...group.waiters])reply(waiter,{},'',503);}}}
 function handle(req,res,url,read){
  if(req.method!=='GET'||url.searchParams.get('transport')!=='changes')return false;
  if(closed||pending>=maxPending){res.writeHead(503,{'Cache-Control':'no-store'});res.end();return true;}
  const after=url.searchParams.get('after')||'';
  if(after&&!/^[a-f0-9]{32}$/.test(after)){res.writeHead(400,{'Cache-Control':'no-store'});res.end();return true;}
  if(url.searchParams.get('patch')==='1'&&url.searchParams.has('base')&&!/^[a-f0-9]{32}$/.test(url.searchParams.get('base'))){res.writeHead(400,{'Cache-Control':'no-store'});res.end();return true;}
  let value,revision;try{value=read();revision=signature(value);}catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end();return true;}
  if(after!==revision){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(delta.encode(value,revision,url));return true;}
  const keyURL=new URL(url);for(const key of ['transport','after','wait','t','patch','base'])keyURL.searchParams.delete(key);keyURL.searchParams.sort();const key=keyURL.pathname+keyURL.search;
  let group=groups.get(key);if(!group){group={read,waiters:new Set()};groups.set(key,group);}
  const waiter={res,key,group,after,url:new URL(url)};waiter.close=()=>remove(waiter);group.waiters.add(waiter);pending++;res.once('close',waiter.close);
  waiter.timeout=setTimeout(()=>reply(waiter,null,'',204),waitMs);waiter.timeout.unref?.();
  if(!timer){timer=setInterval(tick,interval);timer.unref?.();}
  return true;
 }
 function close(){closed=true;for(const group of [...groups.values()])for(const waiter of [...group.waiters])reply(waiter,{},'',503);stop();delta.clear();}
 return {handle,close,pending:()=>pending,historyStats:delta.stats};
}
module.exports={signature,createWidgetChanges};
