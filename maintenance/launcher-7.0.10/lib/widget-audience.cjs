'use strict';
function createWidgetAudience({max=5000}={}){
    const rooms=new Map();
    function observe(channel,type,item){
        if(!['chat','like'].includes(type))return;
        const username=String(item.username||'').replace(/^@/,'').trim().toLowerCase();if(!/^[a-z0-9_.]{1,64}$/.test(username))return;
        let room=rooms.get(channel);if(!room){room=new Map();rooms.set(channel,room);if(rooms.size>16)rooms.delete(rooms.keys().next().value);}
        const old=room.get(username)||{username,totalLikes:0,commented:false};
        const row={...old,nickname:String(item.nickname||old.nickname||username),avatar:String(item.avatar||old.avatar||''),commented:old.commented||type==='chat',totalLikes:old.totalLikes+(type==='like'?Math.max(1,Number(item.likeCount||item.count)||1):0)};
        room.set(username,row);while(room.size>max)room.delete(room.keys().next().value);
    }
    return {observe,rows:channel=>[...(rooms.get(channel)?.values()||[])],reset:channel=>rooms.delete(channel)};
}
module.exports={createWidgetAudience};
