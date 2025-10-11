import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  status: "",
  agent_id: "",
};

export default function CustomerForm({ onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [agents, setAgents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/users", { params: { role: "agent" } })
      .then((res) => setAgents(res.data))
      .catch(() => setAgents([]));

    api
      .get("/api/config/statuses", { params: { type: "customer" } })
      .then((res) => setStatuses(res.data))
      .catch(() => setStatuses([]));
  }, []);

  useEffect(() => {
    if (!form.status && statuses.length > 0) {
      setForm((prev) => ({ ...prev, status: statuses[0].name }));
    }
  }, [statuses, form.status]);

  const agentOptions = useMemo(() => {
    if (!agents.length) return [];
    return agents.map((agent) => ({ value: agent.id, label: agent.name || agent.email }));
  }, [agents]);

  const handle = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        status: form.status || undefined,
      };

      if (form.agent_id) {
        payload.agent_id = Number(form.agent_id);
      }

      await api.post("/api/customers", payload);
      const defaultStatus = statuses[0]?.name ?? "";
      setForm({ ...INITIAL_FORM, status: defaultStatus });
      onSuccess?.();
      alert("Customer created successfully");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="name"
          placeholder="Customer name"
          value={form.name}
          onChange={handle}
          className="border p-2 rounded"
          required
        />
        <select
          name="status"
          value={form.status}
          onChange={handle}
          className="border p-2 rounded"
          disabled={!statuses.length}
        >
          {statuses.length === 0 && <option value="">Loading statuses...</option>}
          {statuses.map((status) => (
            <option key={status.id} value={status.name}>
              {status.name}
            </option>
          ))}
        </select>
        <input
          name="phone"
          placeholder="Phone"
          value={form.phone}
          onChange={handle}
          className="border p-2 rounded"
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handle}
          className="border p-2 rounded"
          type="email"
        />
      </div>
      <textarea
        name="address"
        placeholder="Address"
        value={form.address}
        onChange={handle}
        className="border p-2 rounded w-full"
        rows={3}
      />
      <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
        <label className="text-sm text-gray-600" htmlFor="agent">
          Assign agent
        </label>
        <select
          id="agent"
          name="agent_id"
          value={form.agent_id}
          onChange={handle}
          className="border p-2 rounded flex-1"
        >
          <option value="">Auto-assign (Admin)</option>
          {agentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create Customer"}
      </button>
    </form>
  );
}
