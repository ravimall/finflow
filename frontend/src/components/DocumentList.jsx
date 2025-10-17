import PropTypes from "prop-types";

function statusChipClasses(status) {
  const normalized = (status || "pending").toLowerCase();
  if (normalized === "ok" || normalized === "ready") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "failed") {
    return "bg-red-100 text-red-700";
  }
  return "bg-yellow-100 text-yellow-700";
}

export default function DocumentList({
  path,
  status,
  message,
  onOpenExplorer,
  onRetry,
  retrying,
}) {
  return (
    <div className="space-y-2">
      <div className="p-3 mb-2 rounded-lg bg-white text-sm shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-gray-900">Dropbox Folder</p>
            <p className="text-xs text-gray-500">{path || "Folder will be created when you upload."}</p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusChipClasses(status)}`}
          >
            {status || "Pending"}
          </span>
        </div>
        {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenExplorer}
            className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            View Documents
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry provisioning"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

DocumentList.propTypes = {
  path: PropTypes.string,
  status: PropTypes.string,
  message: PropTypes.string,
  onOpenExplorer: PropTypes.func.isRequired,
  onRetry: PropTypes.func,
  retrying: PropTypes.bool,
};

DocumentList.defaultProps = {
  path: "",
  status: "pending",
  message: "",
  onRetry: undefined,
  retrying: false,
};
