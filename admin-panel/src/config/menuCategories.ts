import { canonicalizeResourceKey, type UiResource } from "../utils/adminUiConfig";

export type MenuCategory = {
  key: string;
  label: string;
  order: number;
  match: (resourceKey: string, resource: UiResource) => boolean;
};

const startsWith = (key: string, prefixes: string[]) =>
  prefixes.some((prefix) => key.startsWith(prefix));

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    order: 1,
    match: (key) => startsWith(key, ["dashboard.", "mobile_dashboard."]),
  },
  {
    key: "organisation",
    label: "Organisation",
    order: 2,
    match: (key) =>
      startsWith(key, ["organisations.", "org_mandi_mappings.", "admin_users."]),
  },
  {
    key: "mandi_masters",
    label: "Mandi & Masters",
    order: 3,
    match: (key) =>
      startsWith(key, [
        "mandis.",
        "commodities_masters.",
        "commodity_products_masters.",
        "mandi_commodity_products_masters.",
        "mandi_facilities_masters.",
        "mandi_gates.",
      ]),
  },
  {
    key: "gate_ops",
    label: "Gate Operations",
    order: 4,
    match: (key) =>
      startsWith(key, [
        "gate_entries.",
        "gate_entry_tokens.",
        "gate_tokens.",
        "gate_movements.",
        "gate_devices.",
        "gate_vehicle_types.",
      ]) || key.startsWith("gate_"),
  },
  {
    key: "auctions",
    label: "Auctions",
    order: 5,
    match: (key) =>
      startsWith(key, ["auctions.", "auction_", "lots.", "bids."]),
  },
  {
    key: "market_ops",
    label: "Market Operations",
    order: 6,
    match: (key) =>
      startsWith(key, [
        "pre_market_listings.",
        "transport_intents.",
        "stall_fees.",
        "market_prices.",
        "mandi_price_policies.",
        "mandi_settings.",
      ]),
  },
  {
    key: "participants",
    label: "Participants",
    order: 7,
    match: (key) =>
      startsWith(key, [
        "farmers.",
        "traders.",
        "trader_approvals.",
        "trader_payments.",
      ]),
  },
  {
    key: "payments",
    label: "Payments",
    order: 8,
    match: (key) =>
      startsWith(key, [
        "payment_",
        "payments.",
        "mandi_payment_settings.",
        "org_payment_settings.",
        "commodity_fees.",
        "custom_fees.",
        "role_custom_fees.",
      ]),
  },
  {
    key: "reports",
    label: "Reports",
    order: 9,
    match: (key) => startsWith(key, ["reports.", "system_reports."]),
  },
  {
    key: "system",
    label: "System",
    order: 10,
    match: (key) =>
      startsWith(key, [
        "system_",
        "role_policies.",
        "resource_registry.",
        "ui_resources.",
        "user_roles.",
        "security_",
      ]),
  },
  {
    key: "other",
    label: "Other",
    order: 99,
    match: () => true,
  },
].map((cat) => ({
  ...cat,
  match: (resourceKey: string, resource: UiResource) =>
    cat.match(canonicalizeResourceKey(resourceKey), resource),
}));
