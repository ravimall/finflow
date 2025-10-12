import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

  const renderGuestNav = () => (
    <div className="flex items-center justify-between">
      <div className="text-lg font-semibold">FinFlow</div>
      <Link to="/" className="text-sm font-medium hover:text-gray-300">
        Login
      </Link>
    </div>
  );

  if (!user) {
    return <nav className="bg-gray-800 p-4 text-white">{renderGuestNav()}</nav>;
  }

  const displayName = user.name?.trim() || user.email;

  return (
    <nav className="bg-gray-800 p-4 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link className="hover:text-gray-300" to="/dashboard">
            Dashboard
          </Link>
          <Link className="hover:text-gray-300" to="/customers">
            Customers
          </Link>
          <Link className="hover:text-gray-300" to="/loans">
            Loans
          </Link>
          <Link className="hover:text-gray-300" to="/documents">
            Documents
          </Link>
          {user.role === "admin" && (
            <Link className="hover:text-gray-300" to="/admin">
              Admin Config
            </Link>
          )}
          {user.role === "admin" && (
            <Link className="hover:text-gray-300" to="/reports">
              Reports
            </Link>
          )}
          {user.role === "admin" && (
            <Link className="hover:text-gray-300" to="/audit-logs">
              Audit Logs
            </Link>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-xs uppercase tracking-wide text-gray-300">
              Signed in as
            </span>
            <span className="text-sm font-semibold" title={user.email}>
              {displayName}
            </span>
          </div>
          <button
            onClick={logout}
            className="rounded bg-gray-700 px-3 py-1 text-sm font-semibold hover:bg-gray-600"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
