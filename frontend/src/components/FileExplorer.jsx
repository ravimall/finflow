import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiArrowDown,
  FiArrowUp,
  FiArchive,
  FiCheckSquare,
  FiChevronLeft,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFile,
  FiFileText,
  FiFolder,
  FiImage,
  FiList,
  FiPlusCircle,
  FiRefreshCw,
  FiTrash2,
  FiUpload,
  FiX,
} from "react-icons/fi";
import {
  fetchCustomerDropboxDocuments,
  createCustomerDropboxFolder,
  uploadCustomerDocuments,
  createDropboxSubfolder,
  deleteDropboxFiles,
  renameDropboxFile,
  getDropboxDownloadLink,
  getDropboxPreviewLink,
} from "../services/documents";

const INITIAL_UPLOAD_STATE = [];

export default function FileExplorer({ customerId }) {
  const [files, setFiles] = useState([]);
  const [folderExists, setFolderExists] = useState(false);
  const [rootPath, setRootPath] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [uploads, setUploads] = useState(INITIAL_UPLOAD_STATE);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLink, setPreviewLink] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [sortState, setSortState] = useState({ key: "name", direction: "asc" });

  const fileInputRef = useRef(null);
  const rootPathRef = useRef(null);
  const currentPathRef = useRef(null);
  const previewPathRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const resetState = useCallback(() => {
    setFiles([]);
    setFolderExists(false);
    setRootPath(null);
    setCurrentPath(null);
    rootPathRef.current = null;
    currentPathRef.current = null;
    setSelectedFiles([]);
    setPreviewLink(null);
    setPreviewLoading(false);
    setShowPreview(false);
    setUploads(INITIAL_UPLOAD_STATE);
  }, []);

  const fetchFiles = useCallback(
    async ({ path, refresh = false } = {}) => {
      if (!customerId) {
        resetState();
        return;
      }

      setError("");
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = path ? { path } : undefined;
        const fallbackPath = path || currentPathRef.current || rootPathRef.current;
        const result = await fetchCustomerDropboxDocuments(customerId, params);
        const effectivePath = path || result.path || fallbackPath;
        setFiles(Array.isArray(result.files) ? result.files : []);
        setFolderExists(Boolean(result.exists));
        if (result.path && !rootPathRef.current) {
          setRootPath(result.path);
          rootPathRef.current = result.path;
        }
        if (effectivePath) {
          setCurrentPath(effectivePath);
          currentPathRef.current = effectivePath;
        }
        setSelectedFiles([]);
        setPreviewLink(null);
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Unable to load files";
        setError(message);
        showToast("error", message);
        setFiles([]);
        setFolderExists(false);
        setCurrentPath(null);
        currentPathRef.current = null;
      } finally {
        if (refresh) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [customerId, resetState, showToast]
  );

  useEffect(() => {
    resetState();
    if (customerId) {
      fetchFiles();
    }
  }, [customerId, fetchFiles, resetState]);

  const handleCreateRootFolder = useCallback(async () => {
    if (!customerId) return;
    setIsCreatingFolder(true);
    try {
      const result = await createCustomerDropboxFolder(customerId);
      showToast("success", result?.message || "Dropbox folder created");
      await fetchFiles();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to create folder";
      showToast("error", message);
    } finally {
      setIsCreatingFolder(false);
    }
  }, [customerId, fetchFiles, showToast]);

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

  const handleUpload = useCallback(
    async (fileList) => {
      const filesToUpload = Array.from(fileList || []);
      if (!customerId || filesToUpload.length === 0) {
        return;
      }

      if (!folderExists) {
        showToast("error", "Create the Dropbox folder before uploading files.");
        return;
      }

      const entries = filesToUpload.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "pending",
        error: null,
      }));

      setUploads((prev) => [...entries, ...prev]);

      let encounteredError = false;
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const file = filesToUpload[index];
        const entry = entries[index];
        updateUpload(entry.id, { status: "uploading", progress: 0, error: null });

        try {
          await uploadCustomerDocuments(customerId, [file], {
            path: currentPath || rootPath,
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
          showToast("error", message);
          encounteredError = true;
        }
      }

      await fetchFiles({ refresh: true, path: currentPath || rootPath });
      if (!encounteredError) {
        showToast("success", "Upload complete");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [customerId, currentPath, fetchFiles, folderExists, rootPath, showToast, updateUpload]
  );

  const handleFileInputChange = useCallback(
    (event) => {
      handleUpload(event.target.files);
      event.target.value = "";
    },
    [handleUpload]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (!event.dataTransfer?.files?.length) {
        return;
      }
      handleUpload(event.dataTransfer.files);
    },
    [handleUpload]
  );

  const toggleSelection = useCallback((filePath) => {
    setSelectedFiles((prev) =>
      prev.includes(filePath)
        ? prev.filter((path) => path !== filePath)
        : [...prev, filePath]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (!sortedFiles.length) {
      setSelectedFiles([]);
      return;
    }
    const allPaths = sortedFiles.map((file) => file.path);
    const allSelected = allPaths.every((path) => selectedFiles.includes(path));
    setSelectedFiles(allSelected ? [] : allPaths);
  }, [selectedFiles, sortedFiles]);

  const navigateToFolder = useCallback(
    (path) => {
      if (!path) return;
      fetchFiles({ path });
    },
    [fetchFiles]
  );

  const handleBack = useCallback(() => {
    if (!currentPath || !rootPath || currentPath === rootPath) {
      return;
    }
    const segments = currentPath.split("/").filter(Boolean);
    const rootSegments = rootPath.split("/").filter(Boolean);
    if (segments.length <= rootSegments.length) {
      fetchFiles({ path: rootPath });
      return;
    }
    const parentSegments = segments.slice(0, segments.length - 1);
    const parentPath = `/${parentSegments.join("/")}`;
    fetchFiles({ path: parentPath });
  }, [currentPath, fetchFiles, rootPath]);

  const handleRename = useCallback(
    async (pathOverride) => {
      const targetPath = pathOverride || selectedFiles[0];
      if (!targetPath) {
        showToast("error", "Select a single item to rename.");
        return;
      }
      if (!pathOverride && selectedFiles.length !== 1) {
        showToast("error", "Select a single item to rename.");
        return;
      }

      const targetFile = files.find((file) => file.path === targetPath);
      const currentName = targetFile?.name || "";
      const newName = window.prompt("Enter a new name", currentName);
      if (!newName || newName === currentName) {
        return;
      }
      try {
        await renameDropboxFile(targetPath, newName);
        showToast("success", "Item renamed");
        await fetchFiles({ refresh: true, path: currentPath || rootPath });
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Rename failed";
        showToast("error", message);
      }
    },
    [currentPath, files, fetchFiles, rootPath, selectedFiles, showToast]
  );

  const handleDeleteSelected = useCallback(
    async (pathsOverride) => {
      const targets = Array.isArray(pathsOverride) && pathsOverride.length > 0 ? pathsOverride : selectedFiles;
      if (!targets.length) {
        showToast("error", "Select files or folders to delete.");
        return;
      }
      const confirmationMessage =
        targets.length === 1
          ? "Are you sure you want to delete this item?"
          : `Are you sure you want to delete ${targets.length} items?`;
      if (!window.confirm(confirmationMessage)) {
        return;
      }
      try {
        await deleteDropboxFiles(targets);
        showToast("success", "Selected items deleted");
        await fetchFiles({ refresh: true, path: currentPath || rootPath });
        setSelectedFiles((prev) => prev.filter((path) => !targets.includes(path)));
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Delete failed";
        showToast("error", message);
      }
    },
    [currentPath, fetchFiles, rootPath, selectedFiles, showToast]
  );

  const handleNewFolder = useCallback(async () => {
    if (!customerId) return;
    const folderName = window.prompt("New folder name");
    if (!folderName) return;
    try {
      await createDropboxSubfolder(customerId, folderName, currentPath || rootPath);
      showToast("success", "Folder created");
      await fetchFiles({ refresh: true, path: currentPath || rootPath });
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to create folder";
      showToast("error", message);
    }
  }, [currentPath, customerId, fetchFiles, rootPath, showToast]);

  const handleDownload = useCallback(async (path) => {
    try {
      const { url } = await getDropboxDownloadLink(path);
      if (url) {
        window.open(url, "_blank", "noopener");
        showToast("success", "Download link opened");
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Download failed";
      showToast("error", message);
    }
  }, [showToast]);

  const fetchPreviewLinkForPath = useCallback(
    async (path, { showError = true } = {}) => {
      if (!path) return;
      setPreviewLoading(true);
      try {
        const { preview_url: previewUrl } = await getDropboxPreviewLink(path);
        if (previewUrl) {
          setPreviewLink(previewUrl);
        } else {
          setPreviewLink(null);
          if (showError) {
            showToast("error", "Preview unavailable for this item");
          }
        }
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Preview unavailable";
        setPreviewLink(null);
        if (showError) {
          showToast("error", message);
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [showToast]
  );

  const handlePreview = useCallback(
    async (path) => {
      const nextPath = path || selectedFiles[0];
      if (!nextPath) {
        showToast("error", "Select a file to preview.");
        return;
      }
      const targetFile = files.find((file) => file.path === nextPath && !file.is_folder);
      if (!targetFile) {
        showToast("error", "Preview is available for files only.");
        return;
      }
      setSelectedFiles([nextPath]);
      setShowPreview(true);
      setPreviewLink(null);
      previewPathRef.current = nextPath;
      await fetchPreviewLinkForPath(nextPath);
    },
    [fetchPreviewLinkForPath, files, selectedFiles, showToast]
  );

  const togglePreviewPanel = useCallback(() => {
    setShowPreview((prev) => {
      const next = !prev;
      if (!next) {
        setPreviewLink(null);
        setPreviewLoading(false);
        previewPathRef.current = null;
      }
      return next;
    });
  }, []);

  const handleSort = useCallback((key) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const renderSortIcon = useCallback(
    (key) => {
      if (sortState.key !== key) return null;
      return sortState.direction === "asc" ? (
        <FiArrowUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <FiArrowDown className="h-3 w-3" aria-hidden="true" />
      );
    },
    [sortState]
  );

  const breadcrumbs = useMemo(() => {
    if (!rootPath || !currentPath) return [];
    const rootSegments = rootPath.split("/").filter(Boolean);
    const currentSegments = currentPath.split("/").filter(Boolean);
    const relativeSegments = currentSegments.slice(rootSegments.length);

    const crumbs = [
      {
        label: rootSegments[rootSegments.length - 1] || "Root",
        path: rootPath,
        isRoot: true,
      },
    ];

    relativeSegments.forEach((segment, index) => {
      const fullPath = `/${[...rootSegments, ...relativeSegments.slice(0, index + 1)].join("/")}`;
      crumbs.push({ label: segment, path: fullPath, isRoot: false });
    });

    return crumbs;
  }, [currentPath, rootPath]);

  const safeFiles = useMemo(() => {
    if (!Array.isArray(files)) {
      // eslint-disable-next-line no-console
      console.assert(Array.isArray(files), "Documents must be an array. Received:", files);
      return [];
    }
    return files;
  }, [files]);

  const sortedFiles = useMemo(() => {
    const data = [...safeFiles];
    const direction = sortState.direction === "asc" ? 1 : -1;
    const getComparable = (file) => {
      switch (sortState.key) {
        case "size":
          return file.size || 0;
        case "modified": {
          const value = Date.parse(file.client_modified || file.server_modified || 0);
          return Number.isNaN(value) ? 0 : value;
        }
        case "name":
        default:
          return (file.name || "").toLowerCase();
      }
    };

    data.sort((a, b) => {
      if (a.is_folder && !b.is_folder) return -1;
      if (!a.is_folder && b.is_folder) return 1;
      const aVal = getComparable(a);
      const bVal = getComparable(b);
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * direction;
      }
      if (aVal > bVal) return 1 * direction;
      if (aVal < bVal) return -1 * direction;
      return 0;
    });

    return data;
  }, [safeFiles, sortState]);

  const fileStats = useMemo(() => {
    const totalSize = safeFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    return {
      count: safeFiles.length,
      totalSize,
    };
  }, [safeFiles]);

  const uploadSummary = useMemo(() => {
    if (!uploads.length) {
      return {
        uploading: 0,
        completed: 0,
        failed: 0,
        averageProgress: 0,
      };
    }

    const uploading = uploads.filter((item) => item.status === "uploading");
    const failed = uploads.filter((item) => item.status === "error");
    const completed = uploads.filter((item) => item.status === "done");
    const averageProgress = uploading.length
      ? Math.round(
          uploading.reduce((sum, item) => sum + (item.progress || 0), 0) /
            uploading.length
        )
      : completed.length === uploads.length
      ? 100
      : 0;

    return {
      uploading: uploading.length,
      completed: completed.length,
      failed: failed.length,
      averageProgress,
    };
  }, [uploads]);

  const previewCandidate = useMemo(() => {
    if (!selectedFiles.length) return null;
    const candidates = selectedFiles
      .map((path) => safeFiles.find((file) => file.path === path))
      .filter(Boolean);
    return candidates.find((file) => !file.is_folder) || null;
  }, [safeFiles, selectedFiles]);

  const previewType = useMemo(() => {
    if (!previewCandidate?.name) return null;
    const extension = previewCandidate.name.includes(".")
      ? previewCandidate.name.split(".").pop().toLowerCase()
      : "";
    if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(extension)) {
      return "image";
    }
    if (extension === "pdf") {
      return "pdf";
    }
    return "other";
  }, [previewCandidate]);

  useEffect(() => {
    if (!showPreview) {
      setPreviewLink(null);
      setPreviewLoading(false);
      previewPathRef.current = null;
      return;
    }

    if (previewLoading) {
      return;
    }

    if (!previewCandidate) {
      setPreviewLink(null);
      previewPathRef.current = null;
      return;
    }

    if (previewPathRef.current !== previewCandidate.path || !previewLink) {
      previewPathRef.current = previewCandidate.path;
      setPreviewLink(null);
      fetchPreviewLinkForPath(previewCandidate.path, { showError: false });
    }
  }, [fetchPreviewLinkForPath, previewCandidate, previewLink, previewLoading, showPreview]);

  const formatBytes = useCallback((bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  const formatDate = useCallback((value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }, []);

  const getFileIcon = useCallback((file) => {
    if (file.is_folder) {
      return <FiFolder className="h-5 w-5 text-blue-500" aria-hidden="true" />;
    }

    const name = file.name || "";
    const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";

    if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(extension)) {
      return <FiImage className="h-5 w-5 text-indigo-500" aria-hidden="true" />;
    }

    if (["pdf", "doc", "docx", "txt"].includes(extension)) {
      return <FiFileText className="h-5 w-5 text-rose-500" aria-hidden="true" />;
    }

    if (["zip", "rar", "7z"].includes(extension)) {
      return <FiArchive className="h-5 w-5 text-amber-500" aria-hidden="true" />;
    }

    return <FiFile className="h-5 w-5 text-gray-500" aria-hidden="true" />;
  }, []);

  const isRoot = !currentPath || currentPath === rootPath;
  const isAllSelected =
    sortedFiles.length > 0 && sortedFiles.every((file) => selectedFiles.includes(file.path));
  const totalSelected = selectedFiles.length;
  const hasUploads = uploads.length > 0;
  const aggregatedProgress = uploadSummary.uploading > 0 ? uploadSummary.averageProgress : 0;
  const uploadIndicatorLabel = useMemo(() => {
    if (!hasUploads) return null;
    if (uploadSummary.uploading > 0) {
      return `Uploading ${uploadSummary.uploading} file${
        uploadSummary.uploading === 1 ? "" : "s"
      }…`;
    }
    if (uploadSummary.failed > 0) {
      return `${uploadSummary.failed} upload${uploadSummary.failed === 1 ? "" : "s"} failed`;
    }
    return `Uploaded ${uploadSummary.completed} file${
      uploadSummary.completed === 1 ? "" : "s"
    }`;
  }, [hasUploads, uploadSummary]);

  return (
    <div
      className="space-y-4"
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-md px-4 py-2 text-sm shadow-lg ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-white"
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              title="Dismiss notification"
              className="rounded-full bg-black/10 p-1 text-white transition hover:bg-black/20"
            >
              <FiX className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading files…</p>}

      {!folderExists && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center"
        >
          <FiFolder className="h-12 w-12 text-blue-500" aria-hidden="true" />
          <p className="text-sm text-gray-700">
            This customer does not have a Dropbox folder yet.
          </p>
          <button
            type="button"
            onClick={handleCreateRootFolder}
            disabled={isCreatingFolder}
            title="Create Dropbox folder"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiFolder className="h-4 w-4" aria-hidden="true" />
            {isCreatingFolder ? "Creating folder…" : "Create Dropbox Folder"}
          </button>
        </motion.div>
      )}

      {folderExists && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={isRoot}
                title="Go back one level"
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {breadcrumbs.map((crumb, index) => (
                  <motion.span
                    key={crumb.path}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => navigateToFolder(crumb.path)}
                      title={`Open ${crumb.label}`}
                      className={`transition ${
                        index === breadcrumbs.length - 1
                          ? "font-semibold text-gray-900"
                          : "text-blue-600 hover:underline"
                      }`}
                    >
                      {crumb.label}
                    </button>
                    {index < breadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/70 p-3 text-xs shadow-sm backdrop-blur-sm sm:text-sm">
            <div className="flex flex-wrap items-center gap-4 text-gray-700">
              <span className="flex items-center gap-2 font-medium">
                <FiList className="h-4 w-4" aria-hidden="true" />
                {fileStats.count} file{fileStats.count === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-2 text-gray-600">
                <FiCheckSquare className="h-4 w-4" aria-hidden="true" />
                {totalSelected} selected
              </span>
              <span className="text-gray-600">Total size: {formatBytes(fileStats.totalSize)}</span>
            </div>
            {hasUploads && uploadIndicatorLabel && (
              <div className="flex w-full flex-col gap-1 text-gray-600 sm:w-auto sm:flex-row sm:items-center">
                <span className="flex items-center gap-2">
                  <FiUpload className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  {uploadIndicatorLabel}
                </span>
                {uploadSummary.uploading > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 sm:w-40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${aggregatedProgress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full rounded-full bg-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload files"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <FiUpload className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Upload Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              onClick={handleNewFolder}
              title="Create a new folder"
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <FiPlusCircle className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              title="Delete selected items"
              disabled={totalSelected === 0}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-red-200 ${
                totalSelected === 0
                  ? "cursor-not-allowed border-gray-200 text-gray-400"
                  : "border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              <FiTrash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Delete Selected</span>
            </button>
            <button
              type="button"
              onClick={() => fetchFiles({ refresh: true, path: currentPath || rootPath })}
              title="Refresh folder"
              disabled={isRefreshing}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-gray-200 ${
                isRefreshing ? "cursor-wait opacity-70" : "hover:bg-gray-100"
              }`}
            >
              <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => handleRename()}
              title="Rename selected item"
              disabled={totalSelected !== 1}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-gray-200 ${
                totalSelected !== 1
                  ? "cursor-not-allowed text-gray-400"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FiEdit2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Rename</span>
            </button>
            <button
              type="button"
              onClick={togglePreviewPanel}
              title={showPreview ? "Hide preview panel" : "Show preview panel"}
              className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                showPreview
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <FiList className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Toggle Preview</span>
            </button>
          </div>

          <motion.div
            whileHover={{ scale: 1.01 }}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-700"
          >
            <FiUpload className="h-5 w-5" aria-hidden="true" />
            <span>Drag & drop files anywhere in this area to upload</span>
          </motion.div>

          {uploads.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Upload progress</h2>
              <ul className="space-y-2">
                {uploads.map((upload) => (
                  <motion.li
                    key={upload.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-gray-700">{upload.name}</span>
                      <span className="text-xs text-gray-500">{formatBytes(upload.size)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${upload.progress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          upload.status === "error"
                            ? "bg-red-400"
                            : upload.status === "done"
                            ? "bg-emerald-500"
                            : "bg-blue-500"
                        }`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {upload.status === "uploading" && `${upload.progress}% complete`}
                      {upload.status === "done" && "Upload complete"}
                      {upload.status === "error" && `Error: ${upload.error}`}
                    </p>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}

          <div
            className={`grid grid-cols-1 gap-4 ${
              showPreview ? "lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]" : "lg:grid-cols-1"
            }`}
          >
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" checked={isAllSelected} onChange={selectAll} title="Select all" />
                      </th>
                      <th className="w-12 px-3 py-3 text-left">Type</th>
                      <th className="px-3 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          title="Sort by name"
                          className="flex items-center gap-1 text-gray-600 transition hover:text-gray-900"
                        >
                          Name
                          {renderSortIcon("name")}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort("size")}
                          title="Sort by size"
                          className="flex items-center gap-1 text-gray-600 transition hover:text-gray-900"
                        >
                          Size
                          {renderSortIcon("size")}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort("modified")}
                          title="Sort by modified date"
                          className="flex items-center gap-1 text-gray-600 transition hover:text-gray-900"
                        >
                          Modified
                          {renderSortIcon("modified")}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedFiles.map((file) => {
                      const isSelected = selectedFiles.includes(file.path);
                      const rowClasses = isSelected
                        ? "bg-blue-50"
                        : "hover:bg-gray-50";
                      return (
                        <motion.tr
                          key={file.id || file.path}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={rowClasses}
                        >
                          <td className="px-3 py-3 align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(file.path)}
                              title={`Select ${file.name}`}
                            />
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className="inline-flex items-center justify-center rounded-full bg-gray-100 p-2">
                              {getFileIcon(file)}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <button
                              type="button"
                              onClick={() =>
                                file.is_folder ? navigateToFolder(file.path) : toggleSelection(file.path)
                              }
                              title={file.is_folder ? "Open folder" : "Select file"}
                              className={`flex w-full items-center gap-2 text-left transition ${
                                file.is_folder
                                  ? "text-blue-600 hover:underline"
                                  : "text-gray-800 hover:text-gray-900"
                              }`}
                            >
                              <span className="truncate">{file.name}</span>
                            </button>
                          </td>
                          <td className="px-3 py-3 align-middle text-gray-600">
                            {file.is_folder ? "—" : formatBytes(file.size)}
                          </td>
                          <td className="px-3 py-3 align-middle text-gray-600">
                            {formatDate(file.client_modified || file.server_modified)}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <div className="flex flex-wrap items-center gap-2">
                              {!file.is_folder && (
                                <button
                                  type="button"
                                  onClick={() => handlePreview(file.path)}
                                  title="Preview file"
                                  className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-blue-600 transition hover:bg-blue-50"
                                >
                                  <FiEye className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              {!file.is_folder && (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(file.path)}
                                  title="Download file"
                                  className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-blue-600 transition hover:bg-blue-50"
                                >
                                  <FiDownload className="h-4 w-4" aria-hidden="true" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRename(file.path)}
                                title="Rename item"
                                className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-600 transition hover:bg-gray-100"
                              >
                                <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSelected([file.path])}
                                title="Delete item"
                                className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-red-600 transition hover:bg-red-50"
                              >
                                <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                    {sortedFiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10">
                          <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
                            <motion.div
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50"
                            >
                              <FiFolder className="h-8 w-8 text-blue-400" aria-hidden="true" />
                            </motion.div>
                            <p className="font-medium text-gray-700">No files found</p>
                            <p className="text-xs text-gray-500">
                              Upload files or create a folder to get started.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <AnimatePresence>
              {showPreview && (
                <motion.aside
                  key="preview-panel"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                    <div className="flex items-center gap-2">
                      {previewCandidate && (
                        <button
                          type="button"
                          onClick={() => handleDownload(previewCandidate.path)}
                          title="Download previewed file"
                          className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-blue-600 transition hover:bg-blue-100"
                        >
                          <FiDownload className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={togglePreviewPanel}
                        title="Close preview panel"
                        className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 transition hover:bg-gray-200"
                      >
                        <FiX className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {!previewCandidate && (
                    <p className="text-sm text-gray-600">Select a file to preview its contents.</p>
                  )}
                  {previewCandidate && (
                    <div className="space-y-1 text-xs text-gray-600">
                      <p className="font-medium text-gray-800">{previewCandidate.name}</p>
                      <p>Size: {previewCandidate.size ? formatBytes(previewCandidate.size) : "—"}</p>
                      <p>
                        Modified: {formatDate(previewCandidate.client_modified || previewCandidate.server_modified)}
                      </p>
                    </div>
                  )}
                  {previewCandidate && previewLoading && (
                    <p className="text-xs text-gray-500">Loading preview…</p>
                  )}
                  {previewCandidate && !previewLoading && previewLink && previewType === "image" && (
                    <motion.img
                      key={previewLink}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={previewLink}
                      alt={previewCandidate.name}
                      className="max-h-72 w-full rounded border object-contain"
                    />
                  )}
                  {previewCandidate && !previewLoading && previewLink && previewType === "pdf" && (
                    <motion.iframe
                      key={previewLink}
                      title="Dropbox Preview"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={previewLink}
                      className="h-72 w-full rounded border"
                    />
                  )}
                  {previewCandidate && !previewLoading && previewType === "other" && (
                    <p className="text-xs text-gray-500">
                      Preview is not available for this file type. Use the download action to view the file.
                    </p>
                  )}
                  {previewCandidate && !previewLoading && !previewLink && previewType !== "other" && (
                    <p className="text-xs text-red-500">Preview could not be loaded.</p>
                  )}
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
