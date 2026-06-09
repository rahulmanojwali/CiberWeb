import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import {
  fetchMandiAssociationRequests,
  updateMandiAssociationRequest,
} from "../../services/mandiAssociationsApi";
import { usePermissions } from "../../authz/usePermissions";
import { ActionGate } from "../../authz/ActionGate";

type AssociationRow = {
  id: string;
  org_id?: string | null;
  mandi_id?: number | string | null;
  party_type?: string | null;
  party_ref?: string | null;
  user_ref?: {
    username?: string | null;
    mobile?: string | null;
    walkin?: {
      name?: string | null;
      mobile?: string | null;
    } | null;
  } | null;
  walkin_name?: string | null;
  walkin_mobile?: string | null;
  source?: string | null;
  status?: string | null;
  org_name?: string | null;
  mandi_name?: string | null;
  username?: string | null;
  display_name?: string | null;
  user_name?: string | null;
  mobile?: string | null;
  requested_on?: string | null;
  created_on?: string | null;
};

type Option = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function chipColor(status?: string | null) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING" || normalized === "REQUESTED") return "primary";
  if (normalized === "TEMP_APPROVED") return "warning";
  if (normalized === "APPROVED") return "success";
  if (normalized === "REJECTED") return "error";
  return "default";
}

function statusLabel(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized) return "-";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const MandiAssociations: React.FC = () => {
  const { i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const language = normalizeLanguageCode(i18n.language);

  const canView = useMemo(() => can("mandi_associations.view", "VIEW"), [can]);
  const canUpdate = useMemo(() => can("mandi_associations.update", "UPDATE"), [can]);

  const [rows, setRows] = useState<AssociationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);

  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    party_type: "",
    status: "REQUESTED",
    mobile: "",
  });

  const [tempDialogOpen, setTempDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AssociationRow | null>(null);
  const [tempHours, setTempHours] = useState("8");
  const [rejectReason, setRejectReason] = useState("");

  const statusOptions: Option[] = [
    { value: "REQUESTED", label: "Requested" },
    { value: "TEMP_APPROVED", label: "Temp Approved" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "EXPIRED", label: "Expired" },
  ];
  const partyTypeOptions: Option[] = [
    { value: "", label: "All" },
    { value: "FARMER", label: "Farmer" },
    { value: "TRADER", label: "Trader" },
  ];

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const list = resp?.data?.organisations || resp?.response?.data?.organisations || [];
    setOrgOptions(
      list.map((org: any) => ({
        value: org._id || org.org_id || org.org_code,
        label: org.org_name ? `${org.org_name} (${org.org_code || org._id})` : org.org_code || org._id,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const orgId = uiConfig.role === "SUPER_ADMIN" ? filters.org_id : uiConfig.scope?.org_id || "";
    if (!orgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
        filters: { page: 1, pageSize: 200 },
      });
      setMandiOptions(
        list.map((m: any) => ({
          value: String(m.mandi_id || m.slug || m.mandi_slug || ""),
          label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
        })),
      );
    } catch (err) {
      console.error("[MandiAssociations] loadMandis error", err);
      setMandiOptions([]);
    }
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const orgId = uiConfig.role === "SUPER_ADMIN" ? filters.org_id : uiConfig.scope?.org_id || undefined;
      const resp = await fetchMandiAssociationRequests({
        username,
        language,
        filters: {
          org_id: orgId || undefined,
          mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
          party_type: filters.party_type || undefined,
          status: filters.status || "REQUESTED",
          user_ref_username: filters.mobile || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      setRows(
        list.map((item: any) => ({
          id: item._id || item.id,
          ...item,
        })),
      );
    } catch (err: any) {
      console.error("[MandiAssociations] loadData error", err);
      enqueueSnackbar(err?.message || "Unable to load association requests.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = useCallback(async (row: AssociationRow, extra: Record<string, any>) => {
    if (!canUpdate) return;
    const username = currentUsername();
    if (!username) return;
    try {
      const payload = {
        username,
        language,
        request_id: row.id,
        org_id: row.org_id,
        mandi_id: row.mandi_id,
        ...extra,
      };
      const resp = await updateMandiAssociationRequest(payload);
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Update failed.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Association updated.", { variant: "success" });
      loadData();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Update failed.", { variant: "error" });
    }
  }, [canUpdate, enqueueSnackbar, language]);

  const stats = useMemo(() => {
    const base = { REQUESTED: 0, TEMP_APPROVED: 0, APPROVED: 0, REJECTED: 0 };
    rows.forEach((row) => {
      const status = String(row.status || "").toUpperCase();
      if (status in base) base[status as keyof typeof base] += 1;
    });
    return base;
  }, [rows]);

  const displayUser = (row?: AssociationRow | null) =>
    row?.display_name || row?.user_name || row?.user_ref?.walkin?.name || row?.walkin_name || row?.user_ref?.username || row?.party_ref || "-";

  const displayUsername = (row?: AssociationRow | null) =>
    row?.username || row?.user_ref?.username || row?.party_ref || row?.mobile || "-";

  const displayMobile = (row?: AssociationRow | null) =>
    row?.mobile || row?.user_ref?.mobile || row?.user_ref?.walkin?.mobile || row?.walkin_mobile || row?.user_ref?.username || row?.party_ref || "-";

  const displayOrg = (row?: AssociationRow | null) => row?.org_name || "Unknown organisation";
  const displayMandi = (row?: AssociationRow | null) => row?.mandi_name || "Unknown mandi";

  const columns = useMemo<GridColDef<AssociationRow>[]>(
    () => [
      {
        field: "user",
        headerName: "User",
        width: 190,
        sortable: false,
        renderCell: (params) => (
          <Box>
            <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
              {displayUser(params.row)}
            </Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
              {displayUsername(params.row)}
            </Typography>
          </Box>
        ),
      },
      {
        field: "mobile",
        headerName: "Mobile",
        width: 135,
        valueGetter: (_value, row) => displayMobile(row),
      },
      {
        field: "party_type",
        headerName: "Party",
        width: 105,
        valueGetter: (value) => value || "-",
      },
      {
        field: "org_id",
        headerName: "Organisation",
        width: 220,
        sortable: false,
        renderCell: (params) => (
          <Typography variant="body2" fontWeight={600} noWrap title={displayOrg(params.row)}>
            {displayOrg(params.row)}
          </Typography>
        ),
      },
      {
        field: "mandi_id",
        headerName: "Mandi",
        width: 170,
        sortable: false,
        renderCell: (params) => (
          <Box>
            <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
              {displayMandi(params.row)}
            </Typography>
            <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
              ID: {params.row.mandi_id || "-"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 135,
        renderCell: (params) => (
          <Chip size="small" label={statusLabel(params.value)} color={chipColor(params.value)} sx={{ fontWeight: 700 }} />
        ),
      },
      {
        field: "requested_on",
        headerName: "Requested On",
        width: 190,
        valueFormatter: (value, row) => formatDate(value || row?.created_on),
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        width: 330,
        minWidth: 330,
        align: "left",
        headerAlign: "left",
        renderCell: (params) => (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ width: "100%" }}>
            <ActionGate resourceKey="mandi_associations.update" action="UPDATE" record={params.row}>
              <Button
                size="small"
                variant="contained"
                color="success"
                disabled={String(params.row.status || "").toUpperCase() !== "REQUESTED"}
                sx={{ minWidth: 78, px: 1.25, py: 0.35, fontSize: 12, boxShadow: "none" }}
                onClick={() => {
                  setSelectedRow(params.row);
                  setApproveDialogOpen(true);
                }}
              >
                Approve
              </Button>
            </ActionGate>
            <ActionGate resourceKey="mandi_associations.update" action="UPDATE" record={params.row}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={String(params.row.status || "").toUpperCase() !== "REQUESTED"}
                sx={{ minWidth: 70, px: 1.25, py: 0.35, fontSize: 12 }}
                onClick={() => {
                  setSelectedRow(params.row);
                  setRejectReason("");
                  setRejectDialogOpen(true);
                }}
              >
                Reject
              </Button>
            </ActionGate>
            <ActionGate resourceKey="mandi_associations.update" action="UPDATE" record={params.row}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={String(params.row.status || "").toUpperCase() !== "REQUESTED"}
                sx={{ minWidth: 112, px: 1.25, py: 0.35, fontSize: 12 }}
                onClick={() => {
                  setSelectedRow(params.row);
                  setTempHours("8");
                  setTempDialogOpen(true);
                }}
              >
                Temp Approve
              </Button>
            </ActionGate>
          </Stack>
        ),
      },
    ],
    [handleUpdate],
  );

  useEffect(() => {
    loadOrganisations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMandis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.org_id, uiConfig.scope?.org_id]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.org_id, filters.mandi_id, filters.party_type, filters.status, filters.mobile, uiConfig.scope?.org_id, canView]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Forbidden: You do not have permission.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ActionGate resourceKey="mandi_associations.view" action="VIEW">
        <Stack spacing={2} mb={2}>
          <Paper sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="h5">Mandi Association Requests</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Review farmer/trader requests to work with mandis.
            </Typography>
          </Paper>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
            {[
              ["Requested", stats.REQUESTED],
              ["Temp Approved", stats.TEMP_APPROVED],
              ["Approved", stats.APPROVED],
              ["Rejected", stats.REJECTED],
            ].map(([label, value]) => (
              <Paper key={String(label)} sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>{value}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} flexWrap="wrap">
            {uiConfig.role === "SUPER_ADMIN" && (
              <TextField
                select
                label="Organisation"
                value={filters.org_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, org_id: e.target.value, mandi_id: "" }))}
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">
                  <em>Select org</em>
                </MenuItem>
                {orgOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              label="Mandi"
              value={filters.mandi_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
              size="small"
              sx={{ minWidth: 200 }}
              disabled={uiConfig.role === "SUPER_ADMIN" && !filters.org_id}
            >
              <MenuItem value="">
                <em>All mandis</em>
              </MenuItem>
              {mandiOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Party Type"
              value={filters.party_type}
              onChange={(e) => setFilters((prev) => ({ ...prev, party_type: e.target.value }))}
              size="small"
              sx={{ minWidth: 160 }}
            >
              {partyTypeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Status"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              size="small"
              sx={{ minWidth: 200 }}
            >
              {statusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Mobile"
              value={filters.mobile}
              onChange={(e) => setFilters((prev) => ({ ...prev, mobile: e.target.value }))}
              size="small"
              sx={{ minWidth: 180 }}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </Button>
          </Stack>
          </Paper>
        </Stack>

        <Paper sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="h6">Pending Requests</Typography>
            <Typography variant="body2" color="text.secondary">
              Review farmer/trader access requests for mandis.
            </Typography>
          </Box>
          <ResponsiveDataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            autoHeight
            rowHeight={58}
            getRowId={(r) => r.id}
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
            minWidth={1180}
            sx={{
              boxShadow: "none",
              "& .MuiDataGrid-cell": {
                alignItems: "center",
                display: "flex",
              },
            }}
          />
        </Paper>
      </ActionGate>

      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Approve request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {displayUser(selectedRow)} will be allowed to sell in {displayMandi(selectedRow)}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedRow) return;
              handleUpdate(selectedRow, { status: "APPROVED" });
              setApproveDialogOpen(false);
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tempDialogOpen} onClose={() => setTempDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Temp Approve (Hours)</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Valid for (hours)"
            type="number"
            value={tempHours}
            onChange={(e) => setTempHours(e.target.value)}
            inputProps={{ min: 1, max: 72 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTempDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedRow) return;
              const hours = Number(tempHours) || 8;
              handleUpdate(selectedRow, {
                status: "TEMP_APPROVED",
                status_note: `TEMP_APPROVED_${hours}H`,
                expires_in_hours: hours,
              });
              setTempDialogOpen(false);
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reject Association</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (!selectedRow) return;
              handleUpdate(selectedRow, {
                status: "REJECTED",
                decision_note: rejectReason.trim() || null,
              });
              setRejectDialogOpen(false);
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default MandiAssociations;
