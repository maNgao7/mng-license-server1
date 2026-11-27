const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
export const LOOT_VARIANTS = Object.freeze(['reel', 'case', 'pack']);
export function lootTimeline(progress, reduced = false) {
    const p = reduced ? 1 : clamp(progress);
    return { travel: 1 - (1 - clamp(p / .72)) ** 5, unlock: clamp((p - .15) / .22),
        open: clamp((p - .34) / .3), reveal: clamp((p - .72) / .16), flash: reduced ? 0 : Math.max(0, 1 - Math.abs(p - .72) / .045) };
}

const css = `
.loot-opening,.loot-opening *{box-sizing:border-box;letter-spacing:0}
.loot-opening{position:relative;width:100%;max-width:820px;min-width:0;color:#f7fbff;font-family:Arial,sans-serif;text-align:center;isolation:isolate}
.loot-opening .loot-hardware{position:relative;width:100%;height:280px;perspective:900px;overflow:hidden;border-block:3px solid #c7dce1;background:#101617;box-shadow:inset 0 0 0 1px #ffffff30,inset 0 -14px 0 #263639}
.loot-opening .loot-hardware:before,.loot-opening .loot-hardware:after{content:'';position:absolute;inset:7px auto 7px 8px;width:7px;background:repeating-linear-gradient(0deg,#efffff 0 3px,#52676c 3px 17px);z-index:5}
.loot-opening .loot-hardware:after{left:auto;right:8px}
.loot-opening .loot-reel-window{position:absolute;inset:35px 28px;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 10% 90%,transparent)}
.loot-opening .loot-reel{display:flex;gap:12px;position:absolute;left:50%;top:0;width:max-content;will-change:transform;animation:none}
.loot-opening .loot-ticket{position:relative;flex:0 0 120px;width:120px;height:204px;display:grid;place-items:center;border:1px solid #ffffff4d;border-bottom:7px solid var(--tier,#7cd8d8);border-radius:4px;background:linear-gradient(145deg,#2b3539,#141b1e);overflow:hidden}
.loot-opening .loot-ticket:before{content:'';position:absolute;inset:9px;border:1px solid var(--tier,#7cd8d8);clip-path:polygon(0 0,22% 0,22% 2%,2% 2%,2% 23%,0 23%,0 0,100% 100%,78% 100%,78% 98%,98% 98%,98% 77%,100% 77%,100% 100%)}
.loot-opening .loot-ticket:after{content:'';position:absolute;left:12px;right:12px;bottom:15px;height:4px;background:repeating-linear-gradient(90deg,var(--tier,#7cd8d8) 0 4px,transparent 4px 8px)}
.loot-opening .loot-image{position:relative;width:88%;height:76%;object-fit:contain;filter:drop-shadow(0 8px 10px #0007)}
.loot-opening .loot-seal{position:absolute;width:50px;height:50px;border:3px double #cde6df;transform:rotate(45deg);opacity:.35}
.loot-opening .loot-marker{position:absolute;top:18px;bottom:18px;left:calc(50% - 1px);width:2px;background:#fff0b6;box-shadow:0 0 16px #ffcc53;z-index:4}
.loot-opening .loot-marker:before,.loot-opening .loot-marker:after{content:'';position:absolute;left:-6px;top:0;border:7px solid transparent;border-top:12px solid #fff0b6}
.loot-opening .loot-marker:after{top:auto;bottom:0;transform:rotate(180deg)}
.loot-opening .loot-winner{position:absolute;left:50%;top:50%;width:160px;height:206px;margin:-103px 0 0 -80px;display:grid;place-items:center;border:2px solid #ffe3a1;border-radius:5px;background:linear-gradient(145deg,#344b49,#122725);box-shadow:0 0 0 5px #f9cc5b25,0 18px 30px #0005;z-index:6}
.loot-opening .loot-winner:before{content:'';position:absolute;inset:8px;border:1px solid #f4d69a66}
.loot-opening .loot-flash{position:absolute;inset:0;background:#f2ffe5;z-index:8;pointer-events:none}
.loot-opening .loot-model{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}
.loot-opening[data-webgl=ready] .loot-case,.loot-opening[data-webgl=ready] .loot-pack{display:none}
.loot-opening[data-variant=reel] .loot-model{z-index:1}.loot-opening .loot-reel-window{z-index:2}
.loot-opening .loot-result{min-height:66px;margin:18px 0 0;display:flex;flex-direction:column;align-items:center;gap:5px;overflow-wrap:anywhere}
.loot-opening .loot-name{font-size:28px;line-height:1.15;max-width:100%;margin:0;color:#ffdf8c;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.loot-opening .loot-sender{font-size:17px;line-height:1.2;color:#d2e3e4;max-width:100%;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.loot-opening .loot-case{position:absolute;left:50%;top:120px;width:270px;height:108px;margin-left:-135px;transform-style:preserve-3d;transform:rotateX(-10deg);border:3px solid #aac6c8;border-radius:6px;background:repeating-linear-gradient(90deg,#263e40 0 30px,#17282b 30px 34px);box-shadow:inset 0 -14px 0 #0c1719,0 20px 20px #0005}
.loot-opening .loot-lid{position:absolute;left:-3px;right:-3px;top:-72px;height:76px;border:3px solid #bdd9da;background:linear-gradient(160deg,#50777a,#1b3034);border-radius:6px 6px 0 0;transform-origin:center bottom;transform-style:preserve-3d;box-shadow:inset 0 0 0 8px #152a2e,inset 0 0 0 10px #8bb3b7}
.loot-opening .loot-lid:before{content:'';position:absolute;left:calc(50% - 27px);top:20px;width:54px;height:24px;border:3px double #f2db92;transform:skew(-20deg)}
.loot-opening .loot-lock{position:absolute;left:calc(50% - 14px);top:-12px;width:28px;height:35px;background:linear-gradient(90deg,#a98639,#fff2bb,#b48b3b);border:2px solid #e6d59c;border-radius:3px;z-index:2}
.loot-opening .loot-pack{position:absolute;left:50%;top:42px;margin-left:-83px;width:166px;height:213px;transform:rotate(-7deg);border:1px solid #e6f8ef;background:repeating-linear-gradient(125deg,#315f52 0 23px,#47796b 23px 46px,#b7d5aa 46px 48px);box-shadow:inset 0 0 0 8px #132e2d,0 14px 25px #0006;clip-path:polygon(0 0,100% 0,97% 4%,100% 8%,98% 92%,100% 96%,98% 100%,0 100%,3% 96%,0 92%,2% 8%,0 4%)}
.loot-opening .loot-pack:before{content:'';position:absolute;inset:18px 20px;border:2px solid #f3e4a0;transform:skewY(-7deg)}
.loot-opening .loot-pack:after{content:'';position:absolute;inset:58px 47px;border:4px double #fff1b9;transform:rotate(45deg);background:#d0bc6022}
.loot-opening .loot-tear{position:absolute;inset:0 0 auto;height:27px;background:repeating-linear-gradient(90deg,#e5f5c4 0 2px,#55796b 2px 5px);border-bottom:2px solid #172f2e;transform-origin:right center}
.loot-opening[data-variant=case] .loot-marker,.loot-opening[data-variant=pack] .loot-marker{display:none}
@media(max-width:480px){.loot-opening .loot-hardware{height:250px}.loot-opening .loot-name{font-size:23px}.loot-opening .loot-sender{font-size:15px}.loot-opening .loot-result{min-height:76px}.loot-opening .loot-case{width:230px;margin-left:-115px}}
`;

export function createLootOpening(host, { event = {}, resolveImage = () => '', config = {}, variant = config.unboxStyle || 'reel', gifts = [], reducedMotion } = {}) {
    if (!host?.ownerDocument) throw new TypeError('Loot opening requires a host');
    const doc = host.ownerDocument, win = doc.defaultView;
    const reduced = reducedMotion ?? win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = LOOT_VARIANTS.includes(variant) ? variant : 'reel';
    const images = [], root = doc.createElement('section'); root.className = 'loot-opening'; root.dataset.variant = mode;
    const node = (tag, className, parent = root, text = '') => { const n = doc.createElement(tag); n.className = className; n.textContent = text; parent.append(n); return n; };
    node('style', '', root, css);
    const hardware = node('div', 'loot-hardware'); hardware.setAttribute('aria-hidden', 'true');
    const addImage = (parent, gift) => {
        const seal = node('span', 'loot-seal', parent), url = resolveImage(gift.giftImage);
        if (!url) return;
        const img = node('img', 'loot-image', parent); img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.onload = () => { seal.hidden = true; }; img.onerror = () => img.remove(); img.src = url; images.push(img);
    };
    let reel, lid, lock, pack, tear;
    if (mode === 'reel') {
        const viewport = node('div', 'loot-reel-window', hardware); reel = node('div', 'loot-reel case-reel', viewport);
        for (let i = 0; i < 25; i++) {
            const ticket = node('div', 'loot-ticket case-item' + (i === 20 ? ' case-received' : ''), reel);
            ticket.style.setProperty('--tier', ['#78dadd', '#ef84a2', '#a9cf80', '#ffe29d'][i % 4]);
            ticket.dataset.received = String(i === 20); addImage(ticket, i === 20 || !gifts.length ? event : gifts[i % gifts.length]);
        }
    } else if (mode === 'case') {
        const base = node('div', 'loot-case', hardware); lid = node('div', 'loot-lid', base); lock = node('div', 'loot-lock', base);
    } else { pack = node('div', 'loot-pack', hardware); tear = node('div', 'loot-tear', pack); }
    node('div', 'loot-marker', hardware);
    const winner = node('div', 'loot-winner', hardware); addImage(winner, event);
    const flash = node('div', 'loot-flash', hardware), result = node('div', 'loot-result'); result.setAttribute('aria-live', 'polite');
    node('strong', 'loot-name', result, String(event.giftName || 'Hediye'));
    node('span', 'loot-sender', result, String(event.nickname || event.username || '') + (Number(event.count) > 1 ? '  x' + Math.floor(Number(event.count)) : ''));
    host.append(root);
    let disposed = false, progress = 0, model = null, modelError = '';
    function update(value = 0) {
        if (disposed) return false;
        progress = clamp(value); const t = lootTimeline(progress, reduced);
        root.dataset.phase = t.reveal === 1 ? 'revealed' : t.open > 0 ? 'opening' : 'sealed';
        if (reel) reel.style.transform = `translateX(${-60 - 2640 * t.travel}px)`;
        if (lid) { lid.style.transform = `rotateX(${-115 * t.open}deg)`; lock.style.transform = `translateY(${36 * t.unlock}px)`; lock.style.opacity = String(1 - t.unlock); }
        if (pack) { pack.style.transform = `translateY(${85 * t.open}px) rotate(${-7 - 9 * t.open}deg)`; pack.style.opacity = String(1 - t.reveal); tear.style.transform = `translate(${80 * t.unlock}px,${-35 * t.unlock}px) rotate(${28 * t.unlock}deg)`; }
        winner.style.opacity = String(t.reveal); winner.style.transform = `translateY(${(1-t.reveal)*28}px) scale(${.8 + t.reveal*.2}) rotateY(${reduced ? 0 : (1-t.reveal)*80}deg)`;
        if (reel) reel.style.opacity = String(1 - t.reveal * .85);
        result.style.opacity = String(t.reveal); flash.style.opacity = String(t.flash * .65);
        model?.update(t);
        return true;
    }
    function dispose() {
        if (disposed) return;
        disposed = true; model?.dispose(); for (const img of images) { img.onload = img.onerror = null; img.removeAttribute('src'); }
        images.length = 0; root.remove(); win.removeEventListener('pagehide', dispose);
    }
    win.addEventListener('pagehide', dispose, { once: true }); update(0);
    return { update, dispose, surface: hardware, attachModel: next => {
        if (disposed) { next.dispose(); return; }
        model?.dispose(); model = next; root.dataset.webgl = 'ready'; update(progress);
    }, useFallback: error => {
        modelError = String(error?.message || error).slice(0, 160); model?.dispose(); model = null; root.dataset.webgl = 'fallback';
    }, getState: () => ({ variant: mode, progress, phase: root.dataset.phase, disposed, images: images.length, reducedMotion: reduced, model: model?.getState() || null, modelError }) };
}
