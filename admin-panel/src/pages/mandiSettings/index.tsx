import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  DashboardOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getMandiSettings, upsertMandiSettings } from "../../services/mandiSettingsApi";
import "./mandiSettings.css";

const { Text, Title } = Typography;

type Option = { value: string; label: string };

type ToggleRowProps = {
  label: string;
  helper: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
};

const LOT_CREATION_OPTIONS = [
  { value: "", label: "Use Organisation Default" },
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
];

const MANDI_ASSOCIATION_APPROVAL_OPTIONS = [
  "MANUAL_APPROVAL",
  "AUTO_APPROVE",
  "AUTO_APPROVE_EXISTING_USER_ONLY",
  "MANDI_ADMIN_APPROVAL",
  "ORG_ADMIN_APPROVAL",
];

const PRELISTING_APPROVAL_OPTIONS = [
  { value: "AUTO", label: "Auto" },
  { value: "MANUAL", label: "Manual Review" },
  { value: "TRUST", label: "Trust Score Based" },
];

const APPROVAL_MODE_LABELS: Record<string, string> = {
  MANUAL_APPROVAL: "Manual Approval",
  AUTO_APPROVE: "Auto Approve",
  AUTO_APPROVE_EXISTING_USER_ONLY: "Auto Approve Existing Users Only",
  MANDI_ADMIN_APPROVAL: "Mandi Admin Approval",
  ORG_ADMIN_APPROVAL: "Organisation Admin Approval",
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

function labelFromEnum(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  return (
    APPROVAL_MODE_LABELS[normalized] ||
    normalized
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function ToggleRow({ label, helper, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="cm-mandi-settings-toggle-row">
      <div className="cm-mandi-settings-toggle-copy">
        <Text strong>{label}</Text>
        <Text type="secondary">{helper}</Text>
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function FieldShell({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="cm-mandi-settings-field">
      <Text className="cm-mandi-settings-field-label">{label}</Text>
      {children}
      {helper ? <Text type="secondary" className="cm-mandi-settings-field-helper">{helper}</Text> : null}
    </div>
  );
}

export const MandiSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [approvalMode, setApprovalMode] = useState("AUTO");
  const [trustMinScore, setTrustMinScore] = useState("");
  const [lotCreationMode, setLotCreationMode] = useState("");
  const [effectiveLotCreationMode, setEffectiveLotCreationMode] = useState("STRICT_ADMIN_ONLY");
  const [effectiveLotCreationSource, setEffectiveLotCreationSource] = useState("DEFAULT");
  const [maxLiveSessions, setMaxLiveSessions] = useState("");
  const [maxOpenSessions, setMaxOpenSessions] = useState("");
  const [maxQueuePerLane, setMaxQueuePerLane] = useState("");
  const [maxTotalQueuedLots, setMaxTotalQueuedLots] = useState("");
  const [allowOverflowLanes, setAllowOverflowLanes] = useState(true);
  const [farmerAssociationApprovalMode, setFarmerAssociationApprovalMode] = useState("MANUAL_APPROVAL");
  const [traderAssociationApprovalMode, setTraderAssociationApprovalMode] = useState("MANUAL_APPROVAL");
  const [allowFarmerMultiMandi, setAllowFarmerMultiMandi] = useState(true);
  const [allowTraderMultiMandi, setAllowTraderMultiMandi] = useState(true);
  const [requireFarmerDocuments, setRequireFarmerDocuments] = useState(false);
  const [requireTraderDocuments, setRequireTraderDocuments] = useState(false);
  const [allowFarmerGateTokenWithoutApproval, setAllowFarmerGateTokenWithoutApproval] = useState(false);
  const [allowTraderBidWithoutApproval, setAllowTraderBidWithoutApproval] = useState(false);
  const [maxPendingMandiRequests, setMaxPendingMandiRequests] = useState("5");
  const [saving, setSaving] = useState(false);
  const [loadingMandis, setLoadingMandis] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const canView = useMemo(() => can("mandi_settings.menu", "VIEW"), [can]);
  const canEdit = useMemo(() => can("mandi_settings.edit", "UPDATE"), [can]);
  const orgId = uiConfig.scope?.org_id || "";
  const orgCode = uiConfig.scope?.org_code || "Organisation";
  const roleScope = String(uiConfig.scope?.role_scope || "").toUpperCase();

  const selectedMandiLabel = useMemo(
    () => mandiOptions.find((m) => m.value === selectedMandi)?.label || "No mandi selected",
    [mandiOptions, selectedMandi],
  );

  const readOnly = !canEdit || !selectedMandi || loadingSettings;

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !canView) return;
    setLoadingMandis(true);
    setLoadError(null);
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
      const nextOptions: Option[] = (Array.isArray(list) ? list : [])
        .map((m: any) => ({
          value: String(m.mandi_id ?? m.mandiId ?? ""),
          label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
        }))
        .filter((m: Option) => Boolean(m.value));

      setMandiOptions(nextOptions);
      setSelectedMandi((current) => {
        if (current && nextOptions.some((item) => item.value === current)) return current;
        if (nextOptions.length === 1) return nextOptions[0].value;
        const scopedMandi = uiConfig.scope?.mandi_id != null ? String(uiConfig.scope.mandi_id) : "";
        if (scopedMandi && nextOptions.some((item) => item.value === scopedMandi)) return scopedMandi;
        return "";
      });
    } catch (err: any) {
      setMandiOptions([]);
      setLoadError(err?.message || "Unable to load mandis for the current scope.");
    } finally {
      setLoadingMandis(false);
    }
  }, [canView, language, orgId, uiConfig.scope?.mandi_id]);

  const loadSettings = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !selectedMandi) return;
    setLoadingSettings(true);
    setLoadError(null);
    try {
      const resp = await getMandiSettings({
        username,
        language,
        filters: { org_id: orgId, mandi_id: selectedMandi },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code && code !== "0") {
        throw new Error(resp?.response?.description || "Failed to load mandi settings.");
      }

      const data = resp?.data || resp?.response?.data || {};
      const settings = data?.settings || {};
      const mode = String(settings?.pre_listing?.approval_mode || "AUTO").toUpperCase();
      setApprovalMode(mode);
      setTrustMinScore(settings?.pre_listing?.trust_min_score?.toString?.() || "");
      setLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "").toUpperCase());
      setEffectiveLotCreationMode(String(data?.effective_workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
      setEffectiveLotCreationSource(String(data?.effective_workflow_policies?.source || "DEFAULT").toUpperCase());

      const capacity = settings?.workflow_policies?.auction?.capacity || {};
      setMaxLiveSessions(capacity?.max_live_sessions?.toString?.() || "");
      setMaxOpenSessions(capacity?.max_open_sessions?.toString?.() || "");
      setMaxQueuePerLane(capacity?.max_queue_per_lane?.toString?.() || "");
      setMaxTotalQueuedLots(capacity?.max_total_queued_lots?.toString?.() || "");
      setAllowOverflowLanes(capacity?.allow_overflow_lanes !== false);

      const association = settings?.workflow_policies?.mandi_association || {};
      setFarmerAssociationApprovalMode(String(settings?.farmer_mandi_approval_mode || association?.farmer_approval_mode || "MANUAL_APPROVAL").toUpperCase());
      setTraderAssociationApprovalMode(String(settings?.trader_mandi_approval_mode || association?.trader_approval_mode || "MANUAL_APPROVAL").toUpperCase());
      setAllowFarmerMultiMandi(association?.allow_farmer_multi_mandi !== false);
      setAllowTraderMultiMandi(association?.allow_trader_multi_mandi !== false);
      setRequireFarmerDocuments(association?.require_farmer_documents_for_mandi === true);
      setRequireTraderDocuments(association?.require_trader_documents_for_mandi === true);
      setAllowFarmerGateTokenWithoutApproval(association?.allow_farmer_gate_token_without_mandi_approval === true);
      setAllowTraderBidWithoutApproval(association?.allow_trader_bid_without_mandi_approval === true);
      setMaxPendingMandiRequests((settings?.max_pending_mandi_requests_per_user ?? association?.max_pending_mandi_requests_per_user ?? 5).toString());
      setIsDirty(false);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load mandi settings.");
    } finally {
      setLoadingSettings(false);
    }
  }, [language, orgId, selectedMandi]);

  useEffect(() => {
    loadMandis();
  }, [loadMandis]);

  useEffect(() => {
    if (selectedMandi) loadSettings();
  }, [loadSettings, selectedMandi]);

  const markDirty = () => setIsDirty(true);

  const onSave = async () => {
    const username = currentUsername();
    if (!username || !orgId || !selectedMandi) {
      enqueueSnackbar("Please select a mandi.", { variant: "warning" });
      return;
    }
    if (!canEdit) {
      enqueueSnackbar("You do not have permission to update mandi settings.", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const resp = await upsertMandiSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: selectedMandi,
          pre_listing: {
            approval_mode: approvalMode,
            trust_min_score: approvalMode === "TRUST" && trustMinScore ? Number(trustMinScore) : undefined,
          },
          farmer_mandi_approval_mode: farmerAssociationApprovalMode,
          trader_mandi_approval_mode: traderAssociationApprovalMode,
          max_pending_mandi_requests_per_user: maxPendingMandiRequests ? Number(maxPendingMandiRequests) : 5,
          workflow_policies: {
            lot_creation_mode: lotCreationMode || null,
            auction: {
              capacity: {
                max_live_sessions: maxLiveSessions ? Number(maxLiveSessions) : null,
                max_open_sessions: maxOpenSessions ? Number(maxOpenSessions) : null,
                max_queue_per_lane: maxQueuePerLane ? Number(maxQueuePerLane) : null,
                max_total_queued_lots: maxTotalQueuedLots ? Number(maxTotalQueuedLots) : null,
                allow_overflow_lanes: allowOverflowLanes,
              },
            },
            mandi_association: {
              farmer_approval_mode: farmerAssociationApprovalMode,
              trader_approval_mode: traderAssociationApprovalMode,
              allow_farmer_multi_mandi: allowFarmerMultiMandi,
              allow_trader_multi_mandi: allowTraderMultiMandi,
              require_farmer_documents_for_mandi: requireFarmerDocuments,
              require_trader_documents_for_mandi: requireTraderDocuments,
              allow_farmer_gate_token_without_mandi_approval: allowFarmerGateTokenWithoutApproval,
              allow_trader_bid_without_mandi_approval: allowTraderBidWithoutApproval,
              max_pending_mandi_requests_per_user: maxPendingMandiRequests ? Number(maxPendingMandiRequests) : 5,
            },
          },
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save settings.", { variant: "error" });
        return;
      }
      setIsDirty(false);
      enqueueSnackbar("Mandi settings saved successfully.", { variant: "success" });
      await loadSettings();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to save settings.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Alert type="warning" showIcon message="Not authorised" description="You do not have permission to view Mandi Settings." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="cm-mandi-settings-page">
        <CmPageHeader
          eyebrow="MANDI OPERATIONS"
          title="Mandi Settings"
          subtitle="Configure association approval, access, gate/lot policies and auction-capacity overrides for a permitted mandi."
          actions={
            <Button icon={<ReloadOutlined />} onClick={loadSettings} disabled={!selectedMandi || loadingSettings || saving}>
              Refresh
            </Button>
          }
        />

        <CmSectionCard compact className="cm-mandi-settings-scope-card">
          <div className="cm-mandi-settings-scope-grid">
            <div>
              <Text className="cm-mandi-settings-kicker">WORKING SCOPE</Text>
              <Title level={4} className="cm-mandi-settings-scope-title">{orgCode}</Title>
              <Text type="secondary">
                {roleScope === "MANDI"
                  ? "Settings are restricted to mandis assigned to your current role."
                  : "Settings remain locked to the current organisation and the selected mandi."}
              </Text>
            </div>
            <FieldShell label="Mandi" helper="Select a mandi to load its local policy overrides.">
              <Select
                className="cm-mandi-settings-select"
                value={selectedMandi || undefined}
                options={mandiOptions}
                placeholder="Select mandi"
                showSearch
                optionFilterProp="label"
                loading={loadingMandis}
                disabled={loadingMandis || mandiOptions.length === 0}
                onChange={(value) => {
                  setSelectedMandi(value);
                  setIsDirty(false);
                }}
              />
            </FieldShell>
          </div>
        </CmSectionCard>

        {loadError ? <Alert type="error" showIcon message="Unable to load Mandi Settings" description={loadError} /> : null}

        <div className="cm-mandi-settings-stats">
          <CmStatCard label="Selected Mandi" value={selectedMandi ? selectedMandiLabel : "—"} helper="Current policy target" icon={<SettingOutlined />} />
          <CmStatCard label="Lot Creation" value={labelFromEnum(effectiveLotCreationMode) || "—"} helper="Effective rule" icon={<ThunderboltOutlined />} />
          <CmStatCard label="Policy Source" value={labelFromEnum(effectiveLotCreationSource) || "—"} helper="Mandi / organisation / default" icon={<SafetyCertificateOutlined />} tone="neutral" />
          <CmStatCard label="Edit State" value={isDirty ? "Unsaved" : "Saved"} helper={canEdit ? "Role can update" : "Read-only role"} icon={<DashboardOutlined />} tone={isDirty ? "amber" : "olive"} />
        </div>

        {!selectedMandi ? (
          <CmSectionCard compact>
            <Empty description="Select a mandi to review its settings." />
          </CmSectionCard>
        ) : (
          <Spin spinning={loadingSettings}>
            <div className="cm-mandi-settings-sections">
              {!canEdit ? (
                <Alert type="info" showIcon message="Read-only access" description="Your role can review these settings but cannot change them." />
              ) : null}

              <CmSectionCard
                title="Mandi Association Approval"
                subtitle="Control how farmer and trader access to this mandi is approved and constrained."
                className="cm-mandi-settings-card"
              >
                <div className="cm-mandi-settings-field-grid">
                  <FieldShell label="Farmer Approval Mode" helper="Choose how farmer association requests are approved.">
                    <Select
                      className="cm-mandi-settings-select"
                      value={farmerAssociationApprovalMode}
                      disabled={readOnly}
                      options={MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((value) => ({ value, label: labelFromEnum(value) }))}
                      onChange={(value) => { setFarmerAssociationApprovalMode(value); markDirty(); }}
                    />
                  </FieldShell>
                  <FieldShell label="Trader Approval Mode" helper="Trader approval may depend on KYC, fees, deposits or mandi verification.">
                    <Select
                      className="cm-mandi-settings-select"
                      value={traderAssociationApprovalMode}
                      disabled={readOnly}
                      options={MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((value) => ({ value, label: labelFromEnum(value) }))}
                      onChange={(value) => { setTraderAssociationApprovalMode(value); markDirty(); }}
                    />
                  </FieldShell>
                  <ToggleRow label="Allow Farmer Multi Mandi" helper="Allow a farmer to be approved for more than one mandi." checked={allowFarmerMultiMandi} disabled={readOnly} onChange={() => { setAllowFarmerMultiMandi((prev) => !prev); markDirty(); }} />
                  <ToggleRow label="Allow Trader Multi Mandi" helper="Allow a trader to be approved for more than one mandi." checked={allowTraderMultiMandi} disabled={readOnly} onChange={() => { setAllowTraderMultiMandi((prev) => !prev); markDirty(); }} />
                  <ToggleRow label="Require Farmer Documents" helper="Require farmer documents before mandi approval." checked={requireFarmerDocuments} disabled={readOnly} onChange={() => { setRequireFarmerDocuments((prev) => !prev); markDirty(); }} />
                  <ToggleRow label="Require Trader Documents" helper="Require trader documents before mandi approval." checked={requireTraderDocuments} disabled={readOnly} onChange={() => { setRequireTraderDocuments((prev) => !prev); markDirty(); }} />
                  <FieldShell label="Max Pending Requests Per User" helper="Maximum open association requests a user can keep pending.">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={maxPendingMandiRequests}
                      disabled={readOnly}
                      onChange={(e) => { setMaxPendingMandiRequests(e.target.value); markDirty(); }}
                    />
                  </FieldShell>
                </div>
              </CmSectionCard>

              <CmSectionCard
                title="Access Before Approval"
                subtitle="Exceptions should remain tightly controlled because they bypass normal mandi association approval."
                className="cm-mandi-settings-card"
              >
                <Alert
                  className="cm-mandi-settings-warning"
                  type="warning"
                  showIcon
                  message="Use these exceptions carefully"
                  description="Enabling either option allows operational activity before the mandi association request is approved."
                />
                <div className="cm-mandi-settings-field-grid">
                  <ToggleRow label="Farmer Gate Token Without Mandi Approval" helper="Allows a farmer to create gate tokens before mandi approval." checked={allowFarmerGateTokenWithoutApproval} disabled={readOnly} onChange={() => { setAllowFarmerGateTokenWithoutApproval((prev) => !prev); markDirty(); }} />
                  <ToggleRow label="Trader Bid Without Mandi Approval" helper="Allows a trader to bid before mandi approval." checked={allowTraderBidWithoutApproval} disabled={readOnly} onChange={() => { setAllowTraderBidWithoutApproval((prev) => !prev); markDirty(); }} />
                </div>
              </CmSectionCard>

              <CmSectionCard
                title="Gate / Lot Policy"
                subtitle="Control pre-market listing approval and who may create lots after a gate token reaches the yard."
                className="cm-mandi-settings-card"
              >
                <div className="cm-mandi-settings-field-grid">
                  <FieldShell label="Pre-listing Approval Mode" helper="Controls approval for pre-market listing submissions.">
                    <Select
                      className="cm-mandi-settings-select"
                      value={approvalMode}
                      disabled={readOnly}
                      options={PRELISTING_APPROVAL_OPTIONS}
                      onChange={(value) => { setApprovalMode(value); markDirty(); }}
                    />
                  </FieldShell>
                  {approvalMode === "TRUST" ? (
                    <FieldShell label="Trust Min Score" helper="Minimum trust score required for automatic pre-listing approval.">
                      <Input type="number" value={trustMinScore} disabled={readOnly} onChange={(e) => { setTrustMinScore(e.target.value); markDirty(); }} />
                    </FieldShell>
                  ) : null}
                  <FieldShell label="Lot Creation Mode" helper="Controls whether gate operators can create lots after marking a token IN_YARD.">
                    <Select
                      className="cm-mandi-settings-select"
                      value={lotCreationMode}
                      disabled={readOnly}
                      options={LOT_CREATION_OPTIONS}
                      onChange={(value) => { setLotCreationMode(value); markDirty(); }}
                    />
                  </FieldShell>
                  <div className="cm-mandi-settings-effective-box">
                    <Text strong>Effective value</Text>
                    <div className="cm-mandi-settings-tags">
                      <Tag color="green">{labelFromEnum(effectiveLotCreationMode)}</Tag>
                      <Tag>{labelFromEnum(effectiveLotCreationSource)}</Tag>
                    </div>
                    <Text type="secondary">The effective value may be inherited when no mandi override is stored.</Text>
                  </div>
                </div>
              </CmSectionCard>

              <CmSectionCard
                title="Auction Capacity Override"
                subtitle="Local limits should remain within the organisation's allocated capacity. Empty values continue to use inherited policy defaults."
                className="cm-mandi-settings-card"
              >
                <div className="cm-mandi-settings-field-grid">
                  <FieldShell label="Max Live Sessions" helper="Maximum live auction sessions allowed at the same time.">
                    <Input type="number" min={0} value={maxLiveSessions} disabled={readOnly} onChange={(e) => { setMaxLiveSessions(e.target.value); markDirty(); }} />
                  </FieldShell>
                  <FieldShell label="Max Open Sessions" helper="Maximum open sessions that can accept lots.">
                    <Input type="number" min={0} value={maxOpenSessions} disabled={readOnly} onChange={(e) => { setMaxOpenSessions(e.target.value); markDirty(); }} />
                  </FieldShell>
                  <FieldShell label="Max Queue Per Lane" helper="Maximum queued lots per auction lane.">
                    <Input type="number" min={0} value={maxQueuePerLane} disabled={readOnly} onChange={(e) => { setMaxQueuePerLane(e.target.value); markDirty(); }} />
                  </FieldShell>
                  <FieldShell label="Max Total Queued Lots" helper="Maximum queued lots across all auction lanes.">
                    <Input type="number" min={0} value={maxTotalQueuedLots} disabled={readOnly} onChange={(e) => { setMaxTotalQueuedLots(e.target.value); markDirty(); }} />
                  </FieldShell>
                  <ToggleRow label="Allow Overflow Lanes" helper="Allow temporary overflow lanes if configured capacity is exceeded." checked={allowOverflowLanes} disabled={readOnly} onChange={() => { setAllowOverflowLanes((prev) => !prev); markDirty(); }} />
                </div>
              </CmSectionCard>
            </div>
          </Spin>
        )}

        <div className="cm-mandi-settings-savebar">
          <div className="cm-mandi-settings-save-copy">
            <Text strong>Save changes for {selectedMandi ? selectedMandiLabel : "the selected mandi"}</Text>
            <Text type="secondary">
              {isDirty ? "Unsaved policy changes are ready to save." : "No unsaved changes."}
            </Text>
          </div>
          <div className="cm-mandi-settings-save-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadSettings}
              disabled={!selectedMandi || saving || loadingSettings || !isDirty}
            >
              Reset
            </Button>
            {canEdit ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={onSave}
                disabled={!selectedMandi || loadingSettings || !isDirty}
              >
                Save Mandi Settings
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};
