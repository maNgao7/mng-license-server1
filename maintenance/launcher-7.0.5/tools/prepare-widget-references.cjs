'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root='D:/TikMnG-Widget-References-20261025';
const ids=['222326','222603','222735','222911','223037','223209','223312','223432','223615','223836','223947'];
const manifest=[];
for(const id of ids){
    const file=path.join(process.env.USERPROFILE,'Downloads',`Kayıt 2026-10-25 ${id}.mp4`),out=path.join(root,id);
    fs.mkdirSync(out,{recursive:true});
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],{encoding:'utf8',windowsHide:true}));
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-map','0:v:0','-vf',"fps=1/3,scale=536:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:hms}':x=8:y=8:fontcolor=white:fontsize=18:box=1:boxcolor=black@0.6,tile=3x4",'-fps_mode','vfr',path.join(out,'contact-%02d.jpg')],{windowsHide:true});
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-vn','-af','loudnorm=I=-18:TP=-1:LRA=11','-ac','1','-ar','16000',path.join(out,'narration.wav')],{windowsHide:true});
    const entry={id,file,duration:Number(probe.format.duration),video:probe.streams.find(stream=>stream.codec_type==='video'),audio:probe.streams.filter(stream=>stream.codec_type==='audio'),out};manifest.push(entry);
    console.log(JSON.stringify({id,duration:entry.duration,contactSheets:fs.readdirSync(out).filter(name=>name.startsWith('contact')).length}));
}
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
