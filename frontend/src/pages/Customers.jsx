import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CustomerForm from "../components/CustomerForm";
import { api } from "../lib/api.js";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const customerRows = useMemo(() => {
    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      customerCode: customer.customer_id,
      status: customer.status,
      primaryAgent: customer.primaryAgent?.name || customer.primaryAgent?.email || "Unassigned",
    }));
  }, [customers]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Create customer</h2>
        <CustomerForm onSuccess={fetchCustomers} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Customers</h1>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        {customerRows.length === 0 && !loading ? (
          <p className="text-sm text-gray-600">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Customer ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Primary agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerRows.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{customer.customerCode}</td>
                    <td className="px-4 py-2">
                      <Link to={`/customers/${customer.id}`} className="text-blue-600 hover:underline">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{customer.status}</td>
                    <td className="px-4 py-2">{customer.primaryAgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
