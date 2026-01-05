import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { normalizeFlag } from "../../utils/statusUtils";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchOrgMandisLite, updateOrgMandiStatus } from "../../services/mandiApi";
import { getOrgDisplayName } from "../../utils/orgDisplay";
import { StepUpGuard } from "../../components/StepUpGuard";

type OrgOption = {
  _id: string;
  org_code: string;
  org_name?: string | null;
  name?: string | null;
  label?: string | null;
};

type MappingRow = {
  id: string;
  mapping_id: string;
  org_id: string;
  org_display: string;
  mandi_id: number;
  mandi_name: string;
  mandi_slug?: string;
  state_code?: string | null;
  district_name?: string | null;
  pincode?: string | null;
  status_effective: "Y" | "N";
  status_label: string;
  status_color: "success" | "default";
  display_name: string;
  is_active: "Y" | "N";
};

type ToastState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
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

function buildOrgDisplay(org_code?: string | null, org_name?: string | null, org_id?: string) {
  if (org_code && org_name) return `${org_code} - ${org_name}`;
  if (org_code) return org_code;
  if (org_name) return org_name;
  return org_id || "";
}

function formatUnknownOrgId(orgId?: string) {
  if (!orgId) return "Unknown organisation";
  const suffix = orgId.length > 6 ? orgId.slice(-6) : orgId;
  return `Unknown organisation (ends with ${suffix})`;
}

function extractMandisFromResponse(resp: any): any[] {
  if (!resp) return [];
  const root = resp?.data ?? resp?.response ?? resp ?? {};
  const data = root?.data ?? root;
  const items =
    data?.mandis ??
    data?.items ??
    data?.data?.mandis ??
    data?.data?.items ??
    root?.mandis ??
    [];
  return Array.isArray(items) ? items : [];
}

export const OrgMandiMapping: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const roleSlug = uiConfig.role || "";

  const scopedOrgId = uiConfig.scope?.org_id ? String(uiConfig.scope.org_id) : "";
  const scopedOrgCode = uiConfig.scope?.org_code ? String(uiConfig.scope.org_code) : "";
  const isOrgScoped = Boolean(scopedOrgId || scopedOrgCode);

  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ org_id: string; status: "ALL" | "Y" | "N" }>({
    org_id: "",
    status: "ALL",
  });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
  });
  const [responseOrgName, setResponseOrgName] = useState<string>("");

  const canToggleStatus = useMemo(
    () => can(uiConfig.resources, "mandis.org.remove", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const orgDisplayMap = useMemo(() => {
    const map = new Map<string, OrgOption>();
    orgOptions.forEach((option) => {
      if (option._id) {
        map.set(option._id, option);
      }
    });
    return map;
  }, [orgOptions]);

  const selectedOrgName = useMemo(() => {
    const orgId = filters.org_id || scopedOrgId;
    if (orgId) {
      const match = orgOptions.find((opt) => opt._id === orgId);
      // Prefer the resolved org name from the API response meta (most reliable for ORG scoped users).
      if (String(match?.org_name || "").trim()) return String(match?.org_name).trim();
      if (String(responseOrgName || "").trim() && orgId === (filters.org_id || scopedOrgId)) {
        return String(responseOrgName).trim();
      }
      if (match?.org_code) return match.org_code;
      return formatUnknownOrgId(orgId);
    }
    if (scopedOrgCode) return scopedOrgCode;
    return "All organisations";
  }, [filters.org_id, orgOptions, responseOrgName, scopedOrgId, scopedOrgCode]);

  const filteredRows = useMemo(() => {
    const statusFilter = filters.status;
    const filtered = rows.filter((row) => {
      if (statusFilter === "ALL") return true;
      return row.is_active === statusFilter;
    });
    console.log("[OrgMandiMapping] filter", {
      statusFilter,
      total: rows.length,
      filtered: filtered.length,
      sample: rows[0] || null,
    });
    return filtered;
  }, [filters.status, rows]);

  const loadOrgs = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setOrgLoadError(null);
    try {
      const resp = await fetchOrganisations({ username, language });
      const payload: any = resp?.data ?? resp?.response ?? resp;
      const organisations: any[] = payload?.data?.organisations ?? payload?.organisations ?? [];
      const mapped: OrgOption[] = organisations.map((o) => ({
        _id: o._id || o.org_id || "",
        org_code: o.org_code || "",
        org_name: o.org_name || "",
      }));
      setOrgOptions(mapped);
      setFilters((prev) => {
        if (prev.org_id) return prev;
        if (mapped.length === 1) {
          return { ...prev, org_id: mapped[0]._id };
        }
        return prev;
      });
    } catch (err: any) {
      const message = err?.message || "Unable to load organisations";
      setOrgLoadError(message);
      console.error("[OrgMandiMapping] loadOrgs error", err);
    }
  }, [language]);

  // If the backend returns org_name in meta (it does now), keep the scoped option in sync so
  // the dropdown/header never falls back to "Unknown organisation".
  useEffect(() => {
    if (!isOrgScoped) return;
    if (!scopedOrgId) return;
    const resolved = String(responseOrgName || "").trim();
    if (!resolved) return;

    setOrgOptions((prev) => {
      const next = prev.length ? [...prev] : [];
      const idx = next.findIndex((o) => o._id === scopedOrgId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], org_name: resolved };
      } else {
        next.push({ _id: scopedOrgId, org_code: scopedOrgCode || scopedOrgId, org_name: resolved });
      }
      return next;
    });
  }, [isOrgScoped, responseOrgName, scopedOrgCode, scopedOrgId]);

  const loadMappings = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const requestOrgId = filters.org_id || scopedOrgId || "";
      const resp = await fetchOrgMandisLite({
        username,
        language,
        org_id: requestOrgId,
        filters: {
          is_active: filters.status === "ALL" ? undefined : filters.status,
          page: 1,
          pageSize: 200,
        },
      });
      const root = resp?.data ?? resp?.response ?? resp ?? {};
      const data = root?.data ?? root;
      const meta = data?.meta ?? {};
      const items = extractMandisFromResponse(resp);

      const orgMetaId = String(meta?.org_id || "").trim();
      const orgMetaName = String(meta?.org_name || meta?.org_label || "").trim();
      const orgMetaCode = String(meta?.org_code || "").trim();
      setResponseOrgName(orgMetaName || "");

      // If the API returned org metadata, ensure our orgOptions cache is populated so the UI
      // (dropdown + header) never falls back to "Unknown organisation".
      if (orgMetaId) {
        setOrgOptions((prev) => {
          const exists = prev.some((o) => o._id === orgMetaId);
          if (exists) {
            return prev.map((o) =>
              o._id === orgMetaId
                ? {
                    ...o,
                    org_code: String(o.org_code || orgMetaCode || "").trim(),
                    org_name: String(o.org_name || orgMetaName || "").trim(),
                  }
                : o,
            );
          }
          return [
            ...prev,
            {
              _id: orgMetaId,
              org_code: orgMetaCode || orgMetaId,
              org_name: orgMetaName || "",
            },
          ];
        });
      }

      const mapped: MappingRow[] = items.map((item) => {
        const orgId = String(item.org_id || item.orgId || "");
        const orgOption = orgDisplayMap.get(orgId);

        const effectiveOrgName =
          String(item.org_name || "").trim() ||
          String(orgOption?.org_name || "").trim() ||
          (orgId && orgId === orgMetaId ? orgMetaName : "");

        const effectiveOrgCode =
          String(item.org_code || "").trim() ||
          String(orgOption?.org_code || "").trim() ||
          (orgId && orgId === orgMetaId ? orgMetaCode : "");

        const org_display =
          buildOrgDisplay(effectiveOrgCode, effectiveOrgName, orgId) ||
          buildOrgDisplay(
            orgDisplayMap.get(filters.org_id)?.org_code,
            orgDisplayMap.get(filters.org_id)?.org_name,
            filters.org_id || undefined,
          );

        const name =
          item.name_i18n?.en ||
          item.mandi_name ||
          item.label ||
          item.mandi_slug ||
          `Mandi ${item.mandi_id || ""}`;

        const sanitizedMandiId = Number(item.mandi_id) || 0;
        const normalizedIsActive =
          normalizeFlag(item.is_active ?? item.org_mandi_is_active ?? item.mapping_is_active) ?? "Y";

        return {
          id: String(item._id || `${orgId}_${sanitizedMandiId}`),
          mapping_id: String(item._id || item.mapping_id || `${orgId}_${sanitizedMandiId}`),
          org_id: orgId,
          org_display,
          mandi_id: sanitizedMandiId,
          mandi_name: name,
          display_name: name,
          mandi_slug: item.mandi_slug,
          state_code: item.state_code || null,
          district_name: item.district_name || item.district_name_en || null,
          pincode: item.pincode || null,
          status_effective: normalizedIsActive,
          status_label: normalizedIsActive === "Y" ? "Active" : "Inactive",
          status_color: normalizedIsActive === "Y" ? "success" : "default",
          is_active: normalizedIsActive,
        };
      });

      setRows(mapped);
    } catch (err: any) {
      console.error("[OrgMandiMapping] loadMappings error", err);
      setToast({
        open: true,
        message: err?.message || "Unable to load org mandis",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [filters.org_id, filters.status, language, scopedOrgId, orgDisplayMap]);

  const handleStatusToggle = async (row: MappingRow, nextState: "Y" | "N") => {
    if (!canToggleStatus) return;
    const username = currentUsername();
    if (!username) return;
    setActionLoadingId(row.id);
    try {
      await updateOrgMandiStatus({
        username,
        language,
        mapping_id: row.mapping_id,
        is_active: nextState,
      });
      setToast({
        open: true,
        message: nextState === "Y" ? "Mandi activated for this organisation." : "Mandi deactivated for this organisation.",
        severity: "success",
      });
      await loadMappings();
    } catch (err: any) {
      console.error("[OrgMandiMapping] status toggle error", err);
      setToast({
        open: true,
        message: err?.message || "Unable to update mandi status",
        severity: "error",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (isOrgScoped && scopedOrgId) {
      setOrgOptions([
        {
          _id: scopedOrgId,
          org_code: scopedOrgCode || scopedOrgId,
          org_name: "",
        },
      ]);
      setFilters((prev) => ({
        ...prev,
        org_id: prev.org_id || scopedOrgId,
      }));
    } else {
      loadOrgs();
    }
  }, [isOrgScoped, scopedOrgId, scopedOrgCode, loadOrgs]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleFiltersChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleToastClose = () => setToast((prev) => ({ ...prev, open: false }));

  return (
    <StepUpGuard username={currentUsername()} resourceKey="org_mandi_mapping.list" action="VIEW">
      <PageContainer>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h5">Org–Mandi Mapping</Typography>
            <Typography variant="body2" color="text.secondary">
              This list reflects the mandis that belong to your organisation (stored in {`mandi_master_user`}).
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organisation: {selectedOrgName}
            </Typography>
          </Stack>

          <Card>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                <TextField
                  select
                  label="Organisation"
                  size="small"
                  value={filters.org_id}
                  onChange={(e) => handleFiltersChange("org_id", e.target.value)}
                  fullWidth
                >
                  <MenuItem value="">All organisations</MenuItem>
                  {orgOptions.map((o) => (
                    <MenuItem key={o._id} value={o._id}>
                      {getOrgDisplayName(o)}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Status"
                  size="small"
                  value={filters.status}
                  onChange={(e) => handleFiltersChange("status", e.target.value)}
                  sx={{ width: 160 }}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="Y">Active</MenuItem>
                  <MenuItem value="N">Inactive</MenuItem>
                </TextField>

                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadMappings} disabled={loading}>
                  Refresh
                </Button>
              </Stack>

              {orgLoadError && (
                <Typography variant="caption" color="error">
                  {orgLoadError}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              {loading ? (
                <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                  <CircularProgress />
                </Box>
              ) : filteredRows.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {rows.length
                    ? `No organisation mandis match the selected status (${
                        filters.status === "Y" ? "Active" : filters.status === "N" ? "Inactive" : "N/A"
                      }).`
                    : "No organisation mandis found."}
                </Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 520 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mandi ID</TableCell>
                        <TableCell>Mandi</TableCell>
                        <TableCell>State</TableCell>
                        <TableCell>District</TableCell>
                        <TableCell>Pincode</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.mandi_id}</TableCell>
                          <TableCell>{row.display_name}</TableCell>
                          <TableCell>{row.state_code || "-"}</TableCell>
                          <TableCell>{row.district_name || "-"}</TableCell>
                          <TableCell>{row.pincode || "-"}</TableCell>
                          <TableCell>
                            <Chip size="small" color={row.status_color} label={row.status_label} />
                          </TableCell>
                          <TableCell align="right">
                            {row.status_effective === "Y" ? (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={!canToggleStatus || actionLoadingId === row.id}
                                onClick={() => handleStatusToggle(row, "N")}
                              >
                                {actionLoadingId === row.id ? <CircularProgress size={16} /> : "Deactivate"}
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                disabled={!canToggleStatus || actionLoadingId === row.id}
                                onClick={() => handleStatusToggle(row, "Y")}
                              >
                                {actionLoadingId === row.id ? <CircularProgress size={16} /> : "Activate"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          message={toast.message}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        />
      </PageContainer>
    </StepUpGuard>
  );
};

// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   Box,
//   Button,
//   Card,
//   CardContent,
//   Chip,
//   CircularProgress,
//   MenuItem,
//   Snackbar,
//   Stack,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   TextField,
//   Typography,
// } from "@mui/material";
// import RefreshIcon from "@mui/icons-material/Refresh";
// import { useTranslation } from "react-i18next";
// import { PageContainer } from "../../components/PageContainer";
// import { normalizeLanguageCode } from "../../config/languages";
// import { useAdminUiConfig } from "../../contexts/admin-ui-config";
// import { can } from "../../utils/adminUiConfig";
// import { normalizeFlag } from "../../utils/statusUtils";
// import { fetchOrganisations } from "../../services/adminUsersApi";
// import { fetchOrgMandisLite, updateOrgMandiStatus } from "../../services/mandiApi";
// import { getOrgDisplayName } from "../../utils/orgDisplay";
// import { StepUpGuard } from "../../components/StepUpGuard";

// type OrgOption = {
//   _id: string;
//   org_code: string;
//   org_name?: string | null;
//   name?: string | null;
//   label?: string | null;
// };

// type MappingRow = {
//   id: string;
//   mapping_id: string;
//   org_id: string;
//   org_display: string;
//   mandi_id: number;
//   mandi_name: string;
//   mandi_slug?: string;
//   state_code?: string | null;
//   district_name?: string | null;
//   pincode?: string | null;
//   status_effective: "Y" | "N";
//   status_label: string;
//   status_color: "success" | "default";
//   display_name: string;
//   is_active: "Y" | "N";
// };

// type ToastState = {
//   open: boolean;
//   message: string;
//   severity: "success" | "error";
// };

// function currentUsername(): string | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return parsed?.username || null;
//   } catch {
//     return null;
//   }
// }

// function buildOrgDisplay(org_code?: string | null, org_name?: string | null, org_id?: string) {
//   if (org_code && org_name) return `${org_code} - ${org_name}`;
//   if (org_code) return org_code;
//   if (org_name) return org_name;
//   return org_id || "";
// }

// function formatUnknownOrgId(orgId?: string) {
//   if (!orgId) return "Unknown organisation";
//   const suffix = orgId.length > 6 ? orgId.slice(-6) : orgId;
//   return `Unknown organisation (ends with ${suffix})`;
// }

// function extractMandisFromResponse(resp: any): any[] {
//   if (!resp) return [];
//   const root = resp?.data ?? resp?.response ?? resp ?? {};
//   const data = root?.data ?? root;
//   const items =
//     data?.mandis ??
//     data?.items ??
//     data?.data?.mandis ??
//     data?.data?.items ??
//     root?.mandis ??
//     [];
//   return Array.isArray(items) ? items : [];
// }

// export const OrgMandiMapping: React.FC = () => {
//   const { i18n } = useTranslation();
//   const language = normalizeLanguageCode(i18n.language);
//   const uiConfig = useAdminUiConfig();
//   const roleSlug = uiConfig.role || "";

//   const scopedOrgId = uiConfig.scope?.org_id ? String(uiConfig.scope.org_id) : "";
//   const scopedOrgCode = uiConfig.scope?.org_code ? String(uiConfig.scope.org_code) : "";
//   const isOrgScoped = Boolean(scopedOrgId || scopedOrgCode);

//   const [rows, setRows] = useState<MappingRow[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
//   const [orgLoadError, setOrgLoadError] = useState<string | null>(null);
//   const [filters, setFilters] = useState<{ org_id: string; status: "ALL" | "Y" | "N" }>({
//     org_id: "",
//     status: "ALL",
//   });
//   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
//   const [toast, setToast] = useState<ToastState>({
//     open: false,
//     message: "",
//     severity: "success",
//   });
//   const [responseOrgName, setResponseOrgName] = useState<string>("");

//   const canToggleStatus = useMemo(
//     () => can(uiConfig.resources, "mandis.org.remove", "DEACTIVATE"),
//     [uiConfig.resources],
//   );

//   const orgDisplayMap = useMemo(() => {
//     const map = new Map<string, OrgOption>();
//     orgOptions.forEach((option) => {
//       if (option._id) {
//         map.set(option._id, option);
//       }
//     });
//     return map;
//   }, [orgOptions]);

//   const selectedOrgName = useMemo(() => {
//     const orgId = filters.org_id || scopedOrgId;
//     if (orgId) {
//       const match = orgOptions.find((opt) => opt._id === orgId);
//       if (match?.org_name) return match.org_name;
//       if (match?.org_code) return match.org_code;
//       return formatUnknownOrgId(orgId);
//     }
//     if (scopedOrgCode) return scopedOrgCode;
//     return "All organisations";
//   }, [filters.org_id, orgOptions, scopedOrgId, scopedOrgCode]);

//   const filteredRows = useMemo(() => {
//     const statusFilter = filters.status;
//     const filtered = rows.filter((row) => {
//       if (statusFilter === "ALL") return true;
//       return row.is_active === statusFilter;
//     });
//     console.log("[OrgMandiMapping] filter", {
//       statusFilter,
//       total: rows.length,
//       filtered: filtered.length,
//       sample: rows[0] || null,
//     });
//     return filtered;
//   }, [filters.status, rows]);

//   const loadOrgs = useCallback(async () => {
//     const username = currentUsername();
//     if (!username) return;
//     setOrgLoadError(null);
//     try {
//       const resp = await fetchOrganisations({ username, language });
//       const payload: any = resp?.data ?? resp?.response ?? resp;
//       const organisations: any[] =
//         payload?.data?.organisations ?? payload?.organisations ?? [];
//       const mapped: OrgOption[] = organisations.map((o) => ({
//         _id: o._id || o.org_id || "",
//         org_code: o.org_code || "",
//         org_name: o.org_name || "",
//       }));
//       setOrgOptions(mapped);
//       setFilters((prev) => {
//         if (prev.org_id) return prev;
//         if (mapped.length === 1) {
//           return { ...prev, org_id: mapped[0]._id };
//         }
//         return prev;
//       });
//     } catch (err: any) {
//       const message = err?.message || "Unable to load organisations";
//       setOrgLoadError(message);
//       console.error("[OrgMandiMapping] loadOrgs error", err);
//     }
//   }, [language]);

// const loadMappings = useCallback(async () => {
//     const username = currentUsername();
//     if (!username) return;
//     setLoading(true);
//     try {
//       const requestOrgId = filters.org_id || scopedOrgId || "";
//       const resp = await fetchOrgMandisLite({
//         username,
//         language,
//         org_id: requestOrgId,
//         filters: {
//           is_active: filters.status === "ALL" ? undefined : filters.status,
//           page: 1,
//           pageSize: 200,
//         },
//       });
//       const root = resp?.data ?? resp?.response ?? resp ?? {};
//       const data = root?.data ?? root;
//       const meta = data?.meta ?? {};
//       const items = extractMandisFromResponse(resp);
//       const orgMetaName = String(meta?.org_name || '').trim();
//       setResponseOrgName(orgMetaName || '');
//       const mapped: MappingRow[] = items.map((item) => {
//         const orgId = String(item.org_id || item.orgId || "");
//         const orgOption = orgDisplayMap.get(orgId);
//         const org_display =
//           buildOrgDisplay(
//             item.org_code || orgOption?.org_code,
//             item.org_name || orgOption?.org_name,
//             orgId,
//           ) ||
//           buildOrgDisplay(orgDisplayMap.get(filters.org_id)?.org_code, orgDisplayMap.get(filters.org_id)?.org_name, filters.org_id || undefined);
//         const name =
//           item.name_i18n?.en ||
//           item.mandi_name ||
//           item.label ||
//           item.mandi_slug ||
//           `Mandi ${item.mandi_id || ""}`;
//         const sanitizedMandiId = Number(item.mandi_id) || 0;
//         const normalizedIsActive =
//           normalizeFlag(item.is_active ?? item.org_mandi_is_active ?? item.mapping_is_active) ?? "Y";
//         return {
//           id: String(item._id || `${orgId}_${sanitizedMandiId}`),
//           mapping_id: String(item._id || item.mapping_id || `${orgId}_${sanitizedMandiId}`),
//           org_id: orgId,
//           org_display,
//           mandi_id: sanitizedMandiId,
//           mandi_name: name,
//           display_name: name,
//           mandi_slug: item.mandi_slug,
//           state_code: item.state_code || null,
//           district_name: item.district_name || item.district_name_en || null,
//           pincode: item.pincode || null,
//           status_effective: normalizedIsActive,
//           status_label: normalizedIsActive === "Y" ? "Active" : "Inactive",
//           status_color: normalizedIsActive === "Y" ? "success" : "default",
//           is_active: normalizedIsActive,
//         };
//       });
//       setRows(mapped);
//     } catch (err: any) {
//       console.error("[OrgMandiMapping] loadMappings error", err);
//       setToast({
//         open: true,
//         message: err?.message || "Unable to load org mandis",
//         severity: "error",
//       });
//     } finally {
//       setLoading(false);
//     }
//   }, [filters.org_id, filters.status, language, scopedOrgId, orgDisplayMap]);

//   const handleStatusToggle = async (row: MappingRow, nextState: "Y" | "N") => {
//     if (!canToggleStatus) return;
//     const username = currentUsername();
//     if (!username) return;
//     setActionLoadingId(row.id);
//     try {
//       await updateOrgMandiStatus({
//         username,
//         language,
//         mapping_id: row.mapping_id,
//         is_active: nextState,
//       });
//       setToast({
//         open: true,
//         message:
//           nextState === "Y"
//             ? "Mandi activated for this organisation."
//             : "Mandi deactivated for this organisation.",
//         severity: "success",
//       });
//       await loadMappings();
//     } catch (err: any) {
//       console.error("[OrgMandiMapping] status toggle error", err);
//       setToast({
//         open: true,
//         message: err?.message || "Unable to update mandi status",
//         severity: "error",
//       });
//     } finally {
//       setActionLoadingId(null);
//     }
//   };

//   useEffect(() => {
//     if (isOrgScoped && scopedOrgId) {
//       setOrgOptions([
//         {
//           _id: scopedOrgId,
//           org_code: scopedOrgCode || scopedOrgId,
//           org_name: "",
//         },
//       ]);
//       setFilters((prev) => ({
//         ...prev,
//         org_id: prev.org_id || scopedOrgId,
//       }));
//     } else {
//       loadOrgs();
//     }
//   }, [isOrgScoped, scopedOrgId, scopedOrgCode, loadOrgs]);

//   useEffect(() => {
//     loadMappings();
//   }, [loadMappings]);

//   const handleFiltersChange = (key: keyof typeof filters, value: string) => {
//     setFilters((prev) => ({ ...prev, [key]: value }));
//   };

//   const handleToastClose = () => setToast((prev) => ({ ...prev, open: false }));

//   return (
//     <StepUpGuard
//       username={currentUsername()}
//       resourceKey="org_mandi_mapping.list"
//       action="VIEW"
//     >
//       <PageContainer>
//       <Stack spacing={2}>
//         <Stack spacing={0.5}>
//           <Typography variant="h5">Org–Mandi Mapping</Typography>
//           <Typography variant="body2" color="text.secondary">
//             This list reflects the mandis that belong to your organisation (stored in {`mandi_master_user`}).
//           </Typography>
//           <Typography variant="body2" color="text.secondary">
//             Organisation: {selectedOrgName}
//           </Typography>
//         </Stack>

//         <Card>
//           <CardContent>
//             <Stack
//               direction={{ xs: "column", md: "row" }}
//               spacing={2}
//               alignItems={{ xs: "stretch", md: "center" }}
//             >
//               <TextField
//                 select
//                 label="Organisation"
//                 size="small"
//                 value={filters.org_id}
//                 onChange={(e) => handleFiltersChange("org_id", e.target.value)}
//                 fullWidth
//               >
//                 <MenuItem value="">All organisations</MenuItem>
//                 {orgOptions.map((o) => (
//                   <MenuItem key={o._id} value={o._id}>
//                     {getOrgDisplayName(o)}
//                   </MenuItem>
//                 ))}
//               </TextField>
//               <TextField
//                 select
//                 label="Status"
//                 size="small"
//                 value={filters.status}
//                 onChange={(e) => handleFiltersChange("status", e.target.value)}
//                 sx={{ width: 160 }}
//               >
//                 <MenuItem value="ALL">All</MenuItem>
//                 <MenuItem value="Y">Active</MenuItem>
//                 <MenuItem value="N">Inactive</MenuItem>
//               </TextField>
//               <Button
//                 variant="outlined"
//                 startIcon={<RefreshIcon />}
//                 onClick={loadMappings}
//                 disabled={loading}
//               >
//                 Refresh
//               </Button>
//             </Stack>
//             {orgLoadError && (
//               <Typography variant="caption" color="error">
//                 {orgLoadError}
//               </Typography>
//             )}
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent>
//             {loading ? (
//               <Box
//                 sx={{
//                   py: 4,
//                   display: "flex",
//                   justifyContent: "center",
//                 }}
//               >
//                 <CircularProgress />
//               </Box>
//             ) : filteredRows.length === 0 ? (
//               <Typography variant="body2" color="text.secondary">
//                 {rows.length
//                   ? `No organisation mandis match the selected status (${filters.status === "Y" ? "Active" : filters.status === "N" ? "Inactive" : "N/A"}).`
//                   : "No organisation mandis found."}
//               </Typography>
//             ) : (
//               <TableContainer sx={{ maxHeight: 520 }}>
//                 <Table stickyHeader size="small">
//                 <TableHead>
//                   <TableRow>
//                     <TableCell>Mandi ID</TableCell>
//                     <TableCell>Mandi</TableCell>
//                     <TableCell>State</TableCell>
//                     <TableCell>District</TableCell>
//                     <TableCell>Pincode</TableCell>
//                     <TableCell>Status</TableCell>
//                     <TableCell align="right">Actions</TableCell>
//                   </TableRow>
//                 </TableHead>
//                 <TableBody>
//                   {filteredRows.map((row) => (
//                     <TableRow key={row.id} hover>
//                       <TableCell>{row.mandi_id}</TableCell>
//                       <TableCell>{row.display_name}</TableCell>
//                       <TableCell>{row.state_code || "-"}</TableCell>
//                       <TableCell>{row.district_name || "-"}</TableCell>
//                       <TableCell>{row.pincode || "-"}</TableCell>
//                       <TableCell>
//                         <Chip size="small" color={row.status_color} label={row.status_label} />
//                       </TableCell>
//                       <TableCell align="right">
//                         {row.status_effective === "Y" ? (
//                           <Button
//                             size="small"
//                             variant="outlined"
//                             color="error"
//                             disabled={!canToggleStatus || actionLoadingId === row.id}
//                             onClick={() => handleStatusToggle(row, "N")}
//                           >
//                             {actionLoadingId === row.id ? (
//                               <CircularProgress size={16} />
//                             ) : (
//                               "Deactivate"
//                             )}
//                           </Button>
//                         ) : (
//                           <Button
//                             size="small"
//                             variant="contained"
//                             color="primary"
//                             disabled={!canToggleStatus || actionLoadingId === row.id}
//                             onClick={() => handleStatusToggle(row, "Y")}
//                           >
//                             {actionLoadingId === row.id ? (
//                               <CircularProgress size={16} />
//                             ) : (
//                               "Activate"
//                             )}
//                           </Button>
//                         )}
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//                 </Table>
//               </TableContainer>
//             )}
//           </CardContent>
//         </Card>
//       </Stack>
//       <Snackbar
//         open={toast.open}
//         autoHideDuration={4000}
//         message={toast.message}
//         onClose={handleToastClose}
//         anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
//       />
//       </PageContainer>
//     </StepUpGuard>
//   );
// };
