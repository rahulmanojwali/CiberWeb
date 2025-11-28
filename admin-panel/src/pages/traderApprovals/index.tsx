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
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CheckIcon from "@mui/icons-material/CheckOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import {
  approveTrader,
  getTraderApprovalDetail,
  getTraderApprovals,
  rejectTrader,
  requestMoreInfoForTrader,
} from "../../services/traderApprovalsApi";

type TraderRow = {
  id: string;
  application_id: string;
  trader_name: string;
  mobile: string;
  mandi: string | number | null;
  status: string;
  created_on?: string | null;
};

type TraderDetail = Record<string, any>;

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

export const TraderApprovals: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    status: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<TraderRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<TraderDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const canMenu = useMemo(() => can(uiConfig.resources, "trader_approvals.menu", "VIEW"), [uiConfig.resources]);
  const canList = useMemo(() => can(uiConfig.resources, "trader_approvals.list", "VIEW"), [uiConfig.resources]);
  const canDetail = useMemo(() => can(uiConfig.resources, "trader_approvals.detail", "VIEW_DETAIL"), [uiConfig.resources]);
  const canApprove = useMemo(() => can(uiConfig.resources, "trader_approvals.approve", "APPROVE"), [uiConfig.resources]);
  const canReject = useMemo(() => can(uiConfig.resources, "trader_approvals.reject", "REJECT"), [uiConfig.resources]);
  const canRequestInfo = useMemo(
    () => can(uiConfig.resources, "trader_approvals.request_more_info", "REQUEST_MORE_INFO"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<TraderRow>[]>(
    () => [
      { field: "application_id", headerName: "Application ID", width: 150 },
      { field: "trader_name", headerName: "Trader", width: 180 },
      { field: "mobile", headerName: "Mobile", width: 150 },
      { field: "mandi", headerName: "Mandi", width: 160 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 180,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 320,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canDetail && (
              <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => openDetail(params.row.application_id)}>
                View
              </Button>
            )}
            {canApprove && (
              <Button
                size="small"
                color="success"
                startIcon={<CheckIcon />}
                onClick={() => handleStatusChange(params.row.application_id, "APPROVE")}
              >
                Approve
              </Button>
            )}
            {canReject && (
              <Button
                size="small"
                color="error"
                startIcon={<CloseIcon />}
                onClick={() => handleStatusChange(params.row.application_id, "REJECT")}
              >
                Reject
              </Button>
            )}
            {canRequestInfo && (
              <Button
                size="small"
                color="warning"
                startIcon={<InfoOutlinedIcon />}
                onClick={() => handleStatusChange(params.row.application_id, "MORE_INFO")}
              >
                More Info
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canApprove, canDetail, canReject, canRequestInfo],
  );

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
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    setMandiOptions(
      list.map((m: any) => ({
        value: String(m.mandi_id || m.slug || m.mandi_slug || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canList) return;
    setLoading(true);
    try {
      const resp = await getTraderApprovals({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
          status: filters.status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: TraderRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.application_id || `app-${idx}`,
        application_id: String(item.application_id || item._id || `app-${idx}`),
        trader_name: item.trader_name || item.name || "",
        mobile: item.mobile || item.phone || "",
        mandi: item.mandi || item.mandi_name || item.mandi_id || null,
        status: (item.status || "").toString(),
        created_on: item.created_on || item.createdAt || null,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (application_id: string) => {
    if (!canDetail) return;
    const username = currentUsername();
    if (!username) return;
    setSelectedId(application_id);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const resp = await getTraderApprovalDetail({ username, language, application_id });
      const data =
        resp?.data?.detail ||
        resp?.data?.application ||
        resp?.response?.data?.detail ||
        resp?.response?.data?.application ||
        null;
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (application_id: string, action: "APPROVE" | "REJECT" | "MORE_INFO") => {
    const username = currentUsername();
    if (!username) return;
    const payload = { username, language, application_id, remarks: remarks || undefined };

    if (action === "APPROVE" && canApprove) {
      await approveTrader(payload);
    } else if (action === "REJECT" && canReject) {
      await rejectTrader(payload);
    } else if (action === "MORE_INFO" && canRequestInfo) {
      await requestMoreInfoForTrader(payload);
    }

    await loadData();
    if (selectedId === application_id) {
      await openDetail(application_id);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [filters.org_id, filters.mandi_id, filters.status, filters.date_from, filters.date_to, language, canList]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canMenu || !canList) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view trader approvals.</Typography>
      </PageContainer>
    );
  }

  const statusOptions = [
    { value: "", label: "All" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "MORE_INFO", label: "More Info" },
  ];

  const renderDetail = () => {
    if (detailLoading) {
      return <Typography variant="body2">Loading...</Typography>;
    }
    if (!detail) {
      return <Typography variant="body2" color="text.secondary">No detail available.</Typography>;
    }
    const entries = Object.entries(detail);
    return (
      <Stack spacing={1.5}>
        {entries.map(([key, value]) => (
          <Stack key={key} direction="row" spacing={1}>
            <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
              {key}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
            </Typography>
          </Stack>
        ))}
      </Stack>
    );
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.traderApprovals", { defaultValue: "Trader Approvals" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Review, approve, reject, or request more info for trader applications.
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        flexWrap="wrap"
      >
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
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          {statusOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

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

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Trader Application Detail</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          {renderDetail()}
          {(canApprove || canReject || canRequestInfo) && (
            <TextField
              label="Remarks"
              multiline
              minRows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add remarks for approve/reject/more info"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
          {canRequestInfo && selectedId && (
            <Button
              color="warning"
              startIcon={<InfoOutlinedIcon />}
              onClick={() => handleStatusChange(selectedId, "MORE_INFO")}
            >
              Request More Info
            </Button>
          )}
          {canReject && selectedId && (
            <Button color="error" startIcon={<CloseIcon />} onClick={() => handleStatusChange(selectedId, "REJECT")}>
              Reject
            </Button>
          )}
          {canApprove && selectedId && (
            <Button color="success" startIcon={<CheckIcon />} onClick={() => handleStatusChange(selectedId, "APPROVE")}>
              Approve
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
