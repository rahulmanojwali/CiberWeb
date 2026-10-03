import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Spin, Typography } from "antd";
import { ArrowLeftOutlined, SaveOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { fetchCommodityProducts, fetchMandiCommodityProducts, getMandisForCurrentScope } from "../../services/mandiApi";
import { upsertMandiPricePolicy } from "../../services/mandiPricePoliciesApi";
import { getStoredAdminUser } from "../../utils/session";
import "./mandiPricePolicies.css";

const { Text, Title } = Typography;
type Option = { value: string; label: string };

type FormState = {
  mandi_id: string;
  commodity_id: string;
  commodity_product_id: string;
  min_per_qtl: number | null;
  max_per_qtl: number | null;
  unit: string;
  effective_from: string;
  effective_to: string;
  enforcement_mode: string;
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

function toDateInput(value: any) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export const MandiPricePolicyCreate: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const editPolicy = (location.state as any)?.policy || null;
  const isEditMode = Boolean(editPolicy?._id);
  const canCreate = useMemo(() => can("mandi_price_policies.create", "CREATE"), [can]);
  const canEdit = useMemo(() => can("mandi_price_policies.edit", "UPDATE"), [can]);
  const canSave = isEditMode ? canEdit : canCreate;

  const orgId = uiConfig.scope?.org_id || "";
  const orgCode = uiConfig.scope?.org_code || "Organisation";

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [loadingMandis, setLoadingMandis] = useState(false);
  const [loadingCommodities, setLoadingCommodities] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commodityWarning, setCommodityWarning] = useState("");
  const [productWarning, setProductWarning] = useState("");
  const [form, setForm] = useState<FormState>({
    mandi_id: "",
    commodity_id: "",
    commodity_product_id: "",
    min_per_qtl: null,
    max_per_qtl: null,
    unit: "QTL",
    effective_from: "",
    effective_to: "",
    enforcement_mode: "WARN_ONLY",
  });

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    setLoadingMandis(true);
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
      const options: Option[] = (Array.isArray(list) ? list : [])
        .map((m: any) => ({ value: String(m.mandi_id ?? m.mandiId ?? ""), label: m.mandi_name || m.mandi_slug || String(m.mandi_id || "") }))
        .filter((m: Option) => Boolean(m.value));
      setMandiOptions(options);
      if (!editPolicy && options.length === 1) setForm((prev) => ({ ...prev, mandi_id: options[0].value }));
    } finally {
      setLoadingMandis(false);
    }
  }, [editPolicy, language, orgId]);

  const loadCommodities = useCallback(async (selectedMandi: string) => {
    const username = currentUsername();
    if (!username || !selectedMandi) { setCommodityOptions([]); return; }
    setLoadingCommodities(true);
    try {
      const resp = await fetchMandiCommodityProducts({ username, language, filters: { mandi_id: Number(selectedMandi), list_mode: "commodities", is_active: "Y", page: 1, pageSize: 500 } });
      const data = resp?.data || resp?.response?.data || {};
      const options: Option[] = (Array.isArray(data?.rows) ? data.rows : []).map((row: any) => ({
        value: String(row.commodity_id ?? row.id ?? ""),
        label: String(row.display_label || row.label || row?.label_i18n?.[language] || row?.label_i18n?.en || row.commodity_id || ""),
      })).filter((item: Option) => Boolean(item.value));
      setCommodityOptions(options);
      setCommodityWarning(options.length ? "" : "No active commodities are configured for this mandi.");
    } finally { setLoadingCommodities(false); }
  }, [language]);

  const loadProducts = useCallback(async (selectedMandi: string, commodityId: string) => {
    const username = currentUsername();
    if (!username || !selectedMandi || !commodityId) { setProductOptions([]); return; }
    setLoadingProducts(true);
    try {
      const mappingsResp = await fetchMandiCommodityProducts({ username, language, filters: { mandi_id: Number(selectedMandi), commodity_id: Number(commodityId), is_active: "Y", page: 1, pageSize: 500 } });
      const mappingData = mappingsResp?.data || mappingsResp?.response?.data || {};
      const mappedIds = new Set((Array.isArray(mappingData?.rows) ? mappingData.rows : []).map((row: any) => Number(row.product_id)).filter(Number.isFinite));
      const productsResp = await fetchCommodityProducts({ username, language, filters: { view: "IMPORTED", commodity_id: Number(commodityId), is_active: "Y", page: 1, pageSize: 500 } });
      const productData = productsResp?.data || productsResp?.response?.data || {};
      const options: Option[] = (Array.isArray(productData?.rows) ? productData.rows : [])
        .filter((row: any) => mappedIds.has(Number(row.product_id)))
        .map((row: any) => ({ value: String(row.product_id), label: String(row.commodity_product_name || row.name || row.display_label || row?.label_i18n?.[language] || row?.label_i18n?.en || row.product_id || "") }));
      setProductOptions(options);
      setProductWarning(options.length ? "" : "No active products are mapped to this commodity for the selected mandi.");
    } finally { setLoadingProducts(false); }
  }, [language]);

  useEffect(() => { loadMandis(); }, [loadMandis]);
  useEffect(() => { if (form.mandi_id) loadCommodities(form.mandi_id); }, [form.mandi_id, loadCommodities]);
  useEffect(() => { if (form.mandi_id && form.commodity_id) loadProducts(form.mandi_id, form.commodity_id); }, [form.commodity_id, form.mandi_id, loadProducts]);

  useEffect(() => {
    if (!editPolicy) return;
    setForm({
      mandi_id: String(editPolicy.mandi_id ?? ""),
      commodity_id: String(editPolicy.commodity_id ?? ""),
      commodity_product_id: String(editPolicy.commodity_product_id ?? ""),
      min_per_qtl: Number(editPolicy?.price_band?.min_per_qtl ?? editPolicy?.price_band?.min ?? 0),
      max_per_qtl: Number(editPolicy?.price_band?.max_per_qtl ?? editPolicy?.price_band?.max ?? 0),
      unit: editPolicy?.price_band?.unit || "QTL",
      effective_from: toDateInput(editPolicy?.effective?.from),
      effective_to: toDateInput(editPolicy?.effective?.to),
      enforcement_mode: editPolicy?.enforcement?.mode || "WARN_ONLY",
    });
  }, [editPolicy]);

  const onSubmit = async () => {
    const username = currentUsername();
    const country = getStoredAdminUser()?.country || "IN";
    if (!username || !orgId) return enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
    if (!canSave) return enqueueSnackbar("You do not have permission to save this price policy.", { variant: "warning" });
    if (!form.mandi_id || !form.commodity_id || !form.commodity_product_id || form.min_per_qtl == null || form.max_per_qtl == null || !form.effective_from) {
      return enqueueSnackbar("Complete all required fields before saving.", { variant: "warning" });
    }
    if (form.min_per_qtl < 0 || form.max_per_qtl < 0 || form.min_per_qtl > form.max_per_qtl) {
      return enqueueSnackbar("Price band must be non-negative and minimum cannot exceed maximum.", { variant: "warning" });
    }
    if (form.effective_to && new Date(form.effective_to) < new Date(form.effective_from)) {
      return enqueueSnackbar("Effective To cannot be earlier than Effective From.", { variant: "warning" });
    }

    setSaving(true);
    try {
      const resp = await upsertMandiPricePolicy({
        username,
        language,
        payload: {
          country,
          org_id: orgId,
          mandi_id: form.mandi_id,
          commodity_id: form.commodity_id,
          commodity_product_id: form.commodity_product_id,
          price_band: { min: form.min_per_qtl, max: form.max_per_qtl, unit: form.unit },
          effective: { from: new Date(form.effective_from), to: form.effective_to ? new Date(form.effective_to) : undefined },
          enforcement: { mode: form.enforcement_mode },
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") throw new Error(resp?.response?.description || "Failed to save policy.");
      enqueueSnackbar(isEditMode ? "Price policy updated." : "Price policy created.", { variant: "success" });
      navigate("/mandi-price-policies", { replace: true });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to save price policy.", { variant: "error" });
    } finally { setSaving(false); }
  };

  return (
    <PageContainer>
      <div className="cm-price-policies-page">
        <CmPageHeader
          eyebrow="MANDI COMMERCIAL CONTROLS"
          title={isEditMode ? "Edit Mandi Price Policy" : "Create Mandi Price Policy"}
          subtitle="Define the permitted price band and enforcement mode for a product already enabled in the selected mandi."
          actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/mandi-price-policies")}>Back</Button>}
        />

        <CmSectionCard className="cm-price-policy-scope-card">
          <div className="cm-price-policy-scope-grid">
            <div>
              <Text className="cm-price-policy-kicker">WORKING SCOPE</Text>
              <Title level={5} className="cm-price-policy-scope-title">{orgCode}</Title>
              <Text type="secondary">Only mandi-enabled commodities and products are selectable.</Text>
            </div>
            <Alert type="info" showIcon message="Price policies do not create catalogue products; they govern products already mapped to the mandi." />
          </div>
        </CmSectionCard>

        {!canSave ? <Alert type="warning" showIcon message="You have read access but not permission to save price policies." /> : null}

        <CmSectionCard className="cm-price-policy-form-card">
          <Spin spinning={loadingMandis || loadingCommodities || loadingProducts}>
            <div className="cm-price-policy-form-grid">
              <div className="cm-price-policy-field cm-price-policy-field-wide">
                <Text className="cm-price-policy-field-label">Mandi *</Text>
                <Select className="cm-price-policy-select" placeholder="Select mandi" value={form.mandi_id || undefined} options={mandiOptions} disabled={!canSave} onChange={(value) => setForm((prev) => ({ ...prev, mandi_id: value, commodity_id: "", commodity_product_id: "" }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Commodity *</Text>
                <Select className="cm-price-policy-select" placeholder="Select commodity" value={form.commodity_id || undefined} options={commodityOptions} disabled={!canSave || !form.mandi_id || loadingCommodities} onChange={(value) => setForm((prev) => ({ ...prev, commodity_id: value, commodity_product_id: "" }))} />
                {commodityWarning ? <Text type="warning">{commodityWarning}</Text> : null}
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Commodity product *</Text>
                <Select className="cm-price-policy-select" placeholder="Select product" value={form.commodity_product_id || undefined} options={productOptions} disabled={!canSave || !form.commodity_id || loadingProducts} onChange={(value) => setForm((prev) => ({ ...prev, commodity_product_id: value }))} />
                {productWarning ? <Text type="warning">{productWarning}</Text> : null}
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Minimum price / QTL *</Text>
                <InputNumber min={0} className="cm-price-policy-number" value={form.min_per_qtl} disabled={!canSave} onChange={(value) => setForm((prev) => ({ ...prev, min_per_qtl: value == null ? null : Number(value) }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Maximum price / QTL *</Text>
                <InputNumber min={0} className="cm-price-policy-number" value={form.max_per_qtl} disabled={!canSave} onChange={(value) => setForm((prev) => ({ ...prev, max_per_qtl: value == null ? null : Number(value) }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Unit *</Text>
                <Select className="cm-price-policy-select" value={form.unit} disabled={!canSave} options={[{ value: "QTL", label: "QTL" }]} onChange={(value) => setForm((prev) => ({ ...prev, unit: value }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Enforcement *</Text>
                <Select className="cm-price-policy-select" value={form.enforcement_mode} disabled={!canSave} options={[{ value: "WARN_ONLY", label: "Warn only" }, { value: "STRICT_BLOCK", label: "Strict block" }]} onChange={(value) => setForm((prev) => ({ ...prev, enforcement_mode: value }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Effective from *</Text>
                <Input type="date" value={form.effective_from} disabled={!canSave} onChange={(e) => setForm((prev) => ({ ...prev, effective_from: e.target.value }))} />
              </div>
              <div className="cm-price-policy-field">
                <Text className="cm-price-policy-field-label">Effective to</Text>
                <Input type="date" value={form.effective_to} disabled={!canSave} onChange={(e) => setForm((prev) => ({ ...prev, effective_to: e.target.value }))} />
              </div>
            </div>
          </Spin>
        </CmSectionCard>

        <div className="cm-price-policy-savebar">
          <div><Text strong>{isEditMode ? "Update existing policy" : "Create policy"}</Text><br /><Text type="secondary">Changes become available to downstream listing validation according to the selected effective dates.</Text></div>
          <div className="cm-price-policy-save-actions">
            <Button onClick={() => navigate("/mandi-price-policies")}>Cancel</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!canSave} onClick={onSubmit}>{isEditMode ? "Update policy" : "Save policy"}</Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
