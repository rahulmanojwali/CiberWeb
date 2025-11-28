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
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import {
  fetchAuctionPolicies,
  fetchAuctionMethods,
  fetchAuctionRounds,
  createAuctionPolicy,
  updateAuctionPolicy,
  deactivateAuctionPolicy,
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

type PolicyRow = {
  id: string;
  org_id: string;
  org_code?: string | null;
  mandi_id: number;
  method_code: string;
  rounds: string;
  is_active: string;
};

const defaultForm = {
  org_id: "",
  mandi_id: "",
  method_code: "",
  rounds: [] as string[],
  day_windows_json: "",
  notes: "",
  is_active: "Y",
};

export const AuctionPolicies: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [methodOptions, setMethodOptions] = useState<any[]>([]);
  const [roundOptions, setRoundOptions] = useState<any[]>([]);
  const [filters, setFilters] = useState({ org_id: "", mandi_id: "", status: "ALL" as "ALL" | "Y" | "N" });
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const canCreate = useMemo(() => can(uiConfig.resources, "cm_mandi_auction_policies.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "cm_mandi_auction_policies.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "cm_mandi_auction_policies.deactivate", "DEACTIVATE"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<PolicyRow>[]>(
    () => [
      { field: "org_id", headerName: "Org", width: 160, valueGetter: (value, row) => row.org_code || value },
      { field: "mandi_id", headerName: "Mandi", width: 120 },
      { field: "method_code", headerName: "Method", width: 140 },
      { field: "rounds", headerName: "Rounds", flex: 1 },
      { field: "is_active", headerName: "Active", width: 100 },
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
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.id)}
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

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const orgs = resp?.response?.data?.organisations || resp?.data?.organisations || [];
    setOrgOptions(orgs);
  };

  const loadMandis = async (orgCode?: string) => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true, org_code: orgCode } });
    const mandis = resp?.data?.mandis || [];
    setMandiOptions(mandis);
  };

  const loadMethodsRounds = async () => {
    const username = currentUsername();
    if (!username) return;
    const mResp = await fetchAuctionMethods({ username, language, filters: { is_active: "Y" } });
    const rResp = await fetchAuctionRounds({ username, language, filters: { is_active: "Y" } });
    setMethodOptions(mResp?.data?.methods || mResp?.response?.data?.methods || []);
    setRoundOptions(rResp?.data?.rounds || rResp?.response?.data?.rounds || []);
  };

  const loadPolicies = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchAuctionPolicies({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status,
        },
      });
      const list = resp?.data?.policies || resp?.response?.data?.policies || [];
      setRows(
        list.map((p: any) => ({
          id: p._id,
          org_id: p.org_id,
          org_code: p.org_code || null,
          mandi_id: p.mandi_id,
          method_code: p.method_code,
          rounds: Array.isArray(p.rounds) ? p.rounds.map((r: any) => r.round_code).join(",") : "",
          is_active: p.is_active,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    loadMethodsRounds();
  }, []);

  useEffect(() => {
    loadMandis(undefined);
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [filters.org_id, filters.mandi_id, filters.status, language]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: PolicyRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      org_id: row.org_id,
      mandi_id: String(row.mandi_id),
      method_code: row.method_code,
      rounds: row.rounds ? row.rounds.split(",") : [],
      day_windows_json: "",
      notes: "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const rounds = (form.rounds || []).map((code, idx) => ({ round_code: code, display_order: idx }));
    let day_windows = null;
    if (form.day_windows_json) {
      try {
        day_windows = JSON.parse(form.day_windows_json);
      } catch {
        day_windows = null;
      }
    }
    const payload: any = {
      org_id: form.org_id,
      mandi_id: Number(form.mandi_id),
      method_code: form.method_code,
      rounds,
      day_windows,
      notes: form.notes || undefined,
      is_active: form.is_active,
    };
    if (isEdit && editId) {
      payload.policy_id = editId;
      await updateAuctionPolicy({ username, language, payload });
    } else {
      await createAuctionPolicy({ username, language, payload });
    }
    setDialogOpen(false);
    await loadPolicies();
  };

  const handleDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateAuctionPolicy({ username, language, policy_id: id });
    await loadPolicies();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.auctionPolicies", { defaultValue: "Auction Policies" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Organisation"
            size="small"
            value={filters.org_id}
            onChange={(e) => {
              const org_id = e.target.value;
              setFilters((f) => ({ ...f, org_id }));
              const org = orgOptions.find((o) => String(o._id) === String(org_id));
              loadMandis(org?.org_code);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mandi"
            size="small"
            value={filters.mandi_id}
            onChange={(e) => setFilters((f) => ({ ...f, mandi_id: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
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
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.id} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Auction Policy" : "Create Auction Policy"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Organisation"
            value={form.org_id}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
            fullWidth
          >
            {orgOptions.map((o) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => setForm((f) => ({ ...f, mandi_id: e.target.value }))}
            fullWidth
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Method"
            value={form.method_code}
            onChange={(e) => setForm((f) => ({ ...f, method_code: e.target.value }))}
            fullWidth
          >
            {methodOptions.map((m: any) => (
              <MenuItem key={m.method_code} value={m.method_code}>
                {m.method_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Rounds"
            SelectProps={{ multiple: true }}
            value={form.rounds}
            onChange={(e) => setForm((f) => ({ ...f, rounds: Array.isArray(e.target.value) ? e.target.value : [] }))}
            fullWidth
          >
            {roundOptions.map((r: any) => (
              <MenuItem key={r.round_code} value={r.round_code}>
                {r.round_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Day Windows (JSON)"
            value={form.day_windows_json}
            onChange={(e) => setForm((f) => ({ ...f, day_windows_json: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
          />
          <TextField
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
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
