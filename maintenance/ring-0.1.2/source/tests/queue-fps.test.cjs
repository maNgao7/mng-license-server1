'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {AudienceQueue}=require('../src/audience-queue.cjs');
const {widgetSnapshot}=require('../src/widgets/snapshot.cjs');
let sequence=0;
const event=(name,extra={})=>({userId:name,uniqueId:name,nickname:name,eventId:'queue-fps-'+(++sequence),...extra});
function fixture(settings={}){
 const q=new AudienceQueue({kingOfRing:true,settings:{followJoin:true,likeJoin:true,likeJoinThreshold:100,...settings}});
 q.ingestChat(event('red',{comment:'katıl'}));q.ingestChat(event('blue',{comment:'katıl'}));return q;
}
test('queue adds one FPS per 100 personal likes, five once per follow, and zero for a new join comment',()=>{
 const q=fixture();
 q.ingestChat(event('commenter',{comment:'KATIL'}));
 q.ingestFollow(event('follower'));
 q.ingestChat(event('liker',{comment:'katil'}));
 const before=q.snapshot();assert.equal(before.queue.find(u=>u.userId==='commenter').fps,0);
 const a=event('liker',{likeCount:99,isDelta:true});
 assert.equal(q.ingestLike(a).addedFps,0);assert.equal(q.ingestLike(a).reason,'duplicate-event');
 assert.equal(q.ingestLike(event('liker',{likeCount:1,isDelta:true})).addedFps,1);
 q.ingestLike(event('liker',{likeCount:500,isDelta:true}));
 assert.deepEqual(q.snapshot().queue.map(u=>[u.userId,u.fps]),[['liker',6],['follower',5],['commenter',0]]);
 assert.ok(q.snapshot().queue.every(u=>u.coins===0),'Free interaction FPS must not become gift coins');
 assert.equal(q.ingestFollow(event('follower')).addedFps,0,'Unfollow/refollow packets cannot farm five points');
 q.ingestGift(event('commenter',{giftId:'5655',coinUnit:1,repeatCount:10}));
 assert.deepEqual(q.snapshot().queue.map(u=>[u.userId,u.fps]),[['commenter',10],['liker',6],['follower',5]]);
});
test('rank remainders and punch remainders stay independent through settings and rounds',()=>{
 const q=fixture({punchSource:'all',likeThreshold:5,likePunchCount:1,likeDamage:10});q.startRound();
 let r=q.ingestLike(event('red',{likeCount:99,isDelta:true}));
 assert.equal(r.addedFps,0);assert.equal(r.actions[0].count,19);assert.equal(r.actions[0].damage,10);
 q.configure({likeThreshold:200});r=q.ingestLike(event('red',{likeCount:1,isDelta:true}));
 assert.equal(r.addedFps,1);assert.equal(r.actions.length,0);
 q.ingestChat(event('challenger',{comment:'katıl'}));
 q.finishRound('right');assert.equal(q.startRound().accepted,true);
 r=q.ingestLike(event('red',{likeCount:100,isDelta:true}));
 assert.equal(r.addedFps,1);assert.equal(q.snapshot().active.right.fps,2);
});
test('like entry awards the first hundred and identity promotion preserves the rank remainder',()=>{
 const q=fixture();
 q.ingestLike({uniqueId:'liker',eventId:'handle-like-99',likeCount:99,isDelta:true});
 const joined=q.ingestLike(event('liker',{likeCount:1,isDelta:true}));
 assert.equal(joined.joined,true);assert.equal(joined.addedFps,1);
 assert.equal(q.snapshot().queue[0].fps,1);
 for(const extra of [{isInitial:true},{isReplay:true},{isTest:true},{isDelta:false}])q.ingestLike(event('liker',{likeCount:100,isDelta:true,...extra}));
 assert.equal(q.snapshot().queue[0].fps,1);
 q.ingestFollow(event('liker',{isTest:true}));assert.equal(q.snapshot().queue[0].fps,1);
 const widget=widgetSnapshot({audience:q.snapshot()});assert.equal(widget.queue.rows[0].coins,1);
});

test('independent viewers, stable ties and large packets retain exact FPS without granting bonus coins',()=>{
 const q=fixture();
 for(const name of ['first','second'])q.ingestChat(event(name,{comment:'katıl'}));
 q.ingestLike(event('first',{likeCount:99}));q.ingestLike(event('second',{likeCount:100}));
 assert.equal(q.snapshot().queue[0].userId,'second');
 q.ingestLike(event('first',{likeCount:1}));
 assert.deepEqual(q.snapshot().queue.map(u=>[u.userId,u.fps]),[['first',1],['second',1]]);
 const huge=Number.MAX_SAFE_INTEGER;
 q.ingestLike(event('first',{likeCount:huge}));
 q.ingestLike(event('first',{likeCount:9}));
 assert.equal(q.snapshot().queue[0].fps,1+Math.floor(huge/100)+1);
 assert.equal(q.snapshot().queue[0].coins,0);
 q.ingestFollow(event('first'));q.ingestFollow(event('first'));
 assert.equal(q.snapshot().queue[0].followFps,5);
});
