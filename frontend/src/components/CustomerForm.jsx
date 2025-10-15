import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api.js";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  status: "",
  primary_agent_id: "",
  flat_no: "",
};

export default function CustomerForm({ onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [agents, setAgents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    api
      .get("/api/config/statuses", { params: { type: "customer" } })
      .then((res) => setStatuses(res.data))
      .catch(() => setStatuses([]));
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAgents([]);
      setForm((prev) => ({ ...prev, primary_agent_id: "" }));
      return;
    }

    api
      .get("/api/users", { params: { role: "agent" } })
      .then((res) => setAgents(res.data))
      .catch(() => setAgents([]));
  }, [isAdmin]);

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
      const trimmedFlatNo = typeof form.flat_no === "string" ? form.flat_no.trim() : "";
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        status: form.status || undefined,
      };

      if (trimmedFlatNo) {
        payload.flat_no = trimmedFlatNo;
      }

      if (isAdmin && form.primary_agent_id) {
        payload.primary_agent_id = Number(form.primary_agent_id);
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
    <form onSubmit={submit} className="space-y-4 text-sm md:text-base">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        <input
          name="name"
          placeholder="Customer name"
          value={form.name}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <select
          name="status"
          value={form.status}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="email"
        />
        <input
          name="flat_no"
          placeholder="Flat No."
          value={form.flat_no}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={50}
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <textarea
            name="address"
            placeholder="Address"
            value={form.address}
            onChange={handle}
            className="h-full min-h-[120px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>
      </div>
      {isAdmin && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:text-sm" htmlFor="agent">
            Assigned agent
          </label>
          <select
            id="agent"
            name="primary_agent_id"
            value={form.primary_agent_id}
            onChange={handle}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {agentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Creating..." : "Create Customer"}
        </button>
      </div>
    </form>
  );
}
