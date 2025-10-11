import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoanForm from "../components/LoanForm";
import { api } from "../lib/api";

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
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Create loan</h2>
        <LoanForm onSuccess={fetchLoans} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Loans</h1>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        {loanRows.length === 0 && !loading ? (
          <p className="text-sm text-gray-600">No loans yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Customer</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Bank</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loanRows.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link to={`/loans/${loan.id}`} className="text-blue-600 hover:underline">
                        {loan.customerCode ? `${loan.customerCode} — ` : ""}
                        {loan.customerName || "View details"}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{loan.bank}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
