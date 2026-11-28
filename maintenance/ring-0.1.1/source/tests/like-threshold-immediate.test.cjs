'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createHediyeBoxLive,sharedModules}=require('../src/live-client.cjs');
const {AudienceQueue}=require('../src/audience-queue.cjs');
class Connection extends EventEmitter{
 isConnected=false;
 async connect(){this.isConnected=true;return{roomId:'123456',isConnected:true};}
 disconnect(){this.isConnected=false;}
}
for(const [threshold,punchCount] of [...[1,5,10,100,200].map(n=>[n,1]),[100,2],[7,100]])test(threshold+' likes dispatch '+punchCount+' punches per threshold, without streak completion or a timer',async()=>{
 const connection=new Connection(),commands=[];
 const queue=new AudienceQueue({kingOfRing:true,settings:{punchSource:'all',likeThreshold:threshold,likePunchCount:punchCount,likeDamage:10},onPunch:command=>commands.push(command)});
 const live=createHediyeBoxLive({env:{},shared:{...sharedModules(),detectOwner:async()=>[]},createConnection:async()=>connection,
  onChat:event=>queue.ingestChat(event),onLike:event=>queue.ingestLike(event)});
 const user={id:'11',uniqueId:'participant',nickname:'Participant'};
 try{
  await live.start('host');
  connection.emit('chat',{msgId:'join1',user,comment:'katıl'});
  connection.emit('chat',{msgId:'join2',user:{id:'22',uniqueId:'opponent'},comment:'katil'});
  assert.equal(queue.startRound().accepted,true);
  let total=0,seq=0;
  for(const delta of [Math.max(0,threshold-1),1,threshold,threshold*2+1].filter(Boolean)){
   const before=Math.floor(total/threshold);
   const event={common:{msgId:'like-'+(++seq)},user,likeCount:delta};
   connection.emit('like',event);total+=delta;
   const dispatched=commands.reduce((sum,command)=>sum+command.count,0);
   assert.equal(dispatched,Math.floor(total/threshold)*punchCount,'Dispatch must be synchronous with the incoming delta');
   assert.ok(commands.every(command=>command.side==='right'&&command.damage===10));
   if(Math.floor(total/threshold)>before)assert.ok(commands.at(-1).count>=1);
   connection.emit('like',event);
   assert.equal(commands.reduce((sum,command)=>sum+command.count,0),dispatched,'Duplicate packets cannot create punches');
  }
 }finally{live.close();}
});
