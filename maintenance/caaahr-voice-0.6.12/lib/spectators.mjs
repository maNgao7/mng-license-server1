export class Spectators {
  constructor({now=Date.now,limit=132,ttl=15*60*1000,avatars}={}){Object.assign(this,{now,limit,ttl,avatars});this.users=new Map();this.session='';}
  accept(event){
    if(event.type==='connection'){if(event.session!==this.session||['disconnected','error'].includes(event.state)){this.users.clear();this.session=event.session||'';}return;}
    if(!['member','gift','chat','like','follow'].includes(event.type)||!event.username)return;
    const key=event.username.toLowerCase(),previous=this.users.get(key);
    this.users.set(key,{username:event.username,avatar:this.avatars?.remember(event.avatar)||previous?.avatar||'',seen:this.now(),reacted:['gift','like'].includes(event.type)?this.now():previous?.reacted??0});
    while(this.users.size>this.limit)this.users.delete(this.users.keys().next().value);
  }
  snapshot(){const now=this.now();for(const [id,user] of this.users)if(now-user.seen>this.ttl)this.users.delete(id);return [...this.users.values()].map(user=>({username:user.username,avatar:user.avatar,cheering:now-user.reacted<4000}));}
}
