'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const q=require('./commands.cjs'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(process.env.TIKMNG_ARENA_QA_ROOT||__dirname),data=path.resolve(root,'../userdata');
const settingsFile=path.join(data,'mod-settings.json'),commandFile=path.join(data,'live-command.json');
const checks=[],captures=[];let original,initial,expected,started=false;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const saved=()=>JSON.parse(fs.readFileSync(settingsFile,'utf8'));
async function bridgeTargetRegression(){
 const {EventEmitter}=require('node:events'),{createLiveSession}=require('../bridge/live-session.cjs');
 const settle=()=>new Promise(resolve=>setImmediate(resolve)),tasks=new Map(),calls=[];
 let now=1000,serial=0,secondAttempts=0,last;
 const timers={setTimeout(fn,delay){const id=++serial;tasks.set(id,{fn,at:now+delay});return id;},clearTimeout(id){tasks.delete(id);}};
 async function advance(milliseconds){
  const end=now+milliseconds;
  for(;;){const next=[...tasks].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();await settle();}
  now=end;await settle();
 }
 class Connection extends EventEmitter{
  constructor(name){super();this.name=name;this.isConnected=false;}
  async connect(){
   if(this.name==='qa_first')throw new Error('UserOfflineError: not online');
   secondAttempts++;if(secondAttempts===1)throw new Error('ECONNRESET');if(secondAttempts===2)throw new Error('UserOfflineError: not online');
   this.isConnected=true;return{roomId:'123456789'};
  }
  disconnect(){this.isConnected=false;return Promise.resolve();}
 }
 const session=createLiveSession({timers,clock:{now:()=>now},random:()=>.5,createConnection:async name=>{calls.push(name);return last=new Connection(name);}});
 try{
  await session.start('qa_first');assert.equal(session.status().status,'waiting');
  await session.start('qa_second');assert.equal(session.status().username,'qa_second');assert.equal(session.status().reason,'network');
  await advance(12000);
  assert.deepEqual(calls,['qa_first','qa_second','qa_second','qa_second']);assert.equal(session.status().status,'connected');
  last.emit('disconnected');await advance(2000);assert.equal(calls.at(-1),'qa_second');
  assert.equal(calls.filter(name=>name==='qa_first').length,1,'Replaced offline account must never be retried');
  last.emit('disconnected');session.stop();const count=calls.length;await advance(120000);
  assert.equal(calls.length,count);assert.equal(session.status().status,'disconnected');
  checks.push('Deterministic offline/network/transport retries use only the latest selected target; manual disconnect cancels every retry');
 }finally{session.close();}
}
function healthy(s){assert.equal(s.failed,false);assert.equal(s.hudError,'');}
async function report(){const s=await q.send('report');healthy(s);return s;}
async function waitFor(predicate,label,timeout=12000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){const s=await report();if(predicate(s))return s;await sleep(100);}
 throw new Error(label);
}
function otherSettings(value){const copy={...value};delete copy.BroadcasterUsername;delete copy.AutoConnect;return copy;}
function assertAccount(s,username,auto=true){
 assert.equal(s.savedBroadcasterUsername,username);assert.equal(s.AutoConnect,auto);
 const config=saved();assert.equal(config.BroadcasterUsername,username);assert.equal(config.AutoConnect,auto);
 assert.deepEqual(otherSettings(config),otherSettings(JSON.parse(original.toString('utf8'))),'Custom actions and all other settings must remain intact');
}
async function layout(width,height){
 await q.send('resolution',{width,height});await q.send('menu',{open:true,tab:0});await sleep(300);
 const s=await q.send('capture');healthy(s);assert.equal(s.menuRendered,true);
 const rects=['connectionUsernameBounds','connectionConnectBounds','connectionDisconnectBounds','connectionAccountBounds','connectionStatusBounds'].map(key=>({key,...s[key]}));
 for(const rect of rects){assert.ok(rect.width>0&&rect.height>0,rect.key);assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width&&rect.y+rect.height<=height,rect.key+' stays in viewport');}
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
  const a=rects[i],b=rects[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,a.key+' overlaps '+b.key);
 }
 captures.push({width,height,file:'capture-'+s.seq+'.png'});return s;
}
async function connect(username){
 await q.send('connection-edit',{username});await q.send('connection-connect');
 const normalized=username.trim().replace(/^@/,'');
 let s=await waitFor(s=>s.bridgeReady&&!s.liveConnectPending,'Bridge must receive the selected target');
 assertAccount(s,normalized);assert.equal(s.selectedBroadcaster,normalized);assert.equal(s.liveConnectionRequested,true);
 const command=JSON.parse(fs.readFileSync(commandFile,'utf8'));
 assert.equal(command.op,'connect');assert.equal(command.username,normalized);assert.equal(command.seq,s.liveCommandSequence);
 expected=saved();return s;
}
async function main(){
 assert.ok(process.env.TIKMNG_ARENA_QA_ROOT,'Use an explicitly selected isolated QA root');
 assert.notEqual(root.toLowerCase(),path.resolve(__dirname).toLowerCase(),'Desktop user settings must never be used by this test');
 const pid=Number(process.argv.find(arg=>/^\d+$/.test(arg))||0);
 initial=await q.wait(s=>s.ready&&s.version===(process.env.TIKMNG_QA_VERSION||'0.1.22')&&(!pid||s.processId===pid)&&Date.now()-fs.statSync(path.join(root,'state.json')).mtimeMs<2500,'Fresh 0.1.22 native engine',40000);
 original=fs.readFileSync(settingsFile);expected=saved();started=true;
 assert.equal(initial.savedBroadcasterUsername,expected.BroadcasterUsername);assert.equal(initial.AutoConnect,expected.AutoConnect);
 assert.equal(initial.accountSource,'game-settings-only');assert.equal(initial.launcherAccountIgnored,true);
 if(!expected.AutoConnect||!expected.BroadcasterUsername)assert.equal(initial.liveConnectionRequested,false,'A launcher account must not override an inactive or empty saved account');
 else assert.equal(initial.selectedBroadcaster,expected.BroadcasterUsername.replace(/^@/,''));
 checks.push('Original saved account and AutoConnect survive startup; launcher environment does not override them');
 await q.send('live-events-pause',{enabled:true});await q.send('lock',{enabled:true});
 let s=await layout(800,600);
 assert.equal(s.broadcasterDraft,expected.BroadcasterUsername);
 checks.push('At 800x600 the username, separate Connect/Disconnect buttons and active-account/status labels have non-overlapping bounds');
 const first=expected.BroadcasterUsername||'qa_arena_first',second=first==='qa_arena_second'?'qa_arena_third':'qa_arena_second';
 s=await connect(first);assert.equal(s.liveError,'');
 await q.send('connection-edit',{username:'@'+second});s=await layout(1280,720);
 assert.equal(s.broadcasterDraft,'@'+second);assertAccount(s,first);assert.equal(s.selectedBroadcaster,first);
 assert.equal(s.connectionConnectEnabled,true);assert.equal(s.connectionDisconnectEnabled,true);
 assert.ok(s.connectionAccountText.includes('@'+first),'Edited name must remain distinct from the active target');
 checks.push('Editing another name does not overwrite the saved/active account; both command buttons remain available');
 s=await connect('@'+second);
 assert.equal(s.selectedBroadcaster,second);assert.notEqual(s.selectedBroadcaster,first);
 const sequence=s.liveCommandSequence;
 await q.send('live-connect',{username:'https://tiktok.com/@invalid'});s=await report();
 assertAccount(s,second);assert.equal(s.selectedBroadcaster,second);assert.equal(s.liveCommandSequence,sequence);assert.equal(s.liveConnectionRequested,true);assert.ok(s.liveError.length>0);
 checks.push('Switching accounts sends one new connect command directly; invalid input never disconnects or changes that selected target');
 await q.send('live-disconnect');expected=saved();
 s=await waitFor(s=>!s.liveDisconnectPending,'Disconnect reaches a ready bridge');
 assertAccount(s,second,false);assert.equal(s.liveConnectionRequested,false);assert.equal(s.liveConnectPending,false);assert.equal(s.live.status,'disconnected');
 const disconnectedSeq=s.liveCommandSequence;
 await sleep(1800);s=await report();assert.equal(s.liveCommandSequence,disconnectedSeq);assert.equal(s.live.status,'disconnected');
 assert.equal(JSON.parse(fs.readFileSync(commandFile,'utf8')).op,'disconnect');
 s=await layout(800,600);assert.equal(s.connectionConnectEnabled,true);assert.equal(s.connectionDisconnectEnabled,false);
 checks.push('Manual disconnect cancels retry/queued connection, retains the last name, and leaves Connect enabled while Disconnect is disabled');
 await connect(second);s=await layout(1280,720);assert.equal(s.connectionConnectEnabled,true);assert.equal(s.connectionDisconnectEnabled,true);
 checks.push('The retained name reconnects directly; 1280x720 keeps both controls separate and readable');
}
async function restore(){
 if(!started)return;
 await q.send('menu',{open:false});
 assert.deepEqual(saved(),expected,'Concurrent isolated-settings modification detected; refusing to overwrite it');
 const before=JSON.parse(original.toString('utf8'));
 if(process.argv.includes('--leave-selected')){checks.push('Selected QA account intentionally retained for the host restart test');return;}
 if(before.BroadcasterUsername){
  await q.send('live-connect',{username:before.BroadcasterUsername});
  if(!before.AutoConnect)await q.send('live-disconnect');
 }else await q.send('live-disconnect',{clear:true});
 assert.deepEqual(saved(),before,'Every original setting must be restored');
 if(!fs.readFileSync(settingsFile).equals(original))fs.writeFileSync(settingsFile,original);
 assert.equal(digest(fs.readFileSync(settingsFile)),digest(original));
 await q.send('resolution',{width:initial.width,height:initial.height});
 await q.send('live-events-pause',{enabled:false});await q.send('lock',{enabled:false});
 checks.push('Original account, AutoConnect, all custom actions and exact settings bytes preserved');
}
(async()=>{
 if(process.argv.includes('--bridge-only')){await bridgeTargetRegression();console.log(JSON.stringify({passed:true,checks}));return;}
 await bridgeTargetRegression();
 let failure;try{await main();}catch(error){failure=error;}
 try{await restore();}catch(error){failure=failure?new AggregateError([failure,error],'Native check and settings restoration failed'):error;}
 const result={passed:!failure,checks,captures,settingsHash:original?digest(original):undefined,lastSaved:saved().BroadcasterUsername,error:failure?.stack};
 fs.writeFileSync(path.join(root,'connection-menu-hotfix-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(failure)process.exitCode=1;
})();
