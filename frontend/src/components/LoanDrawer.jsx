import { useCallback, useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { api } from "../lib/api.js";
import { useFramerMotion } from "../hooks/useFramerMotion";

const INITIAL_FORM = {
  status: "",
  bank_id: "",
  bank_name: "",
  applied_amount: "",
  approved_amount: "",
  rate_of_interest: "",
  notes: "",
};

function parseNumeric(value) {
  if (value === null || typeof value === "undefined") return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function LoanDrawer({ loanId, open, onClose, onSaved }) {
  const { AnimatePresence, motion } = useFramerMotion();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loan, setLoan] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetState = useCallback(() => {
    setForm(INITIAL_FORM);
    setLoan(null);
    setStatuses([]);
    setBanks([]);
    setError("");
    setSuccess("");
    setLoading(false);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (!open || !loanId) {
      resetState();
      return;
    }

    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const [loanRes, statusRes, bankRes] = await Promise.all([
          api.get(`/api/loans/${loanId}`),
          api.get("/api/config/statuses", { params: { type: "loan" } }),
          api.get("/api/config/banks"),
        ]);

        if (!isMounted) return;
        const loanData = loanRes.data || {};
        setLoan(loanData);
        setStatuses(Array.isArray(statusRes.data) ? statusRes.data : []);
        setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
        setForm({
          status: loanData.status || "",
          bank_id: loanData.bank?.id ? String(loanData.bank.id) : "",
          bank_name: loanData.bank?.name || loanData.bank_name || "",
          applied_amount: loanData.applied_amount ?? "",
          approved_amount: loanData.approved_amount ?? "",
          rate_of_interest: loanData.rate_of_interest ?? "",
          notes: loanData.notes || "",
        });
      } catch (err) {
        if (!isMounted) return;
        const message = err.response?.data?.error || err.message || "Unable to load loan";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [loanId, open, resetState]);

  const statusOptions = useMemo(() => {
    if (!form.status) return statuses;
    if (statuses.some((status) => status.name === form.status)) {
      return statuses;
    }
    return [...statuses, { id: "current", name: form.status }];
  }, [form.status, statuses]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBankSelect = (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, bank_id: value, bank_name: value ? "" : prev.bank_name }));
  };

  const save = async () => {
    if (!loan) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        status: form.status || undefined,
        notes: typeof form.notes === "string" ? form.notes : undefined,
        applied_amount: parseNumeric(form.applied_amount),
        approved_amount: parseNumeric(form.approved_amount),
        rate_of_interest: parseNumeric(form.rate_of_interest),
      };

      if (form.bank_id) {
        payload.bank_id = Number(form.bank_id);
      } else if (form.bank_name) {
        payload.bank_name = form.bank_name;
      }

      const response = await api.put(`/api/loans/${loan.id}`, payload);
      const updated = response.data?.loan || loan;
      setLoan(updated);
      setForm({
        status: updated.status || "",
        bank_id: updated.bank?.id ? String(updated.bank.id) : "",
        bank_name: updated.bank?.name || updated.bank_name || form.bank_name,
        applied_amount: updated.applied_amount ?? "",
        approved_amount: updated.approved_amount ?? "",
        rate_of_interest: updated.rate_of_interest ?? "",
        notes: updated.notes || "",
      });
      setSuccess("Changes saved");
      onSaved?.();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save loan";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  const loanTitle = loan?.customer?.name
    ? `${loan.customer.name} — ${loan.customer.customer_id}`
    : "Loan";
  const createdAtLabel = loan?.created_at
    ? new Date(loan.created_at).toLocaleString()
    : null;
  const footerNote = loan?.created_by
    ? `Created by ${loan.created_by}${createdAtLabel ? ` on ${createdAtLabel}` : ""}`
    : createdAtLabel
    ? `Created on ${createdAtLabel}`
    : "";
  const agingDays = typeof loan?.aging_days === "number" ? loan.aging_days : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex">
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-gray-900"
          onClick={onClose}
        />
        <motion.aside
          key="drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{loanTitle}</h2>
              {createdAtLabel && (
                <p className="text-xs text-gray-500">Created on {createdAtLabel}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            {loading ? (
              <p className="text-sm text-gray-500">Loading loan details…</p>
            ) : loan ? (
              <div className="space-y-4">
                {agingDays !== null && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                    Aging: {agingDays} day{agingDays === 1 ? "" : "s"} in {loan.status}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-gray-600" htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {statusOptions.length === 0 && <option value="">No statuses configured</option>}
                      {statusOptions.map((status) => (
                        <option key={status.id} value={status.name}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-gray-600" htmlFor="bank_id">
                      Bank
                    </label>
                    <select
                      id="bank_id"
                      name="bank_id"
                      value={form.bank_id}
                      onChange={handleBankSelect}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        value={form.bank_name}
                        onChange={handleChange}
                        placeholder="Bank name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-gray-600" htmlFor="applied_amount">
                      Applied amount
                    </label>
                    <input
                      id="applied_amount"
                      name="applied_amount"
                      value={form.applied_amount}
                      onChange={handleChange}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-gray-600" htmlFor="approved_amount">
                      Approved amount
                    </label>
                    <input
                      id="approved_amount"
                      name="approved_amount"
                      value={form.approved_amount}
                      onChange={handleChange}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="font-medium text-gray-600" htmlFor="rate_of_interest">
                      Rate of interest (%)
                    </label>
                    <input
                      id="rate_of_interest"
                      name="rate_of_interest"
                      value={form.rate_of_interest}
                      onChange={handleChange}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-sm">
                  <label className="font-medium text-gray-600" htmlFor="notes">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loan not found.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3">
            <p className="text-xs text-gray-500">{footerNote}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="inline-flex h-10 items-center justify-center rounded-full bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
