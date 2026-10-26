import {makeWorld} from './world.js';
import {socialSettings,SocialActions} from './social-rules.js';
const $=id=>document.getElementById(id);const icons=()=>window.lucide?.createIcons();icons();
let world;try{world=makeWorld($('world'));requestAnimationFrame(()=>requestAnimationFrame(()=>$('loading').hidden=true));}catch(e){console.error('Vak Vak Jump 3D başlangıç hatası',e);$('loading').textContent='3D görüntü başlatılamadı. Oyunu yeniden aç veya donanım hızlandırmasını etkinleştir.';throw e;}
let serverSettings = {};
try {
  const sRes = await fetch('/api/settings');
  if (sRes.ok) serverSettings = await sRes.json();
} catch (e) {}
let localSaved = {};
try { localSaved = JSON.parse(localStorage.getItem('mng-frog-river') || '{}'); } catch {}
let saved = { ...localSaved, ...serverSettings };
let settingsSave=Promise.resolve();
let character=saved.character==='female'?'female':'male';
let steps=0;
let goal=Number(saved.goal)||2000;
let wins=Number(saved.wins??0);
let targetWins=Number(saved.targetWins??50);
let {followEnabled,followDistance,likeEnabled,likeThreshold,likeDistance,followBackwardEnabled,followBackwardDistance,likeBackwardEnabled,likeBackwardDistance}=socialSettings(saved);
const socialActions=new SocialActions();
let volume=Math.max(0,Math.min(1,saved.volume??.29)),frogVolume=Math.max(0,Math.min(1,saved.frogVolume??.2)),effectsVolume=Math.max(0,Math.min(1,saved.effectsVolume??.55)),ambientVolume=Math.max(0,Math.min(1,saved.ambientVolume??.3)),ambientAudio=null,active=false,paused=false,demo=false,live={status:'disconnected'},token='',socket,catalog=[],reconnectTimer,audio,master,frogBus,effectsBus;
let quality=['high','low','balanced'].includes(saved.quality)?saved.quality:'high';

const EFFECTS={
  slipper:{type:'penalty',name:'Parmak arası terlik',icon:'🩴',detail:'Kenardan uçarak gelir, şaplakla geri atar',giftId:'5269',value:50,min:1,max:1000,unit:' m'},
  meteor:{type:'penalty',name:'Meteor ve Tsunami',icon:'☄️',detail:'10m öne düşer, dev tsunami dalgasıyla geriye iter',giftId:'5994',value:250,min:1,max:1000,unit:' m'},
  crocodile:{type:'penalty',name:'Timsah saldırısı',icon:'🐊',detail:'Pusu kurar, kurbağa arkasını dönüp geriye kaçar',giftId:'17473',value:350,min:1,max:1000,unit:' m'},
  stork:{type:'penalty',name:'Leylek kaçırması',icon:'🪶',detail:'Gökyüzünden süzülüp kurbağayı yakalar, geriye uçurur',giftId:'6104',value:500,min:1,max:1000,unit:' m'},
  bomb:{type:'penalty',name:'Flaş bombası',icon:'⚡',detail:'Sağ üstten gelir, kör edici parlama ve çınlama sesi',giftId:'5879',value:15,min:1,max:30,unit:' sn'},
  prison:{type:'penalty',name:'Hapis kafesi',icon:'🔒',detail:'Anında kilitler; zıplamaya basınca kafese çarpar',giftId:'6064',value:1,min:1,max:120,unit:' sn'},
  penalty_win:{type:'penalty',name:'-WIN Cezası',icon:'🔻',detail:'Doğrudan Win sayısını düşürür (-WIN)',giftId:'5336',value:1,min:1,max:100,unit:' Win'},
  rocket:{type:'support',name:'Roket yolculuğu',icon:'🚀',detail:'Güçlü itki ve motor kükremesiyle ileri uçar',giftId:'5655',value:50,min:1,max:1000,unit:' m'},
  turtle:{type:'support',name:'Dev kaplumbağa',icon:'🐢',detail:'Nilüferle birlikte su damlacıkları saçarak taşır',giftId:'5319',value:250,min:1,max:1000,unit:' m'},
  rainbow:{type:'support',name:'Gökkuşağı koşusu',icon:'🌈',detail:'Arkasında parlayan gökkuşağı şeridi bırakır',giftId:'5658',value:350,min:1,max:1000,unit:' m'},
  boat:{type:'support',name:'Nehir teknesi',icon:'⛵',detail:'Nehrin açık suyundan yanaşır, ileri taşır',giftId:'6427',value:500,min:1,max:1000,unit:' m'},
  hammer:{type:'support',name:'Kurtarma çekici',icon:'🔨',detail:'Hapisteyken demir parmaklıklara vurarak hapis süresini kırar',giftId:'15948',value:1,min:1,max:120,unit:' sn'},
  support_win:{type:'support',name:'+WIN Desteği',icon:'🏅',detail:'Doğrudan Win sayısını artırır (+WIN)',giftId:'7168',value:1,min:1,max:100,unit:' Win'}
};

let effectConfig=Object.fromEntries(Object.entries(EFFECTS).map(([key,item])=>[key,{giftId:String(saved.effectConfig?.[key]?.giftId||item.giftId),value:Number(saved.effectConfig?.[key]?.value??item.value)}]));
let effectTab='penalty',giftTarget='';
let durationSeconds=0,durationTimerInterval=null,currentTimedEffect='',runningEffect=null,isClashing=false,celebrating=false,finishCountdownTimer=null;

steps=Math.min(steps,goal);world.setProgress(steps);world.quality(quality);world.character(character);world.setGoal?.(goal);
world.setOnProgress?.((prog)=>{
  if(celebrating)return;
  const liveSteps=Math.max(0,Math.min(goal,Math.round(prog)));
  if(liveSteps!==steps){
    steps=liveSteps;
    counter();
  }
});
$('volume').value=volume*100;$('frog-volume').value=frogVolume*100;$('effects-volume').value=effectsVolume*100;if($('ambient-volume'))$('ambient-volume').value=ambientVolume*100;$('quality').value=quality;$('username').value=saved.username||'';
updateGoalUI();
updateWinUI();
updateTargetWinsUI();
initSocialSettingsUI();
persist(false);

function updateGoalUI(){
  const standardGoals=['500','1000','1100','1500','2000','3000','5000','10000'];
  const goalStr=String(goal);
  if(standardGoals.includes(goalStr)){
    $('goal').value=goalStr;
    $('custom-goal').hidden=true;
  }else{
    $('goal').value='custom';
    $('custom-goal').hidden=false;
    $('custom-goal').value=goal;
  }
}

function updateWinUI(){
  const countEl=$('wins-count');
  const targetEl=$('wins-target');
  const pointsEl=$('win-points-text');
  const winCard=$('win-card');
  if(countEl)countEl.textContent=wins.toLocaleString('tr-TR');
  if(targetEl)targetEl.textContent=targetWins.toLocaleString('tr-TR');
  if(pointsEl){
    const pts=wins*1000;
    pointsEl.textContent=`${pts.toLocaleString('tr-TR')} Win`;
  }
  if(winCard)winCard.classList.toggle('negative',wins<0);
}

function updateTargetWinsUI(){
  const standard=['10','25','50','100'];
  const twStr=String(targetWins);
  if($('target-wins')){
    if(standard.includes(twStr)){
      $('target-wins').value=twStr;
      if($('custom-target-wins'))$('custom-target-wins').hidden=true;
    }else{
      $('target-wins').value='custom';
      if($('custom-target-wins')){
        $('custom-target-wins').hidden=false;
        $('custom-target-wins').value=targetWins;
      }
    }
  }
}

function initSocialSettingsUI(){
  const addBackward=(prefix,label,enabled,distance,change)=>{
    const forward=$(prefix+'-enabled')?.closest('.setting-feature');
    if(!forward)return;
    const group=document.createElement('div');group.className='setting-feature';
    group.innerHTML=`<div class="setting-feature-head"><label class="switch-item"><input type="checkbox" id="${prefix}-backward-enabled"><span>${label} ile geri götür</span></label></div><div class="setting-feature-body"><span>${prefix==='like'?'Her beğeni eşiğinde':'Her takipte'}</span><input type="number" id="${prefix}-backward-distance" min="1" max="5000"><span>metre geri</span></div>`;
    forward.after(group);
    const toggle=$(prefix+'-backward-enabled'),input=$(prefix+'-backward-distance');
    toggle.checked=enabled;input.value=distance;
    const update=()=>{change(toggle.checked,Math.max(1,Math.min(5000,Number(input.value)||50)));persist();};
    toggle.onchange=update;input.onchange=update;
  };
  addBackward('follow','Takip',followBackwardEnabled,followBackwardDistance,(enabled,distance)=>{followBackwardEnabled=enabled;followBackwardDistance=distance;});
  addBackward('like','Beğeni',likeBackwardEnabled,likeBackwardDistance,(enabled,distance)=>{likeBackwardEnabled=enabled;likeBackwardDistance=distance;});
  if($('follow-enabled')){
    $('follow-enabled').checked=Boolean(followEnabled);
    $('follow-enabled').onchange=()=>{followEnabled=$('follow-enabled').checked;persist();};
  }
  if($('follow-distance')){
    $('follow-distance').value=followDistance;
    $('follow-distance').oninput=()=>{followDistance=Math.max(1,Math.min(500,Number($('follow-distance').value)||1));persist();};
  }
  if($('like-enabled')){
    $('like-enabled').checked=Boolean(likeEnabled);
    $('like-enabled').onchange=()=>{likeEnabled=$('like-enabled').checked;persist();};
  }
  if($('like-threshold')){
    $('like-threshold').value=likeThreshold;
    $('like-threshold').oninput=()=>{likeThreshold=Math.max(1,Math.min(10000,Number($('like-threshold').value)||100));persist();};
  }
  if($('like-distance')){
    $('like-distance').value=likeDistance;
    $('like-distance').oninput=()=>{likeDistance=Math.max(1,Math.min(500,Number($('like-distance').value)||1));persist();};
  }
  if($('target-wins')){
    $('target-wins').onchange=()=>{
      if($('target-wins').value==='custom'){
        if($('custom-target-wins')){
          $('custom-target-wins').hidden=false;
          $('custom-target-wins').value=targetWins;
          $('custom-target-wins').focus();
        }
      }else{
        if($('custom-target-wins'))$('custom-target-wins').hidden=true;
        targetWins=Number($('target-wins').value)||50;
        updateWinUI();
        persist();
      }
    };
  }
  if($('custom-target-wins')){
    $('custom-target-wins').oninput=()=>{
      targetWins=Math.max(1,Math.min(10000,Number($('custom-target-wins').value)||50));
      updateWinUI();
      persist();
    };
  }
}

function persist(saveToServer = true){
  const payload = {
    goal,
    wins,
    targetWins,
    followEnabled,
    followDistance,
    followBackwardEnabled,
    followBackwardDistance,
    likeEnabled,
    likeThreshold,
    likeDistance,
    likeBackwardEnabled,
    likeBackwardDistance,
    volume,
    frogVolume,
    effectsVolume,
    ambientVolume,
    quality,
    character,
    effectConfig,
    username: $('username')?.value || ''
  };
  try{
    localStorage.setItem('mng-frog-river',JSON.stringify({steps,...payload}));
  }catch{}
  if(saveToServer){
    settingsSave=settingsSave.catch(()=>{}).then(()=>fetch('/api/settings',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    })).then(response=>{if(!response.ok)throw Error('Ayarlar diske kaydedilemedi. Tekrar deneyin.');});
    settingsSave.catch(()=>{});
  }
  return settingsSave;
}
document.querySelectorAll('.character-option').forEach(button=>{const selected=button.dataset.character===character;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.onclick=()=>{character=button.dataset.character;world.character(character);document.querySelectorAll('.character-option').forEach(other=>{const active=other===button;other.classList.toggle('selected',active);other.setAttribute('aria-pressed',String(active));});persist();};});
function counter(){$('steps').textContent=steps.toLocaleString('tr-TR');$('target').textContent=goal.toLocaleString('tr-TR');$('bar').style.width=`${Math.min(100,(steps/goal)*100)}%`;$('milestone').textContent=steps?`${Math.max(0,goal-steps).toLocaleString('tr-TR')} yaprak sonra hedefteyiz`:'İlk nilüfer seni bekliyor';}counter();

function playGongSound(isPositive=true){
  soundSetup();
  if(!audio)return;
  const now=audio.currentTime,bus=effectsBus||master;
  const baseFreq=isPositive?261.63:130.81;
  const partials=isPositive
    ?[{mult:1,gain:.42,decay:3.2},{mult:1.5,gain:.3,decay:2.7},{mult:2,gain:.22,decay:2.2},{mult:2.76,gain:.16,decay:1.7},{mult:4.12,gain:.1,decay:1.2}]
    :[{mult:1,gain:.48,decay:3.5},{mult:1.18,gain:.36,decay:3.0},{mult:1.41,gain:.28,decay:2.4},{mult:2.05,gain:.18,decay:1.8},{mult:2.92,gain:.12,decay:1.2}];
  partials.forEach(({mult,gain,decay})=>{
    const osc=audio.createOscillator(),g=audio.createGain();
    osc.type=isPositive?'sine':'triangle';
    osc.frequency.setValueAtTime(baseFreq*mult,now);
    g.gain.setValueAtTime(.001,now);
    g.gain.exponentialRampToValueAtTime(gain*effectsVolume*(volume>0?1:0),now+.02);
    g.gain.exponentialRampToValueAtTime(.0001,now+decay);
    osc.connect(g).connect(bus);
    osc.start(now);
    osc.stop(now+decay+.05);
  });
  noise(0,.08,isPositive?.18:.32,isPositive?2800:850);
}

function showWinAlertToast(user,delta){
  const isPos=delta>0;
  const old=document.querySelector('.win-alert-toast');
  old?.remove();
  const toast=document.createElement('div');
  toast.className=`win-alert-toast ${isPos?'support':'penalty'}`;
  toast.innerHTML=`<span style="font-size:1.6rem">${isPos?'🏆':'💥'}</span> <span>@${user} ${isPos?'+':''}${delta} WIN ${isPos?'HEDİYE ETTİ!':'DÜŞÜRDÜ!'}</span>`;
  document.body.append(toast);
  setTimeout(()=>toast.remove(),2800);
}

const SOUND_FILES = [
  'rocket.mp3', 'slipper.mp3', 'meteor.mp3', 'tsunami.mp3',
  'crocodile.mp3', 'prison.mp3', 'hammer.mp3', 'boat.mp3', 'rainbow.mp3', 'ambient.mp3', 'stork.mp3'
];
const soundPool = {};
function preloadSounds(){
  SOUND_FILES.forEach(f => {
    if(!soundPool[f]){
      const a = new Audio(`/sounds/${f}`);
      a.preload = 'auto';
      soundPool[f] = a;
    }
  });
}
try { preloadSounds(); } catch(e){}

function initAmbient(){
  if(!ambientAudio){
    ambientAudio = soundPool['ambient.mp3'] || new Audio('/sounds/ambient.mp3');
    ambientAudio.loop = true;
  }
  ambientAudio.volume = Math.max(0, Math.min(1, ambientVolume * (volume > 0 ? 1 : 0)));
}
function startAmbient(){
  initAmbient();
  ambientAudio.volume = Math.max(0, Math.min(1, ambientVolume * (volume > 0 ? 1 : 0)));
  ambientAudio.currentTime = 0;
  ambientAudio.play().catch(e => console.warn('Ambient play failed:', e));
}
function pauseAmbient(){
  if(ambientAudio) ambientAudio.pause();
}
function resumeAmbient(){
  if(ambientAudio && active && !paused){
    ambientAudio.volume = Math.max(0, Math.min(1, ambientVolume * (volume > 0 ? 1 : 0)));
    ambientAudio.play().catch(e => console.warn('Ambient resume failed:', e));
  }
}

let activeEffectAudios = [];
let activeEffectTimers = [];
let flashTinnitusNode = null;

function stopActiveEffectSound(){
  if(activeEffectAudios.length > 0){
    activeEffectAudios.forEach(a => {
      try {
        a.pause();
        a.currentTime = 0;
        a.loop = false;
      } catch(e){}
    });
    activeEffectAudios = [];
  }
  if(activeEffectTimers.length > 0){
    activeEffectTimers.forEach(t => {
      try { clearTimeout(t); clearInterval(t); } catch(e){}
    });
    activeEffectTimers = [];
  }
  if(flashTinnitusNode){
    try { flashTinnitusNode.stop(); flashTinnitusNode.disconnect(); } catch(e){}
    flashTinnitusNode = null;
  }
}

function playTurtleWaterSound(duration){
  soundSetup();
  if(!audio) return;
  const now = audio.currentTime, bus = effectsBus || master;
  const sampleRate = audio.sampleRate;
  const dur = Math.max(1.0, Math.min(12.0, duration));
  const len = Math.floor(sampleRate * dur);
  const buf = audio.createBuffer(2, len, sampleRate);
  for(let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch);
    let pink = 0.0;
    for(let i = 0; i < len; i++){
      const white = Math.random() * 2 - 1;
      pink = (pink + 0.025 * white) / 1.025;
      const t = i / sampleRate;
      const paddleMod = 0.72 + 0.28 * Math.sin(t * Math.PI * 4.8);
      d[i] = pink * 2.6 * paddleMod;
    }
  }
  const src = audio.createBufferSource();
  src.buffer = buf;
  const filter = audio.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(560, now);
  filter.Q.setValueAtTime(0.85, now);
  const g = audio.createGain();
  const vol = Math.max(0, Math.min(1, 0.95 * effectsVolume * (volume > 0 ? 1 : 0)));
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.25);
  g.gain.setValueAtTime(vol, now + dur - 0.35);
  g.gain.linearRampToValueAtTime(0.001, now + dur);
  src.connect(filter).connect(g).connect(bus);
  src.start(now);
  src.stop(now + dur);
  activeEffectAudios.push({
    pause(){ try { src.stop(); src.disconnect(); } catch(e){} },
    currentTime: 0,
    loop: false
  });

  splash();
  let splashElapsed = 0;
  const splashTimer = setInterval(() => {
    splashElapsed += 420;
    if (splashElapsed >= dur * 1000) {
      clearInterval(splashTimer);
      return;
    }
    splash();
  }, 420);
  activeEffectTimers.push(splashTimer);
}

function playSound(file, relVol = 1.0, loop = false, trackActive = false){
  try {
    const vol = Math.max(0, Math.min(1, relVol * effectsVolume * (volume > 0 ? 1 : 0)));
    if(vol <= 0) return null;
    const a = (soundPool[file] ? soundPool[file].cloneNode() : new Audio(`/sounds/${file}`));
    a.volume = vol;
    a.loop = Boolean(loop);
    if(trackActive){
      activeEffectAudios.push(a);
    }
    a.play().catch(e => console.warn('SFX play error for', file, e));
    return a;
  } catch(e) {
    console.warn('playSound exception for', file, e);
    return null;
  }
}

function soundSetup(){if(!audio){audio=new AudioContext();master=audio.createGain();frogBus=audio.createGain();effectsBus=audio.createGain();frogBus.connect(master);effectsBus.connect(master);master.connect(audio.destination);}master.gain.value=volume*.22;frogBus.gain.value=frogVolume;effectsBus.gain.value=effectsVolume;if(audio.state==='suspended')audio.resume();preloadSounds();initAmbient();}
function tone(freq,time,duration,type='sine',gain=.3,bus=effectsBus,slide=1){if(!audio||!master)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime+time);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),audio.currentTime+time+duration);g.gain.setValueAtTime(.001,audio.currentTime+time);g.gain.exponentialRampToValueAtTime(gain,audio.currentTime+time+.012);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+time+duration);o.connect(g).connect(bus||master);o.start(audio.currentTime+time);o.stop(audio.currentTime+time+duration+.02);}
function noise(time,duration,gain=.2,lowpass=1400){if(!audio||!master)return;const length=Math.max(1,Math.floor(audio.sampleRate*duration)),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=lowpass;g.gain.setValueAtTime(.001,audio.currentTime+time);g.gain.exponentialRampToValueAtTime(gain,audio.currentTime+time+.015);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+time+duration);source.connect(filter).connect(g).connect(effectsBus||master);source.start(audio.currentTime+time);}
function splash(){tone(480,0,.12,'sine',.22);tone(720,.02,.1,'sine',.18);tone(1150,.05,.14,'triangle',.15);noise(.01,.18,.14,1600);}
function croak(){
  soundSetup();
  if(!audio)return;
  const now=audio.currentTime;
  [0,0.08].forEach((offset,idx)=>{
    const osc=audio.createOscillator(),formant=audio.createBiquadFilter(),g=audio.createGain();
    osc.type='sawtooth';
    const baseFreq=idx===0?145:115;
    osc.frequency.setValueAtTime(baseFreq,now+offset);
    osc.frequency.exponentialRampToValueAtTime(baseFreq*1.55,now+offset+0.03);
    osc.frequency.exponentialRampToValueAtTime(baseFreq*0.8,now+offset+0.12);
    formant.type='bandpass';
    formant.frequency.setValueAtTime(460,now+offset);
    formant.Q.setValueAtTime(5.2,now+offset);
    g.gain.setValueAtTime(0.001,now+offset);
    g.gain.exponentialRampToValueAtTime(0.38,now+offset+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,now+offset+0.13);
    osc.connect(formant).connect(g).connect(frogBus||master);
    osc.start(now+offset);osc.stop(now+offset+0.14);
  });
  noise(0.02,0.12,0.08,950);
}

function prisonClang(){
  soundSetup();
  tone(580,0,.1,'triangle',.38,effectsBus,.9);
  tone(890,.01,.15,'sine',.3,effectsBus,.85);
  tone(1240,.02,.2,'square',.18,effectsBus,.8);
  noise(0,.07,.24,3200);
}

function flashTinnitus(duration){
  soundSetup();if(!audio)return;
  if(flashTinnitusNode){
    try { flashTinnitusNode.stop(); flashTinnitusNode.disconnect(); } catch(e){}
    flashTinnitusNode = null;
  }
  const now=audio.currentTime,osc=audio.createOscillator(),g=audio.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(4000,now);
  g.gain.setValueAtTime(.001,now);
  g.gain.exponentialRampToValueAtTime(.26,now+.03);
  const ringDur=Math.min(10,Math.max(1,duration));
  g.gain.setValueAtTime(.24,now+ringDur*.35);
  g.gain.exponentialRampToValueAtTime(.001,now+ringDur);
  osc.connect(g).connect(effectsBus||master);
  osc.start(now);osc.stop(now+ringDur+.05);
  flashTinnitusNode = osc;
}

function hammerStrikeSound(){
  soundSetup();
  playSound('hammer.mp3',0.9,false,false);
  if(!audio)return;
  tone(720,0,.12,'triangle',.18,effectsBus,.85);
  tone(1160,.008,.16,'sine',.14,effectsBus,.75);
}

function playStorkBillClatter(duration=3.5){
  soundSetup();
  if(!audio)return;
  const now=audio.currentTime,bus=effectsBus||master;
  const totalClicks=Math.min(65,Math.floor(duration*16));
  for(let i=0;i<totalClicks;i++){
    const clickTime=now+0.15+i*0.058+(Math.random()-0.5)*0.008;
    const osc=audio.createOscillator(),g=audio.createGain();
    osc.type='triangle';
    osc.frequency.setValueAtTime(860+(i%2)*200+(Math.random()-0.5)*60,clickTime);
    osc.frequency.exponentialRampToValueAtTime(320,clickTime+0.024);
    g.gain.setValueAtTime(0.001,clickTime);
    g.gain.exponentialRampToValueAtTime(0.35*effectsVolume*(volume>0?1:0),clickTime+0.004);
    g.gain.exponentialRampToValueAtTime(0.001,clickTime+0.026);
    osc.connect(g).connect(bus);
    osc.start(clickTime);
    osc.stop(clickTime+0.03);
    noise(clickTime-now,0.02,0.28,3800);
  }
  const flaps=Math.floor(duration*2.8);
  for(let f=0;f<flaps;f++){
    const flapTime=0.2+f*0.36;
    tone(95,flapTime,0.18,'sine',0.28,bus,0.5);
    noise(flapTime,0.22,0.22,750);
  }
}

function effectSound(key,duration=2){
  soundSetup();
  stopActiveEffectSound();
  if(key==='prison'){
    playSound('prison.mp3',0.95,false,true);
    prisonClang();
  }else if(key==='hammer'){
    playSound('hammer.mp3',0.9,false,false);
  }else if(key==='bomb'){
    flashTinnitus(duration);
  }else if(key==='meteor'){
    playSound('meteor.mp3',0.88,false,true);
    const t = setTimeout(()=>{
      playSound('tsunami.mp3',0.75,true,true);
    },700);
    activeEffectTimers.push(t);
  }else if(key==='crocodile'){
    playSound('crocodile.mp3',0.92,true,true);
  }else if(key==='stork'){
    playSound('stork.mp3',0.95,true,true);
  }else if(key==='rocket'){
    playSound('rocket.mp3',0.9,true,true);
  }else if(key==='turtle'){
    playTurtleWaterSound(duration);
  }else if(key==='boat'){
    playSound('boat.mp3',0.85,true,true);
    splash();
  }else if(key==='rainbow'){
    playSound('rainbow.mp3',0.9,true,true);
  }else if(key==='slipper'){
    playSound('slipper.mp3',0.95,false,true);
  }
}

function triggerFlashbang(duration){
  const fb=$('screen-flashbang');if(!fb)return;
  fb.classList.remove('active','fade');fb.style.transition='';fb.style.opacity='';
  void fb.offsetWidth;
  fb.classList.add('active');
  setTimeout(()=>{
    fb.classList.remove('active');
    fb.classList.add('fade');
    fb.style.transition=`opacity ${duration}s linear`;
    fb.style.opacity='0';
  },120);
  setTimeout(()=>{
    fb.classList.remove('fade');
    fb.style.transition='';
    fb.style.opacity='';
  },duration*1000+250);
}

function triggerWaterLens(){
  const wl=$('screen-water-lens');if(!wl)return;
  wl.classList.remove('active');void wl.offsetWidth;
  wl.classList.add('active');
}

function triggerTsunami(){
  const ts=$('screen-tsunami');if(!ts)return;
  ts.classList.remove('active');void ts.offsetWidth;
  ts.classList.add('active');
}

let distanceHudInterval=null;
function showDistanceHud(key,totalDist,isPenalty,duration){
  const hud=$('effect-distance-hud');
  if(!hud)return;
  const item=EFFECTS[key];
  const iconEl=$('effect-hud-icon'),titleEl=$('effect-hud-title'),meterEl=$('effect-hud-meters');
  if(iconEl)iconEl.textContent=item?.icon||(isPenalty?'⚠️':'🚀');
  if(titleEl)titleEl.textContent=item?.name?.toUpperCase()||(isPenalty?'CEZA':'DESTEK');
  hud.classList.toggle('penalty',isPenalty);
  hud.hidden=false;

  const startTime=performance.now();
  const durMs=duration*1000;
  if(distanceHudInterval)clearInterval(distanceHudInterval);
  distanceHudInterval=setInterval(()=>{
    const elapsed=performance.now()-startTime;
    const progressRatio=Math.min(1,elapsed/durMs);
    const currentM=Math.round(progressRatio*totalDist);
    const sign=isPenalty?'-':'+';
    if(meterEl)meterEl.textContent=`${sign}${currentM}m / ${sign}${totalDist}m`;
    if(progressRatio>=1){
      clearInterval(distanceHudInterval);
      distanceHudInterval=null;
      setTimeout(()=>{if(hud)hud.hidden=true;},900);
    }
  },45);
}

function startTimedPenalty(label,iconName,seconds,effectType=''){
  durationSeconds+=seconds;
  currentTimedEffect=effectType;
  const badge=$('prison-badge');
  if(badge){
    badge.hidden=false;
    badge.classList.toggle('bomb-theme',effectType==='bomb');
    badge.innerHTML=`<i data-lucide="${iconName}"></i> <span>${label}: <strong id="prison-timer">${Math.ceil(durationSeconds)}</strong>s</span>`;
    icons();
  }
  if(!durationTimerInterval){
    let lastTick=performance.now();
    durationTimerInterval=setInterval(()=>{
      const now=performance.now(),delta=(now-lastTick)/1000;
      lastTick=now;
      if(!paused&&active){
        durationSeconds=Math.max(0,durationSeconds-delta);
        const timerEl=$('prison-timer');
        if(timerEl)timerEl.textContent=Math.ceil(durationSeconds);
        if(durationSeconds<=0){
          clearInterval(durationTimerInterval);
          durationTimerInterval=null;
          if(badge)badge.hidden=true;
          if(currentTimedEffect==='prison')world.releasePrison?.();
          stopActiveEffectSound();
          currentTimedEffect='';
        }
      }
    },100);
  }
}

function triggerFinishCelebration(){
  if(celebrating)return;
  celebrating=true;
  soundSetup();

  const winnerScreen=$('winner-screen');
  const countdownEl=$('winner-countdown');
  const bannerEl=$('winner-banner');

  if(winnerScreen&&countdownEl&&bannerEl){
    winnerScreen.hidden=false;
    countdownEl.hidden=false;
    bannerEl.hidden=true;

    let count=10;
    countdownEl.textContent=count;
    tone(380,0,.18,'triangle',.4);

    if(finishCountdownTimer)clearInterval(finishCountdownTimer);
    finishCountdownTimer=setInterval(()=>{
      count--;
      if(count>0){
        countdownEl.textContent=count;
        countdownEl.style.animation='none';
        void countdownEl.offsetWidth;
        countdownEl.style.animation='countBeat 1s ease-out';
        tone(380+(10-count)*36,0,.18,'triangle',.4);
      }else{
        clearInterval(finishCountdownTimer);
        finishCountdownTimer=null;
        countdownEl.hidden=true;
        bannerEl.hidden=false;

        // Grand WINNER Victory Fanfare
        [523.25,659.25,783.99,1046.50,1318.51,1567.98].forEach((f,i)=>tone(f,i*.14,.7,'triangle',.4));

        setTimeout(()=>{
          winnerScreen.hidden=true;
          steps=0;
          world.setProgress(0);
          wins+=1;
          updateWinUI();
          counter();
          persist();
          playGongSound(true);
          celebrating=false;
        },3500);
      }
    },1000);
  }

  world.celebrateFinish?.(character,()=>{
    // Kept active through countInterval
  });
}

function cancelFinishCelebration(){
  if(!celebrating)return;
  celebrating=false;
  stopActiveEffectSound();
  if(finishCountdownTimer){
    clearInterval(finishCountdownTimer);
    finishCountdownTimer=null;
  }
  const winnerScreen=$('winner-screen');
  if(winnerScreen)winnerScreen.hidden=true;
  world.cancelCelebration?.();
}

function effectToast(key,user='Test'){
  const item=EFFECTS[key],old=document.querySelector('.effect-lock');old?.remove();
  const note=document.createElement('div');note.className=`effect-lock ${item.type}`;
  note.textContent=`@${user} · ${item.name}`;document.body.append(note);
  document.body.classList.remove('effect-bomb','effect-meteor','effect-prison','effect-slipper');
  if(['bomb','meteor','prison','slipper'].includes(key)){
    document.body.classList.add(`effect-${key}`);
    setTimeout(()=>document.body.classList.remove(`effect-${key}`),key==='slipper'?350:key==='bomb'?2200:1100);
  }
  setTimeout(()=>note.remove(),2600);
}

function triggerClash(penalty,support){
  isClashing=true;
  stopActiveEffectSound();
  const overlay=$('clash-overlay');
  if(overlay){
    overlay.hidden=false;
    $('clash-penalty-user').textContent=`@${penalty.user}`;
    $('clash-penalty-gift').textContent=`${penalty.item.name} (-${penalty.distance}m)`;
    $('clash-support-user').textContent=`@${support.user}`;
    $('clash-support-gift').textContent=`${support.item.name} (+${support.distance}m)`;
    const total=penalty.distance+support.distance;
    const ratio=total>0?(support.distance/total)*100:50;
    $('clash-meter-fill').style.width=`${ratio}%`;
    $('clash-status').textContent=`GÜÇLER ÇARPIŞIYOR! (Fark: ${support.distance>=penalty.distance?'+':''}${support.distance-penalty.distance}m)`;
  }
  soundSetup();
  tone(120,0,.9,'sawtooth',.4,effectsBus,2.5);
  tone(60,.1,1.2,'square',.45,effectsBus,.5);
  noise(0,2.5,.35,1200);

  const netDelta=support.distance-penalty.distance;
  world.clash?.({penalty,support,netDelta},()=>{
    if(overlay)overlay.hidden=false;
    $('clash-status').textContent=netDelta>0?`🏆 DESTEK KAZANDI! (+${netDelta}m)`:netDelta<0?`💥 CEZA AĞIR BASTI! (${netDelta}m)`:`⚖️ GÜÇLER EŞİTLENDİ! (0m)`;
    setTimeout(()=>{
      if(overlay)overlay.hidden=true;
      isClashing=false;
      runningEffect=null;
      stopActiveEffectSound();
      const prevSteps=steps;
      steps=Math.max(0,Math.min(goal,Math.round(steps+netDelta)));
      world.setProgress(steps);
      counter();
      if(netDelta<0&&prevSteps>0&&steps===0){
        wins-=1;
        updateWinUI();
        playGongSound(false);
      }
      persist();
      if(steps>=goal)triggerFinishCelebration();
    },1200);
  });
}

function runEffect(key,user='Test',count=1){
  const item=EFFECTS[key],config=effectConfig[key];
  if(!item||!config||!active||paused)return false;

  // If on finish island countdown and penalty arrives: cancel countdown immediately and push back!
  if(celebrating){
    if(item.type==='penalty'){
      cancelFinishCelebration();
    }else{
      return false;
    }
  }

  const giftCount=Math.max(1,Number(count)||1);
  if(key==='penalty_win'){
    const delta=Math.max(1,Math.round(config.value*giftCount));
    wins-=delta;
    updateWinUI();
    persist();
    playGongSound(false);
    effectToast(key,user);
    showWinAlertToast(user,-delta);
    return true;
  }
  if(key==='support_win'){
    const delta=Math.max(1,Math.round(config.value*giftCount));
    wins+=delta;
    updateWinUI();
    persist();
    playGongSound(true);
    effectToast(key,user);
    showWinAlertToast(user,delta);
    return true;
  }
  const isTime=key==='bomb'||key==='prison'||key==='hammer';
  const distance=isTime?0:Math.round(config.value*giftCount);
  const timeDuration=Math.round(config.value*giftCount);

  // KURTARMA ÇEKİCİ (RESCUE HAMMER SUPPORT)
  if(key==='hammer'){
    const reduction=Math.max(1,timeDuration);
    if(durationSeconds>0&&currentTimedEffect==='prison'){
      durationSeconds=Math.max(0,durationSeconds-reduction);
      const timerEl=$('prison-timer');
      if(timerEl)timerEl.textContent=Math.ceil(durationSeconds);
      world.strikeHammer?.(reduction,durationSeconds<=0);
      effectSound('hammer');
      effectToast('hammer',user);
      if(durationSeconds<=0){
        clearInterval(durationTimerInterval);
        durationTimerInterval=null;
        currentTimedEffect='';
        const badge=$('prison-badge');
        if(badge)badge.hidden=true;
        document.body.classList.remove('effect-prison');
        stopActiveEffectSound();
        world.releasePrison?.();
      }
    }else{
      world.strikeHammer?.(reduction,false);
      effectSound('hammer');
      effectToast('hammer',user);
    }
    return true;
  }

  // CLASH DETECTION: If opposing force arrives while distance effect is active
  if(!isTime&&runningEffect&&runningEffect.type!==item.type&&runningEffect.distance>0&&distance>0&&!isClashing){
    const penalty=runningEffect.type==='penalty'?runningEffect:{key,item,config,user,type:'penalty',distance};
    const support=runningEffect.type==='support'?runningEffect:{key,item,config,user,type:'support',distance};
    triggerClash(penalty,support);
    return true;
  }

  // Smooth duration scaling for large distances (600m - 1000m)
  const baseDuration=key==='boat'?4.5:key==='turtle'?4.0:key==='rainbow'?3.2:key==='rocket'?3.5:key==='slipper'?1.8:key==='meteor'?4.2:key==='stork'?4.0:3.2;
  const duration=isTime?Math.max(1,timeDuration):Math.min(10.5,Math.max(baseDuration,Math.sqrt(distance)*0.32));

  if(key==='prison'){
    startTimedPenalty('HAPİS','lock',duration,'prison');
  }else if(key==='bomb'){
    startTimedPenalty('FLAŞ','zap',duration,'bomb');
  }

  const startStep = steps;
  const targetStep = item.type === 'support' ? startStep + distance : Math.max(0, startStep - distance);

  if(!isTime&&distance>0){
    runningEffect={key,item,config,user,type:item.type,distance};
    showDistanceHud(key,distance,item.type==='penalty',duration);
  }

  const started=world.effect(key,{distance,duration},()=>{
    runningEffect=null;
    stopActiveEffectSound();
    if($('effect-distance-hud'))$('effect-distance-hud').hidden=true;
    if(!isTime){
      const prevSteps=steps;
      steps=Math.max(0,Math.min(goal,targetStep));
      world.setProgress(steps);
      counter();
      if(item.type==='penalty'&&prevSteps>0&&steps===0){
        wins-=1;
        updateWinUI();
        playGongSound(false);
      }
      persist();
      if(steps>=goal){
        triggerFinishCelebration();
      }
    }
  });

  if(started||key==='prison'){
    effectSound(key,duration);
    effectToast(key,user);
    if(key==='bomb'){
      triggerFlashbang(duration);
    }else if(key==='turtle'){
      triggerWaterLens();
    }else if(key==='meteor'){
      setTimeout(()=>{triggerTsunami();triggerWaterLens();},650);
    }
  }
  return started||key==='prison';
}

function processSocialQueue(){
  if(!socialActions.queue.length||!active||paused||document.querySelector('dialog[open]')||world.busy()||runningEffect||isClashing)return;
  if(world.isPrisonActive?.()||durationSeconds>0)return;
  const next=socialActions.queue[0];
  if(steps>=goal&&next.distance>0)return;
  const key=next.distance>0?'rocket':'slipper';
  const previous=effectConfig[key];
  try{
    effectConfig[key]={...previous,value:Math.abs(next.distance)};
    if(runEffect(key,next.username||'İzleyici'))socialActions.queue.shift();
  }finally{effectConfig[key]=previous;}
}

function jump(){
  if(!active||paused||steps>=goal||document.querySelector('dialog[open]'))return;
  soundSetup();
  if(world.isPrisonActive?.()||(currentTimedEffect==='prison'&&durationSeconds>0)){
    prisonClang();
    world.bonkPrison?.();
    return;
  }
  if(currentTimedEffect==='bomb'&&durationSeconds>0){
    tone(280,0,.08,'sine',.15);
    return;
  }
  if(world.jump(success=>{
    splash();
    if(!success)return;
    steps++;counter();persist();
    if(steps>=goal){
      triggerFinishCelebration();
    }else{
      setTimeout(processSocialQueue, 80);
    }
  })){
    croak();tone(220,0,.08);tone(330,.025,.09);
  }
}
$('jump').onclick=jump;

const held=new Set();let lastDirection={x:0,z:-1};
function acceptsKeys(){return active&&!paused&&!document.querySelector('dialog[open]')&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName);}
function steer(){const x=Number(held.has('KeyD'))-Number(held.has('KeyA')),z=Number(held.has('KeyS'))-Number(held.has('KeyW'));if(x||z)lastDirection={x,z};world.direction(lastDirection.x,lastDirection.z);}
addEventListener('keydown',e=>{if(!['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)||!acceptsKeys())return;e.preventDefault();held.add(e.code);steer();if(e.code==='Space'&&!e.repeat)jump();});
addEventListener('keyup',e=>held.delete(e.code));
addEventListener('blur',()=>held.clear());
document.addEventListener('visibilitychange',()=>{if(document.hidden)held.clear();});
function keyboardFrame(){if(acceptsKeys()){steer();if(held.has('Space'))jump();}else held.clear();processSocialQueue();requestAnimationFrame(keyboardFrame);}requestAnimationFrame(keyboardFrame);

function enter(local){demo=local;active=true;paused=false;world.pause(false);world.setPlaying(true);$('welcome').hidden=true;$('hud').hidden=false;document.body.classList.add('playing');soundSetup();startAmbient();updateStatus();}
$('demo').onclick=()=>enter(true);$('enter').onclick=()=>{if(live.status==='connected')enter(false);};
$('home').onclick=()=>{active=false;world.pause(true);world.setPlaying(false);pauseAmbient();stopActiveEffectSound();$('welcome').hidden=false;$('hud').hidden=true;document.body.classList.remove('playing');updateStatus();};

function pause(v){
  paused=v;world.pause(v);
  if(v){
    pauseAmbient();
    activeEffectAudios.forEach(a=>{try{a.pause();}catch(e){}});
  }else{
    if(active)resumeAmbient();
    if(runningEffect)activeEffectAudios.forEach(a=>{try{a.play().catch(()=>{});}catch(e){}});
  }
  $('pause').innerHTML=`<i data-lucide="${v?'play':'pause'}"></i>`;
  $('pause').title=v?'Devam et':'Duraklat';icons();
}
$('pause').onclick=()=>pause(!paused);

function reset(){
  steps=0;
  durationSeconds=0;
  currentTimedEffect='';
  stopActiveEffectSound();
  if(durationTimerInterval){clearInterval(durationTimerInterval);durationTimerInterval=null;}
  if($('prison-badge'))$('prison-badge').hidden=true;
  world.releasePrison?.();
  world.setProgress(0);
  counter();
  persist();
  pause(false);
}
$('reset').onclick=()=>{if(confirm('Bu yolculuktaki ilerleme sıfırlansın mı?')){reset();$('settings').close();}};
$('again').onclick=()=>{reset();$('finish').close();};

$('goal').onchange=()=>{
  if($('goal').value==='custom'){
    $('custom-goal').hidden=false;
    $('custom-goal').value=goal;
    $('custom-goal').focus();
  }else{
    $('custom-goal').hidden=true;
    goal=Number($('goal').value);
    if(steps>=goal)reset();
    counter();
    world.setGoal?.(goal);
    persist();
  }
};
$('custom-goal').oninput=()=>{
  const val=Math.max(100,Math.min(50000,Number($('custom-goal').value)||1000));
  goal=val;
  if(steps>=goal)reset();
  counter();
  world.setGoal?.(goal);
  persist();
};

$('volume').oninput=()=>{
  volume=Number($('volume').value)/100;
  if(master)master.gain.value=volume*.2;
  activeEffectAudios.forEach(a=>{try{a.volume=Math.max(0,Math.min(1,effectsVolume*(volume>0?1:0)));}catch(e){}});
  if(ambientAudio)ambientAudio.volume=Math.max(0,Math.min(1,ambientVolume*(volume>0?1:0)));
  persist();
};
$('frog-volume').oninput=()=>{frogVolume=Number($('frog-volume').value)/100;if(frogBus)frogBus.gain.value=frogVolume;persist();};
$('effects-volume').oninput=()=>{
  effectsVolume=Number($('effects-volume').value)/100;
  if(effectsBus)effectsBus.gain.value=effectsVolume;
  activeEffectAudios.forEach(a=>{try{a.volume=Math.max(0,Math.min(1,effectsVolume*(volume>0?1:0)));}catch(e){}});
  persist();
};
if($('ambient-volume'))$('ambient-volume').oninput=()=>{ambientVolume=Number($('ambient-volume').value)/100;if(ambientAudio)ambientAudio.volume=Math.max(0,Math.min(1,ambientVolume*(volume>0?1:0)));persist();};
$('quality').onchange=()=>{quality=$('quality').value;world.quality(quality);persist();};$('zoom').oninput=()=>world.zoom(Number($('zoom').value)/100);
$('sound').onclick=()=>{
  soundSetup();
  volume=volume?0:.45;
  master.gain.value=volume*.2;
  $('volume').value=volume*100;
  $('sound').innerHTML=`<i data-lucide="${volume?'volume-2':'volume-x'}"></i>`;
  icons();
  activeEffectAudios.forEach(a=>{try{a.volume=Math.max(0,Math.min(1,effectsVolume*(volume>0?1:0)));}catch(e){}});
  if(ambientAudio)ambientAudio.volume=Math.max(0,Math.min(1,ambientVolume*(volume>0?1:0)));
  persist();
};
$('settings-open').onclick=()=>{$('settings').showModal();world.pause(true);pauseAmbient();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',()=>{world.pause(paused||!active);if(!paused&&active)resumeAmbient();});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});

function showSaveSuccessToast(msg = 'Ayarlar kalıcı olarak diskte kaydedildi!'){
  soundSetup();
  tone(520,0,.14,'triangle',.35);
  tone(780,.07,.2,'triangle',.35);
  const old=document.querySelector('.save-toast');
  old?.remove();
  const toast=document.createElement('div');
  toast.className='save-toast';
  toast.innerHTML=`<span>💾</span> <b>${msg}</b>`;
  document.body.append(toast);
  setTimeout(()=>toast.remove(),2600);
}

$('save-settings-btn')?.addEventListener('click', async ()=>{
  try{await persist(true);showSaveSuccessToast('Ayarlar kalıcı olarak diskte kaydedildi!');$('settings').close();}
  catch{showSaveSuccessToast('Kayıt başarısız. Sunucu bağlantısını kontrol edip tekrar deneyin.');}
});
$('save-effects-btn')?.addEventListener('click', async ()=>{
  try{await persist(true);showSaveSuccessToast('Etkileşim ayarları diske kaydedildi!');$('interactions').close();}
  catch{showSaveSuccessToast('Kayıt başarısız. Sunucu bağlantısını kontrol edip tekrar deneyin.');}
});

function updateStatus(){const connected=live.status==='connected';$('connection-message').textContent=live.message||'Yayın bağlantısı bekleniyor';$('enter').hidden=!connected;$('connect').disabled=live.status==='connecting';$('connect').innerHTML=live.status==='connecting'?'Bağlanıyor…':`<i data-lucide="radio"></i> ${connected?'Hesabı değiştir':'Yayına bağlan'}`;icons();$('live-status').replaceChildren();const dot=document.createElement('span');dot.className='dot'+(connected?' connected':'');$('live-status').append(dot,document.createTextNode(demo&&active?'DENEME MODU':connected?`CANLI · @${live.username}`:'BAĞLI DEĞİL'));if(active&&!demo&&!connected)pause(true);}

function eventMessage(data){
  const p=document.createElement('p');
  const descriptions={gift:`${data.gift} × ${data.count}`,like:`${data.count} beğeni`,follow:'takip etti',member:'yayına katıldı'};
  p.textContent=`@${data.username} · ${descriptions[data.event]||'katıldı'}`;
  $('events').prepend(p);
  while($('events').children.length>4)$('events').lastChild.remove();
  setTimeout(()=>p.remove(),10000);
  if(data.event==='follow'||data.event==='like'){
    if(active){
      socialActions.accept(data,{followEnabled,followDistance,likeEnabled,likeThreshold,likeDistance,followBackwardEnabled,followBackwardDistance,likeBackwardEnabled,likeBackwardDistance});
      processSocialQueue();
    }
  }else if(data.event==='gift'){
    const clean=value=>String(value||'').trim().toLocaleLowerCase('tr-TR'),gift=catalog.find(g=>String(g.id)===String(data.giftId))||catalog.find(g=>[g.name,g.trName].some(n=>clean(n)===clean(data.gift)));
    const key=Object.keys(EFFECTS).find(k=>String(effectConfig[k].giftId)===String(data.giftId||gift?.id));
    if(key)runEffect(key,data.username,Number(data.count||1));
  }
}

async function session(){try{const res=await fetch('/api/session');if(!res.ok)throw Error();const data=await res.json();token=data.token;live=data.live;updateStatus();socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/live?token=${encodeURIComponent(token)}`);socket.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='status'){live=d;updateStatus();}if(d.type==='event')eventMessage(d);};socket.onclose=()=>{live={status:'disconnected',message:'Oyun sunucusuna yeniden bağlanılıyor…'};updateStatus();clearTimeout(reconnectTimer);reconnectTimer=setTimeout(session,2000);};}catch{live={status:'error',message:'Oyun sunucusuna ulaşılamıyor.'};updateStatus();reconnectTimer=setTimeout(session,3000);}}session();

$('connect-form').onsubmit=async e=>{e.preventDefault();soundSetup();persist();if(!token){$('connection-message').textContent='Sunucu bağlantısı henüz hazır değil.';return;}live={...live,status:'connecting',message:'Canlı yayın aranıyor…'};updateStatus();try{const r=await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':token},body:JSON.stringify({username:$('username').value})});if(!r.ok)throw Error();}catch{live={status:'error',message:'Bağlantı başlatılamadı. Tekrar dene.'};updateStatus();}};

async function ensureCatalog(){if(catalog.length)return true;try{const res=await fetch('/api/catalog');if(!res.ok)throw Error();catalog=await res.json();return true;}catch{return false;}}
function giftFor(key){return catalog.find(g=>String(g.id)===String(effectConfig[key].giftId));}

function renderEffectSettings(){
  const host=$('effect-settings');host.replaceChildren();
  for(const [key,item] of Object.entries(EFFECTS).filter(([,v])=>v.type===effectTab)){
    const gift=giftFor(key),row=document.createElement('div');
    row.className=`effect-row ${item.type}`;
    const isSec=item.unit.includes('sn');
    const isWin=item.unit.includes('Win');
    const unitLabel=isWin?'WIN':isSec?'SANİYE':'METRE';
    const unitClass=isWin?'win':isSec?'saniye':'metre';
    row.innerHTML=`<div class="effect-title"><span class="effect-icon">${item.icon}</span><span><b>${item.name}</b><small>${item.detail}</small></span></div><button class="gift-pick" data-pick="${key}"><img src="${gift?.image||''}" alt=""><span>${gift?.trName||gift?.name||'Hediye seç'}</span></button><label class="effect-value"><input data-range="${key}" type="range" min="${item.min}" max="${item.max}" value="${effectConfig[key].value}"><span class="number-wrap"><input data-number="${key}" type="number" min="${item.min}" max="${item.max}" value="${effectConfig[key].value}" inputmode="numeric"><span class="unit-badge ${unitClass}">${unitLabel}</span></span></label><button class="effect-test" data-test="${key}" title="Efekti test et" aria-label="${item.name} efektini test et"><i data-lucide="play"></i></button>`;
    host.append(row);
  }
  host.querySelectorAll('[data-pick]').forEach(b=>b.onclick=async()=>{giftTarget=b.dataset.pick;$('search').value='';$('interactions').close();$('catalog').showModal();$('gifts').textContent='Katalog yükleniyor…';if(await ensureCatalog())renderCatalog();});
  const setValue=(key,raw)=>{const item=EFFECTS[key],value=Math.max(item.min,Math.min(item.max,Math.round(Number(raw)||item.min)));effectConfig[key].value=value;host.querySelector(`[data-range="${key}"]`).value=value;host.querySelector(`[data-number="${key}"]`).value=value;persist();};
  host.querySelectorAll('[data-range]').forEach(input=>input.oninput=()=>setValue(input.dataset.range,input.value));
  host.querySelectorAll('[data-number]').forEach(input=>{input.oninput=()=>setValue(input.dataset.number,input.value);input.onblur=()=>setValue(input.dataset.number,input.value);});
  host.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>{if(!active)enter(true);$('interactions').close();runEffect(b.dataset.test,'Yerel test');});
  icons();
}

function renderCatalog(){const q=$('search').value.toLocaleLowerCase('tr-TR');const matches=catalog.filter(g=>`${g.trName} ${g.name} ${g.coins}`.toLocaleLowerCase('tr-TR').includes(q));$('gifts').replaceChildren();for(const item of matches){const card=document.createElement('div');card.className='gift';card.tabIndex=0;const img=new Image();img.src=item.image;img.loading='lazy';img.alt=item.trName||item.name;img.onerror=()=>{img.hidden=true;};const b=document.createElement('b');b.textContent=item.trName||item.name;const small=document.createElement('small');small.textContent=`${item.coins} coin`;card.append(img,b,small);const choose=()=>{if(!giftTarget)return;effectConfig[giftTarget].giftId=String(item.id);persist();$('catalog').close();$('interactions').showModal();renderEffectSettings();giftTarget='';};card.onclick=choose;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};$('gifts').append(card);}if(!matches.length)$('gifts').textContent='Hediye bulunamadı.';$('catalog-count').textContent=`(${matches.length})`;}
$('catalog-open').onclick=async()=>{giftTarget='';$('catalog').showModal();world.pause(true);$('gifts').textContent='Katalog yükleniyor…';if(await ensureCatalog())renderCatalog();else $('gifts').textContent='Katalog yüklenemedi. Tekrar açmayı dene.';};$('search').oninput=renderCatalog;
$('interactions-open').onclick=async()=>{$('settings').close();$('interactions').showModal();await ensureCatalog();renderEffectSettings();};document.querySelectorAll('[data-effect-tab]').forEach(b=>b.onclick=()=>{effectTab=b.dataset.effectTab;document.querySelectorAll('[data-effect-tab]').forEach(x=>x.classList.toggle('active',x===b));renderEffectSettings();});$('effects-reset').onclick=()=>{effectConfig=Object.fromEntries(Object.entries(EFFECTS).map(([key,item])=>[key,{giftId:item.giftId,value:item.value}]));persist();renderEffectSettings();};ensureCatalog();
window.runEffect = runEffect;
window.world = world;
window.triggerFinishCelebration = triggerFinishCelebration;
window.triggerClash = triggerClash;
window.jump = jump;

$('view-gift-template')?.addEventListener('click',()=>{$('gift-template-dialog')?.showModal();icons();});
$('gift-template-nav-btn')?.addEventListener('click',()=>{$('gift-template-dialog')?.showModal();icons();});
