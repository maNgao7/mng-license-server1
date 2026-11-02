'use strict';
const frames=[
    {id:'sultan',name:'Sultan Sarayı',file:'frame-sultan-v1.webp',aperture:[19.2,22.6,61.6,58.9]},
    {id:'ruby',name:'Yakut Köşkü',file:'frame-ruby-v1.webp',aperture:[16.7,16.9,66.6,64.1]},
    {id:'tulip',name:'Lale Devri',file:'frame-tulip-v1.webp',aperture:[20.8,20.3,58.4,57.7]},
    {id:'emerald',name:'Zümrüt Divan',file:'frame-emerald-v1.webp',aperture:[22.6,26.3,54.8,51.8]},
    {id:'imperial',name:'İmparatorluk Mührü',file:'frame-imperial-v1.webp',aperture:[22.3,22,55.4,54]},
    {id:'olympus',name:'Olimpos',file:'frame-olympus-v1.webp',aperture:[22.5,18.6,55,53.7]}
];
module.exports={frames,options:[['original','Özgün görünüm'],...frames.map(frame=>[frame.id,frame.name])]};
