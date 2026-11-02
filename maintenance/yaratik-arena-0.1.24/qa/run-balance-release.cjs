'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const settings = path.join(root, 'userdata/mod-settings.json');
const original = fs.readFileSync(settings);
process.env.TIKMNG_ARENA_QA_ROOT = path.join(root, 'qa');
process.env.TIKMNG_QA_VERSION = '0.1.24';
const q = require('./commands.cjs');
let game;
async function suite(name) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(__dirname, name)], {cwd:path.join(root,'qa'),env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output = ''; for (const s of [c.stdout,c.stderr]) s.on('data', b => output += b);
    c.on('error',reject); c.on('exit',code => { fs.writeFileSync(path.join(__dirname,name+'.log'),output); console.log(name+': '+(code===0?'PASS':'FAIL')); code===0?resolve():reject(new Error(output)); });
  });
}
(async () => {
  try {
    game = spawn(path.join(root,"game/Can 'Em All Demo.exe"), [], {cwd:path.join(root,'game'),windowsHide:false,stdio:'ignore'});
    game.on('error',e => console.error(e));
    await q.wait(s => s.ready && s.version === '0.1.24' && s.processId === game.pid, 'Fresh native process', 45000);
    for (const name of ['balance-native-tests.cjs','ammo-native-tests.cjs','pursuit-tests.cjs','final-event-tests.cjs']) await suite(name);
  } finally {
    try { await q.send('quit'); } catch {}
    if (game && game.exitCode === null) await new Promise((resolve,reject) => {game.once('exit',resolve);setTimeout(()=>reject(new Error('Game did not exit')),15000).unref();});
    fs.writeFileSync(settings, original);
  }
})().catch(e => {console.error(e);process.exitCode=1;});
