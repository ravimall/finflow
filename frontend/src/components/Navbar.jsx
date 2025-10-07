import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  return (
    <nav className="bg-gray-800 p-4 text-white flex space-x-4">
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/customers">Customers</Link>
      <Link to="/loans">Loans</Link>
      <Link to="/documents">Documents</Link>
      {user?.role === "admin" && <Link to="/reports">Reports</Link>}
  {user?.role === "admin" && <Link to="/audit-logs">Audit Logs</Link>}
  {user ? (<button onClick={logout} className="ml-auto">Logout</button>) : (<Link to="/">Login</Link>)}
</nav>
  );
}
