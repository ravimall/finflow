import { useContext, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { navItems } from "./navItems";

export default function BottomNav() {
  const { user } = useContext(AuthContext);

  const tabs = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => !item.adminOnly || user.role === "admin");
  }, [user]);

  if (!user || tabs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-md">
      <nav className="flex justify-around py-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs font-medium transition-colors duration-200 ${
                isActive ? "text-blue-600" : "text-gray-500 hover:text-blue-500"
              }`
            }
          >
            <div className="mb-1 flex h-6 w-6 items-center justify-center">{tab.icon}</div>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
