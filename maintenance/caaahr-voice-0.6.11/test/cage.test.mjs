import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../plugin/CageCountdown.cs',import.meta.url),'utf8');
const start=source.indexOf('{',source.indexOf('string ReduceCageTime('));
let depth=1,end=start+1;
for(;depth&&end<source.length;end++)depth+=Number(source[end]==='{')-Number(source[end]==='}');
const body=source.slice(start+1,end-1).replaceAll('.ToString("0.#")','.toString()');
function cage(seconds){
  const data={cage:true,jailUntil:100+seconds,Time:{unscaledTime:100},Mathf:{Max:Math.max,CeilToInt:Math.ceil}};
  Object.defineProperty(data,'CageSeconds',{get:()=>Math.max(0,data.jailUntil-data.Time.unscaledTime)});
  Object.defineProperty(data,'Jailed',{get:()=>data.CageSeconds>0});
  data.ReleaseCage=()=>{data.cage=false;};
  const context=vm.createContext(data);vm.runInContext(`function reduce(seconds){${body}}`,context);return context;
}
test('release subtracts configured seconds without opening a partially served cage',()=>{
  const state=cage(20);state.reduce(5);assert.equal(state.CageSeconds,15);assert.equal(state.cage,true);
  state.reduce(3);assert.equal(state.CageSeconds,12);assert.equal(state.cage,true);
});
test('release opens at zero, clamps overflow and does not affect an already free car',()=>{
  const state=cage(5);state.reduce(5);assert.equal(state.CageSeconds,0);assert.equal(state.cage,false);
  state.reduce(120);assert.equal(state.CageSeconds,0);assert.equal(state.cage,false);
  const overflow=cage(3);overflow.reduce(120);assert.equal(overflow.CageSeconds,0);assert.equal(overflow.cage,false);
});
