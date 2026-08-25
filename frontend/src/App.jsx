import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import Login from "./scenes/login/Login";
import SetPassword from "./scenes/login/SetPassword";
import ResetPassword from "./scenes/login/ResetPassword";
import AppLayout from "./scenes/global/AppLayout";
import ModuleDashboard from "./scenes/modules/ModuleDashboard";
import UserRequests from "./scenes/users/UserRequests";
import UserManagement from "./scenes/users/UserManagement";
import KPIManagement from "./scenes/kpi/KPIManagement";
import KPIResults from "./scenes/kpi/KPIResults";
import ModuleManagement from "./scenes/modules/ModuleManagement";
import AISupport from "./scenes/aiSupport/AISupport";
import ProfileSettings from "./scenes/users/ProfileSettings";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

function hasPermission(code) {
  const user = getStoredUser();

  if (!user) return false;
  if (user.role === "administrator") return true;

  return (user.app_permissions || []).some((p) => p.code === code);
}

function hasAnyPermission(codes = []) {
  const user = getStoredUser();

  if (!user) return false;
  if (user.role === "administrator") return true;

  return codes.some((code) =>
    (user.app_permissions || []).some((p) => p.code === code)
  );
}

function getDefaultRoute() {
  if (hasPermission("view_report")) return "/kpi-results";
  if (hasPermission("view_dashboard")) return "/modules/1";
  if (hasPermission("view_kpi")) return "/kpis";
  if (hasPermission("view_user")) return "/users/manage";
  if (hasPermission("view_request")) return "/users/requests";
  if (hasPermission("view_module")) return "/modules/manage";

  if (
    hasAnyPermission([
      "view_ai_recommendations",
      "view_ai_forecasting",
    ])
  ) {
    return "/ai-support";
  }

  return "/";
}

function RequirePermission({ permission, permissionAny, children }) {
  const allowed = permissionAny
    ? hasAnyPermission(permissionAny)
    : hasPermission(permission);

  if (!allowed) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  return children;
}

function ProtectedLayout() {
  const token = localStorage.getItem("access");
  const user = localStorage.getItem("user");

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function PublicLogin() {
  const token = localStorage.getItem("access");
  const user = localStorage.getItem("user");

  if (token && user) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  return <Login />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLogin />} />
      <Route path="/set-password/:uid/:token" element={<SetPassword />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

      <Route element={<ProtectedLayout />}>
        <Route
          path="/modules/:id"
          element={
            <RequirePermission permission="view_dashboard">
              <ModuleDashboard />
            </RequirePermission>
          }
        />

        <Route
          path="/users/requests"
          element={
            <RequirePermission permission="view_request">
              <UserRequests />
            </RequirePermission>
          }
        />

        <Route
          path="/users/manage"
          element={
            <RequirePermission permission="view_user">
              <UserManagement />
            </RequirePermission>
          }
        />

        <Route path="/profile-settings" element={<ProfileSettings />} />

        <Route
          path="/kpis"
          element={
            <RequirePermission permission="view_kpi">
              <KPIManagement />
            </RequirePermission>
          }
        />

        <Route
          path="/kpi-results"
          element={
            <RequirePermission permission="view_report">
              <KPIResults />
            </RequirePermission>
          }
        />

        <Route
          path="/modules/manage"
          element={
            <RequirePermission permission="view_module">
              <ModuleManagement />
            </RequirePermission>
          }
        />

        <Route
          path="/ai-support"
          element={
            <RequirePermission
              permissionAny={[
                "view_ai_recommendations",
                "view_ai_forecasting",
              ]}
            >
              <AISupport />
            </RequirePermission>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
}

export default App;