import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { StepUpGuard } from "../../components/StepUpGuard";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchResourceRegistry } from "../../services/resourceRegistryApi";

type UiResource = {
  resource_key: string;
  action_code?: string;
  ui_type?: string;
  route?: string | null;
  screen?: string | null;
  element?: string | null;
  is_active?: string | boolean;
};

type RegistryEntry = {
  resource_key: string;
  allowed_actions: string[];
  aliases?: string[];
  is_active?: string;
};

type MismatchRow = {
  resource_key: string;
  ui_action?: string;
  registry_actions?: string[];
  reason: string;
};

const normalizeKey = (value: string) => String(value || "").trim();
const normalizeAction = (value: string) => String(value || "").trim().toUpperCase();

const ResourceHealthPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { ui_resources } = useAdminUiConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
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

    if (username) {
      load();
    }
  }, [username]);

  const registryMap = useMemo(() => {
    const map = new Map<string, RegistryEntry>();
    registry.forEach((entry) => {
      const key = normalizeKey(entry.resource_key);
      if (key) map.set(key, entry);
    });
    return map;
  }, [registry]);

  const uiMap = useMemo(() => {
    const map = new Map<string, UiResource[]>();
    (ui_resources || []).forEach((entry: UiResource) => {
      const key = normalizeKey(entry.resource_key);
      if (!key) return;
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    });
    return map;
  }, [ui_resources]);

  const mismatches = useMemo(() => {
    const missingRegistry: MismatchRow[] = [];
    const missingUi: MismatchRow[] = [];
    const actionMismatch: MismatchRow[] = [];

    uiMap.forEach((entries, key) => {
      const registryEntry = registryMap.get(key);
      if (!registryEntry) {
        entries.forEach((entry) => {
          missingRegistry.push({
            resource_key: key,
            ui_action: entry.action_code,
            reason: "UI resource missing in registry",
          });
        });
        return;
      }

      const allowed = (registryEntry.allowed_actions || []).map(normalizeAction);
      const allowedSet = new Set(allowed);
      entries.forEach((entry) => {
        const action = normalizeAction(entry.action_code || "");
        if (action && !allowedSet.has(action)) {
          actionMismatch.push({
            resource_key: key,
            ui_action: action,
            registry_actions: allowed,
            reason: "UI action not allowed by registry",
          });
        }
      });
    });

    registryMap.forEach((entry, key) => {
      if (!uiMap.has(key)) {
        missingUi.push({
          resource_key: key,
          registry_actions: entry.allowed_actions || [],
          reason: "Registry key missing in UI resources",
        });
      }
    });

    return { missingRegistry, missingUi, actionMismatch };
  }, [registryMap, uiMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mismatches;

    const filterRows = (rows: MismatchRow[]) =>
      rows.filter((row) => row.resource_key.toLowerCase().includes(q));

    return {
      missingRegistry: filterRows(mismatches.missingRegistry),
      missingUi: filterRows(mismatches.missingUi),
      actionMismatch: filterRows(mismatches.actionMismatch),
    };
  }, [mismatches, query]);

  if (!username) return <Typography>Please log in.</Typography>;

  const totalIssues =
    filtered.missingRegistry.length +
    filtered.missingUi.length +
    filtered.actionMismatch.length;

  return (
    <StepUpGuard username={username} resourceKey="resource_registry.menu">
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h5">Resource Health</Typography>
          <Typography variant="body2" color="text.secondary">
            Detect UI resources missing in the registry, registry-only keys, and action mismatches.
          </Typography>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
          >
            <TextField
              label="Search resource key"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              size="small"
              sx={{ minWidth: { xs: "100%", md: 280 } }}
            />
            <Chip
              label={`Issues: ${totalIssues}`}
              color={totalIssues ? "warning" : "success"}
              variant="outlined"
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => setQuery("")} disabled={!query}>
              Clear Search
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Paper sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Paper>
        )}

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">UI keys missing in Registry</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            These UI resources are not present in cm_resource_registry.
          </Typography>
          <Stack spacing={1}>
            {filtered.missingRegistry.length === 0 && (
              <Alert severity="success">No missing registry keys.</Alert>
            )}
            {filtered.missingRegistry.map((row) => (
              <Box
                key={`${row.resource_key}-${row.ui_action}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  pb: 1,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{row.resource_key}</Typography>
                {row.ui_action && <Chip size="small" label={row.ui_action} />}
                <Typography variant="caption" color="text.secondary">
                  {row.reason}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Registry keys missing in UI</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            These registry keys are not present in cm_ui_resources.
          </Typography>
          <Stack spacing={1}>
            {filtered.missingUi.length === 0 && (
              <Alert severity="success">No missing UI keys.</Alert>
            )}
            {filtered.missingUi.map((row) => (
              <Box
                key={row.resource_key}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  pb: 1,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{row.resource_key}</Typography>
                {(row.registry_actions || []).map((action) => (
                  <Chip key={`${row.resource_key}-${action}`} size="small" label={action} />
                ))}
                <Typography variant="caption" color="text.secondary">
                  {row.reason}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">Action mismatches</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            UI action_code is not included in registry allowed_actions.
          </Typography>
          <Stack spacing={1}>
            {filtered.actionMismatch.length === 0 && (
              <Alert severity="success">No action mismatches found.</Alert>
            )}
            {filtered.actionMismatch.map((row) => (
              <Box
                key={`${row.resource_key}-${row.ui_action}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  pb: 1,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{row.resource_key}</Typography>
                {row.ui_action && <Chip size="small" label={`UI: ${row.ui_action}`} />}
                {(row.registry_actions || []).map((action) => (
                  <Chip key={`${row.resource_key}-allowed-${action}`} size="small" label={`Allowed: ${action}`} />
                ))}
                <Typography variant="caption" color="text.secondary">
                  {row.reason}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>

        {loading && <Alert severity="info">Loading registry...</Alert>}
      </Stack>
    </StepUpGuard>
  );
};

export default ResourceHealthPage;
