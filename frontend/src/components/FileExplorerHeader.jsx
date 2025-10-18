import { FiArrowDown, FiArrowUp, FiColumns, FiList, FiUpload } from "react-icons/fi";

export default function FileExplorerHeader({
  viewMode,
  onViewModeChange,
  onUploadClick,
  fileTypeFilter,
  onFileTypeFilterChange,
  uploadedByFilter,
  onUploadedByFilterChange,
  sortField,
  sortOrder,
  onSortChange,
  isAdmin,
  uploadedByOptions,
  disableUpload = false,
}) {
  const handleSortFieldChange = (event) => {
    onSortChange(event.target.value, sortOrder);
  };

  const toggleSortOrder = () => {
    const nextOrder = sortOrder === "asc" ? "desc" : "asc";
    onSortChange(sortField, nextOrder);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUploadClick}
          disabled={disableUpload}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <FiUpload className="h-4 w-4" />
          Upload
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="file-type-filter">
            File Type
          </label>
          <select
            id="file-type-filter"
            value={fileTypeFilter}
            onChange={(event) => onFileTypeFilterChange(event.target.value)}
            className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="word">Word</option>
          </select>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="uploaded-by-filter">
              Uploaded By
            </label>
            <select
              id="uploaded-by-filter"
              value={uploadedByFilter}
              onChange={(event) => onUploadedByFilterChange(event.target.value)}
              className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              {uploadedByOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="sort-field">
            Sort By
          </label>
          <select
            id="sort-field"
            value={sortField}
            onChange={handleSortFieldChange}
            className="h-9 rounded-full border border-gray-300 bg-white px-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Date</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="modifiedBy">Modified By</option>
          </select>
          <button
            type="button"
            onClick={toggleSortOrder}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:border-blue-500 hover:text-blue-600"
          >
            {sortOrder === "asc" ? <FiArrowUp className="h-4 w-4" /> : <FiArrowDown className="h-4 w-4" />}
            <span className="sr-only">Toggle sort order</span>
          </button>
        </div>

        <div className="flex items-center overflow-hidden rounded-full border border-gray-300 bg-gray-100">
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium transition ${
              viewMode === "list" ? "bg-white text-blue-600" : "text-gray-600"
            }`}
          >
            <FiList className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("details")}
            className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium transition ${
              viewMode === "details" ? "bg-white text-blue-600" : "text-gray-600"
            }`}
          >
            <FiColumns className="h-4 w-4" />
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
