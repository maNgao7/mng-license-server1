'use strict';
const {app,BrowserWindow,session}=require('electron'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'../qa/711');fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'portrait-userdata'));
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{const engine=require('../lib/widget-portraits.cjs').createWidgetPortraits({folder:path.join(output,'portrait-cache'),BrowserWindow,session});try{
 const ids=['7108888648279835649','6637827331829334021','6717272976642049029','6740370726355207173'];
 for(const id of ids)engine.observe({id});await engine.idle();
 const result=engine.snapshot({studio:{pk:{players:ids.map(id=>({id,score:10}))}}}).studio.pk.players;
 const report={resolved:result.filter(p=>p.avatar&&p.username).length,players:result};fs.writeFileSync(path.join(output,'pk-original-profiles.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{engine.close();app.quit();}}).catch(error=>{console.error(error.message);app.exit(1);});
