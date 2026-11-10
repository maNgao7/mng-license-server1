import { salesPlans } from "./sales-catalog.js";

const el = id => document.getElementById(id);
const storageKey = "tikmng-shopier-checkout";
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const planField = el("plan");
let checkout;

for (const plan of salesPlans) {
    const group = plan.kind === "agency" ? `Ajans · ${plan.seats} yayıncı · Aylık`
        : `Bireysel · ${plan.period === "weekly" ? "Haftalık" : "Aylık"}`;
    planField.add(new Option(`${group} · ${money.format(plan.priceMinor / 100)}`, plan.id));
}

planField.addEventListener("change", updateLabel);
function updateLabel() {
    el("username-label").textContent = planField.value.startsWith("agency-") ? "Ajans adı" : "TikTok kullanıcı adı";
}
const requestedPlan = new URLSearchParams(location.search).get("plan");
if (salesPlans.some(plan => plan.id === requestedPlan)) planField.value = requestedPlan;
updateLabel();

function showCheckout(data) {
    checkout = data;
    el("reference").value = data.reference;
    el("shopier-link").href = data.paymentUrl;
    el("shopier-link").textContent = `Shopier’de ödemeyi aç · ${money.format(data.amountMinor / 100)}`;
    el("confirm-checkout").hidden = false;
    el("issued-license").hidden = true;
}

try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.token && /^https:\/\/www\.shopier\.com\/(?:tikmng\/)?\d{1,20}$/.test(saved.paymentUrl)) {
        showCheckout(saved);
        el("order-id").value = saved.orderId ?? "";
    }
} catch {}

async function post(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "İşlem tamamlanamadı. Tekrar dene.");
    return result;
}

function saveCheckout() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(checkout)); } catch {}
}

function bindForm(id, statusId, action) {
    el(id).addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.submitter;
        button.disabled = true;
        el(statusId).textContent = "İşlem sürüyor…";
        try {
            el(statusId).textContent = await action();
        } catch (error) {
            el(statusId).textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

bindForm("start-checkout", "start-status", async () => {
    const data = await post("/api/shopier/checkout", { planId: planField.value, username: el("username").value });
    showCheckout(data);
    el("order-id").value = "";
    el("confirm-status").textContent = "";
    saveCheckout();
    return "Ödeme adımı hazır.";
});

bindForm("confirm-checkout", "confirm-status", async () => {
    checkout.orderId = el("order-id").value.trim();
    saveCheckout();
    const result = await post("/api/shopier/redeem", { token: checkout.token, orderId: checkout.orderId });
    el("license-code").value = result.code;
    el("panel-code").value = result.panelCode || "";
    el("issued-panel").hidden = !result.panelCode;
    el("issued-license").hidden = false;
    return "Ödeme doğrulandı.";
});

async function copyCode(inputId, message) {
    const input = el(inputId);
    try {
        await navigator.clipboard.writeText(input.value);
        el("confirm-status").textContent = message;
    } catch {
        input.select();
    }
}
el("copy-license").addEventListener("click", () => copyCode("license-code", "Lisans kodu kopyalandı."));
el("copy-panel").addEventListener("click", () => copyCode("panel-code", "Panel giriş kodu kopyalandı."));
