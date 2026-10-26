const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:1400,height:900,webPreferences:{contextIsolation:true}});
 try{
  await win.loadURL('http://127.0.0.1:3010');
  await new Promise(resolve=>setTimeout(resolve,1600));
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const result=[];
    for(const video of [...document.querySelectorAll('.background-stage video[data-background]')].slice(0,4)){
      video.muted=true;await video.play();
      await new Promise(resolve=>setTimeout(resolve,350));
      result.push({index:video.dataset.background,ready:video.readyState,time:video.currentTime,error:video.error?.message||null});
      video.pause();
    }
    return result;
  })()`);
  console.log(JSON.stringify(result));
  fs.writeFileSync(path.resolve(__dirname,'../../release-v6.5.8/media-check.json'),JSON.stringify(result,null,2));
  if(result.some(item=>item.ready<2||item.time<=0||item.error))process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1}
 app.quit();
});
