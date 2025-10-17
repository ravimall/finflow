import { NavLink } from "react-router-dom";
import { FiHome, FiUsers, FiDollarSign, FiBarChart2, FiSettings } from "react-icons/fi";

const tabs = [
  { to: "/dashboard", icon: FiHome, label: "Dashboard" },
  { to: "/customers", icon: FiUsers, label: "Customers" },
  { to: "/loans", icon: FiDollarSign, label: "Loans" },
  { to: "/reports", icon: FiBarChart2, label: "Reports" },
  { to: "/settings", icon: FiSettings, label: "Settings" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 shadow-lg backdrop-blur-md md:hidden">
      <ul className="flex items-stretch justify-around gap-1 px-2 py-2">
        {tabs.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  isActive
                    ? "text-blue-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
