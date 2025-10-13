import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

function StatusList({ title, items, onRename, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState("");

  const startEdit = (item) => {
    setEditing(item.id);
    setValue(item.name);
  };

  const cancel = () => {
    setEditing(null);
    setValue("");
  };

  return (
    <section className="space-y-3">
      {title ? <h3 className="text-lg font-semibold text-gray-900 md:text-xl">{title}</h3> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            {editing === item.id ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
                    onClick={() => {
                      onRename(item.id, value);
                      cancel();
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100"
                    onClick={cancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-700 md:text-base">{item.name}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-blue-200 px-4 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50"
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 px-4 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:bg-red-50"
                    onClick={() => onDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No values configured.
          </li>
        )}
      </ul>
    </section>
  );
}

function AddItemForm({ label, onSubmit, placeholder }) {
  const [value, setValue] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
      >
        Add {label}
      </button>
    </form>
  );
}

export default function Admin() {
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loanStatuses, setLoanStatuses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setError("");
    Promise.all([
      api.get("/api/admin/config/statuses", { params: { type: "customer" } }),
      api.get("/api/admin/config/statuses", { params: { type: "loan" } }),
      api.get("/api/admin/config/banks"),
    ])
      .then(([customerRes, loanRes, bankRes]) => {
        setCustomerStatuses(customerRes.data);
        setLoanStatuses(loanRes.data);
        setBanks(bankRes.data);
      })
      .catch((err) => setError(err.response?.data?.error || "Unable to load configuration"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddStatus = async (type, name) => {
    try {
      await api.post("/api/admin/config/statuses", { type, name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add status");
    }
  };

  const handleRenameStatus = async (id, name) => {
    try {
      await api.put(`/api/admin/config/statuses/${id}`, { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update status");
    }
  };

  const handleDeleteStatus = async (id) => {
    if (!window.confirm("Delete this status?")) return;
    try {
      await api.delete(`/api/admin/config/statuses/${id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete status");
    }
  };

  const handleAddBank = async (name) => {
    try {
      await api.post("/api/admin/config/banks", { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add bank");
    }
  };

  const handleRenameBank = async (id, name) => {
    try {
      await api.put(`/api/admin/config/banks/${id}`, { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update bank");
    }
  };

  const handleDeleteBank = async (id) => {
    if (!window.confirm("Delete this bank?")) return;
    try {
      await api.delete(`/api/admin/config/banks/${id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete bank");
    }
  };

  return (
    <div className="space-y-8 pb-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Configuration</h1>
        <p className="text-sm text-gray-600 md:text-base">Manage statuses and banks used throughout FinFlow.</p>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <StatusList
            title="Customer statuses"
            items={customerStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("customer", name)} placeholder="New customer status" />
        </div>
        <div className="space-y-5">
          <StatusList
            title="Loan statuses"
            items={loanStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("loan", name)} placeholder="New loan status" />
        </div>
      </div>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-gray-900">Banks</h2>
        <StatusList title="" items={banks} onRename={handleRenameBank} onDelete={handleDeleteBank} />
        <AddItemForm label="bank" onSubmit={handleAddBank} placeholder="New bank name" />
      </section>
    </div>
  );
}

