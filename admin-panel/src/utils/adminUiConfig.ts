export type UiResource = {
  resource_key: string;
  screen?: string | null;
  element?: string | null;
  ui_type: string;
  route?: string | null;
  parent_resource_key?: string | null;
  order?: number | null;
  icon_key?: string | null;
  i18n_label_key?: string | null;
  allowed_actions: string[];
  metadata?: Record<string, any> | null;
};

export type AdminScope = {
  org_code: string | null;
  org_id?: string | null;
  mandi_codes: string[];
  org_level?: string | null;
  mandi_level?: string | null;
  role_scope?: string | null;
};

export type AdminUiConfig = {
  role: string | null;
  scope: AdminScope | null;
  ui_resources: UiResource[];
  permissions: any[];
  resources?: UiResource[]; // compatibility alias
};

export function getResource(
  resources: UiResource[] | undefined,
  key: string,
): UiResource | undefined {
  if (!Array.isArray(resources) || !resources.length) return undefined;
  return resources.find((r) => r.resource_key === key);
}

export function can(
  resources: UiResource[] | undefined,
  key: string,
  action: string,
): boolean {
  if (!Array.isArray(resources) || !resources.length) return false;
  const res = getResource(resources, key);
  if (!res) return false;
  const normalizeAction = (val: string) => {
    const upper = (val || "").toUpperCase();
    if (upper === "EDIT") return "UPDATE";
    if (upper === "DELETE" || upper === "DISABLE" || upper === "TOGGLE") return "DEACTIVATE";
    if (upper === "VIEW_DETAIL") return "VIEW";
    return upper;
  };
  const actionsSrc: any[] =
    Array.isArray((res as any).allowed_actions) && (res as any).allowed_actions.length
      ? (res as any).allowed_actions
      : Array.isArray((res as any).actions)
        ? (res as any).actions
        : [];
  const actions = actionsSrc
    .map((a) => (typeof a === "string" ? normalizeAction(a) : ""))
    .filter(Boolean);
  const target = normalizeAction(action);
  if (actions.length === 0) return true; // permit when no explicit actions provided (SUPER_ADMIN payloads)
  if (actions.includes("*")) return true;
  return actions.includes(target);
}
