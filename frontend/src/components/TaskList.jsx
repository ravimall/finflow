import PropTypes from "prop-types";
import { FiBell, FiCheckCircle, FiEdit3 } from "react-icons/fi";

function statusChipClasses(status) {
  if (!status) return "bg-gray-100 text-gray-600";
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "done") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "in-progress") {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-yellow-100 text-yellow-700";
}

export default function TaskList({
  tasks,
  loading,
  error,
  onRetry,
  onEdit,
  onComplete,
  completingTaskId,
  formatDate,
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
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

  if (!tasks.length) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        No tasks yet. Create one to kick things off.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const statusLabel = task.status || "Pending";
        return (
          <li key={task.id} className="p-3 mb-2 rounded-lg bg-white text-sm shadow-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-500">Created {formatDate(task.created_at)}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusChipClasses(
                    task.status
                  )}`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {task.due_on && <span>Due {formatDate(task.due_on)}</span>}
                {task.remind_on && (
                  <span className="inline-flex items-center gap-1 text-blue-600">
                    <FiBell className="h-4 w-4" aria-hidden="true" />
                    Remind {formatDate(task.remind_on)}
                  </span>
                )}
                {task.assignee && (
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    Assigned to {task.assignee.name || task.assignee.email}
                  </span>
                )}
              </div>
              {task.notes && (
                <p className="whitespace-pre-line text-xs text-gray-600">{task.notes}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {task.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(task)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                    >
                      <FiEdit3 className="h-4 w-4" aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onComplete(task.id)}
                      disabled={completingTaskId === task.id}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
                      {completingTaskId === task.id ? "Completing…" : "Mark done"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

TaskList.propTypes = {
  tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  onEdit: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
  completingTaskId: PropTypes.number,
  formatDate: PropTypes.func.isRequired,
};

TaskList.defaultProps = {
  loading: false,
  error: "",
  onRetry: undefined,
  completingTaskId: null,
};
