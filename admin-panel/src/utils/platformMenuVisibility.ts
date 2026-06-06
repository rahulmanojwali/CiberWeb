import { canonicalizeResourceKey, isDbActive, normalizeRoute } from "./adminUiConfig";

export type PlatformMenuControl = {
  resource_key?: string | null;
  resourceKey?: string | null;
  key?: string | null;
  route?: string | null;
  path?: string | null;
  href?: string | null;
  ui_type?: string | null;
  is_active?: any;
};

export function buildPlatformMenuControlIndexes(dbMenus: PlatformMenuControl[] = []) {
  const dbMenusByKey = new Map<string, PlatformMenuControl>();
  const dbMenusByRoute = new Map<string, PlatformMenuControl>();
  (dbMenus || []).forEach((menu) => {
    const key = canonicalizeResourceKey(menu?.resource_key || menu?.resourceKey || menu?.key);
    const route = normalizeRoute(menu?.route || menu?.path || menu?.href);
    if (key) dbMenusByKey.set(key, menu);
    if (route && !dbMenusByRoute.has(route)) dbMenusByRoute.set(route, menu);
  });
  return { dbMenusByKey, dbMenusByRoute };
}

export function shouldShowMenuItem(
  item: any,
  dbMenusByKey: Map<string, PlatformMenuControl>,
  dbMenusByRoute: Map<string, PlatformMenuControl>,
): boolean {
  const itemKey = canonicalizeResourceKey(item?.resource_key || item?.resourceKey || item?.key);
  const itemRoute = normalizeRoute(item?.route || item?.path || item?.href);

  let dbMenu: PlatformMenuControl | null = null;

  if (itemKey && dbMenusByKey.has(itemKey)) {
    dbMenu = dbMenusByKey.get(itemKey) || null;
  }

  if (!itemKey && itemRoute && dbMenusByRoute.has(itemRoute)) {
    dbMenu = dbMenusByRoute.get(itemRoute) || null;
  }

  if (!dbMenu) return true;
  return isDbActive(dbMenu.is_active);
}

export function isMenuVisibleByPlatformControl(item: any, dbMenus: PlatformMenuControl[] = []): boolean {
  const { dbMenusByKey, dbMenusByRoute } = buildPlatformMenuControlIndexes(dbMenus);
  return shouldShowMenuItem(item, dbMenusByKey, dbMenusByRoute);
}

export function getPlatformMenuControls(resources: PlatformMenuControl[] = []): PlatformMenuControl[] {
  return (resources || []).filter((resource) => String(resource?.ui_type || "").trim().toLowerCase() === "menu");
}

export function filterMenuTreeByPlatformControl<T extends { children?: T[] }>(
  items: T[] = [],
  dbMenus: PlatformMenuControl[] = [],
): T[] {
  const { dbMenusByKey, dbMenusByRoute } = buildPlatformMenuControlIndexes(dbMenus);
  return filterMenuTree(items, dbMenusByKey, dbMenusByRoute);
}

export function filterMenuTree<T extends { children?: T[] }>(
  items: T[] = [],
  dbMenusByKey: Map<string, PlatformMenuControl>,
  dbMenusByRoute: Map<string, PlatformMenuControl>,
): T[] {
  return (items || [])
    .map((item) => {
      const children = Array.isArray(item.children)
        ? filterMenuTree(item.children, dbMenusByKey, dbMenusByRoute)
        : [];
      const selfVisible = shouldShowMenuItem(item, dbMenusByKey, dbMenusByRoute);

      if (Array.isArray(item.children)) {
        return selfVisible || children.length > 0
          ? { ...item, children: children.length ? children : undefined }
          : null;
      }

      if (!selfVisible) return null;
      return {
        ...item,
        children: children.length ? children : undefined
      };
    })
    .filter(Boolean) as T[];
}
