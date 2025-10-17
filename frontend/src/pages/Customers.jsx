import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import CustomerForm from "../components/CustomerForm";
import CustomerDeleteModal from "../components/CustomerDeleteModal.jsx";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import CustomerCompactCard from "../components/CustomerCompactCard.jsx";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    api
      .get("/api/customers")
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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
    <div className="space-y-10 pb-24">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">Create customer</h2>
            <p className="text-sm text-gray-500 md:text-base">
              Collect the basics and assign an agent in one place.
            </p>
          </div>
          {loading && <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Refreshing…</span>}
        </header>
        <CustomerForm onSuccess={fetchCustomers} />
      </section>

      <section className="mx-auto max-w-screen-md space-y-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Customers</h1>
          {loading && <span className="text-sm text-gray-500">Loading customers…</span>}
        </div>

        <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-white/95 px-4 pt-2 pb-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:static sm:mx-0 sm:px-0">
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

        <div className="space-y-2">
          {loading
            ? skeletonItems.map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-100/60"
                />
              ))
            : filteredCustomers.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 md:text-base">
                  {query || statusFilter !== "all"
                    ? "No customers match the current filters."
                    : "No customers yet. Create your first record above."}
                </p>
              ) : (
                filteredCustomers.map((customer) => (
                  <CustomerCompactCard
                    key={customer.id}
                    customer={customer}
                    onPress={() => navigate(`/customers/${customer.id}`)}
                    onEdit={() => navigate(`/customers/${customer.id}`)}
                    onDelete={isAdmin ? () => openDeleteModal(customer.id) : undefined}
                    disableDelete={!isAdmin}
                  />
                ))
              )}
        </div>
      </section>
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
