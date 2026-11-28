'use strict';
const { EventEmitter } = require('node:events');

// Game movement is never simulated by this UI state machine. Native telemetry
// must confirm a waiting ring before P can release the original fight.
class SpectatorSession extends EventEmitter {
  constructor({ native, live }) {
    super(); this.native=native; this.live=live; this.closed=false;
    this.value={phase:'loading',lineup:[false,false],winner:null,health:[null,null],panelOpen:false,error:''};
    this.starting=null;
    this.startIssued=false;
    this.restaged=false;
    native.on('state',state=>this.receive(state));
  }
  receive(state) {
    if(this.closed)return;
    if(!['loading','waiting','fighting','finished','error'].includes(state.phase))return;
    if(state.phase==='loading')this.restaged=true;
    // A repeated terminal sample after restaging belongs to the previous pair.
    if(this.restaged && state.phase==='finished')return;
    if(state.phase==='waiting' && this.value.phase==='finished')this.restaged=true;
    if(state.phase==='fighting')this.restaged=false;
    if(state.phase!=='waiting')this.startIssued=false;
    const error=/^(?:Error: )?Unexpected game module$/.test(state.error)
      ? 'Bu oyun kopyası Hediye Box ile eşleşmiyor. Oyunu kapatıp masaüstündeki TikMnG - Hediye Box kısayolunu açın.'
      : state.error || '';
    const winner = state.phase==='finished' && state.winner===undefined ? this.value.winner : state.winner??null;
    this.value={...this.value,phase:state.phase,lineup:state.lineup??this.value.lineup,winner,error,
      heads:Array.isArray(state.heads)?state.heads:this.value.heads,
      camera:state.camera||this.value.camera,
      health:[0,1].map(i=>typeof state.health?.[i]==='number'&&Number.isFinite(state.health[i])
        ?Math.max(0,Math.min(1,state.health[i])):null)};
    this.emit('state',this.snapshot());
  }
  snapshot(){return {...this.value,health:[...this.value.health],heads:this.value.heads?.map(head=>head?{...head}:null)||[null,null]};}
  setPanelOpen(open, kind='broadcast'){
    if(this.closed)return;
    this.value.panelOpen=open===true;
    this.value.panelKind=this.value.panelOpen?kind:null;
    this.emit('state',this.snapshot());
  }
  startMatch(){
    if(this.closed)return Promise.reject(new Error('Oyun kapanıyor.'));
    if(this.starting)return this.starting;
    if(this.value.phase!=='waiting'||this.startIssued)return Promise.reject(new Error('Ring henüz başlamaya hazır değil.'));
    // phase stays waiting until the native game acknowledges its own start.
    this.startIssued=true;
    this.starting=Promise.resolve().then(()=>{
      if(this.closed || this.value.phase!=='waiting')throw new Error('Ring henüz başlamaya hazır değil.');
      return this.native.startMatch();
    }).catch(error=>{this.startIssued=false;throw error;}).finally(()=>{this.starting=null;});
    return this.starting;
  }
  close(){if(this.closed)return;this.closed=true;this.native.close();this.removeAllListeners();}
}
module.exports={SpectatorSession};
