import React from "react";
import { Paper, Typography, Divider, Stack } from "@mui/material";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const PermissionsDebugPanel: React.FC = () => {
  if (typeof window === "undefined") return null;
  const debug = window.location.search.includes("debugAuth=1");
  if (!debug) return null;

  const uiConfig = useAdminUiConfig();
  const { can, permissionsMap, authContext, isSuper } = usePermissions();
  const user = getStoredUser();

  const resources = uiConfig.resources || [];
  const mandisEdit = can("mandis.edit", "UPDATE");
  const mandisDeactivate = can("mandis.deactivate", "DEACTIVATE");

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        bottom: 12,
        right: 12,
        width: 340,
        maxHeight: "70vh",
        overflow: "auto",
        p: 1.5,
        zIndex: 2000,
        border: "1px solid",
        borderColor: "divider",
        background: "rgba(255,255,255,0.95)",
      }}
    >
      <Stack spacing={0.75}>
        <Typography variant="subtitle2">Permissions Debug</Typography>
        <Typography variant="caption">
          User: {user?.username || "unknown"} • Role: {authContext.role || "-"} • Org:{" "}
          {authContext.org_code || "-"} ({authContext.org_id || "no-id"}) {isSuper ? "• SUPER" : ""}
        </Typography>
        <Divider />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Page checks
        </Typography>
        <Typography variant="caption">can(mandis.edit, UPDATE): {String(mandisEdit)}</Typography>
        <Typography variant="caption">can(mandis.deactivate, DEACTIVATE): {String(mandisDeactivate)}</Typography>
        <Divider />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Resources ({resources.length})
        </Typography>
        <Stack spacing={0.5}>
          {resources.map((r: any) => (
            <Typography key={r.resource_key} variant="caption" sx={{ display: "block" }}>
              {r.resource_key}: [{(r.allowed_actions || r.actions || []).join(", ")}]
            </Typography>
          ))}
        </Stack>
        <Divider />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Map keys ({Object.keys(permissionsMap).length})
        </Typography>
        <Stack spacing={0.5}>
          {Object.entries(permissionsMap).map(([key, actions]) => (
            <Typography key={key} variant="caption" sx={{ display: "block" }}>
              {key}: [{Array.from(actions).join(", ")}]
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};
