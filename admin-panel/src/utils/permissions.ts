import { canonicalizeResourceKey } from "./adminUiConfig";

function normalizeActionName(value: any): string {
  const upper = String(value || "").trim().toUpperCase();
  if (upper === "ADD" || upper === "INSERT") return "CREATE";
  if (upper === "EDIT") return "UPDATE";
  if (upper === "DELETE" || upper === "DISABLE" || upper === "REMOVE") return "DEACTIVATE";
  if (upper === "DETAIL") return "VIEW";
  return upper;
}

export function normalizePermissionActions(permission: any): string[] {
  const raw =
    permission?.actions ??
    permission?.allowed_actions ??
    permission?.allowedActions ??
    permission?.permissions ??
    [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => (item && typeof item === "object" && "action" in item ? item.action : item))
      .map(normalizeActionName)
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map(normalizeActionName)
      .filter(Boolean);
  }

  return [];
}

export function normalizePermissionKey(permission: any): string {
  return String(
    permission?.resource_key ??
      permission?.resourceKey ??
      permission?.key ??
      permission?.resource ??
      "",
  ).trim();
}

export function buildPermissionMap(rawPermissions: any[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  (rawPermissions || []).forEach((permission) => {
    const key = normalizePermissionKey(permission);
    let actions = normalizePermissionActions(permission);

    if (actions.length === 0 && Array.isArray(permission?.allowed_actions)) {
      actions = normalizePermissionActions({ actions: permission.allowed_actions });
    }

    if (!key) return;
    if (!map[key]) map[key] = [];

    actions.forEach((action) => {
      if (!map[key].includes(action)) {
        map[key].push(action);
      }
    });

    if (actions.length === 0) {
      console.warn("Permission actions missing for", key, permission);
    }
  });

  return map;
}

export function buildCanonicalPermissionMap(rawPermissions: any[]): Record<string, string[]> {
  const rawMap = buildPermissionMap(rawPermissions);
  const canonicalMap: Record<string, string[]> = {};

  Object.entries(rawMap).forEach(([rawKey, actions]) => {
    const key = canonicalizeResourceKey(rawKey);
    if (!key) return;
    if (!canonicalMap[key]) canonicalMap[key] = [];
    actions.forEach((action) => {
      if (!canonicalMap[key].includes(action)) {
        canonicalMap[key].push(action);
      }
    });
  });

  return canonicalMap;
}

export function can(permissionMap: Record<string, string[]>, key: string, action = "VIEW") {
  const actions = permissionMap[String(key).trim()] || [];
  return actions.includes(String(action).trim().toUpperCase());
}
