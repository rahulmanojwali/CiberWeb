export const FRIENDLY_MENU_LABELS: Record<string, string> = {
  "menu.mandiCommodityProducts": "Mandi Commodity Products",
  "mandi_commodity_products_masters.menu": "Mandi Commodity Products",
  "menu.paymentTransactions": "Payment Transactions",
  "payment_transactions.menu": "Payment Transactions",
  "auction_methods_masters.menu": "Auction Methods",
  "auction_rounds_masters.menu": "Auction Rounds",
  "cm_mandi_auction_policies.menu": "Mandi Auction Policies",
  "auction_policy_settings.menu": "Auction Policy Settings",
  "payment_gateway_configs.menu": "Payment Gateway Settings",
};

export function toTitleCaseFromKey(key: string) {
  const base = key.split(".")[0] || key;
  return base
    .replace(/[_\\-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function humanizeResourceKey(key: string) {
  const cleaned = String(key || "")
    .trim()
    .replace(/^menu\./, "")
    .replace(/\.(menu|view|list|create|update|edit|delete|deactivate)$/i, "");
  if (!cleaned) return "";
  return cleaned
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\\.-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

export function resolveMenuLabel(item: any): string {
  const key = String(item?.resource_key || item?.resourceKey || item?.i18n_label_key || item?.labelKey || "").trim();
  const candidates = [
    item?.label ||
    item?.title ||
    item?.display_name ||
    item?.label_i18n?.en ||
    item?.i18n?.en,
    FRIENDLY_MENU_LABELS[item?.resource_key] ||
    FRIENDLY_MENU_LABELS[item?.resourceKey] ||
    FRIENDLY_MENU_LABELS[item?.i18n_label_key] ||
    FRIENDLY_MENU_LABELS[item?.labelKey] ||
    FRIENDLY_MENU_LABELS[key] ||
    humanizeResourceKey(key),
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    if (FRIENDLY_MENU_LABELS[value]) return FRIENDLY_MENU_LABELS[value];
    if (/^(menu|screen)\.[A-Za-z0-9_.-]+$/.test(value)) {
      const friendly = FRIENDLY_MENU_LABELS[value] || humanizeResourceKey(value);
      if (friendly) return friendly;
      continue;
    }
    return value;
  }

  return "";
}

export function getResourceLabel(r: any, lang: string = "en"): string {
  const labelI18n = r?.label_i18n;
  return (
    (labelI18n && labelI18n[lang]) ||
    resolveMenuLabel(r) ||
    r.screen ||
    toTitleCaseFromKey(r?.resource_key || "")
  );
}
