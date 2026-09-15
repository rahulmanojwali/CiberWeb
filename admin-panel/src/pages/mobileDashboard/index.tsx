import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Drawer,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  LockOutlined,
  BgColorsOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { useStepUpContext } from "../../security/stepup/StepUpContext";
import {
  deleteMobileDashboardWidget,
  getMobileDashboardWidgets,
  type MobileDashboardRoleOption,
  type MobileDashboardWidget,
  reorderMobileDashboardWidgets,
  saveMobileDashboardWidget,
  saveMobileAppControl,
  type MobileAppControl,
  updateMobileDashboardWidgetStatus,
} from "../../services/mobileDashboardAdminApi";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";
import "../../styles/systemAdmin.css";

const LAYOUTS = ["FULL_WIDTH", "GRID_2", "LIST"] as const;

type StatusFilter = "ALL" | "Y" | "N";

type FormState = {
  _id: string;
  version: number;
  role_code: string;
  widget_key: string;
  title_en: string;
  title_hi: string;
  route: string;
  api_name: string;
  permission_key: string;
  layout: "FULL_WIDTH" | "GRID_2" | "LIST";
  order: number | null;
  is_active: "Y" | "N";
  metadata: string;
};

const blankForm = (role = ""): FormState => ({
  _id: "",
  version: 1,
  role_code: role,
  widget_key: "",
  title_en: "",
  title_hi: "",
  route: "",
  api_name: "",
  permission_key: "",
  layout: "FULL_WIDTH",
  order: null,
  is_active: "Y",
  metadata: "",
});

function getStoredUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeRole(role?: string | null) {
  const raw = String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return raw === "SUPERADMIN" ? "SUPER_ADMIN" : raw;
}

function responseData(resp: any) {
  return resp?.response?.data || resp?.data || {};
}

function responseOk(resp: any) {
  return String(resp?.response?.responsecode ?? "1") === "0";
}

function metadataToText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function friendlyRoleLabel(role: MobileDashboardRoleOption) {
  const name = String(role.role_name || "").trim();
  if (name && name !== role.role_code) return `${name} (${role.role_code})`;
  return role.role_code.split("_").join(" ");
}

const MobileDashboardAdminPage = () => {
  const uiConfig = useAdminUiConfig();
  const { can, loadingPermissions } = usePermissions();
  const { ensureStepUp } = useStepUpContext();
  const [toastApi, toastHolder] = message.useMessage();

  const storedUser = useMemo(() => getStoredUser(), []);
  const username = String(storedUser?.username || storedUser?.email || "").trim().toLowerCase();
  const country = String(storedUser?.country || DEFAULT_COUNTRY).trim().toUpperCase();
  const role = normalizeRole(uiConfig.role || storedUser?.role_slug || storedUser?.default_role_code);

  const canView = can("mobile_dashboard.view", "VIEW") || can("mobile_dashboard.menu", "VIEW");
  const canEdit = can("mobile_dashboard.view", "UPDATE");

  const baseInput = useMemo(
    () => ({ username, country, language: DEFAULT_LANGUAGE, role }),
    [country, role, username],
  );

  const [roleOptions, setRoleOptions] = useState<MobileDashboardRoleOption[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<MobileDashboardWidget[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => blankForm());
  const [loadError, setLoadError] = useState("");
  const [appControl, setAppControl] = useState<MobileAppControl | null>(null);
  const [appControlSaving, setAppControlSaving] = useState(false);

  const loadRows = useCallback(
    async (nextPage = pagination.page, nextRole = roleFilter) => {
      if (!username || !canView) return;
      setLoading(true);
      setLoadError("");
      try {
        const resp = await getMobileDashboardWidgets({
          ...baseInput,
          role_code: nextRole,
          search,
          status: statusFilter,
          page: nextPage,
          limit: pagination.limit,
        });
        if (!responseOk(resp)) {
          setLoadError(resp?.response?.description || "Unable to load Mobile Dashboard configuration.");
          return;
        }

        const data = responseData(resp);
        const roles = Array.isArray(data.allowed_roles) ? data.allowed_roles : [];
        setRoleOptions(roles);
        setRows(Array.isArray(data.widgets) ? data.widgets : []);
        setSummary({
          total: Number(data.summary?.total || 0),
          active: Number(data.summary?.active || 0),
          inactive: Number(data.summary?.inactive || 0),
        });
        setPagination((prev) => ({
          ...prev,
          page: Number(data.pagination?.page || nextPage || 1),
          total: Number(data.pagination?.total || 0),
        }));
        if (data.app_control) setAppControl(data.app_control as MobileAppControl);

        if (!nextRole && roles.length) {
          const firstConfigured = roles.find((item: MobileDashboardRoleOption) => item.configured) || roles[0];
          setRoleFilter(firstConfigured.role_code);
          setPagination((prev) => ({ ...prev, page: 1 }));
        }
      } catch (error) {
        console.error("[mobileDashboard] load error", error);
        setLoadError("Unable to load Mobile Dashboard configuration.");
      } finally {
        setLoading(false);
      }
    },
    [
      baseInput,
      canView,
      pagination.limit,
      pagination.page,
      roleFilter,
      search,
      statusFilter,
      username,
    ],
  );

  useEffect(() => {
    if (!loadingPermissions && canView) loadRows(1, roleFilter);
    // roleFilter is intentionally handled by the explicit selector effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, canView, search, statusFilter]);

  useEffect(() => {
    if (!loadingPermissions && canView && roleFilter) {
      setPagination((prev) => ({ ...prev, page: 1 }));
      loadRows(1, roleFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const openNew = () => {
    setForm(blankForm(roleFilter));
    setEditorOpen(true);
  };

  const openEdit = (row: MobileDashboardWidget) => {
    setForm({
      _id: row._id || "",
      version: Number(row.version || 1),
      role_code: row.role_code || roleFilter,
      widget_key: row.widget_key || "",
      title_en: row.title_en || "",
      title_hi: row.title_hi || "",
      route: row.route || "",
      api_name: row.api_name || "",
      permission_key: row.permission_key || "",
      layout: row.layout || "FULL_WIDTH",
      order: Number.isFinite(Number(row.order)) ? Number(row.order) : null,
      is_active: row.is_active === "N" ? "N" : "Y",
      metadata: metadataToText(row.metadata),
    });
    setEditorOpen(true);
  };

  const requireEditStepup = async () => {
    const verified = await ensureStepUp("mobile_dashboard.view", "UPDATE", {
      source: "OTHER",
      force: true,
    });
    return Boolean(verified);
  };

  const saveForm = async () => {
    if (!canEdit || !form.role_code || !form.widget_key.trim() || !form.title_en.trim()) return;

    let metadata: Record<string, unknown> | null = null;
    try {
      if (form.metadata.trim()) {
        const parsed = JSON.parse(form.metadata);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          toastApi.error("Advanced metadata must be a JSON object.");
          return;
        }
        metadata = parsed;
      }
    } catch {
      toastApi.error("Advanced metadata contains invalid JSON.");
      return;
    }

    if (!(await requireEditStepup())) return;

    setSavingKey("save");
    try {
      const widget: Partial<MobileDashboardWidget> = {
        _id: form._id || undefined,
        version: form._id ? form.version : undefined,
        role_code: form.role_code,
        widget_key: form.widget_key.trim(),
        title_en: form.title_en.trim(),
        title_hi: form.title_hi.trim() || null,
        route: form.route.trim() || null,
        api_name: form.api_name.trim() || null,
        permission_key: form.permission_key.trim() || null,
        layout: form.layout,
        order: form.order === null ? undefined : Number(form.order),
        is_active: form.is_active,
        metadata,
      };
      const resp = await saveMobileDashboardWidget({ ...baseInput, widget });
      if (!responseOk(resp)) {
        toastApi.error(resp?.response?.description || "Unable to save widget.");
        return;
      }
      toastApi.success(form._id ? "Dashboard item updated." : "Dashboard item created.");
      setEditorOpen(false);
      await loadRows(pagination.page, roleFilter);
    } catch (error: any) {
      console.error("[mobileDashboard] save error", error);
      toastApi.error(error?.message || "Unable to save widget.");
    } finally {
      setSavingKey("");
    }
  };

  const toggleStatus = async (row: MobileDashboardWidget) => {
    if (!row._id || !canEdit) return;
    if (!(await requireEditStepup())) return;

    const nextStatus: "Y" | "N" = row.is_active === "Y" ? "N" : "Y";
    setSavingKey(`status:${row._id}`);
    try {
      const resp = await updateMobileDashboardWidgetStatus({
        ...baseInput,
        widget_id: row._id,
        is_active: nextStatus,
        expected_version: row.version || 1,
      });
      if (!responseOk(resp)) {
        toastApi.error(resp?.response?.description || "Unable to update status.");
        return;
      }
      toastApi.success(nextStatus === "Y" ? "Dashboard item enabled." : "Dashboard item disabled.");
      await loadRows(pagination.page, roleFilter);
    } finally {
      setSavingKey("");
    }
  };

  const deleteRow = (row: MobileDashboardWidget) => {
    if (!row._id || !canEdit) return;
    Modal.confirm({
      title: "Delete this dashboard item?",
      content: (
        <>
          <div><strong>{row.title_en || row.widget_key}</strong></div>
          <div style={{ marginTop: 8 }}>
            Deleting removes this configuration from the selected role. If you may need it again,
            disable it instead.
          </div>
        </>
      ),
      okText: "Delete",
      okButtonProps: { danger: true },
      async onOk() {
        if (!(await requireEditStepup())) return Promise.reject(new Error("Step-up cancelled."));
        setSavingKey(`delete:${row._id}`);
        try {
          const resp = await deleteMobileDashboardWidget({
            ...baseInput,
            widget_id: row._id!,
            expected_version: row.version || 1,
          });
          if (!responseOk(resp)) throw new Error(resp?.response?.description || "Unable to delete widget.");
          toastApi.success("Dashboard item deleted.");
          await loadRows(1, roleFilter);
        } finally {
          setSavingKey("");
        }
      },
    });
  };

  const saveVisibleOrder = async () => {
    if (!canEdit || !rows.length) return;
    if (!(await requireEditStepup())) return;
    setSavingKey("reorder");
    try {
      const resp = await reorderMobileDashboardWidgets({
        ...baseInput,
        role_code: roleFilter,
        widgets: rows
          .filter((row) => row._id)
          .map((row) => ({ widget_id: row._id, order: Number(row.order || 0) })),
      });
      if (!responseOk(resp)) {
        toastApi.error(resp?.response?.description || "Unable to save order.");
        return;
      }
      toastApi.success("Visible dashboard order saved.");
      await loadRows(pagination.page, roleFilter);
    } finally {
      setSavingKey("");
    }
  };

  const toggleAppControl = (controlKey: string) => {
    setAppControl((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        controls: prev.controls.map((item) =>
          item.control_key === controlKey && item.locked !== "Y"
            ? { ...item, enabled: item.enabled === "Y" ? "N" : "Y" }
            : item,
        ),
      };
    });
  };

  const updateTheme = (key: keyof MobileAppControl["theme"], value: string) => {
    setAppControl((prev) => prev ? { ...prev, theme: { ...prev.theme, [key]: value } } : prev);
  };

  const updateLayoutToken = (key: keyof MobileAppControl["layout_density"], value: number | null) => {
    setAppControl((prev) => prev ? { ...prev, layout_density: { ...prev.layout_density, [key]: Number(value ?? 0) } } : prev);
  };

  const updateTypographyToken = (key: keyof MobileAppControl["typography"], value: number | null) => {
    setAppControl((prev) => prev ? { ...prev, typography: { ...prev.typography, [key]: Number(value ?? 0) } } : prev);
  };

  const saveAppWideControl = async () => {
    if (!canEdit || !appControl) return;
    if (!(await requireEditStepup())) return;
    setAppControlSaving(true);
    try {
      const resp = await saveMobileAppControl({ ...baseInput, app_control: appControl });
      if (!responseOk(resp)) {
        toastApi.error(resp?.response?.description || "Unable to save Mobile App Control.");
        return;
      }
      const saved = responseData(resp)?.app_control;
      if (saved) setAppControl(saved as MobileAppControl);
      toastApi.success("Mobile App Control updated.");
    } catch (error: any) {
      toastApi.error(error?.response?.description || error?.message || "Unable to save Mobile App Control.");
    } finally {
      setAppControlSaving(false);
    }
  };

  const controlsByType = (type: string) =>
    (appControl?.controls || []).filter((item) => item.control_type === type).sort((a, b) => a.order - b.order);

  const roleMenu = {
    items: roleOptions.map((item) => ({
      key: item.role_code,
      label: (
        <Space>
          <span>{friendlyRoleLabel(item)}</span>
          {item.configured ? <Badge status="success" /> : null}
        </Space>
      ),
    })),
    onClick: ({ key }: { key: string }) => setRoleFilter(key),
  };


  const formRoleMenu = {
    items: roleOptions.map((item) => ({
      key: item.role_code,
      label: friendlyRoleLabel(item),
    })),
    onClick: ({ key }: { key: string }) => setForm((prev) => ({ ...prev, role_code: key })),
  };

  const layoutMenu = {
    items: LAYOUTS.map((item) => ({ key: item, label: item.split("_").join(" ") })),
    onClick: ({ key }: { key: string }) => setForm((prev) => ({ ...prev, layout: key as FormState["layout"] })),
  };

  const columns: ColumnsType<MobileDashboardWidget> = [
    {
      title: "Order",
      dataIndex: "order",
      width: 105,
      render: (value, row, index) => (
        <InputNumber
          min={0}
          precision={0}
          value={Number(value || 0)}
          disabled={!canEdit}
          onChange={(next) => {
            setRows((prev) => {
              const copy = [...prev];
              copy[index] = { ...row, order: Number(next || 0) };
              return copy;
            });
          }}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: "Dashboard item",
      key: "widget",
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.title_en || row.widget_key}</Typography.Text>
          <br />
          <Typography.Text type="secondary" copyable={{ text: row.widget_key }}>
            {row.widget_key}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Layout",
      dataIndex: "layout",
      width: 125,
      render: (value) => <Tag>{String(value || "").split("_").join(" ")}</Tag>,
    },
    {
      title: "Destination",
      key: "route",
      ellipsis: true,
      render: (_, row) => (
        <div>
          <Typography.Text>{row.route || "No navigation"}</Typography.Text>
          {row.permission_key ? (
            <>
              <br />
              <Typography.Text type="secondary">{row.permission_key}</Typography.Text>
            </>
          ) : null}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 105,
      render: (value, row) => (
        <Tooltip title={canEdit ? (value === "Y" ? "Disable" : "Enable") : "Read-only"}>
          <Switch
            checked={value === "Y"}
            disabled={!canEdit || Boolean(savingKey)}
            loading={savingKey === `status:${row._id}`}
            onChange={() => toggleStatus(row)}
          />
        </Tooltip>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      align: "right",
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              disabled={!canEdit || Boolean(savingKey)}
              onClick={() => openEdit(row)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!canEdit || Boolean(savingKey)}
              loading={savingKey === `delete:${row._id}`}
              onClick={() => deleteRow(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTableChange = (next: TablePaginationConfig) => {
    const page = Number(next.current || 1);
    setPagination((prev) => ({ ...prev, page }));
    loadRows(page, roleFilter);
  };

  if (loadingPermissions) {
    return <Card loading style={{ margin: 24 }} />;
  }

  if (!canView) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          showIcon
          message="You do not have permission to view Mobile Dashboard configuration."
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {toastHolder}

      <div className="cm-system-page-header">
        <div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            Mobile Dashboard
          </Typography.Title>
          <Typography.Text type="secondary">
            Remotely control which dashboard items each mobile role receives, their order, destination and visibility.
          </Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<QuestionCircleOutlined />} onClick={() => setHelpOpen(true)}>
            Help
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadRows(pagination.page, roleFilter)}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit || !roleFilter} onClick={openNew}>
            Add dashboard item
          </Button>
        </Space>
      </div>

      <Alert
        style={{ marginTop: 16 }}
        type="info"
        showIcon
        message="The API configuration is authoritative"
        description="Enable, disable and reorder items here. The Android app must render the successful API response; it must not invent role-specific fallback actions when this configuration fails."
      />

      {appControl ? (
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <BgColorsOutlined />
              <span>App-wide controls & theme</span>
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!canEdit || appControlSaving}
              loading={appControlSaving}
              onClick={saveAppWideControl}
            >
              Save app-wide controls
            </Button>
          }
        >
          <Alert
            type="warning"
            showIcon
            message="Locked controls cannot be disabled"
            description="Authentication, legal and safe-navigation entries are intentionally protected. Other feature and guest-home controls can be switched off remotely."
            style={{ marginBottom: 16 }}
          />

          <Typography.Title level={5}>Platform features</Typography.Title>
          <Row gutter={[12, 12]}>
            {controlsByType("FEATURE").map((item) => (
              <Col xs={24} md={12} lg={8} key={item.control_key}>
                <Card size="small">
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <div>
                      <Typography.Text strong>{item.label}</Typography.Text>
                      <br />
                      <Typography.Text type="secondary">{item.control_key}</Typography.Text>
                    </div>
                    <Switch checked={item.enabled === "Y"} disabled={!canEdit || item.locked === "Y"} onChange={() => toggleAppControl(item.control_key)} />
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          <Typography.Title level={5} style={{ marginTop: 20 }}>Guest / public home</Typography.Title>
          <Row gutter={[12, 12]}>
            {controlsByType("PUBLIC_SECTION").map((item) => (
              <Col xs={24} md={12} lg={8} key={item.control_key}>
                <Card size="small">
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <div>
                      <Space>
                        <Typography.Text strong>{item.label}</Typography.Text>
                        {item.locked === "Y" ? <Tag icon={<LockOutlined />}>Locked</Tag> : null}
                      </Space>
                      <br />
                      <Typography.Text type="secondary">{item.control_key}</Typography.Text>
                    </div>
                    <Switch checked={item.enabled === "Y"} disabled={!canEdit || item.locked === "Y"} onChange={() => toggleAppControl(item.control_key)} />
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>

          <Collapse
            style={{ marginTop: 20 }}
            items={[{
              key: "theme",
              label: "Remote theme colours",
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    message="Theme colours are cached by Android"
                    description="Remote-aware screens and the app shell use these tokens with the existing CiberMandi colours as offline fallback."
                    style={{ marginBottom: 12 }}
                  />
                  <Row gutter={[12, 12]}>
                    {[
                      ["primary_hex", "Primary action"], ["secondary_hex", "Secondary"], ["accent_hex", "Accent"], ["app_bg_hex", "App background"], ["surface_hex", "Surface"],
                      ["text_primary_hex", "Primary text"], ["text_secondary_hex", "Secondary text"], ["text_muted_hex", "Muted text"], ["border_hex", "Default border"],
                      ["success_hex", "Success"], ["warning_hex", "Warning"], ["error_hex", "Error / destructive"], ["info_hex", "Info"],
                      ["icon_tint_hex", "Default icon tint"], ["icon_container_hex", "Icon container"], ["card_background_hex", "Card background"], ["card_border_hex", "Card border"],
                      ["input_background_hex", "Input background"], ["input_border_hex", "Input border"], ["input_focus_border_hex", "Input focus border"],
                      ["toolbar_background_hex", "Toolbar background"], ["toolbar_title_hex", "Toolbar title"], ["toolbar_icon_hex", "Toolbar icon"],
                      ["bottom_nav_background_hex", "Bottom nav background"], ["bottom_nav_selected_hex", "Bottom nav selected"], ["bottom_nav_unselected_hex", "Bottom nav unselected"],
                    ].map(([key, label]) => (
                      <Col xs={24} sm={12} lg={8} key={key}>
                        <label>
                          <span>{label}</span>
                          <Input
                            value={String((appControl.theme as any)?.[key] || "")}
                            disabled={!canEdit}
                            placeholder="#55632C"
                            onChange={(event) => updateTheme(key as keyof MobileAppControl["theme"], event.target.value)}
                          />
                        </label>
                      </Col>
                    ))}
                  </Row>
                </>
              ),
            }, {
              key: "layout-density",
              label: "Layout, density & typography",
              children: (
                <>
                  <Alert type="info" showIcon message="One spacing owner per boundary" description="Screen inset, RecyclerView inset and card inner padding are separate semantic tokens. Android responsive containers consume them through CmResponsiveUi so padding is not accidentally stacked." style={{ marginBottom: 12 }} />
                  <Typography.Text strong>Layout & density (dp)</Typography.Text>
                  <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
                    {[
                      ["screen_horizontal_dp","Screen horizontal",8,24], ["screen_vertical_dp","Screen vertical",4,24], ["section_gap_dp","Section gap",4,24], ["card_gap_dp","Card gap",4,24],
                      ["card_inner_padding_dp","Card inner padding",8,24], ["grid_gutter_dp","Grid gutter",4,20], ["control_gap_dp","Control gap",4,20], ["toolbar_horizontal_dp","Toolbar inset",8,24],
                      ["card_radius_dp","Card radius",8,24], ["control_height_dp","Control height",44,60], ["icon_dp","Icon size",18,30], ["icon_container_dp","Icon container",32,52],
                    ].map(([key,label,min,max]) => (
                      <Col xs={24} sm={12} lg={8} key={String(key)}><label><span>{String(label)}</span><InputNumber style={{ width:"100%" }} min={Number(min)} max={Number(max)} disabled={!canEdit} value={Number((appControl.layout_density as any)?.[String(key)] ?? 0)} onChange={(value) => updateLayoutToken(key as keyof MobileAppControl["layout_density"], value)} /></label></Col>
                    ))}
                  </Row>
                  <Typography.Text strong style={{ display:"block", marginTop:18 }}>Typography (sp)</Typography.Text>
                  <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
                    {[
                      ["title_sp","Title",18,24], ["section_sp","Section",14,20], ["body_sp","Body",12,17], ["small_sp","Small / caption",10,14], ["button_sp","Button",12,17], ["label_sp","Field label",11,16], ["input_sp","Input text",13,18],
                    ].map(([key,label,min,max]) => (
                      <Col xs={24} sm={12} lg={8} key={String(key)}><label><span>{String(label)}</span><InputNumber style={{ width:"100%" }} min={Number(min)} max={Number(max)} step={0.5} disabled={!canEdit} value={Number((appControl.typography as any)?.[String(key)] ?? 0)} onChange={(value) => updateTypographyToken(key as keyof MobileAppControl["typography"], value)} /></label></Col>
                    ))}
                  </Row>
                  <Typography.Text strong style={{ display:"block", marginTop:18 }}>Design preview</Typography.Text>
                  <div style={{ marginTop:10, maxWidth:360, padding:Number(appControl.layout_density?.screen_horizontal_dp || 16), background:String(appControl.theme?.app_bg_hex || "#F7F5EF"), borderRadius:18, border:`1px solid ${String(appControl.theme?.border_hex || "#DDE2D5")}` }}>
                    <div style={{ padding:`10px ${Number(appControl.layout_density?.toolbar_horizontal_dp || 16)}px`, background:String(appControl.theme?.toolbar_background_hex || "#FFFFFF"), color:String(appControl.theme?.toolbar_title_hex || "#1F2933"), borderRadius:10, fontSize:Number(appControl.typography?.section_sp || 16), fontWeight:700 }}>CiberMandi preview</div>
                    <div style={{ marginTop:Number(appControl.layout_density?.section_gap_dp || 12), padding:Number(appControl.layout_density?.card_inner_padding_dp || 16), background:String(appControl.theme?.card_background_hex || "#FFFFFF"), border:`1px solid ${String(appControl.theme?.card_border_hex || "#DDE2D5")}`, borderRadius:Number(appControl.layout_density?.card_radius_dp || 16) }}>
                      <div style={{ color:String(appControl.theme?.text_primary_hex || "#1F2933"), fontSize:Number(appControl.typography?.section_sp || 16), fontWeight:700 }}>Marketplace card</div>
                      <div style={{ color:String(appControl.theme?.text_secondary_hex || "#6B7280"), fontSize:Number(appControl.typography?.body_sp || 14), marginTop:Number(appControl.layout_density?.control_gap_dp || 8) }}>This preview uses the same semantic tokens saved for Android.</div>
                      <Space style={{ marginTop:Number(appControl.layout_density?.section_gap_dp || 12) }}>
                        <Button style={{ background:String(appControl.theme?.primary_hex || "#55632C"), borderColor:String(appControl.theme?.primary_hex || "#55632C"), color:"#fff", borderRadius:Number(appControl.layout_density?.card_radius_dp || 16) }}>Primary</Button>
                        <Button style={{ color:String(appControl.theme?.primary_hex || "#55632C"), borderColor:String(appControl.theme?.primary_hex || "#55632C"), borderRadius:Number(appControl.layout_density?.card_radius_dp || 16) }}>Secondary</Button>
                      </Space>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-around", marginTop:Number(appControl.layout_density?.card_gap_dp || 12), padding:10, background:String(appControl.theme?.bottom_nav_background_hex || "#FFFFFF"), color:String(appControl.theme?.bottom_nav_selected_hex || "#55632C"), borderRadius:12 }}>
                      <span>Home</span><span style={{ color:String(appControl.theme?.bottom_nav_unselected_hex || "#8A9086") }}>Market</span><span style={{ color:String(appControl.theme?.bottom_nav_unselected_hex || "#8A9086") }}>More</span>
                    </div>
                  </div>
                </>
              ),
            }, {
              key: "locked",
              label: "Locked safety / legal screens",
              children: (
                <Space wrap>
                  {controlsByType("SYSTEM_SCREEN").map((item) => (
                    <Tag key={item.control_key} icon={<LockOutlined />} color="default">{item.label}</Tag>
                  ))}
                </Space>
              ),
            }]}
          />
        </Card>
      ) : null}

      {loadError ? (
        <Alert
          style={{ marginTop: 12 }}
          type="error"
          showIcon
          message="Mobile Dashboard could not be loaded"
          description={loadError}
          action={<Button onClick={() => loadRows(pagination.page, roleFilter)}>Retry</Button>}
        />
      ) : null}

      <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="Configured" value={summary.total} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Enabled" value={summary.active} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Disabled" value={summary.inactive} /></Card>
        </Col>
      </Row>

      <Card className="cm-system-toolbar-card" size="small">
        <div className="cm-system-toolbar-grid">
          <Input.Search
            allowClear
            placeholder="Search widget key, title, route or permission"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={(value) => {
              setSearch(value.trim());
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
          <Dropdown menu={roleMenu} trigger={["click"]}>
            <Button block>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <span>
                  {roleFilter
                    ? friendlyRoleLabel(roleOptions.find((item) => item.role_code === roleFilter) || { role_code: roleFilter })
                    : "Choose role"}
                </span>
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
          <Space>
            {(["ALL", "Y", "N"] as StatusFilter[]).map((value) => (
              <Button
                key={value}
                type={statusFilter === value ? "primary" : "default"}
                onClick={() => {
                  setStatusFilter(value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                {value === "ALL" ? "All" : value === "Y" ? "Enabled" : "Disabled"}
              </Button>
            ))}
          </Space>
          <Button
            icon={<SaveOutlined />}
            disabled={!canEdit || !rows.length || Boolean(savingKey)}
            loading={savingKey === "reorder"}
            onClick={saveVisibleOrder}
          >
            Save visible order
          </Button>
        </div>
      </Card>

      <Card className="cm-system-table-card" bordered={false}>
        <Table
          rowKey={(row) => row._id || `${row.role_code}:${row.widget_key}`}
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `${total} item${total === 1 ? "" : "s"}`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: roleFilter ? (
              <Empty description="No dashboard items match this role/filter." />
            ) : (
              <Empty description="Choose a role to view its dashboard." />
            ),
          }}
        />
      </Card>

      <Drawer
        title={form._id ? "Edit dashboard item" : "Add dashboard item"}
        width={620}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingKey === "save"}
            disabled={
              !canEdit ||
              !form.role_code ||
              !form.widget_key.trim() ||
              !form.title_en.trim() ||
              Boolean(savingKey && savingKey !== "save")
            }
            onClick={saveForm}
          >
            Save
          </Button>
        }
      >
        <Alert
          type="warning"
          showIcon
          message="Changes affect the mobile app"
          description="Use an existing Android-supported route/action. A wrong route may make the item visible but not navigable."
          style={{ marginBottom: 16 }}
        />

        <div className="cm-system-form-grid">
          <label>
            <span>Role</span>
            <Dropdown menu={formRoleMenu} trigger={["click"]}>
              <Button block disabled={Boolean(form._id)}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <span>{form.role_code ? form.role_code.split("_").join(" ") : "Choose role"}</span>
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          </label>

          <label>
            <span>Order</span>
            <InputNumber
              min={0}
              precision={0}
              value={form.order}
              onChange={(value) => setForm((prev) => ({ ...prev, order: value === null ? null : Number(value) }))}
              style={{ width: "100%" }}
              placeholder="Auto"
            />
          </label>

          <label className="cm-system-form-span-2">
            <span>Widget key</span>
            <Input
              value={form.widget_key}
              disabled={Boolean(form._id)}
              placeholder="e.g. farmer.weather_now"
              onChange={(event) => setForm((prev) => ({ ...prev, widget_key: event.target.value }))}
            />
          </label>

          <label>
            <span>English title</span>
            <Input
              value={form.title_en}
              onChange={(event) => setForm((prev) => ({ ...prev, title_en: event.target.value }))}
            />
          </label>

          <label>
            <span>Hindi title</span>
            <Input
              value={form.title_hi}
              onChange={(event) => setForm((prev) => ({ ...prev, title_hi: event.target.value }))}
            />
          </label>

          <label className="cm-system-form-span-2">
            <span>Android route / action</span>
            <Input
              value={form.route}
              placeholder="Activity/action understood by the mobile app"
              onChange={(event) => setForm((prev) => ({ ...prev, route: event.target.value }))}
            />
          </label>

          <label>
            <span>Permission key</span>
            <Input
              value={form.permission_key}
              placeholder="Optional RBAC resource key"
              onChange={(event) => setForm((prev) => ({ ...prev, permission_key: event.target.value }))}
            />
          </label>

          <label>
            <span>API name</span>
            <Input
              value={form.api_name}
              placeholder="Optional data API identifier"
              onChange={(event) => setForm((prev) => ({ ...prev, api_name: event.target.value }))}
            />
          </label>

          <label>
            <span>Layout</span>
            <Dropdown menu={layoutMenu} trigger={["click"]}>
              <Button block>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <span>{form.layout.split("_").join(" ")}</span>
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          </label>

          <label>
            <span>Status</span>
            <Space>
              <Switch
                checked={form.is_active === "Y"}
                onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked ? "Y" : "N" }))}
              />
              <span>{form.is_active === "Y" ? "Enabled" : "Disabled"}</span>
            </Space>
          </label>

          <div className="cm-system-form-span-2">
            <Collapse
              ghost
              items={[
                {
                  key: "advanced",
                  label: "Advanced metadata (JSON)",
                  children: (
                    <>
                      <Typography.Paragraph type="secondary">
                        Keep this for renderer-specific settings such as icon_key, display, section, readonly or other
                        mobile metadata. Leave blank when not needed.
                      </Typography.Paragraph>
                      <Input.TextArea
                        autoSize={{ minRows: 5, maxRows: 12 }}
                        value={form.metadata}
                        placeholder={'{\n  "icon_key": "HOME"\n}'}
                        onChange={(event) => setForm((prev) => ({ ...prev, metadata: event.target.value }))}
                      />
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </Drawer>

      <Drawer title="Mobile App Control Help" width={680} open={helpOpen} onClose={() => setHelpOpen(false)}>
        <Typography.Title level={4}>What this screen controls</Typography.Title>
        <Typography.Paragraph>
          This is the central configuration for the role-based dashboard returned to the Android app. Each role has its
          own ordered list of dashboard items. The mobile API returns only active configuration for the user&apos;s
          effective role and then applies the item&apos;s permission key where one is configured.
        </Typography.Paragraph>

        <Typography.Title level={5}>App-wide controls</Typography.Title>
        <Typography.Paragraph>
          Platform feature switches can hide major modules across role dashboards and block their Android Activities.
          Guest/public-home switches control the pre-login home sections. Controls marked <strong>Locked</strong> are
          safety, authentication or legal paths and cannot be disabled from this screen.
        </Typography.Paragraph>

        <Typography.Title level={5}>Remote theme colours</Typography.Title>
        <Typography.Paragraph>
          Primary, secondary, accent, background and surface colours are cached by Android. Remote-aware screens and
          the global app shell use them, while the existing CiberMandi resource colours remain the offline fallback.
          Use valid six-digit HEX values such as <strong>#55632C</strong>.
        </Typography.Paragraph>

        <Typography.Title level={5}>Layout, density and typography</Typography.Title>
        <Typography.Paragraph>
          Screen inset, card spacing, card inner padding, grid gutter and control spacing are centrally controlled but clamped to safe ranges. Android applies these through <strong>CmResponsiveUi</strong> and responsive XML/custom roots. A RecyclerView that owns the screen inset must not also use item-level horizontal screen margins; card inner padding is a separate token. Typography uses the system Android font stack with semantic sizes rather than custom font files.
        </Typography.Paragraph>

        <Typography.Title level={5}>Safe way to make a change</Typography.Title>
        <Typography.Paragraph>
          Choose the role first. Prefer disabling an item before deleting it. Change one role at a time, save, and test
          that role in Android. Edits require step-up verification because they can remotely affect the mobile
          experience.
        </Typography.Paragraph>

        <Typography.Title level={5}>Fields</Typography.Title>
        <Typography.Paragraph>
          <strong>Widget key</strong> is the stable identifier used by Android. <strong>Title</strong> is the
          user-visible label. <strong>Route / action</strong> tells Android where to navigate.{" "}
          <strong>Permission key</strong> optionally applies RBAC. <strong>Layout</strong> controls whether the item is
          full width, a two-column quick action or a list item. <strong>Order</strong> controls its position.
          <strong> Enabled</strong> decides whether the mobile API returns it.
        </Typography.Paragraph>

        <Typography.Title level={5}>Advanced metadata</Typography.Title>
        <Typography.Paragraph>
          Metadata is only for renderer-specific options that already exist in Android, such as an icon key, section,
          display mode or readonly flag. It should not be used to invent business values. API/business data remains the
          source of truth.
        </Typography.Paragraph>

        <Typography.Title level={5}>Important behaviour</Typography.Title>
        <Typography.Paragraph>
          A successful empty API response means the role genuinely has no configured dashboard items. A network or API
          failure is an error and must not be replaced by locally hard-coded role actions. This keeps this screen
          authoritative.
        </Typography.Paragraph>

        <Alert
          type="info"
          showIcon
          message="Android capability boundary"
          description="This screen can remotely enable, disable, order, label and route capabilities that the installed Android build already understands. Adding a brand-new Android screen still requires an app release."
        />
      </Drawer>
    </div>
  );
};

export default MobileDashboardAdminPage;
