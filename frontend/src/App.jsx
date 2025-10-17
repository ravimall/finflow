import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Loans from "./pages/Loans";
import LoanDetail from "./pages/LoanDetail";
import Documents from "./pages/Documents";
import Navbar from "./components/Navbar";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
import MyTasks from "./pages/MyTasks";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import BottomNav from "./components/BottomNav";
import Settings from "./pages/Settings";

function AppContent() {
  const location = useLocation();
  const hideBottomNav = ["/", "/login", "/auth/callback"].includes(location.pathname);

  return (
    <>
      <Navbar />
      <main className="pb-24 pt-4 sm:pt-6 lg:pt-8">
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
              path="/audit-logs"
              element={
                <ProtectedRoute role="admin">
                  <AuditLogs />
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
      {!hideBottomNav && <BottomNav />}
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
