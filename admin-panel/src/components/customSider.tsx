import React from "react";
import {
  ThemedSider,
  RefineThemedLayoutSiderProps,
} from "@refinedev/mui";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export const CustomSider: React.FC<RefineThemedLayoutSiderProps> = (props) => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));

  // 👉 Hide vertical sidebar on mobile
  if (isSmall) {
    return null;
  }

  // 👉 Show normal sidebar on desktop
  return <ThemedSider {...props} />;
};
