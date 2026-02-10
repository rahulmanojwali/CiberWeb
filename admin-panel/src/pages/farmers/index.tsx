import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { getFarmers, updateFarmerStatus } from "../../services/partyMastersApi";

type FarmerRow = {
  id: string;
  farmer_id: string;
  name?: string | null;
  mobile?: string | null;
  org_code?: string | null;
  mandi_code?: string | null;
  status: string;
  created_on?: string | null;
};

type FarmerDetail = Record<string, any>;
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

function currentOrgId(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.org_id || null;
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

export const Farmers: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [filters, setFilters] = useState({
    org_code: "",
    mandi_code: "",
    status: "",
    mobile: "",
    farmer_id: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FarmerDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<string>("");

  const canMenu = useMemo(() => can(uiConfig.resources, "farmers.menu", "VIEW"), [uiConfig.resources]);
  const canList = useMemo(() => can(uiConfig.resources, "farmers.list", "VIEW"), [uiConfig.resources]);
  const canUpdate = useMemo(() => can(uiConfig.resources, "farmers.update_status", "UPDATE"), [uiConfig.resources]);
  const canDetail = canList;

  const columns = useMemo<GridColDef<FarmerRow>[]>(
    () => [
      { field: "farmer_id", headerName: "Farmer ID", width: 140 },
      { field: "name", headerName: "Name", width: 180 },
      { field: "mobile", headerName: "Mobile", width: 160 },
      { field: "org_code", headerName: "Org Code", width: 140 },
      { field: "mandi_code", headerName: "Mandi Code", width: 160 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 320,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canDetail && (
              <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => openDetail(params.row)}>
                View
              </Button>
            )}
            {canUpdate && String(params.row.status || "").toUpperCase() === "ACTIVE" && (
              <Button size="small" color="warning" onClick={() => handleStatusChange(params.row, "INACTIVE")}>
                Deactivate
              </Button>
            )}
            {canUpdate && String(params.row.status || "").toUpperCase() === "INACTIVE" && (
              <Button size="small" color="success" onClick={() => handleStatusChange(params.row, "ACTIVE")}>
                Activate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDetail, canUpdate],
  );

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const list = resp?.data?.organisations || resp?.response?.data?.organisations || [];
    setOrgOptions(
      list.map((org: any) => ({
        value: org.org_code || org._id || "",
        label: org.org_name ? `${org.org_name} (${org.org_code || org._id})` : org.org_code || org._id,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    setMandiOptions(
      list.map((m: any) => ({
        value: String(m.mandi_code || m.mandi_id || ""),
        label: m?.name_i18n?.en || m?.mandi_name || String(m.mandi_code || m.mandi_id || ""),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canList) return;
    setLoading(true);
    try {
      const resp = await getFarmers({
        username,
        language,
        filters: {
          org_code: filters.org_code || undefined,
          mandi_code: filters.mandi_code || undefined,
          status: filters.status || undefined,
          mobile: filters.mobile || undefined,
          farmer_id: filters.farmer_id || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page: 1,
          limit: 100,
        },
      });
      const list = resp?.data?.rows || resp?.response?.data?.rows || [];
      const mapped: FarmerRow[] = list.map((item: any, idx: number) => ({
        id: item.farmer_id || item._id || `farmer-${idx}`,
        farmer_id: String(item.farmer_id || ""),
        name: item.name || item.display_name || null,
        mobile: item.mobile || null,
        org_code: item.org_code || null,
        mandi_code: item.mandi_code || null,
        status: (item.status || "").toString().toUpperCase(),
        created_on: item.created_on || null,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (row: FarmerRow, status: string) => {
    const username = currentUsername();
    if (!username) return;
    await updateFarmerStatus({
      username,
      language,
      payload: {
        farmer_id: row.farmer_id,
        status,
      },
    });
    await loadData();
  };

  const openDetail = (row: FarmerRow) => {
    setSelectedId(row.farmer_id);
    setDetail(row);
    setDetailOpen(true);
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [
    filters.org_code,
    filters.mandi_code,
    filters.status,
    filters.mobile,
    filters.farmer_id,
    filters.date_from,
    filters.date_to,
    language,
    canList,
  ]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canMenu || !canList) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view farmers.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.farmers", { defaultValue: "Farmers" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Registry of farmer accounts with status management.
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} mb={2} alignItems={{ xs: "flex-start", md: "center" }} flexWrap="wrap">
        {uiConfig.role === "SUPER_ADMIN" && (
          <TextField
            select
            label="Organisation"
            size="small"
            sx={{ minWidth: 200 }}
            value={filters.org_code}
            onChange={(e) => updateFilter("org_code", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          label="Mandi"
          size="small"
          sx={{ minWidth: 180 }}
          value={filters.mandi_code}
          onChange={(e) => updateFilter("mandi_code", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {mandiOptions.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 150 }}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="INACTIVE">Inactive</MenuItem>
        </TextField>

        <TextField
          label="Mobile"
          size="small"
          value={filters.mobile}
          onChange={(e) => updateFilter("mobile", e.target.value)}
        />

        <TextField
          label="Farmer ID"
          size="small"
          value={filters.farmer_id}
          onChange={(e) => updateFilter("farmer_id", e.target.value)}
        />

        <TextField
          label="Date From"
          type="date"
          size="small"
          value={filters.date_from}
          onChange={(e) => updateFilter("date_from", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Date To"
          type="date"
          size="small"
          value={filters.date_to}
          onChange={(e) => updateFilter("date_to", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Farmer Detail</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
          {detail ? (
            <>
              <Stack direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Farmer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detail.farmer_username}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Name
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detail.farmer_name || "-"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Org ID
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detail.org_id || "-"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Mandis
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {(detail.mandis || []).map((m: any, idx: number) => {
                    const label = m?.mandi_name || resolveMandiName(mandiNameMap, m?.mandi_id);
                    const inactive = m?.is_active === "N" || m?.is_active === false;
                    return (
                      <Chip
                        key={idx}
                        label={`${label || m?.mandi_id}${inactive ? " (Inactive)" : ""}`}
                        size="small"
                        color={inactive ? "default" : "success"}
                        variant={inactive ? "outlined" : "filled"}
                      />
                    );
                  })}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detail.approval_status || "-"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  Updated On
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(detail.updated_on)}
                </Typography>
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No detail available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Approve Farmer</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2">Select mandis to enable for approval.</Typography>
          <TextField
            select
            label="Mandis"
            SelectProps={{ multiple: true }}
            value={selectedMandis}
            onChange={(e) =>
              setSelectedMandis(
                (Array.isArray(e.target.value) ? e.target.value : [e.target.value]).map((v) => String(v)),
              )
            }
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button onClick={submitApprove} disabled={!selectedMandis.length}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{actionMode === "SUSPEND" ? "Suspend Farmer" : "Reject Farmer"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {actionMode === "SUSPEND" && (
            <TextField
              select
              label="Mandis to suspend"
              SelectProps={{ multiple: true }}
              value={selectedMandis}
              onChange={(e) =>
                setSelectedMandis(
                  (Array.isArray(e.target.value) ? e.target.value : [e.target.value]).map((v) => String(v)),
                )
              }
            >
              {mandiOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label={actionMode === "SUSPEND" ? "Reason for suspension" : "Reason"}
            multiline
            minRows={2}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            onClick={submitReject}
            disabled={!reasonText.trim() || (actionMode === "SUSPEND" && !selectedMandis.length)}
            color={actionMode === "SUSPEND" ? "warning" : "error"}
          >
            {actionMode === "SUSPEND" ? "Suspend" : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reactivateOpen} onClose={() => setReactivateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Activate Mandis</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <Typography variant="body2">Select mandis to activate for this farmer.</Typography>
          <TextField
            select
            label="Mandis"
            SelectProps={{ multiple: true }}
            value={selectedMandis}
            onChange={(e) =>
              setSelectedMandis(
                (Array.isArray(e.target.value) ? e.target.value : [e.target.value]).map((v) => String(v)),
              )
            }
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReactivateOpen(false)}>Cancel</Button>
          <Button onClick={submitReactivate} disabled={!selectedMandis.length} color="success">
            Activate
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Request More Info</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Reason / Info Needed"
            multiline
            minRows={2}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)}>Cancel</Button>
          <Button onClick={submitRequestInfo} disabled={!reasonText.trim()} color="warning">
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
