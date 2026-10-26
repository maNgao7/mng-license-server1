import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../plugin/DisplayMenu.cs',import.meta.url),'utf8');
function body(name){
  const start=source.indexOf('{',source.indexOf(`void ${name}(`));
  assert.ok(start>=0,`${name} exists`);
  let depth=1,end=start+1;
  for(;depth&&end<source.length;end++)depth+=Number(source[end]==='{')-Number(source[end]==='}');
  assert.equal(depth,0);
  return source.slice(start+1,end-1);
}
function harness(){
  const calls=[];
  const context=vm.createContext({
    savedWindowDisplay:null,savedWindowUntil:0,savedWindowNext:0,savedWindowRetries:0,
    displayConfirmUntil:0,displaySaving:false,displaySignature:'',displayDraft:null,
    Time:{unscaledTime:2},Screen:{fullScreenMode:'fullscreen',fullScreen:true},
    FullScreenMode:{Windowed:'windowed',ExclusiveFullScreen:'fullscreen',FullScreenWindow:'borderless'},JsonUtility:{ToJson:JSON.stringify},
    CopyDisplay:structuredClone,SetDisplay:value=>calls.push(['display',structuredClone(value)]),
    SetDisplayResolution:(value,mode)=>calls.push(['resolution',structuredClone(value),mode]),
  });
  // Execute the production branch bodies with Unity's clock/screen replaced by fakes.
  vm.runInContext(`function RetrySavedWindow(){${body('RetrySavedWindow').replace('var wanted=','let wanted=')}}
    function ApplySavedDisplay(value){${body('ApplySavedDisplay').replace('string signature=','let signature=')}}`,context);
  const settings={configured:true,mode:'windowed',width:1280,height:720,quality:2,vSync:0,frameLimit:90};
  return {context,calls,settings,apply:()=>context.ApplySavedDisplay(settings)};
}

test('windowed resolution leaves room for window borders without shrinking fullscreen',()=>{
  const calls=[];
  const context=vm.createContext({
    Mathf:{Clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),Min:Math.min,Max:Math.max},
    Screen:{currentResolution:{width:1920,height:1080},SetResolution:(...args)=>calls.push(args)},
    FullScreenMode:{Windowed:'windowed'},
  });
  vm.runInContext(`function SetDisplayResolution(value,mode){${body('SetDisplayResolution').replace('int width=','let width=')}}`,context);
  context.SetDisplayResolution({width:1920,height:1080},'windowed');
  assert.deepEqual(calls.pop(),[1840,980,'windowed']);
  context.SetDisplayResolution({width:1280,height:720},'windowed');
  assert.deepEqual(calls.pop(),[1280,720,'windowed']);
  context.SetDisplayResolution({width:1920,height:1080},'borderless');
  assert.deepEqual(calls.pop(),[1920,1080,'borderless']);
});

test('saved window mode recovers a later fullscreen override without reapplying graphics',()=>{
  const h=harness();h.apply();
  h.context.Screen={fullScreenMode:'windowed',fullScreen:false};
  h.context.Time.unscaledTime=3;h.apply();assert.equal(h.calls.length,1);
  h.context.Screen={fullScreenMode:'fullscreen',fullScreen:true};
  h.context.Time.unscaledTime=3.5;h.apply();assert.equal(h.calls.length,1);
  h.context.Time.unscaledTime=4;h.apply();
  assert.equal(h.calls.length,2);assert.equal(h.calls[1][0],'resolution');
  assert.equal(h.calls[1][2],'windowed');assert.deepEqual(h.calls[1][1],h.settings);
  assert.deepEqual(h.settings,{configured:true,mode:'windowed',width:1280,height:720,quality:2,vSync:0,frameLimit:90});
});

test('display recovery stops after eight retries and cannot restart from the same signature',()=>{
  const h=harness();h.apply();
  for(let now=3;now<=30;now+=.25){h.context.Time.unscaledTime=now;h.apply();}
  assert.equal(h.calls.length,9);assert.equal(h.context.savedWindowDisplay,null);
});

test('display recovery expires after twenty seconds even following a long frame',()=>{
  const h=harness();h.apply();h.context.Time.unscaledTime=22;h.apply();
  assert.equal(h.calls.length,1);assert.equal(h.context.savedWindowDisplay,null);
});

test('all saved display modes recover overrides; unconfigured settings and preview guards cancel recovery',()=>{
  for(const mode of ['fullscreen','borderless']){
    const h=harness();h.settings.mode=mode;h.apply();h.context.Screen.fullScreenMode='windowed';h.context.Time.unscaledTime=3;h.apply();
    assert.equal(h.calls.length,2);assert.equal(h.calls[1][2],mode);
  }
  for(const guard of ['displayConfirmUntil','displaySaving']){
    const h=harness();h.apply();h.context[guard]=1;h.context.Time.unscaledTime=3;h.apply();
    assert.equal(h.calls.length,1);
  }
  const h=harness();h.apply();h.settings.configured=false;h.apply();
  assert.equal(h.context.savedWindowDisplay,null);
});

test('preview and rollback cancel startup recovery before changing graphics',()=>{
  assert.ok(body('BeginDisplayPreview').indexOf('savedWindowDisplay=null;')<body('BeginDisplayPreview').indexOf('displayBackup=CaptureDisplay()'));
  assert.ok(body('RollbackDisplay').indexOf('savedWindowDisplay=null;')<body('RollbackDisplay').indexOf('SetDisplay(displayBackup,backupMode)'));
});
