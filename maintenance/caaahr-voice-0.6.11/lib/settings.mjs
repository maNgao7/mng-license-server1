import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
export class InputError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const actions = [
  {id:'explode',name:'Arabayı patlat',parameter:'duration',unit:'saniye'}, {id:'restart',name:'Başa döndür'},
  {id:'forward',name:'İleri götür',parameter:'distance',unit:'metre'},
  {id:'backward',name:'Geri götür',parameter:'distance',unit:'metre'},
  {id:'finish',name:'Bitişe ışınla'},
  {id:'wheel',name:'Lastiği sök',parameter:'duration',unit:'saniye'},
  {id:'jail',name:'Kafese hapset',parameter:'duration',unit:'saniye'},
  {id:'release',name:'Kafesten kurtar',parameter:'duration',unit:'saniye'},
  {id:'boost',name:'Turbo desteği',parameter:'duration',unit:'saniye',strength:true},
  {id:'slow',name:'Motoru yavaşlat',parameter:'duration',unit:'saniye',strength:true},
  {id:'invert',name:'Direksiyonu ters çevir',parameter:'duration',unit:'saniye'},
  {id:'tornado',name:'Hortumla geri savur',parameter:'distance',unit:'metre'},
  {id:'traffic',name:'Karşıdan araba gönder',parameter:'strength',unit:'hız'},
  {id:'egg',name:'Yumurta fırlat',parameter:'duration',unit:'saniye'}
];
export const graphicsDefaults=()=>({configured:false,mode:'borderless',width:0,height:0,quality:-1,vSync:1,frameLimit:60});
export const appearanceDefaults=()=>({configured:false,style:'classic',red:.22,green:.64,blue:.12});
// IDs verified against the local catalog PNGs and the supplied gift guide.
export const standardWarnings=[];
export function standardRules(){
  return [
    ['donut','5879','explode',10],['gg','6064','jail',1],['icecream','5827','release',1],
    ['cowboyhat','6427','finish'],['tiktok-cap','6104','restart'],['bouquet','17473','tornado',25],['perfume','5658','boost',10],
    ['rose','5655','forward',50],['blue-bead','5319','forward',250],['heart','5282','forward',500],
    ['music-note','5269','backward',50],['turkish-coffee','5994','backward',250],['rosa','8913','backward',500]
  ].map(([key,giftId,action,value])=>({id:'standard-'+key,giftId,action,enabled:!!giftId,distance:['forward','backward','tornado'].includes(action)?value:10,duration:['explode','jail','release','boost'].includes(action)?value:10,strength:2}));
}
export const rulesRevision=rules=>createHash('sha256').update(JSON.stringify(rules)).digest('hex');
export const defaults=()=>({voice:{enabled:true,automatic:true,autoMicrophone:true,sensitivity:.25,automaticMaxSpeed:139/3.6,noiseDb:-48,fullDb:-18,response:.18,maxSpeed:139/3.6,gameVolume:.5,microphone:''},track:{length:1000,winTarget:30},graphics:graphicsDefaults(),appearance:appearanceDefaults(),rules:standardRules()});
const numeric=(value,min,max,name)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new InputError(`${name}: ${min}–${max} arasında olmalı.`);return value;};
const boolean=(value,fallback)=>{if(value===undefined)return fallback;if(typeof value!=='boolean')throw new InputError('Geçersiz ses kontrolü seçimi.');return value;};
export function validateAppearance(input){
  if(input===undefined)return appearanceDefaults();
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.configured!=='boolean'||!['classic','sport','rally'].includes(input.style))throw new InputError('Araç görünümü geçersiz.');
  return {configured:input.configured,style:input.style,red:numeric(input.red,0,1,'Kırmızı'),green:numeric(input.green,0,1,'Yeşil'),blue:numeric(input.blue,0,1,'Mavi')};
}
export function validateGraphics(input){
  if(input===undefined)return graphicsDefaults();
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.configured!=='boolean'||!['fullscreen','borderless','windowed'].includes(input.mode))throw new InputError('Görüntü ayarı geçersiz.');
  const result={configured:input.configured,mode:input.mode,width:numeric(input.width,input.configured?320:0,16384,'Ekran genişliği'),height:numeric(input.height,input.configured?240:0,16384,'Ekran yüksekliği'),quality:numeric(input.quality,-1,3,'Grafik kalitesi'),vSync:numeric(input.vSync,0,1,'Dikey eşitleme'),frameLimit:numeric(input.frameLimit,-1,360,'FPS sınırı')};
  if(Object.values(result).some(value=>typeof value==='number'&&!Number.isInteger(value))||result.frameLimit!==-1&&result.frameLimit<15)throw new InputError('Görüntü değerleri geçersiz.');
  return result;
}
export function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('Geçersiz ayar.');
  const v=input.voice;if(!v||typeof v.enabled!=='boolean'||typeof v.microphone!=='string'||v.microphone.length>200)throw new InputError('Mikrofon ayarı geçersiz.');
  const voice={enabled:v.enabled,microphone:v.microphone,noiseDb:numeric(v.noiseDb,-80,-10,'Sessizlik eşiği'),fullDb:numeric(v.fullDb,-60,0,'Tam gaz sesi'),response:numeric(v.response,.05,2,'Yumuşatma'),maxSpeed:numeric(v.maxSpeed,1,60,'Azami hız'),gameVolume:numeric(v.gameVolume??1,0,1,'Oyun sesi')};
  Object.assign(voice,{automatic:boolean(v.automatic,true),autoMicrophone:boolean(v.autoMicrophone,true),sensitivity:numeric(v.sensitivity??.65,0,1,'Kısık ses hassasiyeti'),automaticMaxSpeed:numeric(v.automaticMaxSpeed??16,6,45,'Otomatik azami hız')});
  if(voice.fullDb<voice.noiseDb+6)throw new InputError('Tam gaz eşiği sessizlikten en az 6 dB yüksek olmalı.');
  if(!Array.isArray(input.rules)||input.rules.length>100)throw new InputError('En fazla 100 hediye kuralı eklenebilir.');
  const ids=new Set();
  const rules=input.rules.map(r=>{
    // Retain a removed legacy binding without letting it trigger a different gift.
    const removed=['gravity','brake','ice','bounce','repair','shield','jump','logs','wind'].includes(r.action);
    const action=removed?{id:r.action}:actions.find(a=>a.id===r.action);
    if(!action||typeof r.id!=='string'||!r.id||r.id.length>64||ids.has(r.id)||typeof r.giftId!=='string'||r.giftId.length>80)throw new InputError('Hediye kuralı geçersiz.');
    ids.add(r.id);
    return {id:r.id,giftId:r.giftId,action:action.id,enabled:!removed&&r.enabled!==false,distance:numeric(r.distance??10,1,5000,'Mesafe'),duration:numeric(r.duration??10,1,120,'Süre'),strength:numeric(r.strength??2,.2,8,'Güç')};
  });
  const length=numeric(input.track?.length??1000,100,5000,'Parkur uzunluğu');
  if(!Number.isInteger(length))throw new InputError('Parkur uzunluğu tam metre olmalı.');
  const winTarget=numeric(input.track?.winTarget??30,1,999,'Win hedefi');if(!Number.isInteger(winTarget))throw new InputError('Win hedefi tam sayı olmalı.');
  return {voice,track:{length,winTarget},graphics:validateGraphics(input.graphics),appearance:validateAppearance(input.appearance),rules};
}
export class Settings {
  constructor(file){this.file=file;this.value=defaults();this.serial=Promise.resolve();this.loaded=false;}
  async load(){try{this.value=validate(JSON.parse(await readFile(this.file,'utf8')));this.loaded=true;}catch(e){if(e.code!=='ENOENT')throw new Error('Kayıtlı ayar okunamadı; dosya korunuyor.');}return this;}
  save(input){const value=validate(input);return this.update(()=>value);}
  update(change){const task=this.serial.then(async()=>{const value=validate(change(this.value));await mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+randomUUID()+'.tmp';try{await writeFile(temp,JSON.stringify(value,null,2),{flag:'wx'});await rename(temp,this.file);this.value=value;return value;}finally{await rm(temp,{force:true});}});this.serial=task.catch(()=>{});return task;}
  applyStandard({confirmReplacement=false,revision}={}){return this.update(current=>{
    if(current.rules.length&&(confirmReplacement!==true||revision!==rulesRevision(current.rules)))throw new InputError('Mevcut kurallar değiştirilecek. Güncel kuralları kontrol edip onaylayın.',409);
    return {...current,rules:standardRules()};
  });}
}
