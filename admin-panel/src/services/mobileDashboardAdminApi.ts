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


export type MobileAppControlItem = {
  control_key: string;
  control_type: "FEATURE" | "PUBLIC_SECTION" | "SYSTEM_SCREEN";
  label: string;
  enabled: "Y" | "N";
  locked: "Y" | "N";
  order: number;
  activity_tokens?: string[];
  notes?: string | null;
};

export type MobileAppControl = {
  _id?: string;
  config_key: string;
  version: number;
  is_active: "Y" | "N";
  theme: {
    enabled: "Y" | "N"; preset_name: string; primary_hex: string; secondary_hex: string; accent_hex: string; app_bg_hex: string; surface_hex: string;
    text_primary_hex: string; text_secondary_hex: string; text_muted_hex: string; border_hex: string;
    success_hex: string; warning_hex: string; error_hex: string; info_hex: string;
    icon_tint_hex: string; icon_container_hex: string; card_background_hex: string; card_border_hex: string;
    input_background_hex: string; input_border_hex: string; input_focus_border_hex: string;
    toolbar_background_hex: string; toolbar_title_hex: string; toolbar_icon_hex: string;
    bottom_nav_background_hex: string; bottom_nav_selected_hex: string; bottom_nav_unselected_hex: string;
  };
  layout_density: {
    screen_horizontal_dp:number; screen_vertical_dp:number; section_gap_dp:number; card_gap_dp:number; card_inner_padding_dp:number; grid_gutter_dp:number;
    control_gap_dp:number; toolbar_horizontal_dp:number; card_radius_dp:number; control_height_dp:number; icon_dp:number; icon_container_dp:number;
  };
  typography: { title_sp:number; section_sp:number; body_sp:number; small_sp:number; button_sp:number; label_sp:number; input_sp:number; };
  controls: MobileAppControlItem[];
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


export function saveMobileAppControl(
  input: BaseInput & { app_control: MobileAppControl },
) {
  return postEncrypted(API_ROUTES.admin.saveMobileDashboardWidget, {
    ...withBase(input, API_TAGS.MOBILE_DASHBOARD_ADMIN.save),
    resource_key: "mobile_dashboard.view",
    action: "UPDATE",
    config_kind: "APP_CONTROL",
    expected_version: input.app_control.version,
    theme: input.app_control.theme,
    layout_density: input.app_control.layout_density,
    typography: input.app_control.typography,
    controls: input.app_control.controls.map((item) => ({
      control_key: item.control_key,
      enabled: item.enabled,
    })),
  });
}
