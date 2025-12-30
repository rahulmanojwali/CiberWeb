import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { canonicalizeResourceKey } from "../utils/adminUiConfig";
import { getStepupLockedSet } from "../utils/stepupCache";

export type MenuNavigateFn = (
  path: string,
  resourceKey?: string,
  afterNavigate?: () => void,
) => void;

export function useMenuNavigation(): MenuNavigateFn {
  const navigate = useNavigate();
  return useCallback(
    (path, resourceKey, afterNavigate) => {
      if (!path) return;
      const normalizedKey = canonicalizeResourceKey(resourceKey);
      const lockedSet = getStepupLockedSet();
      const isLocked = Boolean(normalizedKey && lockedSet.has(normalizedKey));
      console.log(
        "[MENU_NAV]",
        `key=${normalizedKey || "unknown"}`,
        `route=${path}`,
        `locked=${isLocked}`,
      );
      navigate(path);
      if (typeof afterNavigate === "function") {
        afterNavigate();
      }
    },
    [navigate],
  );
}
