import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { fetchResourceRegistry, updateResourceRegistry } from "../../services/resourceRegistryApi";
import { ActionGate } from "../../authz/ActionGate";
import { StepUpGuard } from "../../components/StepUpGuard" ;

type RegistryEntry = {
  resource_key: string;
  module?: string;
  allowed_actions: string[];
  description?: string;
  aliases?: string[];
  is_active?: string;
};

const DEFAULT_ENTRY: RegistryEntry = {
  resource_key: "",
  module: "",
  allowed_actions: ["VIEW"],
  description: "",
  aliases: [],
  is_active: "Y",
};

const ResourceRegistryPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [editing, setEditing] = useState<RegistryEntry>(DEFAULT_ENTRY);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  const loadRegistry = async () => {
    let slowTimer: number | undefined;
    try {
      setError(null);
      setSlowLoad(false);
      setLoading(true);
      slowTimer = window.setTimeout(() => setSlowLoad(true), 10000);
      const resp = await fetchResourceRegistry({ username });
      if (resp?.response?.responsecode !== "0") {
        setError(resp?.response?.description || "Failed to load registry");
      }
      const list: RegistryEntry[] = resp?.response?.data?.registry || resp?.data?.registry || [];
      setRegistry(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry");
    } finally {
      if (slowTimer) window.clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) {
      loadRegistry();
    }
  }, [username]);

  const handleSave = async () => {
    if (!editing.resource_key) {
      enqueueSnackbar("Resource key is required.", { variant: "warning" });
      return;
    }
    try {
      setLoading(true);
      const key = String(editing.resource_key || "").toLowerCase();
      const normalizeForStatusKey =
        key.endsWith(".update_status") ||
        key.endsWith(".arrive") ||
        key.endsWith(".cancel") ||
        key.endsWith(".complete");
      const normalizedEntry: RegistryEntry = {
        ...editing,
        allowed_actions: Array.from(
          new Set(
            (editing.allowed_actions || [])
              .map((a) => String(a || "").toUpperCase())
              .map((a) => (normalizeForStatusKey && a === "UPDATE_STATUS" ? "UPDATE" : a))
              .filter(Boolean),
          ),
        ),
      };
      console.log("RM_SAVE_PAYLOAD_DEBUG", {
        canonicalKey: normalizedEntry.resource_key,
        actions: normalizedEntry.allowed_actions,
      });
      const resp = await updateResourceRegistry({ username, entries: [normalizedEntry] });
      console.info("[RESOURCE_REGISTRY_SAVE] resp=", resp);
      if (resp?.response?.responsecode === "0") {
        enqueueSnackbar("Registry updated.", { variant: "success" });
        setEditing(DEFAULT_ENTRY);
        setFormOpen(false);
        await loadRegistry();
      } else {
        const message = resp?.response?.description || "Failed to update registry";
        enqueueSnackbar(message, { variant: "error" });
      }
    } catch (err: any) {
      console.info("[RESOURCE_REGISTRY_SAVE] error", err);
      enqueueSnackbar(err?.message || "Failed to update registry", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (entry: RegistryEntry) => {
    setFormMode("edit");
    setEditing({
      resource_key: entry.resource_key,
      module: entry.module || "",
      allowed_actions: entry.allowed_actions || [],
      description: entry.description || "",
      aliases: entry.aliases || [],
      is_active: entry.is_active || "Y",
    });
    setFormOpen(true);
  };

  const startCreate = () => {
    setFormMode("create");
    setEditing(DEFAULT_ENTRY);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(DEFAULT_ENTRY);
  };

  const toggleStatus = async (entry: RegistryEntry) => {
    const nextStatus = entry.is_active === "N" ? "Y" : "N";
    try {
      setLoading(true);
      const resp = await updateResourceRegistry({
        username,
        entries: [{ ...entry, is_active: nextStatus }],
      });
      if (resp?.response?.responsecode === "0") {
        enqueueSnackbar(nextStatus === "Y" ? "Resource activated." : "Resource deactivated.", {
          variant: "success",
        });
        await loadRegistry();
      } else {
        enqueueSnackbar(resp?.response?.description || "Failed to update status", { variant: "error" });
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to update status", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (!username) return <Typography>Please log in.</Typography>;

  return (
    <StepUpGuard username={username} resourceKey="resource_registry.menu">
      <div className="cm-page">
      <div className="cm-page-header">
        <h1 className="cm-page-title">Resource Registry</h1>
        <div className="cm-page-subtitle">Canonical source of truth for RBAC resource keys and allowed actions.</div>
      </div>
      <Stack spacing={2}>
      {loading && (
        <Paper sx={{ p: 0, overflow: "hidden" }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
            {slowLoad ? "Still loading resource registry. The table will appear automatically when data is ready." : "Loading resource registry..."}
          </Typography>
        </Paper>
      )}
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Manage, review and activate resource keys used by system policy enforcement.
        </Typography>
      </Paper>

      {error && (
        <Paper sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Registered Resources
          </Typography>
          <ActionGate resourceKey="resource_registry.create" action="CREATE">
            <Button variant="contained" onClick={startCreate}>
              Add Resource
            </Button>
          </ActionGate>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Resource</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Allowed Actions</TableCell>
              <TableCell>Aliases</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && registry.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No resources found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {registry.map((r) => (
              <TableRow key={r.resource_key}>
                <TableCell>{r.resource_key}</TableCell>
                <TableCell>{r.module || "-"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(r.allowed_actions || []).map((a) => (
                      <Chip key={a} label={a} size="small" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(r.aliases || []).map((a) => (
                      <Chip key={a} label={a} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>{r.is_active === "N" ? "Inactive" : "Active"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <ActionGate resourceKey="resource_registry.edit" action="UPDATE" record={r}>
                      <Button size="small" onClick={() => startEdit(r)}>
                        Edit
                      </Button>
                    </ActionGate>
                    <ActionGate resourceKey="resource_registry.edit" action="UPDATE" record={r}>
                      <Button size="small" onClick={() => toggleStatus(r)} disabled={loading}>
                        {r.is_active === "N" ? "Activate" : "Deactivate"}
                      </Button>
                    </ActionGate>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="sm">
        <DialogTitle>{formMode === "create" ? "Add Resource" : "Edit Resource"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Resource Key"
              value={editing.resource_key}
              onChange={(e) => setEditing((prev) => ({ ...prev, resource_key: e.target.value }))}
              size="small"
              disabled={formMode === "edit"}
            />
            <TextField
              label="Module"
              value={editing.module}
              onChange={(e) => setEditing((prev) => ({ ...prev, module: e.target.value }))}
              size="small"
            />
            <TextField
              label="Description"
              value={editing.description}
              onChange={(e) => setEditing((prev) => ({ ...prev, description: e.target.value }))}
              size="small"
            />
            <TextField
              label="Allowed Actions (comma separated)"
              value={editing.allowed_actions.join(",")}
              onChange={(e) =>
                setEditing((prev) => ({
                  ...prev,
                  allowed_actions: e.target.value
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean),
                }))
              }
              size="small"
            />
            <TextField
              label="Aliases (comma separated)"
              value={(editing.aliases || []).join(",")}
              onChange={(e) =>
                setEditing((prev) => ({
                  ...prev,
                  aliases: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              size="small"
            />
            <FormControl size="small">
              <InputLabel id="is-active-label">Active</InputLabel>
              <Select
                labelId="is-active-label"
                label="Active"
                value={editing.is_active || "Y"}
                onChange={(e) => setEditing((prev) => ({ ...prev, is_active: e.target.value }))}
              >
                <MenuItem value="Y">Yes</MenuItem>
                <MenuItem value="N">No</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading || !editing.resource_key}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      </Stack>
      </div>
    </StepUpGuard>
  );
};

export default ResourceRegistryPage;
