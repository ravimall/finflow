
import { useEffect, useState, useContext } from "react";
import { api, authHeaders } from "../lib/api.js";
// import { Bar } from "react-chartjs-2";
import { AuthContext } from "../context/AuthContext";

export default function Reports() {
  const { token } = useContext(AuthContext);
  const [customerStats, setCustomerStats] = useState([]);
  const [loanStats, setLoanStats] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const headers = authHeaders(token);
    api
      .get("/api/reports/customers-by-status", { headers })
      .then((res) => setCustomerStats(res.data))
      .catch((err) => console.error(err));

    api
      .get("/api/reports/loans-by-status", { headers })
      .then((res) => setLoanStats(res.data))
      .catch((err) => console.error(err));

    api
      .get("/api/reports/agent-performance", { headers })
      .then((res) => setAgents(res.data))
      .catch((err) => console.error(err));
  }, [token]);

  return (
    <div className="space-y-8 pb-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-600 md:text-base">
          Snapshot of performance metrics across customers, loans, and team members.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Customers by status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {customerStats.map((stat) => (
            <article key={stat.status} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">{stat.status}</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.total}</p>
            </article>
          ))}
          {customerStats.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No customer status data available yet.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Loans by status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {loanStats.map((stat) => (
            <article key={stat.status} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">{stat.status}</h3>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.total}</p>
            </article>
          ))}
          {loanStats.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No loan status data available yet.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-900">Agent performance</h2>
        <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Customers handled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agents.map((agent) => (
                  <tr key={agent.agent_id} className="transition hover:bg-blue-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{agent.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{agent.customers_handled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {agents.map((agent) => (
            <article key={agent.agent_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">{agent.name}</h3>
              <p className="mt-2 text-sm text-gray-600">
                Customers handled: <span className="font-medium text-gray-900">{agent.customers_handled}</span>
              </p>
            </article>
          ))}
          {agents.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No agent performance data available yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
