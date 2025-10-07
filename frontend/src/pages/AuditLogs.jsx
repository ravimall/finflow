
import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

export default function AuditLogs() {
  const { token } = useContext(AuthContext);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    axios.get("https://shubhadevelopers.com/api/reports/audit-logs", { headers })
      .then(res => setLogs(res.data))
      .catch(err => console.error(err));
  }, [token]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Audit Logs (Admin)</h1>
      <table className="w-full table-auto border-collapse border">
        <thead>
          <tr>
            <th className="border p-2">Time</th>
            <th className="border p-2">User</th>
            <th className="border p-2">Action</th>
            <th className="border p-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td className="border p-2">{l.created_at}</td>
              <td className="border p-2">{l.user_id}</td>
              <td className="border p-2">{l.action}</td>
              <td className="border p-2">{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
