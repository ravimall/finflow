import { NavLink } from "react-router-dom";
import { FiHome, FiUsers, FiFileText, FiSettings } from "react-icons/fi";

const tabs = [
  { to: "/dashboard", icon: <FiHome className="h-5 w-5" aria-hidden="true" />, label: "Dashboard" },
  { to: "/customers", icon: <FiUsers className="h-5 w-5" aria-hidden="true" />, label: "Customers" },
  {
    to: "/loans",
    icon: (
      <span className="text-lg font-bold leading-none" aria-hidden="true">
        ₹
      </span>
    ),
    label: "Loans",
  },
  { to: "/documents", icon: <FiFileText className="h-5 w-5" aria-hidden="true" />, label: "Documents" },
  { to: "/settings", icon: <FiSettings className="h-5 w-5" aria-hidden="true" />, label: "Settings" },
];

export default function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-md md:hidden">
      <nav className="flex justify-around py-2">
        {tabs.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                isActive ? "text-blue-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`
            }
          >
            {icon}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
