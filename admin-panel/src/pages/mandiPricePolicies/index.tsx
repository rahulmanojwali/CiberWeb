import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DollarOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { usePermissions } from "../../authz/usePermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { normalizeLanguageCode } from "../../config/languages";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import {
  deactivateMandiPricePolicy,
  getMandiPricePolicies,
  upsertMandiPricePolicy,
} from "../../services/mandiPricePoliciesApi";
import { getStoredAdminUser } from "../../utils/session";
import "./mandiPricePolicies.css";

const { Text, Title } = Typography;

type Option = { value: string; label: string };
type PricePolicyRow = {
  _id?: string;
  mandi_id?: string | number;
  mandi_name?: string;
  commodity_id?: string | number;
  commodity_product_id?: string | number;
  price_band?: { min_per_qtl?: number; max_per_qtl?: number; min?: number; max?: number; unit?: string };
  effective?: { from?: string; to?: string | null };
  enforcement?: { mode?: string };
  is_active?: "Y" | "N" | string;
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

function moneyBand(row: PricePolicyRow) {
  const min = row?.price_band?.min_per_qtl ?? row?.price_band?.min;
  const max = row?.price_band?.max_per_qtl ?? row?.price_band?.max;
  const unit = row?.price_band?.unit || "QTL";
  if (min == null || max == null) return "—";
  return `₹${Number(min).toLocaleString("en-IN")} – ₹${Number(max).toLocaleString("en-IN")} / ${unit}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN");
}

export const MandiPricePolicies: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [rows, setRows] = useState<PricePolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mandiId, setMandiId] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const canView = useMemo(() => can("mandi_price_policies.list", "VIEW"), [can]);
  const canCreate = useMemo(() => can("mandi_price_policies.create", "CREATE"), [can]);
  const canEdit = useMemo(() => can("mandi_price_policies.edit", "UPDATE"), [can]);
  const canDeactivate = useMemo(() => can("mandi_price_policies.deactivate", "DEACTIVATE"), [can]);

  const orgId = uiConfig.scope?.org_id || "";
  const orgCode = uiConfig.scope?.org_code || "Organisation";

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !canView) return;
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
      const options: Option[] = (Array.isArray(list) ? list : [])
        .map((m: any) => ({
          value: String(m.mandi_id ?? m.mandiId ?? ""),
          label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
        }))
        .filter((m: Option) => Boolean(m.value));
      setMandiOptions(options);
      setMandiId((current) => {
        if (current && options.some((item) => item.value === current)) return current;
        if (options.length === 1) return options[0].value;
        const scoped = uiConfig.scope?.mandi_id != null ? String(uiConfig.scope.mandi_id) : "";
        if (scoped && options.some((item) => item.value === scoped)) return scoped;
        return "";
      });
    } catch (err: any) {
      setLoadError(err?.message || "Unable to load mandis for the current scope.");
    }
  }, [canView, language, orgId, uiConfig.scope?.mandi_id]);

  const loadPolicies = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !canView) return;
    setLoading(true);
    setLoadError(null);
    try {
      const resp = await getMandiPricePolicies({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: mandiId || undefined,
          active_only: status === "ACTIVE" ? "Y" : undefined,
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code && code !== "0") throw new Error(resp?.response?.description || "Failed to load price policies.");
      const data = resp?.data || resp?.response?.data || {};
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setLoadError(err?.message || "Failed to load mandi price policies.");
    } finally {
      setLoading(false);
    }
  }, [canView, language, mandiId, orgId, status]);

  useEffect(() => { loadMandis(); }, [loadMandis]);
  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const mandiMap = useMemo(() => new Map(mandiOptions.map((item) => [item.value, item.label])), [mandiOptions]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "INACTIVE" && row.is_active === "Y") return false;
      if (status === "ACTIVE" && row.is_active !== "Y") return false;
      if (!needle) return true;
      const mandi = mandiMap.get(String(row.mandi_id ?? "")) || row.mandi_name || "";
      return [row.commodity_product_id, row.commodity_id, mandi, row.enforcement?.mode]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [mandiMap, rows, search, status]);

  const stats = useMemo(() => ({
    total: visibleRows.length,
    active: visibleRows.filter((r) => r.is_active === "Y").length,
    inactive: visibleRows.filter((r) => r.is_active !== "Y").length,
    strict: visibleRows.filter((r) => String(r.enforcement?.mode || "").toUpperCase() === "STRICT_BLOCK").length,
  }), [visibleRows]);

  const handleToggle = useCallback(async (row: PricePolicyRow) => {
    const username = currentUsername();
    if (!username || !orgId) return;
    try {
      if (row.is_active === "Y") {
        if (!canDeactivate) return;
        await deactivateMandiPricePolicy({
          username,
          language,
          payload: { _id: row._id, org_id: orgId, mandi_id: row.mandi_id },
        });
        enqueueSnackbar("Price policy deactivated.", { variant: "success" });
      } else {
        if (!canEdit && !canCreate) return;
        const country = getStoredAdminUser()?.country || "IN";
        await upsertMandiPricePolicy({
          username,
          language,
          payload: {
            country,
            org_id: orgId,
            mandi_id: row.mandi_id,
            commodity_id: row.commodity_id,
            commodity_product_id: row.commodity_product_id,
            price_band: {
              min: row.price_band?.min_per_qtl ?? row.price_band?.min,
              max: row.price_band?.max_per_qtl ?? row.price_band?.max,
              unit: row.price_band?.unit || "QTL",
            },
            effective: { from: row.effective?.from, to: row.effective?.to || undefined },
            enforcement: { mode: row.enforcement?.mode || "WARN_ONLY" },
          },
        });
        enqueueSnackbar("Price policy activated.", { variant: "success" });
      }
      await loadPolicies();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to update price policy.", { variant: "error" });
    }
  }, [canCreate, canDeactivate, canEdit, enqueueSnackbar, language, loadPolicies, orgId]);

  const columns: ColumnsType<PricePolicyRow> = [
    {
      title: "Mandi / Product",
      key: "scope",
      render: (_, row) => (
        <div className="cm-price-policy-primary-cell">
          <Text strong>{mandiMap.get(String(row.mandi_id ?? "")) || row.mandi_name || `Mandi ${row.mandi_id ?? "—"}`}</Text>
          <Text type="secondary">Product ID: {row.commodity_product_id ?? "—"}</Text>
        </div>
      ),
    },
    { title: "Price band", key: "band", render: (_, row) => <Text strong>{moneyBand(row)}</Text> },
    {
      title: "Effective",
      key: "effective",
      render: (_, row) => (
        <div className="cm-price-policy-primary-cell">
          <Text>{formatDate(row.effective?.from)}</Text>
          <Text type="secondary">to {formatDate(row.effective?.to)}</Text>
        </div>
      ),
    },
    {
      title: "Enforcement",
      key: "mode",
      render: (_, row) => {
        const strict = String(row.enforcement?.mode || "").toUpperCase() === "STRICT_BLOCK";
        return <Tag color={strict ? "red" : "gold"}>{strict ? "Strict block" : "Warn only"}</Tag>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, row) => <Tag color={row.is_active === "Y" ? "green" : "default"}>{row.is_active === "Y" ? "Active" : "Inactive"}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, row) => (
        <div className="cm-price-policy-actions">
          {(canEdit || canCreate) && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/mandi-price-policies/create?id=${row._id}`, { state: { policy: row } })}
            />
          )}
          {(row.is_active === "Y" ? canDeactivate : canEdit || canCreate) && (
            <Button
              type="text"
              danger={row.is_active === "Y"}
              size="small"
              icon={row.is_active === "Y" ? <StopOutlined /> : <SafetyCertificateOutlined />}
              onClick={() => handleToggle(row)}
            />
          )}
        </div>
      ),
    },
  ];

  if (!canView) {
    return (
      <PageContainer>
        <Alert type="warning" showIcon message="You do not have permission to view Mandi Price Policies." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="cm-price-policies-page">
        <CmPageHeader
          eyebrow="MANDI COMMERCIAL CONTROLS"
          title="Mandi Price Policies"
          subtitle="Control mandi-level product price bands, effective periods and enforcement without exposing products outside the configured mandi catalogue."
          actions={(
            <Button icon={<ReloadOutlined />} onClick={loadPolicies} loading={loading}>Refresh</Button>
          )}
        />

        <CmSectionCard className="cm-price-policy-scope-card">
          <div className="cm-price-policy-scope-grid">
            <div>
              <Text className="cm-price-policy-kicker">WORKING SCOPE</Text>
              <Title level={5} className="cm-price-policy-scope-title">{orgCode}</Title>
              <Text type="secondary">Price policies remain organisation- and mandi-scoped. Products must already be enabled for the selected mandi.</Text>
            </div>
            <Alert type="info" showIcon message={`Organisation scope: ${orgCode}`} />
          </div>
        </CmSectionCard>

        <div className="cm-price-policy-stats">
          <CmStatCard label="Policies" value={stats.total} icon={<DollarOutlined />} helper="Current filtered catalogue" />
          <CmStatCard label="Active" value={stats.active} icon={<SafetyCertificateOutlined />} helper="Currently enforceable" />
          <CmStatCard label="Inactive" value={stats.inactive} icon={<StopOutlined />} helper="Retained policy history" />
          <CmStatCard label="Strict block" value={stats.strict} icon={<SafetyCertificateOutlined />} helper="Blocking enforcement" />
        </div>

        {loadError ? <Alert type="error" showIcon message={loadError} /> : null}

        <CmSectionCard className="cm-price-policy-table-card">
          <div className="cm-price-policy-toolbar">
            <Select
              className="cm-price-policy-select"
              value={mandiId || undefined}
              allowClear
              placeholder="All mandis"
              options={mandiOptions}
              onChange={(value) => setMandiId(value || "")}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search mandi, product ID or mode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="cm-price-policy-select cm-price-policy-status-select"
              value={status}
              onChange={(value) => setStatus(value)}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            {canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/mandi-price-policies/create")}>Create policy</Button>
            ) : null}
          </div>

          <Table<PricePolicyRow>
            rowKey={(row) => row._id || `${row.mandi_id}-${row.commodity_product_id}-${row.effective?.from || ""}`}
            loading={loading}
            columns={columns}
            dataSource={visibleRows}
            locale={{ emptyText: <Empty description="No mandi price policies found for this scope." /> }}
            pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (total) => `${total} policies` }}
            scroll={{ x: 900 }}
          />
        </CmSectionCard>
      </div>
    </PageContainer>
  );
};
