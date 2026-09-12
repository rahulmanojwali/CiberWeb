import React, { useEffect, useMemo, useState } from "react";
import type { MenuProps } from "antd";
import { Button, Menu, Tooltip, Typography } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import {
  filterMenuByRole,
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";
import { getUserRoleFromStorage } from "../utils/roles";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import { useMenuNavigation } from "../hooks/useMenuNavigation";
import { filterMenuTreeByPlatformControl } from "../utils/platformMenuVisibility";
import { usePlatformMenuControls } from "../hooks/usePlatformMenuControls";
import { resolveMenuLabel } from "../utils/uiLabel";
import { CM_SHELL } from "../design-system/theme/tokens";

const { Text } = Typography;

type AntMenuItem = Required<MenuProps>["items"][number];

const itemKey = (item: NavMenuItem, fallback: string) =>
  String(item.key || item.resourceKey || item.path || item.labelKey || fallback);

export const CustomSider: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const menuNavigate = useMenuNavigation();

  const {
    ui_resources,
    resources: compatResources,
    role: configRole,
    loading: loadingUiConfig,
    refresh: refreshAdminUiConfig,
  } = useAdminUiConfig();

  const storageRole = getUserRoleFromStorage("CustomSider");
  const effectiveRole = (configRole as any) || storageRole;
  const { permissionsMap, loadingPermissions, isSuper } = usePermissions();
  const isSuperAdmin = isSuper;

  const menuResources = ui_resources?.length ? ui_resources : compatResources || [];
  const resourcesCount = menuResources?.length || 0;
  const { controls: platformMenuControls } = usePlatformMenuControls(menuResources);

  const [collapsed, setCollapsed] = useState(false);
  const [navItems, setNavItems] = useState<NavMenuItem[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    try {
      if (resourcesCount === 0) {
        setMenuError(null);
        setNavItems(!loadingUiConfig && isSuperAdmin ? filterMenuByRole("SUPER_ADMIN") : []);
        return;
      }

      if (loadingPermissions) {
        setMenuError(null);
        setNavItems([]);
        return;
      }

      const built = filterMenuByResources(menuResources, effectiveRole, permissionsMap);
      if (built.length === 0 && isSuperAdmin) {
        setMenuError(null);
        setNavItems(filterMenuByRole("SUPER_ADMIN"));
        return;
      }

      if (resourcesCount > 0 && built.length === 0 && !isSuperAdmin) {
        setMenuError("No menu access assigned. Contact admin.");
        setNavItems([]);
        return;
      }

      setMenuError(null);
      setNavItems(built);
    } catch (error) {
      console.error("[sidebar] build failed", error, {
        resourcesSample: (menuResources || []).slice(0, 5),
      });
      setMenuError("Menu failed to load.");
      setNavItems([]);
    }
  }, [
    effectiveRole,
    isSuperAdmin,
    loadingPermissions,
    loadingUiConfig,
    menuResources,
    permissionsMap,
    resourcesCount,
  ]);

  useEffect(() => {
    const loadMenuControls = () => {
      refreshAdminUiConfig({ invalidate: true }).catch((error) => {
        console.error("[sidebar] platform menu controls refresh failed", error);
      });
    };

    window.addEventListener("platform-menu-controls-updated", loadMenuControls);
    return () => window.removeEventListener("platform-menu-controls-updated", loadMenuControls);
  }, [refreshAdminUiConfig]);

  const visibleNavItems = useMemo(
    () => filterMenuTreeByPlatformControl(navItems, platformMenuControls),
    [navItems, platformMenuControls],
  );

  const translateMenuLabel = (menuItem: NavMenuItem) => {
    if (menuItem.labelOverride && String(menuItem.labelOverride).trim()) {
      return resolveMenuLabel({ ...menuItem, label: menuItem.labelOverride });
    }

    const translated = t(menuItem.labelKey, { defaultValue: menuItem.labelKey });
    return (
      resolveMenuLabel({
        ...menuItem,
        label: translated,
        i18n_label_key: menuItem.labelKey,
        resource_key: menuItem.resourceKey,
      }) || translated
    );
  };

  const menuModel = useMemo(() => {
    const pathByKey = new Map<string, NavMenuItem>();
    const parentByKey = new Map<string, string>();

    const build = (items: NavMenuItem[], parentKey?: string): AntMenuItem[] =>
      items.map((item, index) => {
        const key = itemKey(item, `${parentKey || "root"}-${index}`);
        pathByKey.set(key, item);
        if (parentKey) parentByKey.set(key, parentKey);

        const children = item.children?.length ? build(item.children, key) : undefined;
        return {
          key,
          icon: item.icon || undefined,
          label: translateMenuLabel(item),
          disabled: (item as any).disabled === true,
          children,
        } as AntMenuItem;
      });

    return {
      items: build(visibleNavItems),
      pathByKey,
      parentByKey,
    };
  }, [visibleNavItems, t]);

  const selectedKey = useMemo(() => {
    let winner: { key: string; length: number } | null = null;

    menuModel.pathByKey.forEach((item, key) => {
      if (!item.path) return;
      if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
        if (!winner || item.path.length > winner.length) {
          winner = { key, length: item.path.length };
        }
      }
    });

    return winner?.key || "";
  }, [location.pathname, menuModel.pathByKey]);

  useEffect(() => {
    if (!selectedKey || collapsed) return;

    const ancestors: string[] = [];
    let parent = menuModel.parentByKey.get(selectedKey);
    while (parent) {
      ancestors.unshift(parent);
      parent = menuModel.parentByKey.get(parent);
    }

    if (ancestors.length) {
      setOpenKeys((current) => Array.from(new Set([...current, ...ancestors])));
    }
  }, [collapsed, menuModel.parentByKey, selectedKey]);

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    const item = menuModel.pathByKey.get(String(key));
    if (item?.path) {
      menuNavigate(item.path, item.resourceKey);
    }
  };

  const siderWidth = collapsed ? CM_SHELL.sidebarCollapsedWidth : CM_SHELL.sidebarWidth;

  return (
    <aside
      className={`cm-ant-sider${collapsed ? " cm-ant-sider--collapsed" : ""}`}
      style={{ width: siderWidth }}
      aria-label="Primary navigation"
    >
      <div className="cm-ant-sider-toolbar">
        {!collapsed && <Text className="cm-ant-sider-caption">Navigation</Text>}
        <Tooltip title={collapsed ? "Expand navigation" : "Collapse navigation"} placement="right">
          <Button
            type="text"
            className="cm-ant-sider-collapse"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          />
        </Tooltip>
      </div>

      <div className="cm-ant-sider-scroll">
        {menuError && (
          <div className="cm-ant-sider-message cm-ant-sider-message--error">
            {menuError}
          </div>
        )}

        {!menuError && loadingPermissions && visibleNavItems.length === 0 && (
          <div className="cm-ant-sider-message">Loading menu…</div>
        )}

        {!menuError && !loadingPermissions && visibleNavItems.length === 0 && !isSuperAdmin && (
          <div className="cm-ant-sider-message">No menu access assigned</div>
        )}

        <Menu
          className="cm-ant-navigation"
          mode="inline"
          inlineCollapsed={collapsed}
          items={menuModel.items}
          selectedKeys={selectedKey ? [selectedKey] : []}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys.map(String))}
          onClick={handleMenuClick}
        />
      </div>
    </aside>
  );
};
