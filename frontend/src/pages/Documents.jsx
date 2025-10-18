import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FileExplorerHeader from "../components/FileExplorerHeader.jsx";
import FileList from "../components/FileList.jsx";
import PreviewPane from "../components/PreviewPane.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import {
  batchDownloadDocuments,
  bulkDeleteDocuments,
  deleteDocument,
  downloadDocument,
  fetchDocuments,
  previewDocument,
  renameDocument,
  uploadDocuments,
} from "../services/documents.js";

export default function Documents() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerError, setCustomerError] = useState("");

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");

  const [viewMode, setViewMode] = useState("list");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [uploadedByFilter, setUploadedByFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [renamingId, setRenamingId] = useState(null);

  const [uploadJobs, setUploadJobs] = useState([]);
  const uploadInputRef = useRef(null);
  const uploadTimeouts = useRef(new Map());

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  useEffect(() => () => {
    uploadTimeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
    uploadTimeouts.current.clear();
  }, []);

  useEffect(() => {
    setLoadingCustomers(true);
    setCustomerError("");
    api
      .get("/api/customers")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setCustomers(list);
        if (list.length > 0) {
          setSelectedCustomer(String(list[0].id));
        }
      })
      .catch((err) => {
        const message = err.response?.data?.error || err.message || "Unable to load customers";
        setCustomerError(message);
        setCustomers([]);
        showToast("error", message);
      })
      .finally(() => {
        setLoadingCustomers(false);
      });
  }, [showToast]);

  useEffect(() => {
    if (!customers.length) return;
    const params = new URLSearchParams(location.search);
    const queryId = params.get("customer_id");
    const fallbackId = String(customers[0].id);
    const hasQueryMatch = queryId && customers.some((customer) => String(customer.id) === queryId);

    if (hasQueryMatch) {
      if (selectedCustomer !== queryId) {
        setSelectedCustomer(queryId);
      }
      return;
    }

    if (!selectedCustomer || !customers.some((customer) => String(customer.id) === selectedCustomer)) {
      setSelectedCustomer(fallbackId);
      if (queryId !== fallbackId) {
        params.set("customer_id", fallbackId);
        const queryString = params.toString();
        navigate(`${location.pathname}${queryString ? `?${queryString}` : ""}`, { replace: true });
      }
    }
  }, [customers, location.pathname, location.search, navigate, selectedCustomer]);

  const selectedCustomerData = useMemo(
    () => customers.find((customer) => String(customer.id) === String(selectedCustomer)),
    [customers, selectedCustomer]
  );

  const fetchFiles = useCallback(async () => {
    if (!selectedCustomer) {
      setFiles([]);
      return [];
    }

    setFilesLoading(true);
    setFilesError("");
    try {
      const response = await fetchDocuments(selectedCustomer, {
        fileType: fileTypeFilter,
        uploadedBy: uploadedByFilter === "all" ? undefined : uploadedByFilter,
        sort: sortField,
        order: sortOrder,
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      setFiles(items);
      setSelectedIds(new Set());
      setRenamingId(null);
      return items;
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to load documents";
      setFiles([]);
      setFilesError(message);
      showToast("error", message);
      return [];
    } finally {
      setFilesLoading(false);
    }
  }, [fileTypeFilter, selectedCustomer, showToast, sortField, sortOrder, uploadedByFilter]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploaderOptions = useMemo(() => {
    const map = new Map();
    files.forEach((file) => {
      const uploader = file?.uploader;
      if (uploader?.id) {
        map.set(String(uploader.id), uploader);
      }
    });
    return Array.from(map.values());
  }, [files]);

  useEffect(() => {
    if (uploadedByFilter === "all") return;
    const exists = uploaderOptions.some((option) => String(option.id) === String(uploadedByFilter));
    if (!exists) {
      setUploadedByFilter("all");
    }
  }, [uploadedByFilter, uploaderOptions]);

  const hasCustomers = customers.length > 0;
  const hasFiles = files.length > 0;
  const selectedCount = selectedIds.size;

  const handleSelectionChange = (value) => {
    setSelectedCustomer(value);
    setSelectedIds(new Set());
    setRenamingId(null);
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set("customer_id", value);
    } else {
      params.delete("customer_id");
    }
    const queryString = params.toString();
    navigate(`${location.pathname}${queryString ? `?${queryString}` : ""}`, { replace: true });
  };

  const handleUploadClick = () => {
    if (!selectedCustomer) {
      showToast("error", "Select a customer before uploading files.");
      return;
    }
    uploadInputRef.current?.click();
  };

  const updateUploadJob = (jobId, updater) => {
    setUploadJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...updater(job) } : job))
    );
  };

  const removeUploadJob = (jobId) => {
    setUploadJobs((prev) => prev.filter((job) => job.id !== jobId));
    const timeout = uploadTimeouts.current.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      uploadTimeouts.current.delete(jobId);
    }
  };

  const handleUploadChange = (event) => {
    const fileList = Array.from(event.target.files || []);
    event.target.value = "";
    if (!fileList.length || !selectedCustomer) {
      return;
    }

    const uploadEntries = fileList.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      progress: 0,
      status: "pending",
      error: "",
      file,
    }));

    setUploadJobs((prev) => [...prev, ...uploadEntries]);

    (async () => {
      for (const entry of uploadEntries) {
        updateUploadJob(entry.id, () => ({ status: "uploading", progress: 0 }));
        try {
          await uploadDocuments(selectedCustomer, [entry.file], {
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              const progress = Math.min(
                100,
                Math.round((progressEvent.loaded / progressEvent.total) * 100)
              );
              updateUploadJob(entry.id, () => ({ progress }));
            },
          });
          showToast("success", `${entry.name} uploaded`);
          updateUploadJob(entry.id, () => ({ progress: 100, status: "success" }));
          const timeout = setTimeout(() => removeUploadJob(entry.id), 2500);
          uploadTimeouts.current.set(entry.id, timeout);
        } catch (error) {
          const message = error.response?.data?.error || error.message || "Upload failed";
          updateUploadJob(entry.id, () => ({ status: "error", error: message }));
          showToast("error", message);
        }
      }
      await fetchFiles();
    })();
  };

  const toggleFileSelection = (id) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size !== 1) {
        setRenamingId(null);
      }
      return next;
    });
  };

  const toggleAllFiles = () => {
    setSelectedIds((prev) => {
      if (prev.size === files.length) {
        return new Set();
      }
      const all = files.map((file) => String(file.id));
      return new Set(all);
    });
    setRenamingId(null);
  };

  const handleRename = async (file, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === file.file_name) {
      setRenamingId(null);
      return file;
    }
    try {
      const response = await renameDocument(file.id, trimmed);
      const updated = response?.file || {};
      setFiles((prev) =>
        prev.map((item) => (String(item.id) === String(file.id) ? { ...item, ...updated } : item))
      );
      setRenamingId(null);
      showToast("success", "File renamed");
      return updated;
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to rename file";
      showToast("error", message);
      throw error;
    }
  };

  const handleDelete = async (ids) => {
    const idListRaw = Array.isArray(ids) ? ids : [ids];
    const idList = idListRaw
      .map((value) => {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      })
      .filter((value) => value !== null && value !== undefined);
    if (!idList.length) return;

    const confirmed = window.confirm(
      idList.length === 1
        ? "Delete this file permanently?"
        : `Delete ${idList.length} files permanently?`
    );
    if (!confirmed) return;

    try {
      const keySet = new Set(idList.map((value) => String(value)));

      if (idList.length === 1) {
        await deleteDocument(idList[0]);
        showToast("success", "File deleted");
      } else {
        const result = await bulkDeleteDocuments(idList);
        const deletedCount = result?.deleted || 0;
        const failureCount = Array.isArray(result?.failures) ? result.failures.length : 0;
        if (deletedCount) {
          showToast("success", `Deleted ${deletedCount} file${deletedCount > 1 ? "s" : ""}`);
        }
        if (failureCount) {
          showToast("error", `${failureCount} file${failureCount > 1 ? "s" : ""} could not be deleted`);
        }
      }
      setFiles((prev) => prev.filter((file) => !keySet.has(String(file.id))));
      setSelectedIds(new Set());
      setRenamingId(null);
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to delete files";
      showToast("error", message);
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await downloadDocument(file.id);
      const url = response?.url;
      if (!url) {
        showToast("error", "Download link unavailable");
        return;
      }
      triggerBrowserDownload(url, file.file_name);
      showToast("success", "Download started");
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to download file";
      showToast("error", message);
    }
  };

  const handleBatchDownload = async (ids) => {
    const idList = (Array.isArray(ids) ? ids : [ids]).map((value) => {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    });
    if (!idList.length) return;
    try {
      if (idList.length === 1) {
        const target = files.find((file) => String(file.id) === String(idList[0]));
        if (target) {
          await handleDownload(target);
        }
        return;
      }

      const response = await batchDownloadDocuments(idList);
      const links = Array.isArray(response?.links) ? response.links : [];
      if (!links.length) {
        showToast("error", "No download links generated");
        return;
      }
      links.forEach((entry, index) => {
        const delay = index * 150;
        setTimeout(() => {
          const fileName = entry?.file?.file_name || files.find((file) => String(file.id) === String(entry.id))?.file_name;
          if (entry?.url) {
            triggerBrowserDownload(entry.url, fileName);
          }
        }, delay);
      });
      showToast("success", `Started downloads for ${links.length} files`);
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to start downloads";
      showToast("error", message);
    }
  };

  const handlePreview = async (file) => {
    setPreviewFile(file);
    setPreviewVisible(true);
    setPreviewUrl("");
    setPreviewLoading(true);
    try {
      const response = await previewDocument(file.id);
      setPreviewUrl(response?.preview_url || "");
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Preview unavailable";
      showToast("error", message);
      setPreviewUrl("");
    } finally {
      setPreviewLoading(false);
    }
  };

  const clearPreview = () => {
    setPreviewVisible(false);
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewLoading(false);
  };

  const uploaderFilterOptions = useMemo(() => {
    if (!isAdmin) return [];
    return uploaderOptions
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, uploaderOptions]);

  return (
    <div className="space-y-6 pb-6">
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleUploadChange}
      />

      <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">
            Documents{selectedCustomerData ? ` — ${selectedCustomerData.name}` : ""}
          </h1>
          <p className="text-sm text-gray-500 md:text-base">
            Browse and manage customer files in a familiar explorer view.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500 sm:hidden" htmlFor="customer-picker">
            Select customer
          </label>
          <select
            id="customer-picker"
            value={selectedCustomer}
            onChange={(event) => handleSelectionChange(event.target.value)}
            className="h-11 w-full rounded-full border border-gray-300 bg-white px-4 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[240px]"
            disabled={!hasCustomers || loadingCustomers}
          >
            {hasCustomers ? (
              customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_id} — {customer.name}
                </option>
              ))
            ) : (
              <option value="">No customers available</option>
            )}
          </select>
        </div>
      </header>

      {loadingCustomers && <p className="text-sm text-gray-500">Loading customers…</p>}
      {customerError && <p className="text-sm text-red-600">{customerError}</p>}

      {!hasCustomers && !loadingCustomers && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 md:text-base">
          No customers available. Create a customer to browse Dropbox files.
        </p>
      )}

      {uploadJobs.length > 0 && (
        <div className="space-y-3">
          {uploadJobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                <span className="truncate" title={job.name}>
                  {job.name}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {job.status === "uploading" && "Uploading"}
                  {job.status === "success" && "Uploaded"}
                  {job.status === "error" && "Failed"}
                  {job.status === "pending" && "Queued"}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full transition-all ${
                    job.status === "error"
                      ? "bg-red-500"
                      : job.status === "success"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              {job.status === "error" && job.error && (
                <p className="mt-2 text-xs text-red-500">{job.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {hasCustomers && selectedCustomer && (
        <div
          className={`grid gap-4 ${
            previewVisible ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]" : "lg:grid-cols-1"
          }`}
        >
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
              <FileExplorerHeader
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onUploadClick={handleUploadClick}
                fileTypeFilter={fileTypeFilter}
                onFileTypeFilterChange={setFileTypeFilter}
                uploadedByFilter={uploadedByFilter}
                onUploadedByFilterChange={setUploadedByFilter}
                sortField={sortField}
                sortOrder={sortOrder}
                onSortChange={(field, order) => {
                  setSortField(field);
                  setSortOrder(order);
                }}
                isAdmin={isAdmin}
                uploadedByOptions={uploaderFilterOptions}
                disableUpload={!selectedCustomer}
              />
            </div>

            {selectedCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 sm:px-6">
                <span className="font-medium">{selectedCount} selected</span>
                <div className="h-4 w-px bg-gray-300" />
                {selectedCount === 1 && (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-500 hover:text-blue-600"
                      onClick={() => setRenamingId(Array.from(selectedIds)[0])}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-500 hover:text-blue-600"
                      onClick={() => {
                        const id = Array.from(selectedIds)[0];
                        const target = files.find((file) => String(file.id) === String(id));
                        if (target) {
                          handlePreview(target);
                        }
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-500 hover:text-blue-600"
                      onClick={() => handleBatchDownload(Array.from(selectedIds))}
                    >
                      Download
                    </button>
                  </>
                )}
                {selectedCount > 1 && (
                  <button
                    type="button"
                    className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-500 hover:text-blue-600"
                    onClick={() => handleBatchDownload(Array.from(selectedIds))}
                  >
                    Download ({selectedCount})
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:border-red-400 hover:text-red-700"
                  onClick={() => handleDelete(Array.from(selectedIds))}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-700"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setRenamingId(null);
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            <FileList
              files={files}
              viewMode={viewMode}
              selectedIds={selectedIds}
              onToggleFile={toggleFileSelection}
              onToggleAll={toggleAllFiles}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortChange={(field) => {
                if (sortField === field) {
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                } else {
                  setSortField(field);
                  setSortOrder("asc");
                }
              }}
              onRename={handleRename}
              onStartRename={setRenamingId}
              renamingId={renamingId}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={(file) => handleDelete([file.id])}
              loading={filesLoading}
              showUploader={isAdmin}
              emptyState={!filesLoading && !hasFiles}
              error={filesError}
            />
          </div>

          <PreviewPane
            visible={previewVisible}
            file={previewFile}
            previewUrl={previewUrl}
            loading={previewLoading}
            onClose={clearPreview}
            onDownload={previewFile ? () => handleDownload(previewFile) : null}
          />
        </div>
      )}
    </div>
  );
}

function triggerBrowserDownload(url, fileName) {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (fileName) {
    anchor.download = fileName;
  }
  anchor.rel = "noopener";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
