import React from "react";
import { ConfigProvider } from "antd";
import type { ThemeConfig } from "antd";
import { CM_COLORS, CM_RADII } from "./theme/tokens";

const cmAntTheme: ThemeConfig = {
  token: {
    colorPrimary: CM_COLORS.primary,
    colorInfo: CM_COLORS.info,
    colorSuccess: CM_COLORS.success,
    colorWarning: CM_COLORS.warning,
    colorError: CM_COLORS.error,
    colorText: CM_COLORS.text,
    colorTextSecondary: CM_COLORS.textMuted,
    colorTextTertiary: CM_COLORS.textSubtle,
    colorBgBase: CM_COLORS.background,
    colorBgContainer: CM_COLORS.surface,
    colorBgLayout: CM_COLORS.background,
    colorBorder: CM_COLORS.border,
    colorBorderSecondary: CM_COLORS.border,
    borderRadius: CM_RADII.sm,
    borderRadiusLG: CM_RADII.md,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    controlHeight: 38,
    controlHeightSM: 32,
    wireframe: false,
  },
  components: {
    Button: {
      borderRadius: CM_RADII.sm,
      fontWeight: 700,
      primaryShadow: "none",
    },
    Card: {
      borderRadiusLG: CM_RADII.md,
      headerBg: CM_COLORS.surface,
    },
    Table: {
      headerBg: CM_COLORS.surfaceMuted,
      headerColor: CM_COLORS.textMuted,
      rowHoverBg: CM_COLORS.backgroundElevated,
      borderColor: CM_COLORS.border,
    },
    Tag: {
      borderRadiusSM: CM_RADII.xs,
    },
    Input: {
      activeBorderColor: CM_COLORS.primary,
      hoverBorderColor: CM_COLORS.primarySoft,
    },
    Select: {
      activeBorderColor: CM_COLORS.primary,
      hoverBorderColor: CM_COLORS.primarySoft,
      optionSelectedBg: CM_COLORS.sidebarActive,
    },
    Menu: {
      itemBorderRadius: CM_RADII.sm,
      itemSelectedBg: CM_COLORS.sidebarActive,
      itemSelectedColor: CM_COLORS.primaryDeep,
      itemHoverBg: CM_COLORS.backgroundElevated,
      itemHoverColor: CM_COLORS.primaryDeep,
    },
  },
};

export const CmAntDesignProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
  <ConfigProvider theme={cmAntTheme}>{children}</ConfigProvider>
);
