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
  mandi_codes: string[];
  org_level?: string | null;
  mandi_level?: string | null;
  role_scope?: string | null;
};

export type AdminUiConfig = {
  role: string | null;
  scope: AdminScope | null;
  resources: UiResource[];
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
  const actions = Array.isArray(res.allowed_actions)
    ? res.allowed_actions.map((a) => (typeof a === "string" ? a.toUpperCase() : "")).filter(Boolean)
    : [];
  return actions.includes(action.toUpperCase());
}
