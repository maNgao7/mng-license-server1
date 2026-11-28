'use strict';
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');

class NativeSpectator extends EventEmitter {
  constructor({spawnWorker=spawn,python=require('./runtime-paths.cjs').pythonPath()}={}){
    super();this.spawnWorker=spawnWorker;this.python=python;this.worker=null;
    this.pending=new Map();this.sequence=0;this.closed=false;this.gamePid=null;
  }
  open(overlayHandle,hudFile){
    if(this.worker)return;
    if(this.closed)throw new Error('Oyun kapanıyor.');
    const layerPath = path.join(__dirname, '../assets/corner-colors');
    const layerName = 'VK_LAYER_TikMnG_corner_colors';
    const layers = new Set((process.env.VK_INSTANCE_LAYERS || '').split(path.delimiter).filter(Boolean));
    layers.add(layerName);
    const hudLayerPath = path.join(__dirname, '../assets/native-hud');
    if(hudFile)layers.add('VK_LAYER_TikMnG_native_hud');
    const gameEnvironment = {
      ...process.env,
      VK_INSTANCE_LAYERS: [...layers].join(path.delimiter),
      ...(hudFile?{TIKMNG_HUD_FILE:hudFile,TIKMNG_HUD_LOG:hudFile+'.log'}:{}),
    };
    // VK_LAYER_PATH takes precedence over VK_ADD_LAYER_PATH in the Vulkan loader.
    const layerVariable = process.env.VK_LAYER_PATH ? 'VK_LAYER_PATH' : 'VK_ADD_LAYER_PATH';
    gameEnvironment[layerVariable] = [layerPath, hudFile?hudLayerPath:null, process.env[layerVariable]].filter(Boolean).join(path.delimiter);
    const worker=this.spawnWorker(this.python,[path.join(__dirname,'../tools/spectator-worker.py'),...(overlayHandle?[overlayHandle,String(process.pid)]:[])],
      {windowsHide:true,stdio:['pipe','pipe','pipe'],env:gameEnvironment});
    this.worker=worker;
    const lines=createInterface({input:worker.stdout});
    lines.on('line',line=>{
      if(line.length>32768)return;
      let message;try{message=JSON.parse(line);}catch{return;}
      if(message.type==='process')this.gamePid=message.pid;
      if(message.type==='state')this.emit('state',message.value);
      if(message.type==='punch')this.emit('punch',message);
      if(message.type==='hit')this.emit('hit',message);
      if(message.type==='window')this.emit('window',message.value);
      if(message.type==='camera')this.emit('camera',message.value);
      if(message.type==='diagnostic')this.emit('diagnostic',message);
      if(message.type==='game-closed')this.emit('closed',message);
      if(message.type==='response'){
        const request=this.pending.get(message.id);if(!request)return;
        this.pending.delete(message.id);clearTimeout(request.timer);
        if(message.ok)request.resolve(message.value);else request.reject(new Error(message.error||'Oyun işlemi tamamlanamadı.'));
      }
    });
    // Worker stderr is never silently treated as a successful game start.
    let stderr='';worker.stderr.on('data',data=>{stderr=(stderr+data.toString()).slice(-1800);});
    const failed=error=>{
      for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(error);}
      this.pending.clear();this.worker=null;this.gamePid=null;
      if(!this.closed)this.emit('state',{phase:'error',health:[null,null],error:error.message});
    };
    worker.once('error',failed);
    worker.once('exit',code=>failed(new Error(code===0?'Oyun kapandı.':`Oyun bağlantısı kapandı (${code ?? '?'}). ${stderr.trim()}`)));
  }
  command(action,value){
    if(this.closed||!this.worker)return Promise.reject(new Error('Oyun bağlantısı açık değil.'));
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Oyun yanıt vermedi.'));},5000);
      this.pending.set(id,{resolve,reject,timer});
      this.worker.stdin.write(JSON.stringify({id,action,value})+'\n',error=>{
        if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
      });
    });
  }
  startMatch(){return this.command('start');}
  stage(lineup){return this.command('stage',lineup);}
  resetRound(lineup){return this.command('reset',lineup);}
  punch(value){return this.command('punch',value);}
  setCamera(value){return this.command('camera',value);}
  followTarget(value){return this.command('follow',value);}
  cameraZoom(value){return this.command('zoom',value);}
  close(){
    if(this.closePromise)return this.closePromise;this.closed=true;
    for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(new Error('Oyun kapanıyor.'));}
    this.pending.clear();
    const worker=this.worker;
    this.closePromise=worker?new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Önceki oyun zamanında kapanmadı.')),8000);
      worker.once('exit',()=>{clearTimeout(timeout);resolve();});
      worker.stdin.end(JSON.stringify({action:'close'})+'\n');this.worker=null;
    }):Promise.resolve();
    this.closePromise.catch(()=>{});return this.closePromise;
  }
}
module.exports={NativeSpectator};
