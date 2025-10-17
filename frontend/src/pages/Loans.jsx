import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import LoanForm from "../components/LoanForm";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import LoanCompactCard from "../components/LoanCompactCard.jsx";

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchLoans = useCallback(() => {
    setLoading(true);
    api
      .get("/api/loans")
      .then((res) => setLoans(res.data))
      .catch(() => setLoans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const statusOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        loans
          .map((loan) => loan.status)
          .filter((status) => typeof status === "string" && status.trim().length > 0)
      )
    );
    values.sort((a, b) => a.localeCompare(b));
    return ["all", ...values];
  }, [loans]);

  const filteredLoans = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return loans.filter((loan) => {
      const matchesStatus =
        statusFilter === "all" || (loan.status || "").toLowerCase() === statusFilter.toLowerCase();

      if (!matchesStatus) {
        return false;
      }

      if (!loweredQuery) {
        return true;
      }

      const bankName = loan.bank?.name || loan.bank_name || "";
      const appliedAmount = loan.applied_amount ? loan.applied_amount.toString() : "";
      const customerName = loan.customer?.name || "";
      const customerCode = loan.customer?.customer_id || "";

      return [bankName, appliedAmount, customerName, customerCode]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(loweredQuery));
    });
  }, [loans, query, statusFilter]);

  const skeletonItems = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  const handleDeleteLoan = useCallback(
    async (loanId) => {
      const shouldDelete = window.confirm(
        "Delete this loan record? This action cannot be undone."
      );
      if (!shouldDelete) {
        return;
      }

      setDeletingId(loanId);
      try {
        await api.delete(`/api/loans/${loanId}`);
        setLoans((prev) => prev.filter((loan) => loan.id !== loanId));
        showToast("success", "Loan deleted.");
      } catch (error) {
        showToast("error", "Unable to delete loan. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [showToast]
  );

  return (
    <div className="space-y-10 pb-24">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">Create loan</h2>
            <p className="text-sm text-gray-500 md:text-base">
              Capture loan requests quickly and keep customers moving.
            </p>
          </div>
          {loading && <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Refreshing…</span>}
        </header>
        <LoanForm onSuccess={fetchLoans} />
      </section>

      <section className="mx-auto max-w-screen-md space-y-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Loans</h1>
          {loading && <span className="text-sm text-gray-500">Loading loans…</span>}
        </div>

        <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-white/95 px-4 pt-2 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:static sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <FiSearch className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by bank, customer, or amount"
              className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          {statusOptions.length > 1 && (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          {loading
            ? skeletonItems.map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-100/60"
                />
              ))
            : filteredLoans.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 md:text-base">
                  {query || statusFilter !== "all"
                    ? "No loans match the current filters."
                    : "No loans yet. Create the first loan using the form above."}
                </p>
              ) : (
                filteredLoans.map((loan) => (
                  <LoanCompactCard
                    key={loan.id}
                    loan={loan}
                    onPress={() => navigate(`/loans/${loan.id}`)}
                    onEdit={() => navigate(`/loans/${loan.id}`)}
                    onDelete={() => handleDeleteLoan(loan.id)}
                    isDeleting={deletingId === loan.id}
                  />
                ))
              )}
        </div>
      </section>
    </div>
  );
}
