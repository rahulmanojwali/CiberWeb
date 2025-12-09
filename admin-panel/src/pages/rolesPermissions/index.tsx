import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  Button,
  Tooltip,
} from "@mui/material";
import { fetchRolePoliciesDashboardData } from "../../services/rolePoliciesApi";

type PolicyEntry = { resource_key: string; actions: string[] };
type RoleEntry = { role_slug: string; role_name?: string };
type ResourceEntry = { resource_key: string; screen?: string; element?: string };

const ACTIONS = ["VIEW", "CREATE", "UPDATE", "DEACTIVATE"];

const RolesPermissionsPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [policiesByRole, setPoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [editablePoliciesByRole, setEditablePoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchRolePoliciesDashboardData({ username: username || "" });
        const payload = resp?.data || resp || {};
        const rolesList: RoleEntry[] = payload.roles || [];
        const resList: ResourceEntry[] = payload.resources || [];
        const pMap: Record<string, PolicyEntry[]> = payload.policiesByRole || {};

        setRoles(rolesList);
        setResources(resList);
        setPoliciesByRole(pMap);
        setEditablePoliciesByRole(JSON.parse(JSON.stringify(pMap)));
        if (rolesList.length > 0) {
          setSelectedRole(rolesList[0].role_slug);
        }
        if (resp?.response?.responsecode !== "0") {
          setError(resp?.response?.description || "Failed to load role policies");
        }
        setLoading(false);
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || "Failed to load role policies");
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
    resources.forEach((r) => {
      if (r.screen) set.add(r.screen);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [resources]);

  const filteredResources = useMemo(() => {
    if (selectedModule === "ALL") return resources;
    return resources.filter((r) => (r.screen || "") === selectedModule);
  }, [resources, selectedModule]);

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
      } else {
        if (idx !== -1) {
          const actions = new Set(next[idx].actions || []);
          actions.delete(action);
          if (actions.size === 0) {
            next.splice(idx, 1);
          } else {
            next[idx] = { ...next[idx], actions: Array.from(actions) };
          }
        }
      }
      return { ...prev, [selectedRole]: next };
    });
  };

  const handleSave = async () => {
    try {
      const payload = editablePoliciesByRole[selectedRole] || [];
      setLoading(true);
      const resp = await import("../../services/rolePoliciesApi").then((m) =>
        m.updateRolePolicies({
          username,
          role_slug: selectedRole,
          permissions: payload,
        })
      );
      setLoading(false);
      if (resp?.response?.responsecode === "0") {
        // Refresh from server to stay in sync
        const refreshed = await fetchRolePoliciesDashboardData({ username: username || "" });
        const payloadRef = refreshed?.data || refreshed || {};
        setPoliciesByRole(payloadRef.policiesByRole || {});
        setEditablePoliciesByRole(JSON.parse(JSON.stringify(payloadRef.policiesByRole || {})));
      } else {
        setError(resp?.response?.description || "Failed to save role policies");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Failed to save role policies");
    }
  };

  if (!username) {
    return <Typography>Please log in.</Typography>;
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} /> <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ position: "relative" }}>
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
            <Typography variant="h5">Roles &amp; Permissions</Typography>
            <Typography variant="body2" color="text.secondary">
              Select a role and module to view or edit permissions.
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
            <Button variant="outlined" size="small" disabled>
              Manage modules &amp; resources
            </Button>
            {selectedRole && (
              <Button variant="contained" size="small" onClick={handleSave}>
                Save changes
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Paper sx={{ p: 2, bgcolor: "error.light" }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2, overflowX: "auto" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Editing role: <strong>{selectedRole || "—"}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ✔ granted • empty = not granted
          </Typography>
        </Stack>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  backgroundColor: "background.paper",
                  minWidth: 140,
                }}
              >
                Module
              </TableCell>
              <TableCell
                sx={{
                  position: "sticky",
                  left: 140,
                  zIndex: 3,
                  backgroundColor: "background.paper",
                  minWidth: 220,
                }}
              >
                Resource
              </TableCell>
              {ACTIONS.map((action) => (
                <TableCell key={action} align="center">
                  <Tooltip title={`${action.toLowerCase()} permission`}>
                    <Box component="span">{action}</Box>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredResources.map((res) => {
              const granted = rolePermsLookup[res.resource_key] || new Set<string>();
              return (
                <TableRow key={res.resource_key} hover>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 0,
                      backgroundColor: "background.paper",
                      minWidth: 140,
                      zIndex: 2,
                    }}
                  >
                    {res.screen || "-"}
                  </TableCell>
                  <TableCell
                    sx={{
                      position: "sticky",
                      left: 140,
                      backgroundColor: "background.paper",
                      minWidth: 220,
                      zIndex: 2,
                      fontFamily: "monospace",
                    }}
                  >
                    {res.resource_key}
                  </TableCell>
                  {ACTIONS.map((action) => (
                    <TableCell key={action} align="center">
                      <Checkbox
                        size="small"
                        checked={granted.has(action)}
                        onChange={(e) => toggleAction(res.resource_key, action, e.target.checked)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
};

export default RolesPermissionsPage;
