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
import {
  fetchMandiGates,
  createMandiGate,
  updateMandiGate,
  deactivateMandiGate,
  fetchMandis,
} from "../../services/mandiApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type GateRow = {
  id: string;
  org_id: string;
  org_name?: string;
  mandi_id: number;
  gate_code: string;
  gate_name: string;
  gate_direction?: string;
  gate_type?: string;
  has_weighbridge?: string;
  is_active: string;
  updated_on?: string;
  updated_by?: string;
};

const defaultForm = {
  org_id: "",
  mandi_id: "",
  gate_code: "",
  name_en: "",
  name_hi: "",
  gate_direction: "BOTH",
  gate_type: "VEHICLE",
  has_weighbridge: "N",
  notes: "",
  is_active: "Y",
};

export const MandiGates: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<GateRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedMandi, setSelectedMandi] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "Y" | "N");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreateMandiGate = useMemo(
    () => can(uiConfig.resources, "mandi_gates.create", "CREATE"),
    [uiConfig.resources],
  );
  const canEdit = useMemo(() => can(uiConfig.resources, "mandi_gates.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "mandi_gates.deactivate", "DEACTIVATE"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<GateRow>[]>(
    () => [
      { field: "gate_code", headerName: "Gate Code", width: 140 },
      { field: "gate_name", headerName: "Gate Name", flex: 1 },
      { field: "gate_direction", headerName: "Direction", width: 120 },
      { field: "gate_type", headerName: "Type", width: 120 },
      { field: "has_weighbridge", headerName: "Weighbridge", width: 130 },
      { field: "org_name", headerName: "Org", width: 160 },
      { field: "mandi_id", headerName: "Mandi ID", width: 110 },
      { field: "is_active", headerName: "Active", width: 100 },
      { field: "updated_on", headerName: "Updated On", width: 160 },
      { field: "updated_by", headerName: "Updated By", width: 140 },
      {
        field: "actions",
        headerName: "Actions",
        width: 170,
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
    if (!selectedOrg && orgs.length) setSelectedOrg(String(orgs[0]._id));
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({
      username,
      language,
      filters: { is_active: true, org_id: selectedOrg || undefined, page: 1, pageSize: 1000 },
    });
    const mandis = resp?.data?.mandis || [];
    setMandiOptions(mandis);
    if (!selectedMandi && mandis.length) setSelectedMandi(String(mandis[0].mandi_id));
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandiGates({
      username,
      language,
      filters: {
        org_id: selectedOrg || undefined,
        mandi_id: selectedMandi ? Number(selectedMandi) : undefined,
        is_active: statusFilter === "ALL" ? undefined : statusFilter,
      },
    });
    const list = resp?.data?.gates || resp?.data?.items || [];
    setRows(
      list.map((g: any) => ({
        id: g._id,
        org_id: g.org_id,
        org_name: g.org_name || "",
        mandi_id: g.mandi_id,
        gate_code: g.gate_code,
        gate_name: g?.name_i18n?.en || g.gate_code,
        gate_direction: g.gate_direction,
        gate_type: g.gate_type,
        has_weighbridge: g.has_weighbridge,
        is_active: g.is_active,
        updated_on: g.updated_on,
        updated_by: g.updated_by,
      })),
    );
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    loadMandis();
  }, [selectedOrg]);

  useEffect(() => {
    loadData();
  }, [selectedMandi, statusFilter, selectedOrg]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm({ ...defaultForm, mandi_id: selectedMandi, org_id: selectedOrg });
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
    openCreate();
  };

  const handleCloseDialog = () => {
    setCreateOpen(false);
    setDialogOpen(false);
  };

  const openEdit = (row: GateRow) => {
    setCreateOpen(false);
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      org_id: row.org_id,
      mandi_id: String(row.mandi_id),
      gate_code: row.gate_code,
      name_en: row.gate_name,
      name_hi: "",
      gate_direction: row.gate_direction || "BOTH",
      gate_type: row.gate_type || "VEHICLE",
      has_weighbridge: row.has_weighbridge || "N",
      notes: "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      org_id: form.org_id || selectedOrg,
      mandi_id: Number(form.mandi_id || selectedMandi),
      gate_code: form.gate_code,
      name_i18n: { en: form.name_en, hi: form.name_hi },
      gate_direction: form.gate_direction,
      gate_type: form.gate_type,
      has_weighbridge: form.has_weighbridge,
      notes: form.notes,
      is_active: form.is_active,
    };
    if (isEdit && editId) {
      payload._id = editId;
      await updateMandiGate({ username, language, payload });
    } else {
      await createMandiGate({ username, language, payload });
    }
    handleCloseDialog();
    await loadData();
  };

  const handleDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiGate({ username, language, _id: id });
    await loadData();
  };

  return (
    <PageContainer
      title={t("menu.mandiGates", { defaultValue: "Mandi Gates" })}
      actions={
        canCreateMandiGate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={createOpen}
            onClick={handleOpenCreate}
          >
            {t("actions.create", { defaultValue: "Create" })}
          </Button>
        )
      }
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <TextField
          select
          label="Mandi"
          size="small"
          value={selectedMandi}
          onChange={(e) => setSelectedMandi(e.target.value)}
          sx={{ minWidth: 200 }}
        >
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
          value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as any)}
        sx={{ width: 140 }}
      >
        <MenuItem value="ALL">All</MenuItem>
        <MenuItem value="Y">Active</MenuItem>
          <MenuItem value="N">Inactive</MenuItem>
        </TextField>
      </Stack>

      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid columns={columns} rows={rows} loading={false} getRowId={(r) => r.id} />
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Gate" : "Create Gate"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Organisation"
            value={form.org_id || selectedOrg}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
            fullWidth
            disabled={isEdit}
          >
            {orgOptions.map((o: any) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id || selectedMandi}
            onChange={(e) => setForm((f) => ({ ...f, mandi_id: e.target.value }))}
            fullWidth
            disabled={isEdit}
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.mandi_name || m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Gate Code"
            value={form.gate_code}
            onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Gate Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Direction"
            value={form.gate_direction}
            onChange={(e) => setForm((f) => ({ ...f, gate_direction: e.target.value }))}
            fullWidth
          >
            <MenuItem value="ENTRY">ENTRY</MenuItem>
            <MenuItem value="EXIT">EXIT</MenuItem>
            <MenuItem value="BOTH">BOTH</MenuItem>
          </TextField>
          <TextField
            select
            label="Type"
            value={form.gate_type}
            onChange={(e) => setForm((f) => ({ ...f, gate_type: e.target.value }))}
            fullWidth
          >
            <MenuItem value="VEHICLE">VEHICLE</MenuItem>
            <MenuItem value="PEDESTRIAN">PEDESTRIAN</MenuItem>
            <MenuItem value="MIXED">MIXED</MenuItem>
          </TextField>
          <TextField
            select
            label="Has Weighbridge"
            value={form.has_weighbridge}
            onChange={(e) => setForm((f) => ({ ...f, has_weighbridge: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
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
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
