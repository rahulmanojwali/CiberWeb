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
import { createPreMarketListing } from "../../services/preMarketListingsApi";
import { getStoredAdminUser } from "../../utils/session";
import { getMandiPricePolicies } from "../../services/mandiPricePoliciesApi";

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

function todayLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const PreMarketListingCreate: React.FC = () => {
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
  const [policyBand, setPolicyBand] = useState<{ min: number; max: number; unit: string } | null>(null);
  const [policyMode, setPolicyMode] = useState<string | null>(null);
  const [policyMissing, setPolicyMissing] = useState(false);

  const [form, setForm] = useState({
    market_date: todayLocal(),
    mandi_id: "",
    commodity_id: "",
    commodity_product_id: "",
    bags: "",
    weight_per_bag_kg: "",
    target_per_qtl: "",
    min_per_qtl: "",
    scheme_type: "NONE",
    value_type: "PER_QTL",
    scheme_value: "",
    cap_amount: "",
    valid_till: "",
    scheme_notes: "",
    farmer_name: "",
    farmer_mobile: "",
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

  const selectedCommodityLabel = useMemo(() => {
    const opt = commodityOptions.find((c) => c.value === form.commodity_id);
    return opt?.label || "";
  }, [commodityOptions, form.commodity_id]);

  const selectedProductLabel = useMemo(() => {
    const opt = productOptions.find((c) => c.value === form.commodity_product_id);
    return opt?.label || "";
  }, [productOptions, form.commodity_product_id]);

  const outOfBand = useMemo(() => {
    if (!policyBand) return false;
    const min = policyBand.min;
    const max = policyBand.max;
    const minVal = form.min_per_qtl ? Number(form.min_per_qtl) : null;
    const targetVal = form.target_per_qtl ? Number(form.target_per_qtl) : null;
    if (minVal !== null && minVal < min) return true;
    if (targetVal !== null && targetVal > max) return true;
    return false;
  }, [form.min_per_qtl, form.target_per_qtl, policyBand]);

  const currencyPrefix = useMemo(() => {
    const country = String(getStoredAdminUser()?.country || "IN").toUpperCase();
    if (country === "IN") return "₹";
    return "";
  }, []);

  const loadPolicyBand = useCallback(
    async (mandiId: string, productId: string) => {
      const username = currentUsername();
      const orgId = uiConfig.scope?.org_id || "";
      const country = getStoredAdminUser()?.country || "IN";
      if (!username || !orgId || !mandiId || !productId) {
        setPolicyBand(null);
        setPolicyMode(null);
        setPolicyMissing(false);
        return;
      }
      const resp = await getMandiPricePolicies({
        username,
        language,
        filters: {
          country,
          org_id: orgId,
          mandi_id: mandiId,
          commodity_product_id: productId,
          active_only: "Y",
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      if (!rows.length) {
        setPolicyBand(null);
        setPolicyMode(null);
        setPolicyMissing(true);
        return;
      }
      const latest = rows[0];
      const band = latest?.price_band || {};
      const minVal = Number(band.min_per_qtl ?? band.min);
      const maxVal = Number(band.max_per_qtl ?? band.max);
      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
        setPolicyBand(null);
        setPolicyMissing(true);
        setPolicyMode(null);
        return;
      }
      setPolicyBand({
        min: minVal,
        max: maxVal,
        unit: String(band.unit || "QTL"),
      });
      setPolicyMode(String(latest?.enforcement?.mode || "WARN_ONLY"));
      setPolicyMissing(false);
    },
    [language, uiConfig.scope?.org_id],
  );

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
    if (!form.commodity_id) missing.push("Commodity");
    if (!form.commodity_product_id) missing.push("Commodity Product");
    if (!form.bags) missing.push("Bags");
    if (!form.farmer_name) missing.push("Farmer Name");
    if (!form.farmer_mobile) missing.push("Farmer Mobile");

    if (missing.length) {
      enqueueSnackbar(`Missing: ${missing.join(", ")}`, { variant: "warning" });
      return;
    }

    if (policyMode && policyMode.toUpperCase() === "STRICT_BLOCK" && outOfBand) {
      enqueueSnackbar("Price out of allowed band for this mandi.", { variant: "error" });
      return;
    }

    const now = new Date();
    const payload = {
      username,
      language,
      country,
      org_id: orgId,
      mandi_id: form.mandi_id,
      market_day: { date: new Date(form.market_date) },
      status: "PRE_LISTED",
      created_on: now,
      updated_on: now,
      created_by: username,
      updated_by: username,
      farmer: {
        farmer_id: "TEMP_FRONTEND",
        name: form.farmer_name,
        mobile: form.farmer_mobile,
      },
      produce: {
        commodity_id: Number(form.commodity_id),
        commodity_product_id: Number(form.commodity_product_id),
        commodity_name: selectedProductLabel || selectedCommodityLabel,
        quantity: {
          bags: Number(form.bags),
          weight_per_bag_kg: form.weight_per_bag_kg ? Number(form.weight_per_bag_kg) : undefined,
        },
        expected_price:
          form.min_per_qtl || form.target_per_qtl
            ? {
                min_per_qtl: form.min_per_qtl ? Number(form.min_per_qtl) : undefined,
                target_per_qtl: form.target_per_qtl ? Number(form.target_per_qtl) : undefined,
                unit: "QTL",
              }
            : undefined,
        offer_scheme:
          form.scheme_type && form.scheme_type !== "NONE"
            ? {
                scheme_type: form.scheme_type,
                value_type: form.value_type,
                value: form.scheme_value ? Number(form.scheme_value) : undefined,
                cap_amount: form.cap_amount ? Number(form.cap_amount) : undefined,
                valid_till: form.valid_till ? new Date(form.valid_till) : undefined,
                notes: form.scheme_notes || undefined,
              }
            : undefined,
      },
    };

    const resp = await createPreMarketListing(payload);
    const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
    if (code !== "0") {
      const desc =
        resp?.response?.description ||
        resp?.data?.description ||
        "Failed to create listing.";
      enqueueSnackbar(desc, { variant: "error" });
      return;
    }

    enqueueSnackbar("Pre-market listing created.", { variant: "success" });
    navigate("/pre-market-listings", { replace: true });
  };

  return (
    <PageContainer>
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h5">Create Pre-Market Listing</Typography>
        <Typography variant="body2" color="text.secondary">
          Capture farmer arrivals before gate entry.
        </Typography>
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
              setPolicyBand(null);
              setPolicyMode(null);
              setPolicyMissing(false);
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
              setPolicyBand(null);
              setPolicyMode(null);
              setPolicyMissing(false);
              loadProducts(form.mandi_id, nextCommodity);
            }}
            required
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
            onChange={(e) => {
              const nextProduct = e.target.value;
              setForm((prev) => ({ ...prev, commodity_product_id: nextProduct }));
              loadPolicyBand(form.mandi_id, nextProduct);
            }}
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
          {policyBand ? (
            <Typography variant="caption" color="text.secondary">
              Allowed band:{" "}
              <Box component="span" sx={{ fontWeight: 700 }}>
                {currencyPrefix}
                {policyBand.min}–{currencyPrefix}
                {policyBand.max}
              </Box>{" "}
              per {policyBand.unit}
            </Typography>
          ) : null}
          {policyMissing ? (
            <Typography variant="caption" color="warning.main">
              No price policy configured for this mandi/product.
            </Typography>
          ) : null}
          {outOfBand && policyMode?.toUpperCase() === "WARN_ONLY" ? (
            <Typography variant="caption" color="warning.main">
              Entered price is outside allowed band (WARN_ONLY).
            </Typography>
          ) : null}
          {outOfBand && policyMode?.toUpperCase() === "STRICT_BLOCK" ? (
            <Typography variant="caption" color="error.main">
              Entered price is outside allowed band (STRICT_BLOCK).
            </Typography>
          ) : null}
          {productWarning ? (
            <Typography variant="caption" color="warning.main">
              {productWarning}
            </Typography>
          ) : null}
          <TextField
            label="Bags"
            type="number"
            value={form.bags}
            onChange={(e) => setForm((prev) => ({ ...prev, bags: e.target.value }))}
            required
          />
          <TextField
            label="Weight per bag (kg)"
            type="number"
            value={form.weight_per_bag_kg}
            onChange={(e) => setForm((prev) => ({ ...prev, weight_per_bag_kg: e.target.value }))}
          />
          <TextField
            label="Expected price (Target per QTL)"
            type="number"
            value={form.target_per_qtl}
            onChange={(e) => setForm((prev) => ({ ...prev, target_per_qtl: e.target.value }))}
          />
          <TextField
            label="Minimum price (Min per QTL)"
            type="number"
            value={form.min_per_qtl}
            onChange={(e) => setForm((prev) => ({ ...prev, min_per_qtl: e.target.value }))}
          />
          <Typography variant="subtitle1">Offer Scheme (optional)</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              select
              label="Scheme Type"
              value={form.scheme_type}
              onChange={(e) => setForm((prev) => ({ ...prev, scheme_type: e.target.value }))}
              sx={{ minWidth: 180 }}
            >
              {["NONE", "DISCOUNT", "CASHBACK", "POINTS"].map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Value Type"
              value={form.value_type}
              onChange={(e) => setForm((prev) => ({ ...prev, value_type: e.target.value }))}
              sx={{ minWidth: 180 }}
              disabled={form.scheme_type === "NONE"}
            >
              {["PER_QTL", "PERCENT", "FIXED"].map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Value"
              type="number"
              value={form.scheme_value}
              onChange={(e) => setForm((prev) => ({ ...prev, scheme_value: e.target.value }))}
              disabled={form.scheme_type === "NONE"}
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Cap Amount (optional)"
              type="number"
              value={form.cap_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, cap_amount: e.target.value }))}
              disabled={form.scheme_type === "NONE"}
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Valid Till (optional)"
              type="date"
              value={form.valid_till}
              onChange={(e) => setForm((prev) => ({ ...prev, valid_till: e.target.value }))}
              disabled={form.scheme_type === "NONE"}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
          </Stack>
          <TextField
            label="Offer Notes (optional)"
            value={form.scheme_notes}
            onChange={(e) => setForm((prev) => ({ ...prev, scheme_notes: e.target.value }))}
            multiline
            minRows={2}
            disabled={form.scheme_type === "NONE"}
          />
          <TextField
            label="Farmer Name"
            value={form.farmer_name}
            onChange={(e) => setForm((prev) => ({ ...prev, farmer_name: e.target.value }))}
            required
          />
          <TextField
            label="Farmer Mobile"
            value={form.farmer_mobile}
            onChange={(e) => setForm((prev) => ({ ...prev, farmer_mobile: e.target.value }))}
            required
          />
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => navigate("/pre-market-listings")}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onSubmit}
              disabled={policyMode?.toUpperCase() === "STRICT_BLOCK" && outOfBand}
            >
              Create Listing
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageContainer>
  );
};
