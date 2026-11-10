import { manualShopierUrl, salesPlans } from "./sales-catalog.js?v=20261110g";

const heroActions = document.querySelector(".hero-cta-group");
const contact = heroActions.querySelector('a.btn-whatsapp[href^="https://wa.me/"]');
const priceFormat = new Intl.NumberFormat("tr-TR");
const shopierOpen = document.querySelector('meta[name="tikmng-checkout"]')?.content === "shopier";
const purchaseUrl = plan => shopierOpen ? `/satin-al?plan=${encodeURIComponent(plan.id)}`
    : manualShopierUrl(plan.id) || "/satin-al";

for (const plan of salesPlans) {
    const list = document.getElementById(`homepage-${plan.kind}-prices`);
    const period = plan.period === "weekly" ? "Haftalık" : "Aylık";
    const amount = `${priceFormat.format(plan.priceMinor / 100)} TL`;
    const card = document.createElement("a");
    card.href = purchaseUrl(plan);
    const title = document.createElement("strong");
    title.textContent = plan.kind === "agency" ? `${plan.seats} yayıncı` : period;
    const price = document.createElement("small");
    price.textContent = plan.kind === "agency" ? `${amount} / ay` : amount;
    card.append(title, price);
    list.append(card);
}

for (const button of document.querySelectorAll("[data-license-order]")) {
    const plan = salesPlans.find(item => item.kind === button.dataset.licenseOrder);
    if (plan) button.href = purchaseUrl(plan);
}

if (shopierOpen) {
    const purchase = heroActions.querySelector(".hero-license-cta");
    purchase.href = "/satin-al";
    purchase.textContent = "Shopier’de kartla satın al";
    if (contact) contact.querySelector("span").textContent = "WhatsApp @TikMnG";
    heroActions.classList.add("shopier-open");

    const note = document.querySelector(".plan-order-note");
    if (note) note.textContent = "Paketini seç, Shopier’de kartla öde ve lisans kodunu al.";
    document.getElementById("shopier-order-support").hidden = true;
}
