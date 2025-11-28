import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { getTraders, updateTraderStatus } from "../../services/partyMastersApi";

type TraderRow = {
  id: string;
  trader_id: string;
  name: string;
  mobile: string;
  org_code?: string | null;
  mandi_code?: string | null;
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

export const Traders: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [filters, setFilters] = useState({
    org_code: "",
    mandi_code: "",
    status: "",
    mobile: "",
    trader_id: "",
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
  const [nextStatus, setNextStatus] = useState<string>("");

  const canMenu = useMemo(() => can(uiConfig.resources, "traders.menu", "VIEW"), [uiConfig.resources]);
  const canList = useMemo(() => can(uiConfig.resources, "traders.list", "VIEW"), [uiConfig.resources]);
  const canUpdate = useMemo(() => can(uiConfig.resources, "traders.update_status", "UPDATE"), [uiConfig.resources]);
  const canDetail = canList; // using same list permission for simple detail view

  const columns = useMemo<GridColDef<TraderRow>[]>(
    () => [
      { field: "trader_id", headerName: "Trader ID", width: 140 },
      { field: "name", headerName: "Name", width: 180 },
      { field: "mobile", headerName: "Mobile", width: 150 },
      { field: "org_code", headerName: "Org", width: 120 },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
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
        width: 280,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canDetail && (
              <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => openDetail(params.row)}>
                View
              </Button>
            )}
            {canUpdate && params.row.status !== "BLOCKED" && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => openStatusChange(params.row, "BLOCKED")}
              >
                Block
              </Button>
            )}
            {canUpdate && params.row.status === "BLOCKED" && (
              <Button
                size="small"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => openStatusChange(params.row, "ACTIVE")}
              >
                Unblock
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
        value: m.mandi_slug || m.slug || String(m.mandi_id || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canList) return;
    setLoading(true);
    try {
      const resp = await getTraders({
        username,
        language,
        filters: {
          org_code: filters.org_code || undefined,
          mandi_code: filters.mandi_code || undefined,
          status: filters.status || undefined,
          mobile: filters.mobile || undefined,
          trader_id: filters.trader_id || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || resp?.data?.traders || resp?.response?.data?.traders || [];
      const mapped: TraderRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.trader_id || `trader-${idx}`,
        trader_id: String(item.trader_id || item._id || `trader-${idx}`),
        name: item.trader_name || item.name || "",
        mobile: item.mobile || item.phone || "",
        org_code: item.org_code || null,
        mandi_code: item.mandi_code || null,
        status: (item.status || "").toString(),
        created_on: item.created_on || item.createdAt || null,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (row: TraderRow) => {
    setSelectedId(row.trader_id);
    setDetail(row);
    setDetailOpen(true);
  };

  const openStatusChange = (row: TraderRow, status: string) => {
    setSelectedId(row.trader_id);
    setNextStatus(status);
    handleStatusChange(row.trader_id, status);
  };

  const handleStatusChange = async (trader_id: string, status: string) => {
    if (!canUpdate) return;
    const username = currentUsername();
    if (!username) return;
    await updateTraderStatus({
      username,
      language,
      payload: { trader_id: trader_id ? Number(trader_id) : undefined, status },
    });
    await loadData();
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [filters.org_code, filters.mandi_code, filters.status, filters.mobile, filters.trader_id, filters.date_from, filters.date_to, language, canList]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canMenu || !canList) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view traders.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.traders", { defaultValue: "Traders" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Registry of trader accounts with status management.
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
          <MenuItem value="BLOCKED">Blocked</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
        </TextField>

        <TextField
          label="Mobile"
          size="small"
          value={filters.mobile}
          onChange={(e) => updateFilter("mobile", e.target.value)}
        />

        <TextField
          label="Trader ID"
          size="small"
          value={filters.trader_id}
          onChange={(e) => updateFilter("trader_id", e.target.value)}
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
        <DialogTitle>Trader Detail</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 1 }}>
          {detail ? (
            Object.entries(detail).map(([key, value]) => (
              <Stack key={key} direction="row" spacing={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 140 }}>
                  {key}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                </Typography>
              </Stack>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No detail available.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
          {canUpdate && selectedId && nextStatus && (
            <Button
              color={nextStatus === "BLOCKED" ? "error" : "success"}
              startIcon={nextStatus === "BLOCKED" ? <BlockIcon /> : <CheckCircleIcon />}
              onClick={() => handleStatusChange(selectedId, nextStatus)}
            >
              {nextStatus === "BLOCKED" ? "Block" : "Unblock"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
