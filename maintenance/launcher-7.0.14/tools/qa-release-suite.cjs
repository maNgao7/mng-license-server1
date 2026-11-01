'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out='D:/TikMnG-QA-Delivery/7.0.0';
fs.mkdirSync(out,{recursive:true});
const log=fs.createWriteStream(path.join(out,'launcher-full-suite.log'));
const tests=fs.readdirSync(path.join(root,'tests')).filter(file=>file.endsWith('.test.cjs')).map(file=>'tests/'+file);
const child=spawn(process.execPath,['--test','--test-concurrency=2',...tests],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let summary='';
function record(chunk){log.write(chunk);summary=(summary+chunk.toString()).slice(-18000);}
child.stdout.on('data',record);child.stderr.on('data',record);
const timer=setTimeout(()=>child.kill(),10*60000);
child.on('close',code=>{clearTimeout(timer);log.end();console.log(summary.slice(-5000));console.log('Full log: '+path.join(out,'launcher-full-suite.log'));process.exitCode=code===0?0:1;});
