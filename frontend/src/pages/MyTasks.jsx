import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiCheckCircle } from "react-icons/fi";
import { api } from "../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = new Date();
  const diffMs = date.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays === -1) return "Due yesterday";
  if (diffDays > 1) return `Due in ${diffDays} days`;
  return `${Math.abs(diffDays)} days overdue`;
}

export default function MyTasks() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/tasks/my", {
        params: { status: "pending", group_by: "customer" },
      });
      setGroups(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load tasks";
      setError(message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const markDone = async (taskId) => {
    if (!taskId) return;
    setUpdatingId(taskId);
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "completed" });
      setGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            tasks: group.tasks.filter((task) => task.id !== taskId),
          }))
          .filter((group) => group.tasks.length > 0)
      );
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to complete task";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Loading tasks…
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      );
    }

    if (!groups.length) {
      return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No pending tasks.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.customer_id} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate(`/customers/${group.customer_id}`)}
                className="text-left text-base font-semibold text-gray-900 transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {group.customer_name}
              </button>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                {group.tasks.length} task{group.tasks.length > 1 ? "s" : ""}
              </span>
            </header>
            <ul className="divide-y divide-gray-100">
              {group.tasks.map((task) => (
                <li key={task.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{formatRelative(task.due_on)}</span>
                      <span className="text-gray-400">•</span>
                      <span>Due {formatDate(task.due_on)}</span>
                      {task.remind_on && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <FiBell aria-hidden="true" />
                          Remind {formatDate(task.remind_on)}
                        </span>
                      )}
                    </div>
                    {task.notes ? (
                      <p className="text-xs text-gray-500">{task.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => markDone(task.id)}
                      disabled={updatingId === task.id}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <FiCheckCircle aria-hidden="true" />
                      Mark done
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }, [error, groups, loading, navigate, updatingId]);

  return (
    <div className="space-y-6 pb-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-600 md:text-base">
          All pending tasks assigned to you, grouped by customer.
        </p>
      </header>
      {content}
    </div>
  );
}
