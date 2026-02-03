import React from "react";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import StoreMallDirectoryOutlinedIcon from "@mui/icons-material/StoreMallDirectoryOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import InventoryOutlinedIcon from "@mui/icons-material/InventoryOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import SensorsOutlinedIcon from "@mui/icons-material/SensorsOutlined";
import SettingsInputComponentOutlinedIcon from "@mui/icons-material/SettingsInputComponentOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import LoopOutlinedIcon from "@mui/icons-material/LoopOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import ScaleOutlinedIcon from "@mui/icons-material/ScaleOutlined";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import PlaylistAddCheckOutlinedIcon from "@mui/icons-material/PlaylistAddCheckOutlined";
import LocalAtmOutlinedIcon from "@mui/icons-material/LocalAtmOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import SettingsApplicationsOutlinedIcon from "@mui/icons-material/SettingsApplicationsOutlined";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import SubscriptionsOutlinedIcon from "@mui/icons-material/SubscriptionsOutlined";
import PriceCheckOutlinedIcon from "@mui/icons-material/PriceCheckOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import SchemaOutlinedIcon from "@mui/icons-material/SchemaOutlined";
import PhonelinkLockOutlinedIcon from "@mui/icons-material/PhonelinkLockOutlined";
import SecurityUpdateOutlinedIcon from "@mui/icons-material/SecurityUpdateOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";

const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: React.createElement(DashboardOutlinedIcon),
  Dashboard: React.createElement(SpaceDashboardOutlinedIcon),
  org: React.createElement(ApartmentOutlinedIcon),
  organisations: React.createElement(ApartmentOutlinedIcon),
  org_mandi: React.createElement(HubOutlinedIcon),
  Link: React.createElement(LinkOutlinedIcon),
  mandi: React.createElement(StoreMallDirectoryOutlinedIcon),
  commodities: React.createElement(CategoryOutlinedIcon),
  products: React.createElement(LocalOfferOutlinedIcon),
  mandi_products: React.createElement(Inventory2OutlinedIcon),
  admin_users: React.createElement(AdminPanelSettingsOutlinedIcon),
  farmers: React.createElement(AgricultureOutlinedIcon),
  traders: React.createElement(GroupOutlinedIcon),
  trader_approvals: React.createElement(HowToRegOutlinedIcon),
  QrCode: React.createElement(QrCodeScannerOutlinedIcon),
  device: React.createElement(DevicesOutlinedIcon),
  gate_devices: React.createElement(SensorsOutlinedIcon),
  gate_device_configs: React.createElement(SettingsInputComponentOutlinedIcon),
  gate_entry_reasons: React.createElement(RuleOutlinedIcon),
  gate_movements: React.createElement(TimelineOutlinedIcon),
  gate_tokens: React.createElement(BadgeOutlinedIcon),
  vehicle: React.createElement(DirectionsCarOutlinedIcon),
  auction_methods: React.createElement(GavelOutlinedIcon),
  auction_rounds: React.createElement(LoopOutlinedIcon),
  auction_policies: React.createElement(PolicyOutlinedIcon),
  auction_sessions: React.createElement(EventNoteOutlinedIcon),
  auction_lots: React.createElement(InventoryOutlinedIcon),
  auction_results: React.createElement(FactCheckOutlinedIcon),
  fees: React.createElement(ReceiptLongOutlinedIcon),
  prices: React.createElement(TrendingUpOutlinedIcon),
  mandi_prices: React.createElement(PriceChangeOutlinedIcon),
  market_prices: React.createElement(ShowChartOutlinedIcon),
  transport: React.createElement(LocalShippingOutlinedIcon),
  reports: React.createElement(AssessmentOutlinedIcon),
  security: React.createElement(SecurityOutlinedIcon),
  toggle: React.createElement(ToggleOnOutlinedIcon),
  mandi_coverage: React.createElement(MapOutlinedIcon),
  mandi_facilities: React.createElement(WarehouseOutlinedIcon),
  mandi_gates: React.createElement(DoorFrontOutlinedIcon),
  mandi_hours: React.createElement(AccessTimeOutlinedIcon),
  pre_market: React.createElement(PlaylistAddCheckOutlinedIcon),
  weighment_tickets: React.createElement(ScaleOutlinedIcon),
};

const RESOURCE_ICON_MAP: Record<string, React.ReactNode> = {
  "commodity_fees.menu": React.createElement(LocalAtmOutlinedIcon),
  "custom_fees.menu": React.createElement(TuneOutlinedIcon),
  "mandi_payment_settings.menu": React.createElement(SettingsApplicationsOutlinedIcon),
  "org_payment_settings.menu": React.createElement(SettingsSuggestOutlinedIcon),
  "payment_models.menu": React.createElement(AccountTreeOutlinedIcon),
  "payment_modes.menu": React.createElement(PaymentsOutlinedIcon),
  "payments_log.menu": React.createElement(ReceiptOutlinedIcon),
  "role_custom_fees.menu": React.createElement(AssignmentIndOutlinedIcon),
  "settlements.menu": React.createElement(AccountBalanceOutlinedIcon),
  "subscription_invoices.menu": React.createElement(RequestQuoteOutlinedIcon),
  "subscriptions.menu": React.createElement(SubscriptionsOutlinedIcon),
  "mandi_price_policies.menu": React.createElement(PriceCheckOutlinedIcon),
  "mandi_settings.menu": React.createElement(ManageAccountsOutlinedIcon),
  "user_roles.menu": React.createElement(SupervisorAccountOutlinedIcon),
  "resource_registry.menu": React.createElement(SchemaOutlinedIcon),
  "security_2fa.menu": React.createElement(PhonelinkLockOutlinedIcon),
  "stepup_policy.menu": React.createElement(SecurityUpdateOutlinedIcon),
  "role_policies.menu": React.createElement(RuleFolderOutlinedIcon),
};

export function resolveMenuIcon(iconKey?: string | null, resourceKey?: string | null): React.ReactNode | undefined {
  if (iconKey && ICON_MAP[iconKey]) return ICON_MAP[iconKey];
  if (resourceKey && RESOURCE_ICON_MAP[resourceKey]) return RESOURCE_ICON_MAP[resourceKey];
  return React.createElement(Inventory2OutlinedIcon);
}
