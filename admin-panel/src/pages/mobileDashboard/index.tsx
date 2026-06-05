import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  deleteMobileDashboardWidget,
  getMobileDashboardWidgets,
  type MobileDashboardWidget,
  reorderMobileDashboardWidgets,
  saveMobileDashboardWidget,
  updateMobileDashboardWidgetStatus,
} from "../../services/mobileDashboardAdminApi";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";

const ROLE_CODES = [
  "FARMER",
  "TRADER",
  "GATE_OPERATOR",
  "MANDI_MANAGER",
  "MANDI_ADMIN",
  "WEIGHBRIDGE_OPERATOR",
  "AUCTIONEER",
  "AUDITOR",
  "VIEWER",
  "ORG_ADMIN",
  "ORG_VIEWER",
  "YARD_SUPERVISOR",
];

const LAYOUTS = ["FULL_WIDTH", "GRID_2", "LIST"] as const;

type FormState = {
  _id: string;
  role_code: string;
  widget_key: string;
  title_en: string;
  title_hi: string;
  route: string;
  api_name: string;
  permission_key: string;
  layout: "FULL_WIDTH" | "GRID_2" | "LIST";
  order: string;
  is_active: "Y" | "N";
  metadata: string;
};

const blankForm = (role = "FARMER"): FormState => ({
  _id: "",
  role_code: role,
  widget_key: "",
  title_en: "",
  title_hi: "",
  route: "",
  api_name: "",
  permission_key: "",
  layout: "FULL_WIDTH",
  order: "",
  is_active: "Y",
  metadata: "",
});

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

function responseData(resp: any) {
  return resp?.response?.data || resp?.data || {};
}

function responseOk(resp: any) {
  return String(resp?.response?.responsecode ?? "1") === "0";
}

function metadataToText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

const MobileDashboardAdminPage = () => {
  const uiConfig = useAdminUiConfig();
  const storedUser = useMemo(() => getStoredUser(), []);
  const username = String(storedUser?.username || storedUser?.email || "").trim().toLowerCase();
  const country = String(storedUser?.country || DEFAULT_COUNTRY).trim().toUpperCase();
  const role = normalizeRole(uiConfig.role || storedUser?.role_slug || storedUser?.default_role_code);
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [roleFilter, setRoleFilter] = useState("FARMER");
  const [rows, setRows] = useState<MobileDashboardWidget[]>([]);
  const [form, setForm] = useState<FormState>(() => blankForm("FARMER"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseInput = useMemo(
    () => ({ username, country, language: DEFAULT_LANGUAGE, role }),
    [country, role, username],
  );

  const loadRows = useCallback(async () => {
    if (!username || !isSuperAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const resp = await getMobileDashboardWidgets({ ...baseInput, role_code: roleFilter });
      if (!responseOk(resp)) {
        setMessage({ type: "error", text: resp?.response?.description || "Unable to load widgets." });
        return;
      }
      setRows(responseData(resp).widgets || []);
    } catch (error) {
      console.error("[mobileDashboard] load error", error);
      setMessage({ type: "error", text: "Unable to load widgets." });
    } finally {
      setLoading(false);
    }
  }, [baseInput, isSuperAdmin, roleFilter, username]);

  useEffect(() => {
    setForm((prev) => ({ ...blankForm(roleFilter), _id: prev._id && prev.role_code === roleFilter ? prev._id : "" }));
    loadRows();
  }, [loadRows, roleFilter]);

  const editRow = (row: MobileDashboardWidget) => {
    setForm({
      _id: row._id || "",
      role_code: row.role_code || roleFilter,
      widget_key: row.widget_key || "",
      title_en: row.title_en || "",
      title_hi: row.title_hi || "",
      route: row.route || "",
      api_name: row.api_name || "",
      permission_key: row.permission_key || "",
      layout: row.layout || "FULL_WIDTH",
      order: row.order === undefined || row.order === null ? "" : String(row.order),
      is_active: row.is_active === "N" ? "N" : "Y",
      metadata: metadataToText(row.metadata),
    });
  };

  const resetForm = () => setForm(blankForm(roleFilter));

  const saveForm = async () => {
    if (!username || !isSuperAdmin) return;
    setSaving(true);
    setMessage(null);
    try {
      let metadata: unknown = null;
      if (form.metadata.trim()) metadata = JSON.parse(form.metadata);
      const widget: Partial<MobileDashboardWidget> = {
        _id: form._id || undefined,
        role_code: form.role_code,
        widget_key: form.widget_key.trim(),
        title_en: form.title_en.trim(),
        title_hi: form.title_hi.trim() || null,
        route: form.route.trim() || null,
        api_name: form.api_name.trim() || null,
        permission_key: form.permission_key.trim() || null,
        layout: form.layout,
        order: form.order.trim() ? Number(form.order) : undefined,
        is_active: form.is_active,
        metadata,
      };
      const resp = await saveMobileDashboardWidget({ ...baseInput, widget });
      if (!responseOk(resp)) {
        setMessage({ type: "error", text: resp?.response?.description || "Unable to save widget." });
        return;
      }
      setMessage({ type: "success", text: "Saved." });
      resetForm();
      await loadRows();
    } catch (error) {
      console.error("[mobileDashboard] save error", error);
      setMessage({ type: "error", text: "Metadata must be valid JSON." });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: MobileDashboardWidget) => {
    if (!row._id) return;
    const nextStatus = row.is_active === "Y" ? "N" : "Y";
    const resp = await updateMobileDashboardWidgetStatus({
      ...baseInput,
      widget_id: row._id,
      is_active: nextStatus,
    });
    if (!responseOk(resp)) {
      setMessage({ type: "error", text: resp?.response?.description || "Unable to update status." });
      return;
    }
    await loadRows();
  };

  const deleteRow = async (row: MobileDashboardWidget) => {
    if (!row._id) return;
    if (!window.confirm(`Delete ${row.widget_key}?`)) return;
    const resp = await deleteMobileDashboardWidget({ ...baseInput, widget_id: row._id });
    if (!responseOk(resp)) {
      setMessage({ type: "error", text: resp?.response?.description || "Unable to delete widget." });
      return;
    }
    setMessage({ type: "success", text: "Deleted." });
    await loadRows();
  };

  const saveOrder = async () => {
    const widgets = rows
      .filter((row) => row._id)
      .map((row) => ({ widget_id: row._id, order: Number(row.order || 0) }));
    const resp = await reorderMobileDashboardWidgets({ ...baseInput, role_code: roleFilter, widgets });
    if (!responseOk(resp)) {
      setMessage({ type: "error", text: resp?.response?.description || "Unable to save order." });
      return;
    }
    setMessage({ type: "success", text: "Order saved." });
    await loadRows();
  };

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Only Super Admin can access Mobile Dashboard.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Mobile Dashboard
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {rows.length} widgets
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Select size="small" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            {ROLE_CODES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
          <IconButton aria-label="Refresh" onClick={loadRows} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          <Select size="small" value={form.role_code} onChange={(event) => setForm((prev) => ({ ...prev, role_code: event.target.value }))}>
            {ROLE_CODES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
          <TextField size="small" label="widget_key" value={form.widget_key} onChange={(event) => setForm((prev) => ({ ...prev, widget_key: event.target.value }))} />
          <TextField size="small" label="order" type="number" value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} />
          <TextField size="small" label="title_en" value={form.title_en} onChange={(event) => setForm((prev) => ({ ...prev, title_en: event.target.value }))} />
          <TextField size="small" label="title_hi" value={form.title_hi} onChange={(event) => setForm((prev) => ({ ...prev, title_hi: event.target.value }))} />
          <TextField size="small" label="route" value={form.route} onChange={(event) => setForm((prev) => ({ ...prev, route: event.target.value }))} />
          <TextField size="small" label="api_name" value={form.api_name} onChange={(event) => setForm((prev) => ({ ...prev, api_name: event.target.value }))} />
          <TextField size="small" label="permission_key" value={form.permission_key} onChange={(event) => setForm((prev) => ({ ...prev, permission_key: event.target.value }))} />
          <Select size="small" value={form.layout} onChange={(event) => setForm((prev) => ({ ...prev, layout: event.target.value as FormState["layout"] }))}>
            {LAYOUTS.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Switch checked={form.is_active === "Y"} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked ? "Y" : "N" }))} />
            <Typography>{form.is_active === "Y" ? "Enabled" : "Disabled"}</Typography>
          </Box>
          <TextField
            label="metadata"
            multiline
            minRows={4}
            value={form.metadata}
            onChange={(event) => setForm((prev) => ({ ...prev, metadata: event.target.value }))}
            sx={{ gridColumn: { xs: "1", md: "1 / span 3" } }}
          />
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={resetForm}>
            New
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={saveForm} disabled={saving || !form.widget_key.trim() || !form.title_en.trim()}>
            Save
          </Button>
        </Box>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Order</TableCell>
              <TableCell>Widget</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Layout</TableCell>
              <TableCell>Route</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row._id || row.widget_key}>
                <TableCell sx={{ width: 110 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={row.order ?? ""}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { ...row, order: Number(event.target.value) };
                      setRows(nextRows);
                    }}
                  />
                </TableCell>
                <TableCell>{row.widget_key}</TableCell>
                <TableCell>{row.title_en}</TableCell>
                <TableCell>{row.layout}</TableCell>
                <TableCell>{row.route || "-"}</TableCell>
                <TableCell>
                  <Switch checked={row.is_active === "Y"} onChange={() => toggleStatus(row)} />
                </TableCell>
                <TableCell align="right">
                  <IconButton aria-label="Edit" onClick={() => editRow(row)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton aria-label="Delete" onClick={() => deleteRow(row)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                    No widgets found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={saveOrder} disabled={!rows.length}>
          Save Order
        </Button>
      </Box>
    </Box>
  );
};

export default MobileDashboardAdminPage;
