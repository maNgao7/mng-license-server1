export class GiftDispatch {
  constructor({catalog,commands,settings}){Object.assign(this,{catalog,commands,settings});this.events=[];}
  accept(event){
    if(event.type!=='gift')return;
    const gift=this.catalog.enrich(event),rule=this.settings.value.rules.find(r=>r.enabled&&r.giftId===gift.giftId);
    const record={id:event.id,timestamp:event.timestamp,username:event.username,giftId:gift.giftId,giftName:gift.giftName||gift.giftId,count:gift.count,action:rule?.action||'',commandIds:[],message:''};
    if(!rule)record.message='Hediye algılandı; bu hediyeye açık bir eylem kaydedilmemiş.';
    else for(let i=0;i<Math.min(100,gift.count);i++)try{record.commandIds.push(this.commands.add(rule,'@'+event.username).id);}catch(error){record.message=error.message;break;}
    this.events.unshift(record);this.events.length=Math.min(50,this.events.length);
  }
  snapshot(){
    const finished=new Map(this.commands.history.map(item=>[item.id,item])),pending=new Set(this.commands.pending.map(item=>item.id));
    return this.events.map(record=>{
      const results=record.commandIds.map(id=>finished.get(id)).filter(Boolean),applied=results.filter(item=>item.ok).length,queued=record.commandIds.length;
      const status=!record.action?'unmapped':!queued?'not_applied':results.some(item=>!item.ok)?'failed':applied===queued?'applied':record.commandIds.some(id=>pending.has(id))?'queued':Date.now()-record.timestamp>16000?'expired':'queued';
      const partial=status==='applied'&&queued<record.count;
      const message=status==='applied'?`${applied}/${record.count} eylem oyun tarafından uygulandı.${partial?' '+(record.message||'Tek olayda en fazla 100 eylem uygulanır.'):''}`:record.message||(status==='queued'?(this.commands.game.paused?'Menü açık. Oyuna dönmeniz bekleniyor.':'Oyun onayı bekleniyor.'):results.find(item=>!item.ok)?.message||'Eylem süresi doldu.');
      const {commandIds,...view}=record;return {...view,queued,applied,status:partial?'partial':status,message};
    });
  }
}
