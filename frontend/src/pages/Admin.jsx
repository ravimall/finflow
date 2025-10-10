import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Admin() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    api
      .get("/api/users")
      .then((r) => setAgents(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      {/* <p>Assign agents to customers</p> */}
    </div>
  );
}

