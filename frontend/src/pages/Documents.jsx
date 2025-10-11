import { useEffect, useState } from "react";
import { api } from "../lib/api";
import FileExplorer from "../components/FileExplorer";

export default function Documents() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/api/customers")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCustomers(list);
        if (list.length > 0) {
          setSelectedCustomer(String(list[0].id));
        }
      })
      .catch((err) => {
        const message = err.response?.data?.error || err.message || "Unable to load customers";
        setError(message);
        setCustomers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const hasCustomers = customers.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold">Dropbox documents</h1>
          <p className="text-xs text-gray-500">Browse and manage customer Dropbox files.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            value={selectedCustomer}
            onChange={(event) => setSelectedCustomer(event.target.value)}
            className="border rounded p-2 min-w-[240px]"
            disabled={!hasCustomers}
          >
            {hasCustomers ? (
              customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_id} — {customer.name}
                </option>
              ))
            ) : (
              <option value="">No customers available</option>
            )}
          </select>
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500">Loading customers…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasCustomers && !loading && (
        <p className="text-sm text-gray-600">
          No customers available. Create a customer to browse Dropbox files.
        </p>
      )}

      {hasCustomers && selectedCustomer && (
        <FileExplorer customerId={selectedCustomer} key={selectedCustomer} />
      )}
    </div>
  );
}
