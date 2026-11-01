'use strict';
const MAX=365*86400000;
const remaining=(state,now)=>Math.max(0,Math.min(MAX,state?.running?(state.endsAt||now)-now:Number(state?.remainingMs)||0));
function configure(data,config,now=Date.now()){
 const previous=data.streamTimer,ms=previous?Math.max(0,Math.min(MAX,remaining(previous,now)+(config.baseSeconds-(previous.baseSeconds??config.baseSeconds))*1000)):config.baseSeconds*1000;
 data.streamTimer={baseSeconds:config.baseSeconds,remainingMs:ms,running:config.running===true,endsAt:now+ms,updatedAt:now,lastAdded:previous?.lastAdded||null};
}
function add(data,seconds,event,now=Date.now()){
 if(!Number.isFinite(seconds)||seconds<=0)return;
 const old=data.streamTimer||{remainingMs:0,running:false},extra=Math.min(MAX,seconds*1000),ms=Math.min(MAX,remaining(old,now)+extra);
 data.streamTimer={...old,remainingMs:ms,endsAt:now+ms,updatedAt:now,lastAdded:{id:event.id,username:event.username,seconds:extra/1000,at:now}};
}
function ingest(data,event,timerConfig,wheelConfig,random,now=Date.now()){
 if(event.type!=='gift'||!event.id||Number(event.giftType)===1&&!event.repeatEnd)return false;
 if((data.timerReceipts||[]).includes(event.id))return false;
 data.timerReceipts=[...(data.timerReceipts||[]),event.id].slice(-4096);
 if(!data.streamTimer)configure(data,timerConfig,now);
 let seconds=0;
 for(let i=1;i<=8;i++)if(timerConfig['gift'+i]&&String(event.giftId)===timerConfig['gift'+i])seconds+=timerConfig['seconds'+i]*Math.max(1,Math.min(1000000,Number(event.count)||1));
 if(Number(event.coins)>=wheelConfig.giftMinCoins&&(!wheelConfig.giftId||String(event.giftId)===wheelConfig.giftId)){
  const labels=String(wheelConfig.segments||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,60);
  if(labels.length){event.actionWheelIndex=random(labels.length);event.actionWheelLabel=labels[event.actionWheelIndex];if(/^yay[iı]n s[uü]resini uzat$/iu.test(event.actionWheelLabel))seconds+=wheelConfig.extendSeconds;}
 }
 if(seconds)add(data,seconds,event,now);
 return true;
}
function snapshot(data,now=Date.now()){return {...data.streamTimer,remainingMs:remaining(data.streamTimer,now),serverNow:now};}
module.exports={remaining,configure,add,ingest,snapshot};
