import { API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export type MobileDashboardRoleOption = {
  role_code: string;
  role_name?: string | null;
  role_scope?: string | null;
  configured?: boolean;
};

export type MobileDashboardWidget = {
  _id?: string;
  role_code: string;
  widget_key: string;
  title_en: string;
  title_hi?: string | null;
  title_i18n?: Record<string, string>;
  route?: string | null;
  api_name?: string | null;
  permission_key?: string | null;
  layout: "FULL_WIDTH" | "GRID_2" | "LIST";
  order: number;
  is_active: "Y" | "N";
  metadata?: Record<string, unknown> | null;
  version?: number;
  updated_on?: string | null;
  updated_by?: string | null;
};

type BaseInput = {
  username: string;
  country?: string | null;
  language?: string | null;
  role?: string | null;
};

const withBase = (input: BaseInput, api: string) => ({
  api,
  username: input.username,
  country: input.country || DEFAULT_COUNTRY,
  language: input.language || DEFAULT_LANGUAGE,
  role_slug: input.role || "",
});

export function getMobileDashboardWidgets(
  input: BaseInput & {
    role_code?: string;
    search?: string;
    status?: "ALL" | "Y" | "N";
    page?: number;
    limit?: number;
  },
) {
  return postEncrypted(API_ROUTES.admin.getMobileDashboardWidgets, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.list),
    role_code: input.role_code || "",
    search: input.search || "",
    status: input.status || "ALL",
    page: input.page || 1,
    limit: input.limit || 25,
  });
}

export function saveMobileDashboardWidget(input: BaseInput & { widget: Partial<MobileDashboardWidget> }) {
  return postEncrypted(API_ROUTES.admin.saveMobileDashboardWidget, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.save),
    resource_key: "mobile_dashboard.view",
    action: "UPDATE",
    ...input.widget,
    expected_version: input.widget.version ?? null,
  });
}

export function updateMobileDashboardWidgetStatus(
  input: BaseInput & { widget_id: string; is_active: "Y" | "N"; expected_version?: number | null },
) {
  return postEncrypted(API_ROUTES.admin.updateMobileDashboardWidgetStatus, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.updateStatus),
    resource_key: "mobile_dashboard.view",
    action: "UPDATE",
    widget_id: input.widget_id,
    is_active: input.is_active,
    expected_version: input.expected_version ?? null,
  });
}

export function deleteMobileDashboardWidget(
  input: BaseInput & { widget_id: string; expected_version?: number | null },
) {
  return postEncrypted(API_ROUTES.admin.deleteMobileDashboardWidget, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.delete),
    resource_key: "mobile_dashboard.view",
    action: "UPDATE",
    widget_id: input.widget_id,
    expected_version: input.expected_version ?? null,
  });
}

export function reorderMobileDashboardWidgets(
  input: BaseInput & { role_code: string; widgets: Array<{ _id?: string; widget_id?: string; order: number }> },
) {
  return postEncrypted(API_ROUTES.admin.reorderMobileDashboardWidgets, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.reorder),
    resource_key: "mobile_dashboard.view",
    action: "UPDATE",
    role_code: input.role_code,
    widgets: input.widgets,
  });
}
