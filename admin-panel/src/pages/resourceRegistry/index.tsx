import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
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
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
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
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const canCreate = can("resource_registry.create", "CREATE");
  const canEdit = can("resource_registry.edit", "UPDATE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [editing, setEditing] = useState<RegistryEntry>(DEFAULT_ENTRY);

  const modules = useMemo(() => {
    const set = new Set<string>();
    registry.forEach((r) => {
      if (r.module) set.add(r.module);
    });
    return Array.from(set).sort();
  }, [registry]);

  const loadRegistry = async () => {
    try {
      setLoading(true);
      const resp = await fetchResourceRegistry({ username });
      if (resp?.response?.responsecode !== "0") {
        setError(resp?.response?.description || "Failed to load registry");
      }
      const list: RegistryEntry[] = resp?.data?.registry || [];
      setRegistry(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry");
    } finally {
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
    setEditing({
      resource_key: entry.resource_key,
      module: entry.module || "",
      allowed_actions: entry.allowed_actions || [],
      description: entry.description || "",
      aliases: entry.aliases || [],
      is_active: entry.is_active || "Y",
    });
  };

  if (!username) return <Typography>Please log in.</Typography>;

  return (
    <StepUpGuard username={username} resourceKey="resource_registry.menu">
      <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h5">Resource Registry</Typography>
        <Typography variant="body2" color="text.secondary">
          Canonical source of truth for RBAC resource keys and allowed actions.
        </Typography>
      </Paper>

      {error && (
        <Paper sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <ActionGate resourceKey="resource_registry.create" action="CREATE">
            <Stack spacing={2}>
              <TextField
                label="Resource Key"
                value={editing.resource_key}
                onChange={(e) => setEditing((prev) => ({ ...prev, resource_key: e.target.value }))}
                size="small"
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
              <Button variant="contained" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </ActionGate>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
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
                  <ActionGate resourceKey="resource_registry.edit" action="UPDATE" record={r}>
                    <Button size="small" onClick={() => startEdit(r)}>
                      Edit
                    </Button>
                  </ActionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
    </StepUpGuard>
  );
};

export default ResourceRegistryPage;
