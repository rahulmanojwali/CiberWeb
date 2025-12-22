import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Alert,
  IconButton,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  fetchMandiGates,
  createMandiGate,
  updateMandiGate,
  deactivateMandiGate,
  fetchMandis,
} from "../../services/mandiApi";
import { ActionGate } from "../../authz/ActionGate";
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
import { useSearchParams } from "react-router-dom";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

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
  mandi_name?: string;
  gate_code: string;
  gate_name: string;
  gate_direction?: string;
  gate_type?: string;
  has_weighbridge?: string;
  is_active: string;
  updated_on?: string;
  updated_by?: string;
  org_scope?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<GateRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const storedOrgId = searchParams.get("org_id") || localStorage.getItem("mandiGates.org_id") || authContext.org_id || "";
  const storedMandi = searchParams.get("mandi_id") || localStorage.getItem("mandiGates.mandi_id") || "";
  const storedStatus = (searchParams.get("status") as "ALL" | "Y" | "N" | null) || (localStorage.getItem("mandiGates.status") as any) || "ALL";
  const storedSearch = searchParams.get("search") || localStorage.getItem("mandiGates.search") || "";
  const isScopedOrg = !isSuper && !!authContext.org_id;
  const [selectedOrgId, setSelectedOrgId] = useState<string>(storedOrgId || "");
  const [selectedOrgCode, setSelectedOrgCode] = useState<string>(authContext.org_code || "");
  const [selectedMandi, setSelectedMandi] = useState<string>(storedMandi);
  const [mandiSearchText, setMandiSearchText] = useState("");
  const [createMandiSearch, setCreateMandiSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(storedStatus as "ALL" | "Y" | "N");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [gateCodeDirty, setGateCodeDirty] = useState(false);
  const [gateCodeError, setGateCodeError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [mandiSource, setMandiSource] = useState<"ORG" | "SYSTEM">("ORG");

  const canCreateMandiGate = useMemo(() => can("mandi_gates.create", "CREATE"), [can]);
  const canEdit = useMemo(() => can("mandi_gates.edit", "UPDATE"), [can]);
  const canDeactivate = useMemo(() => can("mandi_gates.deactivate", "DEACTIVATE"), [can]);

  const columns = useMemo<GridColDef<GateRow>[]>(
    () => [
      { field: "gate_code", headerName: "Gate Code", width: 140 },
      { field: "gate_name", headerName: "Gate Name", flex: 1 },
      { field: "gate_direction", headerName: "Direction", width: 120 },
      { field: "gate_type", headerName: "Type", width: 140 },
      { field: "has_weighbridge", headerName: "Weighbridge", width: 130 },
      { field: "org_name", headerName: "Org", width: 160 },
      { field: "mandi_name", headerName: "Mandi", width: 160 },
      { field: "is_active", headerName: "Active", width: 100 },
      { field: "updated_on", headerName: "Updated On", width: 160 },
      { field: "updated_by", headerName: "Updated By", width: 140 },
      {
        field: "actions",
        headerName: "Actions",
        width: 170,
        renderCell: (params) => {
          const row = params.row as GateRow;
          const lockInfo = isRecordLocked(row as any, { ...authContext, isSuper });
          const nextActive = row.is_active === "Y" ? "N" : "Y";
          return (
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => openEdit(row)}>
                View
              </Button>
              <ActionGate resourceKey="mandi_gates.edit" action="UPDATE" record={row}>
                {!lockInfo.locked && (
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                )}
              </ActionGate>
              <ActionGate resourceKey="mandi_gates.deactivate" action="DEACTIVATE" record={row}>
                {!lockInfo.locked && (
                  <IconButton size="small" color={row.is_active === "Y" ? "error" : "success"} onClick={() => handleDeactivate(row.id, nextActive)}>
                    {row.is_active === "Y" ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                )}
              </ActionGate>
            </Stack>
          );
        },
      },
    ],
    [authContext, isSuper],
  );

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const orgs = resp?.response?.data?.organisations || resp?.data?.organisations || [];
    if (orgs.length === 0 && isScopedOrg) {
      setOrgOptions([{ _id: authContext.org_id, org_code: authContext.org_code, org_name: authContext.org_code }]);
      setSelectedOrgId(String(authContext.org_id));
      setSelectedOrgCode(String(authContext.org_code || ""));
      return;
    }
    setOrgOptions(orgs);
    if (!selectedOrgId && orgs.length) {
      setSelectedOrgId(String(orgs[0]._id));
      setSelectedOrgCode(String(orgs[0].org_code || ""));
    }
  };

  useEffect(() => {
    if (!selectedOrgId) return;
    if (selectedOrgCode) return;
    const match = orgOptions.find((o: any) => String(o._id) === String(selectedOrgId));
    if (match?.org_code) {
      setSelectedOrgCode(String(match.org_code));
    }
  }, [selectedOrgId, selectedOrgCode, orgOptions]);

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const orgCodeParam = mandiSource === "ORG" ? selectedOrgCode || authContext.org_code || undefined : "SYSTEM";
    const resp = await fetchMandis({
      username,
      language,
      filters: {
        is_active: true,
        org_code: orgCodeParam,
        page: 1,
        pageSize: 1000,
        search: mandiSearchText || undefined,
      },
    });
    const mandis = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    const mapped = mandis.map((m: any) => ({
      mandi_id: String(m.mandi_id),
      label: m?.mandi_name || m?.name_i18n?.en || m.mandi_slug || m.mandi_id,
    }));
    const withAll = [{ mandi_id: "", label: "All" }, ...mapped];
    setMandiOptions(withAll);
    if (!selectedMandi) setSelectedMandi("");
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandiGates({
      username,
      language,
      filters: {
        org_id: selectedOrgId || undefined,
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
        mandi_name: g.mandi_name || "",
        gate_code: g.gate_code,
        gate_name: g?.name_i18n?.en || g.gate_code,
        gate_direction:
          g.gate_direction ||
          (g.is_entry_only === "Y" && g.is_exit_only === "N"
            ? "ENTRY"
            : g.is_entry_only === "N" && g.is_exit_only === "Y"
              ? "EXIT"
              : "BOTH"),
        gate_type: g.gate_type || (Array.isArray(g.allowed_vehicle_codes) && g.allowed_vehicle_codes.length ? g.allowed_vehicle_codes.join(", ") : "Gate"),
        has_weighbridge: g.is_weighbridge || g.has_weighbridge || "N",
        is_active: g.is_active,
        updated_on: g.updated_on,
        updated_by: g.updated_by,
        org_scope: g.org_scope || null,
        owner_type: g.owner_type || null,
        owner_org_id: g.owner_org_id || null,
        is_protected: g.is_protected || null,
      })),
    );
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  // Ensure scoped users always have at least their own org option visible
  useEffect(() => {
    if (!isScopedOrg || !selectedOrgId) return;
    const exists = orgOptions.some((o: any) => String(o._id) === String(selectedOrgId));
    if (!exists) {
      const fallback = {
        _id: selectedOrgId,
        org_code: selectedOrgCode || authContext.org_code || selectedOrgId,
        org_name: authContext.org_code || "",
      };
      setOrgOptions((opts) => [...opts, fallback]);
    }
  }, [isScopedOrg, selectedOrgId, selectedOrgCode, authContext.org_code, orgOptions]);

  useEffect(() => {
    loadMandis();
  }, [selectedOrgCode, mandiSearchText, mandiSource]);

  useEffect(() => {
    loadData();
    const next = new URLSearchParams(searchParams.toString());
    if (selectedOrgId) next.set("org_id", selectedOrgId); else next.delete("org_id");
    if (selectedMandi) next.set("mandi_id", selectedMandi); else next.delete("mandi_id");
    if (statusFilter) next.set("status", statusFilter);
    if (mandiSearchText) next.set("search", mandiSearchText); else next.delete("search");
    setSearchParams(next, { replace: true });
    try {
      localStorage.setItem("mandiGates.org_id", selectedOrgId || "");
      localStorage.setItem("mandiGates.mandi_id", selectedMandi || "");
      localStorage.setItem("mandiGates.status", statusFilter);
      localStorage.setItem("mandiGates.search", mandiSearchText || "");
    } catch {
      // ignore
    }
  }, [selectedMandi, statusFilter, selectedOrgId, selectedOrgCode, mandiSearchText]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setGateCodeDirty(false);
    setGateCodeError(null);
    setForm({ ...defaultForm, mandi_id: selectedMandi === "" ? "" : selectedMandi, org_id: selectedOrgId });
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
    setGateCodeDirty(false);
    setGateCodeError(null);
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
    const gateCodePattern = /^[a-z0-9_-]{2,32}$/;
    if (!gateCodePattern.test(form.gate_code)) {
      setGateCodeError("Gate code must be 2-32 chars, lowercase letters, numbers, _ or -");
      return;
    }
    if (!form.mandi_id) {
      setGateCodeError(null);
      setToast({ open: true, message: "Select a Mandi", severity: "error" });
      return;
    }
    const payload: any = {
      org_id: form.org_id || selectedOrgId,
      mandi_id: Number(form.mandi_id || selectedMandi),
      gate_code: form.gate_code,
      name_i18n: { en: form.name_en, hi: form.name_hi },
      gate_direction: form.gate_direction,
      gate_type: form.gate_type,
      has_weighbridge: form.has_weighbridge,
      allowed_vehicle_codes: [form.gate_type.toLowerCase()],
      is_entry_only: form.gate_direction === "ENTRY" ? "Y" : "N",
      is_exit_only: form.gate_direction === "EXIT" ? "Y" : "N",
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

  const handleDeactivate = async (id: string, nextActive: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiGate({ username, language, _id: id, is_active: nextActive });
    await loadData();
  };

  return (
    <PageContainer
      title={t("menu.mandiGates", { defaultValue: "Mandi Gates" })}
      actions={
        <ActionGate resourceKey="mandi_gates.create" action="CREATE">
          {canCreateMandiGate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={createOpen}
              onClick={handleOpenCreate}
            >
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </ActionGate>
      }
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} mb={2}>
        <TextField
          select
          size="small"
          label="Mandi Source"
          value={mandiSource}
          onChange={(e) => setMandiSource(e.target.value as "ORG" | "SYSTEM")}
          sx={{ width: 200 }}
        >
          <MenuItem value="ORG">Organisation Mandis</MenuItem>
          <MenuItem value="SYSTEM">System Mandis</MenuItem>
        </TextField>
        <Autocomplete
          size="small"
          options={mandiOptions}
          getOptionLabel={(option: any) => option.label || String(option.mandi_id)}
          isOptionEqualToValue={(opt: any, val: any) => String(opt.mandi_id) === String(val.mandi_id)}
          filterOptions={(opts) => opts}
          freeSolo
          value={selectedMandi ? mandiOptions.find((m: any) => String(m.mandi_id) === String(selectedMandi)) || null : null}
          onChange={(_, val: any) => {
            setSelectedMandi(val ? String(val.mandi_id) : "");
            setMandiSearchText(val ? val.label || String(val.mandi_id) : "");
          }}
          inputValue={mandiSearchText}
          onInputChange={(_, val: string, reason: string) => {
            if (reason === "clear") {
              setMandiSearchText("");
              setSelectedMandi("");
              return;
            }
            setMandiSearchText(val);
          }}
          renderInput={(params: any) => (
            <TextField
              {...params}
              label="Mandi"
              placeholder="All"
              fullWidth
            />
          )}
          sx={{ minWidth: 240 }}
        />
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

      {isMobile ? (
        <Stack spacing={2}>
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="h6">{row.gate_name || row.gate_code}</Typography>
              <Typography variant="body2" color="text.secondary">
                  Code: {row.gate_code} • Direction: {row.gate_direction || "-"} • Type: {row.gate_type || "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                  Org: {row.org_name || row.org_id} • Mandi: {row.mandi_name || row.mandi_id}
              </Typography>
                <Typography variant="body2" color="text.secondary">
                  Weighbridge: {row.has_weighbridge || "N"} • Active: {row.is_active}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Updated: {row.updated_on || "-"} by {row.updated_by || "-"}
                </Typography>
              </CardContent>
              <CardActions>
                <ActionGate resourceKey="mandi_gates.edit" action="UPDATE" record={row}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                </ActionGate>
                <ActionGate resourceKey="mandi_gates.deactivate" action="DEACTIVATE" record={row}>
                  <Button
                    size="small"
                    color={row.is_active === "Y" ? "error" : "success"}
                    startIcon={row.is_active === "Y" ? <BlockIcon /> : <CheckCircleIcon />}
                    onClick={() => handleDeactivate(row.id, row.is_active === "Y" ? "N" : "Y")}
                  >
                    {row.is_active === "Y" ? "Deactivate" : "Activate"}
                  </Button>
                </ActionGate>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        <Box sx={{ height: 520 }}>
          <ResponsiveDataGrid columns={columns} rows={rows} loading={false} getRowId={(r) => r.id} />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>{isEdit ? "Edit Gate" : "Create Gate"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Organisation"
            value={form.org_id || selectedOrgId}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
            fullWidth
            disabled={isEdit || isScopedOrg}
          >
            {orgOptions.map((o: any) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            size="small"
            options={mandiOptions.filter((m: any) => m.mandi_id !== "")}
            getOptionLabel={(option: any) => option.label || String(option.mandi_id)}
            isOptionEqualToValue={(opt: any, val: any) => String(opt.mandi_id) === String(val.mandi_id)}
            filterOptions={(opts) => opts}
            freeSolo
            value={
              form.mandi_id
                ? mandiOptions.find((m: any) => String(m.mandi_id) === String(form.mandi_id)) || null
                : null
            }
            onChange={(_, val: any) => {
              setForm((f) => ({ ...f, mandi_id: val ? String(val.mandi_id) : "" }));
              setCreateMandiSearch(val ? val.label || String(val.mandi_id) : "");
            }}
            inputValue={createMandiSearch}
            onInputChange={(_, val: string, reason: string) => {
              if (reason === "clear") {
                setCreateMandiSearch("");
                setForm((f) => ({ ...f, mandi_id: "" }));
                setMandiSearchText("");
                return;
              }
              setCreateMandiSearch(val);
              setMandiSearchText(val);
            }}
            renderInput={(params: any) => (
              <TextField
                {...params}
                label="Mandi"
                placeholder="Search mandi by name or slug"
                fullWidth
                disabled={isEdit || !selectedOrgCode}
              />
            )}
          />
          <TextField
            label="Gate Code"
            value={form.gate_code}
            disabled
            error={!!gateCodeError}
            helperText={gateCodeError || "Auto-generated from Gate Name"}
            fullWidth
          />
          <TextField
            label="Gate Name (EN)"
            value={form.name_en}
            onChange={(e) => {
              const val = e.target.value;
              setForm((f) => ({ ...f, name_en: val }));
              if (!gateCodeDirty) {
                const slug = val
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 32);
                setForm((f) => ({ ...f, name_en: val, gate_code: slug }));
              }
            }}
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
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};
