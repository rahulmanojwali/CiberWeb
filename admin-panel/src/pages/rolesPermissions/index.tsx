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
import { useAdminUiConfig } from "../../contexts/admin-ui-config";

type PolicyEntry = { resource_key: string; actions: string[] };
type RoleEntry = { role_slug: string; role_name?: string; source?: string; is_protected?: string };
type RegistryEntry = {
  resource_key: string;
  module?: string;
  allowed_actions: string[];
  description?: string;
  aliases?: string[];
  ui_only?: boolean;
};

const normalizeKey = (key: string): string => {
  const k = String(key || '').trim();
  if (!k) return '';
  const lower = k.toLowerCase().replace(/\s+/g, '');
  if (lower.endsWith('.update')) return lower.replace(/\.update$/, '.edit');
  if (lower.endsWith('.delete') || lower.endsWith('.disable') || lower.endsWith('.toggle')) {
    return lower.replace(/\.(delete|disable|toggle)$/, '.deactivate');
  }
  return lower;
};

const resolveModuleName = (key: string): string => {
  if (!key) return 'Misc';
  const k = normalizeKey(key);
  const starts = (p: string) => k.startsWith(p);

  if (starts('menu.role_policies') || starts('user_roles.') || starts('resource_registry.') || starts('resources_registry.') || starts('admin_users.')) {
    return 'System Administration';
  }
  if (starts('organisations.') || starts('org_mandi_mappings.')) {
    return 'Organisation Management';
  }
  if (starts('commodities.') || starts('commodity_products.')) {
    return 'Masters – Commodities';
  }
  if (
    starts('auction_methods_masters.') ||
    starts('auction_rounds_masters.') ||
    starts('cm_mandi_auction_policies.') ||
    starts('auction_sessions.') ||
    starts('auction_lots.') ||
    starts('auction_results.')
  ) {
    return 'Auctions';
  }
  if (
    starts('mandis.') ||
    starts('mandi_facilities.') ||
    starts('mandi_hours.') ||
    starts('mandi_coverage.') ||
    starts('mandi_prices.')
  ) {
    return 'Mandi Setup & Configuration';
  }
  if (
    starts('mandi_gates.') ||
    starts('gate_entry_reasons_masters.') ||
    starts('gate_vehicle_types_masters.') ||
    starts('cm_gate_devices.') ||
    starts('gate_entry_tokens.') ||
    starts('gate_pass_tokens.') ||
    starts('weighment_tickets.') ||
    starts('gate_movements_log.') ||
    starts('gate_device_configs.')
  ) {
    return 'Gate & Yard';
  }
  if (starts('traders.') || starts('farmers.') || starts('trader_approvals.')) {
    return 'Participants';
  }
  if (
    starts('payment_models.') ||
    starts('payment_modes.') ||
    starts('org_payment_settings.') ||
    starts('mandi_payment_settings.') ||
    starts('commodity_fees.') ||
    starts('custom_fees.') ||
    starts('role_custom_fees.') ||
    starts('settlements.') ||
    starts('payments_log.') ||
    starts('subscriptions.') ||
    starts('subscription_invoices.')
  ) {
    return 'Payments & Finance';
  }
  if (starts('reports.')) {
    return 'Reports';
  }
  return 'Misc';
};

const moduleOrder = [
  'System Administration',
  'Organisation Management',
  'Masters – Commodities',
  'Auctions',
  'Mandi Setup & Configuration',
  'Gate & Yard',
  'Participants',
  'Payments & Finance',
  'Reports',
  'Misc',
];

const RolesPermissionsPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { enqueueSnackbar } = useSnackbar();
  const { refresh, ui_resources } = useAdminUiConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [policiesByRole, setPoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [editablePoliciesByRole, setEditablePoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"registered" | "unregistered">("registered");
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [showDebug, setShowDebug] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("rp_show_debug");
    return saved === "true";
  });
  const [debugExpanded, setDebugExpanded] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchRolePoliciesDashboardData({ username: username || "", country: "IN" });
        const payload = resp?.data || resp || {};
        const rolesList: RoleEntry[] = payload.roles || [];
        const registryList: RegistryEntry[] = (payload.registry || []).map((r: any) => ({
          ...r,
          resource_key: normalizeKey(r.resource_key),
        }));
        const pMapRaw: Record<string, PolicyEntry[]> = payload.policiesByRole || {};
        const pMap: Record<string, PolicyEntry[]> = {};
        Object.keys(pMapRaw || {}).forEach((roleKey) => {
          pMap[roleKey] = (pMapRaw[roleKey] || []).map((p: any) => ({
            resource_key: normalizeKey(p.resource_key),
            actions: (p.actions || []).map((a: string) => a.toUpperCase()),
          }));
        });

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
      const key = normalizeKey(p.resource_key);
      map[key] = new Set((p.actions || []).map((a) => a.toUpperCase()));
    });
    return map;
  }, [editablePoliciesByRole, selectedRole]);

  const mergedRegistry = useMemo(() => {
    const baseKeys = new Set(registry.map((r) => r.resource_key));
    const normalizedRegistry = registry.map((r) => ({
      ...r,
      resource_key: normalizeKey(r.resource_key),
      module: resolveModuleName(r.resource_key) || r.module,
    }));
    return normalizedRegistry;
  }, [registry, ui_resources]);

  const registeredResources = useMemo(() => mergedRegistry, [mergedRegistry]);

  const unregisteredResources = useMemo(() => {
    const registryKeys = new Set(registeredResources.map((r) => r.resource_key));
    const uiOnly =
      ui_resources
        ?.filter(
          (u: any) =>
            u?.is_active &&
            u.resource_key &&
            !registryKeys.has(normalizeKey(u.resource_key)),
        )
        .map((u: any) => ({
          resource_key: normalizeKey(u.resource_key),
          module: resolveModuleName(u.resource_key) || u.module || "UI resource",
          allowed_actions: u.allowed_actions || [],
          description: "UI resource not registered in resource registry",
          aliases: u.aliases || [],
          is_active: u.is_active,
          ui_only: true,
        })) || [];
    return uiOnly;
  }, [ui_resources, registeredResources]);

  const moduleOptions = useMemo(() => {
    const set = new Set<string>();
    registeredResources.forEach((r) => {
      if (r.module) set.add(r.module);
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [registeredResources]);

  const filteredResources = useMemo(() => {
    if (selectedModule === "ALL") return registeredResources;
    return registeredResources.filter((r) => (r.module || "") === selectedModule);
  }, [registeredResources, selectedModule]);

  const toggleAction = (resourceKey: string, action: string, checked: boolean) => {
    setEditablePoliciesByRole((prev) => {
      const current = prev[selectedRole] || [];
      const next = [...current];
      const regEntry = resourcesByKey[resourceKey];
      if (regEntry?.ui_only) {
        return prev; // do not allow toggling unregistered resources
      }

      // Normalize action name and resolve the proper resource key based on registry
      const normalizedAction = action.toUpperCase() === "EDIT" ? "UPDATE" : action.toUpperCase();

      let targetKey = resourceKey;
      if (normalizedAction === "UPDATE") {
        const updateKey = resourceKey.endsWith(".update") ? resourceKey : `${resourceKey}.update`;
        const editKey = resourceKey.endsWith(".edit") ? resourceKey : `${resourceKey}.edit`;
        if (resourcesByKey[updateKey]) {
          targetKey = updateKey;
        } else if (resourcesByKey[editKey]) {
          targetKey = editKey;
        }
      }

      const idx = next.findIndex((p) => p.resource_key === targetKey);
      if (checked) {
        if (idx === -1) {
          next.push({ resource_key: targetKey, actions: [normalizedAction] });
        } else {
          const actions = new Set(next[idx].actions || []);
          actions.add(normalizedAction);
          next[idx] = { ...next[idx], actions: Array.from(actions) };
        }
      } else if (idx !== -1) {
        const actions = new Set(next[idx].actions || []);
        actions.delete(normalizedAction);
        if (actions.size === 0) {
          next.splice(idx, 1);
        } else {
          next[idx] = { ...next[idx], actions: Array.from(actions) };
        }
      }
      return { ...prev, [selectedRole]: next };
    });
  };

  const resourcesByKey = useMemo(() => {
    const map: Record<string, any> = {};
    mergedRegistry.forEach((r: any) => {
      if (r?.resource_key) map[r.resource_key] = r;
    });
    return map;
  }, [mergedRegistry]);

  const setsEqual = (a?: Set<string>, b?: Set<string>) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  };

  const resolveUpdateKey = (key: string): string | null => {
    const base = key.replace(/\.(edit|update)$/, "");
    const updateKey = `${base}.update`;
    const editKey = `${base}.edit`;
    if (resourcesByKey[updateKey]) return updateKey;
    if (resourcesByKey[editKey]) return editKey;
    return null;
  };

  const handleSave = async () => {
    try {
      const original = policiesByRole[selectedRole] || [];
      const current = editablePoliciesByRole[selectedRole] || [];

      const origMap = new Map<string, Set<string>>();
      original.forEach((p: any) => {
        origMap.set(p.resource_key, new Set((p.actions || []).map((a: string) => a.toUpperCase())));
      });

      const currentMap = new Map<string, Set<string>>();
      current.forEach((p: any) => {
        currentMap.set(p.resource_key, new Set((p.actions || []).map((a: string) => a.toUpperCase())));
      });

      // Normalize keys based on registry truth before diffing
      const normalizedCurrentMap = new Map<string, Set<string>>();
      for (const [rawKey, actionsSet] of currentMap.entries()) {
        let key = rawKey;
        if (actionsSet.has("UPDATE")) {
          const resolved = resolveUpdateKey(rawKey);
          if (!resolved) {
            setError(`Registry missing UPDATE key for ${rawKey}`);
            return;
          }
          key = resolved;
        }
        const existing = normalizedCurrentMap.get(key) || new Set<string>();
        actionsSet.forEach((a) => existing.add(a));
        normalizedCurrentMap.set(key, existing);
      }

      const debugAuth =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debugAuth") === "1";
      if (debugAuth) {
        console.log("[rolePolicies debug] submitting keys", Array.from(normalizedCurrentMap.keys()));
      }

      const payload: any[] = [];

      // additions/updates
      normalizedCurrentMap.forEach((actionsSet, key) => {
        if (!resourcesByKey[key]) return; // skip unknown keys defensively
        const origSet = origMap.get(key);
        if (actionsSet.size === 0) {
          if (origSet && origSet.size > 0) {
            payload.push({ resource_key: key, actions: [] }); // removal
          }
          return;
        }
        if (!setsEqual(actionsSet, origSet)) {
          payload.push({ resource_key: key, actions: Array.from(actionsSet) });
        }
      });

      // removals for keys no longer present
      origMap.forEach((origSet, key) => {
        if (!normalizedCurrentMap.has(key) && origSet.size > 0 && resourcesByKey[key]) {
          payload.push({ resource_key: key, actions: [] });
        }
      });

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
        await refresh({ invalidate: true });
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
  const isProtectedRole = useMemo(() => {
    const current = roles.find((r) => r.role_slug === selectedRole);
    return current?.is_protected === "Y" || current?.source === "SYSTEM";
  }, [roles, selectedRole]);

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
                    {r.role_name || r.role_slug}{" "}
                    {r.is_protected === "Y" || r.source === "SYSTEM" ? "(SYSTEM)" : ""}
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
                disabled={activeTab === "unregistered"}
              >
                {moduleOptions.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m === "ALL" ? "All modules" : m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleSave} disabled={loading || !selectedRole || isProtectedRole || activeTab === "unregistered"}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1}>
        <Button
          variant={activeTab === "registered" ? "contained" : "outlined"}
          onClick={() => setActiveTab("registered")}
          size="small"
        >
          Registered (assignable)
        </Button>
        <Button
          variant={activeTab === "unregistered" ? "contained" : "outlined"}
          onClick={() => setActiveTab("unregistered")}
          size="small"
        >
          Unregistered UI resources
        </Button>
      </Stack>

      {isProtectedRole && (
        <Paper sx={{ p: 2 }}>
          <Alert severity="warning">This role is protected and cannot be edited.</Alert>
        </Paper>
      )}

      {error && (
        <Paper sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Paper>
      )}

      {activeTab === "registered" ? (
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
                            {r.aliases.map((a: string) => (
                              <Chip key={a} size="small" variant="outlined" label={`alias: ${a}`} />
                            ))}
                          </Stack>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{r.module || "-"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {allowedActions.map((action: string) => (
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
      ) : (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Unregistered UI resources (maintenance only)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            These keys exist in UI resources but are not in the canonical resource registry. They are not assignable.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                <TableCell>Module / Family</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unregisteredResources.map((r) => {
                const family = r.resource_key.split('.')[0] || 'misc';
                return (
                  <TableRow key={r.resource_key}>
                    <TableCell>
                      <Typography variant="body2">{r.resource_key}</Typography>
                    </TableCell>
                    <TableCell>{r.module || family}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" color="warning" label="Unregistered" />
                        {r.resource_key.startsWith("org_mandi.") && (
                          <Chip size="small" color="error" label="Alias / skipped" />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Suggested: disable in UI resources or register under canonical key family.
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

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
              <Alert
                severity="info"
                action={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      onClick={() => {
                        const expected = missingForRole
                          .filter((m: string) =>
                            /\.(list|detail|create|edit|deactivate|approve|reject|request_more_info|update_status|bulk_upload|reset_password)$/.test(m),
                          );
                        const suspicious = missingForRole.filter((m: string) => !expected.includes(m));
                        const payload = {
                          expected,
                          suspicious,
                        };
                        try {
                          navigator?.clipboard?.writeText(JSON.stringify(payload, null, 2));
                        } catch (_) {
                          // ignore
                        }
                      }}
                    >
                      Copy
                    </Button>
                    <Button size="small" onClick={() => setDebugExpanded((prev) => !prev)}>
                      {debugExpanded ? "Hide list" : "Show list"}
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        const next = !showDebug;
                        setShowDebug(next);
                        if (typeof window !== "undefined") {
                          localStorage.setItem("rp_show_debug", next ? "true" : "false");
                        }
                      }}
                    >
                      {showDebug ? "Hide debug" : "Show debug"}
                    </Button>
                  </Stack>
                }
              >
                Debug: {missingForRole.length} policy keys not in UI resources (click to expand)
                <Typography variant="caption" display="block" color="text.secondary">
                  These are valid registry/policy actions that may not have UI menu entries. They remain assignable and are used for button gating.
                </Typography>
                {showDebug && debugExpanded && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">Expected (actions-only)</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {missingForRole
                        .filter((m: string) =>
                          /\.(list|detail|create|edit|deactivate|approve|reject|request_more_info|update_status|bulk_upload|reset_password)$/.test(m),
                        )
                        .map((m: string) => (
                          <Chip key={m} label={m} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                    </Stack>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      Suspicious (legacy/typo families)
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {missingForRole
                        .filter(
                          (m: string) =>
                            !/\.(list|detail|create|edit|deactivate|approve|reject|request_more_info|update_status|bulk_upload|reset_password)$/.test(m),
                        )
                        .map((m: string) => (
                          <Chip key={m} label={m} size="small" color="warning" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                    </Stack>
                  </Box>
                )}
              </Alert>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default RolesPermissionsPage;
