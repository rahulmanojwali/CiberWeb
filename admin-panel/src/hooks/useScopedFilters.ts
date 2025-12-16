import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const oidToString = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if ((v as any).$oid) return String((v as any).$oid);
  if ((v as any).oid) return String((v as any).oid);
  try {
    return String(v.toString());
  } catch {
    return null;
  }
};

type Options = {
  resourceKey: string;
  role?: string | null;
  org_code?: string | null;
  org_id?: string | null;
};

export function useScopedFilters({ resourceKey, role, org_code }: Options) {
  const [searchParams, setSearchParams] = useSearchParams();

  const isSuper = (role || "").toUpperCase() === "SUPER_ADMIN";
  const defaultOrgCode = isSuper ? "SYSTEM" : org_code || null;
  const defaultViewScope = isSuper ? "ALL" : "ORG_ASSIGNED";

  const storageOrgKey = `${resourceKey}.org_code`;
  const storageScopeKey = `${resourceKey}.view_scope`;

  const readStored = (key: string): string | null => {
    try {
      const val = localStorage.getItem(key);
      return val || null;
    } catch {
      return null;
    }
  };

  const initOrgCode = () =>
    searchParams.get("org_code") ||
    readStored(storageOrgKey) ||
    defaultOrgCode ||
    (isSuper ? "SYSTEM" : null);

  const initViewScope = () =>
    searchParams.get("view_scope") ||
    readStored(storageScopeKey) ||
    defaultViewScope;

  const [orgCode, setOrgCodeState] = useState<string | null>(initOrgCode());
  const [viewScope, setViewScopeState] = useState<string | null>(initViewScope());

  useEffect(() => {
    // keep search params in sync
    const next = new URLSearchParams(searchParams.toString());
    if (orgCode) next.set("org_code", orgCode);
    else next.delete("org_code");
    if (viewScope) next.set("view_scope", viewScope);
    else next.delete("view_scope");
    setSearchParams(next, { replace: true });

    try {
      if (orgCode) localStorage.setItem(storageOrgKey, orgCode);
      if (viewScope) localStorage.setItem(storageScopeKey, viewScope);
    } catch {
      // ignore
    }
  }, [orgCode, viewScope]);

  useEffect(() => {
    // if role changes, reset defaults when nothing stored
    if (!orgCode) setOrgCodeState(defaultOrgCode);
    if (!viewScope) setViewScopeState(defaultViewScope);
  }, [role]);

  const setOrgCode = (value: string | null) => {
    setOrgCodeState(value);
  };
  const setViewScope = (value: string | null) => {
    setViewScopeState(value);
  };

  return {
    orgCode,
    viewScope,
    setOrgCode,
    setViewScope,
    defaultOrgCode,
    defaultViewScope,
  };
}
