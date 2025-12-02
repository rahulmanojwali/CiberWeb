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
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import {
  fetchCommodities,
  createCommodity,
  updateCommodity,
  deactivateCommodity,
} from "../../services/mandiApi";

type CommodityRow = {
  commodity_id: number;
  name: string;
  group?: string;
  code?: string;
  is_active: boolean;
};

const defaultForm = {
  name_en: "",
  commodity_group: "",
  code: "",
  is_active: true,
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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [rows, setRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [rowCount, setRowCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "ACTIVE" | "INACTIVE");
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const canCreate = useMemo(() => can(uiConfig.resources, "commodities.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "commodities.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "commodities.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );
  const isReadOnly = useMemo(() => isEdit && !canEdit, [isEdit, canEdit]);

  const columns = useMemo<GridColDef<CommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 100 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "group", headerName: "Group", flex: 1 },
      { field: "code", headerName: "Code", width: 140 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (value) => (value ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(params.row)}>
                Edit
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.commodity_id)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDeactivate],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodities({
        username,
        language,
        page: page + 1,
        pageSize,
        filters: { is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" },
      });
      const data = resp?.data || resp?.response?.data || resp || {};
      const list = data?.commodities || [];
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

  const openCreate = () => {
    setIsEdit(false);
    setSelectedId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: CommodityRow) => {
    setIsEdit(true);
    setSelectedId(row.commodity_id);
    setForm({
      name_en: row.name,
      commodity_group: row.group || "",
      code: row.code || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      name_i18n: { en: form.name_en },
      is_active: form.is_active,
      commodity_group: form.commodity_group || undefined,
      commodity_slug: form.code || undefined,
      slug: form.code || undefined,
    };
    try {
      let resp;
      if (isEdit && selectedId) {
        payload.commodity_id = selectedId;
        resp = await updateCommodity({ username, language, payload });
      } else {
        resp = await createCommodity({ username, language, payload });
      }
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setToast({ open: true, message: isEdit ? "Commodity updated." : "Commodity created.", severity: "success" });
        setDialogOpen(false);
        await loadData();
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  const handleDeactivate = async (commodity_id: number) => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await deactivateCommodity({ username, language, commodity_id });
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setToast({ open: true, message: "Commodity deactivated.", severity: "success" });
        await loadData();
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.commodities", { defaultValue: "Commodities" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
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
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              {t("actions.create", { defaultValue: "Create" })}
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
              onClick={() => canEdit && openEdit(row)}
            >
              <Stack spacing={1}>
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
                    Group / Category
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.group || "-"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Code / Slug
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.code || "-"}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Commodity ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.commodity_id}
                  </Typography>
                </Box>

                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  {canEdit && (
                    <Button size="small" variant="text" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                      Edit
                    </Button>
                  )}
                  {canDeactivate && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeactivate(row.commodity_id);
                      }}
                      sx={{ textTransform: "none" }}
                    >
                      Deactivate
                    </Button>
                  )}
                </Stack>
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
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      ) : (
        <Box sx={{ height: 520 }}>
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
            pageSizeOptions={[20, 50, 100]}
          />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Commodity" : "Create Commodity"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
            disabled={isReadOnly}
          />
          <TextField
            label="Group / Category"
            value={form.commodity_group}
            onChange={(e) => setForm((f) => ({ ...f, commodity_group: e.target.value }))}
            fullWidth
            disabled={isReadOnly}
          />
          <TextField
            label="Code / Slug"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            fullWidth
            disabled={isReadOnly}
          />
          <TextField
            select
            label="Active"
            value={form.is_active ? "Y" : "N"}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))}
            fullWidth
            disabled={isReadOnly}
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          { (isEdit ? canEdit : canCreate) && (
            <Button variant="contained" onClick={handleSave} disabled={isReadOnly}>
              {isEdit ? "Update" : "Create"}
            </Button>
          )}
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
