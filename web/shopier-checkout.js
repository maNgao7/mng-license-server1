import { salesPlans } from "./sales-catalog.js";

const el = id => document.getElementById(id);
const storageKey = "tikmng-shopier-checkout";
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const planField = el("plan");
const confirmForm = el("confirm-checkout");
const confirmButton = el("confirm-payment");
const orderIdInput = el("order-id");
const mode = document.querySelector('meta[name="tikmng-checkout"]')?.content;
const plans = mode === "shopier-individual" ? salesPlans.filter(plan => plan.kind === "individual") : salesPlans;
let checkout;
let returnCheckPending = false;
const paymentCheckDelays = [0, 1500, 3000, 6000];

for (const plan of plans) {
    const group = plan.kind === "agency" ? `Ajans · ${plan.seats} yayıncı · Aylık`
        : `Bireysel · ${plan.period === "weekly" ? "Haftalık" : "Aylık"}`;
    planField.add(new Option(`${group} · ${money.format(plan.priceMinor / 100)}`, plan.id));
}

planField.addEventListener("change", updateLabel);
function updateLabel() {
    el("username-label").textContent = planField.value.startsWith("agency-") ? "Ajans adı" : "TikTok kullanıcı adı";
}
const requestedPlan = new URLSearchParams(location.search).get("plan");
if (plans.some(plan => plan.id === requestedPlan)) planField.value = requestedPlan;
updateLabel();

function showCheckout(data, orderId = "") {
    checkout = data;
    const usesOsb = data.verification === "osb";
    returnCheckPending = usesOsb && data.paymentOpened === true;
    el("reference").value = data.reference;
    el("reference-status").textContent = "";
    el("shopier-link").href = data.paymentUrl;
    el("shopier-link").textContent = `Shopier’de ödemeyi aç · ${money.format(data.amountMinor / 100)}`;
    el("return-instructions").hidden = !usesOsb;
    el("order-id-field").hidden = usesOsb;
    orderIdInput.disabled = usesOsb;
    orderIdInput.required = !usesOsb;
    orderIdInput.value = usesOsb ? "" : orderId;
    confirmButton.textContent = usesOsb ? "Ödemeyi kontrol et" : "Ödemeyi doğrula ve lisansı al";
    el("confirm-status").textContent = "";
    confirmForm.hidden = false;
    el("issued-license").hidden = true;
}

try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.token && /^https:\/\/www\.shopier\.com\/(?:tikmng\/)?\d{1,20}$/.test(saved.paymentUrl)) {
        showCheckout(saved, saved.orderId ?? "");
    }
} catch {}

async function post(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(result.error || "İşlem tamamlanamadı. Tekrar dene.");
        error.status = response.status;
        throw error;
    }
    return result;
}

function saveCheckout() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(checkout)); } catch {}
}

function bindForm(id, statusId, action, getContext = () => null) {
    el(id).addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.submitter;
        if (button.disabled) return;
        const context = getContext();
        button.disabled = true;
        el(statusId).textContent = "İşlem sürüyor…";
        try {
            const message = await action(context);
            if (getContext() === context) el(statusId).textContent = message;
        } catch (error) {
            if (getContext() === context) el(statusId).textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

bindForm("start-checkout", "start-status", async () => {
    const data = await post("/api/shopier/checkout", { planId: planField.value, username: el("username").value });
    showCheckout(data);
    saveCheckout();
    return "Ödeme adımı hazır.";
});

bindForm("confirm-checkout", "confirm-status", async activeCheckout => {
    returnCheckPending = false;
    const usesOsb = activeCheckout.verification === "osb";
    const payload = { token: activeCheckout.token };
    activeCheckout.paymentOpened = false;
    if (!usesOsb) {
        activeCheckout.orderId = orderIdInput.value.trim();
        payload.orderId = activeCheckout.orderId;
    }
    saveCheckout();
    let result;
    const delays = usesOsb ? paymentCheckDelays : [0];
    for (const wait of delays) {
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        if (checkout !== activeCheckout) return;
        try {
            result = await post("/api/shopier/redeem", payload);
            break;
        } catch (error) {
            if (!usesOsb || error.status !== 409) throw error;
        }
    }
    if (!result) return "Ödeme onayı bekleniyor. Ödeme tamamlandıysa sipariş notunu kontrol et ve tekrar dene.";
    if (checkout !== activeCheckout) return;
    el("license-code").value = result.code;
    el("panel-code").value = result.panelCode || "";
    el("issued-panel").hidden = !result.panelCode;
    el("issued-license").hidden = false;
    return "Ödeme doğrulandı.";
}, () => checkout);

el("shopier-link").addEventListener("click", () => {
    if (checkout?.verification === "osb" && !confirmButton.disabled && el("issued-license").hidden) {
        returnCheckPending = true;
        checkout.paymentOpened = true;
        saveCheckout();
    }
});

function checkOnReturn() {
    if (!returnCheckPending || document.hidden || !document.hasFocus() || confirmButton.disabled) return;
    returnCheckPending = false;
    confirmForm.requestSubmit(confirmButton);
}

window.addEventListener("focus", checkOnReturn);
document.addEventListener("visibilitychange", checkOnReturn);
checkOnReturn();

async function copyCode(inputId, message, statusId = "confirm-status") {
    const input = el(inputId);
    try {
        await navigator.clipboard.writeText(input.value);
        el(statusId).textContent = message;
    } catch {
        input.select();
    }
}
el("copy-reference").addEventListener("click", () => copyCode("reference", "Referans kopyalandı.", "reference-status"));
el("copy-license").addEventListener("click", () => copyCode("license-code", "Lisans kodu kopyalandı."));
el("copy-panel").addEventListener("click", () => copyCode("panel-code", "Panel giriş kodu kopyalandı."));
