document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('.nav-header');
  const updateNav=()=>nav?.classList.toggle('scrolled',window.scrollY>50);
  updateNav();window.addEventListener('scroll',updateNav,{passive:true});
  const targets=document.querySelectorAll('section:not(.hero) .section-header,.game-card,.step-box,.ecosystem-banner,.feedback-card');
  targets.forEach(el=>el.classList.add('reveal'));
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12});
  targets.forEach(el=>observer.observe(el));
});
