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

export function isMenuVisibleByPlatformControl(item: any, dbMenus: PlatformMenuControl[] = []): boolean {
  const itemKey = canonicalizeResourceKey(item?.resource_key || item?.resourceKey || item?.key);
  const itemRoute = normalizeRoute(item?.route || item?.path || item?.href);

  const dbMenu = (dbMenus || []).find((menu) => {
    const dbKey = canonicalizeResourceKey(menu?.resource_key || menu?.resourceKey || menu?.key);
    const dbRoute = normalizeRoute(menu?.route || menu?.path || menu?.href);
    return Boolean(
      (itemKey && dbKey && itemKey === dbKey) ||
        (itemRoute && dbRoute && itemRoute === dbRoute),
    );
  });

  if (!dbMenu) return true;
  return isDbActive(dbMenu.is_active);
}

export function getPlatformMenuControls(resources: PlatformMenuControl[] = []): PlatformMenuControl[] {
  return (resources || []).filter((resource) => String(resource?.ui_type || "").trim().toLowerCase() === "menu");
}

export function filterMenuTreeByPlatformControl<T extends { children?: T[] }>(
  items: T[] = [],
  dbMenus: PlatformMenuControl[] = [],
): T[] {
  return (items || [])
    .map((item) => {
      const children = item.children?.length ? filterMenuTreeByPlatformControl(item.children, dbMenus) : [];
      const selfVisible = isMenuVisibleByPlatformControl(item, dbMenus);
      const isGroup = Boolean(item.children?.length) && !(item as any).path && !(item as any).route && !(item as any).href;
      if (!selfVisible) return null;
      if (isGroup && children.length === 0) return null;
      return {
        ...item,
        children: children.length ? children : undefined,
      };
    })
    .filter(Boolean) as T[];
}
