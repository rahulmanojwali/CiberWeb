import React from "react";
import {
  ThemedLayout,
  ThemedSider,
  RefineThemedLayoutProps,
  RefineThemedLayoutSiderProps,
} from "@refinedev/mui";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import { Header } from "../header";

/**
 * Custom sider for your version of Refine
 */
const CustomSider: React.FC<RefineThemedLayoutSiderProps> = (props) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));

  // Hide vertical sidebar on mobile
  if (isSmall) return null;

  return <ThemedSider {...props} />;
};

/**
 * Custom Layout for your Refine version
 */
export const Layout: React.FC<RefineThemedLayoutProps> = (props) => {
  return (
    <ThemedLayout
      Header={Header}
      Sider={CustomSider}
      {...props}
    />
  );
};
