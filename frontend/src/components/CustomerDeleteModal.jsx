import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";

const IMPACT_LABELS = {
  loans: "Loans",
  documents: "Documents",
  notes: "Notes",
  tasks: "Tasks",
  assignments: "Agent assignments",
};

function formatCustomerName(customer, preview) {
  if (customer?.customer_id && customer?.name) {
    return `${customer.customer_id} — ${customer.name}`;
  }
  if (preview?.customer?.code && preview?.customer?.name) {
    return `${preview.customer.code} — ${preview.customer.name}`;
  }
  if (customer?.name) {
    return customer.name;
  }
  return "this customer";
}

export default function CustomerDeleteModal({ open, onClose, customer, onDeleted }) {
  const { showToast } = useToast();
  const [alsoDeleteDropbox, setAlsoDeleteDropbox] = useState(false);
  const [confirmIrreversible, setConfirmIrreversible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");

  const customerId = customer?.id;

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError("");
      setAlsoDeleteDropbox(false);
      setConfirmIrreversible(false);
      setError("");
      return;
    }

    if (!customerId) {
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");

    api
      .get(`/api/customers/${customerId}/deletion-preview`)
      .then((response) => {
        if (cancelled) return;
        setPreview(response.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err.response?.data?.error || err.message || "Unable to load deletion preview";
        setPreview(null);
        setPreviewError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  const hasDropboxFolder = useMemo(() => {
    if (preview?.dropbox) {
      return Boolean(preview.dropbox.hasFolder);
    }
    return Boolean(customer?.dropboxFolderPath);
  }, [customer?.dropboxFolderPath, preview]);

  const dropboxFolderPath = useMemo(() => {
    if (preview?.dropbox?.folderPath) {
      return preview.dropbox.folderPath;
    }
    return customer?.dropboxFolderPath || "";
  }, [customer?.dropboxFolderPath, preview]);

  const impactCounts = preview?.counts || null;
  const hasImpactData = impactCounts && Object.keys(impactCounts).length > 0;

  const closeModal = useCallback(() => {
    if (loading) {
      return;
    }
    onClose?.();
  }, [loading, onClose]);

  const handleDelete = useCallback(
    async (event) => {
      event.preventDefault();
      if (!customerId || loading) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api.delete(`/api/customers/${customerId}`, {
          data: { deleteDropboxFolder: alsoDeleteDropbox && hasDropboxFolder },
        });

        const payload = {
          customerId,
          dropboxDeleted: Boolean(response.data?.dropboxDeleted),
          counts: response.data?.counts || null,
        };

        onDeleted?.(payload);
        onClose?.();
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Failed to delete customer";
        setError(message);
        showToast("error", message);
      } finally {
        setLoading(false);
      }
    },
    [alsoDeleteDropbox, customerId, hasDropboxFolder, loading, onClose, onDeleted, showToast]
  );

  if (!open || !customerId) {
    return null;
  }

  const customerDisplayName = formatCustomerName(customer, preview);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <header className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <FiAlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Delete Customer</h2>
            <p className="text-sm text-gray-600">
              You are about to permanently delete {customerDisplayName}.
            </p>
          </div>
        </header>

        <div className="space-y-3 text-sm text-gray-700">
          <p>
            This action will remove the customer and all related data (loans, tasks, documents, notes, uploads, etc.).
          </p>
          {previewLoading ? (
            <p className="text-xs text-gray-500">Calculating related records…</p>
          ) : previewError ? (
            <p className="text-xs font-medium text-red-600">{previewError}</p>
          ) : hasImpactData ? (
            <dl className="grid grid-cols-2 gap-3 text-xs text-gray-600 sm:text-sm">
              {Object.entries(impactCounts).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {IMPACT_LABELS[key] || key}
                  </dt>
                  <dd className="text-lg font-semibold text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-gray-500">No related records were found for this customer.</p>
          )}
        </div>

        <form onSubmit={handleDelete} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                checked={alsoDeleteDropbox && hasDropboxFolder}
                onChange={(event) => setAlsoDeleteDropbox(event.target.checked)}
                disabled={!hasDropboxFolder || loading}
              />
              <span>
                Also delete the customer’s Dropbox folder
                {!hasDropboxFolder && (
                  <span className="block text-xs text-gray-500">No Dropbox folder on record.</span>
                )}
                {hasDropboxFolder && dropboxFolderPath && (
                  <span className="block break-all text-xs text-gray-500">{dropboxFolderPath}</span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                checked={confirmIrreversible}
                onChange={(event) => setConfirmIrreversible(event.target.checked)}
                disabled={loading}
                required
              />
              <span>I understand this action cannot be undone.</span>
            </label>
          </fieldset>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 px-5 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={!confirmIrreversible || loading}
            >
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
