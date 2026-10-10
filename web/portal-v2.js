document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav-header');
  const updateNav = () => nav?.classList.toggle('scrolled', window.scrollY > 50);
  updateNav();
  window.addEventListener('scroll', updateNav, { passive: true });

  const targets = document.querySelectorAll('section:not(.hero) .section-header, .game-card, .step-box, .ecosystem-banner, .feedback-card');
  targets.forEach(el => el.classList.add('reveal'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach(el => observer.observe(el));

  // =========================================================================
  // MOUSE HAREKETİ HEDİYE BALONCUKLARI VE IŞILTI EFEKTİ (HER ZİYARETÇİYE AKTİF)
  // =========================================================================
  const gifts = [
    'Rose.png',
    'Ice_Cream_Cone.png',
    'Finger_Heart.png',
    'Doughnut.png',
    'Little_Crown.png',
    'Confetti.png',
    'Balloon_Gift_Box.png',
    'Breakthrough_Star.png',
    'Greeting_Heart.png'
  ];

  const canvas = document.createElement('canvas');
  canvas.className = 'gift-trail-canvas';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, dpr = 1;
  let points = [];
  let lastGift = 0, lastX = -100, lastY = -100, giftX = -100, giftY = -100;
  let hue = 190;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const spawnGift = (x, y) => {
    const img = document.createElement('img');
    img.className = 'gift-trail-item';
    const randomGift = gifts[Math.floor(Math.random() * gifts.length)];
    img.src = '/gift-assets/' + encodeURIComponent(randomGift);
    img.alt = '';
    img.style.left = x + 'px';
    img.style.top = y + 'px';
    img.style.setProperty('--gift-drift', Math.round(Math.random() * 50 - 25) + 'px');
    img.style.setProperty('--gift-rotation', Math.round(Math.random() * 50 - 25) + 'deg');
    img.style.setProperty('--gift-end-rotation', Math.round(Math.random() * 100 - 50) + 'deg');
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 1150);
  };

  const spawnSpark = (x, y) => {
    const spark = document.createElement('i');
    spark.className = 'gift-trail-spark';
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';
    spark.style.setProperty('--trail-hue', hue);
    spark.style.setProperty('--spark-x', Math.round(Math.random() * 34 - 17) + 'px');
    spark.style.setProperty('--spark-y', Math.round(Math.random() * 34 - 17) + 'px');
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 720);
  };

  const handlePointer = (event) => {
    const now = performance.now();
    const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
    const giftDistance = Math.hypot(event.clientX - giftX, event.clientY - giftY);
    hue = (hue + 9) % 360;

    points.push({ x: event.clientX, y: event.clientY, t: now, h: hue });
    if (points.length > 20) points.shift();

    if (distance > 12) {
      spawnSpark(event.clientX, event.clientY);
      lastX = event.clientX;
      lastY = event.clientY;
    }

    if (giftDistance > 45 && (now - lastGift > 80)) {
      spawnGift(event.clientX, event.clientY);
      giftX = event.clientX;
      giftY = event.clientY;
      lastGift = now;
    }
  };

  window.addEventListener('pointermove', handlePointer, { passive: true });
  window.addEventListener('mousemove', handlePointer, { passive: true });

  const draw = () => {
    const now = performance.now();
    points = points.filter(p => now - p.t < 500);
    ctx.clearRect(0, 0, width, height);

    if (points.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const life = 1 - (now - b.t) / 500;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `hsla(${b.h}, 95%, 70%, ${Math.max(0, life * 0.72)})`;
        ctx.lineWidth = Math.max(1.5, life * 6);
        ctx.shadowBlur = 17;
        ctx.shadowColor = `hsla(${b.h}, 95%, 70%, ${life})`;
        ctx.stroke();
      }
    }
    requestAnimationFrame(draw);
  };
  draw();

  // =========================================================================
  // İNDİRME PANELİ MODAL
  // =========================================================================
  const directDownload = 'https://drive.usercontent.google.com/download?id=1g-dEVnq_8ksvCTuHq9q7Ur-MGiFBpzND&export=download&confirm=t';
  const stage = document.createElement('div');
  stage.className = 'download-stage';
  stage.hidden = true;
  stage.innerHTML = `
    <div class="download-panel" role="dialog" aria-modal="true" aria-labelledby="downloadTitle">
      <button class="download-close" type="button" aria-label="Kapat">×</button>
      <div class="download-visual">
        <div class="download-kicker">MNG TIKTOK GAME · SÜRÜM 6.0.9</div>
        <h2 id="downloadTitle">YAYININI OYUNA DÖNÜŞTÜR.</h2>
        <p>Launcher, oyunlar, widgetlar ve canlı yayın araçları tek kurulum paketinde.</p>
      </div>
      <div class="download-body">
        <div class="download-meta">
          <div><small>PLATFORM</small><strong>Windows 10 / 11</strong></div>
          <div><small>PAKET</small><strong>Güvenli kurulum</strong></div>
          <div><small>SÜRÜM</small><strong>6.0.9 · Güncel</strong></div>
        </div>
        <div class="download-actions">
          <button class="download-now" type="button">İNDİRMEYİ BAŞLAT</button>
          <button class="download-cancel" type="button">ŞİMDİ DEĞİL</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(stage);

  const closeDownload = () => {
    stage.hidden = true;
    document.body.style.overflow = '';
  };

  stage.querySelector('.download-close').addEventListener('click', closeDownload);
  stage.querySelector('.download-cancel').addEventListener('click', closeDownload);
  stage.addEventListener('click', event => {
    if (event.target === stage) closeDownload();
  });

  stage.querySelector('.download-now').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = directDownload;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    closeDownload();
  });

  window.hemenIndir = () => {
    stage.hidden = false;
    document.body.style.overflow = 'hidden';
    stage.querySelector('.download-now').focus();
  };
});
