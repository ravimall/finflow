import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";

const CONTAINER_CLASS = "mx-auto w-full max-w-[1200px] px-3 sm:px-4 md:px-6 lg:px-8";

const linksByRole = {
  user: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/loans", label: "Loans" },
    { to: "/documents", label: "Documents" },
  ],
  admin: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/customers", label: "Customers" },
    { to: "/loans", label: "Loans" },
    { to: "/documents", label: "Documents" },
    { to: "/admin", label: "Admin Config" },
    { to: "/reports", label: "Reports" },
    { to: "/audit-logs", label: "Audit Logs" },
  ],
};

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const navRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [useHamburger, setUseHamburger] = useState(false);

  const navLinks = useMemo(() => {
    if (!user) return [];
    if (user.role === "admin") return linksByRole.admin;
    return linksByRole.user;
  }, [user]);

  const displayName = user?.name?.trim() || user?.email || "";

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  const checkOverflow = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      setUseHamburger(window.innerWidth < 768);
      return;
    }
    const el = navRef.current;
    const overflowing = el ? el.scrollWidth > el.clientWidth + 4 : false;
    setUseHamburger(overflowing || window.innerWidth < 768);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const resizeObserver = typeof ResizeObserver !== "undefined" && navRef.current
      ? new ResizeObserver(() => checkOverflow())
      : null;

    if (resizeObserver && navRef.current) {
      resizeObserver.observe(navRef.current);
    }

    const handleResize = () => {
      window.requestAnimationFrame(() => checkOverflow());
    };

    checkOverflow();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [checkOverflow]);

  useEffect(() => {
    if (!open) return () => {};
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const NavLinks = () => (
    <ul className="flex items-center gap-3 text-sm md:gap-5 md:text-base lg:text-[17px]">
      {navLinks.map((item) => (
        <li key={item.to}>
          <Link className="rounded px-2 py-1 transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to={item.to}>
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
    <>
      <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className={`${CONTAINER_CLASS} flex items-center justify-between gap-3 py-3 md:gap-6`}>
          <Link to={user ? "/dashboard" : "/"} className="text-base font-semibold text-gray-900 md:text-lg lg:text-xl">
            FinFlow
          </Link>

          {user ? (
            <div className="flex flex-1 items-center justify-end gap-4">
              <nav ref={navRef} className="hidden flex-1 justify-end overflow-hidden md:flex">
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

      {user && useHamburger && (
        <>
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:hidden"
          >
            <FiMenu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div
            className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
            aria-hidden={!open}
          >
            <div
              className={`absolute inset-0 bg-gray-900/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
              onClick={closeMenu}
            />
            <aside
              className={`absolute right-0 top-0 flex h-full w-[85%] max-w-[360px] flex-col bg-white shadow-xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <span className="text-base font-semibold text-gray-900">Menu</span>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Close navigation menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-blue-300 hover:text-blue-600"
                >
                  <FiX className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="mb-6 space-y-1 text-sm text-gray-600">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Signed in as</p>
                  <p className="text-base font-semibold text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-400 break-all">{user.email}</p>
                </div>
                <nav>
                  <ul className="space-y-3 text-base">
                    {navLinks.map((item) => (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={closeMenu}
                          className="block rounded-lg px-3 py-2 text-gray-700 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
              <div className="border-t border-gray-200 p-4">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-base font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <FiLogOut aria-hidden="true" />
                  Logout
                </button>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
