import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import FileExplorer from "../components/FileExplorer";

export default function Documents() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!customers.length) return;
    const params = new URLSearchParams(location.search);
    const queryId = params.get("customer_id");
    const fallbackId = String(customers[0].id);
    const hasQueryMatch = queryId && customers.some((customer) => String(customer.id) === queryId);

    if (hasQueryMatch) {
      if (selectedCustomer !== queryId) {
        setSelectedCustomer(queryId);
      }
      return;
    }

    if (!selectedCustomer || !customers.some((customer) => String(customer.id) === selectedCustomer)) {
      setSelectedCustomer(fallbackId);
      if (queryId !== fallbackId) {
        params.set("customer_id", fallbackId);
        const queryString = params.toString();
        navigate(`${location.pathname}${queryString ? `?${queryString}` : ""}`, { replace: true });
      }
    }
  }, [customers, location.pathname, location.search, navigate, selectedCustomer]);

  const hasCustomers = customers.length > 0;
  const selectedCustomerData = useMemo(
    () => customers.find((customer) => String(customer.id) === String(selectedCustomer)),
    [customers, selectedCustomer]
  );

  const handleSelectionChange = (value) => {
    setSelectedCustomer(value);
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set("customer_id", value);
    } else {
      params.delete("customer_id");
    }
    const queryString = params.toString();
    navigate(`${location.pathname}${queryString ? `?${queryString}` : ""}`, { replace: true });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Documents{selectedCustomerData ? ` — ${selectedCustomerData.name}` : ""}
          </h1>
          <p className="text-xs text-gray-500">Browse and manage customer Dropbox files.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            value={selectedCustomer}
            onChange={(event) => handleSelectionChange(event.target.value)}
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
        <FileExplorer
          customerId={selectedCustomer}
          customerName={selectedCustomerData?.name}
          key={selectedCustomer}
        />
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getFileIcon(file) {
  if (file.is_folder) return "📁";
  const name = file.name || "";
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  switch (extension) {
    case "pdf":
      return "📄";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return "🖼️";
    case "xls":
    case "xlsx":
      return "📊";
    case "doc":
    case "docx":
      return "📝";
    case "zip":
    case "rar":
      return "🗜️";
    default:
      return "📎";
  }
}
