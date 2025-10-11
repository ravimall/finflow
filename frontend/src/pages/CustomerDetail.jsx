import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import LoanDrawer from "../components/LoanDrawer";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "—";
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return value;
  }
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(number);
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";

  const [customer, setCustomer] = useState(null);
  const [dropboxLink, setDropboxLink] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentSelection, setAgentSelection] = useState("");
  const [agentError, setAgentError] = useState("");
  const [agentSuccess, setAgentSuccess] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteError, setNoteError] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [loans, setLoans] = useState([]);
  const [loanDrawerId, setLoanDrawerId] = useState(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDropboxLink = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/dropbox-link`);
      setDropboxLink(response.data);
    } catch (err) {
      setDropboxLink(null);
    }
  }, [id]);

  const refreshLoans = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/loans`);
      setLoans(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setLoans([]);
    }
  }, [id]);

  const refreshNotes = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/notes`);
      setNotes(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setNotes([]);
    }
  }, [id]);

  const refreshAgents = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/api/users", { params: { role: "agent" } });
      setAgents(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setAgents([]);
    }
  }, [isAdmin]);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [customerRes] = await Promise.all([api.get(`/api/customers/${id}`)]);
      setCustomer(customerRes.data);
      setAgentSelection(
        customerRes.data?.primaryAgent?.id ? String(customerRes.data.primaryAgent.id) : ""
      );
      await Promise.all([fetchDropboxLink(), refreshNotes(), refreshLoans(), refreshAgents()]);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load customer";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchDropboxLink, id, refreshAgents, refreshLoans, refreshNotes]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const handleAgentChange = async (event) => {
    if (!customer) return;
    const nextValue = event.target.value;
    setAgentSelection(nextValue);
    setAgentError("");
    setAgentSuccess("");
    try {
      const payload = nextValue ? { agent_id: Number(nextValue) } : {};
      const response = await api.put(`/api/customers/${customer.id}/assign-agent`, payload);
      setCustomer(response.data?.customer ?? customer);
      setAgentSelection(response.data?.agent?.id ? String(response.data.agent.id) : "");
      setAgentSuccess("Agent assignment updated");
      await fetchDropboxLink();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to assign agent";
      setAgentError(message);
    }
  };

  const addNote = async () => {
    if (!noteInput.trim()) {
      setNoteError("Note is required");
      return;
    }
    setNotesLoading(true);
    setNoteError("");
    try {
      const response = await api.post(`/api/customers/${id}/notes`, { note: noteInput.trim() });
      setNotes((prev) => [response.data, ...prev]);
      setNoteInput("");
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save note";
      setNoteError(message);
    } finally {
      setNotesLoading(false);
    }
  };

  const notesView = useMemo(() => {
    return notes.map((item) => ({
      id: item.id,
      author: item.author?.name || item.author?.email || "Unknown",
      timestamp: formatDate(item.created_at),
      note: item.note,
    }));
  }, [notes]);

  const loansView = useMemo(() => {
    return loans.map((loan) => ({
      id: loan.id,
      bank: loan.bank?.name || loan.bank_name || "—",
      status: loan.status || "—",
      applied: formatNumber(loan.applied_amount),
      approved: formatNumber(loan.approved_amount),
      roi: loan.rate_of_interest === null || typeof loan.rate_of_interest === "undefined"
        ? "—"
        : `${loan.rate_of_interest}%`,
      updated: formatDate(loan.updated_at || loan.created_at),
    }));
  }, [loans]);

  const openDocuments = () => {
    navigate(`/documents?customer_id=${id}`);
  };

  if (loading) {
    return <p>Loading customer…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!customer) {
    return <p className="text-sm text-gray-600">Customer not found.</p>;
  }

  const dropboxPath = dropboxLink?.customer?.dropbox_folder_path || customer.dropbox_folder_path;
  const agentName = customer.primaryAgent?.name || customer.primaryAgent?.email || "Admin";

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="font-mono text-xs text-gray-500">{customer.customer_id}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openDocuments}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
            >
              📁 View Files
            </button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
            <p className="text-base text-gray-900">{customer.status}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Primary agent</p>
            {isAdmin ? (
              <div className="flex flex-col gap-1">
                <select
                  value={agentSelection}
                  onChange={handleAgentChange}
                  className="rounded border border-gray-300 p-2 text-sm"
                >
                  <option value="">Assign to admin</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.email}
                    </option>
                  ))}
                </select>
                {agentError && <span className="text-xs text-red-600">{agentError}</span>}
                {agentSuccess && <span className="text-xs text-green-600">{agentSuccess}</span>}
              </div>
            ) : (
              <p className="text-base text-gray-900">{agentName}</p>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
            <p>{customer.email || "—"}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
            <p>{customer.phone || "—"}</p>
          </div>
          <div className="md:col-span-2 space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</p>
            <p>{customer.address || "—"}</p>
          </div>
          <div className="md:col-span-2 space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dropbox folder</p>
            <p className="break-all font-mono text-xs text-gray-600">
              {dropboxPath || "Folder will be created on demand"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
        </header>
        <div className="space-y-2">
          <textarea
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 p-2 text-sm"
            placeholder="Add a note for this customer"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addNote}
              disabled={notesLoading}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {notesLoading ? "Saving…" : "Add Note"}
            </button>
            {noteError && <span className="text-xs text-red-600">{noteError}</span>}
          </div>
        </div>
        <div className="space-y-3">
          {notesView.length === 0 ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            notesView.map((item) => (
              <article key={item.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                <header className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{item.author}</span>
                  <time>{item.timestamp}</time>
                </header>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{item.note}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Loans</h2>
            <p className="text-xs text-gray-500">
              Manage every loan linked to this customer.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowLoanForm((prev) => !prev)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showLoanForm ? "Close" : "Add New Loan"}
            </button>
          </div>
        </header>

        {showLoanForm && (
          <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4">
            <LoanForm
              onSuccess={() => {
                setShowLoanForm(false);
                refreshLoans();
              }}
              initialCustomerId={customer.id}
              disableCustomerSelection
              customerName={`${customer.customer_id} — ${customer.name}`}
              showSuccessAlert={false}
            />
          </div>
        )}

        {loansView.length === 0 ? (
          <p className="text-sm text-gray-500">No loans recorded for this customer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Bank</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Applied</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Approved</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">ROI</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loansView.map((loan) => (
                  <tr
                    key={loan.id}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => setLoanDrawerId(loan.id)}
                  >
                    <td className="px-4 py-2">{loan.bank}</td>
                    <td className="px-4 py-2">{loan.status}</td>
                    <td className="px-4 py-2">{loan.applied}</td>
                    <td className="px-4 py-2">{loan.approved}</td>
                    <td className="px-4 py-2">{loan.roi}</td>
                    <td className="px-4 py-2">{loan.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LoanDrawer
        loanId={loanDrawerId}
        open={Boolean(loanDrawerId)}
        onClose={() => setLoanDrawerId(null)}
        onSaved={refreshLoans}
      />
    </div>
  );
}
