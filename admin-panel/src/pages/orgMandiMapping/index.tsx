import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchOrgMandiMappings, addOrgMandi, fetchMandis } from "../../services/mandiApi";
import Autocomplete from "@mui/material/Autocomplete";

type MappingRow = {
  id: string;
  org_id: string;
  org_code: string | null;
  org_name: string | null;
  mandi_id: number;
  mandi_slug: string | null;
  mandi_name?: string | null;
  mandi_active?: string | null;
  state_code: string | null;
  district_name: string | null;
  pincode: string | null;
  assignment_scope: string;
  is_active: string;
};

type OrgOption = { _id: string; org_code: string; org_name: string };
type MandiOption = { mandi_id: number; name: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const OrgMandiMapping: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobile = fullScreenDialog;
  const roleSlug = uiConfig.role || "";

  const [rows, setRows] = useState<MappingRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);
  const [mandiSearch, setMandiSearch] = useState("");
  const [selectedMandi, setSelectedMandi] = useState<MandiOption | null>(null);
  const [filters, setFilters] = useState({ org_id: "", status: "ALL" as "ALL" | "Y" | "N" });
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    org_id: "",
    mandi_id: "",
    assignment_scope: "EXCLUSIVE",
    is_active: true,
  });
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>(
    {
      open: false,
      message: "",
      severity: "success",
    },
  );

  const canCreate = useMemo(
    () => can(uiConfig.resources, "org_mandi_mappings.create", "CREATE") || ["SUPER_ADMIN", "ORG_ADMIN"].includes(roleSlug),
    [uiConfig.resources, roleSlug],
  );

  const columns = useMemo<GridColDef<MappingRow>[]>(
    () => [
      { field: "org_code", headerName: "Org Code", width: 140, valueGetter: (params) => params.row.org_code || params.row.org_name },
      { field: "mandi_id", headerName: "Mandi ID", width: 110 },
      { field: "mandi_slug", headerName: "Mandi", width: 200, valueGetter: (params) => params.row.mandi_name || params.row.mandi_slug },
      { field: "state_code", headerName: "State", width: 110 },
      { field: "district_name", headerName: "District", width: 160 },
      { field: "pincode", headerName: "Pincode", width: 110 },
      { field: "assignment_scope", headerName: "Scope", width: 120 },
      {
        field: "mandi_status",
        headerName: "Status",
        width: 120,
        renderCell: (params) => {
          const active = params.row.mandi_active ?? params.row.is_active;
          const label = active === "Y" ? "Active" : "Inactive";
          const color = active === "Y" ? "success" : "default";
          return <Chip size="small" color={color === "success" ? "success" : undefined} label={label} />;
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        renderCell: (params) => (
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            href={`/mandis/${params.row.mandi_id}`}
          >
            View
          </Button>
        ),
      },
    ],
    [],
  );

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const orgs = resp?.response?.data?.organisations || resp?.data?.organisations || [];
    setOrgOptions(orgs.map((o: any) => ({ _id: o._id, org_code: o.org_code, org_name: o.org_name })));
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({
      username,
      language,
      filters: { is_active: true, page: 1, pageSize: 1000, search: mandiSearch },
    });
    const mandis = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    // eslint-disable-next-line no-console
    console.log("OrgMandi mandis response", resp);
    const mapped: MandiOption[] = mandis.map((m: any) => ({
      mandi_id: m.mandi_id,
      name: m?.mandi_name || m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
    }));
    if (selectedMandi && !mapped.find((m) => m.mandi_id === selectedMandi.mandi_id)) {
      mapped.push(selectedMandi);
    }
    setMandiOptions(mapped);
    if (!selectedMandi && form.mandi_id) {
      const found = mapped.find((m) => String(m.mandi_id) === String(form.mandi_id));
      if (found) setSelectedMandi(found);
    }
  };

  const loadMappings = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchOrgMandiMappings({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status,
        },
      });
      const list = resp?.data?.mappings || resp?.response?.data?.mappings || [];
      // eslint-disable-next-line no-console
      console.log("OrgMandi mappings response", resp);
      setRows(
        list.map((m: any) => ({
          id: m._id,
          org_id: m.org_id,
          org_code: m.org_code,
          org_name: m.org_name,
          mandi_id: m.mandi_id,
          mandi_slug: m.mandi_slug || m.mandi_name || String(m.mandi_id),
          mandi_name: m.mandi_name || m.name_i18n?.en || null,
          mandi_active: m.mandi_is_active || m.mandi_active || m.is_active_mandi || m.is_active,
          state_code: m.state_code,
          district_name: m.district_name,
          pincode: m.pincode,
          assignment_scope: m.assignment_scope,
          is_active: m.is_active,
        })),
      );
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("OrgMandi mappings load error", err);
      setToast({ open: true, message: "Failed to load mappings", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    loadMandis();
  }, []);

  useEffect(() => {
    loadMappings();
  }, [filters.org_id, filters.status]);

  useEffect(() => {
    loadMandis();
  }, [mandiSearch]);

  const openCreate = () => {
    setForm({ org_id: "", mandi_id: "", assignment_scope: "EXCLUSIVE", is_active: true });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    if (!form.org_id || !form.mandi_id) {
      setToast({ open: true, message: "org and mandi required", severity: "error" });
      return;
    }
    try {
      const resp = await addOrgMandi({
        username,
        language,
        payload: {
          org_id: form.org_id,
          mandi_id: Number(form.mandi_id),
          assignment_scope: form.assignment_scope,
          is_active: form.is_active ? "Y" : "N",
        },
      });
      // eslint-disable-next-line no-console
      console.log("AddOrgMandi resp", resp);
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Unknown";
      if (code !== "0") {
        setToast({ open: true, message: desc, severity: "error" });
        return;
      }
      setDialogOpen(false);
      setToast({ open: true, message: "Saved", severity: "success" });
      await loadMappings();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("AddOrgMandi error", err);
      setToast({ open: true, message: "Failed to save mapping", severity: "error" });
    }
  };

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Org–Mandi Mapping</Typography>
          <Typography variant="body2" color="text.secondary">
            Assign mandis to organisations with granular scope controls.
          </Typography>
        </Stack>
        {canCreate && (
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Add Mapping
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Organisation"
                size="small"
                value={filters.org_id}
                onChange={(e) => setFilters((f) => ({ ...f, org_id: e.target.value }))}
                fullWidth
              >
                <MenuItem value="">All</MenuItem>
                {orgOptions.map((o) => (
                  <MenuItem key={o._id} value={o._id}>
                    {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Status"
                size="small"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
                fullWidth
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="Y">Active</MenuItem>
                <MenuItem value="N">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                size="medium"
                onClick={loadMappings}
                disabled={loading}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isMobile ? (
        <Stack spacing={2}>
          {rows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography variant="h6">
                  Org: {row.org_code || row.org_id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mandi: {row.mandi_slug || row.mandi_id} • Scope: {row.assignment_scope}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active: {row.is_active}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  State: {row.state_code || "-"} • District: {row.district_name || "-"} • Pincode: {row.pincode || "-"}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.id} />
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>Map Organisation to Mandi</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} mt={1}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Organisation"
              size="small"
              value={form.org_id}
              onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
              fullWidth
            >
              {orgOptions.map((o) => (
                <MenuItem key={o._id} value={o._id}>
                  {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              size="small"
              options={mandiOptions}
              getOptionLabel={(option) => `${option.name} (${option.mandi_id})`}
              inputValue={mandiSearch}
              onInputChange={(_, value) => setMandiSearch(value)}
              value={selectedMandi}
              onChange={(_, val) => {
                setSelectedMandi(val);
                setForm((f) => ({ ...f, mandi_id: val ? String(val.mandi_id) : "" }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Mandi"
                  placeholder="Search mandi by name or slug"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Scope"
                size="small"
                value={form.assignment_scope}
                onChange={(e) => setForm((f) => ({ ...f, assignment_scope: e.target.value }))}
                fullWidth
              >
                <MenuItem value="EXCLUSIVE">Exclusive</MenuItem>
                <MenuItem value="SHARED">Shared</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Active"
                size="small"
                value={form.is_active ? "Y" : "N"}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))}
                fullWidth
              >
                <MenuItem value="Y">Yes</MenuItem>
                <MenuItem value="N">No</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
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
