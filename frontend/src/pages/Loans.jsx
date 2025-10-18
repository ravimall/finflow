import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import LoanForm from "../components/LoanForm";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import LoanCompactCard from "../components/LoanCompactCard.jsx";

const LOAN_SWIPE_HINT_KEY = "finflow.loans.swipe-hint";

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchLoans = useCallback(() => {
    setLoading(true);
    api
      .get("/api/loans")
      .then((res) => setLoans(res.data ?? []))
      .catch((error) => {
        console.error("Error fetching loans", error);
        setLoans([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setShowSwipeHint(true);
        return;
      }
      const stored = window.localStorage?.getItem(LOAN_SWIPE_HINT_KEY);
      if (stored !== "hidden") {
        setShowSwipeHint(true);
      }
    } catch (error) {
      console.warn("Unable to read loan swipe hint preference", error);
      setShowSwipeHint(true);
    }
  }, []);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.setItem(LOAN_SWIPE_HINT_KEY, "hidden");
      }
    } catch (error) {
      console.warn("Unable to persist loan swipe hint preference", error);
    }
  }, []);

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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-screen-md p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Loans</h1>
            <p className="text-sm text-gray-500">
              Manage loan applications and approval stages efficiently.
            </p>
            {loading && (
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Refreshing…</span>
            )}
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Plus className="h-5 w-5" />
              <span>Add Loan</span>
            </button>
          )}
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              key="add-loan-form"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mb-4 rounded-lg bg-white p-4 shadow-md"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-800">Add loan</h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Cancel
                </button>
              </div>
              <LoanForm
                onSuccess={() => {
                  fetchLoans();
                  setShowForm(false);
                }}
                onCancel={() => setShowForm(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 space-y-3">
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

        {showSwipeHint && filteredLoans.length > 0 && (
          <p className="mt-4 text-center text-xs italic text-gray-400">
            💡 Swipe left on a card to Edit or Delete
          </p>
        )}

        <div className="mt-4 space-y-2 pb-8">
          {loading
            ? skeletonItems.map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg bg-white/60 shadow-sm"
                />
              ))
            : filteredLoans.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                  {query || statusFilter !== "all"
                    ? "No loans match the current filters."
                    : "No loans yet. Use the + button to create your first loan."}
                </p>
              ) : (
                filteredLoans.map((loan, index) => (
                  <LoanCompactCard
                    key={loan.id}
                    loan={loan}
                    index={index}
                    onPress={() => navigate(`/loans/${loan.id}`)}
                    onEdit={() => navigate(`/loans/${loan.id}`)}
                    onDelete={() => handleDeleteLoan(loan.id)}
                    isDeleting={deletingId === loan.id}
                    onRevealActions={showSwipeHint ? dismissSwipeHint : undefined}
                  />
                ))
              )}
        </div>
      </div>
    </div>
  );
}
