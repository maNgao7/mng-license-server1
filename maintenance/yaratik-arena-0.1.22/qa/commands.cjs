'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=process.env.TIKMNG_ARENA_QA_ROOT||__dirname;
function state(){return JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));}
async function wait(predicate,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){try{const s=state();if(predicate(s))return s;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(label);}
async function send(op,extra={}){const file=path.join(root,'command.json'),temporary=file+'.tmp';let last=0;try{last=JSON.parse(fs.readFileSync(file,'utf8')).seq||0;}catch{}const seq=Math.max(state().seq||0,last)+1;fs.writeFileSync(temporary,JSON.stringify({seq,op,...extra}));for(let attempt=0;;attempt++){try{fs.renameSync(temporary,file);break;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=50)throw error;await new Promise(r=>setTimeout(r,20));}}const result=await wait(s=>s.seq===seq,'Command not acknowledged: '+op);if(op==='capture'){const end=Date.now()+10000;while(!fs.existsSync(path.join(root,'capture-'+seq+'.png'))){if(Date.now()>end)throw new Error('Screenshot not completed');await new Promise(r=>setTimeout(r,100));}}return result;}
module.exports={state,wait,send};
if(require.main===module)send(process.argv[2],JSON.parse(process.argv[3]||'{}')).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1;});
