import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import LoanDrawer from "../components/LoanDrawer";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api.js";

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
  const [dropboxRetryMessage, setDropboxRetryMessage] = useState("");
  const [dropboxRetryError, setDropboxRetryError] = useState("");
  const [dropboxActionLoading, setDropboxActionLoading] = useState(false);
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
  const customerRecordId = customer?.id ?? null;
  const dropboxProvisioningStatus =
    dropboxLink?.customer?.dropboxProvisioningStatus ??
    customer?.dropboxProvisioningStatus ??
    "pending";

  const fetchDropboxLink = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/dropbox-link`);
      setDropboxLink(response.data);
      if (response.data?.customer) {
        setCustomer((prev) => {
          if (!prev) {
            return response.data.customer;
          }
          return { ...prev, ...response.data.customer };
        });
      }
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

  const retryDropboxProvisioning = useCallback(async () => {
    if (!customerRecordId) return;
    setDropboxActionLoading(true);
    setDropboxRetryMessage("");
    setDropboxRetryError("");
    try {
      const response = await api.post(
        `/api/customers/${customerRecordId}/provision-dropbox`
      );
      if (response.data?.customer) {
        setCustomer((prev) => ({ ...prev, ...response.data.customer }));
      }
      setDropboxRetryMessage(
        "Dropbox provisioning has been enqueued. This may take up to a minute."
      );
      await fetchDropboxLink();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        "Unable to trigger Dropbox provisioning";
      setDropboxRetryError(message);
    } finally {
      setDropboxActionLoading(false);
    }
  }, [customerRecordId, fetchDropboxLink]);

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

  useEffect(() => {
    if (dropboxProvisioningStatus === "ok") {
      setDropboxRetryMessage("");
      setDropboxRetryError("");
      setDropboxActionLoading(false);
    }
  }, [dropboxProvisioningStatus]);

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
      setDropboxRetryMessage("");
      setDropboxRetryError("");
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

  const dropboxPath = dropboxLink?.customer?.dropboxFolderPath || customer.dropboxFolderPath;
  const dropboxUrl = dropboxLink?.dropbox_url || null;
  const dropboxStatus = dropboxProvisioningStatus.toLowerCase();
  const isDropboxReady = dropboxStatus === "ok";
  const dropboxLastError =
    dropboxLink?.customer?.dropboxLastError ?? customer.dropboxLastError ?? "";
  const shouldShowDropboxBanner = dropboxStatus !== "ok";
  let dropboxBannerMessage = "Dropbox link is setting up.";
  if (dropboxStatus === "failed") {
    dropboxBannerMessage = dropboxLastError
      ? `Dropbox setup failed: ${dropboxLastError}`
      : "Dropbox setup failed. Retry the provisioning to refresh access.";
  } else if (dropboxStatus === "pending") {
    dropboxBannerMessage = "Dropbox link is being provisioned. You can retry if needed.";
  }
  const dropboxBannerClasses =
    dropboxStatus === "failed"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const shouldShowRetryButton = dropboxStatus !== "ok";
  const agentName = customer.primaryAgent?.name || customer.primaryAgent?.email || "Admin";

  return (
    <div className="space-y-8 pb-6">
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="font-mono text-xs text-gray-500">{customer.customer_id}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openDocuments}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              📁 View Files
            </button>
            {isDropboxReady && dropboxUrl ? (
              <a
                href={dropboxUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-blue-600 px-4 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
              >
                🔗 Open Dropbox
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-500 transition sm:w-auto disabled:cursor-not-allowed disabled:opacity-70"
              >
                🔗 Open Dropbox
              </button>
            )}
          </div>
        </header>

        {shouldShowDropboxBanner && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${dropboxBannerClasses}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex-1">{dropboxBannerMessage}</p>
              {shouldShowRetryButton && (
                <button
                  type="button"
                  onClick={retryDropboxProvisioning}
                  disabled={dropboxActionLoading}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-current px-4 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {dropboxActionLoading ? "Retrying…" : "Retry Dropbox setup"}
                </button>
              )}
            </div>
            {dropboxRetryMessage && (
              <p className="mt-2 text-xs font-medium text-green-700">{dropboxRetryMessage}</p>
            )}
            {dropboxRetryError && (
              <p className="mt-2 text-xs font-medium text-red-700">{dropboxRetryError}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Notes</h2>
        </header>
        <div className="space-y-2">
          <textarea
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add a note for this customer"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={addNote}
              disabled={notesLoading}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
              <article key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
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

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Loans</h2>
            <p className="text-sm text-gray-500">
              Manage every loan linked to this customer.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowLoanForm((prev) => !prev)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              {showLoanForm ? "Close" : "Add New Loan"}
            </button>
          </div>
        </header>

        {showLoanForm && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
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
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No loans recorded for this customer.
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Bank</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applied</th>
                      <th className="px-4 py-3">Approved</th>
                      <th className="px-4 py-3">ROI</th>
                      <th className="px-4 py-3">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loansView.map((loan) => (
                      <tr
                        key={loan.id}
                        className="cursor-pointer transition hover:bg-blue-50/60"
                        onClick={() => setLoanDrawerId(loan.id)}
                      >
                        <td className="px-4 py-3">{loan.bank}</td>
                        <td className="px-4 py-3">{loan.status}</td>
                        <td className="px-4 py-3">{loan.applied}</td>
                        <td className="px-4 py-3">{loan.approved}</td>
                        <td className="px-4 py-3">{loan.roi}</td>
                        <td className="px-4 py-3">{loan.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {loansView.map((loan) => (
                <article
                  key={loan.id}
                  onClick={() => setLoanDrawerId(loan.id)}
                  className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{loan.bank}</h3>
                      <p className="text-xs text-gray-500">Updated {loan.updated}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {loan.status}
                    </span>
                  </header>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Applied</dt>
                      <dd className="text-gray-800">{loan.applied}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Approved</dt>
                      <dd className="text-gray-800">{loan.approved}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">ROI</dt>
                      <dd className="text-gray-800">{loan.roi}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
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

