import { type RoleSlug } from "../config/menuConfig";

// Canonical roles we expose in the UI
const ROLE_SET: Set<RoleSlug> = new Set<RoleSlug>([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
]);

// Map common backend/user-facing variants → canonical RoleSlug
export const ROLE_MAP: Record<string, RoleSlug> = {
  // Super admin
  SUPERADMIN: "SUPER_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  "SUPER ADMIN": "SUPER_ADMIN",
  ADMIN: "SUPER_ADMIN",

  // Org admin / viewer
  ORGADMIN: "ORG_ADMIN",
  ORG_ADMIN: "ORG_ADMIN",
  "ORG ADMIN": "ORG_ADMIN",

  ORGVIEWER: "ORG_VIEWER",
  ORG_VIEWER: "ORG_VIEWER",
  "ORG VIEWER": "ORG_VIEWER",

  // Mandi-level roles
  MANDIADMIN: "MANDI_ADMIN",
  MANDI_ADMIN: "MANDI_ADMIN",
  "MANDI ADMIN": "MANDI_ADMIN",

  MANDIMANAGER: "MANDI_MANAGER",
  MANDI_MANAGER: "MANDI_MANAGER",
  "MANDI MANAGER": "MANDI_MANAGER",

  AUCTIONEER: "AUCTIONEER",

  // Gate / Weighbridge
  GATEOPERATOR: "GATE_OPERATOR",
  GATE_OPERATOR: "GATE_OPERATOR",
  "GATE OPERATOR": "GATE_OPERATOR",

  WEIGHBRIDGEOPERATOR: "WEIGHBRIDGE_OPERATOR",
  WEIGHBRIDGE_OPERATOR: "WEIGHBRIDGE_OPERATOR",
  "WEIGHBRIDGE OPERATOR": "WEIGHBRIDGE_OPERATOR",

  // Auditor / Viewer
  AUDITOR: "AUDITOR",
  VIEWER: "VIEWER",
};

type ResolveContext = {
  contextLabel: string;
  sourceLabel: string;
};

const resolveRoleCandidate = (
  value: unknown,
  { contextLabel, sourceLabel }: ResolveContext,
): RoleSlug | null => {
  if (typeof value !== "string") {
    return null;
  }

  const upper = value.toUpperCase().trim();
  const normalized = upper.replace(/[\s-]+/g, "_");
  const cleaned = normalized.replace(/[^A-Z_]/g, "");
  const compressed = cleaned.replace(/_/g, "");

  const mapHit =
    ROLE_MAP[upper] ??
    ROLE_MAP[normalized] ??
    ROLE_MAP[cleaned] ??
    ROLE_MAP[compressed];

  const directHit =
    (ROLE_SET.has(normalized as RoleSlug) && (normalized as RoleSlug)) ||
    (ROLE_SET.has(cleaned as RoleSlug) && (cleaned as RoleSlug)) ||
    null;

  const finalRole = mapHit ?? directHit ?? null;

  console.log(`[roles/${contextLabel}] resolveRoleCandidate(${sourceLabel})`, {
    raw: value,
    upper,
    normalized,
    cleaned,
    compressed,
    mapHit,
    directHit,
    finalRole,
  });

  return finalRole;
};

/**
 * Reads cd_user from localStorage and maps any backend role string to our RoleSlug.
 * Adds verbose logging so we can inspect real payloads coming from the backend.
 */
export const getUserRoleFromStorage = (
  contextLabel: string = "global",
): RoleSlug | null => {
  try {
    const raw = localStorage.getItem("cd_user");
    console.log(`[roles/${contextLabel}] raw cd_user:`, raw);
    if (!raw) return null;

    const parsed: any = JSON.parse(raw);
    console.log(`[roles/${contextLabel}] parsed cd_user:`, parsed);

    const primaryCandidate: unknown =
      parsed?.default_role_code ??
      parsed?.default_role ??
      parsed?.role_slug ??
      parsed?.role ??
      parsed?.role_code ??
      parsed?.usertype ??
      null;

    const primaryRole = resolveRoleCandidate(primaryCandidate, {
      contextLabel,
      sourceLabel: "primaryCandidate",
    });
    if (primaryRole) return primaryRole;

    const rolesEnabled = parsed?.roles_enabled;
    if (rolesEnabled && typeof rolesEnabled === "object") {
      const firstEnabledKey = Object.keys(rolesEnabled).find(
        (key) => rolesEnabled[key],
      );
      console.log(
        `[roles/${contextLabel}] roles_enabled keys:`,
        Object.keys(rolesEnabled),
        "first enabled:",
        firstEnabledKey,
      );

      const enabledRole = resolveRoleCandidate(firstEnabledKey, {
        contextLabel,
        sourceLabel: "roles_enabled",
      });
      if (enabledRole) return enabledRole;
    }

    console.warn(
      `[roles/${contextLabel}] could not resolve role; falling back to viewer`,
    );
    return null;
  } catch (error) {
    console.error(`[roles/${contextLabel}] failed to parse cd_user:`, error);
    return null;
  }
};
