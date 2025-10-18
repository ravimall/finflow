import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import DashboardCard from "../components/DashboardCard.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";

const ACTIVE_TASK_STATUSES = ["pending", "waiting", "in_progress", "blocked"];

function resolveErrorMessage(error) {
  if (isAxiosError(error)) {
    return (
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      ""
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "";
}

function getColorForStatus(status) {
  switch (status) {
    case "Booking":
      return "bg-yellow-100 text-yellow-700";
    case "Sanctioned":
      return "bg-blue-100 text-blue-700";
    case "Disbursed":
      return "bg-green-100 text-green-700";
    case "Rejected":
      return "bg-red-100 text-red-700";
    case "Login":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const [customerStats, setCustomerStats] = useState([]);
  const [loanStats, setLoanStats] = useState([]);
  const [tasksDueToday, setTasksDueToday] = useState(0);
  const [loading, setLoading] = useState({
    customers: true,
    loans: true,
    tasks: true,
  });
  const [errors, setErrors] = useState({
    customers: "",
    loans: "",
    tasks: "",
  });

  useEffect(() => {
    let isActive = true;

    async function loadCustomers() {
      setLoading((prev) => ({ ...prev, customers: true }));
      setErrors((prev) => ({ ...prev, customers: "" }));
      try {
        const response = await api.get("/api/reports/customers-by-status");
        if (!isActive) return;
        const list = Array.isArray(response.data) ? response.data : [];
        setCustomerStats(
          list.map((item) => ({
            status: item.status || "Unknown",
            total: Number(item.total) || 0,
          }))
        );
      } catch (error) {
        if (!isActive) return;
        const fallback = "Unable to load customer summary";
        const detail = resolveErrorMessage(error);
        const message = detail ? `${fallback}: ${detail}` : fallback;
        setErrors((prev) => ({ ...prev, customers: message }));
        showToast("error", message);
        setCustomerStats([]);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, customers: false }));
        }
      }
    }

    async function loadLoans() {
      setLoading((prev) => ({ ...prev, loans: true }));
      setErrors((prev) => ({ ...prev, loans: "" }));
      try {
        const response = await api.get("/api/reports/loans-by-status");
        if (!isActive) return;
        const list = Array.isArray(response.data) ? response.data : [];
        setLoanStats(
          list.map((item) => ({
            status: item.status || "Unknown",
            total: Number(item.total) || 0,
          }))
        );
      } catch (error) {
        if (!isActive) return;
        const fallback = "Unable to load loan summary";
        const detail = resolveErrorMessage(error);
        const message = detail ? `${fallback}: ${detail}` : fallback;
        setErrors((prev) => ({ ...prev, loans: message }));
        showToast("error", message);
        setLoanStats([]);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, loans: false }));
        }
      }
    }

    async function loadTasks() {
      setLoading((prev) => ({ ...prev, tasks: true }));
      setErrors((prev) => ({ ...prev, tasks: "" }));
      try {
        const today = new Date().toISOString().slice(0, 10);
        const response = await api.get("/api/tasks", {
          params: {
            page_size: 1,
            due_from: today,
            due_to: today,
            status: ACTIVE_TASK_STATUSES.join(","),
          },
        });
        if (!isActive) return;
        const total = Number(response.data?.total ?? 0);
        setTasksDueToday(Number.isNaN(total) ? 0 : total);
      } catch (error) {
        if (!isActive) return;
        const fallback = "Unable to load task summary";
        const detail = resolveErrorMessage(error);
        const message = detail ? `${fallback}: ${detail}` : fallback;
        setErrors((prev) => ({ ...prev, tasks: message }));
        showToast("error", message);
        setTasksDueToday(0);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, tasks: false }));
        }
      }
    }

    loadCustomers();
    loadLoans();
    loadTasks();

    return () => {
      isActive = false;
    };
  }, [showToast]);

  return (
    <div className="p-4">
      <div className="mx-auto flex w-full max-w-screen-md flex-col gap-4">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Dashboard</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Keep tabs on your daily activity and jump straight into the right workspace.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DashboardCard title="Customers by Status" loading={loading.customers}>
            {errors.customers ? (
              <p className="text-sm text-red-500">{errors.customers}</p>
            ) : customerStats.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {customerStats.map((item) => (
                  <li
                    key={item.status}
                    className="flex items-center justify-between py-1"
                  >
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getColorForStatus(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {numberFormatter.format(item.total)}
                    </span>
                  </li>
                ))}
                <li className="mt-1 flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-800">
                    {numberFormatter.format(
                      customerStats.reduce((sum, item) => sum + item.total, 0)
                    )}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No data available.</p>
            )}
          </DashboardCard>

          <DashboardCard title="Loans by Status" loading={loading.loans}>
            {errors.loans ? (
              <p className="text-sm text-red-500">{errors.loans}</p>
            ) : loanStats.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {loanStats.map((item) => (
                  <li
                    key={item.status}
                    className="flex items-center justify-between py-1"
                  >
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getColorForStatus(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {numberFormatter.format(item.total)}
                    </span>
                  </li>
                ))}
                <li className="mt-1 flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-800">
                    {numberFormatter.format(
                      loanStats.reduce((sum, item) => sum + item.total, 0)
                    )}
                  </span>
                </li>
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No data available.</p>
            )}
          </DashboardCard>

          <DashboardCard title="Tasks Due Today" loading={loading.tasks}>
            {errors.tasks ? (
              <p className="text-sm text-red-500">{errors.tasks}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-3xl font-semibold text-gray-900">
                  {numberFormatter.format(tasksDueToday)}
                </span>
                <p className="text-sm text-gray-500">
                  Tasks scheduled for completion today across all customers.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/tasks")}
                  className="inline-flex w-max items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  View Tasks
                </button>
              </div>
            )}
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
