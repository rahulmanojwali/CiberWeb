import { useMemo } from "react";

type RecordLike = {
  org_scope?: string | null;
  org_id?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
};

type AuthContext = {
  role: string | null;
  org_id: string | null;
  org_code?: string | null;
  isSuper?: boolean;
};

const oidToString = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v.$oid) return String(v.$oid);
  if (v.oid) return String(v.oid);
  try {
    return String(v.toString());
  } catch {
    return null;
  }
};

export function useRecordLock() {
  const checkLocked = (record: RecordLike | null | undefined, auth: AuthContext) => {
    if (!record) return { locked: false, reason: "" };
    const isProtected = String(record.is_protected || "").toUpperCase() === "Y";
    const orgScope = (record.org_scope || "").toUpperCase();
    const ownerType = (record.owner_type || "").toUpperCase();
    const recOrgId = oidToString(record.org_id || record.owner_org_id);
    const userOrgId = oidToString(auth?.org_id);
    const isSuper = auth?.isSuper || auth?.role === "SUPER_ADMIN";

    if (isProtected || orgScope === "GLOBAL" || ownerType === "SYSTEM") {
      return { locked: !isSuper, reason: "protected_or_global" };
    }
    if (orgScope === "ORG") {
      const sameOrg = recOrgId && userOrgId && recOrgId === userOrgId;
      if (!sameOrg && !isSuper) {
        return { locked: true, reason: "org_mismatch" };
      }
    }
    return { locked: false, reason: "" };
  };

  return useMemo(() => ({ isRecordLocked: checkLocked }), []);
}
