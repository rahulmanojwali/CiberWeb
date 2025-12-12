import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { fetchRolePoliciesDashboardData, updateRolePolicies } from "../../services/rolePoliciesApi";

type PolicyEntry = { resource_key: string; actions: string[] };
type RoleEntry = { role_slug: string; role_name?: string };
type RegistryEntry = {
  resource_key: string;
  module?: string;
  allowed_actions: string[];
  description?: string;
  aliases?: string[];
};

const RolesPermissionsPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [policiesByRole, setPoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [editablePoliciesByRole, setEditablePoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [diagnostics, setDiagnostics] = useState<any>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchRolePoliciesDashboardData({ username: username || "", country: "IN" });
        const payload = resp?.data || resp || {};
        const rolesList: RoleEntry[] = payload.roles || [];
        const registryList: RegistryEntry[] = payload.registry || [];
        const pMap: Record<string, PolicyEntry[]> = payload.policiesByRole || {};

        setRoles(rolesList);
        setRegistry(registryList);
        setPoliciesByRole(pMap);
        setEditablePoliciesByRole(JSON.parse(JSON.stringify(pMap)));
        setDiagnostics(payload.diagnostics || {});
        if (rolesList.length > 0) {
          setSelectedRole(rolesList[0].role_slug);
        }
        if (resp?.response?.responsecode !== "0") {
          setError(resp?.response?.description || "Failed to load role policies");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load role policies");
      } finally {
        setLoading(false);
      }
    };
    if (username) load();
  }, [username]);

  const rolePermsLookup = useMemo(() => {
    const selectedPerms = editablePoliciesByRole[selectedRole] || [];
    const map: Record<string, Set<string>> = {};
    selectedPerms.forEach((p) => {
      const key = p.resource_key;
      map[key] = new Set((p.actions || []).map((a) => a.toUpperCase()));
    });
    return map;
  }, [editablePoliciesByRole, selectedRole]);

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    registry.forEach((r) => {
      if (r.module) set.add(r.module);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [registry]);

  const filteredResources = useMemo(() => {
    if (selectedModule === "ALL") return registry;
    return registry.filter((r) => (r.module || "") === selectedModule);
  }, [registry, selectedModule]);

  const toggleAction = (resourceKey: string, action: string, checked: boolean) => {
    setEditablePoliciesByRole((prev) => {
      const current = prev[selectedRole] || [];
      const next = [...current];
      const idx = next.findIndex((p) => p.resource_key === resourceKey);
      if (checked) {
        if (idx === -1) {
          next.push({ resource_key: resourceKey, actions: [action] });
        } else {
          const actions = new Set(next[idx].actions || []);
          actions.add(action);
          next[idx] = { ...next[idx], actions: Array.from(actions) };
        }
      } else if (idx !== -1) {
        const actions = new Set(next[idx].actions || []);
        actions.delete(action);
        if (actions.size === 0) {
          next.splice(idx, 1);
        } else {
          next[idx] = { ...next[idx], actions: Array.from(actions) };
        }
      }
      return { ...prev, [selectedRole]: next };
    });
  };

  const handleSave = async () => {
    try {
      const payload = editablePoliciesByRole[selectedRole] || [];
      setLoading(true);
      const resp = await updateRolePolicies({
        username,
        country: "IN",
        role_slug: selectedRole,
        permissions: payload,
      });
      if (resp?.response?.responsecode === "0") {
        enqueueSnackbar("Role policy updated.", { variant: "success" });
        const refreshed = await fetchRolePoliciesDashboardData({ username: username || "", country: "IN" });
        const payloadRef = refreshed?.data || refreshed || {};
        setPoliciesByRole(payloadRef.policiesByRole || {});
        setEditablePoliciesByRole(JSON.parse(JSON.stringify(payloadRef.policiesByRole || {})));
        setDiagnostics(payloadRef.diagnostics || {});
      } else {
        enqueueSnackbar(resp?.response?.description || "Failed to save role policies", { variant: "error" });
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save role policies");
    } finally {
      setLoading(false);
    }
  };

  const unknownForRole = useMemo(() => diagnostics?.unknownByRole?.[selectedRole] || [], [diagnostics, selectedRole]);
  const missingForRole = useMemo(() => diagnostics?.missingByRole?.[selectedRole] || [], [diagnostics, selectedRole]);

  if (!username) {
    return <Typography>Please log in.</Typography>;
  }

  if (loading && !roles.length) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} /> <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ position: "relative", minHeight: "60vh" }}>
      <Paper
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          p: 2,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
          <Box>
            <Typography variant="h5">Role Policy Manager</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage role permissions using the canonical resource registry.
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="role-select-label">Role</InputLabel>
              <Select
                labelId="role-select-label"
                label="Role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map((r) => (
                  <MenuItem key={r.role_slug} value={r.role_slug}>
                    {r.role_name || r.role_slug}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="module-select-label">Module</InputLabel>
              <Select
                labelId="module-select-label"
                label="Module"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
              >
                {moduleOptions.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m === "ALL" ? "All modules" : m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleSave} disabled={loading || !selectedRole}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Paper sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Resource</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Allowed Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredResources.map((r) => {
              const allowedActions = r.allowed_actions || [];
              const granted = rolePermsLookup[r.resource_key] || new Set<string>();
              return (
                <TableRow key={r.resource_key}>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{r.resource_key}</Typography>
                      {r.description && (
                        <Typography variant="caption" color="text.secondary">
                          {r.description}
                        </Typography>
                      )}
                      {r.aliases?.length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {r.aliases.map((a) => (
                            <Chip key={a} size="small" variant="outlined" label={`alias: ${a}`} />
                          ))}
                        </Stack>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{r.module || "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {allowedActions.map((action) => (
                        <Chip
                          key={`${r.resource_key}-${action}`}
                          label={action}
                          color={granted.has(action) ? "primary" : "default"}
                          variant={granted.has(action) ? "filled" : "outlined"}
                          onClick={() => toggleAction(r.resource_key, action, !granted.has(action))}
                          sx={{ cursor: "pointer" }}
                        />
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {(unknownForRole.length > 0 || missingForRole.length > 0) && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            {unknownForRole.length > 0 && (
              <Alert severity="warning">
                Unknown keys (not in registry):{" "}
                {unknownForRole.map((u: string) => (
                  <Chip key={u} label={u} size="small" sx={{ mr: 0.5 }} />
                ))}
              </Alert>
            )}
            {missingForRole.length > 0 && (
              <Alert severity="info">
                Missing keys (not granted yet):{" "}
                {missingForRole.map((m: string) => (
                  <Chip key={m} label={m} size="small" sx={{ mr: 0.5 }} />
                ))}
              </Alert>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default RolesPermissionsPage;
