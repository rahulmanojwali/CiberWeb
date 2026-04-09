import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  fetchCommodities,
  fetchCommodityProducts,
  fetchMandiGates,
  fetchMandis,
  getMandisForCurrentScope,
} from "../../services/mandiApi";
import {
  createLot,
  fetchLotManualFarmerContext,
  fetchLotTokenContext,
  fetchLotTokenSearch,
} from "../../services/lotsApi";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";
import { normalizeLanguageCode } from "../../config/languages";
import { useTranslation } from "react-i18next";

type Option = { value: string; label: string };
type SourceMode = "TOKEN" | "MANUAL";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export const LotsCreate: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language || DEFAULT_LANGUAGE);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [gateOptions, setGateOptions] = useState<Option[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGates, setLoadingGates] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [mandiLocked, setMandiLocked] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("TOKEN");
  const [tokenBody, setTokenBody] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenContext, setTokenContext] = useState<any>(null);
  const [tokenResults, setTokenResults] = useState<any[]>([]);
  const [tokenCreateCount, setTokenCreateCount] = useState(0);
  const [farmerIdentifier, setFarmerIdentifier] = useState("");
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [farmerContext, setFarmerContext] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const [form, setForm] = useState({
    mandi_id: "",
    gate_id: "",
    farmer_user_id: "",
    commodity_id: "",
    commodity_product_id: "",
    bags: "",
    weight_kg: "",
    quality_grade: "",
  });

  const orgId = useMemo(() => uiConfig.scope?.org_id || "", [uiConfig.scope?.org_id]);
  const manualAllowed = useMemo(() => {
    const role = String(uiConfig.role || "").toUpperCase();
    return role === "SUPER_ADMIN" || role === "ORG_ADMIN" || role === "MANDI_ADMIN";
  }, [uiConfig.role]);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetLotFields = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      commodity_id: "",
      commodity_product_id: "",
      bags: "",
      weight_kg: "",
      quality_grade: "",
    }));
    setProductOptions([]);
  }, []);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      if (orgId) {
        const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
        const options =
          (list || []).map((m: any) => ({
            value: String(m.mandi_id ?? m.mandiId ?? ""),
            label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
          }));
        setMandiOptions(options);
        if (options.length === 1) {
          setMandiLocked(true);
          setForm((prev) => ({ ...prev, mandi_id: options[0].value }));
        } else {
          setMandiLocked(false);
        }
      } else {
        const resp = await fetchMandis({ username, language, filters: { is_active: "Y" } });
        const list = resp?.data?.items || resp?.response?.data?.items || [];
        const options =
          (list || []).map((m: any) => ({
            value: String(m.mandi_id ?? m.mandiId ?? ""),
            label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
          }));
        setMandiOptions(options);
        if (options.length === 1) {
          setMandiLocked(true);
          setForm((prev) => ({ ...prev, mandi_id: options[0].value }));
        } else {
          setMandiLocked(false);
        }
      }
    } catch (_) {
      setMandiOptions([]);
      setMandiLocked(false);
    }
  }, [language, orgId]);

  const loadGates = useCallback(
    async (mandiId: string) => {
      const username = currentUsername();
      if (!username || !mandiId) {
        setGateOptions([]);
        return;
      }
      setLoadingGates(true);
      try {
        const filters: Record<string, any> = { is_active: "Y", mandi_id: Number(mandiId) };
        if (orgId) filters.org_id = orgId;
        const resp = await fetchMandiGates({ username, language, filters });
        const list = resp?.data?.items || resp?.response?.data?.items || [];
        setGateOptions(
          list.map((g: any) => ({
            value: String(g._id || g.gate_id || g.gate_code || g.code || ""),
            label: g.gate_name || g.gate_label || g.gate_code || g.code || "",
          })),
        );
      } finally {
        setLoadingGates(false);
      }
    },
    [language, orgId],
  );

  const loadCommodities = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchCommodities({ username, language, filters: { is_active: "Y" } });
      const list = resp?.data?.rows || resp?.data?.items || resp?.response?.data?.rows || resp?.response?.data?.items || [];
      setCommodityOptions(
        (list || []).map((c: any) => {
          const id = c.commodity_id ?? c._id ?? c.id ?? "";
          const label =
            c.commodity_name ||
            c.commodity_name_en ||
            c.commodity_name_hi ||
            c.display_label ||
            c.label ||
            c.name_i18n?.en ||
            c.name_i18n?.hi ||
            c.name ||
            null;
          return {
            value: String(id),
            label: label ? String(label) : `Commodity ${id}`,
          };
        }),
      );
    } catch (_) {
      setCommodityOptions([]);
    }
  }, [language]);

  const loadProducts = useCallback(
    async (commodityId: string) => {
      const username = currentUsername();
      if (!username || !commodityId) {
        setProductOptions([]);
        return;
      }
      setLoadingProducts(true);
      try {
        const resp = await fetchCommodityProducts({
          username,
          language,
          filters: { commodity_id: Number(commodityId), is_active: "Y", page: 1, pageSize: 500 },
        });
        const list = resp?.data?.rows || resp?.data?.items || resp?.response?.data?.rows || resp?.response?.data?.items || [];
        setProductOptions(
        (list || []).map((p: any) => {
          const id = p.product_id ?? p.commodity_product_id ?? p._id ?? "";
          const label =
            p.commodity_product_name ||
            p.product_name ||
            p.product_name_en ||
            p.product_name_hi ||
            p.display_label ||
            p.label ||
            p.label_i18n?.en ||
            p.label_i18n?.hi ||
            p.name ||
            null;
          return {
            value: String(id),
            label: label ? String(label) : `Product ${id}`,
          };
        }),
      );
      } finally {
        setLoadingProducts(false);
      }
    },
    [language],
  );

  useEffect(() => {
    loadMandis();
    loadCommodities();
  }, [loadMandis, loadCommodities]);

  useEffect(() => {
    if (sourceMode === "MANUAL" && form.mandi_id) {
      loadGates(form.mandi_id);
    } else {
      setGateOptions([]);
    }
  }, [form.mandi_id, loadGates, sourceMode]);

  const handleMandiChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      mandi_id: value,
      gate_id: "",
    }));
    setGateOptions([]);
  };

  useEffect(() => {
    if (form.commodity_id) {
      loadProducts(form.commodity_id);
    } else {
      setProductOptions([]);
    }
  }, [form.commodity_id, loadProducts]);

  const handleSourceChange = (_: React.MouseEvent<HTMLElement>, value: SourceMode | null) => {
    if (!value) return;
    setSourceMode(value);
    setTokenContext(null);
    setTokenBody("");
    setFarmerContext(null);
    setFarmerIdentifier("");
    setOverrideReason("");
    setTokenCreateCount(0);
    setForm((prev) => ({
      ...prev,
      mandi_id: mandiLocked ? prev.mandi_id : "",
      gate_id: "",
      farmer_user_id: "",
    }));
    resetLotFields();
  };

  const normalizeTokenBody = (value: string) => {
    const raw = String(value || "").trim();
    const upper = raw.toUpperCase();
    if (upper.startsWith("GT_")) {
      return upper.slice(3);
    }
    return upper;
  };

  const handleTokenInputChange = (value: string) => {
    setTokenBody(normalizeTokenBody(value));
    if (tokenContext) {
      setTokenContext(null);
      resetLotFields();
    }
    if (tokenResults.length) setTokenResults([]);
    if (tokenCreateCount) setTokenCreateCount(0);
  };

  const fullTokenCode = `GT_${tokenBody}`;
  const tokenBodyLength = tokenBody.length;
  const tokenThresholdMet = tokenBodyLength >= 5;

  const fetchTokenSearch = async () => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Missing admin session.", { variant: "error" });
      return;
    }
    if (!tokenBody.trim()) {
      enqueueSnackbar("Enter a token code.", { variant: "warning" });
      return;
    }
    if (!tokenThresholdMet) {
      enqueueSnackbar("Enter at least 8 characters to search.", { variant: "info" });
      return;
    }
    setTokenLoading(true);
    try {
      const resp = await fetchLotTokenSearch({
        username,
        language,
        token_code: fullTokenCode,
        org_id: orgId || undefined,
        mandi_id: form.mandi_id || undefined,
      });
      const payload =
        resp?.data?.matches ||
        resp?.response?.data?.matches ||
        resp?.data?.data?.matches ||
        [];
      const responseCode = resp?.response?.responsecode || resp?.data?.response?.responsecode;
      if (responseCode !== "0") {
        const msg =
          resp?.response?.description ||
          resp?.data?.response?.description ||
          "Unable to fetch token.";
        enqueueSnackbar(msg, { variant: "error" });
        setTokenResults([]);
        return;
      }
      const results = Array.isArray(payload) ? payload : [];
      setTokenResults(results);
      if (results.length === 0) {
        enqueueSnackbar("No matching tokens found.", { variant: "info" });
      }
      if (results.length === 1) {
        selectToken(results[0]);
      }
    } finally {
      setTokenLoading(false);
    }
  };

  const selectToken = async (selected: any) => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Missing admin session.", { variant: "error" });
      return;
    }
    const code = String(selected?.token_code || "").trim().toUpperCase();
    if (!code) return;
    setTokenLoading(true);
    try {
      const resp = await fetchLotTokenContext({
        username,
        language,
        token_code: code,
      });
      const payload =
        resp?.data?.token ||
        resp?.response?.data?.token ||
        resp?.data?.data?.token ||
        null;
      const responseCode = resp?.response?.responsecode || resp?.data?.response?.responsecode;
      if (responseCode !== "0" || !payload) {
        const msg =
          resp?.response?.description ||
          resp?.data?.response?.description ||
          "Unable to fetch token.";
        enqueueSnackbar(msg, { variant: "error" });
        setTokenContext(null);
        return;
      }
      setTokenContext(payload);
      setTokenResults([]);
      setTokenBody(normalizeTokenBody(payload?.token_code || code));
      setForm((prev) => ({
        ...prev,
        mandi_id: payload?.mandi_id ? String(payload.mandi_id) : prev.mandi_id,
        gate_id: payload?.gate_id ? String(payload.gate_id) : prev.gate_id,
        farmer_user_id: payload?.farmer_username || prev.farmer_user_id,
      }));
      enqueueSnackbar("Token selected.", { variant: "success" });
    } finally {
      setTokenLoading(false);
    }
  };

  const fetchManualFarmer = async () => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Missing admin session.", { variant: "error" });
      return;
    }
    const identifier = farmerIdentifier.trim();
    if (!identifier) {
      enqueueSnackbar("Enter farmer username or mobile.", { variant: "warning" });
      return;
    }
    if (!manualAllowed) {
      enqueueSnackbar("Manual mode is not allowed for your role.", { variant: "error" });
      return;
    }
    setFarmerLoading(true);
    try {
      const resp = await fetchLotManualFarmerContext({
        username,
        language,
        farmer_identifier: identifier,
      });
      const payload =
        resp?.data?.farmer ||
        resp?.response?.data?.farmer ||
        resp?.data?.data?.farmer ||
        null;
      const responseCode = resp?.response?.responsecode || resp?.data?.response?.responsecode;
      if (responseCode !== "0" || !payload) {
        const msg =
          resp?.response?.description ||
          resp?.data?.response?.description ||
          "Unable to fetch farmer.";
        enqueueSnackbar(msg, { variant: "error" });
        setFarmerContext(null);
        return;
      }
      setFarmerContext(payload);
      setForm((prev) => ({
        ...prev,
        farmer_user_id: payload?.user_id || payload?.username || prev.farmer_user_id,
      }));
      enqueueSnackbar("Farmer validated.", { variant: "success" });
    } finally {
      setFarmerLoading(false);
    }
  };

  const clearManualFarmer = () => {
    setFarmerContext(null);
    setFarmerIdentifier("");
    setForm((prev) => ({ ...prev, farmer_user_id: "" }));
    resetLotFields();
  };

  const canEditLotFields =
    sourceMode === "TOKEN"
      ? Boolean(tokenContext)
      : Boolean(farmerContext) && Boolean(overrideReason.trim());

  const canSubmit =
    canEditLotFields &&
    form.commodity_id &&
    form.commodity_product_id &&
    form.bags &&
    form.weight_kg &&
    form.quality_grade &&
    (sourceMode === "TOKEN" ? tokenContext : form.mandi_id && form.gate_id && farmerContext);

  const handleSubmit = async (mode: "SAVE" | "SAVE_ADD") => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Missing admin session.", { variant: "error" });
      return;
    }
    if (!canSubmit) {
      enqueueSnackbar("Please fill all required fields.", { variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        api_name: "createLot",
        country: DEFAULT_COUNTRY,
        source_mode: sourceMode,
        commodity_id: form.commodity_id,
        commodity_product_id: form.commodity_product_id,
        bags: Number(form.bags),
        weight_kg: Number(form.weight_kg),
        quality_grade: form.quality_grade,
      };
      if (orgId) payload.org_id = orgId;
      if (sourceMode === "TOKEN") {
        payload.token_code = tokenContext?.token_code || fullTokenCode;
        if (tokenContext?.mandi_id !== undefined && tokenContext?.mandi_id !== null) {
          payload.mandi_id = Number(tokenContext.mandi_id);
        }
        if (tokenContext?.gate_id) payload.gate_id = tokenContext.gate_id;
      } else {
        payload.mandi_id = Number(form.mandi_id);
        payload.gate_id = form.gate_id;
        payload.farmer_user_id = farmerContext?.user_id || farmerContext?.username || form.farmer_user_id;
        payload.override_reason = overrideReason.trim();
      }
      const resp = await createLot({
        username,
        language,
        payload,
      });
      const code = resp?.response?.responsecode || resp?.data?.response?.responsecode;
      if (code === "0") {
        if (mode === "SAVE_ADD" && sourceMode === "TOKEN") {
          setTokenCreateCount((prev) => prev + 1);
          resetLotFields();
          enqueueSnackbar("Lot created successfully. You can add another lot for this token.", { variant: "success" });
        } else {
          enqueueSnackbar("Lot created successfully.", { variant: "success" });
          navigate("/lots");
        }
      } else {
        const msg =
          resp?.response?.description ||
          resp?.data?.response?.description ||
          "Unable to create lot.";
        enqueueSnackbar(msg, { variant: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Button startIcon={<ArrowBackIosNewIcon />} onClick={() => navigate("/lots")}>
          Back
        </Button>
        <Typography variant="h5">Create Lot</Typography>
      </Stack>

      <Box sx={{ maxWidth: 720 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Source
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={sourceMode}
              onChange={handleSourceChange}
              size="small"
              color="primary"
            >
              <ToggleButton value="TOKEN">From Gate Token</ToggleButton>
              <ToggleButton value="MANUAL" disabled={!manualAllowed}>
                Emergency Manual Entry
              </ToggleButton>
            </ToggleButtonGroup>
            {!manualAllowed ? (
              <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                Manual entry is restricted to admin roles only.
              </Typography>
            ) : null}
          </Box>

          {sourceMode === "TOKEN" ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                <TextField
                  label="Token Code"
                  value={tokenBody}
                  onChange={(e) => handleTokenInputChange(e.target.value)}
                  fullWidth
                  required
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{
                          px: 1,
                          py: 0.5,
                          bgcolor: "action.hover",
                          borderRadius: 1,
                          mr: 1,
                          fontWeight: 600,
                        }}
                      >
                        GT_
                      </Box>
                    ),
                  }}
                  helperText={
                    tokenBodyLength < 5
                      ? `Entered: ${tokenBodyLength} characters after prefix`
                      : `Entered: ${tokenBodyLength} characters after prefix · Ready to search`
                  }
                />
                <Button
                  variant="contained"
                  onClick={fetchTokenSearch}
                  disabled={tokenLoading || !tokenThresholdMet}
                  sx={{ minWidth: 150 }}
                >
                  {tokenLoading ? "Searching..." : "Search"}
                </Button>
              </Stack>

              {tokenResults.length > 0 ? (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1">Select a Token</Typography>
                      <Divider />
                      {tokenResults.map((row, idx) => (
                        <Button
                          key={`${row.token_code || idx}`}
                          variant="outlined"
                          onClick={() => selectToken(row)}
                          sx={{
                            justifyContent: "flex-start",
                            textAlign: "left",
                            borderRadius: 2,
                            borderColor:
                              tokenContext?.token_code === row.token_code
                                ? "primary.main"
                                : "divider",
                            bgcolor:
                              tokenContext?.token_code === row.token_code
                                ? "action.selected"
                                : "background.paper",
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                        >
                          <Stack spacing={0.75} alignItems="flex-start" width="100%">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle2">
                                {row.token_code || "—"}
                              </Typography>
                              {row.status ? (
                                <Box
                                  sx={{
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: 1,
                                    bgcolor: row.status === "IN_YARD" ? "success.light" : "action.hover",
                                    color: row.status === "IN_YARD" ? "success.contrastText" : "text.secondary",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  {row.status}
                                </Box>
                              ) : null}
                            </Stack>
                            <Typography variant="body2">
                              {row.farmer_name || "—"} • {row.farmer_username || row.farmer_mobile || "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.vehicle_no || "—"} • {row.gate_name || "—"} • {row.mandi_name || "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Updated: {formatDateTime(row.updated_on)}
                            </Typography>
                          </Stack>
                        </Button>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}

              {tokenContext ? (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1">Token Summary</Typography>
                      <Divider />
                      {[
                        ["Token Code", tokenContext.token_code],
                        ["Org", tokenContext.org_name || tokenContext.org_id],
                        ["Mandi", tokenContext.mandi_name || tokenContext.mandi_id],
                        ["Gate", tokenContext.gate_name || tokenContext.gate_id],
                        ["Farmer", tokenContext.farmer_name || tokenContext.farmer_username],
                        ["Farmer Contact", tokenContext.farmer_mobile || tokenContext.farmer_username],
                        ["Vehicle", `${tokenContext.vehicle_no || "—"} (${tokenContext.vehicle_type || "—"})`],
                        ["Status", tokenContext.status],
                        ["Last Action", tokenContext.last_action],
                      ].map(([label, value]) => (
                        <Stack key={label} direction="row" spacing={1}>
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
                            {label}
                          </Typography>
                          <Typography variant="body2">{value || "—"}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    {tokenCreateCount > 0 ? (
                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                        Lots created in this session: {tokenCreateCount}
                      </Typography>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert severity="warning">
                Emergency manual mode should be used only when token-based creation is unavailable.
              </Alert>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                <TextField
                  label="Farmer Username / Mobile"
                  value={farmerIdentifier}
                  onChange={(e) => setFarmerIdentifier(e.target.value)}
                  fullWidth
                  required
                  disabled={!!farmerContext}
                />
                <Button
                  variant="contained"
                  onClick={fetchManualFarmer}
                  disabled={farmerLoading || !farmerIdentifier.trim() || !!farmerContext}
                  sx={{ minWidth: 150 }}
                >
                  {farmerLoading ? "Fetching..." : "Fetch Farmer"}
                </Button>
                {farmerContext ? (
                  <Button variant="text" onClick={clearManualFarmer}>
                    Change
                  </Button>
                ) : null}
              </Stack>

              {farmerContext ? (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle1">Farmer Summary</Typography>
                      <Divider />
                      <Typography variant="body2">
                        <strong>Name:</strong> {farmerContext.name || "—"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Username:</strong> {farmerContext.username || "—"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Mobile:</strong> {farmerContext.mobile || "—"}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Status:</strong> {farmerContext.status || "—"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}

              <TextField
                label="Override Reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                fullWidth
                required
                multiline
                minRows={2}
              />

              <TextField
                select
                label="Mandi"
                value={form.mandi_id}
                onChange={(e) => handleMandiChange(e.target.value)}
                fullWidth
                required
                disabled={mandiLocked}
              >
                {mandiOptions.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Gate"
                value={form.gate_id}
                onChange={(e) => updateField("gate_id", e.target.value)}
                fullWidth
                required
                disabled={!form.mandi_id || loadingGates}
              >
                {gateOptions.map((g) => (
                  <MenuItem key={g.value} value={g.value}>
                    {g.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          <TextField
            select
            label="Commodity"
            value={form.commodity_id}
            onChange={(e) => updateField("commodity_id", e.target.value)}
            fullWidth
            required
            disabled={!canEditLotFields}
          >
            {commodityOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Product"
            value={form.commodity_product_id}
            onChange={(e) => updateField("commodity_product_id", e.target.value)}
            fullWidth
            required
            disabled={!form.commodity_id || loadingProducts || !canEditLotFields}
          >
            {productOptions.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Bags"
              type="number"
              value={form.bags}
              onChange={(e) => updateField("bags", e.target.value)}
              fullWidth
              required
              disabled={!canEditLotFields}
            />
            <TextField
              label="Weight (kg)"
              type="number"
              value={form.weight_kg}
              onChange={(e) => updateField("weight_kg", e.target.value)}
              fullWidth
              required
              disabled={!canEditLotFields}
            />
          </Stack>

          <TextField
            select
            label="Quality Grade"
            value={form.quality_grade}
            onChange={(e) => updateField("quality_grade", e.target.value)}
            fullWidth
            required
            disabled={!canEditLotFields}
          >
            {["A", "B", "C"].map((grade) => (
              <MenuItem key={grade} value={grade}>
                {grade}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => handleSubmit("SAVE")}
              disabled={loading || !canSubmit}
            >
              Save
            </Button>
            {sourceMode === "TOKEN" && tokenContext ? (
              <Button
                variant="outlined"
                onClick={() => handleSubmit("SAVE_ADD")}
                disabled={loading || !canSubmit}
              >
                Save & Add Another
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </PageContainer>
  );
};

export default LotsCreate;
