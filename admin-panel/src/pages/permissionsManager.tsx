import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
  action_code?: string;
  ui_type?: string;
  route?: string | null;
  label_i18n?: Record<string, string>;
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
  const [saving, setSaving] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [permissionsMap, setPermissionsMap] = useState<Map<string, Set<string>>>(new Map());

  const groupedResources = useMemo(() => {
    const map = new Map<
      string,
      { resource_key: string; screen: string; actions: Set<string>; label?: string }
    >();
    catalog.forEach((entry) => {
      const key = String(entry.resource_key || "").trim().toLowerCase();
      if (!key) return;
      const screen = entry.screen || "Other";
      if (!map.has(key)) {
        map.set(key, {
          resource_key: key,
          screen,
          actions: new Set(),
          label: entry.label_i18n?.en || entry.label_i18n?.hi || undefined,
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
    const filtered = filter
      ? list.filter(
          (entry) =>
            entry.resource_key.includes(filter) ||
            entry.screen.toLowerCase().includes(filter) ||
            (entry.label || "").toLowerCase().includes(filter),
        )
      : list;

    const groups: Record<string, typeof list> = {};
    filtered.forEach((entry) => {
      if (!groups[entry.screen]) groups[entry.screen] = [];
      groups[entry.screen].push(entry);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([screen, entries]) => ({
        screen,
        entries: entries.sort((a, b) => a.resource_key.localeCompare(b.resource_key)),
      }));
  }, [catalog, search]);

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
      <PageContainer title="Permissions Manager">
        <Typography sx={{ color: "text.secondary", mt: -1 }}>
          Manage role permissions using the UI resources catalog.
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
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
              label="Search resource"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 240 }}
            />
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleSave} disabled={saving || loadingPolicy}>
              {saving ? "Saving..." : "Save Permissions"}
            </Button>
          </Stack>

          {groupedResources.map((group) => (
            <Box key={group.screen} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>{group.screen}</Typography>
              <Stack spacing={1}>
                {group.entries.map((entry) => (
                  <Box
                    key={entry.resource_key}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(240px, 2fr) repeat(4, minmax(90px, 1fr))",
                      gap: 1,
                      alignItems: "center",
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{entry.resource_key}</Typography>
                      {entry.label && (
                        <Typography variant="caption" color="text.secondary">
                          {entry.label}
                        </Typography>
                      )}
                    </Box>
                    {ACTION_ORDER.map((action) => {
                      const allowed = entry.actions.includes(action);
                      if (!allowed) return <Box key={action} />;
                      const checked = permissionsMap.get(entry.resource_key)?.has(action) || false;
                      return (
                        <Box key={action} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={checked}
                            onChange={() => toggleAction(entry.resource_key, action)}
                          />
                          <Typography variant="caption">{action}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </PageContainer>
    </StepUpGuard>
  );
};
