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
import { fetchGateEntryReasons, fetchGateVehicleTypes } from "../../services/gateApi";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";

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

export const GateEntryCreate: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { can, permissionsMap } = usePermissions();
  useAdminUiConfig(); // keep subscription for consistency, even if not used directly
  const language = normalizeLanguageCode(DEFAULT_LANGUAGE);

  const canCreate = useMemo(
    () => can("gate_entry_tokens.create", "CREATE"),
    [can],
  );

  const [form, setForm] = useState({
    vehicle_no: "",
    gate_code: "",
    reason_code: "",
    vehicle_type_code: "",
    notes: "",
  });

  const [gateOptions, setGateOptions] = useState<SelectOption[]>([]);
  const [reasonOptions, setReasonOptions] = useState<SelectOption[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<SelectOption[]>([]);
  const [loadingGates, setLoadingGates] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(false);

  const isDebug = new URLSearchParams(window.location.search).get("debugAuth") === "1";

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadGates = async () => {
    if (!can("mandi_gates.list", "VIEW")) return;
    const username = currentUsername();
    if (!username) return;
    setLoadingGates(true);
    try {
      const resp = await fetchMandiGates({
        username,
        language,
        filters: { is_active: "Y" },
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
      const resp = await fetchGateVehicleTypes({ username, language, is_active: "Y" });
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

  useEffect(() => {
    loadGates();
    loadReasons();
    loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => {
    if (!canCreate) return;
    if (!form.vehicle_no.trim() || !form.gate_code.trim() || !form.reason_code.trim()) {
      enqueueSnackbar("Please fill required fields.", { variant: "warning" });
      return;
    }
    const payload = {
      vehicle_no: form.vehicle_no.trim(),
      gate_code: form.gate_code.trim(),
      reason_code: form.reason_code.trim(),
      vehicle_type_code: form.vehicle_type_code.trim() || null,
      notes: form.notes.trim() || null,
    };
    console.log("[GateEntryCreate] Create Gate Entry payload", payload);
    enqueueSnackbar("Create API not wired yet (UI ready). Payload logged.", { variant: "info" });
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
          <Typography variant="h5">Create Gate Entry Token</Typography>
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

      <Box component="form" noValidate autoComplete="off">
        <Stack spacing={2} maxWidth={520}>
          <TextField
            label="Vehicle Number"
            value={form.vehicle_no}
            onChange={(e) => updateField("vehicle_no", e.target.value)}
            required
            fullWidth
          />
          <TextField
            select
            label="Gate"
            value={form.gate_code}
            onChange={(e) => updateField("gate_code", e.target.value)}
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
            fullWidth
            helperText={loadingVehicleTypes ? "Loading vehicle types..." : "Optional"}
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
