
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
    api.get("/api/reports/customers-by-status", { headers })
      .then(res => setCustomerStats(res.data))
      .catch(err => console.error(err));

    api.get("/api/reports/loans-by-status", { headers })
      .then(res => setLoanStats(res.data))
      .catch(err => console.error(err));

    api.get("/api/reports/agent-performance", { headers })
      .then(res => setAgents(res.data))
      .catch(err => console.error(err));
  }, [token]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Reports (Admin)</h1>
      <h2 className="text-lg font-semibold mt-6">Customers by Status</h2>
      <div className="mb-6">
        {/* simple textual fallback if charts not available */}
        {customerStats.map(c => <div key={c.status}>{c.status}: {c.total}</div>)}
      </div>
      <h2 className="text-lg font-semibold mt-6">Loans by Status</h2>
      <div className="mb-6">
        {loanStats.map(l => <div key={l.status}>{l.status}: {l.total}</div>)}
      </div>
      <h2 className="text-lg font-semibold mt-6">Agent Performance</h2>
      <table className="table-auto border-collapse border mt-4">
        <thead><tr><th className="border p-2">Agent</th><th className="border p-2">Customers Handled</th></tr></thead>
        <tbody>
          {agents.map(a => (
            <tr key={a.agent_id}>
              <td className="border p-2">{a.name}</td>
              <td className="border p-2">{a.customers_handled}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
