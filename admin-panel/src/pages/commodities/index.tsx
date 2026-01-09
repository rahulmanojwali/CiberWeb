import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  Alert,
  useMediaQuery,
  useTheme,
  Pagination,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_PAGE_SIZE, MOBILE_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../config/uiDefaults";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import { fetchCommodities, createCommodity } from "../../services/mandiApi";

type CommodityRow = {
  commodity_id: number;
  name: string;
  group?: string;
  code?: string;
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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const initialPageSize = isSmallScreen ? MOBILE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const [rows, setRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [rowCount, setRowCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "ACTIVE" | "INACTIVE");
  const [selectionModel, setSelectionModel] = useState<number[]>([]);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const { canCreate, canView } = useCrudPermissions("commodities_masters");

  const columns = useMemo<GridColDef<CommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 220 },
      { field: "group", headerName: "Group", flex: 1, minWidth: 160 },
      { field: "code", headerName: "Code", width: 160 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (value) => (value ? "Y" : "N"),
        renderCell: (params) => (
          <Chip
            label={params.value ? "Active" : "Inactive"}
            color={params.value ? "success" : "default"}
            size="small"
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canCreate && (
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleImport([params.row.commodity_id])}
              >
                Import
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canCreate],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodities({
        username,
        language,
        filters: {
          is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
          page: page + 1,
          pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || resp || {};
      const list = data?.masters || data?.commodities || [];
      const total = Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length;
      setRowCount(total);
      setRows(
        list.map((c: any) => ({
          commodity_id: c.commodity_id,
          name: c?.name_i18n?.en || c.slug || String(c.commodity_id),
          group: c.commodity_group || c.commodity_category || "",
          code: c.commodity_slug || c.slug || "",
          is_active: Boolean(c.is_active),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, statusFilter, page, pageSize]);

  const handleImport = async (commodityIds: number[]) => {
    const username = currentUsername();
    if (!username) return;
    try {
      const payload = commodityIds.length === 1 ? { commodity_id: commodityIds[0] } : { commodity_ids: commodityIds };
      const resp = await createCommodity({ username, language, payload });
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setToast({ open: true, message: "Commodities imported.", severity: "success" });
        setSelectionModel([]);
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  return (
    <PageContainer>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Typography variant="h5">{t("menu.commodities", { defaultValue: "Commodities" })}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <TextField
              select
              label="Status"
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              sx={{ width: 140 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                setToast({
                  open: true,
                  message: "Imported view will be available soon.",
                  severity: "info",
                })
              }
            >
              View Imported
            </Button>
            {canCreate && (
              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                disabled={!selectionModel.length}
                onClick={() => handleImport(selectionModel)}
              >
                Import Selected {selectionModel.length ? `(${selectionModel.length})` : ""}
              </Button>
            )}
          </Stack>
        </Stack>

        {isSmallScreen ? (
          <Stack
            spacing={1.5}
            sx={{
              maxWidth: 640,
              mx: "auto",
              width: "100%",
              flex: 1,
              overflowY: "auto",
            }}
          >
            {rows.map((row) => (
              <Box
                key={row.commodity_id}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  p: 2,
                  boxShadow: 1,
                }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body1" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {row.name}
                    </Typography>
                    <Chip
                      label={row.is_active ? "Active" : "Inactive"}
                      color={row.is_active ? "success" : "default"}
                      size="small"
                      sx={{ fontSize: "0.75rem" }}
                    />
                  </Stack>

                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                      Commodity ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                      {row.commodity_id}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                      Commodity Name
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {row.name || "-"}
                    </Typography>
                  </Box>

                  {canCreate && (
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleImport([row.commodity_id])}
                        sx={{ textTransform: "none" }}
                      >
                        Import
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))}
            {!rows.length && (
              <Typography variant="body2" color="text.secondary">
                No commodities found.
              </Typography>
            )}
            {rowCount > pageSize && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                <Pagination
                  count={Math.max(1, Math.ceil(rowCount / pageSize))}
                  page={page + 1}
                  onChange={(_event, newPage: number) => setPage(newPage - 1)}
                  color="primary"
                />
              </Box>
            )}
          </Stack>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows}
              loading={loading}
              getRowId={(r) => r.commodity_id}
              paginationMode="server"
              rowCount={rowCount}
              paginationModel={{ page, pageSize }}
              onPaginationModelChange={(model) => {
                setPage(model.page);
                if (model.pageSize !== pageSize) {
                  setPageSize(model.pageSize);
                  setPage(0);
                }
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              checkboxSelection
              rowSelectionModel={selectionModel}
              onRowSelectionModelChange={(selection) =>
                setSelectionModel((selection as number[]).map((value) => Number(value)))
              }
              disableRowSelectionOnClick
              sx={{
                "& .MuiDataGrid-columnHeaders": {
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            />
          </Box>
        )}
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};
