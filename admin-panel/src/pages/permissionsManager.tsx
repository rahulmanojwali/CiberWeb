import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
  parent_resource_key?: string | null;
  order?: number;
  label_i18n?: Record<string, string>;
  is_active?: boolean | string;
};

type RolePolicy = {
  resource_key: string;
  actions: string[];
};

type CatalogEntry = UiResource & {
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

const ACTION_ORDER = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DEACTIVATE",
  "DELETE",
  "RESET_PASSWORD",
  "UPDATE_STATUS",
  "BULK_UPLOAD",
  "APPROVE",
  "REJECT",
  "REQUEST_MORE_INFO",
];

const ROW_ORDER = ["menu", "list", "detail", "view", "create", "edit", "update", "deactivate"];

const ACTION_COLORS: Record<string, "default" | "primary" | "success" | "warning" | "error"> = {
  VIEW: "primary",
  CREATE: "success",
  UPDATE: "warning",
  DEACTIVATE: "error",
  DELETE: "error",
  RESET_PASSWORD: "warning",
  UPDATE_STATUS: "warning",
  BULK_UPLOAD: "success",
  APPROVE: "success",
  REJECT: "error",
  REQUEST_MORE_INFO: "warning",
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

function normalizeKey(key: string): string {
  return String(key || "").trim().toLowerCase();
}

function normalizeAction(action: string): string {
  return String(action || "").trim().toUpperCase();
}

function cloneMapOfSets(source: Map<string, Set<string>>): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();
  for (const [k, set] of source.entries()) {
    next.set(k, new Set(Array.from(set)));
  }
  return next;
}

/**
 * Diff count between maps (row-level)
 */
function computeDiffCount(
  permissionsMap: Map<string, Set<string>>,
  baselineMap: Map<string, Set<string>>,
): number {
  const allKeys = new Set([...permissionsMap.keys(), ...baselineMap.keys()]);
  let changed = 0;

  for (const key of allKeys) {
    const a = permissionsMap.get(key) || new Set<string>();
    const b = baselineMap.get(key) || new Set<string>();

    if (a.size !== b.size) {
      changed += 1;
      continue;
    }
    for (const action of a) {
      if (!b.has(action)) {
        changed += 1;
        break;
      }
    }
  }
  return changed;
}

/**
 * Normalize selected actions against allowed actions.
 * - auto-maps UPDATE <-> UPDATE_STATUS when needed
 * - drops anything not allowed by catalog
 * - NEVER blocks save
 */
function normalizeActionsForSave(
  resourceKey: string,
  selected: string[],
  allowed: Set<string>,
): { actions: string[]; dropped: string[]; mapped: Array<{ from: string; to: string }> } {
  const picked = new Set<string>(selected.map(normalizeAction).filter(Boolean));
  const mapped: Array<{ from: string; to: string }> = [];
  const dropped: string[] = [];

  const swapIfNeeded = (from: string, to: string) => {
    if (picked.has(from) && !allowed.has(from) && allowed.has(to)) {
      picked.delete(from);
      picked.add(to);
      mapped.push({ from, to });
    }
  };

  // status-change actions vary by master
  swapIfNeeded("UPDATE", "UPDATE_STATUS");
  swapIfNeeded("UPDATE_STATUS", "UPDATE");

  const final: string[] = [];
  Array.from(picked).forEach((a) => {
    if (allowed.has(a)) final.push(a);
    else dropped.push(a);
  });

  return { actions: final, dropped, mapped };
}

export const PermissionsManager: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [catalog, setCatalog] = useState<UiResource[]>([]);
  const [roleSlug, setRoleSlug] = useState<string>("SUPER_ADMIN");
  const [search, setSearch] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"granted" | "all" | "missing">("granted");
  const [hideEmptyModules, setHideEmptyModules] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  const [permissionsMap, setPermissionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [baselineMap, setBaselineMap] = useState<Map<string, Set<string>>>(new Map());

  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const moduleOrderRef = useRef<string[]>([]);

  const allowedActionsByKey = useMemo(() => {
    const map = new Map<string, Set<string>>();
    catalog.forEach((entry) => {
      const key = normalizeKey(entry.resource_key);
      if (!key) return;
      const action = normalizeAction(entry.action_code || "");
      if (!action) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(action);
    });
    return map;
  }, [catalog]);

  const diffCount = useMemo(
    () => computeDiffCount(permissionsMap, baselineMap),
    [permissionsMap, baselineMap],
  );

  const hasUnsavedChanges = diffCount > 0;

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
        parent_resource_key?: string | null;
        order?: number;
      }
    >();
    const allowedUiTypes = new Set([
      "menu",
      "table",
      "dialog",
      "button",
      "widget",
      "page",
      "screen",
      "tab",
    ]);
    const isActive = (entry: UiResource) => entry.is_active === true || entry.is_active === "Y";
    const isAllowedUiType = (entry: UiResource) => {
      const type = String(entry.ui_type || "").toLowerCase();
      return allowedUiTypes.has(type);
    };

    const labelByKey = new Map<string, string>();
    catalog.forEach((entry) => {
      if (!isActive(entry) || !isAllowedUiType(entry)) return;
      const key = normalizeKey(entry.resource_key);
      if (!key) return;
      const label =
        entry.label_i18n?.en ||
        entry.label_i18n?.hi ||
        entry.element ||
        friendlyLabel(key, entry.element);
      if (!labelByKey.has(key)) labelByKey.set(key, label);
    });

    catalog.forEach((entry) => {
      if (!isActive(entry) || !isAllowedUiType(entry)) return;
      const key = normalizeKey(entry.resource_key);
      if (!key) return;

      const screen = entry.screen || prettifyScreenFromKey(key);
      const parentKey = entry.parent_resource_key || null;
      const parsedOrder = Number(entry.order);
      const order = Number.isFinite(parsedOrder) ? parsedOrder : undefined;

      if (!map.has(key)) {
        map.set(key, {
          resource_key: key,
          screen,
          actions: new Set(),
          label: entry.label_i18n?.en || entry.label_i18n?.hi || undefined,
          element: entry.element,
          is_active: entry.is_active,
          parent_resource_key: parentKey,
          order,
        });
      } else if (order !== undefined) {
        const existing = map.get(key);
        if (existing && (existing.order === undefined || order < existing.order)) {
          existing.order = order;
        }
      }

      const action = normalizeAction(entry.action_code || "");
      if (action) map.get(key)!.actions.add(action);
    });

    const list: CatalogEntry[] = Array.from(map.values()).map((entry) => ({
      ...entry,
      actions: Array.from(entry.actions).sort((a, b) => {
        const idxA = ACTION_ORDER.indexOf(a);
        const idxB = ACTION_ORDER.indexOf(b);
        const rankA = idxA === -1 ? ACTION_ORDER.length : idxA;
        const rankB = idxB === -1 ? ACTION_ORDER.length : idxB;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      }),
    }));

    const filter = search.trim().toLowerCase();

    const groups: Record<
      string,
      {
        entries: CatalogEntry[];
        title: string;
      }
    > = {};

    list.forEach((entry) => {
      const groupKey = buildGroupKey(entry);
      if (!groups[groupKey]) {
        groups[groupKey] = {
          entries: [],
          title: buildGroupTitle(entry, labelByKey),
        };
      }
      groups[groupKey].entries.push(entry);
    });

    const groupList = Object.entries(groups).map(([groupKey, data]) => {
      const rows = data.entries;

      const total = rows.length;

      const granted = rows.reduce((count, entry) => {
        const actions = permissionsMap.get(entry.resource_key);
        return count + (actions && actions.size ? 1 : 0);
      }, 0);

      const hasList = rows.some((entry) => {
        const suffix = entry.resource_key.split(".").slice(-1)[0] || "";
        if (suffix !== "list") return false;
        const actions = permissionsMap.get(entry.resource_key);
        return Boolean(actions && actions.has("VIEW"));
      });

      const hasCreate = rows.some((entry) => {
        const actions = permissionsMap.get(entry.resource_key);
        return Boolean(actions && actions.has("CREATE"));
      });

      const matchesGroup = filter ? data.title.toLowerCase().includes(filter) : false;

      const filteredRows = rows.filter((entry) => {
        const actions = permissionsMap.get(entry.resource_key);
        const isGranted = Boolean(actions && actions.size);

        if (filterMode === "granted" && !isGranted) return false;
        if (filterMode === "missing" && isGranted) return false;

        if (!filter) return true;
        if (matchesGroup) return true;

        const label = friendlyLabel(entry.resource_key, entry.element).toLowerCase();
        const screenText = (entry.screen || "").toLowerCase();
        const labelText = (entry.label_i18n?.en || entry.label_i18n?.hi || "").toLowerCase();
        const elementText = (entry.element || "").toLowerCase();

        return (
          entry.resource_key.includes(filter) ||
          screenText.includes(filter) ||
          labelText.includes(filter) ||
          elementText.includes(filter) ||
          label.includes(filter)
        );
      });

      return {
        key: groupKey,
        title: data.title,
        total,
        granted,
        listWarning: hasCreate && !hasList,
        allEntries: rows,
        entries: filteredRows.sort((a, b) => {
          const orderA = typeof a.order === "number" ? a.order : rowOrderForKey(a.resource_key);
          const orderB = typeof b.order === "number" ? b.order : rowOrderForKey(b.resource_key);
          if (orderA !== orderB) return orderA - orderB;
          return a.resource_key.localeCompare(b.resource_key);
        }),
        order: rows.reduce((min, entry) => {
          if (typeof entry.order !== "number") return min;
          return min === null || entry.order < min ? entry.order : min;
        }, null as number | null),
      };
    });

    const order = moduleOrderRef.current;

    return groupList
      .filter((group) => {
        if (!group.total) return false;
        if (filterMode === "granted") return group.granted > 0 && group.entries.length > 0;
        if (filterMode === "missing") return group.granted < group.total && group.entries.length > 0;
        if (hideEmptyModules && !filter) return group.granted > 0 && group.entries.length > 0;
        return group.entries.length > 0;
      })
      .sort((a, b) => {
        if (typeof a.order === "number" || typeof b.order === "number") {
          const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
        }
        const idxA = order.indexOf(a.key);
        const idxB = order.indexOf(b.key);
        if (idxA !== -1 || idxB !== -1) {
          return (idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA) -
            (idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB);
        }
        return a.title.localeCompare(b.title);
      });
  }, [catalog, filterMode, hideEmptyModules, permissionsMap, search]);

  const loadCatalog = async () => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
      return;
    }
    const resp = await fetchUiResourcesCatalog({ username });
    const list = resp?.data?.resources || resp?.response?.data?.resources || [];
    setCatalog(Array.isArray(list) ? list : []);
  };

  const loadRolePolicy = async (slug: string) => {
    const username = currentUsername();
    if (!username || !slug) {
      enqueueSnackbar("Session missing or role not selected.", { variant: "error" });
      return;
    }

    setLoadingPolicy(true);
    try {
      const resp = await fetchRolePolicy({ username, role_slug: slug });
      const perms = resp?.data?.permissions || resp?.response?.data?.permissions || [];

      const map = new Map<string, Set<string>>();
      (perms as RolePolicy[]).forEach((perm) => {
        const key = normalizeKey(perm.resource_key);
        if (!key) return;
        const actions = Array.isArray(perm.actions) ? perm.actions : [];
        map.set(key, new Set(actions.map((a) => normalizeAction(a)).filter(Boolean)));
      });

      const cloned = cloneMapOfSets(map);
      setPermissionsMap(cloned);
      setBaselineMap(cloneMapOfSets(cloned));
    } finally {
      setLoadingPolicy(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRolePolicy(roleSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleSlug]);

  useEffect(() => {
    if (moduleOrderRef.current.length || !catalog.length) return;
    const groups = new Set<string>();
    catalog.forEach((entry) => {
      const key = normalizeKey(entry.resource_key);
      if (!key) return;
      groups.add(buildGroupKey(entry));
    });
    moduleOrderRef.current = Array.from(groups).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  useEffect(() => {
    setExpandedModule(null);
  }, [search]);

  const toggleAction = (resourceKey: string, action: string) => {
    setPermissionsMap((prev) => {
      const next = new Map(prev);
      const existingPrev = next.get(resourceKey);
      const existing = new Set(existingPrev ? Array.from(existingPrev) : []);
      if (existing.has(action)) {
        existing.delete(action);
      } else {
        existing.add(action);
      }
      if (existing.size) next.set(resourceKey, existing);
      else next.delete(resourceKey);
      return next;
    });
  };

  const setModuleAction = (entries: CatalogEntry[], actionsToSet: string[], enabled: boolean) => {
    setPermissionsMap((prev) => {
      const next = new Map(prev);

      entries.forEach((entry) => {
        const hasAny = actionsToSet.some((action) => entry.actions.includes(action));
        if (!hasAny) return;

        const prevSet = next.get(entry.resource_key);
        const existing = new Set(prevSet ? Array.from(prevSet) : []);

        actionsToSet.forEach((action) => {
          if (!entry.actions.includes(action)) return;
          if (enabled) existing.add(action);
          else existing.delete(action);
        });

        if (existing.size) next.set(entry.resource_key, existing);
        else next.delete(entry.resource_key);
      });

      return next;
    });
  };

  const clearModule = (entries: CatalogEntry[]) => {
    setPermissionsMap((prev) => {
      const next = new Map(prev);
      entries.forEach((entry) => next.delete(entry.resource_key));
      return next;
    });
  };

  /**
   * Save flow:
   * - show proof alerts at key steps (remove once stable)
   * - never block on catalog mismatch; map/drop and continue
   */
  const handleSave = async () => {
    //alert("A: SAVE CLICKED");

    const username = currentUsername();
  // //  alert(
  //     `B: username=${String(username)} role=${String(roleSlug)} diff=${diffCount} saving=${String(
  //       saving,
  //     )} loadingPolicy=${String(loadingPolicy)}`,
  //   );
``
    if (!username || !roleSlug) {
      enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
      return;
    }

    if (!hasUnsavedChanges) {
      enqueueSnackbar("No changes to save.", { variant: "info" });
      return;
    }

    setSaving(true);
    try {
      //alert("C: building permissions payload");
      const permissions: Array<{ resource_key: string; actions: string[] }> = [];
      const droppedSummary: Array<{ resource_key: string; dropped: string[] }> = [];
      const mappedSummary: Array<{ resource_key: string; mapped: Array<{ from: string; to: string }> }> = [];

      for (const [resource_key_raw, actionsSet] of permissionsMap.entries()) {
        const resource_key = normalizeKey(resource_key_raw);
        const allowed = allowedActionsByKey.get(resource_key) || new Set<string>();

        const selected = Array.from(actionsSet);
        const { actions, dropped, mapped } = normalizeActionsForSave(resource_key, selected, allowed);

        if (mapped.length) mappedSummary.push({ resource_key, mapped });
        if (dropped.length) droppedSummary.push({ resource_key, dropped });

        if (actions.length) permissions.push({ resource_key, actions });
      }

      // Debug: log but DO NOT block
      // eslint-disable-next-line no-console
      console.log("[SAVE_DEBUG] mappedSummary", mappedSummary);
      // eslint-disable-next-line no-console
      console.log("[SAVE_DEBUG] droppedSummary", droppedSummary);

      if (droppedSummary.length) {
        enqueueSnackbar(
          `⚠️ Some actions were ignored because they are not allowed by the master catalog (${droppedSummary.length} rows).`,
          { variant: "warning" },
        );
      }

      //alert(`D: payload built permissionsCount=${permissions.length}`);

      const payload: any = {
        api: "updateRolePolicies",
        api_name: "updateRolePolicies",
        username,
        role_slug: roleSlug,
        permissions,
        _client_nonce: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      };

     // alert("E: ABOUT TO CALL API updateRolePolicy()");
      const resp: any = await updateRolePolicy(payload);
     // alert("F: API RETURNED");

      // eslint-disable-next-line no-console
      console.log("[SAVE_DEBUG] updateRolePolicy resp", resp);

      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;

      if (rc !== undefined && String(rc) !== "0") {
        enqueueSnackbar(desc || "Save failed.", { variant: "error" });
        return;
      }

      enqueueSnackbar("Permissions updated successfully.", { variant: "success" });

      // snapshot baseline
      setBaselineMap(cloneMapOfSets(permissionsMap));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[SAVE_DEBUG] error", err);
      enqueueSnackbar(err?.message || "Failed to save permissions.", { variant: "error" });
    } finally {
      //alert("G: finally (saving=false)");
      setSaving(false);
    }
  };

  return (
    <StepUpGuard
      username={currentUsername() || ""}
      resourceKey="role_policies.view"
      action="VIEW"
    >
      <PageContainer title="Role Permission Manager">
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Sticky top filters (kept as-is) */}
          <Box
            sx={{
              position: "sticky",
              top: 64,
              zIndex: 2,
              bgcolor: "background.default",
              pb: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }}>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 700 }}>Role Permission Manager</Typography>
                  <Chip size="small" color="default" label="SUPER_ADMIN only" />
                  <Chip
                    size="small"
                    color={hasUnsavedChanges ? "warning" : "default"}
                    label={`diff=${diffCount}`}
                  />
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

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Filter</InputLabel>
                <Select
                  label="Filter"
                  value={filterMode}
                  onChange={(event) =>
                    setFilterMode(event.target.value as "granted" | "all" | "missing")
                  }
                >
                  <MenuItem value="granted">Granted only</MenuItem>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="missing">Missing only</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Search permissions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ minWidth: { xs: "100%", lg: 320 } }}
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <Switch
                  size="small"
                  checked={hideEmptyModules}
                  onChange={(event) => setHideEmptyModules(event.target.checked)}
                />
                <Typography variant="body2">Hide empty modules</Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Modules */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 2,
              alignItems: "start",
              pb: 12, // space for fixed footer
            }}
          >
            {groupedResources.map((group) => (
              <Accordion
                key={group.key}
                expanded={expandedModule === group.key}
                onChange={() =>
                  setExpandedModule(expandedModule === group.key ? null : group.key)
                }
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  alignSelf: "start",
                  overflow: "hidden",
                }}
              >
                {/* IMPORTANT: AccordionSummary renders a BUTTON.
                    Do NOT put <Button> inside it (nested button error).
                    Actions are moved to details header below. */}
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    bgcolor: "grey.50",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{group.title}</Typography>
                    <Chip size="small" variant="outlined" label={`${group.granted}/${group.total}`} />
                    {group.listWarning && <Chip size="small" color="warning" label="List missing" />}
                  </Stack>
                </AccordionSummary>

                <AccordionDetails
                  sx={{ p: 1.25, maxHeight: 520, overflow: "auto" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* Module actions (safe here; no nested button) */}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      bgcolor: "background.paper",
                      py: 0.5,
                      mb: 1,
                      borderBottom: "1px dashed",
                      borderColor: "divider",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      sx={{ color: "text.secondary" }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setModuleAction(group.allEntries, ["VIEW"], true);
                      }}
                    >
                      Grant VIEW all
                    </Button>

                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      sx={{ color: "error.main" }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        clearModule(group.allEntries);
                      }}
                    >
                      Clear module
                    </Button>
                  </Stack>

                  <Stack spacing={1.5}>
                    {group.entries.map((entry) => (
                      <Box
                        key={entry.resource_key}
                        onClick={(event) => event.stopPropagation()}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", sm: "minmax(120px, 180px) 1fr auto" },
                          gap: 0.75,
                          alignItems: "center",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          py: 0.75,
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Typography sx={{ fontWeight: 600, minWidth: 120 }}>
                          {friendlyLabel(entry.resource_key, entry.element)}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: "monospace" }}
                        >
                          {entry.resource_key}
                        </Typography>

                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 0.5,
                            maxWidth: 220,
                          }}
                        >
                          {entry.actions.map((action) => {
                            const checked = permissionsMap.get(entry.resource_key)?.has(action) || false;
                            const color = ACTION_COLORS[action] || "default";
                            const isDanger = ["DEACTIVATE", "DELETE", "REJECT"].includes(action);
                            const variant = isDanger ? "filled" : "outlined";
                            const labelText = action.split("_").join(" ");

                            return (
                              <Box
                                key={action}
                                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    toggleAction(entry.resource_key, action);
                                  }}
                                />

                                <Chip
                                  size="small"
                                  label={labelText}
                                  color={color}
                                  variant={variant}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleAction(entry.resource_key, action);
                                  }}
                                  sx={{
                                    px: 0.75,
                                    height: 22,
                                    fontSize: 12,
                                    maxWidth: 140,
                                    "& .MuiChip-label": {
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    },
                                  }}
                                />
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Stack>

        {/* Fixed footer Save bar */}
        <Box
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            py: 1.5,
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: { xs: 2, md: 3 },
            zIndex: 10,
          }}
        >
          {hasUnsavedChanges ? <Chip color="warning" label="● Unsaved changes" /> : <Box />}
          <Button
            variant="contained"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
            disabled={saving || loadingPolicy}
          >
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
  if (suffix === "detail" || suffix === "view" || suffix === "view_detail") return "Detail";
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

function buildGroupKey(entry: UiResource): string {
  const key = normalizeKey(entry.resource_key);
  const screen = entry.screen || prettifyScreenFromKey(key);
  const parentKey = normalizeKey(entry.parent_resource_key || "");
  return parentKey ? `${screen}::${parentKey}` : `${screen}::`;
}

function buildGroupTitle(entry: UiResource, labelByKey: Map<string, string>): string {
  const key = normalizeKey(entry.resource_key);
  const screen = entry.screen || prettifyScreenFromKey(key);
  const parentKey = normalizeKey(entry.parent_resource_key || "");
  if (!parentKey) return screen;
  const parentLabel = labelByKey.get(parentKey) || friendlyLabel(parentKey);
  return `${screen} / ${parentLabel}`;
}



// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   Accordion,
//   AccordionDetails,
//   AccordionSummary,
//   Box,
//   Button,
//   Checkbox,
//   Chip,
//   FormControl,
//   InputLabel,
//   MenuItem,
//   Select,
//   Stack,
//   Switch,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useSnackbar } from "notistack";
// import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
// import { PageContainer } from "../components/PageContainer";
// import { StepUpGuard } from "../components/StepUpGuard";
// import {
//   fetchRolePolicy,
//   fetchUiResourcesCatalog,
//   updateRolePolicy,
// } from "../services/rolePoliciesApi";

// type UiResource = {
//   resource_key: string;
//   screen?: string;
//   element?: string;
//   action_code?: string;
//   ui_type?: string;
//   route?: string | null;
//   label_i18n?: Record<string, string>;
//   is_active?: boolean | string;
// };
//   const [catalog, setCatalog] = useState<UiResource[]>([]);
//   const [roleSlug, setRoleSlug] = useState<string>("SUPER_ADMIN");
//   const [search, setSearch] = useState<string>("");
//   const [filterMode, setFilterMode] = useState<"granted" | "all" | "missing">("granted");
//   const [hideEmptyModules, setHideEmptyModules] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [loadingPolicy, setLoadingPolicy] = useState(false);
//   const [permissionsMap, setPermissionsMap] = useState<Map<string, Set<string>>>(new Map());
//   const [baselineMap, setBaselineMap] = useState<Map<string, Set<string>>>(new Map());
//   const [expandedModule, setExpandedModule] = useState<string | null>(null);
//   const moduleOrderRef = useRef<string[]>([]);
//   const loggedUsernameRef = useRef(false);

//   const groupedResources = useMemo(() => {
//     const map = new Map<
//       string,
//       {
//         resource_key: string;
//         screen: string;
//         actions: Set<string>;
//         label?: string;
//         element?: string;
//         is_active?: boolean | string;
//       }
//     >();
//     catalog.forEach((entry) => {
//       const key = String(entry.resource_key || "").trim().toLowerCase();
//       if (!key) return;
//       const screen = entry.screen || prettifyScreenFromKey(key);
//       if (!map.has(key)) {
//         map.set(key, {
//           resource_key: key,
//           screen,
//           actions: new Set(),
//           label: entry.label_i18n?.en || entry.label_i18n?.hi || undefined,
//           element: entry.element,
//           is_active: entry.is_active,
//         });
//       }
//       const action = String(entry.action_code || "").trim().toUpperCase();
//       if (action) map.get(key)!.actions.add(action);
//     });

//     const list: CatalogEntry[] = Array.from(map.values()).map((entry) => ({
//       ...entry,
//       actions: Array.from(entry.actions).sort((a, b) => {
//         const idxA = ACTION_ORDER.indexOf(a);
//         const idxB = ACTION_ORDER.indexOf(b);
//         const rankA = idxA === -1 ? ACTION_ORDER.length : idxA;
//         const rankB = idxB === -1 ? ACTION_ORDER.length : idxB;
//         if (rankA !== rankB) return rankA - rankB;
//         return a.localeCompare(b);
//       }),
//     }));

//     const filter = search.trim().toLowerCase();
//     const visibleList = list;

//     const groups: Record<
//       string,
//       {
//         entries: CatalogEntry[];
//         title: string;
//       }
//     > = {};

//     visibleList.forEach((entry) => {
//       const prefix = entry.resource_key.startsWith("menu.")
//         ? entry.resource_key.split(".")[1] || "other"
//         : entry.resource_key.split(".")[0] || "other";
//       if (!groups[prefix]) {
//         groups[prefix] = {
//           entries: [],
//           title: prettifyScreenFromKey(prefix),
//         };
//       }
//       groups[prefix].entries.push(entry);
//     });

//     const groupList = Object.entries(groups).map(([prefix, data]) => {
//       const allEntries = data.entries;
//       const rows = allEntries.filter(
//         (entry) => !entry.resource_key.endsWith(".menu") && !entry.resource_key.startsWith("menu."),
//       );
//       const total = rows.length;
//       const granted = rows.reduce((count, entry) => {
//         const actions = permissionsMap.get(entry.resource_key);
//         return count + (actions && actions.size ? 1 : 0);
//       }, 0);
//       const hasList = rows.some((entry) => {
//         const suffix = entry.resource_key.split(".").slice(-1)[0] || "";
//         if (suffix !== "list") return false;
//         const actions = permissionsMap.get(entry.resource_key);
//         return Boolean(actions && actions.has("VIEW"));
//       });
//       const hasCreate = rows.some((entry) => {
//         const actions = permissionsMap.get(entry.resource_key);
//         return Boolean(actions && actions.has("CREATE"));
//       });

//       const matchesGroup = filter
//         ? data.title.toLowerCase().includes(filter)
//         : false;

//       const filteredRows = rows.filter((entry) => {
//         const actions = permissionsMap.get(entry.resource_key);
//         const isGranted = Boolean(actions && actions.size);
//         if (filterMode === "granted" && !isGranted) return false;
//         if (filterMode === "missing" && isGranted) return false;
//         if (!filter) return true;
//         if (matchesGroup) return true;
//         const label = friendlyLabel(entry.resource_key, entry.element).toLowerCase();
//         const screenText = (entry.screen || "").toLowerCase();
//         const labelText = (entry.label_i18n?.en || entry.label_i18n?.hi || "").toLowerCase();
//         const elementText = (entry.element || "").toLowerCase();
//         return (
//           entry.resource_key.includes(filter) ||
//           screenText.includes(filter) ||
//           labelText.includes(filter) ||
//           elementText.includes(filter) ||
//           label.includes(filter)
//         );
//       });

//       return {
//         key: prefix,
//         title: data.title,
//         total,
//         granted,
//         listWarning: hasCreate && !hasList,
//         allEntries: rows,
//         entries: filteredRows.sort((a, b) => {
//           const orderA = rowOrderForKey(a.resource_key);
//           const orderB = rowOrderForKey(b.resource_key);
//           if (orderA !== orderB) return orderA - orderB;
//           return a.resource_key.localeCompare(b.resource_key);
//         }),
//       };
//     });

//     const order = moduleOrderRef.current;
//     return groupList
//       .filter((group) => {
//         if (!group.total) return false;
//         if (filterMode === "granted") return group.granted > 0 && group.entries.length > 0;
//         if (filterMode === "missing") return group.granted < group.total && group.entries.length > 0;
//         if (hideEmptyModules && !filter) return group.granted > 0 && group.entries.length > 0;
//         return group.entries.length > 0;
//       })
//       .sort((a, b) => {
//         const idxA = order.indexOf(a.key);
//         const idxB = order.indexOf(b.key);
//         if (idxA !== -1 || idxB !== -1) {
//           return (idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA) -
//             (idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB);
//         }
//         return a.title.localeCompare(b.title);
//       });
//   }, [catalog, filterMode, hideEmptyModules, permissionsMap, search]);

//   const hasUnsavedChanges = useMemo(() => {
//     const currentKeys = Array.from(permissionsMap.keys()).sort();
//     const baselineKeys = Array.from(baselineMap.keys()).sort();
//     if (currentKeys.length !== baselineKeys.length) return true;
//     for (let i = 0; i < currentKeys.length; i += 1) {
//       if (currentKeys[i] !== baselineKeys[i]) return true;
//     }
//     return currentKeys.some((key) => {
//       const current = permissionsMap.get(key) || new Set();
//       const baseline = baselineMap.get(key) || new Set();
//       if (current.size !== baseline.size) return true;
//       for (const action of current) {
//         if (!baseline.has(action)) return true;
//       }
//       return false;
//     });
//   }, [permissionsMap, baselineMap]);

//   const loadCatalog = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     const resp = await fetchUiResourcesCatalog({ username });
//     const list = resp?.data?.resources || resp?.response?.data?.resources || [];
//     setCatalog(Array.isArray(list) ? list : []);
//   };

//   const loadRolePolicy = async (slug: string) => {
//     const username = currentUsername();
//     if (!username || !slug) return;
//     setLoadingPolicy(true);
//     try {
//       const resp = await fetchRolePolicy({ username, role_slug: slug });
//       const perms = resp?.data?.permissions || resp?.response?.data?.permissions || [];
//       const map = new Map<string, Set<string>>();
//       (perms as RolePolicy[]).forEach((perm) => {
//         const key = String(perm.resource_key || "").trim().toLowerCase();
//         if (!key) return;
//         const actions = Array.isArray(perm.actions) ? perm.actions : [];
//         map.set(
//           key,
//           new Set(actions.map((a) => String(a || "").trim().toUpperCase()).filter(Boolean)),
//         );
//       });
//       setPermissionsMap(map);
//       setBaselineMap(new Map(map));
//     } finally {
//       setLoadingPolicy(false);
//     }
//   };

//   useEffect(() => {
//     loadCatalog();
//   }, []);

//   useEffect(() => {
//     loadRolePolicy(roleSlug);
//   }, [roleSlug]);

//   useEffect(() => {
//     if (loggedUsernameRef.current) return;
//     loggedUsernameRef.current = true;
//     console.log("RBAC username:", currentUsername());
//   }, []);

//   useEffect(() => {
//     if (moduleOrderRef.current.length || !catalog.length) return;
//     const prefixes = new Set<string>();
//     catalog.forEach((entry) => {
//       const key = String(entry.resource_key || "").trim().toLowerCase();
//       if (!key) return;
//       const prefix = key.startsWith("menu.")
//         ? key.split(".")[1] || "other"
//         : key.split(".")[0] || "other";
//       prefixes.add(prefix);
//     });
//     moduleOrderRef.current = Array.from(prefixes).sort((a, b) => a.localeCompare(b));
//   }, [catalog]);

//   useEffect(() => {
//     setExpandedModule(null);
//   }, [search]);

//   const toggleAction = (resourceKey: string, action: string) => {
//     setPermissionsMap((prev) => {
//       const next = new Map(prev);
//       const existing = next.get(resourceKey) || new Set();
//       if (existing.has(action)) {
//         existing.delete(action);
//       } else {
//         existing.add(action);
//       }
//       if (existing.size) {
//         next.set(resourceKey, new Set(existing));
//       } else {
//         next.delete(resourceKey);
//       }
//       return next;
//     });
//   };

//   const setModuleAction = (entries: CatalogEntry[], actionsToSet: string[], enabled: boolean) => {
//     setPermissionsMap((prev) => {
//       const next = new Map(prev);
//       entries.forEach((entry) => {
//         const hasAny = actionsToSet.some((action) => entry.actions.includes(action));
//         if (!hasAny) return;
//         const existing = next.get(entry.resource_key) || new Set<string>();
//         actionsToSet.forEach((action) => {
//           if (!entry.actions.includes(action)) return;
//           if (enabled) {
//             existing.add(action);
//           } else {
//             existing.delete(action);
//           }
//         });
//         if (existing.size) {
//           next.set(entry.resource_key, new Set(existing));
//         } else {
//           next.delete(entry.resource_key);
//         }
//       });
//       return next;
//     });
//   };

//   const clearModule = (entries: CatalogEntry[]) => {
//     setPermissionsMap((prev) => {
//       const next = new Map(prev);
//       entries.forEach((entry) => {
//         next.delete(entry.resource_key);
//       });
//       return next;
//     });
//   };

//   const allowedActionsByKey = useMemo(() => {
//     const map = new Map<string, Set<string>>();
//     catalog.forEach((entry) => {
//       const key = String(entry.resource_key || "").trim().toLowerCase();
//       if (!key) return;
//       const action = String(entry.action_code || "").trim().toUpperCase();
//       if (!action) return;
//       if (!map.has(key)) map.set(key, new Set());
//       map.get(key)!.add(action);
//     });
//     return map;
//   }, [catalog]);

//   const handleSave = async () => {
//     const username = currentUsername();
//     if (!username || !roleSlug) {
//       enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
//       return;
//     }
//     setSaving(true);
//     try {
//       const permissions = [];
//       for (const [resource_key, actionsSet] of permissionsMap.entries()) {
//         const allowed = allowedActionsByKey.get(resource_key) || new Set<string>();
//         const checked = Array.from(actionsSet);
//         const invalid = checked.filter((action) => !allowed.has(action));
//         if (invalid.length) {
//           const allowedList = Array.from(allowed).join(", ") || "none";
//           enqueueSnackbar(
//             `Invalid action selected for ${resource_key}. Allowed: ${allowedList}.`,
//             { variant: "error" },
//           );
//           setSaving(false);
//           return;
//         }
//         const actions = checked.filter((action) => allowed.has(action));
//         if (actions.length) {
//           permissions.push({ resource_key, actions });
//         }
//       }
//       const resp = await updateRolePolicy({ username, role_slug: roleSlug, permissions });
//       const description = resp?.response?.description || "Permissions updated successfully.";
//       enqueueSnackbar(description, { variant: "success" });
//       setBaselineMap(new Map(permissionsMap));
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Failed to save permissions.", { variant: "error" });
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <StepUpGuard
//       username={currentUsername() || ""}
//       resourceKey="role_policies.view"
//       action="VIEW"
//     >
//       <PageContainer title="Role Permission Manager">
//         <Stack spacing={2} sx={{ mt: 1 }}>
//           <Box
//             sx={{
//               position: "sticky",
//               top: 64,
//               zIndex: 2,
//               bgcolor: "background.default",
//               pb: 1.5,
//               borderBottom: "1px solid",
//               borderColor: "divider",
//             }}
//           >
//             <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ lg: "center" }}>
//               <Box sx={{ flex: 1 }}>
//                 <Stack direction="row" spacing={1} alignItems="center">
//                   <Typography sx={{ fontWeight: 700 }}>Role Permission Manager</Typography>
//                   <Chip size="small" color="default" label="SUPER_ADMIN only" />
//                 </Stack>
//                 <Typography variant="body2" color="text.secondary">
//                   Manage permissions for each role. SUPER_ADMIN only.
//                 </Typography>
//               </Box>
//               <FormControl size="small" sx={{ minWidth: 220 }}>
//                 <InputLabel>Role</InputLabel>
//                 <Select
//                   label="Role"
//                   value={roleSlug}
//                   onChange={(event) => setRoleSlug(String(event.target.value))}
//                 >
//                   {ROLE_SLUGS.map((role) => (
//                     <MenuItem key={role} value={role}>
//                       {role}
//                     </MenuItem>
//                   ))}
//                 </Select>
//               </FormControl>
//               <FormControl size="small" sx={{ minWidth: 200 }}>
//                 <InputLabel>Filter</InputLabel>
//                 <Select
//                   label="Filter"
//                   value={filterMode}
//                   onChange={(event) => setFilterMode(event.target.value as "granted" | "all" | "missing")}
//                 >
//                   <MenuItem value="granted">Granted only</MenuItem>
//                   <MenuItem value="all">All</MenuItem>
//                   <MenuItem value="missing">Missing only</MenuItem>
//                 </Select>
//               </FormControl>
//               <TextField
//                 size="small"
//                 label="Search permissions"
//                 value={search}
//                 onChange={(event) => setSearch(event.target.value)}
//                 sx={{ minWidth: { xs: "100%", lg: 320 } }}
//               />
//               <Stack direction="row" spacing={1} alignItems="center">
//                 <Switch
//                   size="small"
//                   checked={hideEmptyModules}
//                   onChange={(event) => setHideEmptyModules(event.target.checked)}
//                 />
//                 <Typography variant="body2">Hide empty modules</Typography>
//               </Stack>
//             </Stack>
//           </Box>

//           <Box
//             sx={{
//               display: "grid",
//               gridTemplateColumns: "1fr",
//               gap: 2,
//               alignItems: "start",
//               pb: 12,
//             }}
//           >
//             {groupedResources.map((group) => (
//               <Accordion
//                 key={group.key}
//                 expanded={expandedModule === group.key}
//                 onChange={() =>
//                   setExpandedModule(expandedModule === group.key ? null : group.key)
//                 }
//                 sx={{
//                   border: "1px solid",
//                   borderColor: "divider",
//                   borderRadius: 2,
//                   bgcolor: "background.paper",
//                   alignSelf: "start",
//                   overflow: "hidden",
//                 }}
//               >
//                 <AccordionSummary
//                   expandIcon={<ExpandMoreIcon />}
//                   sx={{
//                     bgcolor: "grey.50",
//                     borderBottom: "1px solid",
//                     borderColor: "divider",
//                     position: "sticky",
//                     top: 0,
//                     zIndex: 1,
//                   }}
//                 >
//                   <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
//                     <Typography sx={{ fontWeight: 700 }}>{group.title}</Typography>
//                     <Chip size="small" variant="outlined" label={`${group.granted}/${group.total}`} />
//                     {group.listWarning && <Chip size="small" color="warning" label="List missing" />}
//                   </Stack>
//                   <Stack direction="row" spacing={1} alignItems="center">
//                     <Button
//                       size="small"
//                       variant="text"
//                       color="inherit"
//                       sx={{ color: "text.secondary" }}
//                       onClick={(event) => {
//                         event.stopPropagation();
//                         setModuleAction(group.allEntries, ["VIEW"], true);
//                       }}
//                     >
//                       Grant VIEW all
//                     </Button>
//                     <Button
//                       size="small"
//                       variant="text"
//                       color="inherit"
//                       sx={{ color: "error.main" }}
//                       onClick={(event) => {
//                         event.stopPropagation();
//                         clearModule(group.allEntries);
//                       }}
//                     >
//                       Clear module
//                     </Button>
//                   </Stack>
//                 </AccordionSummary>
//                 <AccordionDetails
//                   sx={{ p: 1.25, maxHeight: 520, overflow: "auto" }}
//                   onClick={(event) => event.stopPropagation()}
//                 >
//                   <Stack spacing={1.5}>
//                     {group.entries.map((entry) => (
//                       <Box
//                         key={entry.resource_key}
//                         onClick={(event) => event.stopPropagation()}
//                         sx={{
//                           display: "grid",
//                           gridTemplateColumns: { xs: "1fr", sm: "minmax(120px, 180px) 1fr auto" },
//                           gap: 0.75,
//                           alignItems: "center",
//                           borderBottom: "1px solid",
//                           borderColor: "divider",
//                           py: 0.75,
//                           "&:hover": { bgcolor: "action.hover" },
//                         }}
//                       >
//                         <Typography sx={{ fontWeight: 600, minWidth: 120 }}>
//                           {friendlyLabel(entry.resource_key, entry.element)}
//                         </Typography>
//                         <Typography
//                           variant="caption"
//                           color="text.secondary"
//                           sx={{ fontFamily: "monospace" }}
//                         >
//                           {entry.resource_key}
//                         </Typography>
//                         <Box
//                           sx={{
//                             display: "flex",
//                             flexDirection: "column",
//                             alignItems: "flex-end",
//                             gap: 0.5,
//                             maxWidth: 220,
//                           }}
//                         >
//                           {entry.actions.map((action) => {
//                             const checked = permissionsMap.get(entry.resource_key)?.has(action) || false;
//                             const color = ACTION_COLORS[action] || "default";
//                             const isDanger = ["DEACTIVATE", "DELETE", "REJECT"].includes(action);
//                             const variant = isDanger ? "filled" : "outlined";
//                             const labelText = action.split("_").join(" ");
//                             return (
//                               <Box
//                                 key={action}
//                                 sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
//                                 onClick={(event) => event.stopPropagation()}
//                               >
//                                 <Checkbox
//                                   size="small"
//                                   checked={checked}
//                                   onClick={(event) => event.stopPropagation()}
//                                   onChange={(event) => {
//                                     event.stopPropagation();
//                                     toggleAction(entry.resource_key, action);
//                                   }}
//                                 />
//                                 <Chip
//                                   size="small"
//                                   label={labelText}
//                                   color={color}
//                                   variant={variant}
//                                   onClick={(event) => {
//                                     event.stopPropagation();
//                                     toggleAction(entry.resource_key, action);
//                                   }}
//                                   sx={{
//                                     px: 0.75,
//                                     height: 22,
//                                     fontSize: 12,
//                                     maxWidth: 140,
//                                     "& .MuiChip-label": {
//                                       overflow: "hidden",
//                                       textOverflow: "ellipsis",
//                                     },
//                                   }}
//                                 />
//                               </Box>
//                             );
//                           })}
//                         </Box>
//                       </Box>
//                     ))}
//                   </Stack>
//                 </AccordionDetails>
//               </Accordion>
//             ))}
//           </Box>
//         </Stack>

//         <Box
//           sx={{
//             position: "fixed",
//             left: 0,
//             right: 0,
//             bottom: 0,
//             py: 1.5,
//             bgcolor: "background.paper",
//             borderTop: "1px solid",
//             borderColor: "divider",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "space-between",
//             gap: 2,
//             px: { xs: 2, md: 3 },
//             zIndex: 10,
//           }}
//         >
//           {hasUnsavedChanges ? (
//             <Chip color="warning" label="● Unsaved changes" />
//           ) : (
//             <Box />
//           )}
//           <Button
//             variant="contained"
//             onClick={handleSave}
//             disabled={saving || loadingPolicy || !hasUnsavedChanges}
//           >
//             {saving ? "Saving..." : "Save Changes"}
//           </Button>
//         </Box>
//       </PageContainer>
//     </StepUpGuard>
//   );
// };

// function prettifyScreenFromKey(key: string): string {
//   const prefix = key.split(".")[0] || "Other";
//   return prefix
//     .split("_")
//     .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
//     .join(" ");
// }

// function rowOrderForKey(key: string): number {
//   const suffix = key.split(".").slice(-1)[0] || "";
//   const idx = ROW_ORDER.indexOf(suffix);
//   return idx === -1 ? ROW_ORDER.length : idx;
// }

// function friendlyLabel(resourceKey: string, element?: string): string {
//   const suffix = resourceKey.split(".").slice(-1)[0] || "";
//   if (suffix === "menu") return "Menu";
//   if (suffix === "list") return "List";
//   if (suffix === "detail" || suffix === "view" || suffix === "view_detail") return "Detail";
//   if (suffix === "create") return "Create";
//   if (suffix === "edit" || suffix === "update") return "Edit";
//   if (suffix === "deactivate") return "Deactivate";
//   if (suffix) {
//     return suffix
//       .split("_")
//       .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
//       .join(" ");
//   }
//   return element || resourceKey;
// }
