import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Home,
  User,
  FileText,
  Settings,
  BarChart,
  Clock,
  Wrench,
} from "lucide-react";

export default function BottomNav({ user }) {
  const [showSheet, setShowSheet] = useState(false);
  const [sheetType, setSheetType] = useState(null);

  if (!user) {
    return null;
  }

  const allTabs = [
    { to: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { to: "/customers", label: "Customers", icon: <User className="h-5 w-5" /> },
    { to: "/loans", label: "Loans", icon: <span className="text-base font-bold">₹</span> },
    { to: "/documents", label: "Documents", icon: <FileText className="h-5 w-5" /> },
    { to: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const adminTabs = [
    { to: "/admin/config", label: "Admin Config", icon: <Wrench className="h-5 w-5" /> },
    { to: "/admin/audit-logs", label: "Audit Logs", icon: <Clock className="h-5 w-5" /> },
    { to: "/reports", label: "Reports", icon: <BarChart className="h-5 w-5" /> },
  ];

  const roleTabs =
    user.role === "admin"
      ? [...allTabs, { label: "Admin ▾", submenu: adminTabs }]
      : allTabs;

  const maxVisible = 5;
  let visibleTabs = roleTabs.slice(0, maxVisible);
  let overflowTabs = roleTabs.length > maxVisible ? roleTabs.slice(maxVisible) : [];

  if (user.role === "admin") {
    const adminIndex = roleTabs.findIndex((tab) => tab.submenu);
    if (adminIndex >= maxVisible) {
      const adminTab = roleTabs[adminIndex];
      visibleTabs = [...roleTabs.slice(0, maxVisible - 1), adminTab];
      overflowTabs = [
        ...roleTabs.slice(maxVisible - 1, adminIndex),
        ...roleTabs.slice(adminIndex + 1),
      ];
    }
  }

  const openSheet = (type) => {
    setSheetType(type);
    setShowSheet(true);
  };

  const closeSheet = () => {
    setShowSheet(false);
    setTimeout(() => setSheetType(null), 200);
  };

  if (visibleTabs.length === 0 && overflowTabs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-md">
        <nav className="flex justify-around py-2">
          {visibleTabs.map((tab, idx) =>
            tab.submenu ? (
              <button
                key={`admin-${idx}`}
                onClick={() => openSheet("admin")}
                className="flex flex-col items-center text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-blue-500 focus:outline-none"
                type="button"
              >
                <div className="mb-1 flex h-6 w-6 items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <span>Admin ▾</span>
              </button>
            ) : (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-center text-xs font-medium transition-colors duration-200 ${
                    isActive ? "text-blue-600" : "text-gray-500 hover:text-blue-500"
                  }`
                }
                onClick={closeSheet}
              >
                <div className="mb-1 flex h-6 w-6 items-center justify-center">{tab.icon}</div>
                <span>{tab.label}</span>
              </NavLink>
            ),
          )}

          {overflowTabs.length > 0 && (
            <button
              onClick={() => openSheet("more")}
              className="flex flex-col items-center text-xs font-medium text-gray-500 transition-colors duration-200 hover:text-blue-500 focus:outline-none"
              type="button"
            >
              <div className="mb-1 flex h-6 w-6 items-center justify-center text-lg">⋯</div>
              <span>More</span>
            </button>
          )}
        </nav>
      </div>

      <AnimatePresence>
        {showSheet && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeSheet}
              className="fixed inset-0 z-40 bg-black"
            />

            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-0 left-0 z-50 w-full rounded-t-2xl bg-white p-4 shadow-lg"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-800">
                  {sheetType === "admin" ? "Admin Menu" : "More"}
                </h3>
                <button
                  onClick={closeSheet}
                  className="rounded-full p-1 transition-colors duration-200 hover:bg-gray-100"
                  type="button"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              <div className="space-y-2">
                {(sheetType === "admin" ? adminTabs : overflowTabs).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-blue-50"
                    onClick={closeSheet}
                  >
                    <div className="flex h-6 w-6 items-center justify-center text-gray-600">
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <button
                onClick={closeSheet}
                className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                type="button"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
