import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";

import { PageContainer } from "../../components/PageContainer";
import { usePermissions } from "../../authz/usePermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchMandiGates } from "../../services/mandiApi";
import { fetchGateDevices, fetchGateEntryReasons, fetchGateVehicleTypesMaster } from "../../services/gateApi";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { fetchGateOperatorContext, issueGateToken } from "../../services/gateOpsApi";
import { searchPreMarketListingsForGate, markPreMarketArrival } from "../../services/preMarketListingsApi";

type SelectOption = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentUserCountry(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.country || parsed?.country_code || null;
  } catch {
    return null;
  }
}

function todayLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const GateEntryCreate: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { can, permissionsMap } = usePermissions();
  const uiConfig = useAdminUiConfig();
  const language = normalizeLanguageCode(DEFAULT_LANGUAGE);

  const canCreate = useMemo(
    () => can("gate_entry_tokens.create", "CREATE"),
    [can],
  );

  const [form, setForm] = useState({
    vehicle_no: "",
    gate_code: "",
    device_code: "",
    reason_code: "",
    vehicle_type_code: "",
    notes: "",
  });

  const [context, setContext] = useState({
    org_id: "",
    mandi_id: "",
    gate_code: "",
    device_code: "",
  });

  const [quickLinkMobile, setQuickLinkMobile] = useState("");
  const [quickLinkResults, setQuickLinkResults] = useState<any[]>([]);
  const [quickLinkLoading, setQuickLinkLoading] = useState(false);
  const [selectedPreListing, setSelectedPreListing] = useState<any | null>(null);

  const [gateOptions, setGateOptions] = useState<SelectOption[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<SelectOption[]>([]);
  const [reasonOptions, setReasonOptions] = useState<SelectOption[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<SelectOption[]>([]);
  const [loadingGates, setLoadingGates] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(false);

  const isDebug = new URLSearchParams(window.location.search).get("debugAuth") === "1";

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadOperatorContext = async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchGateOperatorContext({ username, language });
      const ctx = resp?.data?.context || resp?.response?.data?.context || null;
      if (!ctx) return;
      setContext({
        org_id: ctx.org_id || "",
        mandi_id: ctx.mandi_id ?? "",
        gate_code: ctx.gate_code || "",
        device_code: ctx.device_code || "",
      });
      setForm((prev) => ({
        ...prev,
        gate_code: prev.gate_code || ctx.gate_code || "",
        device_code: prev.device_code || ctx.device_code || "",
      }));
    } catch (_) {
      // Ignore context failures; fallback to manual selection.
    }
  };

  const loadGates = async () => {
    if (!can("mandi_gates.list", "VIEW")) return;
    const username = currentUsername();
    if (!username) return;
    const scopedOrgId = context.org_id || uiConfig.scope?.org_id || "";
    const scopedMandiId = context.mandi_id ?? "";
    setLoadingGates(true);
    try {
      const filters: Record<string, any> = { is_active: "Y" };
      if (scopedOrgId) filters.org_id = scopedOrgId;
      if (scopedMandiId !== "" && scopedMandiId !== null && scopedMandiId !== undefined) {
        filters.mandi_id = scopedMandiId;
      }
      const resp = await fetchMandiGates({
        username,
        language,
        filters,
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      setGateOptions(
        list.map((g: any) => ({
          value: g.gate_code || g.code || g.slug || "",
          label: g.gate_name || g.gate_code || g.code || g.slug || "",
        })),
      );
    } finally {
      setLoadingGates(false);
    }
  };

  const loadDevices = async (gateCode?: string) => {
    if (!can("gate_devices.list", "VIEW")) return;
    const username = currentUsername();
    if (!username) return;
    const scopedOrgId = context.org_id || uiConfig.scope?.org_id || "";
    const scopedMandiId = context.mandi_id ?? "";
    if (!gateCode) {
      setDeviceOptions([]);
      return;
    }
    setLoadingDevices(true);
    try {
      const filters: Record<string, any> = {
        gate_code: gateCode,
        status: "ACTIVE",
      };
      if (scopedOrgId) filters.org_id = scopedOrgId;
      if (scopedMandiId !== "" && scopedMandiId !== null && scopedMandiId !== undefined) {
        filters.mandi_id = scopedMandiId;
      }
      const resp = await fetchGateDevices({ username, language, filters });
      const list = resp?.data?.devices || resp?.response?.data?.devices || [];
      setDeviceOptions(
        list.map((d: any) => ({
          value: d.device_code || d.device_id || "",
          label: d.device_label || d.device_name || d.device_code || d.device_id || "",
        })),
      );
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadReasons = async () => {
    if (!can("gate_entry_reasons_masters.list", "VIEW")) return;
    const username = currentUsername();
    if (!username) return;
    setLoadingReasons(true);
    try {
      const resp = await fetchGateEntryReasons({ username, language, filters: { is_active: "Y" } });
      const list = resp?.data?.reasons || resp?.response?.data?.reasons || [];
      setReasonOptions(
        list.map((r: any) => ({
          value: r.reason_code,
          label: r.name_i18n?.en || r.name_en || r.reason_code,
        })),
      );
    } finally {
      setLoadingReasons(false);
    }
  };

  const loadVehicleTypes = async () => {
    if (!can("gate_vehicle_types_masters.list", "VIEW")) return;
    const username = currentUsername();
    if (!username) return;
    setLoadingVehicleTypes(true);
    try {
      const resp = await fetchGateVehicleTypesMaster({ username, language, is_active: "Y" });
      const list = resp?.data?.vehicle_types || resp?.response?.data?.vehicle_types || [];
      setVehicleTypes(
        list.map((v: any) => ({
          value: v.vehicle_type_code || v.code || "",
          label: v.name_i18n?.en || v.vehicle_type_name || v.code || "",
        })),
      );
    } finally {
      setLoadingVehicleTypes(false);
    }
  };

  const handleSearchPreListings = async () => {
    const username = currentUsername();
    if (!username) return;
    const orgId = context.org_id || uiConfig.scope?.org_id || "";
    const mandiId = context.mandi_id ?? "";
    const country = currentUserCountry() || "IN";
    if (!quickLinkMobile.trim()) {
      enqueueSnackbar("Enter farmer mobile to search.", { variant: "warning" });
      return;
    }
    if (!mandiId) {
      enqueueSnackbar("Missing mandi context.", { variant: "warning" });
      return;
    }
    setQuickLinkLoading(true);
    try {
      const resp = await searchPreMarketListingsForGate({
        username,
        language,
        filters: {
          country,
          org_id: orgId || undefined,
          mandi_id: mandiId,
          market_date: todayLocal(),
          farmer_mobile: quickLinkMobile.trim(),
        },
      });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      setQuickLinkResults(items || []);
      if (!items || items.length === 0) {
        enqueueSnackbar("No pre-market listings found.", { variant: "info" });
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Search failed.", { variant: "error" });
    } finally {
      setQuickLinkLoading(false);
    }
  };

  const selectPreListing = (listing: any) => {
    setSelectedPreListing(listing);
    const mobile = listing?.farmer?.mobile || "";
    if (mobile) setQuickLinkMobile(mobile);
  };

  const clearPreListing = () => {
    setSelectedPreListing(null);
  };

  useEffect(() => {
    loadOperatorContext();
    loadGates();
    loadReasons();
    loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadGates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.org_id, context.mandi_id, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (!form.gate_code) {
      setDeviceOptions([]);
      return;
    }
    loadDevices(form.gate_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gate_code]);

  const handleSubmit = async () => {
    if (!canCreate) return;
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Not authorized.", { variant: "error" });
      return;
    }
    if (
      !form.gate_code.trim() ||
      !form.device_code.trim() ||
      !form.reason_code.trim() ||
      !form.vehicle_type_code.trim()
    ) {
      enqueueSnackbar("Please fill required fields.", { variant: "warning" });
      return;
    }
    const scopedOrgId = context.org_id || uiConfig.scope?.org_id || "";
    const scopedMandiId = context.mandi_id ?? "";
    if (!scopedOrgId || scopedMandiId === "" || scopedMandiId === null || scopedMandiId === undefined) {
      enqueueSnackbar("Missing operator context (org/mandi).", { variant: "warning" });
      return;
    }
    const payload = {
      username,
      language,
      org_id: scopedOrgId,
      mandi_id: scopedMandiId,
      gate_code: form.gate_code.trim(),
      device_code: form.device_code.trim(),
      vehicle_type_code: form.vehicle_type_code.trim(),
      reason_code: form.reason_code.trim(),
      vehicle_no: form.vehicle_no.trim() || null,
      remarks: form.notes.trim() || null,
    };
    try {
      const resp = await issueGateToken(payload);
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to issue token.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      const tokenCode = resp?.data?.token_code || resp?.response?.data?.token_code || "";
      const tokenId = resp?.data?.gate_entry_token?._id || resp?.response?.data?.gate_entry_token?._id || "";
      enqueueSnackbar(`Token issued: ${tokenCode || "unknown"}`, { variant: "success" });

      if (selectedPreListing) {
        try {
          const arrivalResp = await markPreMarketArrival({
            username,
            language,
            payload: {
              listing_id: selectedPreListing?._id,
              token_id: tokenId || undefined,
              token_code: tokenId ? undefined : tokenCode || undefined,
              country: currentUserCountry() || "IN",
              org_id: scopedOrgId,
              mandi_id: scopedMandiId,
            },
          });
          const arrivalCode = arrivalResp?.response?.responsecode || arrivalResp?.responsecode || "1";
          if (arrivalCode !== "0") {
            enqueueSnackbar(
              "Token created, but pre-listing could not be linked. Please open listing and mark arrived manually.",
              { variant: "warning" },
            );
            console.warn("[preMarketLink] mark arrival failed", arrivalResp);
          }
        } catch (err) {
          enqueueSnackbar(
            "Token created, but pre-listing could not be linked. Please open listing and mark arrived manually.",
            { variant: "warning" },
          );
          console.warn("[preMarketLink] mark arrival error", err);
        }
      }

      if (tokenCode) {
        navigate(`/gate-tokens/${encodeURIComponent(tokenCode)}`);
      } else {
        navigate("/gate-tokens");
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to issue token.", { variant: "error" });
    }
  };

  if (!canCreate) {
    return (
      <PageContainer>
        <Typography variant="h6">Forbidden: You do not have permission.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Gate Entry (Create Token)</Typography>
          {isDebug && (
            <Typography variant="caption" color="text.secondary">
              canCreate: {String(canCreate)} | permKeys: {Object.keys(permissionsMap || {}).length}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIosNewIcon fontSize="small" />}
            onClick={() => navigate("/gate-entries")}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon fontSize="small" />}
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </Stack>
      </Stack>

        <Box mb={2}>
        <Typography variant="subtitle1">Link pre-market listing (optional)</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} mt={1}>
          <TextField
            label="Farmer Mobile"
            value={quickLinkMobile}
            onChange={(e) => setQuickLinkMobile(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <Button
            variant="outlined"
            onClick={handleSearchPreListings}
            disabled={quickLinkLoading}
          >
            {quickLinkLoading ? "Searching..." : "Search"}
          </Button>
        </Stack>

        {selectedPreListing ? (
          <Box mt={2} p={2} sx={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="body2">Selected Listing: {selectedPreListing?._id || "-"}</Typography>
                <Typography variant="body2">Farmer: {selectedPreListing?.farmer?.name || "-"} ({selectedPreListing?.farmer?.mobile || "-"})</Typography>
                <Typography variant="body2">Commodity: {selectedPreListing?.produce?.commodity_name || "-"}</Typography>
                <Typography variant="body2">Bags: {selectedPreListing?.produce?.quantity?.bags ?? "-"} | Weight/Bag: {selectedPreListing?.produce?.quantity?.weight_per_bag_kg ?? "-"}</Typography>
              </Box>
              <Button variant="text" color="error" onClick={clearPreListing}>Clear</Button>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={1} mt={2}>
            {quickLinkResults.map((item: any) => (
              <Box key={String(item._id)} p={2} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 1 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                  <Box>
                    <Typography variant="body2">Listing: {String(item._id)}</Typography>
                    <Typography variant="body2">Farmer: {item?.farmer?.name || "-"} ({item?.farmer?.mobile || "-"})</Typography>
                    <Typography variant="body2">Commodity: {item?.produce?.commodity_name || "-"}</Typography>
                    <Typography variant="body2">Bags: {item?.produce?.quantity?.bags ?? "-"} | Weight/Bag: {item?.produce?.quantity?.weight_per_bag_kg ?? "-"}</Typography>
                  </Box>
                  <Button variant="contained" onClick={() => selectPreListing(item)}>Use this listing</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box component="form" noValidate autoComplete="off">
        <Stack spacing={2} maxWidth={520}>
          <TextField
            label="Vehicle Number"
            value={form.vehicle_no}
            onChange={(e) => updateField("vehicle_no", e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Gate"
            value={form.gate_code}
            onChange={(e) => {
              updateField("gate_code", e.target.value);
              updateField("device_code", "");
            }}
            required
            fullWidth
            helperText={loadingGates ? "Loading gates..." : gateOptions.length ? "Select gate" : "No gates found"}
            SelectProps={{ displayEmpty: true }}
            InputProps={{
              endAdornment: loadingGates ? <CircularProgress size={18} /> : undefined,
            }}
          >
            <MenuItem value="">
              <em>Select gate</em>
            </MenuItem>
            {gateOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Device"
            value={form.device_code}
            onChange={(e) => updateField("device_code", e.target.value)}
            required
            fullWidth
            helperText={
              loadingDevices
                ? "Loading devices..."
                : form.gate_code
                  ? deviceOptions.length
                    ? "Select device"
                    : "No active devices for this gate"
                  : "Select a gate first"
            }
            SelectProps={{ displayEmpty: true }}
            InputProps={{
              endAdornment: loadingDevices ? <CircularProgress size={18} /> : undefined,
            }}
          >
            <MenuItem value="">
              <em>Select device</em>
            </MenuItem>
            {deviceOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Entry Reason"
            value={form.reason_code}
            onChange={(e) => updateField("reason_code", e.target.value)}
            required
            fullWidth
            helperText={loadingReasons ? "Loading reasons..." : reasonOptions.length ? "Select reason" : "No reasons found"}
            SelectProps={{ displayEmpty: true }}
            InputProps={{
              endAdornment: loadingReasons ? <CircularProgress size={18} /> : undefined,
            }}
          >
            <MenuItem value="">
              <em>Select reason</em>
            </MenuItem>
            {reasonOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Vehicle Type"
            value={form.vehicle_type_code}
            onChange={(e) => updateField("vehicle_type_code", e.target.value)}
            required
            fullWidth
            helperText={loadingVehicleTypes ? "Loading vehicle types..." : "Select vehicle type"}
            SelectProps={{ displayEmpty: true }}
            InputProps={{
              endAdornment: loadingVehicleTypes ? <CircularProgress size={18} /> : undefined,
            }}
          >
            <MenuItem value="">
              <em>Select vehicle type</em>
            </MenuItem>
            {vehicleTypes.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Notes"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </Box>
    </PageContainer>
  );
};
