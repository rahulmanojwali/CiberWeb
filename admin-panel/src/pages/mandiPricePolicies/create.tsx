import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  fetchCommodityProducts,
  fetchMandiCommodityProducts,
  getMandisForCurrentScope,
} from "../../services/mandiApi";
import { upsertMandiPricePolicy } from "../../services/mandiPricePoliciesApi";
import { getStoredAdminUser } from "../../utils/session";

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

export const MandiPricePolicyCreate: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [loadingCommodities, setLoadingCommodities] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [commodityWarning, setCommodityWarning] = useState("");
  const [productWarning, setProductWarning] = useState("");

  const [form, setForm] = useState({
    mandi_id: "",
    commodity_id: "",
    commodity_product_id: "",
    min_per_qtl: "",
    max_per_qtl: "",
    unit: "QTL",
    effective_from: "",
    effective_to: "",
    enforcement_mode: "WARN_ONLY",
  });

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    const list = await getMandisForCurrentScope({
      username,
      language,
      org_id: orgId,
    });
    setMandiOptions(
      (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })),
    );
  }, [language, uiConfig.scope?.org_id]);

  const loadCommodities = useCallback(
    async (mandiId: string) => {
      const username = currentUsername();
      if (!username || !mandiId) {
        setCommodityOptions([]);
        setCommodityWarning("");
        return;
      }
      setLoadingCommodities(true);
      try {
        const resp = await fetchMandiCommodityProducts({
          username,
          language,
          filters: {
            mandi_id: Number(mandiId),
            list_mode: "commodities",
            is_active: "Y",
            page: 1,
            pageSize: 500,
          },
        });
        const data = resp?.data || resp?.response?.data || {};
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const options = rows.map((row: any) => ({
          value: String(row.commodity_id ?? row.id ?? ""),
          label: String(
            row.display_label ||
              row.label ||
              row?.label_i18n?.en ||
              row?.label_i18n?.hi ||
              row.commodity_id ||
              "",
          ),
        }));
        setCommodityOptions(options);
        setCommodityWarning(
          options.length ? "" : "No commodities configured for this mandi. Configure in Mandi Commodity Products.",
        );
      } finally {
        setLoadingCommodities(false);
      }
    },
    [language],
  );

  const loadProducts = useCallback(
    async (mandiId: string, commodityId: string) => {
      const username = currentUsername();
      if (!username || !mandiId || !commodityId) {
        setProductOptions([]);
        setProductWarning("");
        return;
      }
      setLoadingProducts(true);
      try {
        const mappingsResp = await fetchMandiCommodityProducts({
          username,
          language,
          filters: {
            mandi_id: Number(mandiId),
            commodity_id: Number(commodityId),
            is_active: "Y",
            page: 1,
            pageSize: 500,
          },
        });
        const mappingData = mappingsResp?.data || mappingsResp?.response?.data || {};
        const mappingRows = Array.isArray(mappingData?.rows) ? mappingData.rows : [];
        const mappedIds = new Set(
          mappingRows.map((row: any) => Number(row.product_id)).filter((val: any) => Number.isFinite(val)),
        );

        const productsResp = await fetchCommodityProducts({
          username,
          language,
          filters: {
            view: "IMPORTED",
            commodity_id: Number(commodityId),
            is_active: "Y",
            page: 1,
            pageSize: 500,
          },
        });
        const productData = productsResp?.data || productsResp?.response?.data || {};
        const productRows = Array.isArray(productData?.rows) ? productData.rows : [];
        const options = productRows
          .filter((row: any) => mappedIds.has(Number(row.product_id)))
          .map((row: any) => ({
            value: String(row.product_id),
            label: String(
              row.commodity_product_name ||
                row.name ||
                row.display_label ||
                row?.label_i18n?.en ||
                row.commodity_name ||
                row.product_id ||
                "",
            ),
          }));
        setProductOptions(options);
        setProductWarning(
          options.length ? "" : "No products configured for this commodity in this mandi.",
        );
      } finally {
        setLoadingProducts(false);
      }
    },
    [language],
  );

  useEffect(() => {
    loadMandis();
  }, [loadMandis]);

  const onSubmit = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    const country = getStoredAdminUser()?.country || "IN";
    if (!username || !orgId) {
      enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
      return;
    }

    const missing: string[] = [];
    if (!form.mandi_id) missing.push("Mandi");
    if (!form.commodity_product_id) missing.push("Commodity Product");
    if (!form.min_per_qtl) missing.push("Min per QTL");
    if (!form.max_per_qtl) missing.push("Max per QTL");
    if (!form.effective_from) missing.push("Effective From");
    if (missing.length) {
      enqueueSnackbar(`Missing: ${missing.join(", ")}`, { variant: "warning" });
      return;
    }

    const payload = {
      country,
      org_id: orgId,
      mandi_id: form.mandi_id,
      commodity_id: form.commodity_id || undefined,
      commodity_product_id: form.commodity_product_id,
      price_band: {
        min: Number(form.min_per_qtl),
        max: Number(form.max_per_qtl),
        unit: form.unit,
      },
      effective: {
        from: new Date(form.effective_from),
        to: form.effective_to ? new Date(form.effective_to) : undefined,
      },
      enforcement: { mode: form.enforcement_mode },
    };

    const resp = await upsertMandiPricePolicy({
      username,
      language,
      payload,
    });
    const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
    if (code !== "0") {
      const desc = resp?.response?.description || "Failed to save policy.";
      enqueueSnackbar(desc, { variant: "error" });
      return;
    }
    enqueueSnackbar("Policy saved.", { variant: "success" });
    navigate("/mandi-price-policies", { replace: true });
  };

  return (
    <PageContainer>
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h5">Create Mandi Price Policy</Typography>
      </Stack>

      <Box sx={{ maxWidth: 820 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => {
              const nextMandi = e.target.value;
              setForm((prev) => ({
                ...prev,
                mandi_id: nextMandi,
                commodity_id: "",
                commodity_product_id: "",
              }));
              setProductOptions([]);
              setProductWarning("");
              loadCommodities(nextMandi);
            }}
            required
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          {commodityWarning ? (
            <Typography variant="caption" color="warning.main">
              {commodityWarning}
            </Typography>
          ) : null}
          <TextField
            select
            label="Commodity"
            value={form.commodity_id}
            onChange={(e) => {
              const nextCommodity = e.target.value;
              setForm((prev) => ({
                ...prev,
                commodity_id: nextCommodity,
                commodity_product_id: "",
              }));
              setProductOptions([]);
              setProductWarning("");
              loadProducts(form.mandi_id, nextCommodity);
            }}
            disabled={!form.mandi_id || loadingCommodities}
          >
            {commodityOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          {loadingCommodities ? <LinearProgress /> : null}
          <TextField
            select
            label="Commodity Product"
            value={form.commodity_product_id}
            onChange={(e) => setForm((prev) => ({ ...prev, commodity_product_id: e.target.value }))}
            required
            disabled={!form.commodity_id || loadingProducts}
          >
            {productOptions.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          {loadingProducts ? <LinearProgress /> : null}
          {productWarning ? (
            <Typography variant="caption" color="warning.main">
              {productWarning}
            </Typography>
          ) : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Min per QTL"
              type="number"
              value={form.min_per_qtl}
              onChange={(e) => setForm((prev) => ({ ...prev, min_per_qtl: e.target.value }))}
              required
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Max per QTL"
              type="number"
              value={form.max_per_qtl}
              onChange={(e) => setForm((prev) => ({ ...prev, max_per_qtl: e.target.value }))}
              required
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              sx={{ minWidth: 140 }}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Effective From"
              type="date"
              value={form.effective_from}
              onChange={(e) => setForm((prev) => ({ ...prev, effective_from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              required
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Effective To"
              type="date"
              value={form.effective_to}
              onChange={(e) => setForm((prev) => ({ ...prev, effective_to: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
            <TextField
              select
              label="Enforcement Mode"
              value={form.enforcement_mode}
              onChange={(e) => setForm((prev) => ({ ...prev, enforcement_mode: e.target.value }))}
              sx={{ minWidth: 200 }}
            >
              {["WARN_ONLY", "STRICT_BLOCK"].map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate("/mandi-price-policies")}>
              Cancel
            </Button>
            <Button variant="contained" onClick={onSubmit}>
              Save Policy
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageContainer>
  );
};
