import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">{loan.customer?.name || "Loan"}</h1>
        <p className="text-sm text-gray-500 font-mono">{loan.customer?.customer_id}</p>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Loan details</h2>
          <dl className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Bank</dt>
              <dd>{loan.bank?.name || loan.bank_name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Applied amount</dt>
              <dd>{loan.applied_amount ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Approved amount</dt>
              <dd>{loan.approved_amount ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Rate of interest</dt>
              <dd>{loan.rate_of_interest ? `${loan.rate_of_interest}%` : "—"}</dd>
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
            className="border rounded p-2"
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
            className="border rounded w-full p-2"
          />
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {success && <span className="text-sm text-green-600">{success}</span>}
        </div>
      </section>
    </div>
  );
}
