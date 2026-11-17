import { salesPlans } from "./sales-catalog.js";

const el = id => document.getElementById(id);
const storageKey = "tikmng-shopier-checkout";
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const mode = document.querySelector('meta[name="tikmng-checkout"]')?.content;
const plans = mode === "shopier-individual" ? salesPlans.filter(plan => plan.kind === "individual") : salesPlans;
const planField = el("plan");
const usernameField = el("username");
const details = el("checkout-details");
const payButton = el("pay-button");
const checkDelays = [5000, 10000, 15000, 30000];
const maxChecks = 12;
const requestTimeout = 12000;
let checkout;
let paid = false;
let leaving = false;
let starting = false;
let startController;
let checkFlight;
let checkTimer;
let checkCount = 0;
let lastCheckAt = -Infinity;
let checksBlocked = false;
let retryNotBefore = 0;
let checkoutContext = 0;
let recoveryController;

function planName(plan) {
    if (!plan) return "Kaydedilmiş ödeme";
    return plan.kind === "agency" ? `Ajans · ${plan.seats} yayıncı · Aylık`
        : `Bireysel · ${plan.period === "weekly" ? "Haftalık" : "Aylık"}`;
}

for (const plan of plans) {
    planField.add(new Option(`${planName(plan)} · ${money.format(plan.priceMinor / 100)}`, plan.id));
}
const requestedPlan = new URLSearchParams(location.search).get("plan");
if (plans.some(plan => plan.id === requestedPlan)) planField.value = requestedPlan;

function updatePlan() {
    const plan = plans.find(plan => plan.id === planField.value);
    const agency = plan?.kind === "agency";
    el("username-label").textContent = agency ? "Ajans adı" : "TikTok kullanıcı adı";
    usernameField.placeholder = agency ? "Ajans adı" : "@kullaniciadi";
    el("username-help").textContent = agency ? "Lisansı kullanacak ajansın adını gir." : "TikTok’ta kullandığın kullanıcı adını gir.";
    el("plan-summary").textContent = planName(plan);
    el("checkout-total").textContent = plan ? money.format(plan.priceMinor / 100) : "";
}
planField.addEventListener("change", updatePlan);
updatePlan();

function validCheckout(data) {
    if (!data || typeof data.token !== "string" || !data.token.trim() || typeof data.paymentUrl !== "string") return false;
    try {
        const url = new URL(data.paymentUrl, location.origin);
        if (url.username || url.password || url.hash) return false;
        if (url.origin === location.origin && url.pathname === "/satin-al/odeme") {
            return url.searchParams.get("token") === data.token && [...url.searchParams.keys()].length === 1;
        }
        return url.origin === "https://www.shopier.com" && /^\/(?:tikmng\/)?\d{1,20}$/.test(url.pathname) && !url.search;
    } catch { return false; }
}

function saveCheckout() {
    try {
        sessionStorage.setItem(storageKey, JSON.stringify(checkout));
        return true;
    } catch { return false; }
}

function stopChecks() {
    clearTimeout(checkTimer);
    checkTimer = undefined;
    if (checkFlight) {
        checkFlight.controller.abort();
        checkFlight = undefined;
        // A hidden/left page did not finish this attempt; allow it on return.
        checkCount = Math.max(0, checkCount - 1);
    }
}

function showCheckout(data) {
    stopChecks();
    checkout = data;
    paid = false;
    checkCount = 0;
    lastCheckAt = -Infinity;
    checksBlocked = false;
    retryNotBefore = 0;
    el("start-checkout").hidden = false;
    if (plans.some(plan => plan.id === data.planId)) planField.value = data.planId;
    if (typeof data.username === "string") usernameField.value = data.username;
    updatePlan();
    const plan = salesPlans.find(plan => plan.id === data.planId);
    el("quote-summary").textContent = [planName(plan), data.username].filter(Boolean).join(" · ");
    el("quote-summary").hidden = false;
    el("plan-summary").textContent = "Paket fiyatı";
    el("checkout-total").textContent = Number.isSafeInteger(data.amountMinor) && data.amountMinor > 0
        ? money.format(data.amountMinor / 100) : "Shopier’de görüntülenir";
    details.hidden = true;
    details.disabled = true;
    el("change-checkout").hidden = false;
    el("payment-state").hidden = false;
    el("payment-heading").textContent = "Ödeme onayı bekleniyor";
    el("payment-label").textContent = "ÖDEME DURUMU";
    el("confirm-status").textContent = "Shopier’de ödemeni tamamla ve bu sekmeye dön. Onay geldiğinde kodun otomatik görünecek.";
    el("issued-license").hidden = true;
    el("retry-check").hidden = true;
    el("copy-status").textContent = "";
}

async function request(endpoint, { method = "POST", payload, controller = new AbortController() } = {}) {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, requestTimeout);
    try {
        const response = await fetch(endpoint, {
            method, headers: { "Content-Type": "application/json" },
            body: payload === undefined ? undefined : JSON.stringify(payload), signal: controller.signal, cache: "no-store",
        });
        if (response.status === 204) return null;
        const result = await response.json().catch(() => null);
        if (!response.ok) {
            const error = new Error(result?.error || "Sunucu yanıt vermedi. Biraz sonra tekrar dene.");
            error.status = response.status;
            if (response.status === 429) {
                const seconds = Number(response.headers.get("Retry-After"));
                error.retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60000;
            }
            throw error;
        }
        return result;
    } catch (error) {
        if (timedOut) throw new Error("Sunucu yanıtı gecikti. İşlemini kaybetmeden tekrar deneyebilirsin.");
        throw error;
    } finally { clearTimeout(timer); }
}

function scheduleCheck(delay) {
    clearTimeout(checkTimer);
    if (!checkout || paid || leaving || document.hidden || checksBlocked) return;
    if (checkCount >= maxChecks) {
        el("confirm-status").textContent = "Ödeme onayı henüz alınamadı. Ödeme yaptıysan tekrar ödeme yapmadan otomatik kontrolü yeniden başlatabilirsin.";
        el("retry-check").hidden = false;
        return;
    }
    checkTimer = setTimeout(checkPayment, delay);
}

async function checkPayment() {
    if (!checkout || paid || starting || leaving || document.hidden || checksBlocked || checkFlight) return;
    clearTimeout(checkTimer);
    checkTimer = undefined;
    const flight = { checkout, controller: new AbortController() };
    checkFlight = flight;
    checkCount++;
    lastCheckAt = Date.now();
    let nextDelay = checkDelays[Math.min(checkCount - 1, checkDelays.length - 1)];
    try {
        const result = await request("/api/shopier/redeem", { payload: { token: flight.checkout.token }, controller: flight.controller });
        if (flight !== checkFlight || flight.checkout !== checkout || leaving || flight.controller.signal.aborted) return;
        if (typeof result?.code !== "string" || !result.code.trim() || !salesPlans.some(plan => plan.id === result.planId)
            || (checkout.planId && result.planId !== checkout.planId)) {
            throw new Error("Lisans kodu henüz alınamadı.");
        }
        paid = true;
        el("payment-heading").textContent = "Lisansın hazır";
        el("payment-label").textContent = "ÖDEME ONAYLANDI";
        el("confirm-status").textContent = "Ödemen doğrulandı. Lisans kodunu kopyalayıp başlatıcıda kullanabilirsin.";
        el("license-code").value = result.code;
        el("panel-code").value = result.panelCode || "";
        el("issued-panel").hidden = !result.panelCode;
        el("issued-license").hidden = false;
        el("retry-check").hidden = true;
        el("start-checkout").hidden = true;
    } catch (error) {
        if (flight !== checkFlight || flight.checkout !== checkout || leaving || (flight.controller.signal.aborted && error.name === "AbortError")) return;
        if ([400, 401, 403, 404, 410].includes(error.status)) {
            checksBlocked = true;
            el("confirm-status").textContent = "Bu ödeme oturumu doğrulanamadı. Ödeme yaptıysan yeniden ödeme yapmadan TikMnG destek ekibiyle iletişime geç.";
        } else if (error.status === 409) {
            el("confirm-status").textContent = "Shopier onayı bekleniyor. Ödemeni tamamladıysan onayın gelmesi birkaç dakika sürebilir. Bu sayfa açıkken kodun otomatik kontrol ediliyor.";
        } else {
            nextDelay = Math.max(nextDelay, error.retryAfter || 0);
            if (error.retryAfter) retryNotBefore = Date.now() + error.retryAfter;
            el("confirm-status").textContent = "Ödeme durumu şu anda alınamadı. İşlemin korunuyor; biraz sonra otomatik tekrar kontrol edilecek.";
        }
    } finally {
        if (checkFlight === flight) {
            checkFlight = undefined;
            scheduleCheck(nextDelay);
        }
    }
}

function resumeChecks() {
    if (!checkout || paid || starting || leaving || document.hidden || checksBlocked || checkFlight || checkCount >= maxChecks) return;
    // Focus and visibility often arrive together. Keep one request and a small cooldown.
    scheduleCheck(Math.max(0, 3000 - (Date.now() - lastCheckAt), retryNotBefore - Date.now()));
}

function closePaymentTab(tab) {
    try { if (tab && !tab.closed) tab.close(); } catch {}
}

el("start-checkout").addEventListener("submit", async event => {
    event.preventDefault();
    if (starting || paid || leaving) return;
    if (!details.disabled && !el("start-checkout").reportValidity()) return;
    // Reserve a tab within the user gesture, before waiting for the checkout request.
    let paymentTab;
    try {
        paymentTab = window.open("about:blank", "_blank");
        if (paymentTab) paymentTab.opener = null;
    } catch { closePaymentTab(paymentTab); paymentTab = null; }
    starting = true;
    checkoutContext++;
    payButton.disabled = true;
    payButton.textContent = "Shopier açılıyor…";
    el("start-checkout").setAttribute("aria-busy", "true");
    el("start-status").textContent = "";
    const planId = planField.value;
    const username = usernameField.value.trim();
    const reuse = checkout && (details.disabled || checkout.planId === planId && checkout.username === username);
    try {
        if (!reuse) {
            stopChecks();
            startController = new AbortController();
            const data = await request("/api/shopier/checkout", { payload: { planId, username }, controller: startController });
            if (leaving || startController.signal.aborted) { closePaymentTab(paymentTab); return; }
            if (!validCheckout(data) || !Number.isSafeInteger(data.amountMinor) || data.amountMinor <= 0) {
                throw new Error("Ödeme bağlantısı alınamadı. Tekrar dene.");
            }
            showCheckout({ ...data, planId, username });
        }
        checkout.paymentOpened = true;
        const saved = saveCheckout();
        const paymentUrl = new URL(checkout.paymentUrl, location.origin).href;
        if (paymentTab && !paymentTab.closed) {
            paymentTab.location.replace(paymentUrl);
            el("start-status").textContent = saved ? "Shopier yeni sekmede açıldı. Ödeme sonrası buraya dön."
                : "Shopier yeni sekmede açıldı. Kodunu alana kadar bu sekmeyi açık tut; tarayıcın işlemi kaydedemedi.";
        } else if (saved) {
            // Popup blockers and some mobile browsers require navigation in this tab.
            location.assign(paymentUrl);
        } else {
            throw new Error("Tarayıcın ödeme oturumunu kaydedemedi. Sekme açılmasına veya oturum depolamaya izin verip tekrar dene.");
        }
    } catch (error) {
        closePaymentTab(paymentTab);
        if (!leaving) el("start-status").textContent = error.message || "Shopier açılamadı. Tekrar dene.";
    } finally {
        starting = false;
        startController = undefined;
        payButton.disabled = false;
        payButton.textContent = "Shopier ödemesine git ↗";
        el("start-checkout").removeAttribute("aria-busy");
        resumeChecks();
    }
});

el("change-checkout").addEventListener("click", () => {
    if (starting) return;
    details.hidden = false;
    details.disabled = false;
    el("quote-summary").hidden = true;
    el("change-checkout").hidden = true;
    el("start-status").textContent = "";
    updatePlan();
    planField.focus();
});
el("retry-check").addEventListener("click", () => {
    if (checkFlight || paid || leaving) return;
    checkCount = 0;
    el("retry-check").hidden = true;
    el("confirm-status").textContent = "Ödeme durumu yeniden kontrol ediliyor…";
    resumeChecks();
});

window.addEventListener("focus", resumeChecks);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopChecks();
    else resumeChecks();
});
window.addEventListener("pagehide", () => {
    leaving = true;
    stopChecks();
    startController?.abort();
    recoveryController?.abort();
});
window.addEventListener("pageshow", () => {
    leaving = false;
    resumeChecks();
});

async function copyCode(inputId, message) {
    const input = el(inputId);
    try {
        await navigator.clipboard.writeText(input.value);
        el("copy-status").textContent = message;
    } catch {
        input.focus();
        input.select();
        el("copy-status").textContent = "Kod seçildi. Kopyalamak için Ctrl+C veya telefonunun kopyalama menüsünü kullan.";
    }
}
el("copy-license").addEventListener("click", () => copyCode("license-code", "Lisans kodu kopyalandı."));
el("copy-panel").addEventListener("click", () => copyCode("panel-code", "Panel giriş kodu kopyalandı."));

async function restoreCheckout() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey));
        if (validCheckout(saved)) {
            showCheckout(saved);
            el("restore-status").hidden = true;
            resumeChecks();
            return;
        }
    } catch {}
    const context = checkoutContext;
    recoveryController = new AbortController();
    try {
        // A Shopier return may open a new tab, which has no sessionStorage.
        const saved = await request("/api/shopier/current", { method: "GET", controller: recoveryController });
        if (leaving || context !== checkoutContext || checkout || starting) return;
        if (validCheckout(saved)) {
            showCheckout(saved);
            saveCheckout();
        }
    } catch {
        if (!leaving && context === checkoutContext && !checkout && !starting) {
            el("start-status").textContent = "Önceki ödeme oturumu kontrol edilemedi. Ödeme yaptıysan sayfayı yenileyerek tekrar dene.";
        }
    } finally {
        recoveryController = undefined;
        el("restore-status").hidden = true;
        if (!paid) el("start-checkout").hidden = false;
        resumeChecks();
    }
}
restoreCheckout();
