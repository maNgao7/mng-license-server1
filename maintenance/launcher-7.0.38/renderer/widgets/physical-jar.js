(() => {
  let jarSkins = null;
  let jarSkinPending = false;
  function loadJarSkins() {
    if (jarSkins || jarSkinPending) return;
    jarSkinPending = true;
    import('./cinematic/jar-silhouettes.js').then(module => {
      jarSkins = Object.freeze({ draw: module.drawJarSkin, drawMascot: module.drawJarMascot, styles: module.JAR_SKINS });
      window.TikMnGJarSkins = jarSkins;
    }).catch(error => console.warn('[physical-jar] Glass skins unavailable', error)).finally(() => { jarSkinPending = false; });
  }
  const { Engine, Bodies, Composite } = window.Matter || {};
  if (!Engine) return;
  let host, canvas, context, engine, entries = new Map(), raf, previous = 0;
  let imageCache = new Map(), nextDrop = 0, toastUntil = 0, toast = '', toastKey = '';
  const width = 300, height = 360;
  function image(url) {
    url = window.widgetImageURL ? window.widgetImageURL(url) : url;
    if (!url) return null;
    if (!imageCache.has(url)) {
      const img = new Image(); img.src = url; imageCache.set(url, img);
      if (imageCache.size > 256) imageCache.delete(imageCache.keys().next().value);
    }
    return imageCache.get(url);
  }
  function mount() {
    engine = Engine.create({ gravity: { y: 1.3 }, enableSleeping: true });
    Composite.add(engine.world, [
      Bodies.rectangle(150, 350, 300, 20, { isStatic: true }),
      Bodies.rectangle(10, 160, 18, 400, { isStatic: true }),
      Bodies.rectangle(290, 160, 18, 400, { isStatic: true })
    ]);
    host = document.createElement('div'); host.className = 'physics-jar';
    host.innerHTML = '<div class="physics-jar-cap"></div><canvas width="600" height="720"></canvas><div class="physics-jar-glass"></div><strong class="physics-jar-total"></strong>';
    canvas = host.querySelector('canvas'); context = canvas.getContext('2d');
    const notice = document.createElement('span');notice.className='physics-jar-toast';notice.hidden=true;
    notice.style.cssText='position:absolute;top:-35px;left:50%;transform:translateX(-50%);max-width:290px;padding:6px 12px;background:#10231eeb;border:1px solid #e6c56d;border-radius:4px;color:#fff2be;font:bold 12px Arial;white-space:nowrap;pointer-events:none';
    host.append(notice);
    document.getElementById('stage').replaceChildren(host);
    const draw = now => {
      if (!host?.isConnected) { dispose(); return; }
      Engine.update(engine, Math.min(33, previous ? now - previous : 16.67)); previous = now;
      context.setTransform(2, 0, 0, 2, 0, 0); context.clearRect(0, 0, width, height);
      const customSkin = jarSkins?.draw(context, host.dataset.jarStyle, { height: 400, layer: 'back', tint: host.style.getPropertyValue('--jar-color') });
      for (const part of host.querySelectorAll('.physics-jar-cap,.physics-jar-glass')) part.hidden = !!customSkin;
      for (const entry of entries.values()) {
        if (!entry.active) {
          if (now < nextDrop) continue;
          Composite.add(engine.world, entry.body); entry.active = true; nextDrop = now + 160;
        }
        const { body, gift } = entry;
        const r = body.circleRadius, img = image(gift.giftImage);
        context.save(); context.translate(body.position.x, body.position.y); context.rotate(body.angle);
        context.beginPath(); context.arc(0, 0, r, 0, Math.PI * 2);
        context.fillStyle = '#e6fcff33'; context.fill(); context.strokeStyle = '#b1edf288'; context.stroke();
        if (img?.complete && img.naturalWidth) context.drawImage(img, -r * .8, -r * .8, r * 1.6, r * 1.6);
        else { context.font = `${r}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('🎁', 0, 0); }
        context.restore();
      }
      if (customSkin) jarSkins.draw(context, host.dataset.jarStyle, { height: 400 });
      if (jarSkins?.drawMascot && host.dataset.jarMascot && host.dataset.jarMascot !== 'none') jarSkins.drawMascot(context, host.dataset.jarMascot, { x: 150, y: 326, time: now, scale: .72, excited: now < toastUntil });
      notice.hidden = !(toast && now < toastUntil);notice.textContent = toast;notice.style.opacity=String(Math.min(1,Math.max(0,(toastUntil-now)/450)));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
  window.updatePhysicalJar = (gifts, coins, count, options = {}) => {
    if (!host?.isConnected) { dispose(); mount(); }
    host.dataset.jarStyle = options.jarStyle || options.shape || 'classic';
    host.dataset.jarMascot = options.jarMascot || 'none';
    if (['bell', 'lantern'].includes(host.dataset.jarStyle) || host.dataset.jarMascot !== 'none') loadJarSkins();
    const customSkin = jarSkins?.styles.includes(host.dataset.jarStyle);
    for (const part of host.querySelectorAll('.physics-jar-cap,.physics-jar-glass')) part.hidden = customSkin;
    const capacity = Math.max(20, Math.min(200, Number(options.capacity) || 120));
    const keep = new Set();
    const selected = gifts.slice(0, capacity).reverse();
    const latest = gifts[0];
    if (latest?.id && latest.id !== toastKey) {
      toastKey = latest.id; toastUntil = performance.now() + 2400;
      const combo = Math.max(1, Number(latest.repeatCount || latest.count) || 1);
      toast = combo > 1 ? `KOMBO ×${combo} · ${String(latest.giftName || 'Hediye').slice(0, 18)}` : String(latest.giftName || 'Hediye').slice(0, 28);
    }
    for (const gift of selected) {
      const count = Math.min(capacity, Math.max(1, Number(gift.count) || 1));
      for (let i = 0; i < count && keep.size < capacity; i++) {
        const id = `${gift.id}:${i}`; keep.add(id);
        if (entries.has(id)) continue;
        const r = Math.max(9, Math.min(18, Number(options.giftSize) / 2 || 11));
        const body = Bodies.circle(120 + Math.random() * 60, 18, r, { restitution: .18, friction: .5, frictionAir: .015 });
        entries.set(id, { body, gift, active: false });
      }
    }
    for (const [id, entry] of entries) if (!keep.has(id)) { Composite.remove(engine.world, entry.body); entries.delete(id); }
    host.querySelector('.physics-jar-total').textContent = `${Number(coins || 0).toLocaleString('tr-TR')} coin · ${Number(count || 0)} hediye`;
    host.style.setProperty('--jar-color', options.tint || '#25f4ee');
  };
  function dispose() {
    cancelAnimationFrame(raf);
    if (engine) { Composite.clear(engine.world, false); Engine.clear(engine); }
    entries.clear(); imageCache.clear(); previous = nextDrop = toastUntil = 0; toast = toastKey = ''; engine = null;
    host?.remove(); host = canvas = context = null;
  }
  window.disposePhysicalJar = dispose;
  window.addEventListener('pagehide', dispose, { once: true });
})();
