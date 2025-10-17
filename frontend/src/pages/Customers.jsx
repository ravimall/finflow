import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSearch } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import CustomerForm from "../components/CustomerForm";
import CustomerDeleteModal from "../components/CustomerDeleteModal.jsx";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import CustomerCompactCard from "../components/CustomerCompactCard.jsx";

const CUSTOMER_SWIPE_HINT_KEY = "finflow.customers.swipe-hint";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.setItem(CUSTOMER_SWIPE_HINT_KEY, "hidden");
      }
    } catch (error) {
      console.warn("Unable to persist swipe hint preference", error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const [customersResult, loansResult, tasksResult] = await Promise.allSettled([
        api.get("/api/customers"),
        api.get("/api/loans"),
        api.get("/api/tasks", {
          params: {
            status: "pending",
            group_by: "customer",
            page_size: 1,
          },
        }),
      ]);

      if (customersResult.status !== "fulfilled") {
        throw customersResult.reason ?? new Error("Failed to load customers");
      }

      const customerData = Array.isArray(customersResult.value.data)
        ? customersResult.value.data
        : [];

      const loansData =
        loansResult.status === "fulfilled" && Array.isArray(loansResult.value.data)
          ? loansResult.value.data
          : [];

      const latestLoanMap = new Map();
      loansData.forEach((loan) => {
        const rawId = loan?.customer?.id ?? loan?.customer_id;
        if (!rawId) {
          return;
        }
        const key = String(rawId);
        const resolvedTimestamp = new Date(loan?.updated_at || loan?.created_at || 0).getTime();
        const timestamp = Number.isNaN(resolvedTimestamp) ? 0 : resolvedTimestamp;
        const existing = latestLoanMap.get(key);
        if (!existing || timestamp > existing.timestamp) {
          latestLoanMap.set(key, {
            status: loan?.status ?? null,
            timestamp,
          });
        }
      });

      let pendingTaskMap = {};
      if (tasksResult.status === "fulfilled") {
        const groups = tasksResult.value?.data?.groups ?? tasksResult.value?.data ?? [];
        pendingTaskMap = groups.reduce((acc, group) => {
          if (!group?.key) {
            return acc;
          }
          const match = /^customer:(.+)$/.exec(group.key);
          if (!match) {
            return acc;
          }
          const count = typeof group.count === "number" ? group.count : 0;
          acc[String(match[1])] = count;
          return acc;
        }, {});
      }

      const enriched = customerData.map((customer) => {
        const key = String(customer?.id ?? customer?.customer_id ?? "");
        const loanStatus = latestLoanMap.get(key)?.status ?? null;
        const pendingTasks = pendingTaskMap[key] ?? 0;
        return {
          ...customer,
          loan_status: loanStatus,
          pending_tasks: pendingTasks,
        };
      });

      setCustomers(enriched);
    } catch (error) {
      console.error("Failed to fetch customers", error);
      showToast("error", "Unable to load customers. Please try again.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setShowSwipeHint(true);
        return;
      }
      const stored = window.localStorage?.getItem(CUSTOMER_SWIPE_HINT_KEY);
      if (stored !== "hidden") {
        setShowSwipeHint(true);
      }
    } catch (error) {
      console.warn("Unable to read swipe hint preference", error);
      setShowSwipeHint(true);
    }
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  }, []);

  const handleCustomerDeleted = useCallback(
    ({ customerId, dropboxDeleted }) => {
      setCustomers((prev) => prev.filter((customer) => customer.id !== customerId));
      showToast(
        "success",
        dropboxDeleted
          ? "Customer and Dropbox folder deleted."
          : "Customer and related data deleted."
      );
      handleCloseDeleteModal();
    },
    [handleCloseDeleteModal, showToast]
  );

  const openDeleteModal = useCallback(
    (customerId) => {
      const target = customers.find((customer) => customer.id === customerId);
      if (!target) {
        return;
      }
      setDeleteTarget(target);
      setIsDeleteModalOpen(true);
    },
    [customers]
  );

  const statusOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        customers
          .map((customer) => customer.status)
          .filter((status) => typeof status === "string" && status.trim().length > 0)
      )
    );
    values.sort((a, b) => a.localeCompare(b));
    return ["all", ...values];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus =
        statusFilter === "all" || (customer.status || "").toLowerCase() === statusFilter.toLowerCase();

      if (!matchesStatus) {
        return false;
      }

      if (!loweredQuery) {
        return true;
      }

      const name = customer.name || "";
      const code = customer.customer_id || "";
      const createdBy = customer.created_by_name || customer.createdBy?.name || customer.created_by || "";

      return [name, code, createdBy]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(loweredQuery));
    });
  }, [customers, query, statusFilter]);

  const skeletonItems = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  return (
    <div className="relative min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Track loan progress and pending tasks at a glance.</p>
          {loading && <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Refreshing…</span>}
        </div>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              key="customer-form"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              layout
              className="mt-4 rounded-lg bg-white p-4 shadow-md transition-all duration-300"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-gray-800">Add customer</h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Cancel
                </button>
              </div>
              <CustomerForm
                onSuccess={() => {
                  fetchCustomers();
                  setShowForm(false);
                }}
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
              placeholder="Search by name, ID, or creator"
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

        {showSwipeHint && filteredCustomers.length > 0 && (
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
            : filteredCustomers.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                  {query || statusFilter !== "all"
                    ? "No customers match the current filters."
                    : "No customers yet. Use the + button to add your first record."}
                </p>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <CustomerCompactCard
                    key={customer.id}
                    customer={customer}
                    index={index}
                    onPress={() => navigate(`/customers/${customer.id}`)}
                    onEdit={() => navigate(`/customers/${customer.id}`)}
                    onDelete={isAdmin ? () => openDeleteModal(customer.id) : undefined}
                    disableDelete={!isAdmin}
                    onRevealActions={showSwipeHint ? dismissSwipeHint : undefined}
                  />
                ))
              )}
        </div>
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold text-white shadow-lg transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="Add customer"
        >
          <FiPlus className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {isAdmin && (
        <CustomerDeleteModal
          open={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          customer={deleteTarget}
          onDeleted={handleCustomerDeleted}
        />
      )}
    </div>
  );
}
