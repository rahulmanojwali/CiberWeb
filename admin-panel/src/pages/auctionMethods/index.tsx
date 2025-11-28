import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
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
  fetchAuctionMethods,
  createAuctionMethod,
  updateAuctionMethod,
  deactivateAuctionMethod,
} from "../../services/auctionApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type MethodRow = {
  method_code: string;
  name: string;
  org_scope: string;
  is_active: string;
};

const defaultForm = { method_code: "", name_en: "", description: "", org_scope: "GLOBAL", is_active: "Y" };

export const AuctionMethods: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<MethodRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editCode, setEditCode] = useState<string | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "auction_methods_masters.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "auction_methods_masters.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "auction_methods_masters.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<MethodRow>[]>(
    () => [
      { field: "method_code", headerName: "Code", width: 150 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "org_scope", headerName: "Scope", width: 120 },
      { field: "is_active", headerName: "Active", width: 100 },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
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
                onClick={() => handleDeactivate(params.row.method_code)}
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
      const resp = await fetchAuctionMethods({
        username,
        language,
        filters: { is_active: status === "ALL" ? undefined : status },
      });
      const list = resp?.data?.methods || resp?.response?.data?.methods || [];
      setRows(
        list.map((m: any) => ({
          method_code: m.method_code,
          name: m?.name_i18n?.en || m.method_code,
          org_scope: m.org_scope || "",
          is_active: m.is_active,
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

  const openEdit = (row: MethodRow) => {
    setIsEdit(true);
    setEditCode(row.method_code);
    setForm({
      method_code: row.method_code,
      name_en: row.name,
      description: "",
      org_scope: row.org_scope || "GLOBAL",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      method_code: form.method_code,
      name_en: form.name_en,
      description: form.description || undefined,
      org_scope: form.org_scope,
      is_active: form.is_active,
    };
    if (isEdit && editCode) {
      await updateAuctionMethod({ username, language, payload });
    } else {
      await createAuctionMethod({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (method_code: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateAuctionMethod({ username, language, method_code });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.auctionMethods", { defaultValue: "Auction Methods" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            sx={{ width: 140 }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="Y">Active</MenuItem>
            <MenuItem value="N">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.method_code} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Method" : "Create Method"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Method Code"
            value={form.method_code}
            onChange={(e) => setForm((f) => ({ ...f, method_code: e.target.value }))}
            fullWidth
            disabled={isEdit}
          />
          <TextField
            label="Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Org Scope"
            value={form.org_scope}
            onChange={(e) => setForm((f) => ({ ...f, org_scope: e.target.value }))}
            fullWidth
          >
            <MenuItem value="GLOBAL">GLOBAL</MenuItem>
            <MenuItem value="ORG">ORG</MenuItem>
          </TextField>
          <TextField
            select
            label="Active"
            value={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
