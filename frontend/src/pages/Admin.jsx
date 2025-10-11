import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

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
      {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center space-x-2">
            {editing === item.id ? (
              <>
                <input
                  className="border rounded p-1 text-sm"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
                <button
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                  onClick={() => {
                    onRename(item.id, value);
                    cancel();
                  }}
                >
                  Save
                </button>
                <button className="px-2 py-1 text-xs" onClick={cancel}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{item.name}</span>
                <button className="text-xs text-blue-600" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button className="text-xs text-red-600" onClick={() => onDelete(item.id)}>
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-gray-500">No values configured.</li>}
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
    <form onSubmit={submit} className="flex items-center space-x-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="border rounded p-2 text-sm flex-1"
      />
      <button type="submit" className="px-3 py-2 bg-blue-600 text-white text-sm rounded">
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
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-sm text-gray-600">Manage statuses and banks used throughout FinFlow.</p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <StatusList
            title="Customer statuses"
            items={customerStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("customer", name)} placeholder="New customer status" />
        </div>
        <div className="space-y-4">
          <StatusList
            title="Loan statuses"
            items={loanStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("loan", name)} placeholder="New loan status" />
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Banks</h2>
        <StatusList title="" items={banks} onRename={handleRenameBank} onDelete={handleDeleteBank} />
        <AddItemForm label="bank" onSubmit={handleAddBank} placeholder="New bank name" />
      </section>
    </div>
  );
}

