import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CarOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  SaveOutlined,
  SearchOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { usePermissions } from "../../authz/usePermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchMandiGates } from "../../services/mandiApi";
import {
  fetchGateDevices,
  fetchGateEntryReasons,
  fetchGateVehicleTypesMaster,
} from "../../services/gateApi";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { fetchGateOperatorContext, issueGateToken } from "../../services/gateOpsApi";
import {
  searchPreMarketListingsForGate,
  markPreMarketArrival,
} from "../../services/preMarketListingsApi";
import "./gateEntryCreate.css";

type SelectOption = { value: string; label: string };

type GateEntryFormState = {
  vehicle_no: string;
  gate_code: string;
  device_code: string;
  reason_code: string;
  vehicle_type_code: string;
  notes: string;
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

function responseData(resp: any) {
  return resp?.data || resp?.response?.data || {};
}

export const GateEntryCreate: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { can, permissionsMap } = usePermissions();
  const uiConfig = useAdminUiConfig();
  const language = normalizeLanguageCode(DEFAULT_LANGUAGE);

  const canCreate = useMemo(
    () => can("gate_entry_tokens.create", "CREATE"),
    [can],
  );

  const [form, setForm] = useState<GateEntryFormState>({
    vehicle_no: "",
    gate_code: "",
    device_code: "",
    reason_code: "",
    vehicle_type_code: "",
    notes: "",
  });

  const [context, setContext] = useState({
    org_id: "",
    mandi_id: "" as string | number,
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
  const [submitting, setSubmitting] = useState(false);

  const isDebug = new URLSearchParams(window.location.search).get("debugAuth") === "1";

  const updateField = (key: keyof GateEntryFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadOperatorContext = async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchGateOperatorContext({ username, language });
      const ctx = responseData(resp)?.context || null;
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
    } catch {
      // Manual/scoped selection remains available when no operator context is bound.
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
      const resp = await fetchMandiGates({ username, language, filters });
      const list = responseData(resp)?.items || [];
      setGateOptions(
        list
          .map((g: any) => ({
            value: g.gate_code || g.code || g.slug || "",
            label: g.gate_name || g.gate_code || g.code || g.slug || "",
          }))
          .filter((option: SelectOption) => option.value),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load gates.");
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
      const list = responseData(resp)?.devices || [];
      setDeviceOptions(
        list
          .map((d: any) => ({
            value: d.device_code || d.device_id || "",
            label: d.device_label || d.device_name || d.device_code || d.device_id || "",
          }))
          .filter((option: SelectOption) => option.value),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load gate devices.");
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
      const resp = await fetchGateEntryReasons({
        username,
        language,
        filters: { is_active: "Y" },
      });
      const data = responseData(resp);
      const list = data?.reasons || data?.items || [];
      setReasonOptions(
        list
          .map((r: any) => ({
            value: r.reason_code || "",
            label:
              r.name_i18n?.[language] ||
              r.name_i18n?.en ||
              r.name_en ||
              r.display_label ||
              r.reason_code ||
              "",
          }))
          .filter((option: SelectOption) => option.value),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load gate entry reasons.");
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
      const data = responseData(resp);
      const list = data?.vehicle_types || data?.items || [];
      setVehicleTypes(
        list
          .map((v: any) => ({
            value: v.vehicle_type_code || v.code || "",
            label:
              v.name_i18n?.[language] ||
              v.name_i18n?.en ||
              v.display_label ||
              v.vehicle_type_name ||
              v.vehicle_type_code ||
              v.code ||
              "",
          }))
          .filter((option: SelectOption) => option.value),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load vehicle types.");
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
      messageApi.warning("Enter farmer mobile to search.");
      return;
    }
    if (!mandiId) {
      messageApi.warning("Missing mandi context.");
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
      const items = responseData(resp)?.items || [];
      setQuickLinkResults(items);
      if (!items.length) messageApi.info("No pre-market listings found.");
    } catch (err: any) {
      messageApi.error(err?.message || "Search failed.");
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
    void loadOperatorContext();
    void loadReasons();
    void loadVehicleTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadGates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.org_id, context.mandi_id, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (!form.gate_code) {
      setDeviceOptions([]);
      return;
    }
    void loadDevices(form.gate_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gate_code, context.org_id, context.mandi_id]);

  const handleSubmit = async () => {
    if (!canCreate || submitting) return;
    const username = currentUsername();
    if (!username) {
      messageApi.error("Not authorized.");
      return;
    }
    if (
      !form.gate_code.trim() ||
      !form.device_code.trim() ||
      !form.reason_code.trim() ||
      !form.vehicle_type_code.trim()
    ) {
      messageApi.warning("Select gate, device, entry reason and vehicle type.");
      return;
    }
    const scopedOrgId = context.org_id || uiConfig.scope?.org_id || "";
    const scopedMandiId = context.mandi_id ?? "";
    if (!scopedOrgId || scopedMandiId === "" || scopedMandiId === null || scopedMandiId === undefined) {
      messageApi.warning("Missing operator context (organisation/mandi).");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await issueGateToken({
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
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to issue token.";
      if (code !== "0") {
        messageApi.error(desc);
        return;
      }

      const data = responseData(resp);
      const tokenCode = data?.token_code || "";
      const tokenId = data?.gate_entry_token?._id || "";
      messageApi.success(`Token issued: ${tokenCode || "created"}`);

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
            messageApi.warning("Token created, but the pre-market listing could not be linked.");
          }
        } catch {
          messageApi.warning("Token created, but the pre-market listing could not be linked.");
        }
      }

      navigate(tokenCode ? `/gate-tokens/${encodeURIComponent(tokenCode)}` : "/gate-tokens");
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to issue token.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <PageContainer className="cm-gate-entry-create-page">
        {contextHolder}
        <Alert
          type="error"
          showIcon
          message="Access denied"
          description="You do not have permission to create a gate entry token."
        />
      </PageContainer>
    );
  }

  const scopeOrgLabel = context.org_id || String(uiConfig.scope?.org_id || "Not resolved");
  const scopeMandiLabel = context.mandi_id !== "" ? String(context.mandi_id) : "Not resolved";

  return (
    <PageContainer className="cm-gate-entry-create-page">
      {contextHolder}

      <CmPageHeader
        eyebrow="GATE & YARD"
        title="Create Gate Entry Token"
        subtitle="Capture the vehicle, gate and reason for entry. A pre-market listing can be linked when one exists."
        actions={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/gate-tokens")}>Back</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Issue Token
            </Button>
          </>
        }
      />

      {isDebug && (
        <Alert
          className="cm-gate-entry-debug"
          type="info"
          showIcon
          message={`canCreate: ${String(canCreate)} · permission keys: ${Object.keys(permissionsMap || {}).length}`}
        />
      )}

      <div className="cm-gate-entry-scope-strip">
        <div>
          <Typography.Text className="cm-gate-entry-scope-label">Working scope</Typography.Text>
          <Typography.Title level={5}>{scopeOrgLabel}</Typography.Title>
        </div>
        <Space size={8} wrap>
          <Tag icon={<ShopOutlined />}>Mandi {scopeMandiLabel}</Tag>
          {form.gate_code && <Tag color="processing">Gate {form.gate_code}</Tag>}
        </Space>
      </div>

      <Row gutter={[16, 16]} align="top">
        <Col xs={24} xl={9}>
          <CmSectionCard
            className="cm-gate-entry-card"
            title="Link pre-market listing"
            subtitle="Optional · search today's listing by farmer mobile"
          >
            <Space.Compact className="cm-gate-entry-search-row" block>
              <Input
                size="large"
                value={quickLinkMobile}
                onChange={(e) => setQuickLinkMobile(e.target.value)}
                placeholder="Farmer mobile number"
                prefix={<SearchOutlined />}
                onPressEnter={() => void handleSearchPreListings()}
              />
              <Button
                size="large"
                loading={quickLinkLoading}
                onClick={() => void handleSearchPreListings()}
              >
                Search
              </Button>
            </Space.Compact>

            {selectedPreListing ? (
              <div className="cm-gate-entry-selected-listing">
                <div className="cm-gate-entry-listing-heading">
                  <Space>
                    <CheckCircleOutlined />
                    <Typography.Text strong>Listing linked</Typography.Text>
                  </Space>
                  <Button type="link" danger onClick={clearPreListing}>Clear</Button>
                </div>
                <div className="cm-gate-entry-listing-grid">
                  <div><span>Farmer</span><strong>{selectedPreListing?.farmer?.name || "-"}</strong></div>
                  <div><span>Mobile</span><strong>{selectedPreListing?.farmer?.mobile || "-"}</strong></div>
                  <div><span>Commodity</span><strong>{selectedPreListing?.produce?.commodity_name || "-"}</strong></div>
                  <div><span>Bags</span><strong>{selectedPreListing?.produce?.quantity?.bags ?? "-"}</strong></div>
                </div>
              </div>
            ) : quickLinkResults.length ? (
              <div className="cm-gate-entry-listing-results">
                {quickLinkResults.map((item: any) => (
                  <button
                    className="cm-gate-entry-listing-result"
                    key={String(item._id)}
                    type="button"
                    onClick={() => selectPreListing(item)}
                  >
                    <div>
                      <strong>{item?.farmer?.name || item?.farmer?.mobile || "Farmer listing"}</strong>
                      <span>{item?.produce?.commodity_name || "Commodity not available"}</span>
                    </div>
                    <LinkOutlined />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                className="cm-gate-entry-empty"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Search only when this arrival relates to a pre-market listing."
              />
            )}
          </CmSectionCard>
        </Col>

        <Col xs={24} xl={15}>
          <CmSectionCard
            className="cm-gate-entry-card"
            title="Entry details"
            subtitle="Required operational information for issuing the token"
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <label className="cm-gate-entry-field-label">Vehicle number</label>
                <Input
                  size="large"
                  value={form.vehicle_no}
                  onChange={(e) => updateField("vehicle_no", e.target.value.toUpperCase())}
                  placeholder="e.g. UP14AB1234"
                  prefix={<CarOutlined />}
                  maxLength={24}
                />
              </Col>

              <Col xs={24} md={12}>
                <label className="cm-gate-entry-field-label">Gate <span>*</span></label>
                <Select
                  size="large"
                  value={form.gate_code || undefined}
                  options={gateOptions}
                  loading={loadingGates}
                  placeholder={loadingGates ? "Loading gates..." : "Select gate"}
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => {
                    updateField("gate_code", value);
                    updateField("device_code", "");
                  }}
                  notFoundContent={loadingGates ? <Spin size="small" /> : "No active gates found"}
                />
              </Col>

              <Col xs={24} md={12}>
                <label className="cm-gate-entry-field-label">Gate device <span>*</span></label>
                <Select
                  size="large"
                  value={form.device_code || undefined}
                  options={deviceOptions}
                  loading={loadingDevices}
                  disabled={!form.gate_code}
                  placeholder={!form.gate_code ? "Select a gate first" : "Select gate device"}
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => updateField("device_code", value)}
                  notFoundContent={loadingDevices ? <Spin size="small" /> : "No active devices for this gate"}
                />
              </Col>

              <Col xs={24} md={12}>
                <label className="cm-gate-entry-field-label">Entry reason <span>*</span></label>
                <Select
                  size="large"
                  value={form.reason_code || undefined}
                  options={reasonOptions}
                  loading={loadingReasons}
                  placeholder="Select entry reason"
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => updateField("reason_code", value)}
                  notFoundContent={loadingReasons ? <Spin size="small" /> : "No active reasons found"}
                />
              </Col>

              <Col xs={24} md={12}>
                <label className="cm-gate-entry-field-label">Vehicle type <span>*</span></label>
                <Select
                  size="large"
                  value={form.vehicle_type_code || undefined}
                  options={vehicleTypes}
                  loading={loadingVehicleTypes}
                  placeholder="Select vehicle type"
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => updateField("vehicle_type_code", value)}
                  notFoundContent={loadingVehicleTypes ? <Spin size="small" /> : "No active vehicle types found"}
                />
              </Col>

              <Col xs={24}>
                <label className="cm-gate-entry-field-label">Notes</label>
                <Input.TextArea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Optional operational notes"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  maxLength={500}
                  showCount
                />
              </Col>
            </Row>

            <Alert
              className="cm-gate-entry-form-hint"
              type="info"
              showIcon
              message="Gate devices are filtered by the selected gate. Reasons and vehicle types come from active controlled masters."
            />
          </CmSectionCard>
        </Col>
      </Row>
    </PageContainer>
  );
};
