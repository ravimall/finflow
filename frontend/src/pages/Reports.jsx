import { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { api } from "../lib/api.js";

const PAGE_SIZE = 20;

function LoanStatusChip({ status, agingDays }) {
  if (!status) return null;
  const label = status;
  return (
    <span
      className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700"
      title={`Aging: ${agingDays ?? 0} days`}
    >
      {label}
    </span>
  );
}

function AgingBadge({ days }) {
  return (
    <span className="text-xs font-medium text-gray-500">Aging: {Number.isFinite(days) ? days : 0} days</span>
  );
}

export default function Reports() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [customerStatus, setCustomerStatus] = useState("");
  const [loanStatus, setLoanStatus] = useState("");

  const fetchReports = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/api/reports/customers", {
          params: {
            page: nextPage,
            limit: PAGE_SIZE,
            search: search || undefined,
            customer_status: customerStatus || undefined,
            loan_status: loanStatus || undefined,
          },
        });
        setRows(Array.isArray(response.data?.data) ? response.data.data : []);
        const total = response.data?.pagination?.total_pages || 1;
        setTotalPages(total);
        setPage(nextPage);
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Unable to load reports";
        setError(message);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [customerStatus, loanStatus, search]
  );

  useEffect(() => {
    fetchReports(1);
  }, [fetchReports]);

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchReports(1);
  };

  const tableContent = useMemo(() => {
    if (loading) {
      return (
        <tbody>
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
              Loading data…
            </td>
          </tr>
        </tbody>
      );
    }

    if (error) {
      return (
        <tbody>
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center text-sm text-red-600">
              {error}
            </td>
          </tr>
        </tbody>
      );
    }

    if (!rows.length) {
      return (
        <tbody>
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
              No matching records.
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr key={`${row.customer_id}-${row.loan_id}`} className="transition hover:bg-blue-50/50">
            <td className="px-4 py-3 text-sm text-gray-900">
              <div className="font-semibold">{row.customer_name}</div>
              <div className="font-mono text-xs uppercase tracking-wide text-gray-500">{row.customer_code}</div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-700">{row.customer_status || "—"}</td>
            <td className="px-4 py-3 text-sm text-gray-700">
              <div className="flex flex-col gap-1">
                <LoanStatusChip status={row.loan_status} agingDays={row.loan_aging_days} />
                <AgingBadge days={row.loan_aging_days} />
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-700">{row.bank_name || "—"}</td>
            <td className="px-4 py-3 text-right text-xs font-medium text-gray-500">
              Updated {new Date(row.updated_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    );
  }, [error, loading, rows]);

  const mobileContent = useMemo(() => {
    if (loading) {
      return (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          Loading data…
        </p>
      );
    }

    if (error) {
      return (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p>
      );
    }

    if (!rows.length) {
      return (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          No matching records.
        </p>
      );
    }

    return rows.map((row) => (
      <article key={`${row.customer_id}-${row.loan_id}`} className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <header>
          <h3 className="text-base font-semibold text-gray-900">{row.customer_name}</h3>
          <p className="font-mono text-xs uppercase tracking-wide text-gray-500">{row.customer_code}</p>
        </header>
        <dl className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <dt className="font-medium text-gray-500">Customer status</dt>
            <dd>{row.customer_status || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-gray-500">Loan status</dt>
            <dd>
              <div className="flex flex-col items-end gap-1">
                <LoanStatusChip status={row.loan_status} agingDays={row.loan_aging_days} />
                <AgingBadge days={row.loan_aging_days} />
              </div>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-gray-500">Bank</dt>
            <dd>{row.bank_name || "—"}</dd>
          </div>
        </dl>
      </article>
    ));
  }, [error, loading, rows]);

  const disablePrev = page <= 1;
  const disableNext = page >= totalPages;

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-gray-900">Loan Aging Report</h1>
        <p className="text-sm text-gray-600 md:text-base">
          Track customer loans with stage aging to prioritise follow-ups.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
          <FiSearch aria-hidden="true" className="text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer or ID"
            className="flex-1 border-none bg-transparent text-sm text-gray-700 focus:outline-none"
          />
        </label>
        <select
          value={customerStatus}
          onChange={(event) => setCustomerStatus(event.target.value)}
          className="rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All customer statuses</option>
          <option value="Booking">Booking</option>
          <option value="In Progress">In Progress</option>
          <option value="Closed">Closed</option>
        </select>
        <select
          value={loanStatus}
          onChange={(event) => setLoanStatus(event.target.value)}
          className="rounded-full border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All loan statuses</option>
          <option value="Login">Login</option>
          <option value="Sanctioned">Sanctioned</option>
          <option value="Disbursed">Disbursed</option>
          <option value="Rejected">Rejected</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Apply
        </button>
      </form>

      <section className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Customer status</th>
                <th className="px-4 py-3">Loan status</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3 text-right">Updated</th>
              </tr>
            </thead>
            {tableContent}
          </table>
        </div>
      </section>

      <section className="space-y-3 md:hidden">{mobileContent}</section>

      <footer className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchReports(page - 1)}
            disabled={disablePrev || loading}
            className="rounded-full border border-gray-200 px-3 py-1 font-medium transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => fetchReports(page + 1)}
            disabled={disableNext || loading}
            className="rounded-full border border-gray-200 px-3 py-1 font-medium transition hover:border-blue-300 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
