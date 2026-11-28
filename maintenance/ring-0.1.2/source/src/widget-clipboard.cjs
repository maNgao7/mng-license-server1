'use strict';
const {kinds}=require('./widgets/snapshot.cjs');
async function copyWidgetLink(kind,{getLinks,clipboard}) {
  if(!kinds.includes(kind))throw new TypeError('Geçersiz widget seçimi.');
  const links=await getLinks();
  let url;try{url=new URL(links?.[kind]);}catch{throw new Error('Widget bağlantısı henüz hazır değil. Bağlantıyı yenileyin.');}
  if(url.origin!=='https://mng-license-server1.onrender.com'||url.username||url.password||
    !new RegExp('^/overlays/[A-Za-z0-9_-]{43}/widget/view/hediye-box-'+kind+'$').test(url.pathname))
    throw new Error('Geçerli HTTPS widget bağlantısı bulunamadı.');
  clipboard.writeText(url.href);
  return {copied:true};
}
module.exports={copyWidgetLink};
