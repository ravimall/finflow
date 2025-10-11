import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  fetchCustomerDropboxDocuments,
  createCustomerDropboxFolder,
  uploadCustomerDocuments,
} from "../services/documents";

export default function Documents() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [files, setFiles] = useState([]);
  const [folderPath, setFolderPath] = useState(null);
  const [folderExists, setFolderExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/customers")
      .then((res) => {
        const sorted = Array.isArray(res.data) ? res.data : [];
        setCustomers(sorted);
        if (sorted.length > 0) {
          setSelectedCustomer(String(sorted[0].id));
        }
      })
      .catch(() => {
        setCustomers([]);
      });
  }, []);

  const loadFiles = useCallback(
    async (customerId, { markRefreshing = false } = {}) => {
      if (!customerId) {
        setFiles([]);
        setFolderPath(null);
        setFolderExists(false);
        return;
      }

      if (markRefreshing) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const result = await fetchCustomerDropboxDocuments(customerId);
        setFiles(Array.isArray(result.files) ? result.files : []);
        setFolderPath(result.path);
        setFolderExists(Boolean(result.exists));
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Unable to load files";
        setError(message);
        setFiles([]);
        setFolderPath(null);
        setFolderExists(false);
      } finally {
        if (markRefreshing) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedCustomer) {
      setFiles([]);
      setFolderPath(null);
      setFolderExists(false);
      return;
    }
    loadFiles(selectedCustomer);
  }, [selectedCustomer, loadFiles]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const updateUpload = useCallback((id, patch) => {
    setUploads((prev) =>
      prev.map((upload) =>
        upload.id === id
          ? {
              ...upload,
              ...(typeof patch === "function" ? patch(upload) : patch),
            }
          : upload
      )
    );
  }, []);

  const startUpload = useCallback(
    async (fileList) => {
      const fileArray = Array.from(fileList || []);
      if (!selectedCustomer || fileArray.length === 0) {
        return;
      }

      if (!folderExists) {
        setNotice({ type: "error", text: "Create the Dropbox folder before uploading files." });
        return;
      }

      const uploadEntries = fileArray.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "pending",
        error: null,
      }));

      setUploads((prev) => [...uploadEntries, ...prev]);

      let encounteredError = false;

      for (let index = 0; index < fileArray.length; index += 1) {
        const file = fileArray[index];
        const entry = uploadEntries[index];

        updateUpload(entry.id, { status: "uploading", progress: 0, error: null });

        try {
          await uploadCustomerDocuments(selectedCustomer, [file], {
            path: folderPath,
            onUploadProgress: (event) => {
              if (!event.total) return;
              const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
              updateUpload(entry.id, { progress: percent });
            },
          });

          updateUpload(entry.id, { status: "done", progress: 100 });
        } catch (err) {
          const message = err.response?.data?.error || err.message || "Upload failed";
          updateUpload(entry.id, { status: "error", error: message });
          setNotice({ type: "error", text: message });
          encounteredError = true;
        }
      }

      await loadFiles(selectedCustomer, { markRefreshing: true });
      if (!encounteredError) {
        setNotice({ type: "success", text: "Upload complete" });
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [folderExists, folderPath, loadFiles, selectedCustomer, updateUpload]
  );

  const handleFileInputChange = useCallback(
    (event) => {
      startUpload(event.target.files);
      event.target.value = "";
    },
    [startUpload]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setDragActive(false);
      if (!event.dataTransfer?.files?.length) {
        return;
      }
      startUpload(event.dataTransfer.files);
    },
    [startUpload]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!selectedCustomer) return;
    setIsCreatingFolder(true);
    try {
      const result = await createCustomerDropboxFolder(selectedCustomer);
      setNotice({ type: "success", text: result?.message || "Dropbox folder ready" });
      await loadFiles(selectedCustomer);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to create folder";
      setNotice({ type: "error", text: message });
    } finally {
      setIsCreatingFolder(false);
    }
  }, [loadFiles, selectedCustomer]);

  const handleRefresh = useCallback(() => {
    if (!selectedCustomer) return;
    loadFiles(selectedCustomer, { markRefreshing: true });
  }, [loadFiles, selectedCustomer]);

  const hasCustomers = customers.length > 0;
  const safeFiles = Array.isArray(files) ? files : [];
  if (!Array.isArray(files)) {
    // eslint-disable-next-line no-console
    console.assert(Array.isArray(files), "Documents must be an array. Received:", files);
  }

  const fileStats = useMemo(() => {
    const totalSize = safeFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    return {
      count: safeFiles.length,
      totalSize,
    };
  }, [safeFiles]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold">Dropbox documents</h1>
          {folderPath && (
            <p className="text-xs text-gray-500">Folder: {folderPath}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <select
            value={selectedCustomer}
            onChange={(event) => setSelectedCustomer(event.target.value)}
            className="border rounded p-2 min-w-[240px]"
            disabled={!hasCustomers}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customer_id} — {customer.name}
              </option>
            ))}
            {!hasCustomers && <option value="">No customers available</option>}
          </select>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!selectedCustomer || loading || isRefreshing}
            className="rounded border px-3 py-2 text-sm bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {!hasCustomers && (
        <p className="text-sm text-gray-600">
          No customers available. Create a customer to browse Dropbox files.
        </p>
      )}

      {notice && (
        <div
          className={`rounded border px-4 py-2 text-sm ${
            notice.type === "error" ? "border-red-300 bg-red-50 text-red-700" : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading files…</p>}

      {hasCustomers && !folderExists && !loading && (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center space-y-3">
          <p className="text-sm text-gray-700">
            This customer does not have a Dropbox folder yet.
          </p>
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={isCreatingFolder}
            className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isCreatingFolder ? "Creating folder…" : "Create Dropbox Folder"}
          </button>
        </div>
      )}

      {hasCustomers && folderExists && (
        <div className="space-y-6">
          <section>
            <div
              className={`relative rounded border-2 border-dashed p-6 text-center transition-colors ${
                dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <p className="text-sm text-gray-700">Drag & drop files here</p>
              <p className="text-xs text-gray-500">or</p>
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Browse files
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>
          </section>

          {uploads.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Upload progress</h2>
              <ul className="space-y-2">
                {uploads.map((upload) => (
                  <li
                    key={upload.id}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{upload.name}</span>
                      <span className="text-xs text-gray-500">{formatBytes(upload.size)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded bg-gray-100">
                      <div
                        className={`h-2 rounded ${
                          upload.status === "error"
                            ? "bg-red-400"
                            : upload.status === "done"
                            ? "bg-green-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {upload.status === "uploading" && `${upload.progress}%`}
                      {upload.status === "done" && "Upload complete"}
                      {upload.status === "error" && `Error: ${upload.error}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {fileStats.count} file{fileStats.count === 1 ? "" : "s"}
              </span>
              <span>Total size: {formatBytes(fileStats.totalSize)}</span>
            </div>

            {safeFiles.length === 0 ? (
              <p className="text-sm text-gray-600">No files in Dropbox for this customer.</p>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Size</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Modified</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {safeFiles.map((file) => (
                      <tr key={file.id || file.path}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span>{getFileIcon(file)}</span>
                            <div>
                              <p className="font-medium text-gray-800">{file.name}</p>
                              <p className="text-xs text-gray-500">{file.path}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">{file.is_folder ? "—" : formatBytes(file.size)}</td>
                        <td className="px-4 py-2">
                          {formatDate(file.client_modified || file.server_modified)}
                        </td>
                        <td className="px-4 py-2">
                          {file.is_folder ? (
                            <span className="text-gray-400">Folder</span>
                          ) : file.url ? (
                            <a
                              href={file.url}
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
          </section>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
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

function getFileIcon(file) {
  if (file.is_folder) return "📁";
  const name = file.name || "";
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  switch (extension) {
    case "pdf":
      return "📄";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return "🖼️";
    case "xls":
    case "xlsx":
      return "📊";
    case "doc":
    case "docx":
      return "📝";
    case "zip":
    case "rar":
      return "🗜️";
    default:
      return "📎";
  }
}
