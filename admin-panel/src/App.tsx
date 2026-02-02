import React, { useEffect } from "react";
import { Authenticated, Refine, useLogout } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import dataProvider from "@refinedev/simple-rest";
import { BrowserRouter, Outlet, Route, Routes, Navigate } from "react-router-dom";

import { authProvider } from "./authProvider";
import { Header } from "./components/header";
import Box from "@mui/material/Box";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { LeftSider } from "./components/LeftSider";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { ForgotPassword } from "./pages/forgotPassword";
import { ResetPasswordPage } from "./pages/resetPassword";
import { Dashboard } from "./pages/dashboard";
import { Orgs } from "./pages/orgs";
import { Mandis } from "./pages/mandis";
import { AdminUsers } from "./pages/adminUsers";
import { TraderApprovals } from "./pages/traderApprovals";
import { Traders } from "./pages/traders";
import { Farmers } from "./pages/farmers";
import { MandiCoverage } from "./pages/mandiCoverage";
import { MandiPrices } from "./pages/mandiPrices";
import { Reports } from "./pages/reports";
import { OrgMandiMapping } from "./pages/orgMandiMapping";
import TwoFactorSettings from "./pages/systemSecurity/twoFactor";
import StepUpPoliciesPage from "./pages/systemSecurity/stepupPolicies";
import SecuritySwitchesPage from "./pages/systemSecurity/securitySwitches";
import { Commodities } from "./pages/commodities";
import { CommodityProducts } from "./pages/commodityProducts";
import { MandiCommodityProductsMasters } from "./pages/mandiCommodityProductsMasters";
import { MandiFacilities } from "./pages/mandiFacilities";
import { MandiGates } from "./pages/mandiGates";
import { MandiHoursTemplates } from "./pages/mandiHoursTemplates";
import { GateEntryReasons } from "./pages/gateEntryReasons";
import { GateVehicleTypes } from "./pages/gateVehicleTypes";
import { AuctionMethods } from "./pages/auctionMethods";
import { AuctionRounds } from "./pages/auctionRounds";
import { AuctionPolicies } from "./pages/auctionPolicies";
//import { GateDevices } from "./pages/gateDevices";
import GateDevices from "./pages/gateDevices";



import { GateDeviceConfigs } from "./pages/gateDeviceConfigs";
import { GateTokens } from "./pages/gateTokens";
import { GateEntryCreate } from "./pages/gateEntries/create";
import { WeighmentTickets } from "./pages/weighmentTickets";
import { GateMovements } from "./pages/gateMovements";
import GateTokenDetail from "./pages/gateTokens/detail";
import { MandiAssociations } from "./pages/mandiAssociations";
import RolesPermissionsPage from "./pages/rolesPermissions";
import { PermissionsManager } from "./pages/permissionsManager";
import UserRoleManagerPage from "./pages/userRoleManager";
import { AuctionSessions } from "./pages/auctionSessions";
import { AuctionLots } from "./pages/auctionLots";
import { AuctionResults } from "./pages/auctionResults";
import { Lots } from "./pages/lots";
import { TransportIntents } from "./pages/transportIntents";
import { PreMarketListings } from "./pages/preMarketListings";
import { PreMarketListingCreate } from "./pages/preMarketListings/create";
import { PreMarketListingDetail } from "./pages/preMarketListings/detail";
import { MandiPricePolicies } from "./pages/mandiPricePolicies";
import { MandiPricePolicyCreate } from "./pages/mandiPricePolicies/create";
import { MandiSettings } from "./pages/mandiSettings";
import { StallFees } from "./pages/stallFees";
import { StallFeeCollect } from "./pages/stallFees/collect";
import { StallFeeReport } from "./pages/stallFees/report";
import { MarketPrices } from "./pages/marketPrices";
import { PaymentsLanding } from "./pages/paymentsLanding";
import { PaymentModels } from "./pages/paymentModels";
import { OrgPaymentSettings } from "./pages/orgPaymentSettings";
import { MandiPaymentSettings } from "./pages/mandiPaymentSettings";
import { CommodityFees } from "./pages/commodityFees";
import { PaymentModes } from "./pages/paymentModes";
import { CustomFees } from "./pages/customFees";
import { RoleCustomFees } from "./pages/roleCustomFees";
import { SubscriptionsPage } from "./pages/subscriptions";
import { SubscriptionInvoices } from "./pages/subscriptionInvoices";
import { SettlementsPage } from "./pages/settlements";
import { PaymentsLog } from "./pages/paymentsLog";
import ResourceRegistryPage from "./pages/resourceRegistry";
import ResourceHealthPage from "./pages/resourceHealth";

import { Layout } from "./components/layout";

import { CustomSider } from "./components/customSider";
import { getUserRoleFromStorage } from "./utils/roles";
import { AdminUiConfigProvider } from "./contexts/admin-ui-config";
import { PermissionsDebugPanel } from "./components/PermissionsDebugPanel";
import { StepUpProvider } from "./security/stepup/StepUpContext";
import { StepUpRouteEnforcer } from "./components/StepUpRouteEnforcer";

const AdminRoleGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mutate: logout } = useLogout();

  useEffect(() => {
    const storedUser = localStorage.getItem("cd_user");
    if (!storedUser) {
      logout();
      return;
    }

    const role = getUserRoleFromStorage("AppGuard");
    if (!role) {
      console.warn("[AppGuard] no role resolved for stored user; skipping alert.");
    }
  }, [logout]);

  return <>{children}</>;
};




function App() {
  return (
    <BrowserRouter basename="/admin">
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <CssBaseline />
          <GlobalStyles
            styles={{
              html: { WebkitFontSmoothing: "auto", height: "100%" },
              body: { margin: 0, padding: 0, height: "100%" },
              "#root": { height: "100%" },
            }}
          />
          <RefineSnackbarProvider
            snackbarProviderProps={{
              anchorOrigin: { vertical: "top", horizontal: "center" },
            }}
          >
            <Refine
              dataProvider={dataProvider("https://api.fake-rest.refine.dev")}
              notificationProvider={useNotificationProvider}
              routerProvider={routerProvider}
              authProvider={authProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "CD-ADMIN-PANEL",
              }}
            >
              <Routes>
                <Route
                  element={
                    <AdminRoleGuard>
                <AdminUiConfigProvider>
                  <StepUpProvider>
                    <PermissionsDebugPanel />
                    <ThemedLayout Header={Header} Sider={CustomSider}>
                      <StepUpRouteEnforcer>
                        <Outlet />
                      </StepUpRouteEnforcer>
                    </ThemedLayout>
                  </StepUpProvider>
                </AdminUiConfigProvider>
                    </AdminRoleGuard>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/orgs" element={<Orgs />} />
                  <Route path="/mandis" element={<Mandis />} />
                  <Route path="/admin-users" element={<AdminUsers />} />
                  <Route path="/trader-approvals" element={<TraderApprovals />} />
                  <Route path="/traders" element={<Traders />} />
                  <Route path="/farmers" element={<Farmers />} />
                  <Route path="/mandi-coverage" element={<MandiCoverage />} />
                  <Route path="/mandi-prices" element={<MandiPrices />} />
                  <Route path="/payments-settlements" element={<PaymentsLanding />} />
                  <Route path="/payment-models" element={<PaymentModels />} />
                  <Route path="/org-payment-settings" element={<OrgPaymentSettings />} />
                  <Route path="/mandi-payment-settings" element={<MandiPaymentSettings />} />
                  <Route path="/commodity-fees" element={<CommodityFees />} />
                  <Route path="/payment-modes" element={<PaymentModes />} />
                  <Route path="/custom-fees" element={<CustomFees />} />
                  <Route path="/role-custom-fees" element={<RoleCustomFees />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/subscription-invoices" element={<SubscriptionInvoices />} />
                  <Route path="/settlements" element={<SettlementsPage />} />
                  <Route path="/payments-log" element={<PaymentsLog />} />
                  <Route path="/org-mandi-mapping" element={<OrgMandiMapping />} />
                    <Route path="/org-mandi" element={<OrgMandiMapping />} />
                    <Route path="/system/security/2fa" element={<TwoFactorSettings />} />
                  <Route path="/masters/commodities" element={<Commodities />} />
                  <Route path="/masters/commodity-products" element={<CommodityProducts />} />
                  <Route path="/masters/mandi-products" element={<MandiCommodityProductsMasters />} />
                  <Route path="/commodities" element={<Navigate to="/masters/commodities" replace />} />
                  <Route path="/commodity-products" element={<Navigate to="/masters/commodity-products" replace />} />
                  <Route path="/mandi-facilities" element={<MandiFacilities />} />
                  <Route path="/mandi-gates" element={<MandiGates />} />
                  <Route path="/mandi-hours-templates" element={<MandiHoursTemplates />} />
                  <Route path="/gate-entry-reasons" element={<GateEntryReasons />} />
                  <Route path="/gate-vehicle-types" element={<GateVehicleTypes />} />
                  <Route path="/auction-methods" element={<AuctionMethods />} />
                  <Route path="/auction-rounds" element={<AuctionRounds />} />
                  <Route path="/auction-policies" element={<AuctionPolicies />} />
                  <Route path="/gate-devices" element={<GateDevices />} />
                  <Route path="/gate-device-configs" element={<GateDeviceConfigs />} />
                  <Route path="/gate-tokens" element={<GateTokens />} />
                  <Route path="/gate-entries" element={<GateTokens />} />
                  <Route path="/gate-entries/create" element={<GateEntryCreate />} />
                  <Route path="/gate-tokens/:tokenCode" element={<GateTokenDetail />} />
                  <Route path="/weighment-tickets" element={<WeighmentTickets />} />
                  <Route path="/gate-movements" element={<GateMovements />} />
                  <Route path="/mandi-associations" element={<MandiAssociations />} />
                  <Route path="/system/roles-permissions" element={<RolesPermissionsPage />} />
                  <Route path="/system/role-policy-manager" element={<PermissionsManager />} />
                  <Route path="/system/permissions-manager" element={<PermissionsManager />} />
                  <Route path="/system/resource-registry" element={<ResourceRegistryPage />} />
                  <Route path="/system/resource-health" element={<ResourceHealthPage />} />
                  <Route path="/system/user-role-manager" element={<UserRoleManagerPage />} />
                  <Route path="/system/security/stepup-policies" element={<StepUpPoliciesPage />} />
                  <Route path="/system/security/switches" element={<SecuritySwitchesPage />} />
                  <Route path="/auction-sessions" element={<AuctionSessions />} />
                  <Route path="/auction-lots" element={<AuctionLots />} />
                  <Route path="/lots" element={<Lots />} />
                  <Route path="/transport-intents" element={<TransportIntents />} />
                  <Route path="/pre-market-listings" element={<PreMarketListings />} />
                  <Route path="/pre-market-listings/create" element={<PreMarketListingCreate />} />
                  <Route path="/pre-market-listings/:id" element={<PreMarketListingDetail />} />
                  <Route path="/mandi-price-policies" element={<MandiPricePolicies />} />
                  <Route path="/mandi-price-policies/create" element={<MandiPricePolicyCreate />} />
                  <Route path="/mandi-settings" element={<MandiSettings />} />
                  <Route path="/stall-fees" element={<StallFees />} />
                  <Route path="/stall-fees/collect" element={<StallFeeCollect />} />
                  <Route path="/stall-fees/report" element={<StallFeeReport />} />
                  <Route path="/market-prices" element={<MarketPrices />} />
                  <Route path="/auction-results" element={<AuctionResults />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="*" element={<ErrorComponent />} />
                </Route>

                {/* CM_FORGOT_PASSWORD_FLOW_20251227 */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
                <RefineKbar />
                <UnsavedChangesNotifier />
                {/* <DocumentTitleHandler /> */}
                <DocumentTitleHandler handler={() => "CiberMandi – Admin"} />

              </Refine>
          </RefineSnackbarProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
