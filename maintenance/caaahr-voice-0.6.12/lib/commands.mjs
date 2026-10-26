import { randomUUID } from 'node:crypto';
import { actions,InputError } from './settings.mjs';
export class Commands {
  constructor(now=Date.now){this.now=now;this.pending=[];this.history=[];this.game={ready:false,receivedAt:0};this.session='';}
  online(){return this.game.ready&&this.now()-this.game.receivedAt<2500;}
  prune(){if(this.online()&&this.game.paused)return;for(const c of this.pending.filter(c=>c.expiresAt<=this.now()))this.finish(c.id,false,'Süre doldu; oyuna uygulanmadı.');}
  add(rule,source='test'){
    this.prune();
    if(!this.online())throw new InputError('Önce orijinal oyunda tek oyunculu bir yarış başlatın.',409);
    if(this.pending.length>=100)throw new InputError('Eylem sırası dolu.',429);
    if(!actions.some(a=>a.id===rule.action))throw new InputError('Eylem bulunamadı.');
    const travelBudget=['forward','backward','tornado'].includes(rule.action)&&rule.distance>100?Math.min(220000,Math.ceil(10+rule.distance/25)*1000):15000;
    const command={id:randomUUID(),action:rule.action,distance:rule.distance,duration:rule.duration,strength:rule.strength,source:String(source).slice(0,64),createdAt:this.now(),expiresAt:this.now()+travelBudget};
    this.pending.push(command);return command;
  }
  finish(id,ok,message){const index=this.pending.findIndex(c=>c.id===id);if(index<0)return false;const [c]=this.pending.splice(index,1);this.history.unshift({...c,ok:!!ok,message:String(message||'').slice(0,160),finishedAt:this.now()});this.history.length=Math.min(100,this.history.length);return true;}
  heartbeat(data){
    if(typeof data.session!=='string'||data.session.length>64)throw new InputError('Oyun oturumu geçersiz.');
    if(this.session!==data.session){for(const c of [...this.pending])this.finish(c.id,false,'Oyun oturumu değişti.');this.session=data.session;}
    const now=this.now();
    // Preserve the remaining gift lifetime while a responsive game is in its menu.
    if(this.game.paused&&this.online())for(const command of this.pending)command.expiresAt+=Math.max(0,now-Math.max(this.game.receivedAt,command.createdAt));
    this.game={ready:data.ready===true,paused:data.ui===true,session:data.session,processId:Math.max(0,Math.trunc(Number(data.processId)||0)),version:String(data.version||'').slice(0,30),menuReady:data.menuReady===true,catalogCount:Math.max(0,Math.min(10000,Math.trunc(Number(data.catalogCount)||0))),db:Math.max(-80,Math.min(0,Number(data.db)||-80)),throttle:Math.max(0,Math.min(1,Number(data.throttle)||0)),speed:Math.max(0,Math.min(300,Number(data.speed)||0)),microphones:Array.isArray(data.microphones)?data.microphones.filter(v=>typeof v==='string').slice(0,30):[],scene:String(data.scene||'').slice(0,100),receivedAt:now};
    if(!this.game.ready)for(const c of [...this.pending])this.finish(c.id,false,'Yarış durdu; eylem iptal edildi.');
    this.game.spectatorCount=Math.max(0,Math.min(132,Math.trunc(Number(data.spectatorCount)||0)));this.game.avatarCount=Math.max(0,Math.min(132,Math.trunc(Number(data.avatarCount)||0)));
    this.prune();const delivery=this.game.paused?[...this.pending.filter(c=>c.source==='test'),...this.pending.filter(c=>c.source!=='test')]:this.pending;return delivery.slice(0,5);
  }
}
