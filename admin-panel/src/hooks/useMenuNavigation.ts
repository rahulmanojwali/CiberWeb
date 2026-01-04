import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { canonicalizeResourceKey } from "../utils/adminUiConfig";
import { useStepUp } from "../security/stepup/useStepUp";

export type MenuNavigateFn = (
  path: string,
  resourceKey?: string,
  afterNavigate?: () => void,
) => Promise<void>;

export function useMenuNavigation(): MenuNavigateFn {
  const navigate = useNavigate();
  const { ensureStepUp, isLocked } = useStepUp();
  return useCallback(
    async (path, resourceKey, afterNavigate) => {
      if (!path) return;
      const normalizedKey = canonicalizeResourceKey(resourceKey);
      const locked = Boolean(normalizedKey && isLocked(normalizedKey));
      console.log(
        "[MENU_NAV]",
        `key=${normalizedKey || "unknown"}`,
        `route=${path}`,
        `locked=${locked}`,
      );
      console.log("[MENU_NAV] clicked path", path);
      const ok = await ensureStepUp(resourceKey, "VIEW", { source: "MENU" });
      if (!ok) return;
      navigate(path);
      if (typeof window !== "undefined") {
        console.log("[MENU_NAV] navigated ->", window.location.pathname);
      }
      if (typeof afterNavigate === "function") {
        afterNavigate();
      }
    },
    [ensureStepUp, isLocked, navigate],
  );
}
