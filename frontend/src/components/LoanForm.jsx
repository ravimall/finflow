import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

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

export default function LoanForm({
  onSuccess,
  initialCustomerId = "",
  disableCustomerSelection = false,
  customerName = "",
  showSuccessAlert = true,
}) {
  const [form, setForm] = useState({ ...INITIAL_FORM, customer_id: initialCustomerId ? String(initialCustomerId) : "" });
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
    if (initialCustomerId) {
      setForm((prev) => ({ ...prev, customer_id: String(initialCustomerId) }));
    }
  }, [initialCustomerId]);

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
      if (showSuccessAlert) {
        alert("Loan created successfully");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-sm md:text-base">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {disableCustomerSelection ? (
          <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Customer</span>
            <span>{customerName || "Selected customer"}</span>
          </div>
        ) : (
          <select
            name="customer_id"
            value={form.customer_id}
            onChange={handle}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_id} — {customer.name}
              </option>
            ))}
          </select>
        )}
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
        <select
          name="bank_id"
          value={form.bank_id}
          onChange={(event) => {
            const value = event.target.value;
            setForm((prev) => ({ ...prev, bank_id: value, bank_name: value ? "" : prev.bank_name }));
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={!form.bank_id}
          />
        )}
        <input
          name="applied_amount"
          placeholder="Applied amount"
          value={form.applied_amount}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          step="0.01"
        />
        <input
          name="approved_amount"
          placeholder="Approved amount"
          value={form.approved_amount}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          step="0.01"
        />
        <input
          name="rate_of_interest"
          placeholder="Rate of interest (%)"
          value={form.rate_of_interest}
          onChange={handle}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          type="number"
          step="0.01"
        />
      </div>
      <textarea
        name="notes"
        placeholder="Notes"
        value={form.notes}
        onChange={handle}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={3}
      />
      <button
        type="submit"
        disabled={
          submitting ||
          !form.customer_id ||
          (!form.bank_id && !form.bank_name)
        }
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Saving..." : "Create loan"}
      </button>
    </form>
  );
}
