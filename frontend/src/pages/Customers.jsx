import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiTrash2 } from "react-icons/fi";
import CustomerForm from "../components/CustomerForm";
import CustomerDeleteModal from "../components/CustomerDeleteModal.jsx";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const customerRows = useMemo(() => {
    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      customerCode: customer.customer_id,
      status: customer.status,
      primaryAgent: customer.primaryAgent?.name || customer.primaryAgent?.email || "Unassigned",
      flatNo: customer.flat_no || "—",
    }));
  }, [customers]);

  return (
    <div className="space-y-10 pb-6">
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

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Customers</h1>
          {loading && <span className="text-sm text-gray-500">Loading customers…</span>}
        </div>

        {customerRows.length === 0 && !loading ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 md:text-base">
            No customers yet. Create your first record above.
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Customer ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Flat No.</th>
                      {isAdmin && <th className="px-4 py-3">Primary agent</th>}
                      {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerRows.map((customer) => (
                      <tr key={customer.id} className="transition hover:bg-blue-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{customer.customerCode}</td>
                        <td className="px-4 py-3">
                          <Link to={`/customers/${customer.id}`} className="font-medium text-blue-600 hover:underline">
                            {customer.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {customer.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.flatNo}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-sm text-gray-700">{customer.primaryAgent}</td>
                        )}
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openDeleteModal(customer.id)}
                              title="Delete customer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                            >
                              <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Delete customer</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {customerRows.map((customer) => (
                <article key={customer.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{customer.name}</h3>
                      <p className="font-mono text-xs uppercase tracking-wide text-gray-500">{customer.customerCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {customer.status}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openDeleteModal(customer.id)}
                          title="Delete customer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                        >
                          <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Delete customer</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <dt className="font-medium text-gray-500">Flat No.</dt>
                      <dd className="text-right text-gray-700">{customer.flatNo}</dd>
                    </div>
                    {isAdmin && (
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500">Primary agent</dt>
                        <dd className="text-right text-gray-700">{customer.primaryAgent}</dd>
                      </div>
                    )}
                  </dl>
                  <Link
                    to={`/customers/${customer.id}`}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    View details
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
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
