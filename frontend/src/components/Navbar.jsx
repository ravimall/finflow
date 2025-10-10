import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

  if (!user) {
    return (
      <nav className="bg-gray-800 p-4 text-white">
        <div className="flex justify-end">
          <Link to="/">Login</Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gray-800 p-4 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/customers">Customers</Link>
          <Link to="/loans">Loans</Link>
          <Link to="/documents">Documents</Link>
          {user.role === "admin" && <Link to="/reports">Reports</Link>}
          {user.role === "admin" && <Link to="/audit-logs">Audit Logs</Link>}
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium sm:text-base" title={user.email}>
            {user.name}
          </span>
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
