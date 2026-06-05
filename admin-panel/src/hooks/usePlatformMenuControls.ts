import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { getPlatformMenuControls } from "../services/platformControlCenterApi";
import { getPlatformMenuControls as extractPlatformMenuControls, type PlatformMenuControl } from "../utils/platformMenuVisibility";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function responseOk(resp: any) {
  return String(resp?.response?.responsecode ?? "1") === "0";
}

export function usePlatformMenuControls(fallbackResources: PlatformMenuControl[] = []) {
  const fallbackControls = useMemo(() => extractPlatformMenuControls(fallbackResources), [fallbackResources]);
  const [controls, setControls] = useState<PlatformMenuControl[]>(fallbackControls);

  useEffect(() => {
    setControls((current) => (current.length ? current : fallbackControls));
  }, [fallbackControls]);

  const loadMenuControls = useCallback(async () => {
    const user = getStoredUser();
    const username = String(user?.username || user?.email || "").trim().toLowerCase();
    if (!username) {
      setControls(fallbackControls);
      return;
    }
    try {
      const resp = await getPlatformMenuControls({
        username,
        country: user?.country || user?.country_code || DEFAULT_COUNTRY,
        language: user?.language || DEFAULT_LANGUAGE,
        role: user?.role_slug || user?.default_role_code || user?.role || "",
      });
      if (!responseOk(resp)) {
        setControls(fallbackControls);
        return;
      }
      const menus = resp?.response?.data?.menus;
      setControls(Array.isArray(menus) ? menus : fallbackControls);
    } catch (err) {
      console.error("[platformMenuControls] load failed", err);
      setControls(fallbackControls);
    }
  }, [fallbackControls]);

  useEffect(() => {
    loadMenuControls();
  }, [loadMenuControls]);

  useEffect(() => {
    window.addEventListener("platform-menu-controls-updated", loadMenuControls);
    return () => window.removeEventListener("platform-menu-controls-updated", loadMenuControls);
  }, [loadMenuControls]);

  return { controls, refreshPlatformMenuControls: loadMenuControls };
}
