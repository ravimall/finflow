
import { useEffect, useState, useContext } from "react";
import { api, authHeaders } from "../lib/api.js";
import { AuthContext } from "../context/AuthContext";

export default function AuditLogs() {
  const { token } = useContext(AuthContext);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api
      .get("/api/reports/audit-logs", { headers: authHeaders(token) })
      .then((res) => setLogs(res.data))
      .catch((err) => console.error(err));
  }, [token]);

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-600 md:text-base">
          Review recent activity across FinFlow. This feed updates automatically.
        </p>
      </header>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="transition hover:bg-blue-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 md:text-sm">{log.created_at}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.user_id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {logs.map((log) => (
          <article key={log.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">{log.action}</span>
              <time className="font-mono text-xs text-gray-500">{log.created_at}</time>
            </header>
            <dl className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <dt className="font-medium text-gray-500">User</dt>
                <dd className="text-right text-gray-700">{log.user_id}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Details</dt>
                <dd className="mt-1 text-gray-700">{log.details}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

