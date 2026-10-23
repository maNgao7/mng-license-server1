import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Avatars,avatarFrom,validAvatarUrl} from '../lib/avatars.mjs';
import {normalize} from '../lib/events.mjs';
import {Spectators} from '../lib/spectators.mjs';

test('Avatar identity prefers a large source and rejects private, credentialed and unrelated URLs',()=>{
  const large='https://p16.tiktokcdn.com/large.jpg',thumb='https://p16.tiktokcdn.com/thumb.webp';
  assert.equal(avatarFrom({avatarLarger:{urlList:[large]},avatarThumb:{urlList:[thumb]}}),large);
  assert.equal(avatarFrom({avatarLarger:{urlList:[thumb]},avatarThumb:{urlList:[large]}}),thumb);
  assert.equal(normalize('member',{user:{uniqueId:'viewer',avatarLarge:{urlList:[large]}}}).avatar,large);
  for(const url of ['http://p16.tiktokcdn.com/a.png','https://127.0.0.1/a.png','https://tiktokcdn.com.evil.test/a.png','https://user:secret@p16.tiktokcdn.com/a.png','https://p16.tiktokcdn.com:444/a.png'])assert.equal(validAvatarUrl(url),false);
});
test('WebP becomes a crisp round PNG, repeated requests coalesce and avatar fetches are bounded',async()=>{
  const source=await sharp({create:{width:640,height:640,channels:3,background:{r:210,g:80,b:30}}}).webp().toBuffer();let requests=0;
  const avatars=new Avatars({limit:3,fetcher:async()=>{requests++;return new Response(source,{headers:{'content-type':'image/webp'}});}});
  const url='https://p16.tiktokcdn.com/profile.webp',path=avatars.remember(url),key=path.split('/').pop().replace('.png','');
  const [first,second]=await Promise.all([avatars.load(key),avatars.load(key)]);assert.ok(first.equals(second));assert.equal(requests,1);
  const {data,info}=await sharp(first).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,256);assert.equal(info.channels,4);assert.equal(data[3],0);assert.equal(data[(128*256+128)*4+3],255);assert.ok(data[(128*256+128)*4]>180);
  assert.equal(avatars.remember('https://private.invalid/a.png'),'');assert.equal(await avatars.load('missing'),null);
  const crowd=new Spectators({avatars});crowd.accept(normalize('member',{user:{uniqueId:'viewer',avatarLarge:{urlList:[url]}}}));assert.equal(crowd.snapshot()[0].avatar,path);
  for(let i=0;i<5;i++)avatars.remember('https://p16.tiktokcdn.com/'+i+'.png');assert.equal(avatars.entries.size,3);
});
test('Non-image and oversized avatar responses fail closed without retaining an active worker',async()=>{
  for(const headers of [{'content-type':'text/html'},{'content-type':'image/png','content-length':'5000000'}]){
    const avatars=new Avatars({fetcher:async()=>new Response('not an image',{headers})});const path=avatars.remember('https://p16.tiktokcdn.com/a.png'),key=path.split('/').pop().replace('.png','');assert.equal(await avatars.load(key),null);assert.equal(avatars.active,0);
  }
});
