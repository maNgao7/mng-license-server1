import {test} from 'node:test';
import assert from 'node:assert/strict';
import './public/collision.js';
const {RoundGate,contact,separate}=globalThis.OrbitCollision;
const radius=mass=>19+Math.sqrt(mass)*5.5;
const player=(mass,x=0)=>({mass,x,y:0,vx:0,vy:0});
test('equal mass collides and splits at the visible edge',()=>assert.equal(contact(player(250),player(250,200),radius,1.2).kind,'split'));
test('the former 1.16 to 1.2 ratio gap also splits',()=>assert.equal(contact(player(118),player(100,50),radius,1.2).kind,'split'));
test('larger consumes smaller with only two participants',()=>assert.equal(contact(player(1000),player(100,100),radius,1.2).kind,'eat'));
test('non-overlapping players never consume',()=>assert.equal(contact(player(1000),player(100,1000),radius,1.2).kind,'none'));
test('protected coincident players separate without NaN or passing through',()=>{
 const a=player(100),b=player(100);separate(a,b,radius);
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(b.x));assert.ok(Math.abs(a.x-b.x)>=radius(100)*1.95);
});
test('five starts movement, falling below five never pauses a round',()=>{
 const gate=new RoundGate();
 for(let count=0;count<5;count++)assert.equal(gate.advance(count,5),false);
 assert.equal(gate.advance(5,5),true);
 for(let count=4;count>=1;count--)assert.equal(gate.advance(count,5),true);
 gate.reset();assert.equal(gate.advance(4,5),false);
});
test('the start count can be changed before the round',()=>{
 const gate=new RoundGate();assert.equal(gate.advance(4,8),false);
 assert.equal(gate.advance(4,3),true);
});
