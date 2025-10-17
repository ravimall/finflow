import {
  FiBarChart2,
  FiCheckSquare,
  FiClock,
  FiFileText,
  FiHome,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

const iconClass = "h-4 w-4";

const RupeeIcon = () => (
  <span
    aria-hidden="true"
    className="flex h-4 w-4 items-center justify-center text-xs font-bold leading-none text-current"
  >
    ₹
  </span>
);

export const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: <FiHome aria-hidden="true" className={iconClass} />,
  },
  {
    to: "/customers",
    label: "Customers",
    icon: <FiUsers aria-hidden="true" className={iconClass} />,
  },
  {
    to: "/tasks",
    label: "My Tasks",
    icon: <FiCheckSquare aria-hidden="true" className={iconClass} />,
  },
  {
    to: "/loans",
    label: "Loans",
    icon: <RupeeIcon />,
  },
  {
    to: "/documents",
    label: "Documents",
    icon: <FiFileText aria-hidden="true" className={iconClass} />,
  },
  {
    to: "/admin/config",
    label: "Admin Config",
    icon: <FiSettings aria-hidden="true" className={iconClass} />,
    adminOnly: true,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: <FiBarChart2 aria-hidden="true" className={iconClass} />,
  },
  {
    to: "/admin/audit-logs",
    label: "Audit Logs",
    icon: <FiClock aria-hidden="true" className={iconClass} />,
    adminOnly: true,
  },
];

