import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";

export default function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api
      .get(`/api/loans/${id}`)
      .then((res) => setLoan(res.data))
      .catch((err) => setError(err.response?.data?.error || "Unable to load loan"));

    api
      .get("/api/config/statuses", { params: { type: "loan" } })
      .then((res) => setStatuses(res.data))
      .catch(() => setStatuses([]));
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setLoan((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const save = async () => {
    if (!loan) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/api/loans/${loan.id}`, {
        status: loan.status,
        notes: loan.notes,
      });
      setSuccess("Changes saved");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save loan");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!loan) {
    return <p>Loading...</p>;
  }

  const statusOptions = statuses.some((status) => status.name === loan.status)
    ? statuses
    : loan.status
    ? [...statuses, { id: "current", name: loan.status }]
    : statuses;

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-gray-900">{loan.customer?.name || "Loan"}</h1>
        <p className="font-mono text-sm text-gray-500">{loan.customer?.customer_id}</p>
      </header>

      <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Loan details</h2>
          <dl className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bank</dt>
              <dd className="mt-1 text-base text-gray-900">{loan.bank?.name || loan.bank_name}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Applied amount</dt>
              <dd className="mt-1 text-base text-gray-900">{loan.applied_amount ?? "—"}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Approved amount</dt>
              <dd className="mt-1 text-base text-gray-900">{loan.approved_amount ?? "—"}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rate of interest</dt>
              <dd className="mt-1 text-base text-gray-900">{loan.rate_of_interest ? `${loan.rate_of_interest}%` : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-600" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={loan.status || ""}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((status) => (
              <option key={status.id} value={status.name}>
                {status.name}
              </option>
            ))}
            {statusOptions.length === 0 && <option value="">No statuses configured</option>}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-600" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            value={loan.notes || ""}
            onChange={handleChange}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {success && <span className="text-sm text-green-600">{success}</span>}
        </div>
      </section>
    </div>
  );
}
