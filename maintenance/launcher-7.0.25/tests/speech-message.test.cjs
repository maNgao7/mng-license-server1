const test=require('node:test'),assert=require('node:assert/strict');
const {prepareSpeechMessage,containsBlocked}=require('../lib/speech-message.cjs');
test('Each supported prefix gates speech and is stripped exactly once',()=>{
  for(const p of ['.','_','/',':','!']){const s={prefixEnabled:true,messagePrefix:p};assert.equal(prepareSpeechMessage('Merhaba',s),'');assert.equal(prepareSpeechMessage(p+' Merhaba iyi yayınlar',s),'Merhaba iyi yayınlar');assert.equal(prepareSpeechMessage(p,s),'');}
  assert.equal(prepareSpeechMessage('Normal yorum'),'Normal yorum');assert.equal(prepareSpeechMessage('!komut'),'');
});
test('Profanity and configured words are rejected without rejecting normal Turkish words',()=>{
  for(const text of ['amk','SİKTİR','or0spu','orospu','piç','ya.r.rak'])assert.equal(prepareSpeechMessage('. '+text,{prefixEnabled:true,messagePrefix:'.'}),'');
  for(const text of ['Merhaba iyi yayınlar','Ocak ayında görüşürüz','Biraz açıklar mısın?'])assert.equal(containsBlocked(text),false);
  assert.equal(prepareSpeechMessage('Bu kelime engelli',{blockedWords:'engelli'}),'');
  assert.equal(prepareSpeechMessage('siktir',{profanityFilter:false}),'siktir');
});
