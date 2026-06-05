import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";
import {
  getPlatformControlCenter,
  type PlatformControlOperation,
  updatePlatformControlCenter,
} from "../../services/platformControlCenterApi";
import { repairSuperAdminPermissions } from "../../services/permissionRepairApi";
import { useStepUp } from "../../security/stepup/useStepUp";

const tabs = [
  "Module Control",
  "Menu Visibility Control",
  "Mobile Dashboard Control",
  "Workflow Control",
  "API Feature Control",
  "Fix Permissions",
] as const;

function getStoredUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeRole(role?: string | null) {
  const raw = String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return raw === "SUPERADMIN" ? "SUPER_ADMIN" : raw;
}

function responseOk(resp: any) {
  return String(resp?.response?.responsecode ?? "1") === "0";
}

function responseData(resp: any) {
  return resp?.response?.data || resp?.data || {};
}

function isActive(value: any) {
  return value === true || String(value || "").toUpperCase() === "Y";
}

export default function PlatformControlCenterPage() {
  const uiConfig = useAdminUiConfig();
  const { ensureStepUp } = useStepUp();
  const storedUser = useMemo(() => getStoredUser(), []);
  const username = String(storedUser?.username || storedUser?.email || "").trim().toLowerCase();
  const country = String(storedUser?.country || DEFAULT_COUNTRY).trim().toUpperCase();
  const role = normalizeRole(uiConfig.role || storedUser?.role_slug || storedUser?.default_role_code);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const baseInput = useMemo(() => ({ username, country, language: DEFAULT_LANGUAGE, role }), [country, role, username]);

  const [tab, setTab] = useState(0);
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!username || !isSuperAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const resp = await getPlatformControlCenter(baseInput);
      if (!responseOk(resp)) {
        setMessage({ type: "error", text: resp?.response?.description || "Unable to load Platform Control Center." });
        return;
      }
      setData(responseData(resp));
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unable to load Platform Control Center." });
    } finally {
      setLoading(false);
    }
  }, [baseInput, isSuperAdmin, username]);

  useEffect(() => {
    load();
  }, [load]);

  const saveOperation = async (operation: PlatformControlOperation, label: string) => {
    if (!username || !isSuperAdmin) return;
    setSavingKey(label);
    setMessage(null);
    try {
      const verified = await ensureStepUp("platform_control_center.update", "UPDATE", { source: "GUARD", force: true });
      if (!verified) {
        setMessage({ type: "error", text: "Step-up verification is required before saving." });
        return;
      }
      const resp = await updatePlatformControlCenter({ ...baseInput, operations: [operation] });
      if (!responseOk(resp)) {
        setMessage({ type: "error", text: resp?.response?.description || "Unable to save change." });
        return;
      }
      setMessage({ type: "success", text: "Saved." });
      await load();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unable to save change." });
    } finally {
      setSavingKey("");
    }
  };

  const runRepair = async () => {
    setSavingKey("repair");
    setMessage(null);
    try {
      const verified = await ensureStepUp("platform_control_center.update", "UPDATE", { source: "GUARD", force: true });
      if (!verified) return;
      const resp = await repairSuperAdminPermissions({ username, country, role });
      if (!responseOk(resp)) {
        setMessage({ type: "error", text: resp?.response?.description || "Unable to repair permissions." });
        return;
      }
      setMessage({ type: "success", text: "Permissions repaired." });
      await load();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unable to repair permissions." });
    } finally {
      setSavingKey("");
    }
  };

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Only Super Admin can access Platform Control Center.</Alert>
      </Box>
    );
  }

  const modules = data.modules || [];
  const menus = data.menus || [];
  const mobileWidgets = data.mobile_widgets || [];
  const resources = data.resources || [];
  const workflowControls = data.workflow_controls || [];
  const apiFeatures = data.api_features || [];

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Platform Control Center
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Super Admin only. 2FA and step-up are required for platform changes.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="scrollable" scrollButtons="auto">
          {tabs.map((item) => (
            <Tab key={item} label={item} />
          ))}
        </Tabs>
      </Paper>

      {tab === 0 && (
        <ControlTable
          rows={modules}
          columns={["module", "total", "active"]}
          title="Module Control"
          getKey={(row) => row.module}
          getLabel={(row) => row.module}
          isChecked={(row) => Number(row.active || 0) > 0}
          onToggle={(row, checked) => saveOperation({ type: "MODULE", module: row.module, is_active: checked }, `module:${row.module}`)}
          savingKey={savingKey}
        />
      )}

      {tab === 1 && (
        <ControlTable
          rows={menus}
          columns={["resource_key", "screen", "route"]}
          title="Menu Visibility Control"
          getKey={(row) => row.resource_key}
          getLabel={(row) => row.resource_key}
          isChecked={(row) => isActive(row.is_active)}
          onToggle={(row, checked) => saveOperation({ type: "MENU_VISIBILITY", resource_key: row.resource_key, is_active: checked }, `menu:${row.resource_key}`)}
          savingKey={savingKey}
        />
      )}

      {tab === 2 && (
        <ControlTable
          rows={mobileWidgets}
          columns={["role_code", "widget_key", "title_en", "route"]}
          title="Mobile Dashboard Control"
          getKey={(row) => row._id}
          getLabel={(row) => row.widget_key}
          isChecked={(row) => isActive(row.is_active)}
          onToggle={(row, checked) => saveOperation({ type: "MOBILE_WIDGET", id: row._id, is_active: checked }, `widget:${row._id}`)}
          savingKey={savingKey}
        />
      )}

      {tab === 3 && (
        <ControlTable
          rows={workflowControls}
          columns={["rule_key", "name", "require_stepup"]}
          title="Workflow Control"
          getKey={(row) => row._id || row.rule_key}
          getLabel={(row) => row.rule_key}
          isChecked={(row) => isActive(row.is_active)}
          onToggle={(row, checked) => saveOperation({ type: "WORKFLOW_CONTROL", id: row._id, key: row.rule_key, is_active: checked }, `workflow:${row._id || row.rule_key}`)}
          savingKey={savingKey}
        />
      )}

      {tab === 4 && (
        <Stack spacing={2}>
          <ControlTable
            rows={apiFeatures}
            columns={["key", "enabled", "note"]}
            title="API Feature Control"
            getKey={(row) => row.key}
            getLabel={(row) => row.key}
            isChecked={(row) => isActive(row.enabled)}
            onToggle={(row, checked) => saveOperation({ type: "API_FEATURE", key: row.key, is_active: checked }, `api:${row.key}`)}
            savingKey={savingKey}
          />
          <ControlTable
            rows={resources}
            columns={["resource_key", "module", "allowed_actions"]}
            title="Resource Feature Control"
            getKey={(row) => row.resource_key}
            getLabel={(row) => row.resource_key}
            isChecked={(row) => isActive(row.is_active)}
            onToggle={(row, checked) => saveOperation({ type: "RESOURCE", resource_key: row.resource_key, is_active: checked }, `resource:${row.resource_key}`)}
            savingKey={savingKey}
          />
        </Stack>
      )}

      {tab === 5 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Fix Permissions
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 2 }}>
            Repairs system resources and Super Admin policy permissions.
          </Typography>
          <Button variant="contained" startIcon={<SaveIcon />} disabled={Boolean(savingKey)} onClick={runRepair}>
            Repair Super Admin Permissions
          </Button>
        </Paper>
      )}
    </Box>
  );
}

function ControlTable({
  title,
  rows,
  columns,
  getKey,
  getLabel,
  isChecked,
  onToggle,
  savingKey,
}: {
  title: string;
  rows: any[];
  columns: string[];
  getKey: (row: any) => string;
  getLabel: (row: any) => string;
  isChecked: (row: any) => boolean;
  onToggle: (row: any, checked: boolean) => void;
  savingKey: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            {columns.map((column) => (
              <TableCell key={column}>{column}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(rows || []).map((row) => {
            const key = getKey(row);
            return (
              <TableRow key={key || getLabel(row)}>
                <TableCell sx={{ width: 100 }}>
                  <Switch
                    checked={isChecked(row)}
                    disabled={Boolean(savingKey)}
                    onChange={(event) => onToggle(row, event.target.checked)}
                  />
                </TableCell>
                {columns.map((column) => {
                  const value = row[column];
                  return (
                    <TableCell key={column}>
                      {Array.isArray(value) ? (
                        <Stack direction="row" gap={0.5} flexWrap="wrap">
                          {value.map((item) => <Chip key={String(item)} size="small" label={String(item)} />)}
                        </Stack>
                      ) : (
                        String(value ?? "-")
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
          {!rows?.length && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} sx={{ py: 3, color: "text.secondary", textAlign: "center" }}>
                No records found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
