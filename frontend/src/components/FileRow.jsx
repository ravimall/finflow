import { useEffect, useState } from "react";
import {
  FiCheck,
  FiDownload,
  FiEdit2,
  FiEye,
  FiFile,
  FiTrash2,
  FiX,
} from "react-icons/fi";

export default function FileRow({
  file,
  isSelected,
  onSelect,
  viewMode,
  showUploader,
  onPreview,
  onDownload,
  onDelete,
  onStartRename,
  onRename,
  onCancelRename,
  isRenaming,
  isStriped,
}) {
  const [draftName, setDraftName] = useState(file.file_name || "");
  const [renameError, setRenameError] = useState("");
  const [submittingRename, setSubmittingRename] = useState(false);

  useEffect(() => {
    if (isRenaming) {
      setDraftName(file.file_name || "");
      setRenameError("");
    }
  }, [file.file_name, isRenaming]);

  const handleRenameSubmit = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setRenameError("Name is required");
      return;
    }
    setSubmittingRename(true);
    try {
      await onRename(trimmed);
      setRenameError("");
    } catch (error) {
      const message = error.response?.data?.error || error.message || "Unable to rename file";
      setRenameError(message);
    } finally {
      setSubmittingRename(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameSubmit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  const rowClassName = `${
    isSelected ? "bg-blue-50" : isStriped ? "bg-gray-50" : "bg-white"
  } hover:bg-gray-100 transition`;

  const fileTypeLabel = resolveFileType(file.mime_type, file.file_name);
  const fileSizeLabel = formatBytes(file.size_bytes);
  const modifiedLabel = formatDate(file.updated_at || file.created_at);
  const uploaderLabel = file.uploader?.name || file.uploader?.email || "—";

  return (
    <tr className={rowClassName} onDoubleClick={onPreview}>
      <td className="w-12 px-4 py-4 align-top">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={isSelected}
          onChange={onSelect}
          aria-label={`Select ${file.file_name}`}
        />
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-gray-500">
            <FiFile className="h-5 w-5" />
          </div>
          <div className="flex-1">
            {isRenaming ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={submittingRename}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRenameSubmit}
                    disabled={submittingRename}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    <FiCheck className="h-4 w-4" />
                    <span className="sr-only">Save name</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRename}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 transition hover:bg-gray-100"
                  >
                    <FiX className="h-4 w-4" />
                    <span className="sr-only">Cancel rename</span>
                  </button>
                </div>
                {renameError && <p className="text-xs text-red-500">{renameError}</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="truncate text-sm font-medium text-gray-900" title={file.file_name}>
                  {file.file_name}
                </p>
                {viewMode === "details" && (
                  <p className="text-xs text-gray-500">
                    {fileTypeLabel}
                    {file.mime_type ? ` · ${file.mime_type}` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-top text-sm text-gray-600">{fileTypeLabel}</td>
      <td className="px-4 py-4 align-top text-sm text-gray-600">{fileSizeLabel}</td>
      {showUploader && (
        <td className="px-4 py-4 align-top text-sm text-gray-600">{uploaderLabel}</td>
      )}
      <td className="px-4 py-4 align-top text-sm text-gray-600">{modifiedLabel}</td>
      <td className="px-4 py-4 align-top">
        {isRenaming ? null : (
          <div className="flex items-center justify-end gap-2">
            <RowActionButton onClick={onPreview} icon={<FiEye className="h-4 w-4" />} label="Preview" />
            <RowActionButton
              onClick={onDownload}
              icon={<FiDownload className="h-4 w-4" />}
              label="Download"
            />
            <RowActionButton
              onClick={() => onStartRename(file.id)}
              icon={<FiEdit2 className="h-4 w-4" />}
              label="Rename"
            />
            <RowActionButton
              onClick={onDelete}
              icon={<FiTrash2 className="h-4 w-4" />}
              label="Delete"
              variant="danger"
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function RowActionButton({ onClick, icon, label, variant = "default" }) {
  const baseClasses =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border text-gray-600 transition";
  const variantClasses =
    variant === "danger"
      ? "border-red-200 text-red-600 hover:border-red-400 hover:text-red-700"
      : "border-gray-300 hover:border-blue-500 hover:text-blue-600";
  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${variantClasses}`} title={label}>
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function resolveFileType(mime, name) {
  if (mime) {
    if (mime.includes("pdf")) return "PDF";
    if (mime.startsWith("image/")) return "Image";
    if (mime.includes("spreadsheet")) return "Spreadsheet";
    if (mime.includes("presentation")) return "Presentation";
    if (mime.includes("wordprocessing")) return "Document";
  }
  if (!name) return "File";
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return extension ? extension.toUpperCase() : "File";
}
