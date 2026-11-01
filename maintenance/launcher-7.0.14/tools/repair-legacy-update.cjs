'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),asar=require('@electron/asar');
const arg=process.argv.find(v=>v.startsWith('--app='));if(!arg)throw Error('Explicit installed application directory is required');
const app=path.resolve(arg.slice(6)),resources=path.join(app,'resources');
assert.ok(fs.existsSync(path.join(app,'TikMnG.exe')),'Installed TikMnG executable required');
const version=JSON.parse(asar.extractFile(path.join(resources,'app.asar'),'package.json')).version;
assert.ok(['7.0.1','7.0.2'].includes(version),'Only affected legacy versions may be repaired');
const source=path.dirname(require.resolve('semver/package.json')),target=path.join(resources,'node_modules/semver');
assert.equal(require(path.join(source,'package.json')).version,'7.7.4');
if(fs.existsSync(target))assert.equal(require(path.join(target,'package.json')).version,'7.7.4','Existing different package is never replaced');
else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true,errorOnExist:true,force:false});}
assert.equal(require(target).gt('7.0.3','7.0.1'),true);
const files=fs.readdirSync(target);assert.ok(files.includes('LICENSE'));assert.ok(files.includes('index.js'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(path.join(target,'index.js')),hash(path.join(source,'index.js')));
console.log(JSON.stringify({repaired:true,version,module:'semver',moduleVersion:'7.7.4',onlyApplicationDependencyAdded:true,exeAndAsarUnchanged:true,userDataUntouched:true}));
