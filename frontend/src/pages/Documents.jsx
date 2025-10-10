import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Documents() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    api.get("/api/documents/customer/1")
      .then(res => setDocs(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Documents (Customer 1)</h1>
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            <a href={d.file_url} target="_blank" rel="noreferrer">{d.file_name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

