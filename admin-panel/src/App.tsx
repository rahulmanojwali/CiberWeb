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

import { Layout } from "./components/layout";

import { CustomSider } from "./components/customSider";
import { getUserRoleFromStorage } from "./utils/roles";
import { AdminUiConfigProvider } from "./contexts/admin-ui-config";

const AdminRoleGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mutate: logout } = useLogout();

  useEffect(() => {
    const role = getUserRoleFromStorage("AppGuard");
    if (!role) {
      logout();
      alert("Not authorized for admin console.");
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
          <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
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
          <ThemedLayout
            Header={Header}
            Sider={CustomSider}
          >
            <Outlet />
          </ThemedLayout>
        </AdminUiConfigProvider>
      </AdminRoleGuard>
    }
//end


                >
             
                  <Route index element={<Navigate to="/" replace />} />
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orgs" element={<Orgs />} />
                  <Route path="/mandis" element={<Mandis />} />
                  <Route path="/admin-users" element={<AdminUsers />} />
                  <Route path="/trader-approvals" element={<TraderApprovals />} />
                  <Route path="/mandi-coverage" element={<MandiCoverage />} />
                  <Route path="/mandi-prices" element={<MandiPrices />} />
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
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/reports" element={<Reports />} />


                  <Route path="*" element={<ErrorComponent />} />
                </Route>

                {/* Public routes */}
                <Route
                  element={
                    <Authenticated key="authenticated-outer" fallback={<Outlet />}>
                      <NavigateToResource />
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
