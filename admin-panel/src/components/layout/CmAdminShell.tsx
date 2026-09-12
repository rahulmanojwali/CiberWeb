import React from "react";
import Box from "@mui/material/Box";
import { Header } from "../header";
import { CustomSider } from "../customSider";

export const CmAdminShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Box className="cm-admin-shell">
      <Header />

      <Box className="cm-admin-body">
        <Box className="cm-admin-sidebar-slot">
          <CustomSider />
        </Box>

        <Box className="cm-admin-workspace">
          <Box component="main" className="cm-admin-main">
            <Box className="cm-admin-content">{children}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
