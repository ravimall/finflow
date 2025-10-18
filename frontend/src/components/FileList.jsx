import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import FileRow from "./FileRow.jsx";

const HEADERS = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "size", label: "Size" },
  { key: "uploadedBy", label: "Uploaded By" },
  { key: "modified", label: "Modified" },
];

export default function FileList({
  files,
  viewMode,
  selectedIds,
  onToggleFile,
  onToggleAll,
  sortField,
  sortOrder,
  onSortChange,
  onRename,
  onStartRename,
  renamingId,
  onPreview,
  onDownload,
  onDelete,
  loading = false,
  showUploader = false,
  emptyState = false,
  error = "",
}) {
  const allSelected = selectedIds.size > 0 && selectedIds.size === files.length;

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  onChange={onToggleAll}
                  checked={allSelected}
                  aria-label="Select all files"
                />
              </th>
              {HEADERS.map((header) => {
                if (!showUploader && header.key === "uploadedBy") {
                  return null;
                }
                return (
                  <th
                    key={header.key}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(header.key)}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-blue-600"
                    >
                      <span>{header.label}</span>
                      {sortField === header.key && (
                        sortOrder === "asc" ? (
                          <FiChevronUp className="h-4 w-4" />
                        ) : (
                          <FiChevronDown className="h-4 w-4" />
                        )
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading && (
              <SkeletonRows columnCount={showUploader ? 6 : 5} />
            )}

            {!loading && error && (
              <tr>
                <td colSpan={showUploader ? 7 : 6} className="px-4 py-6 text-center text-sm text-red-600">
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && emptyState && (
              <tr>
                <td colSpan={showUploader ? 7 : 6} className="px-4 py-6 text-center text-sm text-gray-500">
                  No files available for this customer.
                </td>
              </tr>
            )}

            {!loading && !error && !emptyState &&
              files.map((file, index) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isSelected={selectedIds.has(String(file.id))}
                  onSelect={() => onToggleFile(file.id)}
                  viewMode={viewMode}
                  showUploader={showUploader}
                  onPreview={() => onPreview(file)}
                  onDownload={() => onDownload(file)}
                  onDelete={() => onDelete(file)}
                  onStartRename={() => onStartRename(file.id)}
                  onRename={(name) => onRename(file, name)}
                  onCancelRename={() => onStartRename(null)}
                  isRenaming={renamingId !== null && String(renamingId) === String(file.id)}
                  isStriped={index % 2 === 1}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkeletonRows({ columnCount }) {
  const rows = Array.from({ length: 5 });
  return rows.map((_, index) => (
    <tr key={`skeleton-${index}`} className="animate-pulse">
      {Array.from({ length: columnCount + 1 }).map((__, cellIndex) => (
        <td key={`cell-${cellIndex}`} className="px-4 py-4">
          <div className="h-4 w-full rounded-full bg-gray-200" />
        </td>
      ))}
    </tr>
  ));
}
