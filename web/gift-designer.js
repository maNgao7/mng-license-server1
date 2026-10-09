(() => {
  const $ = id => document.getElementById(id);
  const state = {catalog:[],filtered:[],items:[],selected:-1,range:'all',zoom:.52,drag:null,images:new Map()};
  const canvas=$('designCanvas'),ctx=canvas.getContext('2d');
  const controls=['canvasPreset','transparentBg','backgroundColor','columns','giftSize','giftGap','cardStyle','textColor','showName','showCoins','showGlow'];
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function imageUrl(g){return `gift-assets/${encodeURIComponent(g.file||'')}`}
  async function loadCatalog(){
    try{const raw=await fetch('gift-assets/katalog_tam.json').then(r=>r.json());state.catalog=raw.filter(g=>g.file).map(g=>({id:String(g.id),name:g.trName||g.name||'Hediye',coins:Number(g.coins)||0,file:g.file}));state.filtered=state.catalog;$('catalogCount').textContent=`${state.catalog.length} hediye`;filterGifts()}catch(e){$('catalogCount').textContent='Katalog yüklenemedi'}
  }
  function inRange(g){if(state.range==='1-99')return g.coins<100;if(state.range==='100-999')return g.coins>=100&&g.coins<1000;if(state.range==='1000+')return g.coins>=1000;return true}
  function filterGifts(){const q=$('giftSearch').value.trim().toLocaleLowerCase('tr');state.filtered=state.catalog.filter(g=>inRange(g)&&(!q||g.name.toLocaleLowerCase('tr').includes(q)||String(g.coins).includes(q)));renderGrid()}
  function renderGrid(){const grid=$('giftGrid');grid.innerHTML='';const frag=document.createDocumentFragment();state.filtered.forEach(g=>{const b=document.createElement('button');b.className='gift-card';b.innerHTML=`<span class="add">+</span><img loading="lazy" src="${imageUrl(g)}" alt=""><strong>${escapeHtml(g.name)}</strong><small>${g.coins} coin</small>`;b.onclick=()=>addGift(g);frag.appendChild(b)});grid.appendChild(frag)}
  function addGift(g){const size=+$('giftSize').value;const n=state.items.length;state.items.push({gift:g,x:canvas.width/2+(n%3-1)*size*1.15,y:canvas.height/2+Math.floor(n/3)*size*.32,size});state.selected=state.items.length-1;render();updateSelection()}
  function fitCanvas(){const wrap=$('stageWrap'),maxW=Math.max(260,wrap.clientWidth-54),maxH=Math.max(220,wrap.clientHeight-54);const fit=Math.min(maxW/canvas.width,maxH/canvas.height,1);state.zoom=Math.max(.12,Math.min(1.2,fit));applyZoom()}
  function applyZoom(){canvas.style.width=`${canvas.width*state.zoom}px`;canvas.style.height=`${canvas.height*state.zoom}px`;$('zoomValue').textContent=`${Math.round(state.zoom*100)}%`}
  function changePreset(){const [w,h]=$('canvasPreset').value.split('x').map(Number);canvas.width=w;canvas.height=h;autoLayout();fitCanvas()}
  function roundedRect(x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
  function getImage(g){const key=g.file;if(state.images.has(key))return state.images.get(key);const img=new Image();img.onload=render;img.src=imageUrl(g);state.images.set(key,img);return img}
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);if(!$('transparentBg').checked){ctx.fillStyle=$('backgroundColor').value;ctx.fillRect(0,0,canvas.width,canvas.height)}
    const text=$('textColor').value,style=$('cardStyle').value,showName=$('showName').checked,showCoins=$('showCoins').checked,glow=$('showGlow').checked;
    state.items.forEach((item,i)=>{const s=item.size,x=item.x-s*.62,y=item.y-s*.58,w=s*1.24,h=s*1.52;
      ctx.save();if(glow){ctx.shadowColor='rgba(22,217,255,.42)';ctx.shadowBlur=s*.12}if(style!=='none'){ctx.fillStyle=style==='dark'?'rgba(3,8,16,.9)':'rgba(10,30,48,.72)';roundedRect(x,y,w,h,s*.08);ctx.fill();ctx.strokeStyle=i===state.selected?'#16d9ff':'rgba(91,156,196,.38)';ctx.lineWidth=i===state.selected?5:2;ctx.stroke()}ctx.shadowBlur=0;
      const img=getImage(item.gift);if(img.complete&&img.naturalWidth)ctx.drawImage(img,item.x-s*.5,item.y-s*.5,s,s);
      ctx.textAlign='center';ctx.fillStyle=text;ctx.font=`700 ${Math.max(24,s*.13)}px Segoe UI`;if(showName)ctx.fillText(item.gift.name,item.x,item.y+s*.68,w-20);ctx.fillStyle='#ffd400';ctx.font=`800 ${Math.max(20,s*.105)}px Segoe UI`;if(showCoins)ctx.fillText(`${item.gift.coins} coin`,item.x,item.y+s*.86,w-20);ctx.restore()})
  }
  function autoLayout(){const cols=Math.max(1,+$('columns').value),gap=+$('giftGap').value,size=+$('giftSize').value;const rows=Math.ceil(state.items.length/cols),totalW=Math.min(canvas.width-80,cols*(size*1.24)+(cols-1)*gap),cell=totalW/cols;state.items.forEach((it,i)=>{const row=Math.floor(i/cols),col=i%cols;const used=Math.min(cols,state.items.length-row*cols);it.size=size;it.x=canvas.width/2+(col-(used-1)/2)*cell;it.y=canvas.height/2+(row-(rows-1)/2)*(size*1.55+gap)});render()}
  function hit(px,py){for(let i=state.items.length-1;i>=0;i--){const a=state.items[i],s=a.size;if(px>a.x-s*.62&&px<a.x+s*.62&&py>a.y-s*.58&&py<a.y+s*.94)return i}return-1}
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
  function updateSelection(){const it=state.items[state.selected];$('selectedName').textContent=it?`${it.gift.name} · ${it.gift.coins} coin`:'Bir hediye seçin';$('selectedCount').textContent=state.items.length;$('duplicateBtn').disabled=!it;$('removeBtn').disabled=!it}
  canvas.addEventListener('pointerdown',e=>{const p=point(e),i=hit(p.x,p.y);state.selected=i;state.drag=i<0?null:{i,dx:p.x-state.items[i].x,dy:p.y-state.items[i].y};canvas.setPointerCapture(e.pointerId);updateSelection();render()});
  canvas.addEventListener('pointermove',e=>{if(!state.drag)return;const p=point(e),it=state.items[state.drag.i];it.x=Math.max(0,Math.min(canvas.width,p.x-state.drag.dx));it.y=Math.max(0,Math.min(canvas.height,p.y-state.drag.dy));render()});canvas.addEventListener('pointerup',()=>state.drag=null);
  $('giftSearch').oninput=filterGifts;$('coinFilters').onclick=e=>{const b=e.target.closest('button');if(!b)return;state.range=b.dataset.range;[...$('coinFilters').children].forEach(x=>x.classList.toggle('active',x===b));filterGifts()};
  controls.forEach(id=>$(id).addEventListener(id==='giftSize'||id==='giftGap'||id==='columns'?'input':'change',()=>{if(id==='backgroundColor')$('bgHex').textContent=$(id).value.toUpperCase();if(id==='textColor')$('textHex').textContent=$(id).value.toUpperCase();if(id==='columns')$('columnsValue').textContent=$(id).value;if(id==='giftSize')$('giftSizeValue').textContent=$(id).value;if(id==='giftGap')$('giftGapValue').textContent=$(id).value;if(id==='canvasPreset')changePreset();else if(['columns','giftSize','giftGap'].includes(id))autoLayout();else render()}));
  $('autoLayoutBtn').onclick=autoLayout;$('zoomIn').onclick=()=>{state.zoom=Math.min(1.2,state.zoom+.08);applyZoom()};$('zoomOut').onclick=()=>{state.zoom=Math.max(.12,state.zoom-.08);applyZoom()};
  $('removeBtn').onclick=()=>{if(state.selected<0)return;state.items.splice(state.selected,1);state.selected=-1;updateSelection();render()};$('duplicateBtn').onclick=()=>{const a=state.items[state.selected];if(!a)return;state.items.push({...a,x:a.x+40,y:a.y+40});state.selected=state.items.length-1;updateSelection();render()};
  $('clearBtn').onclick=()=>{state.items=[];state.selected=-1;updateSelection();render()};$('downloadBtn').onclick=()=>{render();const a=document.createElement('a');a.download=`mng-tiktok-hediye-tasarimi-${Date.now()}.png`;a.href=canvas.toDataURL('image/png');a.click()};
  $('closeDesigner').onclick=()=>{if(window.parent!==window)window.parent.postMessage({type:'mng-close-gift-designer'},'*');else location.href='/'};
  window.addEventListener('resize',fitCanvas);loadCatalog();changePreset();updateSelection();
})();
