'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {WinStandings}=require('../src/win-standings.cjs');

test('wins survive reopening, merge a handle-only winner and tolerate damaged saves',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'box-wins-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'wins.json');
  const wins=new WinStandings(file);
  wins.record({uniqueId:'Deniz'});
  wins.record({userId:'42',uniqueId:'deniz'});
  const reopened=new WinStandings(file);
  assert.deepEqual(reopened.top,[{id:'42',label:'@deniz',wins:2}]);
  reopened.record({userId:'42',uniqueId:'denizyeni'});
  assert.deepEqual(reopened.top,[{id:'42',label:'@denizyeni',wins:3}]);
  reopened.reset();
  assert.deepEqual(new WinStandings(file).top,[]);
  assert.deepEqual(reopened.top,[]);
  fs.writeFileSync(file,'{');
  assert.deepEqual(new WinStandings(file).top,[]);
});
