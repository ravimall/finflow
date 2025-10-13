import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import { api } from "../lib/api.js";

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(() => {
    setLoading(true);
    api
      .get("/api/loans")
      .then((res) => setLoans(res.data))
      .catch(() => setLoans([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const loanRows = useMemo(
    () =>
      loans.map((loan) => ({
        id: loan.id,
        status: loan.status,
        bank: loan.bank?.name || loan.bank_name,
        customerName: loan.customer?.name,
        customerCode: loan.customer?.customer_id,
      })),
    [loans]
  );

  return (
    <div className="space-y-10 pb-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">Create loan</h2>
            <p className="text-sm text-gray-500 md:text-base">
              Capture loan requests quickly and keep customers moving.
            </p>
          </div>
          {loading && <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Refreshing…</span>}
        </header>
        <LoanForm onSuccess={fetchLoans} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Loans</h1>
          {loading && <span className="text-sm text-gray-500">Loading loans…</span>}
        </div>

        {loanRows.length === 0 && !loading ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 md:text-base">
            No loans yet. Create the first loan using the form above.
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Bank</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loanRows.map((loan) => (
                      <tr key={loan.id} className="transition hover:bg-blue-50/60">
                        <td className="px-4 py-3">
                          <Link to={`/loans/${loan.id}`} className="font-medium text-blue-600 hover:underline">
                            {loan.customerCode ? `${loan.customerCode} — ` : ""}
                            {loan.customerName || "View details"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{loan.bank}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {loanRows.map((loan) => (
                <article key={loan.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {loan.customerName || "Loan"}
                      </h3>
                      {loan.customerCode && (
                        <p className="font-mono text-xs uppercase tracking-wide text-gray-500">{loan.customerCode}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {loan.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">Bank: <span className="font-medium text-gray-800">{loan.bank}</span></p>
                  <Link
                    to={`/loans/${loan.id}`}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    View loan
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
