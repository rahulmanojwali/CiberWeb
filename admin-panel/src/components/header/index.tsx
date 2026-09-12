import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Menu,
  Space,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
} from "@ant-design/icons";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { ColorModeContext } from "../../contexts/color-mode";
import { BRAND_ASSETS, DEFAULT_LANGUAGE } from "../../config/appConfig";
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} from "../../config/languages";
import {
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../../config/menuConfig";
import { getUserRoleFromStorage } from "../../utils/roles";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { useMenuNavigation } from "../../hooks/useMenuNavigation";
import { filterMenuTreeByPlatformControl } from "../../utils/platformMenuVisibility";
import { usePlatformMenuControls } from "../../hooks/usePlatformMenuControls";

const { Text, Title } = Typography;

const flattenNavMenuItems = (items: NavMenuItem[]): NavMenuItem[] => {
  const flattened: NavMenuItem[] = [];
  items.forEach((item) => {
    if (item.path) flattened.push(item);
    if (item.children?.length) flattened.push(...flattenNavMenuItems(item.children));
  });
  return flattened;
};

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

type HeaderProps = {
  sticky?: boolean;
};

export const Header: React.FC<HeaderProps> = ({ sticky = true }) => {
  const { mode, setMode } = useContext(ColorModeContext);
  const { mutate: logout } = useLogout();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const menuNavigate = useMenuNavigation();
  const screens = Grid.useBreakpoint();
  const isSmall = !screens.md;

  const { data: user } = useGetIdentity<IUser>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentLanguage = normalizeLanguageCode(
    i18n.language || DEFAULT_LANGUAGE,
  );

  const {
    ui_resources,
    role: configRole,
    resources: compatResources,
  } = useAdminUiConfig();
  const { permissionsMap, loadingPermissions } = usePermissions();

  const role = getUserRoleFromStorage("Header");
  const effectiveRole = (configRole as any) || role;
  const roleLabel = String(effectiveRole || "ADMIN").replace(/_/g, " ");

  const menuResources = ui_resources?.length
    ? ui_resources
    : compatResources || [];
  const { controls: platformMenuControls } = usePlatformMenuControls(menuResources);

  const navItems: NavMenuItem[] = useMemo(() => {
    if (loadingPermissions) return [];
    const items = filterMenuByResources(
      menuResources,
      effectiveRole,
      permissionsMap,
    );
    return filterMenuTreeByPlatformControl(items, platformMenuControls);
  }, [
    effectiveRole,
    loadingPermissions,
    menuResources,
    permissionsMap,
    platformMenuControls,
  ]);

  const flattenedNavItems = useMemo(
    () => flattenNavMenuItems(navItems),
    [navItems],
  );

  const menuLabel = (item: NavMenuItem) =>
    item.labelOverride && String(item.labelOverride).trim()
      ? String(item.labelOverride)
      : t(item.labelKey);

  const antMenuItems = useMemo<MenuProps["items"]>(() => {
    const build = (items: NavMenuItem[]): MenuProps["items"] =>
      items.map((item, index) => {
        const hasChildren = !!item.children?.length && !item.path;
        const key = item.path || `group:${item.key || item.labelKey || index}`;
        return {
          key,
          icon: item.icon || undefined,
          label: menuLabel(item),
          children: hasChildren ? build(item.children || []) : undefined,
          disabled: (item as any).disabled === true,
        } as any;
      });
    return build(navItems);
  }, [navItems, t]);

  const selectedMobileKey = useMemo(() => {
    const path = location.pathname.toLowerCase();
    const matched = flattenedNavItems
      .filter((item) => item.path && path.startsWith(item.path.toLowerCase()))
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    return matched?.path ? [matched.path] : [];
  }, [flattenedNavItems, location.pathname]);

  const currentSection = useMemo(() => {
    const path = location.pathname.toLowerCase();
    const matched = flattenedNavItems
      .filter((item) => item.path && path.startsWith(item.path.toLowerCase()))
      .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];

    if (matched) return menuLabel(matched);
    return path.includes("dashboard") ? "Command Center" : "Operations Console";
  }, [flattenedNavItems, location.pathname, t]);

  useEffect(() => {
    document.title = "CiberMandi Admin Console";
  }, []);

  const handleLanguageChange = (next: string) => {
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // localStorage can be unavailable in hardened browser contexts.
    }
  };

  const handleMobileMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (!String(key).startsWith("/")) return;
    const item = flattenedNavItems.find((navItem) => navItem.path === key);
    menuNavigate(String(key), item?.resourceKey, () => setMobileMenuOpen(false));
  };

  const currentLanguageOption =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage) ||
    SUPPORTED_LANGUAGES[0];

  const languageMenuItems: MenuProps["items"] = SUPPORTED_LANGUAGES.map((lang) => ({
    key: lang.code,
    label: (
      <div className="cm-language-menu-item">
        <span className="cm-language-menu-copy">
          <span className="cm-language-menu-native">{lang.nativeLabel}</span>
          <span className="cm-language-menu-english">{lang.label}</span>
        </span>
        {lang.code === currentLanguage ? <CheckOutlined /> : null}
      </div>
    ),
  }));

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "identity",
      disabled: true,
      label: (
        <div className="cm-profile-menu-identity">
          <strong>{user?.name || roleLabel}</strong>
          <span>{roleLabel}</span>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "logout",
      danger: true,
      icon: <LogoutOutlined />,
      label: "Sign out",
    },
  ];

  return (
    <>
      <header
        className={`cm-topbar cm-ant-topbar${sticky ? " cm-topbar-sticky" : ""}`}
      >
        <div className="cm-topbar-inner">
          <div className="cm-topbar-leading">
            {isSmall && (
              <Button
                type="text"
                className="cm-ant-icon-button"
                aria-label="Open navigation"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuOpen(true)}
              />
            )}

            <img
              src={BRAND_ASSETS.logo}
              alt="CiberMandi"
              className="cm-topbar-logo"
            />

            <div className="cm-topbar-heading">
              <Text className="cm-topbar-eyebrow">CiberMandi</Text>
              <Title level={4} className="cm-topbar-title" ellipsis>
                {currentSection}
              </Title>
            </div>
          </div>

          <div className="cm-topbar-actions">
            {!isSmall && (
              <Tag className="cm-topbar-role-pill" bordered={false}>
                <span className="cm-topbar-role-dot" />
                {roleLabel}
              </Tag>
            )}

            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{
                items: languageMenuItems,
                selectedKeys: [currentLanguage],
                onClick: ({ key }) => handleLanguageChange(String(key)),
              }}
              overlayClassName="cm-language-dropdown"
            >
              <Button
                type="text"
                className="cm-topbar-language-button"
                aria-label="Change language"
              >
                <GlobalOutlined />
                {!isSmall && (
                  <span className="cm-topbar-language-label">
                    {currentLanguageOption?.label || "English"}
                  </span>
                )}
                <DownOutlined className="cm-topbar-language-chevron" />
              </Button>
            </Dropdown>

            <Badge dot offset={[-5, 5]}>
              <Button
                type="text"
                className="cm-ant-icon-button"
                aria-label="Notifications"
                icon={<BellOutlined />}
              />
            </Badge>

            <Button
              type="text"
              className="cm-ant-icon-button"
              aria-label="Toggle theme"
              icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={setMode}
            />

            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              menu={{
                items: profileMenuItems,
                onClick: ({ key }) => {
                  if (key === "logout") logout();
                },
              }}
              overlayClassName="cm-profile-dropdown"
            >
              <Button
                type="text"
                className="cm-topbar-profile-button"
                aria-label="Open profile menu"
              >
                <Avatar src={user?.avatar} className="cm-topbar-avatar">
                  {(user?.name || roleLabel).charAt(0).toUpperCase()}
                </Avatar>
                {!isSmall && (
                  <div className="cm-topbar-profile-copy">
                    <Text className="cm-topbar-profile-name">
                      {user?.name || roleLabel}
                    </Text>
                    <Text className="cm-topbar-profile-role">Signed in</Text>
                  </div>
                )}
                <DownOutlined className="cm-topbar-profile-chevron" />
              </Button>
            </Dropdown>
          </div>
        </div>
      </header>

      <Drawer
        className="cm-ant-mobile-drawer"
        rootClassName="cm-ant-mobile-drawer-root"
        title={
          <Space size={10}>
            <img
              src={BRAND_ASSETS.logo}
              alt="CiberMandi"
              className="cm-mobile-drawer-logo"
            />
            <div className="cm-mobile-drawer-heading">
              <Text strong className="cm-mobile-drawer-brand">CiberMandi</Text>
              <Text className="cm-mobile-drawer-role">{roleLabel}</Text>
            </div>
          </Space>
        }
        placement="left"
        width={320}
        open={mobileMenuOpen && isSmall}
        onClose={() => setMobileMenuOpen(false)}
      >
        <Menu
          mode="inline"
          items={antMenuItems}
          selectedKeys={selectedMobileKey}
          onClick={handleMobileMenuClick}
          className="cm-ant-mobile-menu"
        />
      </Drawer>
    </>
  );
};
