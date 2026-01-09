import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_PAGE_SIZE, MOBILE_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../config/uiDefaults";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  fetchCommodities,
  createCommodity,
  updateCommodity,
} from "../../services/mandiApi";

type CommodityRow = {
  commodity_id: number;
  name: string;
  group?: string;
  code?: string;
  is_active: boolean;
};

type ImportedCommodityRow = {
  commodity_id: number;
  display_label: string;
  commodity_slug?: string;
  is_active: "Y" | "N";
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
  const [importedRows, setImportedRows] = useState<ImportedCommodityRow[]>([]);
  const [masterRows, setMasterRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [rowCount, setRowCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "ACTIVE" | "INACTIVE");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [masterSelection, setMasterSelection] = useState<number[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    display_label: "",
    commodity_slug: "",
    commodity_group: "",
    code: "",
    is_active: "Y",
  });
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const { canCreate, canDeactivate } = useCrudPermissions("commodities_masters");

  const importedColumns = useMemo<GridColDef<ImportedCommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 90 },
      { field: "display_label", headerName: "Name", flex: 1, minWidth: 220 },
      { field: "commodity_slug", headerName: "Code", width: 180 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        renderCell: (params) => (
          <Chip
            label={params.value === "Y" ? "Active" : "Inactive"}
            color={params.value === "Y" ? "success" : "default"}
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
            {canDeactivate && (
              <Button
                size="small"
                startIcon={params.row.is_active === "Y" ? <BlockIcon /> : <CheckIcon />}
                color={params.row.is_active === "Y" ? "error" : "success"}
                onClick={() => handleToggleImported(params.row)}
              >
                {params.row.is_active === "Y" ? "Deactivate" : "Activate"}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate],
  );

  const masterColumns = useMemo<GridColDef<CommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 220 },
      { field: "group", headerName: "Group", flex: 1, minWidth: 160 },
      { field: "code", headerName: "Code", width: 180 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
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
        width: 140,
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

  const loadImported = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodities({
        username,
        language,
        filters: {
          view: "IMPORTED",
          mandi_id: 0,
          is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" ? "Y" : "N",
          page: page + 1,
          pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || resp || {};
      const list = data?.rows || data?.imported || data?.org_selected || [];
      const total = Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length;
      setRowCount(total);
      setImportedRows(
        list.map((c: any) => ({
          commodity_id: c.commodity_id,
          display_label: c.display_label || c?.label_i18n?.en || String(c.commodity_id),
          commodity_slug: c.commodity_slug || "",
          is_active: c.is_active === "N" ? "N" : "Y",
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodities({
        username,
        language,
        filters: {
          view: "MASTER",
          is_active: "Y",
        },
      });
      const data = resp?.data || resp?.response?.data || resp || {};
      const list = data?.rows || data?.masters || data?.commodities || [];
      setMasterRows(
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
    loadImported();
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
        setMasterSelection([]);
        await loadImported();
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  const handleManualCreate = async () => {
    const username = currentUsername();
    if (!username) return;
    const displayLabel = createForm.display_label.trim();
    const commoditySlug = createForm.commodity_slug.trim();
    if (!displayLabel || !commoditySlug) {
      setToast({ open: true, message: "Name and slug are required.", severity: "error" });
      return;
    }
    try {
      const payload: Record<string, any> = {
        display_label: displayLabel,
        commodity_slug: commoditySlug,
        commodity_group: createForm.commodity_group || undefined,
        code: createForm.code || undefined,
        is_active: createForm.is_active,
      };
      const resp = await createCommodity({ username, language, payload });
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setToast({ open: true, message: "Commodity created.", severity: "success" });
        setCreateDialogOpen(false);
        setCreateForm({
          display_label: "",
          commodity_slug: "",
          commodity_group: "",
          code: "",
          is_active: "Y",
        });
        await loadImported();
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  const handleToggleImported = async (row: ImportedCommodityRow) => {
    const username = currentUsername();
    if (!username) return;
    try {
      const nextStatus = row.is_active === "Y" ? "N" : "Y";
      const resp = await updateCommodity({ username, language, payload: { commodity_id: row.commodity_id, is_active: nextStatus } });
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setImportedRows((prev) =>
          prev.map((item) =>
            item.commodity_id === row.commodity_id ? { ...item, is_active: nextStatus } : item,
          ),
        );
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
            {canCreate && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create (Org Only)
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={async () => {
                    setImportDialogOpen(true);
                    await loadMasters();
                  }}
                >
                  Import
                </Button>
              </>
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
            {importedRows.map((row) => (
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
                      {row.display_label}
                    </Typography>
                    <Chip
                      label={row.is_active === "Y" ? "Active" : "Inactive"}
                      color={row.is_active === "Y" ? "success" : "default"}
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
                      {row.display_label || "-"}
                    </Typography>
                  </Box>

                  {canDeactivate && (
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button
                        size="small"
                        variant="text"
                        color={row.is_active === "Y" ? "error" : "success"}
                        startIcon={row.is_active === "Y" ? <BlockIcon /> : <CheckIcon />}
                        onClick={() => handleToggleImported(row)}
                        sx={{ textTransform: "none" }}
                      >
                        {row.is_active === "Y" ? "Deactivate" : "Activate"}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))}
            {!importedRows.length && (
              <Typography variant="body2" color="text.secondary">
                No commodities imported yet. Select from Master Catalogue and click Import.
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
              columns={importedColumns}
              rows={importedRows}
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

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Import Commodities</DialogTitle>
        <DialogContent>
          <Box sx={{ height: 520 }}>
            <ResponsiveDataGrid
              columns={masterColumns}
              rows={masterRows}
              loading={loading}
              getRowId={(r) => r.commodity_id}
              checkboxSelection
              rowSelectionModel={masterSelection}
              onRowSelectionModelChange={(selection) =>
                setMasterSelection((selection as number[]).map((value) => Number(value)))
              }
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={!masterSelection.length}
            onClick={() => handleImport(masterSelection)}
          >
            Import Selected {masterSelection.length ? `(${masterSelection.length})` : ""}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Commodity (Org Only)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={createForm.display_label}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, display_label: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Commodity Slug"
              value={createForm.commodity_slug}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, commodity_slug: event.target.value }))}
              helperText="Lowercase letters, numbers, and hyphens."
              fullWidth
              required
            />
            <TextField
              label="Group (optional)"
              value={createForm.commodity_group}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, commodity_group: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Code (optional)"
              value={createForm.code}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Active"
              value={createForm.is_active}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, is_active: event.target.value }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleManualCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

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
