import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { getAdminUsersWithRoles } from "../../services/adminUserRoles";
import { normalizeFlag } from "../../utils/statusUtils";

type UserRow = {
  username: string;
  email?: string | null;
  mobile?: string | null;
  is_active?: string | null;
  roles?: Array<{
    role_code: string;
    role_scope?: string | null;
    org_id?: string | null;
    is_active?: string;
  }>;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

const UserRoleManagerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo<GridColDef<UserRow>[]>(
    () => [
      { field: "username", headerName: "Username", flex: 1 },
      { field: "email", headerName: "Email", flex: 1 },
      { field: "mobile", headerName: "Mobile", flex: 1 },
      {
        field: "is_active",
        headerName: "Active",
        width: 120,
        renderCell: (params) => {
          const flag = normalizeFlag(params.value);
          const label = flag === "Y" ? "Active" : "Inactive";
          const color = flag === "Y" ? "success" : "default";
          return <Chip size="small" label={label} color={color} variant="outlined" />;
        },
      },
      {
        field: "roles",
        headerName: "Roles",
        flex: 1.5,
        renderCell: (params) => {
          const value = params.value as UserRow["roles"];
          if (!value || !value.length) return <Typography variant="body2">-</Typography>;
          return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {value.map((r, idx) => (
                <Chip
                  key={`${params.row.username}-${r.role_code}-${idx}`}
                  size="small"
                  label={r.role_code}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          );
        },
      },
    ],
    [],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) {
      setError("Not logged in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await getAdminUsersWithRoles({
        api: "getAdminUsersWithRoles",
        username,
        language,
        country: "IN",
      });
      const rc = resp?.response?.responsecode || "1";
      if (rc !== "0") {
        setError(resp?.response?.description || "Authorization failed.");
        setRows([]);
        return;
      }
      const list = resp?.data?.users || [];
      setRows(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language]);

  return (
    <PageContainer>
      <Stack spacing={1} mb={2}>
        <Typography variant="h5">{t("menu.userRoleManager", { defaultValue: "User Role Manager" })}</Typography>
        <Typography variant="body2" color="text.secondary">
          View admin users and their assigned roles.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows}
              loading={loading}
              autoHeight
              getRowId={(r) => r.username}
              hideFooterSelectedRowCount
            />
          </Box>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default UserRoleManagerPage;
