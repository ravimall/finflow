import { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Loans from "./pages/Loans";
import LoanDetail from "./pages/LoanDetail";
import Documents from "./pages/Documents";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import MyTasks from "./pages/MyTasks";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import BottomNav from "./components/BottomNav";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Preferences from "./pages/Preferences";
import AdminConfig from "./pages/AdminConfig";
import TopNav from "./components/TopNav";
import { AuthContext } from "./context/AuthContext";

function AppContent() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const hiddenNavigationPaths = ["/", "/login", "/auth/callback"];
  const shouldHideNavigation = hiddenNavigationPaths.includes(location.pathname);
  const shouldShowNavigation = Boolean(user) && !shouldHideNavigation;
  const mainPaddingBottom = shouldShowNavigation ? "pb-24" : "pb-8";

  return (
    <>
      {shouldShowNavigation && (
        <>
          <div className="hidden md:block">
            <TopNav />
          </div>
          <div className="md:hidden">
            <BottomNav />
          </div>
        </>
      )}
      <main className={`${mainPaddingBottom} pt-4 sm:pt-6 lg:pt-8`}>
        <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-4 md:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <Customers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute>
                  <CustomerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loans"
              element={
                <ProtectedRoute>
                  <Loans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loans/:id"
              element={
                <ProtectedRoute>
                  <LoanDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Documents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <MyTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/preferences"
              element={
                <ProtectedRoute>
                  <Preferences />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute role="admin">
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/config"
              element={
                <ProtectedRoute role="admin">
                  <AdminConfig />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute role="admin">
                  <AdminAuditLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </main>
    </>
  );
}

function App() {
  const basename = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  return (
    <Router basename={basename || "/"}>
      <AppContent />
    </Router>
  );
}

export default App;
