import { salesPlans } from "./sales-catalog.js";

const heroActions = document.querySelector(".hero-cta-group");
const contact = heroActions.querySelector('a.btn-whatsapp[href^="https://wa.me/"]');
const priceFormat = new Intl.NumberFormat("tr-TR");
const shopierOpen = document.querySelector('meta[name="tikmng-checkout"]')?.content === "shopier";

function linkToContact(link, message) {
    const url = new URL(contact.href);
    url.searchParams.set("text", message);
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
}

for (const plan of salesPlans) {
    const list = document.getElementById(`homepage-${plan.kind}-prices`);
    const period = plan.period === "weekly" ? "Haftalık" : "Aylık";
    const label = plan.kind === "agency" ? `${plan.seats} yayıncı · ${period}` : period;
    const amount = `${priceFormat.format(plan.priceMinor / 100)} TL`;
    const card = document.createElement(shopierOpen || contact ? "a" : "span");
    if (shopierOpen) {
        card.href = `/satin-al?plan=${encodeURIComponent(plan.id)}`;
    } else if (contact) {
        const name = plan.kind === "agency" ? `ajans lisansı (${label})` : `bireysel lisans (${label})`;
        linkToContact(card, `Merhaba, TikMnG ${name} için sipariş vermek istiyorum. Paket fiyatı ${amount}.`);
    }
    const title = document.createElement("strong");
    title.textContent = plan.kind === "agency" ? `${plan.seats} yayıncı` : period;
    const price = document.createElement("small");
    price.textContent = plan.kind === "agency" ? `${amount} / ay` : amount;
    card.append(title, price);
    list.append(card);
}

if (shopierOpen) {
    const purchase = heroActions.querySelector(".hero-license-cta");
    purchase.href = "/satin-al";
    purchase.textContent = "Shopier’de kartla satın al";
    if (contact) contact.querySelector("span").textContent = "WhatsApp @TikMnG";
    heroActions.classList.add("shopier-open");

    for (const button of document.querySelectorAll("[data-license-order]")) {
        const plan = salesPlans.find(item => item.kind === button.dataset.licenseOrder);
        if (plan) {
            button.href = `/satin-al?plan=${encodeURIComponent(plan.id)}`;
            button.removeAttribute("target");
            button.textContent = "Kartla lisans satın al";
        }
    }
    const note = document.querySelector(".plan-order-note");
    if (note) note.textContent = "Paketini seç, Shopier’de kartla öde ve lisans kodunu al.";
} else if (contact) {
    for (const button of document.querySelectorAll("[data-license-order]")) {
        const type = button.dataset.licenseOrder === "agency" ? "ajans" : "bireysel";
        linkToContact(button, `Merhaba, TikMnG ${type} lisans paketleri hakkında bilgi almak istiyorum.`);
    }
}
