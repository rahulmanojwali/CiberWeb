import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Drawer,
  Empty,
  Row,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownOutlined, QuestionCircleOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { useStepUp } from "../../security/stepup/useStepUp";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import {
  getWorkflowMandiPolicies,
  getWorkflowMandiSummary,
  getWorkflowOrgPolicies,
  saveWorkflowMandiPolicies,
  saveWorkflowOrgPolicies,
} from "../../services/workflowPoliciesApi";

const { Paragraph, Text, Title } = Typography;

type ModeKey = "auction" | "msp" | "direct" | "contract" | "haat";
type Option = { value: string; label: string };
type PolicyState = Record<ModeKey, any>;
type OverrideState = Record<ModeKey, boolean>;

const FIELD_HELP: Record<string, string> = {
  enabled: "Turns this business channel on or off for the selected organisation or mandi policy.",
  lot_creation_mode: "Controls who is allowed to create auction lots.",
  approval_mode: "Controls whether records need manual approval, are approved automatically, or follow the configured trust model.",
  lot_assignment_mode: "Controls who assigns auction lots to the appropriate auction flow or operator.",
  intake_creation_mode: "Controls who may create MSP/procurement intake records.",
  rate_source: "Defines which authority supplies the procurement rate used by this workflow.",
  farmer_request_allowed: "Allows farmers to initiate procurement requests when enabled.",
  listing_creation_mode: "Controls who may create listings for this business channel.",
  negotiation_allowed: "Allows buyer/farmer price or commercial negotiation in Direct Trade.",
  contract_creation_mode: "Controls who may initiate a Contract Farming contract.",
  farmer_acceptance_required: "Requires the farmer to explicitly accept the contract before it can proceed.",
  event_window_required: "Requires Weekly Haat listings/activity to stay within the configured event window.",
};

const HelpLabel: React.FC<{ label: string; helpKey: string }> = ({ label, helpKey }) => (
  <Space size={4}>
    <span>{label}</span>
    <Tooltip title={FIELD_HELP[helpKey] || ""}><QuestionCircleOutlined style={{ color: "#8c8c8c" }} /></Tooltip>
  </Space>
);

const MODES: ModeKey[] = ["auction", "msp", "direct", "contract", "haat"];
const MODE_LABEL: Record<ModeKey, string> = {
  auction: "Auction",
  msp: "MSP / Procurement",
  direct: "Direct Trade",
  contract: "Contract Farming",
  haat: "Weekly Haat",
};

const DEFAULTS: PolicyState = {
  auction: { enabled: true, lot_creation_mode: "STRICT_ADMIN_ONLY", approval_mode: "MANUAL", lot_assignment_mode: "MANDI_ASSIGNS" },
  msp: { enabled: false, intake_creation_mode: "PROCUREMENT_ADMIN_ONLY", approval_mode: "MANUAL", farmer_request_allowed: true, rate_source: "GOVT_DECLARED" },
  direct: { enabled: false, listing_creation_mode: "FARMER_ALLOWED", approval_mode: "AUTO", negotiation_allowed: true },
  contract: { enabled: false, contract_creation_mode: "ORG_OR_BUYER_ONLY", approval_mode: "MANUAL", farmer_acceptance_required: true },
  haat: { enabled: false, listing_creation_mode: "FARMER_ALLOWED", approval_mode: "AUTO", event_window_required: true },
};

const OPTIONS: Record<string, Option[]> = {
  lot_creation_mode: [
    { value: "STRICT_ADMIN_ONLY", label: "Mandi/Admin Creates Lot Only" },
    { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Can Create Lot" },
  ],
  approval_mode: [
    { value: "MANUAL", label: "Manual" },
    { value: "AUTO", label: "Auto" },
    { value: "TRUST", label: "Trust" },
  ],
  lot_assignment_mode: [
    { value: "MANDI_ASSIGNS", label: "Mandi Assigns" },
    { value: "AUTO_ASSIGN", label: "Auto Assign" },
    { value: "OPERATOR_ASSIGNS", label: "Operator Assigns" },
  ],
  intake_creation_mode: [
    { value: "PROCUREMENT_ADMIN_ONLY", label: "Procurement Admin Only" },
    { value: "MANDI_OPERATOR_ALLOWED", label: "Mandi Operator Allowed" },
    { value: "GOVT_CONTROLLED", label: "Government Controlled" },
  ],
  listing_creation_mode: [
    { value: "ADMIN_ONLY", label: "Admin Only" },
    { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
    { value: "ASSISTED_OPERATOR", label: "Assisted Operator" },
  ],
  contract_creation_mode: [
    { value: "ADMIN_ONLY", label: "Admin Only" },
    { value: "ORG_OR_BUYER_ONLY", label: "Org Or Buyer Only" },
  ],
  rate_source: [
    { value: "GOVT_DECLARED", label: "Government Declared" },
    { value: "ORG_DECLARED", label: "Organisation Declared" },
    { value: "MANDI_DECLARED", label: "Mandi Declared" },
  ],
};

function storedUser() {
  try { return JSON.parse(localStorage.getItem("cd_user") || "{}"); } catch { return {}; }
}
function ok(resp: any) { return String(resp?.response?.responsecode ?? "1") === "0"; }
function dataOf(resp: any) { return resp?.response?.data || resp?.data || {}; }
function deepClone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function normalizePolicies(raw: any): PolicyState {
  const out = deepClone(DEFAULTS);
  MODES.forEach((mode) => {
    if (raw?.[mode] && typeof raw[mode] === "object") out[mode] = { ...out[mode], ...raw[mode] };
  });
  return out;
}
function emptyOverrides(): OverrideState {
  return { auction: false, msp: false, direct: false, contract: false, haat: false };
}
function extractOrgOptions(resp: any): Option[] {
  const candidates = [
    resp?.data?.items, resp?.data?.organisations, resp?.data?.organizations,
    resp?.response?.data?.items, resp?.response?.data?.organisations, resp?.response?.data?.organizations,
    resp?.items, resp?.organisations, resp?.organizations,
  ];
  const rows = candidates.find(Array.isArray) || [];
  return rows.map((row: any) => ({
    value: String(row?._id || row?.org_id || row?.id || ""),
    label: String(row?.org_name || row?.organisation_name || row?.organization_name || row?.org_code || row?._id || ""),
  })).filter((row: Option) => row.value);
}

const FieldDropdown: React.FC<{ label: string; value: string; options: Option[]; disabled?: boolean; onChange: (value: string) => void }> = ({ label, value, options, disabled, onChange }) => {
  const current = options.find((opt) => opt.value === value)?.label || value || "Not set";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Text type="secondary"><HelpLabel label={label} helpKey={label === "Lot creation" ? "lot_creation_mode" : label === "Approval" ? "approval_mode" : label === "Lot assignment" ? "lot_assignment_mode" : label === "Intake creation" ? "intake_creation_mode" : label === "Rate source" ? "rate_source" : label === "Listing creation" ? "listing_creation_mode" : label === "Contract creation" ? "contract_creation_mode" : label.toLowerCase().replace(/ /g, "_")} /></Text>
      <Dropdown
        disabled={disabled}
        trigger={["click"]}
        menu={{ items: options.map((opt) => ({ key: opt.value, label: opt.label })), onClick: ({ key }) => onChange(String(key)) }}
      >
        <Button disabled={disabled} style={{ textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{current}</span><DownOutlined />
        </Button>
      </Dropdown>
    </div>
  );
};

function modeFields(mode: ModeKey, value: any, disabled: boolean, onPatch: (patch: any) => void) {
  const fields: React.ReactNode[] = [];
  const dropdown = (key: string, label: string) => fields.push(
    <Col xs={24} md={8} key={key}><FieldDropdown label={label} value={String(value?.[key] || "")} options={OPTIONS[key] || []} disabled={disabled} onChange={(next) => onPatch({ [key]: next })} /></Col>
  );
  if (mode === "auction") { dropdown("lot_creation_mode", "Lot creation"); dropdown("approval_mode", "Approval"); dropdown("lot_assignment_mode", "Lot assignment"); }
  if (mode === "msp") { dropdown("intake_creation_mode", "Intake creation"); dropdown("approval_mode", "Approval"); dropdown("rate_source", "Rate source"); }
  if (mode === "direct") { dropdown("listing_creation_mode", "Listing creation"); dropdown("approval_mode", "Approval"); }
  if (mode === "contract") { dropdown("contract_creation_mode", "Contract creation"); dropdown("approval_mode", "Approval"); }
  if (mode === "haat") { dropdown("listing_creation_mode", "Listing creation"); dropdown("approval_mode", "Approval"); }

  const booleans: Array<[string, string]> = [];
  if (mode === "msp") booleans.push(["farmer_request_allowed", "Farmer request allowed"]);
  if (mode === "direct") booleans.push(["negotiation_allowed", "Negotiation allowed"]);
  if (mode === "contract") booleans.push(["farmer_acceptance_required", "Farmer acceptance required"]);
  if (mode === "haat") booleans.push(["event_window_required", "Event window required"]);
  booleans.forEach(([key, label]) => fields.push(
    <Col xs={24} md={8} key={key}><Space direction="vertical" size={6}><Text type="secondary"><HelpLabel label={label} helpKey={label === "Lot creation" ? "lot_creation_mode" : label === "Approval" ? "approval_mode" : label === "Lot assignment" ? "lot_assignment_mode" : label === "Intake creation" ? "intake_creation_mode" : label === "Rate source" ? "rate_source" : label === "Listing creation" ? "listing_creation_mode" : label === "Contract creation" ? "contract_creation_mode" : label.toLowerCase().replace(/ /g, "_")} /></Text><Switch checked={Boolean(value?.[key])} disabled={disabled} onChange={(checked) => onPatch({ [key]: checked })} /></Space></Col>
  ));
  return fields;
}

const PolicyCards: React.FC<{
  state: PolicyState;
  onChange: (mode: ModeKey, patch: any) => void;
  readOnly?: boolean;
  overrides?: OverrideState;
  onOverrideChange?: (mode: ModeKey, enabled: boolean) => void;
  sources?: Record<string, string>;
}> = ({ state, onChange, readOnly = false, overrides, onOverrideChange, sources }) => (
  <Space direction="vertical" size={12} style={{ width: "100%" }}>
    {MODES.map((mode) => {
      const isOverride = overrides ? overrides[mode] : true;
      const disabled = readOnly || (overrides ? !isOverride : false);
      return (
        <Card key={mode} size="small" title={<Space><span>{MODE_LABEL[mode]}</span>{sources?.[mode] ? <Tag>{String(sources[mode]).toUpperCase()}</Tag> : null}</Space>}
          extra={overrides && onOverrideChange ? <Button size="small" type={isOverride ? "primary" : "default"} onClick={() => onOverrideChange(mode, !isOverride)} disabled={readOnly}>{isOverride ? "Override" : "Inherit organisation"}</Button> : null}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={8}><Space direction="vertical" size={6}><Text type="secondary"><HelpLabel label="Channel enabled" helpKey="enabled" /></Text><Switch checked={Boolean(state[mode]?.enabled)} disabled={disabled} onChange={(checked) => onChange(mode, { enabled: checked })} /></Space></Col>
            {modeFields(mode, state[mode], disabled, (patch) => onChange(mode, patch))}
          </Row>
          {overrides && !isOverride ? <Alert style={{ marginTop: 12 }} type="info" showIcon message="This mode inherits the organisation policy. Organisation changes will continue to flow through automatically." /> : null}
        </Card>
      );
    })}
  </Space>
);

export const WorkflowPolicies: React.FC = () => {
  const uiConfig = useAdminUiConfig();
  const { can, authContext } = usePermissions();
  const { ensureStepUp } = useStepUp();
  const user = useMemo(storedUser, []);
  const username = String(user?.username || user?.email || "").trim().toLowerCase();
  const isGlobalScope = String(authContext.role_scope || "").toUpperCase() === "GLOBAL";

  const canView = can("workflow_policies.menu", "VIEW") || can("workflow_policies.view", "VIEW");
  const canEdit = can("workflow_policies.edit", "UPDATE");

  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [orgId, setOrgId] = useState(String(uiConfig.scope?.org_id || ""));
  const [mandis, setMandis] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [summary, setSummary] = useState<any[]>([]);

  const [orgPolicies, setOrgPolicies] = useState<PolicyState>(deepClone(DEFAULTS));
  const [orgBaseline, setOrgBaseline] = useState("");
  const [orgVersion, setOrgVersion] = useState<number | undefined>(undefined);

  const [mandiPolicies, setMandiPolicies] = useState<PolicyState>(deepClone(DEFAULTS));
  const [mandiOverrides, setMandiOverrides] = useState<OverrideState>(emptyOverrides());
  const [mandiSources, setMandiSources] = useState<Record<string, string>>({});
  const [mandiBaseline, setMandiBaseline] = useState("");
  const [mandiVersion, setMandiVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const loadOrgs = useCallback(async () => {
    if (!isGlobalScope || !username) return;
    try {
      const resp = await fetchOrganisations({ username, language: "en" });
      const options = extractOrgOptions(resp);
      setOrgOptions(options);
      if (!orgId && options.length === 1) setOrgId(options[0].value);
    } catch (err: any) {
      message.error(err?.message || "Unable to load organisations.");
    }
  }, [isGlobalScope, orgId, username]);

  const loadOrg = useCallback(async () => {
    if (!username || !orgId) return;
    const resp = await getWorkflowOrgPolicies({ username, orgId });
    if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to load organisation workflow policies.");
    const data = dataOf(resp);
    const settings = data?.settings || {};
    const next = normalizePolicies(settings?.workflow_policies);
    setOrgPolicies(next);
    setOrgVersion(Number(settings?.version || data?.version || 1));
    setOrgBaseline(JSON.stringify(next));
  }, [orgId, username]);

  const loadMandisAndSummary = useCallback(async () => {
    if (!username || !orgId) return;
    const [list, summaryResp] = await Promise.all([
      getMandisForCurrentScope({ username, org_id: orgId }),
      getWorkflowMandiSummary({ username, orgId }),
    ]);
    const nextMandis = (list || []).map((m: any) => ({ value: String(m?.mandi_id ?? m?.mandiId ?? ""), label: String(m?.mandi_name || m?.mandi_slug || m?.mandi_id || "") })).filter((m: Option) => m.value);
    setMandis(nextMandis);
    if (ok(summaryResp)) setSummary(dataOf(summaryResp)?.summary || []);
    if (selectedMandi && !nextMandis.some((m: Option) => m.value === selectedMandi)) setSelectedMandi("");
  }, [orgId, selectedMandi, username]);

  const refresh = useCallback(async () => {
    if (!canView || !username || !orgId) return;
    setLoading(true);
    try {
      await Promise.all([loadOrg(), loadMandisAndSummary()]);
    } catch (err: any) {
      message.error(err?.message || "Unable to load workflow policies.");
    } finally { setLoading(false); }
  }, [canView, loadMandisAndSummary, loadOrg, orgId, username]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);
  useEffect(() => { refresh(); }, [refresh]);

  const loadMandi = useCallback(async (mandiId: string) => {
    if (!username || !orgId || !mandiId) return;
    setLoading(true);
    try {
      const resp = await getWorkflowMandiPolicies({ username, orgId, mandiId });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to load mandi workflow policies.");
      const data = dataOf(resp);
      const stored = data?.stored_workflow_policies || {};
      const effective = normalizePolicies(data?.effective_workflow_policies || {});
      const nextOverrides = emptyOverrides();
      const next = deepClone(effective);
      MODES.forEach((mode) => {
        if (stored?.[mode] && typeof stored[mode] === "object") {
          nextOverrides[mode] = true;
          next[mode] = { ...effective[mode], ...stored[mode] };
        }
      });
      setMandiPolicies(next);
      setMandiOverrides(nextOverrides);
      setMandiSources(data?.effective_workflow_policies?.sources || {});
      setMandiVersion(Number(data?.version || 1));
      setMandiBaseline(JSON.stringify({ next, nextOverrides }));
    } catch (err: any) {
      message.error(err?.message || "Unable to load mandi workflow policies.");
    } finally { setLoading(false); }
  }, [orgId, username]);

  useEffect(() => { if (selectedMandi) loadMandi(selectedMandi); }, [loadMandi, selectedMandi]);

  const updateOrgMode = (mode: ModeKey, patch: any) => setOrgPolicies((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  const updateMandiMode = (mode: ModeKey, patch: any) => setMandiPolicies((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  const orgDirty = orgBaseline && orgBaseline !== JSON.stringify(orgPolicies);
  const mandiDirty = mandiBaseline && mandiBaseline !== JSON.stringify({ next: mandiPolicies, nextOverrides: mandiOverrides });

  const saveOrg = async () => {
    if (!canEdit || !orgId) return;
    const verified = await ensureStepUp("workflow_policies.edit", "UPDATE", { source: "OTHER", force: true });
    if (!verified) return;
    setSaving(true);
    try {
      const resp = await saveWorkflowOrgPolicies({ username, orgId, workflowPolicies: orgPolicies, expectedVersion: orgVersion });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to save organisation workflow policies.");
      message.success("Organisation workflow policies updated.");
      await refresh();
    } catch (err: any) { message.error(err?.message || "Unable to save workflow policies."); }
    finally { setSaving(false); }
  };

  const saveMandi = async () => {
    if (!canEdit || !orgId || !selectedMandi) return;
    const verified = await ensureStepUp("workflow_policies.edit", "UPDATE", { source: "OTHER", force: true });
    if (!verified) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      const inheritModes: string[] = [];
      MODES.forEach((mode) => mandiOverrides[mode] ? (payload[mode] = mandiPolicies[mode]) : inheritModes.push(mode));
      const resp = await saveWorkflowMandiPolicies({ username, orgId, mandiId: selectedMandi, workflowPolicies: payload, inheritModes, expectedVersion: mandiVersion });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to save mandi workflow overrides.");
      message.success("Mandi workflow overrides updated.");
      await Promise.all([loadMandi(selectedMandi), loadMandisAndSummary()]);
    } catch (err: any) { message.error(err?.message || "Unable to save mandi workflow overrides."); }
    finally { setSaving(false); }
  };

  const summaryMap = useMemo(() => new Map(summary.map((row: any) => [String(row.mandi_id), row])), [summary]);
  const columns: ColumnsType<Option> = [
    { title: "Mandi", dataIndex: "label", key: "label" },
    { title: "Overrides", key: "overrides", width: 130, render: (_, row) => <Tag color={Number(summaryMap.get(row.value)?.override_count || 0) ? "gold" : "default"}>{Number(summaryMap.get(row.value)?.override_count || 0)} / 5</Tag> },
    { title: "Override modes", key: "modes", render: (_, row) => { const modes = summaryMap.get(row.value)?.override_modes || []; return modes.length ? <Space wrap>{modes.map((m: string) => <Tag key={m}>{MODE_LABEL[m as ModeKey] || m}</Tag>)}</Space> : <Text type="secondary">Inherits organisation</Text>; } },
    { title: "Action", key: "action", width: 110, render: (_, row) => <Button size="small" onClick={() => setSelectedMandi(row.value)}>Edit</Button> },
  ];

  if (!canView) return <PageContainer title="Workflow Policies"><Alert type="error" showIcon message="Not authorized to view Workflow Policies." /></PageContainer>;

  const orgMenu = { items: orgOptions.map((o) => ({ key: o.value, label: o.label })), onClick: ({ key }: any) => { setOrgId(String(key)); setSelectedMandi(""); } };
  const mandiMenu = { items: mandis.map((o) => ({ key: o.value, label: o.label })), onClick: ({ key }: any) => setSelectedMandi(String(key)) };
  const selectedOrgLabel = orgOptions.find((o) => o.value === orgId)?.label || String((uiConfig.scope as any)?.org_code || orgId || "Select organisation");
  const selectedMandiLabel = mandis.find((m) => m.value === selectedMandi)?.label || "Select mandi";

  return (
    <PageContainer
      title="Workflow Policies"
      subtitle="Organisation defaults with explicit mandi-level inheritance and overrides. API business rules remain authoritative."
      actions={<Space><Button icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>Help</Button><Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button></Space>}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Start here"
          description="Choose an organisation, set its default workflow rules, then use Mandi overrides only when a specific mandi genuinely needs different rules. If a mandi stays on Inherit organisation, future organisation changes continue to flow to it automatically."
          action={<Button size="small" icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>How this works</Button>}
        />
        {isGlobalScope ? (
          <Card size="small"><Space wrap><Text strong>Organisation</Text><Dropdown menu={orgMenu} trigger={["click"]}><Button>{selectedOrgLabel} <DownOutlined /></Button></Dropdown></Space></Card>
        ) : null}
        {!orgId ? <Alert type="info" showIcon message="Select an organisation to manage workflow policies." /> : null}
        {orgId ? (
          <Spin spinning={loading}>
            <Tabs
              items={[
                {
                  key: "ORG",
                  label: "Organisation defaults",
                  children: <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Alert type="info" showIcon message="These are the defaults inherited by mandis unless a mandi explicitly overrides a workflow mode." />
                    <PolicyCards state={orgPolicies} onChange={updateOrgMode} readOnly={!canEdit} />
                    <Space><Button type="primary" icon={<SaveOutlined />} onClick={saveOrg} loading={saving} disabled={!canEdit || !orgDirty}>Save organisation defaults</Button>{orgDirty ? <Tag color="gold">Unsaved changes</Tag> : <Tag color="green">Saved</Tag>}</Space>
                  </Space>,
                },
                {
                  key: "MANDI",
                  label: "Mandi overrides",
                  children: <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Alert type="info" showIcon message="A mandi should inherit organisation defaults unless there is a genuine local exception. This avoids freezing copied values when organisation policy changes later." />
                    <Table rowKey="value" size="small" dataSource={mandis} columns={columns} pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }} locale={{ emptyText: <Empty description="No mandis available for this organisation." /> }} />
                    <Card size="small" title="Edit mandi override">
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        <Dropdown menu={mandiMenu} trigger={["click"]}><Button>{selectedMandiLabel} <DownOutlined /></Button></Dropdown>
                        {selectedMandi ? <PolicyCards state={mandiPolicies} onChange={updateMandiMode} overrides={mandiOverrides} onOverrideChange={(mode, enabled) => setMandiOverrides((prev) => ({ ...prev, [mode]: enabled }))} sources={mandiSources} readOnly={!canEdit} /> : <Empty description="Select a mandi to review inheritance and overrides." />}
                        {selectedMandi ? <Space><Button type="primary" icon={<SaveOutlined />} onClick={saveMandi} loading={saving} disabled={!canEdit || !mandiDirty}>Save mandi overrides</Button>{mandiDirty ? <Tag color="gold">Unsaved changes</Tag> : <Tag color="green">Saved</Tag>}</Space> : null}
                      </Space>
                    </Card>
                  </Space>,
                },
              ]}
            />
          </Spin>
        ) : null}
      </Space>

      <Drawer
        title="Workflow Policies Help"
        width={620}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      >
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={4}>What this screen controls</Title>
            <Paragraph>
              Workflow Policies define <strong>who can start each business workflow and how approval happens</strong> for Auction, MSP / Procurement, Direct Trade, Contract Farming and Weekly Haat. They do not change the underlying API business rules; they configure the permitted operating mode inside those rules.
            </Paragraph>
          </div>

          <div>
            <Title level={4}>Organisation defaults vs Mandi overrides</Title>
            <Paragraph><strong>Organisation defaults</strong> are the normal rules for every mandi under the organisation.</Paragraph>
            <Paragraph><strong>Mandi override</strong> should be used only when one mandi needs a genuine local exception.</Paragraph>
            <Alert
              type="success"
              showIcon
              message="Recommended approach"
              description="Keep mandis on Inherit organisation wherever possible. Use Override only for the workflow mode that must be different."
            />
          </div>

          <div>
            <Title level={4}>Simple example</Title>
            <Paragraph>
              Suppose the organisation uses <strong>Manual approval</strong> for Direct Trade. All mandis inherit that automatically. If only one mandi has permission to use Auto approval, open that mandi, change Direct Trade to <strong>Override</strong>, and set Approval to Auto. Other workflow modes can continue to inherit the organisation defaults.
            </Paragraph>
            <Paragraph>
              If you later switch that Direct Trade mode back to <strong>Inherit organisation</strong>, the local copy is removed and the mandi again follows future organisation changes.
            </Paragraph>
          </div>

          <div>
            <Title level={4}>Common controls</Title>
            <Paragraph><strong>Channel enabled</strong> — turns that business channel on or off for the selected policy scope.</Paragraph>
            <Paragraph><strong>Approval: Manual</strong> — a permitted administrator/operator must approve before the workflow proceeds.</Paragraph>
            <Paragraph><strong>Approval: Auto</strong> — the workflow proceeds automatically when the API's validation/business rules are satisfied.</Paragraph>
            <Paragraph><strong>Approval: Trust</strong> — uses the configured trusted-participant / trust-policy behaviour where supported.</Paragraph>
          </div>

          <div>
            <Title level={4}>Auction</Title>
            <Paragraph><strong>Lot creation</strong> controls who may create auction lots. <strong>Lot assignment</strong> controls who assigns those lots into the auction operating flow.</Paragraph>
          </div>

          <div>
            <Title level={4}>MSP / Procurement</Title>
            <Paragraph><strong>Intake creation</strong> controls who may open procurement intake. <strong>Rate source</strong> determines whether the configured rate comes from Government, Organisation or Mandi. <strong>Farmer request allowed</strong> lets farmers initiate procurement requests.</Paragraph>
          </div>

          <div>
            <Title level={4}>Direct Trade</Title>
            <Paragraph><strong>Listing creation</strong> controls who may create listings. <strong>Negotiation allowed</strong> enables the negotiation flow. Approval controls whether publication/continuation is manual, automatic or trust-based.</Paragraph>
          </div>

          <div>
            <Title level={4}>Contract Farming</Title>
            <Paragraph><strong>Contract creation</strong> controls who may initiate a contract. <strong>Farmer acceptance required</strong> requires explicit farmer acceptance before the contract proceeds.</Paragraph>
          </div>

          <div>
            <Title level={4}>Weekly Haat</Title>
            <Paragraph><strong>Listing creation</strong> controls who may create Haat listings. <strong>Event window required</strong> means activity must remain within the configured Haat session/event window.</Paragraph>
          </div>

          <div>
            <Title level={4}>When should I use Override?</Title>
            <Paragraph>Use Override only when a mandi has a documented operational difference, local regulation, staffing limitation, pilot configuration or other genuine exception. Do not create overrides simply to copy the organisation value.</Paragraph>
          </div>

          <div>
            <Title level={4}>Saving</Title>
            <Paragraph>Workflow changes require step-up verification. The system also checks the policy version so one administrator cannot silently overwrite another administrator's newer change.</Paragraph>
          </div>
        </Space>
      </Drawer>
    </PageContainer>
  );
};

export default WorkflowPolicies;
