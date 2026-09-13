// src/pages/orgs/index.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  TablePagination,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import Snackbar from "@mui/material/Snackbar";
import {
  Button as AntButton,
  Card as AntCard,
  Col as AntCol,
  Form as AntForm,
  Input as AntInput,
  Modal as AntModal,
  Row as AntRow,
  Dropdown as AntDropdown,
  Statistic as AntStatistic,
} from "antd";
import { DownOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getUserScope } from "../../utils/userScope";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { ActionGate } from "../../authz/ActionGate";
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
import { StepUpGuard } from "../../components/StepUpGuard";
import { postEncrypted } from "../../services/sharedEncryptedRequest";



type OrgStatus = "ACTIVE" | "INACTIVE";

interface OrgRow {
  id: string;
  org_code: string;
  org_name: string;
  country?: string;
  status: OrgStatus;
  created_on?: string;
  created_by?: string;
  updated_on?: string;
  updated_by?: string;
  created_on_display?: string;
  updated_on_display?: string;
  org_scope?: string | null;
  org_id?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
}

type FormState = Omit<OrgRow, "id">;

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const Orgs: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const uiConfig = useAdminUiConfig();
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const scope = getUserScope("OrgsPage");
  const scopeOrgCode = uiConfig.scope?.org_code ?? scope.orgCode;
  const canCreateOrg = can("organisations.create", "CREATE");
  const canUpdateOrgAction = can("organisations.edit", "UPDATE");
  // Organisation governance is platform-owned. Org-scoped users can view only.
  const canManageOrganisations = isSuper;
  const isReadOnly = React.useMemo(
    () => !canManageOrganisations || !canUpdateOrgAction,
    [canManageOrganisations, canUpdateOrgAction]
  );
  const showCreateButton = canManageOrganisations && canCreateOrg;

  const [rows, setRows] = React.useState<OrgRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | OrgStatus>("ALL");
  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 25 });
  const [totalCount, setTotalCount] = React.useState(0);
  const [summary, setSummary] = React.useState<{ total: number | null; active: number | null; inactive: number | null }>({ total: null, active: null, inactive: null });
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  type DialogMode = "CREATE" | "EDIT" | "VIEW";
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("CREATE");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({
    org_code: "",
    org_name: "",
    country: "IN",
    status: "ACTIVE",
    created_on: "",
    created_by: "",
    updated_on: "",
    updated_by: "",
  });
  const isViewMode = dialogMode === "VIEW";
  const isEditMode = dialogMode === "EDIT";
  const isViewOnlyMode = isViewMode || isReadOnly;
  
  const headers = React.useMemo(() => {
    const token = localStorage.getItem("cd_token");
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, []);

  const buildBody = React.useCallback(async (items: any) => {
    const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
    return { encryptedData };
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadOrgs = React.useCallback(async (showRefreshToast = false) => {
    const username = currentUsername();
    if (!username) {
      setError("No admin session found.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items: any = {
        api: API_TAGS.ORGS.list,
        username,
        language: "en",
        page: paginationModel.page + 1,
        page_size: paginationModel.pageSize,
        include_summary: true,
      };
      if (scopeOrgCode) items.org_code = scopeOrgCode;
      if (debouncedSearch) items.search = debouncedSearch;
      if (statusFilter !== "ALL") items.is_active = statusFilter === "ACTIVE" ? "Y" : "N";

      const data = await postEncrypted(API_ROUTES.admin.getOrganisations, items);
      const resp = data?.response || {};
      const code = String(resp.responsecode ?? "");
      if (code !== "0") {
        const message = resp.description || "Failed to load organisations.";
        setError(message);
        setToast({ open: true, message, severity: "error" });
        return;
      }

      const list: any[] = resp?.data?.organisations || [];
      const mapped: OrgRow[] = list.map((o) => ({
        id: o._id || o.org_code,
        org_code: o.org_code,
        org_name: o.org_name,
        country: o.country,
        status: o.is_active === "Y" ? "ACTIVE" : "INACTIVE",
        created_on: o.created_on,
        created_by: o.created_by,
        updated_on: o.updated_on,
        updated_by: o.updated_by,
        created_on_display: formatDateTime(o.created_on),
        updated_on_display: formatDateTime(o.updated_on),
        org_scope: o.org_scope,
        org_id: o.org_id,
        owner_type: o.owner_type,
        owner_org_id: o.owner_org_id,
        is_protected: o.is_protected,
      }));

      setRows(mapped);
      const meta = resp?.data?.meta || {};
      const nextTotalCount = Number(meta?.totalCount ?? mapped.length);
      setTotalCount(Number.isFinite(nextTotalCount) ? nextTotalCount : mapped.length);

      const apiSummary = resp?.data?.summary;
      const hasApiSummary =
        apiSummary &&
        Number.isFinite(Number(apiSummary.total)) &&
        Number.isFinite(Number(apiSummary.active)) &&
        Number.isFinite(Number(apiSummary.inactive));

      if (hasApiSummary) {
        setSummary({
          total: Number(apiSummary.total),
          active: Number(apiSummary.active),
          inactive: Number(apiSummary.inactive),
        });
      } else {
        // Compatibility with the older non-paginated API during rolling deploys.
        // Only derive status totals when the response contains the complete list.
        const responseIsComplete = meta?.paginated !== true && mapped.length === nextTotalCount;
        if (responseIsComplete) {
          setSummary({
            total: mapped.length,
            active: mapped.filter((row) => row.status === "ACTIVE").length,
            inactive: mapped.filter((row) => row.status === "INACTIVE").length,
          });
        } else {
          setSummary((prev) => ({
            total: Number.isFinite(nextTotalCount) ? nextTotalCount : prev.total,
            active: prev.active,
            inactive: prev.inactive,
          }));
        }
      }
      if (showRefreshToast) {
        setToast({ open: true, message: "Organisations refreshed.", severity: "success" });
      }
    } catch (e: any) {
      const message = e?.message || "Network error while loading organisations.";
      setError(message);
      setToast({ open: true, message, severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, scopeOrgCode, statusFilter]);

  React.useEffect(() => {
    loadOrgs(false);
  }, [loadOrgs]);

  const handleOpenCreate = () => {
    setDialogMode("CREATE");
    setEditingId(null);
    setForm({
      org_code: "",
      org_name: "",
      country: "IN",
      status: "ACTIVE",
      created_on: new Date().toISOString().slice(0, 10),
      created_by: "",
      updated_on: "",
      updated_by: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: OrgRow) => {
    const lockInfo = isRecordLocked(row as any, { ...authContext, isSuper });
    if (lockInfo.locked) {
      setToast({ open: true, message: "You are not authorized to edit this organisation.", severity: "error" });
      return;
    }
    setDialogMode("EDIT");
    setEditingId(row.id);
    setForm({
      org_code: row.org_code,
      org_name: row.org_name,
      country: row.country,
      status: row.status,
      created_on: row.created_on || "",
      updated_on: row.updated_on || "",
      created_by: row.created_by || "",
      updated_by: row.updated_by || "",
    });
    setDialogOpen(true);
  };

  const handleOpenView = (row: OrgRow) => {
    setDialogMode("VIEW");
    setEditingId(row.id);
    setForm({
      org_code: row.org_code,
      org_name: row.org_name,
      country: row.country,
      status: row.status,
      created_on: row.created_on || "",
      updated_on: row.updated_on || "",
      created_by: row.created_by || "",
      updated_by: row.updated_by || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const openOrganisationMandis = React.useCallback(() => {
    if (!editingId) return;
    const params = new URLSearchParams({
      org_id: editingId,
      org_code: form.org_code || "",
    });
    setDialogOpen(false);
    navigate(`/mandis?${params.toString()}`);
  }, [editingId, form.org_code, navigate]);

  const openOrganisationUsers = React.useCallback(() => {
    if (!form.org_code) return;
    const params = new URLSearchParams({ org_code: form.org_code });
    setDialogOpen(false);
    navigate(`/admin-users?${params.toString()}`);
  }, [form.org_code, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Auto-generate org_code from org_name on create
    if (name === "org_name" && dialogMode === "CREATE") {
      const generated = value
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase()
        .slice(0, 40);
      setForm((prev) => ({ ...prev, org_name: value, org_code: generated }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (isViewOnlyMode) {
      setDialogOpen(false);
      setToast({ open: true, message: "You are not authorized to modify organisations.", severity: "error" });
      return;
    }
    if (!form.org_code.trim() || !form.org_name.trim()) {
      alert("Org Code and Org Name are required.");
      return;
    }
    const username = currentUsername();
    if (!username) {
      alert("No admin session found.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingId) {
        const lockInfo = isRecordLocked({ org_id: editingId, org_scope: "ORG", owner_org_id: editingId } as any, { ...authContext, isSuper });
        if (lockInfo.locked) {
          setToast({ open: true, message: "You are not authorized to edit this organisation.", severity: "error" });
          setLoading(false);
          return;
        }
        const payload: any = {
          api: API_TAGS.ORGS.update,
          username,
          language: "en",
          org_id: editingId,
          org_name: form.org_name,
        };
        payload.country = form.country;
        payload.is_active = form.status === "ACTIVE" ? "Y" : "N";
        payload.org_code = scopeOrgCode || form.org_code;
        const body = await buildBody(payload);
        const { data } = await axios.post(
          `${API_BASE_URL}${API_ROUTES.admin.updateOrganisation}`,
          body,
          { headers }
        );
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setError(resp.description || "Update failed.");
          setToast({ open: true, message: resp.description || "Update failed.", severity: "error" });
        } else {
          await loadOrgs();
          setToast({ open: true, message: "Organisation updated.", severity: "success" });
          setDialogOpen(false);
        }
      } else {
        const payload: any = {
          api: API_TAGS.ORGS.create,
          username,
          language: "en",
          org_name: form.org_name,
          org_code: scopeOrgCode || form.org_code,
          country: form.country,
          is_active: form.status === "ACTIVE" ? "Y" : "N",
        };
        const body = await buildBody(payload);
        const { data } = await axios.post(
          `${API_BASE_URL}${API_ROUTES.admin.createOrganisation}`,
          body,
          { headers }
        );
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setError(resp.description || "Create failed.");
          setToast({ open: true, message: resp.description || "Create failed.", severity: "error" });
        } else {
          await loadOrgs();
          setToast({ open: true, message: "Organisation created.", severity: "success" });
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Network error.");
      setToast({ open: true, message: e?.message || "Network error.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const columns = React.useMemo<GridColDef<OrgRow>[]>(
    () => [
      { field: "org_code", headerName: "Org Code", flex: 0.6 },
      { field: "org_name", headerName: "Organisation Name", flex: 1.2 },
      { field: "country", headerName: "Country", flex: 0.5 },
      { field: "status", headerName: "Status", flex: 0.6 },
      {
        field: "created_on_display",
        headerName: "Created On",
        flex: 0.9,
      },
      {
        field: "updated_on_display",
        headerName: "Updated On",
        flex: 0.9,
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<OrgRow>) => {
          const row = params.row as OrgRow;
          const lockInfo = isRecordLocked(row as any, { ...authContext, isSuper });
          return (
            <Stack direction="row" spacing={1}>
              <AntButton size="small" onClick={() => handleOpenView(row)}>
                View
              </AntButton>
              {canManageOrganisations && (
                <ActionGate resourceKey="organisations.edit" action="UPDATE" record={row}>
                  {!lockInfo.locked && (
                    <AntButton size="small" onClick={() => handleOpenEdit(row)}>
                      Edit
                    </AntButton>
                  )}
                </ActionGate>
              )}
            </Stack>
          );
        },
      },
    ],
    [authContext, canManageOrganisations, isSuper]
  );

  const filteredRows = rows;


  return (
    <StepUpGuard username={currentUsername()} resourceKey="organisations.list" action="VIEW">
      <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Organisations</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organisation master data and status quickly.
          </Typography>
        </Stack>
        {showCreateButton && (
          <AntButton
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ height: 40, display: "inline-flex", alignItems: "center" }}
          >
            Add Organisation
          </AntButton>
        )}
      </Stack>

      <AntRow gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <AntCol xs={24} sm={8}>
          <AntCard size="small" style={{ height: "100%" }}>
            <AntStatistic title="Total Organisations" value={summary.total ?? "—"} loading={loading && summary.total === null} />
          </AntCard>
        </AntCol>
        <AntCol xs={24} sm={8}>
          <AntCard size="small" style={{ height: "100%" }}>
            <AntStatistic title="Active Organisations" value={summary.active ?? "—"} loading={loading && summary.active === null} />
          </AntCard>
        </AntCol>
        <AntCol xs={24} sm={8}>
          <AntCard size="small" style={{ height: "100%" }}>
            <AntStatistic title="Inactive Organisations" value={summary.inactive ?? "—"} loading={loading && summary.inactive === null} />
          </AntCard>
        </AntCol>
      </AntRow>

      <AntCard size="small" style={{ marginBottom: 16 }}>
        <AntRow gutter={[12, 12]} align="middle">
          <AntCol xs={24} md={12}>
            <AntInput
              aria-label="Search organisation code or name"
              placeholder="Search code or organisation name"
              prefix={<SearchOutlined />}
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cm-orgs-search"
              style={{ height: 40 }}
            />
          </AntCol>
          <AntCol xs={24} md={6}>
            <AntDropdown
              trigger={["click"]}
              menu={{
                selectedKeys: [statusFilter],
                items: [
                  { key: "ALL", label: "All statuses" },
                  { key: "ACTIVE", label: "Active" },
                  { key: "INACTIVE", label: "Inactive" },
                ],
                onClick: ({ key }) => {
                  setStatusFilter(key as "ALL" | OrgStatus);
                  setPaginationModel((prev) => ({ ...prev, page: 0 }));
                },
              }}
            >
              <AntButton className="cm-orgs-dropdown-button" block>
                <span>{statusFilter === "ALL" ? "All statuses" : statusFilter === "ACTIVE" ? "Active" : "Inactive"}</span>
                <DownOutlined />
              </AntButton>
            </AntDropdown>
          </AntCol>
          <AntCol xs={24} md={6}>
            <AntButton
              icon={<ReloadOutlined />}
              onClick={() => loadOrgs(true)}
              loading={loading}
              block
              style={{ height: 40 }}
            >
              Refresh
            </AntButton>
          </AntCol>
        </AntRow>
      </AntCard>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {isSmallScreen ? (
        <Stack spacing={1.5} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
          {filteredRows.map((row) => (
            <Card
              key={row.id}
              variant="outlined"
              sx={{ borderRadius: 2, px: 2, py: 1.5, boxShadow: 2, mb: 0.5 }}
            >
              <Stack spacing={1}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600, fontSize: { xs: "0.9rem", md: "1rem" }, lineHeight: 1.3 }}
                  >
                    {row.org_name}
                  </Typography>
                  <Chip
                    label={row.status === "ACTIVE" ? "Active" : "Inactive"}
                    size="small"
                    color={row.status === "ACTIVE" ? "success" : "default"}
                    sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" }, height: 22 }}
                  />
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    Organisation Code
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: { xs: "0.85rem", md: "0.9rem" } }}
                  >
                    {row.org_code}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", color: "text.secondary", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    Last Updated
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    {formatDateTime(row.updated_on)}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                  {canManageOrganisations && (
                    <ActionGate resourceKey="organisations.edit" action="UPDATE" record={row}>
                      <AntButton size="small" onClick={() => handleOpenEdit(row)}>Edit</AntButton>
                    </ActionGate>
                  )}
                  <AntButton size="small" onClick={() => handleOpenView(row)} style={{ marginLeft: 8 }}>View</AntButton>
                </Box>
              </Stack>
            </Card>
          ))}
          {!filteredRows.length && (
            <Typography variant="body2" color="text.secondary">
              No organisations found.
            </Typography>
          )}
          <TablePagination
            component="div"
            count={totalCount}
            page={paginationModel.page}
            onPageChange={(_, page) => setPaginationModel((prev) => ({ ...prev, page }))}
            rowsPerPage={paginationModel.pageSize}
            onRowsPerPageChange={(event) => setPaginationModel({ page: 0, pageSize: Number(event.target.value) })}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                rows={filteredRows}
                columns={columns}
                pageSizeOptions={[10, 25, 50]}
                paginationMode="server"
                rowCount={totalCount}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                disableRowSelectionOnClick
                loading={loading}
                minWidth={760}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <AntModal
        open={dialogOpen}
        rootClassName="cm-orgs-modal"
        onCancel={handleCloseDialog}
        title={dialogMode === "CREATE" ? "Add Organisation" : dialogMode === "EDIT" ? "Edit Organisation" : "View Organisation"}
        width={760}
        centered
        maskClosable={!loading}
        footer={[
          ...(dialogMode !== "CREATE"
            ? [
                <AntButton key="users" onClick={openOrganisationUsers}>
                  Administrators / Users
                </AntButton>,
                <AntButton key="mandis" onClick={openOrganisationMandis}>
                  View Mandis
                </AntButton>,
              ]
            : []),
          <AntButton key="close" onClick={handleCloseDialog}>
            Close
          </AntButton>,
          ...(!isViewOnlyMode
            ? [
                <AntButton key="save" type="primary" loading={loading} onClick={handleSubmit}>
                  Save
                </AntButton>,
              ]
            : []),
        ]}
      >
        {isViewOnlyMode && (
          <Alert
            severity="info"
            sx={{
              mb: 2,
              bgcolor: "#F5F7EE",
              color: "#1F241A",
              border: "1px solid #D8DEC8",
              "& .MuiAlert-icon": { color: "#55632C" },
            }}
          >
            View only – organisation details cannot be modified.
          </Alert>
        )}

        <AntForm layout="vertical" requiredMark={!isViewOnlyMode}>
          <AntRow gutter={[16, 0]}>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Organisation Code" required>
                <AntInput
                  value={form.org_code}
                  readOnly
                  placeholder="Generated from organisation name"
                  style={{ height: 40 }}
                />
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Organisation Name" required>
                <AntInput
                  value={form.org_name}
                  onChange={(e) => handleChange(e)}
                  readOnly={isViewOnlyMode}
                  style={{ height: 40 }}
                />
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Country">
                <AntDropdown
                  trigger={["click"]}
                  disabled={isViewOnlyMode}
                  menu={{
                    selectedKeys: [form.country || "IN"],
                    items: [{ key: "IN", label: "India (IN)" }],
                    onClick: ({ key }) => setForm((prev) => ({ ...prev, country: key })),
                  }}
                >
                  <AntButton
                    className={`cm-orgs-dropdown-button${isViewOnlyMode ? " cm-orgs-dropdown-button-readonly" : ""}`}
                    block
                    disabled={isViewOnlyMode}
                  >
                    <span>{form.country === "IN" || !form.country ? "India (IN)" : form.country}</span>
                    {!isViewOnlyMode ? <DownOutlined /> : null}
                  </AntButton>
                </AntDropdown>
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Status">
                <AntDropdown
                  trigger={["click"]}
                  disabled={isViewOnlyMode}
                  menu={{
                    selectedKeys: [form.status],
                    items: [
                      { key: "ACTIVE", label: "Active" },
                      { key: "INACTIVE", label: "Inactive" },
                    ],
                    onClick: ({ key }) => setForm((prev) => ({ ...prev, status: key as OrgStatus })),
                  }}
                >
                  <AntButton
                    className={`cm-orgs-dropdown-button${isViewOnlyMode ? " cm-orgs-dropdown-button-readonly" : ""}`}
                    block
                    disabled={isViewOnlyMode}
                  >
                    <span>{form.status === "ACTIVE" ? "Active" : "Inactive"}</span>
                    {!isViewOnlyMode ? <DownOutlined /> : null}
                  </AntButton>
                </AntDropdown>
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Created On">
                <AntInput value={formatDateTime(form.created_on)} readOnly style={{ height: 40 }} />
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Updated On">
                <AntInput value={formatDateTime(form.updated_on)} readOnly style={{ height: 40 }} />
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Created By">
                <AntInput value={form.created_by || "—"} readOnly style={{ height: 40 }} />
              </AntForm.Item>
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntForm.Item label="Updated By">
                <AntInput value={form.updated_by || "—"} readOnly style={{ height: 40 }} />
              </AntForm.Item>
            </AntCol>
          </AntRow>
        </AntForm>
      </AntModal>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{
            width: "100%",
            color: "#1F241A",
            bgcolor:
              toast.severity === "success"
                ? "#F3F8E9"
                : toast.severity === "error"
                  ? "#FFF2F0"
                  : "#F5F7EE",
            border: `1px solid ${
              toast.severity === "success"
                ? "#B8C98A"
                : toast.severity === "error"
                  ? "#E6A39A"
                  : "#D8DEC8"
            }`,
            "& .MuiAlert-icon": {
              color:
                toast.severity === "error"
                  ? "#B42318"
                  : "#55632C",
            },
            "& .MuiAlert-message": {
              color: "#1F241A",
              fontWeight: 600,
            },
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  </StepUpGuard>
);
};
