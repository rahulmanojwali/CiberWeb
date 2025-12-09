import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Divider,
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
  }, [policiesByRole, selectedRole]);

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
    <Stack spacing={2}>
      <Typography variant="h5">Roles &amp; Permissions</Typography>

      {error ? (
        <Paper sx={{ p: 2, bgcolor: "error.light" }}>
          <Typography color="error">{error}</Typography>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
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
          <Box sx={{ flex: 1 }} />
          {selectedRole && (
            <FormControl size="small">
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box
                  component="button"
                  onClick={handleSave}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #1976d2",
                    background: "#1976d2",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Save changes for this role
                </Box>
              </Box>
            </FormControl>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, overflowX: "auto" }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Permissions matrix (read-only)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              <TableCell>Resource</TableCell>
              {ACTIONS.map((action) => (
                <TableCell key={action} align="center">
                  {action}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map((res) => {
              const granted = rolePermsLookup[res.resource_key] || new Set<string>();
              return (
                <TableRow key={res.resource_key}>
                  <TableCell>{res.screen || "-"}</TableCell>
                  <TableCell>{res.resource_key}</TableCell>
                  {ACTIONS.map((action) => (
                    <TableCell key={action} align="center">
                      <Checkbox
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
