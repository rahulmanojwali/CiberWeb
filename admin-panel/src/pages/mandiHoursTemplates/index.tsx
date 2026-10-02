import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  createMandiHoursTemplate,
  deactivateMandiHoursTemplate,
  fetchMandiHoursTemplates,
  getMandisForCurrentScope,
  updateMandiHoursTemplate,
} from "../../services/mandiApi";
import "./mandiHoursTemplates.css";

const { Text } = Typography;

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

type StatusFlag = "Y" | "N";
type StatusFilter = "ALL" | StatusFlag;
type DayKey = (typeof DAYS)[number];

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
};

type MandiOption = {
  value: string;
  label: string;
};

type TimeWindow = {
  open: string;
  close: string;
  note?: string;
};

type HoursRow = {
  id: string;
  mandi_id: number;
  timezone: string;
  is_active: StatusFlag;
  effective_from?: string | null;
  effective_to?: string | null;
  open_days: DayKey[];
  day_hours: any[];
  exclusions?: {
    exclude_day_of_month?: number[];
    exclude_dates?: string[];
  };
};

type HoursSummary = {
  total: number;
  active: number;
  inactive: number;
  future: number;
};

const EMPTY_SUMMARY: HoursSummary = { total: 0, active: 0, inactive: 0, future: 0 };

function currentUsername(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || "");
  } catch {
    return "";
  }
}

function responseData(raw: any): any {
  return raw?.data || raw?.response?.data || raw || {};
}

function responseMeta(raw: any): { code: string; description: string } {
  const response = raw?.response || raw?.data?.response || raw;
  return {
    code: String(response?.responsecode ?? raw?.responsecode ?? raw?.responseCode ?? "0"),
    description: String(response?.description ?? raw?.description ?? ""),
  };
}

function localizedMandiLabel(row: any, language: string): string {
  return String(
    row?.label ||
      row?.name_i18n?.[language] ||
      row?.name_i18n?.en ||
      row?.mandi_name ||
      row?.mandi_slug ||
      row?.mandi_id ||
      "",
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function normalizeRow(item: any): HoursRow {
  const openDays = Array.isArray(item?.open_days)
    ? item.open_days.filter((day: string) => DAYS.includes(day as DayKey))
    : [];
  return {
    id: String(item?.template_id ?? item?._id ?? ""),
    mandi_id: Number(item?.mandi_id || 0),
    timezone: String(item?.timezone || "Asia/Kolkata"),
    is_active: String(item?.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
    effective_from: item?.effective_from || null,
    effective_to: item?.effective_to || null,
    open_days: openDays as DayKey[],
    day_hours: Array.isArray(item?.day_hours) ? item.day_hours : [],
    exclusions: item?.exclusions || undefined,
  };
}

function toDayHoursMap(dayHours: any[]): Record<string, TimeWindow[]> {
  const result: Record<string, TimeWindow[]> = {};
  (Array.isArray(dayHours) ? dayHours : []).forEach((entry: any) => {
    const day = String(entry?.day || "").toUpperCase();
    if (!DAYS.includes(day as DayKey)) return;
    const windows = Array.isArray(entry?.windows) ? entry.windows : [entry];
    windows.forEach((window: any) => {
      const open = String(window?.open_time || window?.open || "");
      const close = String(window?.close_time || window?.close || "");
      if (!open && !close) return;
      if (!result[day]) result[day] = [];
      result[day].push({ open, close, note: String(window?.note || "") });
    });
  });
  return result;
}

function scheduleSummary(row: HoursRow): string {
  if (!row.open_days.length) return "No weekly schedule";
  const hours = toDayHoursMap(row.day_hours);
  const signatures = row.open_days.map((day) => {
    const windows = hours[day] || [];
    return `${day}:${windows.map((window) => `${window.open}-${window.close}`).join("|")}`;
  });
  const times = signatures
    .map((signature) => signature.split(":").slice(1).join(":"))
    .filter(Boolean);
  const sameHours = times.length > 0 && times.every((value) => value === times[0]);
  if (sameHours) {
    return `${row.open_days.map((day) => DAY_LABELS[day]).join(", ")} · ${times[0].split("|").join(", ")}`;
  }
  return `${row.open_days.length} open day${row.open_days.length === 1 ? "" : "s"} · variable hours`;
}

function validateWindows(openDays: DayKey[], dayHours: Record<string, TimeWindow[]>): string | null {
  if (!openDays.length) return "Select at least one open day.";
  for (const day of openDays) {
    const windows = dayHours[day] || [];
    if (!windows.length) return `Add at least one opening window for ${DAY_LABELS[day]}.`;
    for (const window of windows) {
      if (!window.open || !window.close) return `Complete the opening and closing time for ${DAY_LABELS[day]}.`;
      if (window.open >= window.close) return `Closing time must be after opening time for ${DAY_LABELS[day]}.`;
    }
  }
  return null;
}

export const MandiHoursTemplates: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [searchParams] = useSearchParams();
  const { authContext, can, isSuper } = usePermissions();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("mandi_hours.create", "CREATE");
  const canUpdate = can("mandi_hours.edit", "UPDATE");
  const canDeactivate = can("mandi_hours.deactivate", "DEACTIVATE");

  const requestedOrgId = String(searchParams.get("org_id") || "").trim();
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((item) => item.value === selectedSuperOrgId);

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [mandisLoading, setMandisLoading] = useState(false);
  const [selectedMandiId, setSelectedMandiId] = useState<string>(String(searchParams.get("mandi_id") || ""));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [useEndDate, setUseEndDate] = useState(false);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [openDays, setOpenDays] = useState<DayKey[]>([]);
  const [dayHours, setDayHours] = useState<Record<string, TimeWindow[]>>({});
  const [closedOnMonthlyDay, setClosedOnMonthlyDay] = useState(false);
  const [monthlyDays, setMonthlyDays] = useState<string[]>([]);
  const [closedOnDates, setClosedOnDates] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);

  useEffect(() => {
    if (!isSuper || !username) return;
    let cancelled = false;
    const load = async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language });
        const data = responseData(raw);
        const organisations = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.organisations)
            ? data.organisations
            : Array.isArray(data)
              ? data
              : [];
        const options: OrganisationOption[] = organisations
          .map((item: any) => ({
            value: String(item?._id || item?.org_id || ""),
            label: String(item?.org_name || item?.name || item?.org_code || item?._id || ""),
            orgCode: String(item?.org_code || ""),
          }))
          .filter((item: OrganisationOption) => item.value && item.label);
        if (!cancelled) {
          setOrganisationOptions(options);
          if (selectedSuperOrgId && !options.some((item) => item.value === selectedSuperOrgId)) {
            setSelectedSuperOrgId("");
          }
        }
      } catch (error: any) {
        if (!cancelled) messageApi.error(error?.message || "Unable to load organisations.");
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSuper, language, messageApi, selectedSuperOrgId, username]);

  const loadMandis = useCallback(async () => {
    if (!username || !orgId) {
      setMandis([]);
      setSelectedMandiId("");
      return;
    }
    setMandisLoading(true);
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
        filters: { page: 1, pageSize: 500, is_active: "Y" },
      });
      const options: MandiOption[] = (Array.isArray(list) ? list : [])
        .map((item: any) => ({
          value: String(item?.mandi_id || ""),
          label: localizedMandiLabel(item, language),
        }))
        .filter((item: MandiOption) => item.value && item.label);
      setMandis(options);
      setSelectedMandiId((current) => (current && options.some((item) => item.value === current) ? current : ""));
    } catch (error: any) {
      setMandis([]);
      setSelectedMandiId("");
      messageApi.error(error?.message || "Unable to load mandis.");
    } finally {
      setMandisLoading(false);
    }
  }, [language, messageApi, orgId, username]);

  useEffect(() => {
    void loadMandis();
  }, [loadMandis]);

  const loadTemplates = useCallback(async () => {
    if (!username || !orgId || !selectedMandiId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const raw = await fetchMandiHoursTemplates({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to load hours templates.");
      const data = responseData(raw);
      const items = Array.isArray(data?.items) ? data.items : [];
      setRows(items.map(normalizeRow));
    } catch (error: any) {
      setRows([]);
      messageApi.error(error?.message || "Unable to load hours templates.");
    } finally {
      setLoading(false);
    }
  }, [language, messageApi, orgId, selectedMandiId, username]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectedMandi = mandis.find((item) => item.value === selectedMandiId);
  const visibleRows = useMemo(
    () => rows.filter((row) => statusFilter === "ALL" || row.is_active === statusFilter),
    [rows, statusFilter],
  );

  const summary = useMemo<HoursSummary>(() => {
    if (!rows.length) return EMPTY_SUMMARY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: rows.length,
      active: rows.filter((row) => row.is_active === "Y").length,
      inactive: rows.filter((row) => row.is_active === "N").length,
      future: rows.filter((row) => {
        if (!row.effective_from) return false;
        const date = new Date(row.effective_from);
        return !Number.isNaN(date.getTime()) && date.getTime() > today.getTime();
      }).length,
    };
  }, [rows]);

  const resetForm = useCallback(() => {
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setEffectiveTo("");
    setUseEndDate(false);
    setTimezone("Asia/Kolkata");
    setOpenDays([]);
    setDayHours({});
    setClosedOnMonthlyDay(false);
    setMonthlyDays([]);
    setClosedOnDates(false);
    setClosedDates([]);
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (row: HoursRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setEffectiveFrom(row.effective_from ? String(row.effective_from).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEffectiveTo(row.effective_to ? String(row.effective_to).slice(0, 10) : "");
    setUseEndDate(Boolean(row.effective_to));
    setTimezone(row.timezone || "Asia/Kolkata");
    setOpenDays(row.open_days || []);
    setDayHours(toDayHoursMap(row.day_hours));
    const exclusionDays = row.exclusions?.exclude_day_of_month || [];
    const exclusionDates = row.exclusions?.exclude_dates || [];
    setClosedOnMonthlyDay(exclusionDays.length > 0);
    setMonthlyDays(exclusionDays.map(String));
    setClosedOnDates(exclusionDates.length > 0);
    setClosedDates(exclusionDates.map((value) => String(value).slice(0, 10)));
    setModalOpen(true);
  };

  const toggleDay = (day: DayKey) => {
    setOpenDays((current) => {
      if (current.includes(day)) return current.filter((value) => value !== day);
      return DAYS.filter((candidate) => [...current, day].includes(candidate));
    });
    setDayHours((current) => {
      if (current[day]?.length) return current;
      return { ...current, [day]: [{ open: "09:00", close: "17:00", note: "" }] };
    });
  };

  const setAllDays = (checked: boolean) => {
    if (!checked) {
      setOpenDays([]);
      return;
    }
    setOpenDays([...DAYS]);
    setDayHours((current) => {
      const next = { ...current };
      DAYS.forEach((day) => {
        if (!next[day]?.length) next[day] = [{ open: "09:00", close: "17:00", note: "" }];
      });
      return next;
    });
  };

  const updateWindow = (day: DayKey, index: number, field: keyof TimeWindow, value: string) => {
    setDayHours((current) => {
      const list = [...(current[day] || [])];
      list[index] = { ...list[index], [field]: value };
      return { ...current, [day]: list };
    });
  };

  const addWindow = (day: DayKey) => {
    setDayHours((current) => ({
      ...current,
      [day]: [...(current[day] || []), { open: "09:00", close: "17:00", note: "" }],
    }));
  };

  const removeWindow = (day: DayKey, index: number) => {
    setDayHours((current) => ({
      ...current,
      [day]: (current[day] || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (!username || !orgId || !selectedMandiId) return;
    if (!effectiveFrom) {
      messageApi.error("Effective from date is required.");
      return;
    }
    if (useEndDate && !effectiveTo) {
      messageApi.error("Select an effective to date or turn off the end date.");
      return;
    }
    if (useEndDate && effectiveTo < effectiveFrom) {
      messageApi.error("Effective to cannot be earlier than effective from.");
      return;
    }
    const windowError = validateWindows(openDays, dayHours);
    if (windowError) {
      messageApi.error(windowError);
      return;
    }

    const compiledHours = openDays.map((day) => ({
      day,
      windows: (dayHours[day] || []).map((window) => ({
        open_time: window.open,
        close_time: window.close,
        ...(window.note?.trim() ? { note: window.note.trim() } : {}),
      })),
    }));
    const exclusions = {
      exclude_day_of_month: closedOnMonthlyDay
        ? monthlyDays.map(Number).filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
        : [],
      exclude_dates: closedOnDates ? closedDates : [],
    };
    const payload: Record<string, any> = {
      org_id: orgId,
      mandi_id: Number(selectedMandiId),
      timezone: timezone.trim() || "Asia/Kolkata",
      open_days: openDays,
      day_hours: compiledHours,
      effective_from: effectiveFrom,
      effective_to: useEndDate ? effectiveTo : null,
      exclusions,
      is_active: "Y",
    };
    if (isEdit && editId) payload.template_id = editId;

    setSubmitting(true);
    try {
      const raw = isEdit
        ? await updateMandiHoursTemplate({ username, language, payload })
        : await createMandiHoursTemplate({ username, language, payload });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || `Unable to ${isEdit ? "update" : "create"} template.`);
      messageApi.success(`Hours template ${isEdit ? "updated" : "created"}.`);
      setModalOpen(false);
      await loadTemplates();
    } catch (error: any) {
      messageApi.error(error?.message || `Unable to ${isEdit ? "update" : "create"} template.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (row: HoursRow) => {
    if (!username || !orgId || !selectedMandiId) return;
    try {
      const raw = await deactivateMandiHoursTemplate({
        username,
        language,
        payload: { org_id: orgId, mandi_id: Number(selectedMandiId), template_id: row.id, is_active: "N" },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to deactivate template.");
      messageApi.success("Hours template deactivated.");
      await loadTemplates();
    } catch (error: any) {
      messageApi.error(error?.message || "Unable to deactivate template.");
    }
  };

  const handleActivate = async (row: HoursRow) => {
    if (!username || !orgId || !selectedMandiId) return;
    try {
      const raw = await updateMandiHoursTemplate({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          template_id: row.id,
          is_active: "Y",
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to activate template.");
      messageApi.success("Hours template activated. Any previously active template for this mandi was deactivated.");
      await loadTemplates();
    } catch (error: any) {
      messageApi.error(error?.message || "Unable to activate template.");
    }
  };

  const columns = useMemo<TableColumnsType<HoursRow>>(
    () => [
      {
        title: "Schedule",
        key: "schedule",
        render: (_, row) => (
          <div className="cm-hours-schedule-cell">
            <Text strong>{scheduleSummary(row)}</Text>
            <Text type="secondary">{row.timezone}</Text>
          </div>
        ),
      },
      {
        title: "Effective from",
        dataIndex: "effective_from",
        width: 150,
        render: (value) => formatDate(value),
      },
      {
        title: "Effective to",
        dataIndex: "effective_to",
        width: 150,
        render: (value) => formatDate(value),
      },
      {
        title: "Exceptions",
        key: "exceptions",
        width: 150,
        render: (_, row) => {
          const monthly = row.exclusions?.exclude_day_of_month?.length || 0;
          const dates = row.exclusions?.exclude_dates?.length || 0;
          if (!monthly && !dates) return <Text type="secondary">None</Text>;
          return <Text>{monthly + dates} configured</Text>;
        },
      },
      {
        title: "Status",
        dataIndex: "is_active",
        width: 110,
        render: (value: StatusFlag) => (
          <Tag color={value === "Y" ? "success" : "default"}>{value === "Y" ? "Active" : "Inactive"}</Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 220,
        render: (_, row) => (
          <Space size={6} wrap>
            {canUpdate && (
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                Edit
              </Button>
            )}
            {row.is_active === "Y" && canDeactivate ? (
              <Popconfirm
                title="Deactivate hours template?"
                description="The template is retained for history but will no longer be active."
                okText="Deactivate"
                onConfirm={() => void handleDeactivate(row)}
              >
                <Button size="small" danger icon={<StopOutlined />}>Deactivate</Button>
              </Popconfirm>
            ) : row.is_active === "N" && canUpdate ? (
              <Popconfirm
                title="Activate this template?"
                description="Any currently active template for this mandi will be deactivated."
                okText="Activate"
                onConfirm={() => void handleActivate(row)}
              >
                <Button size="small" icon={<CheckCircleOutlined />}>Activate</Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [canDeactivate, canUpdate],
  );

  const noScope = !orgId;
  const allDaysChecked = openDays.length === DAYS.length;

  return (
    <PageContainer title={t("menu.mandiHoursTemplates", { defaultValue: "Mandi Hours Templates" })}>
      {messageContextHolder}
      <div className="cm-mandi-hours-page">
        <CmPageHeader
          eyebrow="MANDI OPERATIONS"
          title={t("menu.mandiHoursTemplates", { defaultValue: "Mandi Hours Templates" })}
          subtitle="Define mandi operating schedules, effective periods and closure exceptions with one controlled active template at a time."
          actions={<Button icon={<ReloadOutlined />} onClick={() => void loadTemplates()} disabled={!selectedMandiId}>Refresh</Button>}
        />

        <CmSectionCard compact className="cm-hours-scope-card">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} lg={12}>
              <div className="cm-hours-scope-copy">
                <Text className="cm-hours-scope-kicker">WORKING SCOPE</Text>
                <Text strong className="cm-hours-scope-title">
                  {isSuper ? selectedOrg?.label || "Select an organisation" : authContext.org_code || "Organisation"}
                </Text>
                <Text type="secondary">Hours templates are mandi-specific. Organisation and mandi access remain locked to the current role scope.</Text>
              </div>
            </Col>
            <Col xs={24} lg={12}>
              {isSuper ? (
                <Select
                  className="cm-hours-select"
                  value={selectedSuperOrgId || undefined}
                  placeholder="Select organisation"
                  loading={organisationsLoading}
                  showSearch
                  optionFilterProp="label"
                  options={organisationOptions}
                  onChange={(value) => {
                    setSelectedSuperOrgId(String(value));
                    setSelectedMandiId("");
                    setRows([]);
                  }}
                  style={{ width: "100%" }}
                />
              ) : (
                <div className="cm-hours-scope-lock">{authContext.org_code || "Organisation scope locked by role"}</div>
              )}
            </Col>
          </Row>
        </CmSectionCard>

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} xl={6}>
            <CmStatCard label="Templates" value={summary.total} helper={selectedMandi?.label || "Select a mandi"} icon={<CalendarOutlined />} tone="olive" />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <CmStatCard label="Active" value={summary.active} helper="Current active schedule" icon={<CheckCircleOutlined />} tone="olive" />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <CmStatCard label="Inactive" value={summary.inactive} helper="Retained schedule history" icon={<StopOutlined />} tone="neutral" />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <CmStatCard label="Future dated" value={summary.future} helper="Starts after today" icon={<ClockCircleOutlined />} tone="amber" />
          </Col>
        </Row>

        <CmSectionCard compact className="cm-hours-catalogue-card">
          <div className="cm-hours-toolbar">
            <div className="cm-hours-toolbar-left">
              <Select
                className="cm-hours-select cm-hours-mandi-select"
                value={selectedMandiId || undefined}
                placeholder="Select mandi"
                showSearch
                optionFilterProp="label"
                loading={mandisLoading}
                options={mandis}
                disabled={noScope}
                onChange={(value) => setSelectedMandiId(String(value))}
              />
              <Select
                className="cm-hours-select cm-hours-status-select"
                value={statusFilter}
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "Y", label: "Active" },
                  { value: "N", label: "Inactive" },
                ]}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
              />
            </div>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} disabled={!selectedMandiId} onClick={openCreate}>
                Create template
              </Button>
            )}
          </div>

          {!orgId ? (
            <Alert type="info" showIcon message="Select an organisation to load its mandis." />
          ) : !selectedMandiId ? (
            <Alert type="info" showIcon message="Select a mandi to view and manage its operating-hours templates." />
          ) : null}

          <Table<HoursRow>
            className="cm-hours-table"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={visibleRows}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={selectedMandiId ? "No hours templates found for this mandi." : "Select a mandi to begin."} /> }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: (total) => `${total} template${total === 1 ? "" : "s"}`,
            }}
            scroll={{ x: 980 }}
          />
        </CmSectionCard>
      </div>

      <Modal
        className="cm-hours-modal"
        title={`${isEdit ? "Edit" : "Create"} hours template${selectedMandi ? ` · ${selectedMandi.label}` : ""}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={920}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>Cancel</Button>,
          <Button key="save" type="primary" loading={submitting} onClick={() => void handleSave()}>
            {isEdit ? "Save changes" : "Create template"}
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          message="Only one template is active for a mandi at a time. Activating or creating a template automatically retires the previously active one."
        />

        <div className="cm-hours-form-grid">
          <label className="cm-hours-field">
            <span>Effective from *</span>
            <Input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </label>
          <label className="cm-hours-field">
            <span>Timezone *</span>
            <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Asia/Kolkata" />
          </label>
        </div>

        <div className="cm-hours-inline-switch">
          <Switch
            checked={useEndDate}
            onChange={(checked) => {
              setUseEndDate(checked);
              if (!checked) setEffectiveTo("");
            }}
          />
          <Text>Set an end date</Text>
        </div>
        {useEndDate && (
          <label className="cm-hours-field cm-hours-end-date">
            <span>Effective to *</span>
            <Input type="date" value={effectiveTo} min={effectiveFrom || undefined} onChange={(event) => setEffectiveTo(event.target.value)} />
          </label>
        )}

        <div className="cm-hours-days-section">
          <div className="cm-hours-section-heading">
            <div>
              <Text strong>Weekly operating days</Text>
              <Text type="secondary">Select open days and define one or more trading windows for each day.</Text>
            </div>
            <Checkbox checked={allDaysChecked} onChange={(event) => setAllDays(event.target.checked)}>Open all days</Checkbox>
          </div>

          <div className="cm-hours-day-pills">
            {DAYS.map((day) => (
              <Button
                key={day}
                type={openDays.includes(day) ? "primary" : "default"}
                onClick={() => toggleDay(day)}
              >
                {DAY_LABELS[day]}
              </Button>
            ))}
          </div>

          <div className="cm-hours-day-cards">
            {openDays.map((day) => (
              <div className="cm-hours-day-card" key={day}>
                <div className="cm-hours-day-card-title">
                  <Text strong>{DAY_LABELS[day]}</Text>
                  <Button size="small" onClick={() => addWindow(day)}>+ Window</Button>
                </div>
                {(dayHours[day] || []).map((window, index) => (
                  <div className="cm-hours-window-row" key={`${day}-${index}`}>
                    <label className="cm-hours-field">
                      <span>Open</span>
                      <Input type="time" value={window.open} onChange={(event) => updateWindow(day, index, "open", event.target.value)} />
                    </label>
                    <label className="cm-hours-field">
                      <span>Close</span>
                      <Input type="time" value={window.close} onChange={(event) => updateWindow(day, index, "close", event.target.value)} />
                    </label>
                    <label className="cm-hours-field cm-hours-note-field">
                      <span>Note</span>
                      <Input value={window.note || ""} maxLength={160} placeholder="Optional" onChange={(event) => updateWindow(day, index, "note", event.target.value)} />
                    </label>
                    <Button danger disabled={(dayHours[day] || []).length <= 1} onClick={() => removeWindow(day, index)}>Remove</Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="cm-hours-exceptions-card">
          <div className="cm-hours-section-heading">
            <div>
              <Text strong>Closure exceptions</Text>
              <Text type="secondary">Exceptions override the normal weekly operating schedule.</Text>
            </div>
          </div>

          <div className="cm-hours-exception-row">
            <Switch
              checked={closedOnMonthlyDay}
              onChange={(checked) => {
                setClosedOnMonthlyDay(checked);
                if (checked && monthlyDays.length === 0) setMonthlyDays(["1"]);
                if (!checked) setMonthlyDays([]);
              }}
            />
            <div className="cm-hours-exception-copy">
              <Text strong>Recurring monthly closure</Text>
              <Text type="secondary">Close on selected calendar day(s) every month.</Text>
            </div>
          </div>
          {closedOnMonthlyDay && (
            <Select
              mode="multiple"
              className="cm-hours-select"
              value={monthlyDays}
              options={MONTH_DAYS.map((day) => ({ value: day, label: `Day ${day}` }))}
              onChange={setMonthlyDays}
              placeholder="Select day(s) of month"
              style={{ width: "100%" }}
            />
          )}

          <div className="cm-hours-exception-row">
            <Switch
              checked={closedOnDates}
              onChange={(checked) => {
                setClosedOnDates(checked);
                if (!checked) setClosedDates([]);
              }}
            />
            <div className="cm-hours-exception-copy">
              <Text strong>Specific-date closure</Text>
              <Text type="secondary">Add holidays, maintenance days or other one-off closures.</Text>
            </div>
          </div>
          {closedOnDates && (
            <div className="cm-hours-specific-dates">
              <Input
                type="date"
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  setClosedDates((current) => (current.includes(value) ? current : [...current, value].sort()));
                  event.currentTarget.value = "";
                }}
              />
              <div className="cm-hours-date-tags">
                {closedDates.map((date) => (
                  <Tag key={date} closable onClose={() => setClosedDates((current) => current.filter((item) => item !== date))}>{date}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};
