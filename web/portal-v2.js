document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('.nav-header');
  const updateNav=()=>nav?.classList.toggle('scrolled',window.scrollY>50);
  updateNav();window.addEventListener('scroll',updateNav,{passive:true});
  const targets=document.querySelectorAll('section:not(.hero) .section-header,.game-card,.step-box,.ecosystem-banner,.feedback-card');
  targets.forEach(el=>el.classList.add('reveal'));
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});
  targets.forEach(el=>observer.observe(el));

  if(matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    const gifts=['Rose.png','Ice_Cream_Cone.png','Finger_Heart.png','Doughnut.png','Little_Crown.png','Confetti.png','Balloon_Gift_Box.png','Breakthrough_Star.png','Greeting_Heart.png'];
    const canvas=document.createElement('canvas');canvas.className='gift-trail-canvas';document.body.appendChild(canvas);
    const ctx=canvas.getContext('2d');let width=0,height=0,dpr=1,points=[],lastGift=0,lastX=-100,lastY=-100,giftX=-100,giftY=-100,hue=190;
    const resize=()=>{dpr=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0)};resize();addEventListener('resize',resize,{passive:true});
    const spawnGift=(x,y)=>{const img=document.createElement('img');img.className='gift-trail-item';img.src=`/gift-assets/${encodeURIComponent(gifts[Math.floor(Math.random()*gifts.length)])}`;img.alt='';img.style.left=`${x}px`;img.style.top=`${y}px`;img.style.setProperty('--gift-drift',`${Math.round(Math.random()*50-25)}px`);img.style.setProperty('--gift-rotation',`${Math.round(Math.random()*50-25)}deg`);img.style.setProperty('--gift-end-rotation',`${Math.round(Math.random()*100-50)}deg`);document.body.appendChild(img);setTimeout(()=>img.remove(),1000)};
    const spawnSpark=(x,y)=>{const spark=document.createElement('i');spark.className='gift-trail-spark';spark.style.left=`${x}px`;spark.style.top=`${y}px`;spark.style.setProperty('--trail-hue',hue);spark.style.setProperty('--spark-x',`${Math.round(Math.random()*34-17)}px`);spark.style.setProperty('--spark-y',`${Math.round(Math.random()*34-17)}px`);document.body.appendChild(spark);setTimeout(()=>spark.remove(),720)};
    addEventListener('pointermove',event=>{const now=performance.now(),distance=Math.hypot(event.clientX-lastX,event.clientY-lastY),giftDistance=Math.hypot(event.clientX-giftX,event.clientY-giftY);hue=(hue+9)%360;points.push({x:event.clientX,y:event.clientY,t:now,h:hue});if(points.length>18)points.shift();if(distance>12){spawnSpark(event.clientX,event.clientY);lastX=event.clientX;lastY=event.clientY}if(giftDistance>48&&now-lastGift>85){spawnGift(event.clientX,event.clientY);giftX=event.clientX;giftY=event.clientY;lastGift=now}},{passive:true});
    const draw=()=>{const now=performance.now();points=points.filter(point=>now-point.t<420);ctx.clearRect(0,0,width,height);if(points.length>1){ctx.lineCap='round';ctx.lineJoin='round';for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],life=1-(now-b.t)/420;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`hsla(${b.h},95%,68%,${Math.max(0,life*.58)})`;ctx.lineWidth=Math.max(1,life*5);ctx.shadowBlur=14;ctx.shadowColor=`hsla(${b.h},95%,68%,${life})`;ctx.stroke()}}requestAnimationFrame(draw)};draw();
  }
});
