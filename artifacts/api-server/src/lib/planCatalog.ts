export type Plan = {
  label: string;
  price: string;
  priceUsd: number;
  entitlements: string[];
  productKeywords: string[];
};

export const PLAN_CATALOG: Plan[] = [
  {
    label: "Pro Monthly",
    price: "$9.99",
    priceUsd: 9.99,
    entitlements: ["pro", "business"],
    productKeywords: ["pro"],
  },
  {
    label: "Business Monthly",
    price: "$19.99",
    priceUsd: 19.99,
    entitlements: ["business"],
    productKeywords: ["business"],
  },
];

export const PLAN_BY_LABEL: Record<string, Plan> = Object.fromEntries(
  PLAN_CATALOG.map((p) => [p.label, p])
);

export function resolvePlanFromWebhook(opts: {
  price?: number;
  productId?: string;
  entitlementIds?: string[];
}): Plan | null {
  const { price, productId = "", entitlementIds = [] } = opts;

  if (price != null) {
    const match = PLAN_CATALOG.find(
      (p) => Math.abs(p.priceUsd - price) < 0.005
    );
    if (match) return match;
  }

  const lcProduct = productId.toLowerCase();
  for (const plan of [...PLAN_CATALOG].reverse()) {
    if (plan.productKeywords.some((kw) => lcProduct.includes(kw))) return plan;
  }

  for (const plan of [...PLAN_CATALOG].reverse()) {
    if (plan.entitlements.some((e) => entitlementIds.includes(e))) return plan;
  }

  return null;
}
