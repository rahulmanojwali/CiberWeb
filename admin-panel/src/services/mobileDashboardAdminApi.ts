import { API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export type MobileDashboardWidget = {
  _id?: string;
  role_code: string;
  widget_key: string;
  title_en: string;
  title_hi?: string | null;
  route?: string | null;
  api_name?: string | null;
  permission_key?: string | null;
  layout: "FULL_WIDTH" | "GRID_2" | "LIST";
  order: number;
  is_active: "Y" | "N";
  metadata?: unknown;
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

export function getMobileDashboardWidgets(input: BaseInput & { role_code?: string }) {
  return postEncrypted(API_ROUTES.admin.getMobileDashboardWidgets, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.list),
    role_code: input.role_code || "",
  });
}

export function saveMobileDashboardWidget(input: BaseInput & { widget: Partial<MobileDashboardWidget> }) {
  return postEncrypted(API_ROUTES.admin.saveMobileDashboardWidget, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.save),
    ...input.widget,
  });
}

export function updateMobileDashboardWidgetStatus(
  input: BaseInput & { widget_id: string; is_active: "Y" | "N" },
) {
  return postEncrypted(API_ROUTES.admin.updateMobileDashboardWidgetStatus, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.updateStatus),
    widget_id: input.widget_id,
    is_active: input.is_active,
  });
}

export function deleteMobileDashboardWidget(input: BaseInput & { widget_id: string }) {
  return postEncrypted(API_ROUTES.admin.deleteMobileDashboardWidget, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.delete),
    widget_id: input.widget_id,
  });
}

export function reorderMobileDashboardWidgets(
  input: BaseInput & { role_code: string; widgets: Array<{ _id?: string; widget_id?: string; order: number }> },
) {
  return postEncrypted(API_ROUTES.admin.reorderMobileDashboardWidgets, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.reorder),
    role_code: input.role_code,
    widgets: input.widgets,
  });
}
