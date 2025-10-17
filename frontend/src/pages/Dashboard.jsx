import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import DashboardCard from "../components/DashboardCard.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";

const ACTIVE_TASK_STATUSES = ["pending", "waiting", "in_progress", "blocked"];
const INACTIVE_LOAN_KEYWORDS = ["close", "cancel", "reject", "complete", "settle", "foreclose", "decline"];

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(value, range) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date >= range.start && date <= range.end;
}

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

function isLoanStatusActive(status) {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return !INACTIVE_LOAN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const [metrics, setMetrics] = useState({
    customersAddedToday: 0,
    activeLoans: 0,
    tasksDueToday: 0,
    documentsUploadedThisWeek: 0,
  });
  const [loading, setLoading] = useState({
    customers: true,
    loans: true,
    tasks: true,
    documents: true,
  });
  const [errors, setErrors] = useState({
    customers: false,
    loans: false,
    tasks: false,
    documents: false,
  });

  useEffect(() => {
    let isActive = true;

    async function loadCustomers() {
      setLoading((prev) => ({ ...prev, customers: true }));
      setErrors((prev) => ({ ...prev, customers: false }));
      try {
        const response = await api.get("/api/customers");
        if (!isActive) return;
        const list = Array.isArray(response.data) ? response.data : [];
        const todayRange = getTodayRange();
        const count = list.filter((customer) =>
          isDateInRange(customer.created_at || customer.createdAt, todayRange)
        ).length;
        setMetrics((prev) => ({ ...prev, customersAddedToday: count }));
      } catch (error) {
        if (!isActive) return;
        setErrors((prev) => ({ ...prev, customers: true }));
        const fallback = "Unable to load customer summary";
        const detail = resolveErrorMessage(error);
        showToast("error", detail ? `${fallback}: ${detail}` : fallback);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, customers: false }));
        }
      }
    }

    async function loadLoans() {
      setLoading((prev) => ({ ...prev, loans: true }));
      setErrors((prev) => ({ ...prev, loans: false }));
      try {
        let activeCount = 0;
        try {
          const response = await api.get("/api/reports/loans-by-status");
          const entries = Array.isArray(response.data) ? response.data : [];
          activeCount = entries
            .filter((entry) => isLoanStatusActive(entry.status))
            .reduce((total, entry) => total + Number(entry.total || 0), 0);
        } catch (error) {
          if (error?.response?.status === 403 || error?.response?.status === 404) {
            const response = await api.get("/api/loans");
            const loans = Array.isArray(response.data) ? response.data : [];
            activeCount = loans.filter((loan) => isLoanStatusActive(loan.status)).length;
          } else {
            throw error;
          }
        }

        if (!isActive) return;
        setMetrics((prev) => ({ ...prev, activeLoans: activeCount }));
      } catch (error) {
        if (!isActive) return;
        setErrors((prev) => ({ ...prev, loans: true }));
        const fallback = "Unable to load loan summary";
        const detail = resolveErrorMessage(error);
        showToast("error", detail ? `${fallback}: ${detail}` : fallback);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, loans: false }));
        }
      }
    }

    async function loadTasks() {
      setLoading((prev) => ({ ...prev, tasks: true }));
      setErrors((prev) => ({ ...prev, tasks: false }));
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
        setMetrics((prev) => ({ ...prev, tasksDueToday: Number.isNaN(total) ? 0 : total }));
      } catch (error) {
        if (!isActive) return;
        setErrors((prev) => ({ ...prev, tasks: true }));
        const fallback = "Unable to load task summary";
        const detail = resolveErrorMessage(error);
        showToast("error", detail ? `${fallback}: ${detail}` : fallback);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, tasks: false }));
        }
      }
    }

    async function loadDocuments() {
      setLoading((prev) => ({ ...prev, documents: true }));
      setErrors((prev) => ({ ...prev, documents: false }));
      try {
        const response = await api.get("/api/documents");
        if (!isActive) return;
        const list = Array.isArray(response.data) ? response.data : [];
        const weekRange = getWeekRange();
        const count = list.filter((document) =>
          isDateInRange(document.created_at || document.createdAt, weekRange)
        ).length;
        setMetrics((prev) => ({ ...prev, documentsUploadedThisWeek: count }));
      } catch (error) {
        if (!isActive) return;
        setErrors((prev) => ({ ...prev, documents: true }));
        const fallback = "Unable to load document summary";
        const detail = resolveErrorMessage(error);
        showToast("error", detail ? `${fallback}: ${detail}` : fallback);
      } finally {
        if (isActive) {
          setLoading((prev) => ({ ...prev, documents: false }));
        }
      }
    }

    loadCustomers();
    loadLoans();
    loadTasks();
    loadDocuments();

    return () => {
      isActive = false;
    };
  }, [showToast]);

  const cards = useMemo(
    () => [
      {
        key: "customers",
        title: "Customers Added Today",
        metricKey: "customersAddedToday",
        icon: "👤",
        color: "bg-blue-100 text-blue-700",
        to: "/customers",
      },
      {
        key: "loans",
        title: "Active Loans",
        metricKey: "activeLoans",
        icon: "💰",
        color: "bg-green-100 text-green-700",
        to: "/loans",
      },
      {
        key: "tasks",
        title: "Tasks Due Today",
        metricKey: "tasksDueToday",
        icon: "📅",
        color: "bg-yellow-100 text-yellow-700",
        to: "/tasks",
      },
      {
        key: "documents",
        title: "Documents Uploaded This Week",
        metricKey: "documentsUploadedThisWeek",
        icon: "📄",
        color: "bg-purple-100 text-purple-700",
        to: "/documents",
      },
    ],
    []
  );

  const getCardValue = (card) => {
    if (loading[card.key]) return "…";
    if (errors[card.key]) return "—";
    return numberFormatter.format(metrics[card.metricKey] || 0);
  };

  return (
    <div className="p-4">
      <div className="mx-auto flex w-full max-w-screen-md flex-col gap-4">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Dashboard</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Keep tabs on your daily activity and jump straight into the right workspace.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => navigate(card.to)}
              aria-label={card.title}
              className="group w-full rounded-xl text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <DashboardCard
                title={card.title}
                value={getCardValue(card)}
                icon={card.icon}
                color={`${card.color} group-hover:-translate-y-0.5 group-hover:shadow-md`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
