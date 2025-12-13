import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { assignUserRole, deactivateUserRole, getAdminUsersWithRoles } from "../../services/roles";
import { normalizeFlag } from "../../utils/statusUtils";

type UserRow = {
  user_id?: string;
  username: string;
  email?: string | null;
  mobile?: string | null;
  is_active?: string | null;
  is_system_protected?: boolean;
  roles?: Array<{
    _id?: string;
    role_code: string;
    role_scope?: string | null;
    org_id?: string | null;
    is_active?: string;
    mandi_ids?: number[];
  }>;
};

type RoleMaster = {
  role_code: string;
  role_scope?: string | null;
  name?: string;
  description?: string | null;
  is_protected?: string;
};

type OrgOption = {
  org_id: string;
  org_code?: string | null;
  org_name?: string | null;
  is_active?: string;
};

type MandiOption = {
  mandi_id: number;
  name?: string;
  org_id?: string | number | null;
  is_active?: string | null;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

const UserRoleManagerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleMaster[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgLabel = useCallback(
    (orgId?: string | null) => {
      if (!orgId) return "";
      const found = orgs.find((o) => String(o.org_id) === String(orgId));
      return found?.org_name || found?.org_code || "";
    },
    [orgs],
  );

  const handleOpenAssign = useCallback((user: UserRow) => {
    setSelectedUser(user);
    setAssignOpen(true);
  }, []);

  const handleOpenDeactivate = useCallback((user: UserRow) => {
    setSelectedUser(user);
    setDeactivateOpen(true);
  }, []);

  const columns = useMemo<GridColDef<UserRow>[]>(
    () => [
      { field: "username", headerName: "Username", flex: 1 },
      { field: "email", headerName: "Email", flex: 1 },
      { field: "mobile", headerName: "Mobile", flex: 1 },
      {
        field: "is_active",
        headerName: "Active",
        width: 120,
        renderCell: (params) => {
          const flag = normalizeFlag(params.value);
          const label = flag === "Y" ? "Active" : "Inactive";
          const color = flag === "Y" ? "success" : "default";
          return <Chip size="small" label={label} color={color} variant="outlined" />;
        },
      },
      {
        field: "roles",
        headerName: "Roles",
        flex: 1.5,
        renderCell: (params) => {
          const value = params.value as UserRow["roles"];
          if (!value || !value.length) return <Typography variant="body2">-</Typography>;
          return (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {value.map((r, idx) => (
                <Chip
                  key={`${params.row.username}-${r.role_code}-${idx}`}
                  size="small"
                  label={r.role_code}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          );
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
          const hasActiveRole =
            (row.roles || []).filter((r) => normalizeFlag(r.is_active) === "Y").length > 0;
          const isProtected = !!row.is_system_protected;
          return (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleOpenAssign(row)}>
                Assign Role
              </Button>
              <Tooltip title={hasActiveRole ? "" : "No active roles"} disableHoverListener={hasActiveRole}>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    disabled={!hasActiveRole || isProtected}
                    onClick={() => handleOpenDeactivate(row)}
                  >
                    Deactivate
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [handleOpenAssign, handleOpenDeactivate],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) {
      setError("Not logged in.");
      return;
    }
      setLoading(true);
    setError(null);
    try {
      const resp = await getAdminUsersWithRoles({
        username,
        language,
        country: "IN",
      });
      const rc = resp?.response?.responsecode || "1";
      if (rc !== "0") {
        setError(resp?.response?.description || "Authorization failed.");
        setRows([]);
        return;
      }
      const list = resp?.data?.users || [];
      setRows(list);
      const fetchedRoles = resp?.data?.roles || [];
      setRoles(fetchedRoles);
      setOrgs(resp?.data?.organisations || []);
      setMandis(resp?.data?.mandis || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language]);

  return (
    <PageContainer>
      <Stack spacing={1} mb={2}>
        <Typography variant="h5">{t("menu.userRoleManager", { defaultValue: "User Role Manager" })}</Typography>
        <Typography variant="body2" color="text.secondary">
          View admin users and their assigned roles.
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows}
              loading={loading}
              autoHeight
              getRowId={(r) => r.username}
              hideFooterSelectedRowCount
            />
          </Box>
        </CardContent>
      </Card>

      <AssignRoleModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        user={selectedUser}
        roles={roles}
        orgs={orgs}
        mandis={mandis}
        username={currentUsername()}
        language={language}
        orgLabel={orgLabel}
        onSuccess={() => {
          setAssignOpen(false);
          loadData();
        }}
      />

      <DeactivateRoleModal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        user={selectedUser}
        username={currentUsername()}
        language={language}
        orgLabel={orgLabel}
        onSuccess={() => {
          setDeactivateOpen(false);
          loadData();
        }}
      />
    </PageContainer>
  );
};

export default UserRoleManagerPage;

type AssignRoleModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserRow | null;
  roles: RoleMaster[];
  orgs: OrgOption[];
  mandis: MandiOption[];
  username: string | null;
  language: string;
  orgLabel: (orgId?: string | null) => string;
};

const AssignRoleModal: React.FC<AssignRoleModalProps> = ({
  open,
  onClose,
  onSuccess,
  user,
  roles,
  orgs,
  mandis,
  username,
  language,
  orgLabel,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [roleCode, setRoleCode] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [mandiIds, setMandiIds] = useState<Array<number | string>>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRoleCode("");
      setOrgId("");
      setMandiIds([]);
    }
  }, [open]);

  const selectedRole = roles.find((r) => r.role_code === roleCode);
  const roleScope = selectedRole?.role_scope || "GLOBAL";
  const needsOrg = roleScope !== "GLOBAL";
  const requiresMandis = selectedRole?.role_code === "MANDI_ADMIN";
  const availableMandis = useMemo(
    () =>
      mandis.filter((m) => {
        const sameOrg = !orgId || String(m.org_id || "") === String(orgId);
        const active = normalizeFlag(m.is_active) !== "N";
        return sameOrg && active;
      }),
    [mandis, orgId],
  );

  const handleSubmit = async () => {
    if (!user || !username || !roleCode) return;
    if (needsOrg && !orgId) {
      enqueueSnackbar("Please select organisation for this role.", { variant: "warning" });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await assignUserRole({
        username,
        language,
        target_user_id: user.user_id || user.username,
        role_code: roleCode,
        role_scope: roleScope,
        org_id: needsOrg ? orgId : null,
        mandi_ids: requiresMandis ? mandiIds : [],
      });
      const rc = resp?.response?.responsecode || "1";
      if (rc !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to assign role.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Role assigned successfully.", { variant: "success" });
      onSuccess();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to assign role.", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign Role</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Typography variant="body2" color="text.secondary">
            Assigning role to: <strong>{user?.username}</strong>
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel id="role-select-label">Role</InputLabel>
              <Select
                labelId="role-select-label"
                value={roleCode}
                label="Role"
                onChange={(e) => setRoleCode(e.target.value)}
              >
              {roles
                .filter((r) => r.role_code !== "SUPER_ADMIN" && r.role_code !== "SUPERADMIN" && r.is_protected !== "Y")
                .map((r) => (
                  <MenuItem key={r.role_code} value={r.role_code}>
                    {r.role_code} {r.name ? `- ${r.name}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

          {needsOrg && (
            <FormControl fullWidth size="small" error={!orgId}>
              <InputLabel id="org-select-label">Organisation</InputLabel>
              <Select
                labelId="org-select-label"
                value={orgId}
                label="Organisation"
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgs.map((org) => (
                  <MenuItem key={org.org_id} value={org.org_id}>
                    {org.org_name || org.org_code || org.org_id}
                  </MenuItem>
                ))}
              </Select>
              {!orgId && <FormHelperText>Required for this role</FormHelperText>}
            </FormControl>
          )}

          {requiresMandis && (
            <FormControl fullWidth size="small">
              <InputLabel id="mandi-select-label">Mandis</InputLabel>
              <Select
                multiple
                labelId="mandi-select-label"
                value={mandiIds}
                label="Mandis"
                onChange={(e) => setMandiIds(e.target.value as Array<number | string>)}
                renderValue={(selected) => {
                  const labels = selected
                    .map((id) => availableMandis.find((m) => String(m.mandi_id) === String(id))?.name || id)
                    .filter(Boolean);
                  return labels.join(", ");
                }}
              >
                {availableMandis.map((mandi) => (
                  <MenuItem key={mandi.mandi_id} value={mandi.mandi_id}>
                    {mandi.name || mandi.mandi_id} {orgLabel(mandi.org_id?.toString()) ? `(${orgLabel(mandi.org_id?.toString())})` : ""}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Select mandis for MANDI_ADMIN</FormHelperText>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting || !roleCode}>
          {submitting ? "Assigning..." : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

type DeactivateRoleModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserRow | null;
  username: string | null;
  language: string;
  orgLabel: (orgId?: string | null) => string;
};

const DeactivateRoleModal: React.FC<DeactivateRoleModalProps> = ({
  open,
  onClose,
  onSuccess,
  user,
  username,
  language,
  orgLabel,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const activeRoles = useMemo(
    () => (user?.roles || []).filter((r) => normalizeFlag(r.is_active) === "Y"),
    [user],
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedRoleId("");
      setSubmitting(false);
    } else if (activeRoles.length) {
      setSelectedRoleId(activeRoles[0]?._id || activeRoles[0]?.role_code || "");
    }
  }, [open, activeRoles]);

  const roleSummary = (role: NonNullable<UserRow["roles"]>[number]) => {
    const mandiCount = (role.mandi_ids || []).length;
    const orgName = orgLabel(role.org_id);
    const parts = [role.role_code];
    if (orgName) parts.push(orgName);
    if (mandiCount) parts.push(`${mandiCount} mandis`);
    return parts.join(" • ");
  };

  const handleSubmit = async () => {
    if (!user || !username || !selectedRoleId) return;
    setSubmitting(true);
    try {
      const resp = await deactivateUserRole({
        username,
        language,
        user_role_id: selectedRoleId,
      });
      const rc = resp?.response?.responsecode || "1";
      if (rc !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to deactivate role.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Role deactivated.", { variant: "success" });
      onSuccess();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to deactivate role.", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Deactivate Role</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Typography variant="body2" color="text.secondary">
            Choose a role to deactivate for <strong>{user?.username}</strong>.
          </Typography>
          <FormControl fullWidth size="small" disabled={!activeRoles.length}>
            <InputLabel id="deactivate-role-select-label">Role</InputLabel>
            <Select
              labelId="deactivate-role-select-label"
              value={selectedRoleId}
              label="Role"
              onChange={(e) => setSelectedRoleId(e.target.value)}
            >
              {activeRoles.map((r) => (
                <MenuItem key={r._id || r.role_code} value={r._id || r.role_code}>
                  {roleSummary(r)}
                </MenuItem>
              ))}
            </Select>
            {!activeRoles.length && <FormHelperText>No active roles to deactivate</FormHelperText>}
          </FormControl>
          <Alert severity="warning">This will immediately disable this role.</Alert>
          {selectedRoleId && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {activeRoles
                .filter((r) => (r._id || "") === selectedRoleId)
                .map((r) => (
                  <React.Fragment key={r._id || r.role_code}>
                    <Chip label={r.role_code} size="small" />
                    {r.org_id && <Chip label={orgLabel(r.org_id)} size="small" />}
                    {r.mandi_ids?.length ? (
                      <Chip label={`${r.mandi_ids.length} mandis`} size="small" />
                    ) : null}
                  </React.Fragment>
                ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="error"
          disabled={submitting || !selectedRoleId}
        >
          {submitting ? "Deactivating..." : "Deactivate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
