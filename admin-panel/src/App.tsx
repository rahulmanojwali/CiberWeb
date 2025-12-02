import React, { useEffect } from "react";
import { Authenticated, Refine, useLogout } from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayout,
  useNotificationProvider,
} from "@refinedev/mui";
import Box from "@mui/material/Box";
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
import { ColorModeContextProvider } from "./contexts/color-mode";
import { LeftSider } from "./components/LeftSider";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import { ForgotPassword } from "./pages/forgotPassword";
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
import { Commodities } from "./pages/commodities";
import { CommodityProducts } from "./pages/commodityProducts";
import { MandiFacilities } from "./pages/mandiFacilities";
import { MandiGates } from "./pages/mandiGates";
import { MandiHoursTemplates } from "./pages/mandiHoursTemplates";
import { GateEntryReasons } from "./pages/gateEntryReasons";
import { GateVehicleTypes } from "./pages/gateVehicleTypes";
import { AuctionMethods } from "./pages/auctionMethods";
import { AuctionRounds } from "./pages/auctionRounds";
import { AuctionPolicies } from "./pages/auctionPolicies";
import { GateDevices } from "./pages/gateDevices";
import { GateDeviceConfigs } from "./pages/gateDeviceConfigs";
import { GateTokens } from "./pages/gateTokens";
import { WeighmentTickets } from "./pages/weighmentTickets";
import { GateMovements } from "./pages/gateMovements";
import { AuctionSessions } from "./pages/auctionSessions";
import { AuctionLots } from "./pages/auctionLots";
import { AuctionResults } from "./pages/auctionResults";
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

import { Layout } from "./components/layout";

import { CustomSider } from "./components/customSider";
import { getUserRoleFromStorage } from "./utils/roles";
import { AdminUiConfigProvider } from "./contexts/admin-ui-config";

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
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <CssBaseline />
          <GlobalStyles
            styles={{
              html: {
                WebkitFontSmoothing: "auto",
                height: "100%",
                margin: 0,
                padding: 0,
                overscrollBehaviorY: "contain",
                overscrollBehaviorX: "none",
                touchAction: "pan-y",
              },
              body: {
                height: "100%",
                margin: 0,
                padding: 0,
                overscrollBehaviorY: "contain",
                overscrollBehaviorX: "none",
                overflow: "hidden",
                touchAction: "pan-y",
              },
              "#root": { height: "100%", overflow: "hidden" },
              ".MuiDrawer-paper": { overscrollBehavior: "contain" },
            }}
          />
          <RefineSnackbarProvider>
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
            

//strat 
 element={
      <AdminRoleGuard>
        <AdminUiConfigProvider>
          <ThemedLayout Header={Header} Sider={CustomSider}>
            <Box
              data-app-scrollable="true"
              sx={{
                flex: 1,
                height: "100vh",
                minHeight: "100vh",
                overflowY: "auto",
                overscrollBehavior: "contain",
              }}
            >
              <Outlet />
            </Box>
          </ThemedLayout>
        </AdminUiConfigProvider>
      </AdminRoleGuard>
    }
//end


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
                  <Route path="/commodities" element={<Commodities />} />
                  <Route path="/commodity-products" element={<CommodityProducts />} />
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
                  <Route path="/weighment-tickets" element={<WeighmentTickets />} />
                  <Route path="/gate-movements" element={<GateMovements />} />
                  <Route path="/auction-sessions" element={<AuctionSessions />} />
                  <Route path="/auction-lots" element={<AuctionLots />} />
                  <Route path="/auction-results" element={<AuctionResults />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports" element={<Reports />} />


                  <Route path="*" element={<ErrorComponent />} />
                </Route>

                {/* Public routes */}
                <Route
                  element={
                    <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                      <Navigate to="/dashboard" replace />
                    </Authenticated>
                  }
                >
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                </Route>
              </Routes>

              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </RefineSnackbarProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;


// import { Authenticated, Refine } from "@refinedev/core";


// // Removed Devtools imports
// // import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
// import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";



// import {
//   ErrorComponent,
//   RefineSnackbarProvider,
//   ThemedLayout,
//   useNotificationProvider,
// } from "@refinedev/mui";

// import CssBaseline from "@mui/material/CssBaseline";
// import GlobalStyles from "@mui/material/GlobalStyles";
// import routerProvider, {
//   CatchAllNavigate,
//   DocumentTitleHandler,
//   NavigateToResource,
//   UnsavedChangesNotifier,
// } from "@refinedev/react-router";
// import dataProvider from "@refinedev/simple-rest";
// import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

// import { authProvider } from "./authProvider";
// import { Header } from "./components/header";
// import { ColorModeContextProvider } from "./contexts/color-mode";
// import {
//   BlogPostCreate,
//   BlogPostEdit,
//   BlogPostList,
//   BlogPostShow,
// } from "./pages/blog-posts";
// import {
//   CategoryCreate,
//   CategoryEdit,
//   CategoryList,
//   CategoryShow,
// } from "./pages/categories";
// import { ForgotPassword } from "./pages/forgotPassword";
// import { Login } from "./pages/login";
// import { Register } from "./pages/register";

// function App() {
//   return (
//     <BrowserRouter>
//       {/* Removed <GitHubBanner /> */}
//       <RefineKbarProvider>
//         <ColorModeContextProvider>
//           <CssBaseline />
//           <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
//           <RefineSnackbarProvider>
//             {/* Removed <DevtoolsProvider> */}
//             <Refine
//               dataProvider={dataProvider("https://api.fake-rest.refine.dev")}
//               notificationProvider={useNotificationProvider}
//               routerProvider={routerProvider}
//               authProvider={authProvider}
//               resources={[
//                 {
//                   name: "blog_posts",
//                   list: "/blog-posts",
//                   create: "/blog-posts/create",
//                   edit: "/blog-posts/edit/:id",
//                   show: "/blog-posts/show/:id",
//                   meta: { canDelete: true },
//                 },
//                 {
//                   name: "categories",
//                   list: "/categories",
//                   create: "/categories/create",
//                   edit: "/categories/edit/:id",
//                   show: "/categories/show/:id",
//                   meta: { canDelete: true },
//                 },
//               ]}
//               options={{
//                 syncWithLocation: true,
//                 warnWhenUnsavedChanges: true,
//                 // You can keep or remove projectId; it doesn't show the banner.
//                 projectId: "39Djjh-SK2Gkw-BKJmQE",
//               }}
//             >
//               <Routes>
//                 <Route
//                   element={
//                     <Authenticated
//                       key="authenticated-inner"
//                       fallback={<CatchAllNavigate to="/login" />}
//                     >
//                       <ThemedLayout Header={Header}>
//                         <Outlet />
//                       </ThemedLayout>
//                     </Authenticated>
//                   }
//                 >
//                   <Route
//                     index
//                     element={<NavigateToResource resource="blog_posts" />}
//                   />
//                   <Route path="/blog-posts">
//                     <Route index element={<BlogPostList />} />
//                     <Route path="create" element={<BlogPostCreate />} />
//                     <Route path="edit/:id" element={<BlogPostEdit />} />
//                     <Route path="show/:id" element={<BlogPostShow />} />
//                   </Route>
//                   <Route path="/categories">
//                     <Route index element={<CategoryList />} />
//                     <Route path="create" element={<CategoryCreate />} />
//                     <Route path="edit/:id" element={<CategoryEdit />} />
//                     <Route path="show/:id" element={<CategoryShow />} />
//                   </Route>
//                   <Route path="*" element={<ErrorComponent />} />
//                 </Route>

//                 <Route
//                   element={
//                     <Authenticated key="authenticated-outer" fallback={<Outlet />}>
//                       <NavigateToResource />
//                     </Authenticated>
//                   }
//                 >
//                   <Route path="/login" element={<Login />} />
//                   <Route path="/register" element={<Register />} />
//                   <Route path="/forgot-password" element={<ForgotPassword />} />
//                 </Route>
//               </Routes>

//               <RefineKbar />
//               <UnsavedChangesNotifier />
//               <DocumentTitleHandler />
//             </Refine>
//             {/* Removed <DevtoolsPanel /> */}
//             {/* Removed </DevtoolsProvider> */}
//           </RefineSnackbarProvider>
//         </ColorModeContextProvider>
//       </RefineKbarProvider>
//     </BrowserRouter>
//   );
// }

// export default App;
