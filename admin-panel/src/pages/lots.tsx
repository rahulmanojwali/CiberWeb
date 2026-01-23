import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../config/languages";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";
import { fetchLotDetail, fetchLots } from "../services/lotsApi";

type LotRow = {
  id: string;
  token_code: string;
  mandi_name: string | number | null;
  gate_code: string | null;
  commodity_product_id: string | null;
  bags: number | null;
  weight_kg: number | null;
  status: string | null;
  created_on?: string | null;
  raw?: any;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export const Lots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LotRow | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const canView = useMemo(
    () => can(uiConfig.resources, "lots.list", "VIEW"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<LotRow>[]>(
    () => [
      { field: "token_code", headerName: "Token Code", width: 180 },
      { field: "mandi_name", headerName: "Mandi", width: 160 },
      { field: "gate_code", headerName: "Gate", width: 120 },
      { field: "commodity_product_id", headerName: "Commodity Product", width: 180 },
      { field: "bags", headerName: "Bags", width: 120 },
      { field: "weight_kg", headerName: "Weight (kg)", width: 140 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "details",
        headerName: "Details",
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Button size="small" onClick={() => handleOpenDetail(params.row)}>
            View
          </Button>
        ),
      },
    ],
    [],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchLots({
        username,
        language,
        filters: { page_size: 100 },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: LotRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.lot_id || `${item.token_code || "lot"}-${idx}`,
        token_code: item.token_code || item.token || item.code || `token-${idx}`,
        mandi_name:
          item.mandi_name ||
          item.mandi ||
          item.mandi_slug ||
          item.mandi_id ||
          null,
        gate_code: item.gate_code || item.gate || null,
        commodity_product_id:
          item.commodity_product_id ||
          item.commodity_product_code ||
          item.product_id ||
          null,
        bags: item.bags ?? item.bags_count ?? null,
        weight_kg: item.weight_kg ?? item.net_weight ?? null,
        status: item.status ?? null,
        created_on: item.created_on || item.createdAt || null,
        raw: item,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (row: LotRow) => {
    const username = currentUsername();
    if (!username) return;
    setSelectedRow(row);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const resp = await fetchLotDetail({
        username,
        language,
        lot_id: row.id,
        token_code: row.token_code,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      if (code !== "0") {
        setDetailError(desc || "Unable to load lot detail.");
        setDetail(null);
      } else {
        const payload = resp?.data?.item || resp?.response?.data?.item || resp?.data || resp?.response?.data;
        setDetail(payload || row.raw || null);
      }
    } catch (err: any) {
      setDetailError(err?.message || "Unable to load lot detail.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, canView]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view lots.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.lots", { defaultValue: "Lots" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Live lots linked to gate tokens (read-only).
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id || r.token_code}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>

      <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Lot Details</DialogTitle>
        <DialogContent dividers>
          {detailLoading && <Typography>Loading...</Typography>}
          {detailError && <Typography color="error">{detailError}</Typography>}
          {!detailLoading && !detailError && (
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: "background.default",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                overflow: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(detail || selectedRow?.raw || {}, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default Lots;
