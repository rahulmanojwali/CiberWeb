import { getUserRoleFromStorage } from "./roles";
import type { RoleSlug } from "../config/menuConfig";

export type UserScope = {
  role: RoleSlug | null;
  orgCode: string | null;
  allowedMandis: string[];
  rawUser: any | null;
};

const normalizeOrgCode = (code: unknown): string | null => {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  return trimmed ? trimmed : null;
};

const normalizeMandis = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
  }
  return [];
};

/**
 * Centralized helper to extract the user's role, org, and mandi scope
 * from localStorage cd_user. This replaces ad-hoc per-page parsing.
 */
export const getUserScope = (contextLabel: string = "global"): UserScope => {
  try {
    const raw = localStorage.getItem("cd_user");
    const rawUser = raw ? JSON.parse(raw) : null;

    const role = getUserRoleFromStorage(contextLabel);
    const orgCode =
      normalizeOrgCode(rawUser?.org_code) ||
      normalizeOrgCode(rawUser?.orgCode) ||
      normalizeOrgCode(rawUser?.organization_code) ||
      null;

    const mandis =
      normalizeMandis(rawUser?.mandis) ||
      normalizeMandis(rawUser?.allowed_mandis) ||
      normalizeMandis(rawUser?.allowedMandis) ||
      normalizeMandis(rawUser?.mandi_codes);

    return {
      role,
      orgCode,
      allowedMandis: mandis,
      rawUser,
    };
  } catch (error) {
    console.error("[userScope] failed to parse cd_user:", error);
    return { role: null, orgCode: null, allowedMandis: [], rawUser: null };
  }
};

export const isReadOnlyRole = (role: RoleSlug | null): boolean =>
  role === "ORG_VIEWER" || role === "AUDITOR" || role === "VIEWER";

export const isSuperAdmin = (role: RoleSlug | null): role is "SUPER_ADMIN" =>
  role === "SUPER_ADMIN";

export const isOrgAdmin = (role: RoleSlug | null): role is "ORG_ADMIN" =>
  role === "ORG_ADMIN";

export const isMandiRole = (role: RoleSlug | null): boolean =>
  role === "MANDI_ADMIN" || role === "MANDI_MANAGER";
