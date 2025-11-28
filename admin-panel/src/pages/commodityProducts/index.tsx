import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchCommodityProducts } from "../../services/mandiApi";

type ProductRow = {
  id: number;
  product_id: number;
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

export const CommodityProducts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const canCreate = useMemo(
    () => can(uiConfig.resources, "commodity_products.create", "CREATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<ProductRow>[]>(
    () => [
      { field: "product_id", headerName: "ID", width: 90 },
      { field: "commodity_id", headerName: "Commodity", width: 120 },
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
        const res = await fetchCommodityProducts({ username, language });
        const list = res?.data?.products || [];
        setRows(
          list.map((p: any) => ({
            id: p.product_id,
            product_id: p.product_id,
            commodity_id: p.commodity_id,
            name: p?.name_i18n?.en || p.slug || String(p.product_id),
            is_active: Boolean(p.is_active),
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
        <Typography variant="h5">
          {t("menu.commodityProducts", { defaultValue: "Commodity Products" })}
        </Typography>
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
