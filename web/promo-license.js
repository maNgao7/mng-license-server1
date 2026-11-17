const dialog = document.querySelector('#trial-dialog');
const title = dialog.querySelector('h2');
const instructions = dialog.querySelector('.trial-instructions');
const details = dialog.querySelector('.trial-details');
const code = dialog.querySelector('#trial-code');
const copy = dialog.querySelector('[data-trial-copy]');
const status = dialog.querySelector('[role="status"]');
let trigger;
let request;

async function openTrial(button) {
    trigger = button;
    title.textContent = 'Ücretsiz TikMnG denemesi';
    instructions.textContent = 'Lisans kodu yükleniyor…';
    details.hidden = true;
    status.textContent = '';
    dialog.showModal();

    request?.abort();
    const current = new AbortController();
    request = current;
    try {
        const signal = AbortSignal.any([current.signal, AbortSignal.timeout(8000)]);
        const response = await fetch('/api/promo-license', { cache: 'no-store', signal });
        if (response.status === 404) {
            instructions.textContent = 'Ücretsiz deneme kampanyası şu anda açık değil.';
            return;
        }
        if (!response.ok) throw new Error('Trial unavailable');
        const offer = await response.json();
        if (current.signal.aborted) return;
        if (!/^MNG-DENEME-[A-F0-9]{8}$/.test(offer.code) || ![7, 14].includes(offer.days)) {
            throw new Error('Invalid trial offer');
        }
        title.textContent = `${offer.days} gün ücretsiz deneme`;
        instructions.textContent = 'Kodu kopyalayıp TikMnG giriş ekranına yapıştır. Deneme süren bu bilgisayardaki ilk girişinde başlar.';
        code.value = offer.code;
        details.hidden = false;
    } catch {
        if (!current.signal.aborted) instructions.textContent = 'Kod şu anda yüklenemedi. Biraz sonra tekrar dene.';
    }
}

for (const button of document.querySelectorAll('[data-trial-open]')) {
    button.addEventListener('click', () => openTrial(button));
}

copy.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(code.value);
        status.textContent = 'Lisans kodu kopyalandı.';
    } catch {
        code.focus();
        code.select();
        status.textContent = 'Kod seçildi. Cihazının Kopyala komutunu kullan.';
    }
});

dialog.addEventListener('close', () => {
    request?.abort();
    trigger?.focus();
});
