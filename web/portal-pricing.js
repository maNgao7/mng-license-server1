import { salesPlans } from "./sales-catalog.js";

const contact = document.querySelector('.hero-cta-group a.btn-whatsapp[href^="https://wa.me/"]');
const priceFormat = new Intl.NumberFormat("tr-TR");

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
    const card = document.createElement(contact ? "a" : "span");
    if (contact) {
        const name = plan.kind === "agency" ? `ajans lisansı (${label})` : `bireysel lisans (${label})`;
        linkToContact(card, `Merhaba, TikMnG ${name} için sipariş vermek istiyorum. Paket fiyatı ${amount}.`);
    }
    const title = document.createElement("strong");
    title.textContent = label;
    const price = document.createElement("small");
    price.textContent = amount;
    card.append(title, price);
    list.append(card);
}

if (contact) {
    for (const button of document.querySelectorAll("[data-license-order]")) {
        const type = button.dataset.licenseOrder === "agency" ? "ajans" : "bireysel";
        linkToContact(button, `Merhaba, TikMnG ${type} lisans paketleri hakkında bilgi almak istiyorum.`);
    }
}
