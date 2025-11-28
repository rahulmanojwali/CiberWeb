import React, { useEffect, useState, useMemo } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchCommodities } from "../../services/mandiApi";

type CommodityRow = {
  id: number;
  commodity_id: number;
  name: string;
  is_active: boolean;
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

export const Commodities: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const canCreate = useMemo(
    () => can(uiConfig.resources, "commodities.create", "CREATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<CommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
    ],
    [],
  );

  useEffect(() => {
    const username = currentUsername();
    if (!username) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchCommodities({ username, language });
        const list = res?.data?.commodities || [];
        setRows(
          list.map((c: any) => ({
            id: c.commodity_id,
            commodity_id: c.commodity_id,
            name: c?.name_i18n?.en || c.slug || String(c.commodity_id),
            is_active: Boolean(c.is_active),
          })),
        );
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [language]);

  return (
    <PageContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">{t("menu.commodities", { defaultValue: "Commodities" })}</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} disabled={!canCreate}>
          {t("actions.create", { defaultValue: "Create" })}
        </Button>
      </Stack>
      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid
          columns={columns}
          rows={rows}
          loading={loading}
          getRowId={(r) => r.id}
        />
      </Box>
    </PageContainer>
  );
};
