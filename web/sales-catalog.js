export const pricingVersion = "20261110-approved-v1";

const manualProducts = {
  "individual-weekly": "52768054", "individual-monthly": "52768056",
  "agency-10-monthly": "52768058", "agency-20-monthly": "52768059",
  "agency-35-monthly": "52768060", "agency-120-monthly": "52768061", "agency-200-monthly": "52768062",
};

export function manualShopierUrl(planId) {
  return typeof planId === "string" && Object.hasOwn(manualProducts, planId)
    ? `https://www.shopier.com/tikmng/${manualProducts[planId]}` : null;
}

export const salesPlans = [
  { id: "individual-weekly", kind: "individual", period: "weekly", seats: 1, priceMinor: 50000 },
  { id: "individual-monthly", kind: "individual", period: "monthly", seats: 1, priceMinor: 150000 },
  { id: "agency-10-monthly", kind: "agency", period: "monthly", seats: 10, priceMinor: 250000 },
  { id: "agency-20-monthly", kind: "agency", period: "monthly", seats: 20, priceMinor: 500000 },
  { id: "agency-35-monthly", kind: "agency", period: "monthly", seats: 35, priceMinor: 750000 },
  { id: "agency-120-monthly", kind: "agency", period: "monthly", seats: 120, priceMinor: 1250000 },
  { id: "agency-200-monthly", kind: "agency", period: "monthly", seats: 200, priceMinor: 2000000 },
];

export function createPreviewPricing() {
  const prices = { individual: null, weekly: null, biweekly: null, monthly: null };
  const agencyTiers = {};
  for (const plan of salesPlans) {
    if (plan.kind === "agency") agencyTiers[plan.seats] = plan.priceMinor;
    else prices[plan.period] = plan.priceMinor;
  }
  return { prices, agencyTiers, pricingVersion };
}
