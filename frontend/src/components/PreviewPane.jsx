import { FiDownload, FiX } from "react-icons/fi";

export default function PreviewPane({
  visible,
  file,
  previewUrl,
  loading,
  onClose,
  onDownload,
}) {
  if (!visible || !file) {
    return null;
  }

  const isImage = file.mime_type?.startsWith("image/");
  const isPdf = file.mime_type?.includes("pdf");
  const canEmbed = Boolean(previewUrl) && (isImage || isPdf);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white p-4 shadow-xl md:static md:h-full md:max-h-[calc(100vh-2rem)] md:rounded-2xl md:border md:border-gray-200 md:p-6 md:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{file.file_name}</h2>
          <p className="text-xs text-gray-500">{formatBytes(file.size_bytes)}</p>
        </div>
        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-500 hover:text-blue-600"
            >
              <FiDownload className="h-4 w-4" />
              Download
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:bg-gray-100"
          >
            <FiX className="h-4 w-4" />
            <span className="sr-only">Close preview</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Loading preview…
          </div>
        ) : canEmbed ? (
          isImage ? (
            <img src={previewUrl} alt={file.file_name} className="h-full w-full object-contain" />
          ) : (
            <iframe
              title={`Preview of ${file.file_name}`}
              src={previewUrl}
              className="h-full w-full"
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-600">
            <p>Preview is not available for this file type.</p>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-blue-500 hover:text-blue-600"
              >
                <FiDownload className="h-4 w-4" />
                Download instead
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
        <Detail label="Type" value={resolveFileType(file.mime_type, file.file_name)} />
        <Detail label="Uploaded" value={formatDate(file.created_at)} />
        <Detail label="Modified" value={formatDate(file.updated_at || file.created_at)} />
        <Detail label="Uploaded By" value={file.uploader?.name || file.uploader?.email || "—"} />
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-700">{value || "—"}</p>
    </div>
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
