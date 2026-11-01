'use strict';
function collectProfiles(payload,known=new Map()){
 const seen=new Set();let visited=0;
 function walk(value,depth=0){if(!value||typeof value!=='object'||depth>8||seen.has(value)||++visited>3000)return;seen.add(value);
  const raw=value.id_str||value.userIdStr||value.userId||value.id,key=typeof raw==='number'&&!Number.isSafeInteger(raw)?'':String(raw||''),username=value.uniqueId||value.displayId||value.display_id||'',nickname=value.nickname||value.nickName||'';
  const photos=value.avatarLarge?.urlList||value.avatar_large?.url_list||value.avatarMedium?.urlList||value.avatar_medium?.url_list||value.avatarThumb?.urlList||value.avatar_thumb?.url_list||[],avatar=photos.find(x=>/^https:\/\//.test(x))||value.profilePictureUrl||'';
  if(/^[1-9]\d{0,24}$/.test(key)&&(username||nickname||avatar)){const old=known.get(key)||{};known.set(key,{id:key,username:username||old.username||'',nickname:nickname||old.nickname||'',avatar:avatar||old.avatar||''});}
  for(const [name,child]of Object.entries(value))if(!/armies|support|cookie|token|signature/i.test(name))walk(child,depth+1);
 }
 walk(payload);while(known.size>500)known.delete(known.keys().next().value);return known;
}
function anchors(known){return [...known.values()].map(row=>({key:row.id,value:{user:{userId:row.id,displayId:row.username,nickName:row.nickname,avatarLarge:{urlList:row.avatar?[row.avatar]:[]}}}}));}
module.exports={collectProfiles,anchors};
