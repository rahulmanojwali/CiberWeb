import React from "react";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import StoreMallDirectoryOutlinedIcon from "@mui/icons-material/StoreMallDirectoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";

const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: React.createElement(DashboardOutlinedIcon),
  Dashboard: React.createElement(DashboardOutlinedIcon),
  org: React.createElement(ApartmentOutlinedIcon),
  organisations: React.createElement(ApartmentOutlinedIcon),
  org_mandi: React.createElement(HubOutlinedIcon),
  Link: React.createElement(HubOutlinedIcon),
  mandi: React.createElement(StoreMallDirectoryOutlinedIcon),
  commodities: React.createElement(StoreMallDirectoryOutlinedIcon),
  products: React.createElement(Inventory2OutlinedIcon),
  mandi_products: React.createElement(Inventory2OutlinedIcon),
  admin_users: React.createElement(GroupsOutlinedIcon),
  farmers: React.createElement(GroupsOutlinedIcon),
  traders: React.createElement(GroupsOutlinedIcon),
  trader_approvals: React.createElement(GroupsOutlinedIcon),
  QrCode: React.createElement(QrCodeScannerOutlinedIcon),
  device: React.createElement(SettingsOutlinedIcon),
  gate_devices: React.createElement(SettingsOutlinedIcon),
  gate_device_configs: React.createElement(SettingsOutlinedIcon),
  gate_entry_reasons: React.createElement(SettingsOutlinedIcon),
  gate_movements: React.createElement(TimelineOutlinedIcon),
  gate_tokens: React.createElement(BadgeOutlinedIcon),
  vehicle: React.createElement(BadgeOutlinedIcon),
  auction_methods: React.createElement(GavelOutlinedIcon),
  auction_rounds: React.createElement(GavelOutlinedIcon),
  auction_policies: React.createElement(GavelOutlinedIcon),
  auction_sessions: React.createElement(GavelOutlinedIcon),
  auction_lots: React.createElement(GavelOutlinedIcon),
  auction_results: React.createElement(GavelOutlinedIcon),
  fees: React.createElement(ReceiptLongOutlinedIcon),
  prices: React.createElement(PriceChangeOutlinedIcon),
  mandi_prices: React.createElement(PriceChangeOutlinedIcon),
  market_prices: React.createElement(PriceChangeOutlinedIcon),
  transport: React.createElement(Inventory2OutlinedIcon),
  reports: React.createElement(AssessmentOutlinedIcon),
  security: React.createElement(SecurityOutlinedIcon),
  toggle: React.createElement(SettingsOutlinedIcon),
  weighment_tickets: React.createElement(AccountBalanceWalletOutlinedIcon),
};

export function resolveMenuIcon(iconKey?: string | null): React.ReactNode | undefined {
  if (!iconKey) return React.createElement(Inventory2OutlinedIcon);
  return ICON_MAP[iconKey] || React.createElement(Inventory2OutlinedIcon);
}
