import { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";

const CONTAINER_CLASS = "mx-auto w-full max-w-[1200px] px-3 sm:px-4 md:px-6 lg:px-8";

const linksByRole = {
  user: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/tasks", label: "My Tasks" },
    { to: "/loans", label: "Loans" },
    { to: "/documents", label: "Documents" },
  ],
  admin: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/tasks", label: "My Tasks" },
    { to: "/loans", label: "Loans" },
    { to: "/documents", label: "Documents" },
    { to: "/admin", label: "Admin Config" },
    { to: "/reports", label: "Reports" },
    { to: "/audit-logs", label: "Audit Logs" },
  ],
};

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);

  const navLinks = useMemo(() => {
    if (!user) return [];
    if (user.role === "admin") return linksByRole.admin;
    return linksByRole.user;
  }, [user]);

  const displayName = user?.name?.trim() || user?.email || "";

  const NavLinks = () => (
    <ul className="flex items-center gap-3 text-sm md:gap-5 md:text-base lg:text-[17px]">
      {navLinks.map((item) => (
        <li key={item.to}>
          <Link
            className="rounded px-2 py-1 transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            to={item.to}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  const GuestNav = () => (
    <div className="flex w-full items-center justify-between text-sm md:text-base">
      <Link to="/" className="text-base font-semibold text-gray-900 md:text-lg lg:text-xl">
        FinFlow
      </Link>
      <Link
        to="/"
        className="inline-flex h-10 items-center rounded-full bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Login
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className={`${CONTAINER_CLASS} flex items-center justify-between gap-3 py-3 md:gap-6`}>
        <Link to={user ? "/dashboard" : "/"} className="text-base font-semibold text-gray-900 md:text-lg lg:text-xl">
          FinFlow
        </Link>

        {user ? (
          <div className="flex flex-1 items-center justify-end gap-4">
            <nav className="hidden flex-1 justify-end overflow-hidden md:flex">
              <NavLinks />
            </nav>

            <div className="hidden shrink-0 flex-col items-end text-xs text-gray-500 md:flex md:text-sm">
              <span className="uppercase tracking-wide">Signed in as</span>
              <span className="text-sm font-semibold text-gray-900 md:text-base" title={user.email}>
                {displayName}
              </span>
            </div>

            <button
              type="button"
              onClick={logout}
              className="hidden h-10 items-center justify-center gap-2 rounded-full border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:inline-flex"
            >
              <FiLogOut aria-hidden="true" />
              Logout
            </button>
          </div>
        ) : (
          <GuestNav />
        )}
      </div>
    </header>
  );
}
