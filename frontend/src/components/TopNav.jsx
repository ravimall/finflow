import { useContext, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import { navItems } from "./navItems";

export default function TopNav() {
  const { user, logout } = useContext(AuthContext);

  const items = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => !item.adminOnly || user.role === "admin");
  }, [user]);

  if (!user) {
    return null;
  }

  const displayName = user?.name?.trim() || user?.email || "User";

  return (
    <nav className="flex w-full items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      <div className="text-lg font-semibold text-gray-800">FinFlow</div>

      <div className="hidden items-center gap-6 md:flex">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 border-b-2 border-transparent pb-1 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-blue-500"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="text-xs uppercase tracking-wide text-gray-400">Signed in as</div>
        <div className="font-semibold text-gray-800" title={displayName}>
          {displayName}
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-gray-700 transition-colors duration-200 hover:bg-blue-50"
        >
          <FiLogOut aria-hidden="true" className="h-4 w-4" />
          Logout
        </button>
      </div>
    </nav>
  );
}

