import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { PageContainer } from "../components/PageContainer";
import { StepUpGuard } from "../components/StepUpGuard";
import {
  fetchRolePolicy,
  fetchUiResourcesCatalog,
  updateRolePolicy,
} from "../services/rolePoliciesApi";

type UiResource = {
  resource_key: string;
  screen?: string;
  element?: string;
  action_code?: string;
  ui_type?: string;
  route?: string | null;
  label_i18n?: Record<string, string>;
  is_active?: boolean | string;
};

type RolePolicy = {
  resource_key: string;
  actions: string[];
};

const ROLE_SLUGS = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
];

const ACTION_ORDER = ["VIEW", "CREATE", "UPDATE", "DEACTIVATE"];
const ROW_ORDER = ["menu", "list", "detail", "create", "edit", "deactivate"];

const ACTION_COLORS: Record<string, "default" | "primary" | "success" | "warning" | "error"> = {
  VIEW: "primary",
  CREATE: "success",
  UPDATE: "warning",
  DEACTIVATE: "error",
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

export const PermissionsManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [catalog, setCatalog] = useState<UiResource[]>([]);
  const [roleSlug, setRoleSlug] = useState<string>("SUPER_ADMIN");
  const [search, setSearch] = useState<string>("");
  const [showEnabledOnly, setShowEnabledOnly] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [baselineMap, setBaselineMap] = useState<Map<string, Set<string>>>(new Map());

  const groupedResources = useMemo(() => {
    const map = new Map<
      string,
      {
        resource_key: string;
        screen: string;
        actions: Set<string>;
        label?: string;
        element?: string;
        is_active?: boolean | string;
      }
    >();
    catalog.forEach((entry) => {
      const key = String(entry.resource_key || "").trim().toLowerCase();
      if (!key) return;
      const screen = entry.screen || prettifyScreenFromKey(key);
      if (!map.has(key)) {
        map.set(key, {
          resource_key: key,
          screen,
          actions: new Set(),
          label: entry.label_i18n?.en || entry.label_i18n?.hi || undefined,
          element: entry.element,
          is_active: entry.is_active,
        });
      }
      const action = String(entry.action_code || "").trim().toUpperCase();
      if (action) map.get(key)!.actions.add(action);
    });

    const list = Array.from(map.values()).map((entry) => ({
      ...entry,
      actions: Array.from(entry.actions).sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b)),
    }));

    const filter = search.trim().toLowerCase();
    const filteredByActive = showEnabledOnly
      ? list.filter((entry) => String(entry.is_active || "").toUpperCase() !== "N")
      : list;
    const filtered = filter
      ? filteredByActive.filter(
          (entry) =>
            entry.resource_key.includes(filter) ||
            entry.screen.toLowerCase().includes(filter) ||
            (entry.label || "").toLowerCase().includes(filter) ||
            (entry.element || "").toLowerCase().includes(filter),
        )
      : filteredByActive;

    const groups: Record<string, typeof list> = {};
    filtered.forEach((entry) => {
      if (!groups[entry.screen]) groups[entry.screen] = [];
      groups[entry.screen].push(entry);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([screen, entries]) => ({
        screen,
        entries: entries.sort((a, b) => {
          const orderA = rowOrderForKey(a.resource_key);
          const orderB = rowOrderForKey(b.resource_key);
          if (orderA !== orderB) return orderA - orderB;
          return a.resource_key.localeCompare(b.resource_key);
        }),
      }));
  }, [catalog, search, showEnabledOnly]);

  const hasUnsavedChanges = useMemo(() => {
    const currentKeys = Array.from(permissionsMap.keys()).sort();
    const baselineKeys = Array.from(baselineMap.keys()).sort();
    if (currentKeys.length !== baselineKeys.length) return true;
    for (let i = 0; i < currentKeys.length; i += 1) {
      if (currentKeys[i] !== baselineKeys[i]) return true;
    }
    return currentKeys.some((key) => {
      const current = permissionsMap.get(key) || new Set();
      const baseline = baselineMap.get(key) || new Set();
      if (current.size !== baseline.size) return true;
      for (const action of current) {
        if (!baseline.has(action)) return true;
      }
      return false;
    });
  }, [permissionsMap, baselineMap]);

  const loadCatalog = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchUiResourcesCatalog({ username });
    const list = resp?.data?.resources || resp?.response?.data?.resources || [];
    setCatalog(Array.isArray(list) ? list : []);
  };

  const loadRolePolicy = async (slug: string) => {
    const username = currentUsername();
    if (!username || !slug) return;
    setLoadingPolicy(true);
    try {
      const resp = await fetchRolePolicy({ username, role_slug: slug });
      const perms = resp?.data?.permissions || resp?.response?.data?.permissions || [];
      const map = new Map<string, Set<string>>();
      (perms as RolePolicy[]).forEach((perm) => {
        const key = String(perm.resource_key || "").trim().toLowerCase();
        if (!key) return;
        const actions = Array.isArray(perm.actions) ? perm.actions : [];
        map.set(
          key,
          new Set(actions.map((a) => String(a || "").trim().toUpperCase()).filter(Boolean)),
        );
      });
      setPermissionsMap(map);
      setBaselineMap(new Map(map));
    } finally {
      setLoadingPolicy(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    loadRolePolicy(roleSlug);
  }, [roleSlug]);

  const toggleAction = (resourceKey: string, action: string) => {
    setPermissionsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(resourceKey) || new Set();
      if (existing.has(action)) {
        existing.delete(action);
      } else {
        existing.add(action);
      }
      if (existing.size) {
        next.set(resourceKey, new Set(existing));
      } else {
        next.delete(resourceKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username || !roleSlug) return;
    setSaving(true);
    try {
      const permissions = Array.from(permissionsMap.entries()).map(([resource_key, actionsSet]) => ({
        resource_key,
        actions: Array.from(actionsSet),
      }));
      const resp = await updateRolePolicy({ username, role_slug: roleSlug, permissions });
      const description = resp?.response?.description || "Permissions saved.";
      enqueueSnackbar(description, { variant: "success" });
      await loadRolePolicy(roleSlug);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to save permissions.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepUpGuard username={currentUsername() || ""} resourceKey="menu.role_policies">
      <PageContainer title="Role Permission Manager">
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", lg: "center" }}
          >
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontWeight: 700 }}>Role Permission Manager</Typography>
                <Chip size="small" color="default" label="SUPER_ADMIN only" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Manage permissions for each role. SUPER_ADMIN only.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={roleSlug}
                onChange={(event) => setRoleSlug(String(event.target.value))}
              >
                {ROLE_SLUGS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Search permissions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 260 }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={showEnabledOnly}
                onChange={(event) => setShowEnabledOnly(event.target.checked)}
              />
              <Typography variant="body2">Show only enabled</Typography>
            </Stack>
          </Stack>

          {hasUnsavedChanges && (
            <Chip color="warning" label="Unsaved changes" sx={{ alignSelf: "flex-start" }} />
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {groupedResources.map((group) => (
              <Box
                key={group.screen}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{group.screen}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {group.entries.length} permissions
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  {group.entries.map((entry) => (
                    <Box
                      key={entry.resource_key}
                      sx={{
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        p: 1.5,
                      }}
                    >
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 600 }}>
                            {friendlyLabel(entry.resource_key, entry.element)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {entry.resource_key}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {entry.actions.map((action) => {
                            const checked = permissionsMap.get(entry.resource_key)?.has(action) || false;
                            const color = ACTION_COLORS[action] || "default";
                            return (
                              <Box key={action} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  onChange={() => toggleAction(entry.resource_key, action)}
                                />
                                <Chip
                                  size="small"
                                  label={action}
                                  color={color}
                                  variant={checked ? "filled" : "outlined"}
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>

        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            mt: 3,
            py: 2,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="contained" onClick={handleSave} disabled={saving || loadingPolicy}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </PageContainer>
    </StepUpGuard>
  );
};

function prettifyScreenFromKey(key: string): string {
  const prefix = key.split(".")[0] || "Other";
  return prefix
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rowOrderForKey(key: string): number {
  const suffix = key.split(".").slice(-1)[0] || "";
  const idx = ROW_ORDER.indexOf(suffix);
  return idx === -1 ? ROW_ORDER.length : idx;
}

function friendlyLabel(resourceKey: string, element?: string): string {
  const suffix = resourceKey.split(".").slice(-1)[0] || "";
  if (suffix === "menu") return "Menu";
  if (suffix === "list") return "List";
  if (suffix === "detail" || suffix === "view") return "Detail";
  if (suffix === "create") return "Create";
  if (suffix === "edit" || suffix === "update") return "Edit";
  if (suffix === "deactivate") return "Deactivate";
  if (suffix) {
    return suffix
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return element || resourceKey;
}
