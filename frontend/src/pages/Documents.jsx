import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fetchCustomerDropboxDocuments } from "../services/documents";

export default function Documents() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [files, setFiles] = useState([]);
  const [folderPath, setFolderPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/customers")
      .then((res) => {
        setCustomers(res.data);
        if (res.data.length > 0) {
          setSelectedCustomer(String(res.data[0].id));
        }
      })
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError("");

    fetchCustomerDropboxDocuments(selectedCustomer)
      .then(({ entries, path }) => {
        setFiles(Array.isArray(entries) ? entries : []);
        setFolderPath(path);
      })
      .catch((err) => {
        const message = err.response?.data?.error || err.message || "Unable to load files";
        setError(message);
        setFiles([]);
        setFolderPath(null);
      })
      .finally(() => setLoading(false));
  }, [selectedCustomer]);

  const hasCustomers = customers.length > 0;
  const safeFiles = Array.isArray(files) ? files : [];
  if (!Array.isArray(files)) {
    // eslint-disable-next-line no-console
    console.assert(Array.isArray(files), "Documents must be an array. Received:", files);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between md:space-x-4 space-y-3 md:space-y-0">
        <h1 className="text-xl font-bold">Dropbox documents</h1>
        <select
          value={selectedCustomer}
          onChange={(event) => setSelectedCustomer(event.target.value)}
          className="border rounded p-2"
          disabled={!hasCustomers}
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.customer_id} — {customer.name}
            </option>
          ))}
          {!hasCustomers && <option value="">No customers available</option>}
        </select>
      </header>

      {!hasCustomers ? (
        <p className="text-sm text-gray-600">No customers available. Create a customer to browse Dropbox files.</p>
      ) : (
        <>
          {loading && <p className="text-sm text-gray-500">Loading files...</p>}
          {!loading && folderPath && (
            <p className="text-xs text-gray-500">Folder: {folderPath}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {safeFiles.length === 0 && !loading ? (
            <p className="text-sm text-gray-600">No files in Dropbox for this customer.</p>
          ) : (
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">File name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Size</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Modified</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {safeFiles.map((file) => (
                    <tr key={file.id}>
                      <td className="px-4 py-2">{file.name}</td>
                      <td className="px-4 py-2">{formatBytes(file.size)}</td>
                      <td className="px-4 py-2">{formatDate(file.client_modified || file.server_modified)}</td>
                      <td className="px-4 py-2">
                        {file.download_url ? (
                          <a
                            href={file.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
