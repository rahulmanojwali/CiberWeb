import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  fetchCommodities,
  fetchCommodityProducts,
  fetchMandiGates,
  fetchMandis,
  getMandisForCurrentScope,
} from "../../services/mandiApi";
import { createLot } from "../../services/lotsApi";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { normalizeLanguageCode } from "../../config/languages";
import { useTranslation } from "react-i18next";

type Option = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
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

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const scopedMandiId = uiConfig.scope?.mandi_id ?? "";
    try {
      if (orgId) {
        const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
        setMandiOptions(
          (list || []).map((m: any) => ({
            value: String(m.mandi_id ?? m.mandiId ?? ""),
            label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
          })),
        );
      } else {
        const resp = await fetchMandis({ username, language, filters: { is_active: "Y" } });
        const list = resp?.data?.items || resp?.response?.data?.items || [];
        setMandiOptions(
          (list || []).map((m: any) => ({
            value: String(m.mandi_id ?? m.mandiId ?? ""),
            label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
          })),
        );
      }
      if (scopedMandiId) {
        updateField("mandi_id", String(scopedMandiId));
      }
    } catch (_) {
      setMandiOptions([]);
    }
  }, [language, orgId, uiConfig.scope?.mandi_id]);

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
        (list || []).map((c: any) => ({
          value: String(c.commodity_id ?? c._id ?? c.id ?? ""),
          label: c.commodity_name || c.label || c.name || String(c.commodity_id || ""),
        })),
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
          (list || []).map((p: any) => ({
            value: String(p.product_id ?? p.commodity_product_id ?? p._id ?? ""),
            label:
              p.commodity_product_name ||
              p.product_name ||
              p.label ||
              p.name ||
              String(p.product_id || p.commodity_product_id || ""),
          })),
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
    if (form.mandi_id) {
      loadGates(form.mandi_id);
    } else {
      setGateOptions([]);
    }
  }, [form.mandi_id, loadGates]);

  useEffect(() => {
    if (form.commodity_id) {
      loadProducts(form.commodity_id);
    } else {
      setProductOptions([]);
    }
  }, [form.commodity_id, loadProducts]);

  const handleSubmit = async () => {
    const username = currentUsername();
    if (!username) {
      enqueueSnackbar("Missing admin session.", { variant: "error" });
      return;
    }
    if (
      !form.mandi_id ||
      !form.gate_id ||
      !form.farmer_user_id ||
      !form.commodity_id ||
      !form.commodity_product_id ||
      !form.bags ||
      !form.weight_kg ||
      !form.quality_grade
    ) {
      enqueueSnackbar("Please fill all required fields.", { variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      const resp = await createLot({
        username,
        language,
        payload: {
          org_id: orgId || undefined,
          mandi_id: Number(form.mandi_id),
          gate_id: form.gate_id,
          farmer_user_id: form.farmer_user_id,
          commodity_id: form.commodity_id,
          commodity_product_id: form.commodity_product_id,
          bags: Number(form.bags),
          weight_kg: Number(form.weight_kg),
          quality_grade: form.quality_grade,
        },
      });
      const code = resp?.response?.responsecode || resp?.data?.response?.responsecode;
      if (code === "0") {
        enqueueSnackbar("Lot created successfully.", { variant: "success" });
        navigate("/lots");
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
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => updateField("mandi_id", e.target.value)}
            fullWidth
            required
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

          <TextField
            label="Farmer User ID / Username"
            value={form.farmer_user_id}
            onChange={(e) => updateField("farmer_user_id", e.target.value)}
            fullWidth
            required
          />

          <TextField
            select
            label="Commodity"
            value={form.commodity_id}
            onChange={(e) => updateField("commodity_id", e.target.value)}
            fullWidth
            required
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
            disabled={!form.commodity_id || loadingProducts}
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
            />
            <TextField
              label="Weight (kg)"
              type="number"
              value={form.weight_kg}
              onChange={(e) => updateField("weight_kg", e.target.value)}
              fullWidth
              required
            />
          </Stack>

          <TextField
            label="Quality Grade"
            value={form.quality_grade}
            onChange={(e) => updateField("quality_grade", e.target.value)}
            fullWidth
            required
          />

          <Stack direction="row" spacing={2}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={loading}>
              Save
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageContainer>
  );
};

export default LotsCreate;
