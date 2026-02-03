import { canonicalizeResourceKey, type UiResource } from "./adminUiConfig";

export type PermissionEntry = { resource_key: string; actions?: string[] };

export type ResourceNode = UiResource & { children?: ResourceNode[] };

export const normalizeAction = (action: string): string =>
  String(action || "").trim().toUpperCase();

export const indexPermissions = (
  permissions: PermissionEntry[] = [],
): Record<string, Set<string>> => {
  const index: Record<string, Set<string>> = {};
  permissions.forEach((perm) => {
    const key = canonicalizeResourceKey(perm.resource_key || "");
    if (!key) return;
    const actions = Array.isArray(perm.actions) ? perm.actions : [];
    index[key] = new Set(actions.map(normalizeAction));
  });
  return index;
};

export const hasAccess = (
  permIndex: Record<string, Set<string>> | undefined,
  resourceKey: string,
  action: string,
): boolean => {
  if (!permIndex) return false;
  const key = canonicalizeResourceKey(resourceKey);
  if (!key) return false;
  const set = permIndex[key];
  if (!set || set.size === 0) return false;
  return set.has(normalizeAction(action));
};

export const requiredActionForUiResource = (
  uiType: string,
  actionCode?: string | null,
): string => {
  const type = String(uiType || "").trim().toUpperCase();
  if (type === "MENU") return "VIEW";
  if (type === "TABLE" || type === "PAGE" || type === "SCREEN" || type === "TAB") return "VIEW";
  if (type === "BUTTON") return normalizeAction(actionCode || "");
  return "VIEW";
};

const isActive = (resource: UiResource) => {
  const active = (resource as any)?.is_active;
  return active === true || active === "Y";
};

export const filterResourcesByAccess = (
  resources: UiResource[] = [],
  permIndex: Record<string, Set<string>>,
): UiResource[] =>
  resources.filter((res) => {
    if (!isActive(res)) return false;
    const required = requiredActionForUiResource(res.ui_type, (res as any).action_code);
    if (!required) return false;
    return hasAccess(permIndex, res.resource_key, required);
  });

export const buildResourceTree = (resources: UiResource[] = []): ResourceNode[] => {
  const byKey = new Map<string, ResourceNode>();
  resources.forEach((res) => {
    const key = canonicalizeResourceKey(res.resource_key || "");
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, { ...res });
  });

  const roots: ResourceNode[] = [];
  byKey.forEach((node) => {
    const parentKey = canonicalizeResourceKey(node.parent_resource_key || "");
    if (parentKey && byKey.has(parentKey)) {
      const parent = byKey.get(parentKey)!;
      parent.children = parent.children ? [...parent.children, node] : [node];
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: ResourceNode[]) => {
    nodes.sort((a, b) => {
      const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const keyA = String(a.resource_key || a.element || "");
      const keyB = String(b.resource_key || b.element || "");
      return keyA.localeCompare(keyB);
    });
    nodes.forEach((node) => {
      if (node.children?.length) sortNodes(node.children);
    });
  };
  sortNodes(roots);
  return roots;
};

export const computeAllowedSidebar = (
  resources: UiResource[] = [],
  permIndex: Record<string, Set<string>>,
): ResourceNode[] => {
  const isMenu = (res: UiResource) => String(res.ui_type || "").toUpperCase() === "MENU";
  const isActiveResource = (res: UiResource) => {
    const active = (res as any)?.is_active;
    return active === true || active === "Y";
  };
  const allowedMenus = resources
    .filter((res) => isMenu(res) && isActiveResource(res))
    .filter((res) => hasAccess(permIndex, res.resource_key, "VIEW"));

  return [...allowedMenus];
};
