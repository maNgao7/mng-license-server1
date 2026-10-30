'use strict';
const PREFIXES=new Set(['.','_','/',':','!']);
const BAD_WORDS=['amk','aq','amına','aminakoy','amına koy','siktir','sikeyim','sikerim','sikik','orospu','orosp','oç','oc','piç','pic','yarrak','yarak','götveren','gotveren','ibne','pezevenk'];
const fold=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('tr').replace(/[ıİ]/g,'i').normalize('NFD').replace(/\p{M}/gu,'');
function containsBlocked(text,settings={}){
  const words=[...(settings.profanityFilter===false?[]:BAD_WORDS),...String(settings.blockedWords||'').split(/[,\n;]/).map(s=>s.trim()).filter(Boolean)];
  const normalized=fold(text).replace(/[013457@$]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s'}[c]));
  const tokens=normalized.match(/[\p{L}\p{N}]+/gu)||[],joined=tokens.join('');
  return words.some(word=>{const key=fold(word),parts=key.match(/[\p{L}\p{N}]+/gu)||[];if(!parts.length)return false;
    const separatedShort=key.length<=3&&tokens.some((_,i)=>tokens.slice(i,i+key.length).length===key.length&&tokens.slice(i,i+key.length).every(t=>t.length===1)&&tokens.slice(i,i+key.length).join('')===key);
    return key.length<=3?tokens.includes(key)||separatedShort:normalized.includes(key)||joined.includes(parts.join(''));});
}
function prepareSpeechMessage(raw,settings={}){
  let text=String(raw||'').normalize('NFKC').trim();
  if(settings.prefixEnabled){const prefix=PREFIXES.has(settings.messagePrefix)?settings.messagePrefix:'.';if(!text.startsWith(prefix))return '';text=text.slice(prefix.length).trim();}
  else if(text.startsWith('!'))return '';
  text=text.replace(/https?:\/\/\S+/gi,'').replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g,'').trim();
  if(!text||containsBlocked(text,settings))return '';
  return text.slice(0,Math.max(20,Math.min(500,Number(settings.maxLength)||180)));
}
module.exports={PREFIXES,containsBlocked,prepareSpeechMessage};
