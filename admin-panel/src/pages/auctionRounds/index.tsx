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
  fetchAuctionRounds,
  createAuctionRound,
  updateAuctionRound,
  deactivateAuctionRound,
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

type RoundRow = {
  round_code: string;
  name: string;
  display_order: number;
  is_final: string;
  is_active: string;
};

const defaultForm = {
  round_code: "",
  name_en: "",
  description: "",
  display_order: 0,
  duration_minutes: "",
  is_final: "N",
  is_active: "Y",
  org_scope: "GLOBAL",
};

export const AuctionRounds: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<RoundRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editCode, setEditCode] = useState<string | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "auction_rounds_masters.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "auction_rounds_masters.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "auction_rounds_masters.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<RoundRow>[]>(
    () => [
      { field: "round_code", headerName: "Code", width: 150 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "display_order", headerName: "Order", width: 100 },
      { field: "is_final", headerName: "Final", width: 100 },
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
                onClick={() => handleDeactivate(params.row.round_code)}
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
      const resp = await fetchAuctionRounds({
        username,
        language,
        filters: { is_active: status === "ALL" ? undefined : status },
      });
      const list = resp?.data?.rounds || resp?.response?.data?.rounds || [];
      setRows(
        list.map((r: any) => ({
          round_code: r.round_code,
          name: r?.name_i18n?.en || r.round_code,
          display_order: r.display_order,
          is_final: r.is_final,
          is_active: r.is_active,
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

  const openEdit = (row: RoundRow) => {
    setIsEdit(true);
    setEditCode(row.round_code);
    setForm({
      round_code: row.round_code,
      name_en: row.name,
      description: "",
      display_order: row.display_order,
      duration_minutes: "",
      is_final: row.is_final,
      is_active: row.is_active,
      org_scope: "GLOBAL",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      round_code: form.round_code,
      name_en: form.name_en,
      description: form.description || undefined,
      display_order: Number(form.display_order) || 0,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      is_final: form.is_final,
      is_active: form.is_active,
      org_scope: form.org_scope,
    };
    if (isEdit && editCode) {
      await updateAuctionRound({ username, language, payload });
    } else {
      await createAuctionRound({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (round_code: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateAuctionRound({ username, language, round_code });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.auctionRounds", { defaultValue: "Auction Rounds" })}</Typography>
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
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.round_code} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Round" : "Create Round"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Round Code"
            value={form.round_code}
            onChange={(e) => setForm((f) => ({ ...f, round_code: e.target.value }))}
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
            label="Display Order"
            type="number"
            value={form.display_order}
            onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
            fullWidth
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            value={form.duration_minutes}
            onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Is Final"
            value={form.is_final}
            onChange={(e) => setForm((f) => ({ ...f, is_final: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
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
