import { useEffect, useState } from "react";
import { api } from "../lib/api";

const INITIAL_FORM = {
  customer_id: "",
  bank_id: "",
  bank_name: "",
  applied_amount: "",
  approved_amount: "",
  rate_of_interest: "",
  status: "",
  notes: "",
};

export default function LoanForm({ onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/customers")
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]));

    api
      .get("/api/config/banks")
      .then((res) => setBanks(res.data))
      .catch(() => setBanks([]));

    api
      .get("/api/config/statuses", { params: { type: "loan" } })
      .then((res) => setStatuses(res.data))
      .catch(() => setStatuses([]));
  }, []);

  useEffect(() => {
    if (!form.status && statuses.length > 0) {
      setForm((prev) => ({ ...prev, status: statuses[0].name }));
    }
  }, [statuses, form.status]);

  const handle = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (!form.customer_id) {
        throw new Error("Select a customer");
      }

      const payload = {
        customer_id: Number(form.customer_id),
        applied_amount: form.applied_amount || undefined,
        approved_amount: form.approved_amount || undefined,
        rate_of_interest: form.rate_of_interest || undefined,
        status: form.status || undefined,
        notes: form.notes || undefined,
      };

      if (form.bank_id) {
        payload.bank_id = Number(form.bank_id);
      } else if (form.bank_name) {
        payload.bank_name = form.bank_name;
      }

      await api.post("/api/loans", payload);
      const defaultStatus = statuses[0]?.name ?? "";
      setForm({ ...INITIAL_FORM, status: defaultStatus });
      onSuccess?.();
      alert("Loan created successfully");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <select
          name="customer_id"
          value={form.customer_id}
          onChange={handle}
          className="border p-2 rounded"
          required
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.customer_id} — {customer.name}
            </option>
          ))}
        </select>
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
        <select
          name="bank_id"
          value={form.bank_id}
          onChange={(event) => {
            const value = event.target.value;
            setForm((prev) => ({ ...prev, bank_id: value, bank_name: value ? "" : prev.bank_name }));
          }}
          className="border p-2 rounded"
        >
          <option value="">Custom bank</option>
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.name}
            </option>
          ))}
        </select>
        {!form.bank_id && (
          <input
            name="bank_name"
            placeholder="Bank name"
            value={form.bank_name}
            onChange={handle}
            className="border p-2 rounded"
            required={!form.bank_id}
          />
        )}
        <input
          name="applied_amount"
          placeholder="Applied amount"
          value={form.applied_amount}
          onChange={handle}
          className="border p-2 rounded"
          type="number"
          step="0.01"
        />
        <input
          name="approved_amount"
          placeholder="Approved amount"
          value={form.approved_amount}
          onChange={handle}
          className="border p-2 rounded"
          type="number"
          step="0.01"
        />
        <input
          name="rate_of_interest"
          placeholder="Rate of interest (%)"
          value={form.rate_of_interest}
          onChange={handle}
          className="border p-2 rounded"
          type="number"
          step="0.01"
        />
      </div>
      <textarea
        name="notes"
        placeholder="Notes"
        value={form.notes}
        onChange={handle}
        className="border p-2 rounded w-full"
        rows={3}
      />
      <button
        type="submit"
        disabled={submitting || !form.customer_id || (!form.bank_id && !form.bank_name)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Create loan"}
      </button>
    </form>
  );
}
