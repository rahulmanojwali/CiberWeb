import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  fetchGateEntryReasons,
  createGateEntryReason,
  updateGateEntryReason,
  deactivateGateEntryReason,
} from "../../services/gateApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type ReasonRow = {
  reason_code: string;
  name: string;
  name_hi?: string;
  category?: string;
  requires_documents?: string[];
  needs_vehicle_check?: string;
  needs_weight_check?: string;
  is_active: string;
  org_scope?: string;
  org_code?: string;
};

const defaultForm = {
  reason_code: "",
  name_en: "",
  name_hi: "",
  category: "OTHER",
  required_documents: [] as string[],
  needs_vehicle_check: false,
  needs_weight_check: false,
  is_active: "Y" as "Y" | "N",
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export const GateEntryReasons: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobile = fullScreenDialog;

  const { canCreate, canEdit, canDeactivate, canViewDetail } = useCrudPermissions("gate_entry_reasons");
  const orgOptions = useMemo(() => {
    const codes = Array.isArray((uiConfig as any)?.scope?.org_codes)
      ? (uiConfig as any).scope.org_codes
      : uiConfig.scope?.org_code
      ? [uiConfig.scope.org_code]
      : [];

    const opts = codes.map((code: string) => ({ value: code, label: code }));

    if ((uiConfig.role || "").toUpperCase() === "SUPER_ADMIN") {
      return [{ value: "ALL", label: "All organisations" }, ...opts];
    }

    if (opts.length === 0 && uiConfig.scope?.org_code) {
      return [{ value: uiConfig.scope.org_code, label: uiConfig.scope.org_code }];
    }
    return opts;
  }, [uiConfig]);

  const defaultOrgFilter = useMemo(() => {
    if ((uiConfig.role || "").toUpperCase() === "SUPER_ADMIN") return "ALL";
    return uiConfig.scope?.org_code || orgOptions[0]?.value || "";
  }, [uiConfig, orgOptions]);

  const [orgFilter, setOrgFilter] = useState<string>(defaultOrgFilter);

  const [rows, setRows] = useState<ReasonRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editCode, setEditCode] = useState<string | null>(null);

  const columns = useMemo<GridColDef<ReasonRow>[]>(
    () => [
      { field: "name", headerName: "Reason Name", flex: 1, minWidth: 180 },
      { field: "reason_code", headerName: "Code", width: 140 },
      { field: "category", headerName: "Category", width: 140 },
      {
        field: "requires_documents",
        headerName: "Documents",
        flex: 1,
        valueGetter: (params: any) => (params?.row?.requires_documents || []).join(", ") || "—",
      },
      {
        field: "checks",
        headerName: "Checks",
        width: 140,
        valueGetter: (params: any) => {
          const row = (params?.row || {}) as Partial<ReasonRow>;
          const vehicle = row.needs_vehicle_check === "Y" ? "Vehicle" : null;
          const weight = row.needs_weight_check === "Y" ? "Weight" : null;
          return [vehicle, weight].filter(Boolean).join(", ") || "—";
        },
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 110,
        renderCell: (params) => (
          <Chip size="small" label={params.row.is_active === "Y" ? "Active" : "Inactive"} color={params.row.is_active === "Y" ? "success" : "default"} />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 200,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(params.row)}>
                Edit
              </Button>
            )}
            {!canEdit && canViewDetail && (
              <Button size="small" startIcon={<VisibilityIcon />} onClick={() => openEdit(params.row)}>
                View
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.reason_code)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDeactivate, canViewDetail],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchGateEntryReasons({
        username,
        language,
        filters: {
          is_active: status === "ALL" ? undefined : status,
          org_code: orgFilter === "ALL" ? undefined : orgFilter || undefined,
        },
      });
      const list = resp?.data?.reasons || resp?.response?.data?.reasons || [];
      setRows(
        list.map((r: any) => ({
          reason_code: r.reason_code,
          name: r.name_i18n?.en || r.name_en || r.reason_code,
          name_hi: r.name_i18n?.hi || "",
          category: r.category || "OTHER",
          requires_documents: r.requires_documents || r.required_documents || [],
          needs_vehicle_check: r.needs_vehicle_check || r.vehicle_check || undefined,
          needs_weight_check: r.needs_weight_check || r.weight_check || undefined,
          is_active: r.is_active || r.active || "Y",
          org_scope: r.org_scope,
          org_code: r.org_code,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status, language]);

  const openCreate = () => {
    setIsEdit(false);
    setEditCode(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: ReasonRow) => {
    setIsEdit(true);
    setEditCode(row.reason_code);
    setForm({
      reason_code: row.reason_code,
      name_en: row.name,
      name_hi: row.name_hi || "",
      category: (row.category as any) || "OTHER",
      required_documents: row.requires_documents || [],
      needs_vehicle_check: row.needs_vehicle_check === "Y",
      needs_weight_check: row.needs_weight_check === "Y",
      is_active: row.is_active as "Y" | "N",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      reason_code: form.reason_code,
      name_en: form.name_en,
      name_i18n: { en: form.name_en, hi: form.name_hi || undefined },
      category: form.category,
      required_documents: form.required_documents?.filter(Boolean),
      needs_vehicle_check: form.needs_vehicle_check ? "Y" : "N",
      needs_weight_check: form.needs_weight_check ? "Y" : "N",
      is_active: form.is_active,
    };
    if (isEdit && editCode) {
      await updateGateEntryReason({ username, language, payload });
    } else {
      await createGateEntryReason({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (reason_code: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateGateEntryReason({ username, language, reason_code });
    await loadData();
  };

  const handleNameChange = (val: string) => {
    setForm((f) => {
      const next: any = { ...f, name_en: val };
      if (!isEdit && !f.reason_code) {
        next.reason_code = toSlug(val);
      }
      return next;
    });
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.gateEntryReasons", { defaultValue: "Gate Entry Reasons" })}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          {orgOptions.length > 0 && (
            <TextField
              select
              label="Organisation"
              size="small"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              disabled={(uiConfig.role || "").toUpperCase() !== "SUPER_ADMIN" && orgOptions.length === 1}
              sx={{ width: { xs: "100%", sm: 240 } }}
            >
              {orgOptions.map((opt: any) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            sx={{ width: { xs: "100%", sm: 160 } }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="Y">Active</MenuItem>
            <MenuItem value="N">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate} sx={{ width: { xs: "100%", sm: "auto" } }}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      {isMobile ? (
        <Stack spacing={2}>
          {rows.map((row) => {
            const docs = (row.requires_documents || []).join(", ") || "—";
            const checks = [row.needs_vehicle_check === "Y" ? "Vehicle" : null, row.needs_weight_check === "Y" ? "Weight" : null]
              .filter(Boolean)
              .join(", ") || "—";
            return (
              <Card key={row.reason_code} variant="outlined">
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {row.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Code: {row.reason_code}
                  </Typography>
                  <Typography variant="body2">Org: {row.org_code || row.org_scope || "—"}</Typography>
                  <Typography variant="body2">Category: {row.category || "—"}</Typography>
                  <Typography variant="body2">Documents: {docs}</Typography>
                  <Typography variant="body2">Checks: {checks}</Typography>
                  <Chip
                    size="small"
                    label={row.is_active === "Y" ? "Active" : "Inactive"}
                    color={row.is_active === "Y" ? "success" : "default"}
                    sx={{ alignSelf: "flex-start" }}
                  />
                  <Stack direction="row" spacing={1} mt={1}>
                    {canEdit && (
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    )}
                    {!canEdit && canViewDetail && (
                      <Button size="small" startIcon={<VisibilityIcon />} onClick={() => openEdit(row)}>
                        View
                      </Button>
                    )}
                    {canDeactivate && (
                      <Button size="small" color="error" startIcon={<BlockIcon />} onClick={() => handleDeactivate(row.reason_code)}>
                        Deactivate
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.reason_code} autoHeight />
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreenDialog}
        PaperProps={{
          sx: {
            display: "flex",
            flexDirection: "column",
            maxHeight: fullScreenDialog ? "100vh" : "90vh",
          },
        }}
      >
        <DialogTitle>{isEdit ? "Edit Reason" : "Create Reason"}</DialogTitle>
        <DialogContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: 1.25,
            pb: 0,
            minHeight: 0,
          }}
        >
          <Box sx={{ flex: 1, overflowY: "auto", pr: 1, pb: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Reason Code"
              value={form.reason_code}
              onChange={(e) => setForm((f) => ({ ...f, reason_code: e.target.value }))}
              fullWidth
              disabled={isEdit}
              id="reason_code"
            />
            <TextField label="Reason Name (English)" value={form.name_en} onChange={(e) => handleNameChange(e.target.value)} fullWidth id="reason_name_en" />
            <TextField
              label="Reason Name (Hindi)"
              value={form.name_hi}
              onChange={(e) => setForm((f) => ({ ...f, name_hi: e.target.value }))}
              fullWidth
              id="reason_name_hi"
            />
            <TextField
              select
              label="Category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              fullWidth
              id="reason_category"
            >
              {[
                "FARMER",
                "TRADER",
                "TRANSPORT",
                "SERVICE",
                "ADMIN",
                "OTHER",
              ].map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Required Documents (comma separated)"
              value={form.required_documents.join(", ")}
              onChange={(e) =>
                setForm((f) => ({ ...f, required_documents: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) }))
              }
              fullWidth
              id="required_documents"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.needs_vehicle_check}
                  onChange={(e) => setForm((f) => ({ ...f, needs_vehicle_check: e.target.checked }))}
                  color="primary"
                  inputProps={{ id: "needs_vehicle_check" }}
                />
              }
              label="Needs Vehicle Check"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.needs_weight_check}
                  onChange={(e) => setForm((f) => ({ ...f, needs_weight_check: e.target.checked }))}
                  color="primary"
                  inputProps={{ id: "needs_weight_check" }}
                />
              }
              label="Needs Weight Check"
            />
            <TextField
              select
              label="Active"
              value={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value as "Y" | "N" }))}
              fullWidth
              id="reason_active"
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.reason_code || !form.name_en}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
