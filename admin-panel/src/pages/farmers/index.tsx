import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { buildMandiNameMap, resolveMandiName } from "../../utils/cmLookupResolvers";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { approveFarmerForMandis, listFarmerApprovalRequests, rejectFarmerApproval, requestMoreInfoFarmer } from "../../services/farmerApprovalsApi";

type FarmerRow = {
  id: string;
  farmer_username: string;
  farmer_name?: string | null;
  org_id?: string | null;
  mandis?: Array<any>;
  approval_status: string;
  updated_on?: string | null;
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
    org_id: "",
    mandi_id: "",
    approval_status: "",
    farmer_username: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [mandiNameMap, setMandiNameMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FarmerDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [actionRow, setActionRow] = useState<FarmerRow | null>(null);
  const [selectedMandis, setSelectedMandis] = useState<string[]>([]);
  const [reasonText, setReasonText] = useState("");

  const canMenu = useMemo(() => can(uiConfig.resources, "farmers.menu", "VIEW"), [uiConfig.resources]);
  const canList = useMemo(() => can(uiConfig.resources, "farmers.list", "VIEW"), [uiConfig.resources]);
  const canUpdate = useMemo(() => can(uiConfig.resources, "farmers.update_status", "UPDATE"), [uiConfig.resources]);
  const canDetail = canList;

  const columns = useMemo<GridColDef<FarmerRow>[]>(
    () => [
      { field: "farmer_username", headerName: "Farmer", width: 160 },
      { field: "farmer_name", headerName: "Name", width: 180 },
      { field: "org_id", headerName: "Org ID", width: 220 },
      {
        field: "mandis",
        headerName: "Mandis",
        width: 220,
        valueFormatter: (value) => {
          const list = Array.isArray(value) ? value : [];
          const labels = list.map((m: any) => m?.mandi_name || resolveMandiName(mandiNameMap, m?.mandi_id)).filter(Boolean);
          return labels.join(", ");
        },
      },
      { field: "approval_status", headerName: "Status", width: 160 },
      {
        field: "updated_on",
        headerName: "Updated On",
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
            {canUpdate && (
              <Button size="small" onClick={() => openApprove(params.row)}>
                Approve
              </Button>
            )}
            {canUpdate && (
              <Button size="small" color="error" onClick={() => openReject(params.row)}>
                Reject
              </Button>
            )}
            {canUpdate && (
              <Button size="small" color="warning" onClick={() => openRequestInfo(params.row)}>
                More Info
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDetail, canUpdate, mandiNameMap],
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
        value: String(m.mandi_id || ""),
        label: m?.name_i18n?.en || String(m.mandi_id || ""),
      })),
    );
    setMandiNameMap(buildMandiNameMap(list, language));
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canList) return;
    setLoading(true);
    try {
      const scopedOrgId = uiConfig?.scope?.org_id || currentOrgId();
      const resp = await listFarmerApprovalRequests({
        username,
        language,
        filters: {
          org_id: filters.org_id || scopedOrgId || undefined,
          mandi_id: filters.mandi_id || undefined,
          approval_status: filters.approval_status || undefined,
          farmer_username: filters.farmer_username || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page: 1,
          limit: 100,
        },
      });
      const list = resp?.data?.rows || resp?.response?.data?.rows || [];
      const mapped: FarmerRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.farmer_username || `farmer-${idx}`,
        farmer_username: String(item.farmer_username || ""),
        farmer_name: item.farmer_name || null,
        org_id: item.org_id || null,
        mandis: item.mandis || [],
        approval_status: (item.approval_status || "").toString(),
        updated_on: item.updated_on || item.updatedAt || null,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (row: FarmerRow) => {
    setSelectedId(row.farmer_username);
    setDetail(row);
    setDetailOpen(true);
  };

  const openApprove = (row: FarmerRow) => {
    setActionRow(row);
    const current = Array.isArray(row.mandis) ? row.mandis.map((m: any) => String(m?.mandi_id || "")).filter(Boolean) : [];
    setSelectedMandis(current);
    setApproveOpen(true);
  };

  const openReject = (row: FarmerRow) => {
    setActionRow(row);
    setReasonText("");
    setRejectOpen(true);
  };

  const openRequestInfo = (row: FarmerRow) => {
    setActionRow(row);
    setReasonText("");
    setInfoOpen(true);
  };

  const submitApprove = async () => {
    if (!actionRow || !selectedMandis.length) return;
    const username = currentUsername();
    if (!username) return;
    await approveFarmerForMandis({
      username,
      language,
      payload: {
        farmer_username: actionRow.farmer_username,
        org_id: actionRow.org_id || uiConfig?.scope?.org_id || currentOrgId() || undefined,
        mandis: selectedMandis,
      },
    });
    setApproveOpen(false);
    await loadData();
  };

  const submitReject = async () => {
    if (!actionRow || !reasonText.trim()) return;
    const username = currentUsername();
    if (!username) return;
    await rejectFarmerApproval({
      username,
      language,
      payload: {
        farmer_username: actionRow.farmer_username,
        reason: reasonText.trim(),
      },
    });
    setRejectOpen(false);
    await loadData();
  };

  const submitRequestInfo = async () => {
    if (!actionRow || !reasonText.trim()) return;
    const username = currentUsername();
    if (!username) return;
    await requestMoreInfoFarmer({
      username,
      language,
      payload: {
        farmer_username: actionRow.farmer_username,
        reason: reasonText.trim(),
      },
    });
    setInfoOpen(false);
    await loadData();
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [
    filters.org_id,
    filters.mandi_id,
    filters.approval_status,
    filters.farmer_username,
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
            value={filters.org_id}
            onChange={(e) => updateFilter("org_id", e.target.value)}
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
          value={filters.mandi_id}
          onChange={(e) => updateFilter("mandi_id", e.target.value)}
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
          value={filters.approval_status}
          onChange={(e) => updateFilter("approval_status", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="REJECTED">Rejected</MenuItem>
          <MenuItem value="SUSPENDED">Suspended</MenuItem>
        </TextField>

        <TextField
          label="Farmer Username"
          size="small"
          value={filters.farmer_username}
          onChange={(e) => updateFilter("farmer_username", e.target.value)}
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
                  {(detail.mandis || []).map((m: any, idx: number) => (
                    <Chip key={idx} label={m?.mandi_name || resolveMandiName(mandiNameMap, m?.mandi_id)} size="small" />
                  ))}
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
        <DialogTitle>Reject Farmer</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Reason"
            multiline
            minRows={2}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button onClick={submitReject} disabled={!reasonText.trim()} color="error">
            Reject
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
