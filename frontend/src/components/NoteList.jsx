import PropTypes from "prop-types";

export default function NoteList({ notes, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p className="mb-2 font-medium">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!notes.length) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        No notes yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="p-3 mb-2 rounded-lg bg-white text-sm shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-gray-900">{note.author}</p>
              <p className="text-xs text-gray-500">{note.timestamp}</p>
            </div>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">Note</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}

NoteList.propTypes = {
  notes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      author: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
      body: PropTypes.string.isRequired,
    })
  ).isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

NoteList.defaultProps = {
  loading: false,
  error: "",
  onRetry: undefined,
};
