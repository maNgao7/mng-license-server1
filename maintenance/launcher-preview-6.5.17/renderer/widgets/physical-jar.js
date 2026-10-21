(() => {
  const { Engine, Bodies, Composite, Body } = Matter;
  let host, canvas, context, engine, entries = new Map(), raf, previous = 0;
  let imageCache = new Map(), nextDrop = 0;
  const width = 300, height = 360;
  function image(url) {
    if (!url) return null;
    if (!imageCache.has(url)) { const img = new Image(); img.src = url; imageCache.set(url, img); }
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
    document.getElementById('stage').replaceChildren(host);
    const draw = now => {
      if (!host.isConnected) { cancelAnimationFrame(raf); return; }
      Engine.update(engine, Math.min(33, previous ? now - previous : 16.67)); previous = now;
      context.setTransform(2, 0, 0, 2, 0, 0); context.clearRect(0, 0, width, height);
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
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
  window.updatePhysicalJar = (gifts, coins, count, options = {}) => {
    if (!host?.isConnected) { entries = new Map(); previous = 0; cancelAnimationFrame(raf); mount(); }
    const capacity = Math.max(20, Math.min(200, Number(options.capacity) || 120));
    const keep = new Set();
    const selected = gifts.slice(0, capacity).reverse();
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
})();
