import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isAxiosError } from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiFilter,
  FiLayers,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { createPortal } from "react-dom";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";

const DEFAULT_STATUS_SCOPE = ["pending", "waiting", "in_progress", "blocked"];
const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "waiting", label: "Waiting" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const GROUP_OPTIONS = [
  { value: "customer", label: "Group by customer" },
  { value: "agent", label: "Group by assignee" },
  { value: "status", label: "Group by status" },
  { value: "due_week", label: "Group by due week" },
  { value: "none", label: "No grouping" },
];
const SORT_OPTIONS = [
  { value: "due_date:asc", label: "Due date ↑" },
  { value: "due_date:desc", label: "Due date ↓" },
  { value: "priority:desc", label: "Priority" },
  { value: "status:asc", label: "Status" },
  { value: "agent:asc", label: "Assignee" },
  { value: "customer:asc", label: "Customer" },
  { value: "updated_at:desc", label: "Updated (newest)" },
  { value: "updated_at:asc", label: "Updated (oldest)" },
];
const COLUMN_OPTIONS = [
  { key: "risk", label: "Risk" },
  { key: "tags", label: "Tags" },
  { key: "updated", label: "Updated" },
];
const DESKTOP_ROW_HEIGHT = 44;
const MOBILE_ROW_HEIGHT = 76;
const VIRTUAL_OVERSCAN = 8;
const TASKS_API_MODE_KEY = "tasks:api-mode";

function loadTasksApiMode() {
  if (typeof window === "undefined") return "modern";
  try {
    const stored = window.localStorage.getItem(TASKS_API_MODE_KEY);
    if (stored === "legacy" || stored === "modern") {
      return stored;
    }
  } catch (err) {
    console.warn("Failed to load tasks API mode", err);
  }
  return "modern";
}

function persistTasksApiMode(mode) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "legacy" || mode === "modern") {
      window.localStorage.setItem(TASKS_API_MODE_KEY, mode);
    } else {
      window.localStorage.removeItem(TASKS_API_MODE_KEY);
    }
  } catch (err) {
    console.warn("Failed to persist tasks API mode", err);
  }
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function useVirtualRows(count, rowHeight, overscan, containerRef, deps = []) {
  const [range, setRange] = useState({
    start: 0,
    end: Math.min(count, overscan * 2 + 1),
    paddingTop: 0,
    paddingBottom: Math.max(0, (count - Math.min(count, overscan * 2 + 1)) * rowHeight),
  });

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const viewportHeight = container.clientHeight || rowHeight;
    const scrollTop = container.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visible = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(count, start + visible);
    const paddingTop = start * rowHeight;
    const paddingBottom = Math.max(0, (count - end) * rowHeight);
    setRange({ start, end, paddingTop, paddingBottom });
  }, [containerRef, count, overscan, rowHeight, ...deps]);

  useEffect(() => {
    update();
    const container = containerRef.current;
    if (!container) {
      return () => {};
    }
    const handler = () => update();
    container.addEventListener("scroll", handler);
    window.addEventListener("resize", handler);
    return () => {
      container.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [containerRef, update]);

  useEffect(() => {
    update();
  }, [update, count]);

  return range;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((start - today) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays === -1) return "Due yesterday";
  if (diffDays > 1) return `Due in ${diffDays} days`;
  return `${Math.abs(diffDays)} days overdue`;
}

function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLabel(status) {
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : status;
}

function statusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "waiting":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "blocked":
      return "bg-rose-50 text-rose-700 border border-rose-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "cancelled":
      return "bg-gray-100 text-gray-500 border border-gray-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

function priorityTone(priority) {
  switch (priority) {
    case "urgent":
      return { dot: "bg-rose-500", text: "text-rose-700" };
    case "high":
      return { dot: "bg-amber-500", text: "text-amber-700" };
    case "low":
      return { dot: "bg-slate-300", text: "text-slate-600" };
    default:
      return { dot: "bg-blue-500", text: "text-blue-700" };
  }
}

function getInitials(name, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function normalizeTaskFromApi(task) {
  if (!task) {
    return null;
  }
  const customer = task.customer || {};
  const assignee = task.assignee || {};
  const due = task.due_date || task.due_on || null;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: due,
    priority: task.priority || "medium",
    assigneeId: task.assignee_id ? String(task.assignee_id) : null,
    assigneeName: task.assignee_name || assignee.name || null,
    assigneeEmail: task.assignee_email || assignee.email || null,
    customerId:
      task.customer_id ? String(task.customer_id) : customer.id ? String(customer.id) : null,
    customerCode: task.customer_code || customer.customer_id || null,
    customerName: task.customer_name || customer.name || null,
    customerStatus: task.customer_status || customer.status || null,
    customerPrimaryAgentId:
      task.customer_primary_agent_id ||
      (customer.primary_agent_id ? String(customer.primary_agent_id) : null),
    customerPrimaryAgentName:
      task.customer_primary_agent_name || customer.primary_agent_name || null,
    riskFlags: Array.isArray(task.risk_flags)
      ? task.risk_flags
      : Array.isArray(task.riskFlags)
      ? task.riskFlags
      : [],
    tags: Array.isArray(task.tags) ? task.tags : [],
    updatedAt: task.updated_at || task.updatedAt || null,
    type: task.type || "task",
    overdue: Boolean(task.overdue),
    completedAt: task.completed_at || null,
    groupKey: task.group_key || null,
    notes: typeof task.notes === "string" ? task.notes : "",
  };
}

function adaptLegacyTasksResponse(payload, groupBy) {
  const items = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pushTask = (task, extras = {}) => {
    if (!task) return;
    const dueRaw = task.due_date || task.due_on || null;
    let overdue = false;
    if (dueRaw) {
      const dueDate = new Date(dueRaw);
      if (!Number.isNaN(dueDate.getTime())) {
        overdue = dueDate < today;
      }
    }
    const normalized = normalizeTaskFromApi({
      ...task,
      ...extras,
      overdue,
    });
    if (normalized) {
      items.push(normalized);
    }
  };

  if (groupBy === "customer" && Array.isArray(payload)) {
    payload.forEach((group) => {
      const groupKey = group.customer_id
        ? `customer:${group.customer_id}`
        : group.customer_name
        ? `customer:${group.customer_name}`
        : "customer:unknown";
      const tasks = Array.isArray(group.tasks) ? group.tasks : [];
      tasks.forEach((task) =>
        pushTask(task, {
          status: task.status || "pending",
          customer_id: group.customer_id,
          customer_name: group.customer_name,
          group_key: groupKey,
        })
      );
    });
  } else if (Array.isArray(payload)) {
    payload.forEach((task) => {
      pushTask(task, { status: task?.status || "pending" });
    });
  } else if (payload && Array.isArray(payload.items)) {
    payload.items.forEach((task) => {
      pushTask(task, { status: task?.status || "pending" });
    });
  }

  return { items };
}

function deriveLegacyGroups(items, groupBy) {
  if (!Array.isArray(items) || groupBy !== "customer") {
    return [];
  }
  const groups = new Map();
  items.forEach((item) => {
    const key = item.groupKey || (item.customerId ? `customer:${item.customerId}` : null);
    if (!key) {
      return;
    }
    const existing = groups.get(key) || {
      key,
      label: item.customerName || "Customer",
      count: 0,
      earliestDue: null,
    };
    existing.count += 1;
    if (item.dueDate) {
      const dueDate = new Date(item.dueDate);
      if (!Number.isNaN(dueDate.getTime())) {
        if (!existing.earliestDue || dueDate < existing.earliestDue) {
          existing.earliestDue = dueDate;
        }
      }
    }
    groups.set(key, existing);
  });

  return Array.from(groups.values())
    .sort((a, b) => {
      if (!a.earliestDue && !b.earliestDue) return 0;
      if (!a.earliestDue) return 1;
      if (!b.earliestDue) return -1;
      return a.earliestDue - b.earliestDue;
    })
    .map(({ earliestDue, ...rest }) => rest);
}
function loadSavedViews(userId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`tasks:saved:${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load saved views", err);
    return [];
  }
}

function persistSavedViews(userId, views) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`tasks:saved:${userId}`, JSON.stringify(views));
  } catch (err) {
    console.warn("Failed to persist saved views", err);
  }
}

function loadColumnVisibility(userId) {
  const defaults = { risk: true, tags: true, updated: true };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(`tasks:columns:${userId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...defaults, ...parsed };
    }
    return defaults;
  } catch (err) {
    console.warn("Failed to load column visibility", err);
    return defaults;
  }
}

function persistColumnVisibility(userId, visibility) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`tasks:columns:${userId}`, JSON.stringify(visibility));
  } catch (err) {
    console.warn("Failed to persist column visibility", err);
  }
}

function loadCollapsedGroups(userId, groupKey) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`tasks:collapsed:${userId}:${groupKey}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
    return new Set();
  } catch (err) {
    console.warn("Failed to load collapsed groups", err);
    return new Set();
  }
}

function persistCollapsedGroups(userId, groupKey, values) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`tasks:collapsed:${userId}:${groupKey}`, JSON.stringify(values));
  } catch (err) {
    console.warn("Failed to persist collapsed groups", err);
  }
}

function readBooleanParam(params, key, defaultValue) {
  if (!params.has(key)) return defaultValue;
  const value = params.get(key);
  if (value === null) return defaultValue;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseListParam(params, key) {
  const direct = params.getAll(key);
  if (direct && direct.length > 0) {
    return direct.flatMap((entry) =>
      entry
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    );
  }
  const single = params.get(key);
  if (!single) return [];
  return single
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getDefaultQuickFilters(isAdmin) {
  return {
    overdue: true,
    today: false,
    thisWeek: !isAdmin,
    unassigned: false,
    high: false,
    waiting: false,
  };
}

function titleCase(value) {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mergeUnique(list) {
  return Array.from(new Set(list));
}

function computeStatusFilter(quickFilters, statusList) {
  if (quickFilters.waiting) {
    return ["waiting"];
  }
  const input = Array.isArray(statusList) && statusList.length > 0 ? statusList : DEFAULT_STATUS_SCOPE;
  return mergeUnique(input);
}

function computePriorityFilter(quickFilters, priorityList) {
  const base = Array.isArray(priorityList) ? [...priorityList] : [];
  if (quickFilters.high) {
    if (!base.includes("high")) base.push("high");
    if (!base.includes("urgent")) base.push("urgent");
  }
  return mergeUnique(base);
}

function computeDueRange(quickFilters, dueFrom, dueTo) {
  if (quickFilters.today) {
    const today = new Date();
    const iso = today.toISOString().split("T")[0];
    return { from: iso, to: iso };
  }
  if (quickFilters.thisWeek) {
    const now = new Date();
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day + 6) % 7; // Monday start
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const from = start.toISOString().split("T")[0];
    const to = end.toISOString().split("T")[0];
    if (quickFilters.overdue && !dueFrom && !dueTo) {
      return { from: null, to };
    }
    return { from, to };
  }
  return {
    from: dueFrom || null,
    to: dueTo || null,
  };
}

function formatDueState(task, todayStr) {
  if (!task.dueDate) {
    return { label: "No due date", tone: "text-slate-500" };
  }
  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return { label: task.dueDate, tone: "text-slate-600" };
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - now) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) {
    return { label: formatRelativeDate(task.dueDate), tone: "text-rose-600" };
  }
  if (diffDays === 0) {
    return { label: "Due today", tone: "text-amber-600" };
  }
  return { label: formatRelativeDate(task.dueDate), tone: "text-slate-600" };
}

function bulkSuccessMessage(action, count) {
  const plural = count === 1 ? "task" : "tasks";
  switch (action) {
    case "mark_done":
      return `Marked ${count} ${plural} as done`;
    case "reassign":
      return `Reassigned ${count} ${plural}`;
    case "set_due":
      return `Updated due date for ${count} ${plural}`;
    case "set_status":
      return `Updated status for ${count} ${plural}`;
    case "add_tag":
      return `Tagged ${count} ${plural}`;
    case "remove_tag":
      return `Updated tags for ${count} ${plural}`;
    case "delete":
      return `Deleted ${count} ${plural}`;
    default:
      return `Updated ${count} ${plural}`;
  }
}
export default function MyTasks() {
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === "admin";
  const userId = user?.id ? String(user.id) : "anonymous";

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const listener = (event) => setIsDesktop(event.matches);
    listener(mediaQuery);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const initialParamsRef = useRef(null);
  if (initialParamsRef.current === null) {
    initialParamsRef.current = new URLSearchParams(searchParams);
  }
  const initialParams = initialParamsRef.current;

  const initialGroupBy = (() => {
    const value = initialParams.get("group_by");
    if (value && GROUP_OPTIONS.some((option) => option.value === value)) {
      return value;
    }
    return "customer";
  })();

  const initialSort = (() => {
    const value = initialParams.get("sort");
    if (value && SORT_OPTIONS.some((option) => option.value === value)) {
      return value;
    }
    return "due_date:asc";
  })();

  const initialPage = Math.max(parseInt(initialParams.get("page"), 10) || 1, 1);
  const initialPageSize = Math.min(
    Math.max(parseInt(initialParams.get("page_size"), 10) || 100, 10),
    500
  );

  const initialStatuses = parseListParam(initialParams, "status");
  const initialPriorities = parseListParam(initialParams, "priority");
  const initialTags = parseListParam(initialParams, "tags");
  const initialCustomerIds = parseListParam(initialParams, "customer_id");
  const initialAgentIds = parseListParam(initialParams, "agent_id");

  const quickDefaults = getDefaultQuickFilters(isAdmin);
  const initialQuickFilters = {
    overdue: readBooleanParam(initialParams, "overdue_only", quickDefaults.overdue),
    today: readBooleanParam(initialParams, "today", quickDefaults.today),
    thisWeek: readBooleanParam(initialParams, "this_week", quickDefaults.thisWeek),
    unassigned: readBooleanParam(initialParams, "unassigned", quickDefaults.unassigned),
    high: readBooleanParam(initialParams, "high", quickDefaults.high),
    waiting: readBooleanParam(initialParams, "waiting", quickDefaults.waiting),
  };

  const initialScopeModeRaw = initialParams.get("scope_mode") || (isAdmin ? "all" : "portfolio");
  const normalizedScopeMode =
    initialScopeModeRaw === "agent" || initialScopeModeRaw === "by_agent"
      ? "agent"
      : initialScopeModeRaw === "customer" || initialScopeModeRaw === "by_customer"
      ? "customer"
      : isAdmin
      ? "all"
      : "portfolio";
  const initialScopeIds = parseListParam(initialParams, "scope_id");
  const initialScopeSelection = initialScopeIds.length > 0 ? initialScopeIds[0] : null;

  const [searchTerm, setSearchTerm] = useState(initialParams.get("q") || "");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const [groupBy, setGroupBy] = useState(initialGroupBy);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [quickFilters, setQuickFilters] = useState(initialQuickFilters);
  const [filters, setFilters] = useState({
    status: initialStatuses.length > 0 ? mergeUnique(initialStatuses) : DEFAULT_STATUS_SCOPE,
    priority: mergeUnique(initialPriorities),
    dueFrom: initialParams.get("due_from") || null,
    dueTo: initialParams.get("due_to") || null,
    tags: mergeUnique(initialTags),
    customerIds: mergeUnique(initialCustomerIds),
    agentIds: mergeUnique(initialAgentIds),
    riskOnly: readBooleanParam(initialParams, "risk_only", false),
  });
  const [scopeMode, setScopeMode] = useState(normalizedScopeMode);
  const [scopeSelection, setScopeSelection] = useState(initialScopeSelection);
  const [savedViewId, setSavedViewId] = useState(initialParams.get("view") || "default");
  const [savedViews, setSavedViews] = useState(() => loadSavedViews(userId));
  const [columnVisibility, setColumnVisibility] = useState(() => loadColumnVisibility(userId));

  const [data, setData] = useState({ items: [], groups: [], total: 0, page: initialPage, pageSize: initialPageSize });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [processingIds, setProcessingIds] = useState(() => new Set());
  const [drawerTask, setDrawerTask] = useState(null);
  const [drawerTab, setDrawerTab] = useState("task");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [useLegacyApi, setUseLegacyApi] = useState(() => loadTasksApiMode() === "legacy");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState({ mode: null, data: null });
  const [agents, setAgents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [snoozeTarget, setSnoozeTarget] = useState(null);
  const [inlineEdit, setInlineEdit] = useState({ taskId: null, field: null });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef(null);

  const tableContainerRef = useRef(null);
  const mobileContainerRef = useRef(null);
  const pendingScrollTop = useRef(null);

  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    loadCollapsedGroups(userId, initialGroupBy)
  );
  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups(userId, groupBy));
  }, [groupBy, userId]);

  useEffect(() => {
    if (!isColumnMenuOpen) return undefined;
    const handleClick = (event) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target)) {
        setIsColumnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isColumnMenuOpen]);

  useEffect(() => {
    persistColumnVisibility(userId, columnVisibility);
  }, [columnVisibility, userId]);

  useEffect(() => {
    persistSavedViews(userId, savedViews);
  }, [savedViews, userId]);

  useEffect(() => {
    let active = true;
    api
      .get("/api/users", { params: { role: "agent" } })
      .then((response) => {
        if (!active) return;
        const list = Array.isArray(response.data) ? response.data : [];
        const mapped = list.map((entry) => ({
          id: String(entry.id ?? entry.user_id ?? ""),
          name: entry.name || entry.full_name || entry.email || `Agent ${entry.id}`,
          email: entry.email || "",
        }));
        setAgents(mapped);
      })
      .catch(() => {
        if (!active) return;
        setAgents([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get("/api/customers")
      .then((response) => {
        if (!active) return;
        const list = Array.isArray(response.data) ? response.data : [];
        const mapped = list.map((customer) => ({
          id: String(customer.id),
          name: customer.name,
          code: customer.customer_id,
        }));
        setCustomers(mapped);
      })
      .catch(() => {
        if (!active) return;
        setCustomers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const statusFilter = useMemo(
    () => computeStatusFilter(quickFilters, filters.status),
    [quickFilters, filters.status]
  );

  const priorityFilter = useMemo(
    () => computePriorityFilter(quickFilters, filters.priority),
    [quickFilters, filters.priority]
  );

  const dueRange = useMemo(
    () => computeDueRange(quickFilters, filters.dueFrom, filters.dueTo),
    [quickFilters, filters.dueFrom, filters.dueTo]
  );

  const queryParams = useMemo(() => {
    const params = {
      page,
      page_size: pageSize,
      group_by: groupBy,
      sort,
    };
    if (debouncedSearch) {
      params.q = debouncedSearch;
    }
    if (statusFilter.length > 0) {
      params.status = statusFilter;
    }
    if (priorityFilter.length > 0) {
      params.priority = priorityFilter;
    }
    const hasCustomDueFilter = Boolean(filters.dueFrom || filters.dueTo);
    if (dueRange.from) {
      params.due_from = dueRange.from;
    }
    if (dueRange.to) {
      params.due_to = dueRange.to;
    }
    const applyOverdueOnly =
      quickFilters.overdue && !(quickFilters.thisWeek && !hasCustomDueFilter);
    if (applyOverdueOnly) {
      params.overdue_only = true;
    }
    if (quickFilters.unassigned) {
      params.unassigned = true;
    }
    if (filters.tags.length > 0) {
      params.tags = filters.tags;
    }
    if (filters.customerIds.length > 0) {
      params.customer_id = filters.customerIds;
    }
    if (filters.agentIds.length > 0) {
      params.agent_id = filters.agentIds;
    }
    if (filters.riskOnly) {
      params.risk_only = true;
    }
    if (scopeMode === "agent" && scopeSelection) {
      params.scope_mode = "agent";
      params.scope_id = scopeSelection;
    } else if (scopeMode === "customer" && scopeSelection) {
      params.scope_mode = "customer";
      params.scope_id = scopeSelection;
    } else if (isAdmin) {
      params.scope_mode = "all";
    }
    return params;
  }, [
    debouncedSearch,
    filters.agentIds,
    filters.customerIds,
    filters.riskOnly,
    filters.tags,
    groupBy,
    page,
    pageSize,
    priorityFilter,
    quickFilters.overdue,
    quickFilters.unassigned,
    scopeMode,
    scopeSelection,
    sort,
    statusFilter,
    dueRange.from,
    dueRange.to,
    isAdmin,
  ]);

  const [synchronizingUrl, setSynchronizingUrl] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) {
      params.set("q", debouncedSearch);
    }
    statusFilter.forEach((status) => params.append("status", status));
    filters.priority.forEach((priority) => params.append("priority", priority));
    if (filters.dueFrom) params.set("due_from", filters.dueFrom);
    if (filters.dueTo) params.set("due_to", filters.dueTo);
    filters.tags.forEach((tag) => params.append("tags", tag));
    filters.customerIds.forEach((id) => params.append("customer_id", id));
    filters.agentIds.forEach((id) => params.append("agent_id", id));
    if (filters.riskOnly) params.set("risk_only", "true");
    params.set("group_by", groupBy);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (quickFilters.overdue) params.set("overdue_only", "true");
    if (quickFilters.today) params.set("today", "true");
    if (quickFilters.thisWeek) params.set("this_week", "true");
    if (quickFilters.unassigned) params.set("unassigned", "true");
    if (quickFilters.high) params.set("high", "true");
    if (quickFilters.waiting) params.set("waiting", "true");
    if (scopeMode === "agent" && scopeSelection) {
      params.set("scope_mode", "agent");
      params.set("scope_id", scopeSelection);
    } else if (scopeMode === "customer" && scopeSelection) {
      params.set("scope_mode", "customer");
      params.set("scope_id", scopeSelection);
    } else if (isAdmin) {
      params.set("scope_mode", "all");
    }
    if (savedViewId && savedViewId !== "default") {
      params.set("view", savedViewId);
    }
    setSynchronizingUrl(true);
    setSearchParams(params, { replace: true });
    const timeout = setTimeout(() => setSynchronizingUrl(false), 0);
    return () => clearTimeout(timeout);
  }, [
    debouncedSearch,
    filters.agentIds,
    filters.customerIds,
    filters.dueFrom,
    filters.dueTo,
    filters.priority,
    filters.riskOnly,
    filters.tags,
    groupBy,
    page,
    pageSize,
    quickFilters.high,
    quickFilters.overdue,
    quickFilters.thisWeek,
    quickFilters.today,
    quickFilters.unassigned,
    quickFilters.waiting,
    savedViewId,
    scopeMode,
    scopeSelection,
    setSearchParams,
    sort,
    statusFilter,
    isAdmin,
  ]);
  const fetchTasks = useCallback(async () => {
    if (synchronizingUrl) {
      return;
    }
    setLoading(true);
    setError("");

    const applyResponse = (itemsRaw, groupsRaw, totalRaw, responsePage, responsePageSize) => {
      const items = Array.isArray(itemsRaw) ? itemsRaw : [];
      const groups = Array.isArray(groupsRaw) ? groupsRaw : [];
      const total = Number.isFinite(totalRaw) ? totalRaw : items.length;
      const nextPage = Number.isFinite(responsePage) ? responsePage : page;
      const nextPageSize = Number.isFinite(responsePageSize) ? responsePageSize : pageSize;

      setData({ items, groups, total, page: nextPage, pageSize: nextPageSize });
      setAvailableTags((prev) => {
        const tags = new Set(prev);
        items.forEach((task) => {
          task.tags.forEach((tag) => tags.add(tag));
        });
        return Array.from(tags).sort((a, b) => a.localeCompare(b));
      });

      setCollapsedGroups((prev) => {
        if (groups.length === 0) {
          persistCollapsedGroups(userId, groupBy, []);
          return new Set();
        }
        const allowed = new Set(groups.map((group) => group.key));
        const next = new Set();
        prev.forEach((key) => {
          if (allowed.has(key)) {
            next.add(key);
          }
        });
        persistCollapsedGroups(userId, groupBy, Array.from(next));
        return next;
      });

      setSelectedIds((prev) => {
        if (prev.size === 0) return prev;
        const existing = new Set(items.map((item) => item.id));
        const next = new Set();
        prev.forEach((id) => {
          if (existing.has(id)) {
            next.add(id);
          }
        });
        return next;
      });

      if (drawerTask) {
        const updated = items.find((item) => item.id === drawerTask.id);
        if (updated) {
          setDrawerTask(updated);
        } else if (drawerTask && statusFilter.indexOf("completed") === -1 && drawerTask.status === "completed") {
          setDrawerTask(null);
          setIsDrawerOpen(false);
        }
      }
    };

    const runLegacyFetch = async (notifyFallback = false) => {
      try {
        const legacyParams = {};
        if (groupBy === "customer") {
          legacyParams.group_by = "customer";
        }
        const statusParam = queryParams.status;
        const statusList = Array.isArray(statusParam)
          ? statusParam
          : typeof statusParam !== "undefined"
          ? [statusParam]
          : [];
        legacyParams.status = statusList.length === 1 && statusList[0] === "completed" ? "completed" : "pending";

        const response = await api.get("/api/tasks/my", { params: legacyParams });
        const adapted = adaptLegacyTasksResponse(response.data, groupBy);
        let items = Array.isArray(adapted.items) ? adapted.items.slice() : [];

        const searchTermValue =
          typeof queryParams.q === "string" ? queryParams.q.trim().toLowerCase() : "";
        if (searchTermValue) {
          items = items.filter((task) => {
            const tokens = [task.title || "", task.customerName || "", task.customerCode || ""];
            if (Array.isArray(task.tags)) {
              tokens.push(task.tags.join(" "));
            }
            return tokens.join(" ").toLowerCase().includes(searchTermValue);
          });
        }

        if (statusFilter.length > 0) {
          items = items.filter((task) => statusFilter.includes(task.status || "pending"));
        }

        const dueFromRaw = queryParams.due_from || null;
        const dueToRaw = queryParams.due_to || null;
        if (dueFromRaw || dueToRaw) {
          const dueFrom = dueFromRaw ? new Date(dueFromRaw) : null;
          const dueTo = dueToRaw ? new Date(dueToRaw) : null;
          if (dueFrom && !Number.isNaN(dueFrom.getTime())) {
            dueFrom.setHours(0, 0, 0, 0);
          }
          if (dueTo && !Number.isNaN(dueTo.getTime())) {
            dueTo.setHours(23, 59, 59, 999);
          }
          items = items.filter((task) => {
            if (!task.dueDate) {
              return false;
            }
            const dueDate = new Date(task.dueDate);
            if (Number.isNaN(dueDate.getTime())) {
              return false;
            }
            if (dueFrom && !Number.isNaN(dueFrom.getTime()) && dueDate < dueFrom) {
              return false;
            }
            if (dueTo && !Number.isNaN(dueTo.getTime()) && dueDate > dueTo) {
              return false;
            }
            return true;
          });
        }

        if (queryParams.overdue_only) {
          items = items.filter(
            (task) => task.overdue && (task.status || "pending") !== "completed"
          );
        }

        items.sort((a, b) => {
          const dueA = a.dueDate ? new Date(a.dueDate) : null;
          const dueB = b.dueDate ? new Date(b.dueDate) : null;
          const validA = dueA && !Number.isNaN(dueA.getTime());
          const validB = dueB && !Number.isNaN(dueB.getTime());
          if (validA && validB) {
            if (dueA.getTime() !== dueB.getTime()) {
              return dueA - dueB;
            }
          } else if (validA) {
            return -1;
          } else if (validB) {
            return 1;
          }
          return (a.title || "").localeCompare(b.title || "");
        });

        const groups = groupBy !== "none" ? deriveLegacyGroups(items, groupBy) : [];
        const fallbackPageSize = items.length > 0 ? Math.max(items.length, pageSize) : pageSize;
        applyResponse(items, groups, items.length, 1, fallbackPageSize);
        if (page !== 1) {
          setPage(1);
        }
        if (notifyFallback) {
          showToast(
            "info",
            "Using limited task data while the new tasks API is unavailable."
          );
        }
        persistTasksApiMode("legacy");
        return true;
      } catch (legacyError) {
        const message =
          legacyError.response?.data?.error || legacyError.message || "Failed to load tasks";
        setError(message);
        setData((prev) => ({ ...prev, items: [], groups: [], total: 0 }));
        return false;
      }
    };

    try {
      if (useLegacyApi) {
        await runLegacyFetch();
        return;
      }

      const response = await api.get("/api/tasks", { params: queryParams });
      const items = Array.isArray(response.data?.items)
        ? response.data.items.map(normalizeTaskFromApi).filter(Boolean)
        : [];
      const groups = Array.isArray(response.data?.groups) ? response.data.groups : [];
      const total = Number(response.data?.total || 0);
      const responsePage = Number(response.data?.page || page);
      const responsePageSize = Number(response.data?.page_size || pageSize);

      persistTasksApiMode("modern");
      applyResponse(items, groups, total, responsePage, responsePageSize);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        const success = await runLegacyFetch(true);
        if (success) {
          persistTasksApiMode("legacy");
          setUseLegacyApi(true);
          return;
        }
      }
      const message = err.response?.data?.error || err.message || "Failed to load tasks";
      setError(message);
      setData((prev) => ({ ...prev, items: [], groups: [], total: 0 }));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        const target = isDesktop ? tableContainerRef.current : mobileContainerRef.current;
        if (pendingScrollTop.current !== null && target) {
          target.scrollTop = pendingScrollTop.current;
          pendingScrollTop.current = null;
        }
      });
    }
  }, [
    drawerTask,
    groupBy,
    isDesktop,
    page,
    pageSize,
    queryParams,
    showToast,
    statusFilter,
    synchronizingUrl,
    useLegacyApi,
    userId,
  ]);

  useEffect(() => {
    fetchTasks().catch(() => {});
  }, [fetchTasks]);

  const rows = useMemo(() => {
    const items = data.items || [];
    const groups = data.groups || [];
    const result = [];

    if (groupBy !== "none" && groups.length > 0) {
      const itemsByGroup = new Map();
      items.forEach((item) => {
        const key = item.groupKey || "__ungrouped";
        const bucket = itemsByGroup.get(key) || [];
        bucket.push(item);
        itemsByGroup.set(key, bucket);
      });

      groups.forEach((group) => {
        result.push({ type: "group", group });
        if (!collapsedGroups.has(group.key)) {
          const bucket = itemsByGroup.get(group.key) || [];
          bucket.forEach((task) => result.push({ type: "task", task }));
        }
      });

      const ungrouped = items.filter((item) => !item.groupKey || !groups.some((group) => group.key === item.groupKey));
      if (ungrouped.length > 0) {
        const fallbackGroup = {
          key: "__ungrouped",
          label: "Uncategorized",
          count: ungrouped.length,
        };
        result.push({ type: "group", group: fallbackGroup });
        if (!collapsedGroups.has(fallbackGroup.key)) {
          ungrouped.forEach((task) => result.push({ type: "task", task }));
        }
      }
    } else {
      items.forEach((task) => result.push({ type: "task", task }));
    }

    return result;
  }, [collapsedGroups, data.groups, data.items, groupBy]);

  const desktopVirtual = useVirtualRows(
    isDesktop ? rows.length : 0,
    DESKTOP_ROW_HEIGHT,
    VIRTUAL_OVERSCAN,
    tableContainerRef,
    [rows.length, groupBy, collapsedGroups]
  );

  const mobileVirtual = useVirtualRows(
    !isDesktop ? rows.length : 0,
    MOBILE_ROW_HEIGHT,
    VIRTUAL_OVERSCAN,
    mobileContainerRef,
    [rows.length, groupBy, collapsedGroups]
  );
  const visibleTasks = useMemo(
    () => rows.filter((row) => row.type === "task").map((row) => row.task.id),
    [rows]
  );
  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every((id) => selectedIds.has(id));

  const handleToggleSelectAll = useCallback(() => {
    if (visibleTasks.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = visibleTasks.every((id) => next.has(id));
      if (allSelected) {
        visibleTasks.forEach((id) => next.delete(id));
      } else {
        visibleTasks.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visibleTasks]);

  const handleToggleSelection = useCallback((taskId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleToggleQuickFilter = useCallback((key) => {
    setQuickFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "today" && next.today) {
        next.thisWeek = false;
      }
      if (key === "thisWeek" && next.thisWeek) {
        next.today = false;
      }
      return next;
    });
    setPage(1);
  }, []);

  const handleScopeChange = useCallback((value) => {
    setScopeMode(value);
    if (value !== "agent" && value !== "customer") {
      setScopeSelection(null);
    }
    setPage(1);
  }, []);

  const handleRetryNewApi = useCallback(() => {
    persistTasksApiMode("modern");
    setUseLegacyApi(false);
    setError("");
    setLoading(true);
    showToast("info", "Trying the updated tasks service…");
  }, [showToast]);

  const handleInlineUpdate = useCallback(
    async (taskId, updates) => {
      const previousItems = data.items.map((item) => ({ ...item }));
      const previousTask = previousItems.find((item) => item.id === taskId);
      if (!previousTask) {
        return;
      }

      const optimisticTask = { ...previousTask };
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        optimisticTask.status = updates.status;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "dueDate")) {
        optimisticTask.dueDate = updates.dueDate;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "priority")) {
        optimisticTask.priority = updates.priority;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "assigneeId")) {
        optimisticTask.assigneeId = updates.assigneeId;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "assigneeName")) {
        optimisticTask.assigneeName = updates.assigneeName;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
        optimisticTask.tags = updates.tags;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
        optimisticTask.notes = updates.notes;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "riskFlags")) {
        optimisticTask.riskFlags = updates.riskFlags;
      }

      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });

      setData((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === taskId ? optimisticTask : item)),
      }));
      if (drawerTask?.id === taskId) {
        setDrawerTask(optimisticTask);
      }

      try {
        const payload = {};
        if (Object.prototype.hasOwnProperty.call(updates, "status")) {
          payload.status = updates.status;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "dueDate")) {
          payload.due_on = updates.dueDate;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "priority")) {
          payload.priority = updates.priority;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "assigneeId")) {
          payload.assignee_id = updates.assigneeId === null ? null : Number(updates.assigneeId);
        }
        if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
          payload.tags = updates.tags;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
          payload.notes = updates.notes;
        }
        if (Object.prototype.hasOwnProperty.call(updates, "riskFlags")) {
          payload.risk_flags = updates.riskFlags;
        }

        const response = await api.patch(`/api/tasks/${taskId}`, payload);
        const normalized = normalizeTaskFromApi(response.data);
        setData((prev) => {
          let items = prev.items.map((item) => (item.id === taskId ? normalized : item));
          if (normalized.status === "completed" && !statusFilter.includes("completed")) {
            items = items.filter((item) => item.id !== taskId);
          }
          return { ...prev, items };
        });
        if (drawerTask?.id === taskId) {
          if (normalized.status === "completed" && !statusFilter.includes("completed")) {
            setDrawerTask(null);
            setIsDrawerOpen(false);
          } else {
            setDrawerTask(normalized);
          }
        }
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Update failed";
        showToast("error", message);
        setData((prev) => ({ ...prev, items: previousItems }));
        if (drawerTask?.id === taskId) {
          setDrawerTask(previousTask);
        }
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [data.items, drawerTask, showToast, statusFilter]
  );

  const handleBulkAction = useCallback(
    async (action, payload) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) {
        return;
      }
      const container = isDesktop ? tableContainerRef.current : mobileContainerRef.current;
      pendingScrollTop.current = container ? container.scrollTop : null;
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      try {
        await api.post("/api/tasks/bulk-actions", { ids, action, payload });
        showToast("success", bulkSuccessMessage(action, ids.length));
        setSelectedIds(new Set());
        await fetchTasks();
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Bulk action failed";
        showToast("error", message);
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [fetchTasks, isDesktop, selectedIds, showToast]
  );

  const handleApplyFilters = useCallback(
    (nextFilters) => {
      setFilters({
        status: mergeUnique(nextFilters.status || DEFAULT_STATUS_SCOPE),
        priority: mergeUnique(nextFilters.priority || []),
        dueFrom: nextFilters.dueFrom || null,
        dueTo: nextFilters.dueTo || null,
        tags: mergeUnique(nextFilters.tags || []),
        customerIds: mergeUnique(nextFilters.customerIds || []),
        agentIds: mergeUnique(nextFilters.agentIds || []),
        riskOnly: Boolean(nextFilters.riskOnly),
      });
      setPage(1);
      setIsFilterDrawerOpen(false);
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      status: DEFAULT_STATUS_SCOPE,
      priority: [],
      dueFrom: null,
      dueTo: null,
      tags: [],
      customerIds: [],
      agentIds: [],
      riskOnly: false,
    });
    setQuickFilters(getDefaultQuickFilters(isAdmin));
    setPage(1);
  }, [isAdmin]);

  const handleSaveView = useCallback(() => {
    if (typeof window === "undefined") return;
    const name = window.prompt("Save view as", "");
    if (!name) return;
    const state = {
      search: searchTerm,
      groupBy,
      sort,
      pageSize,
      quickFilters,
      filters,
      scopeMode,
      scopeSelection,
    };
    const view = {
      id: `${Date.now()}`,
      name: name.trim(),
      state: JSON.parse(JSON.stringify(state)),
    };
    setSavedViews((prev) => [...prev.filter((item) => item.id !== view.id), view]);
    setSavedViewId(view.id);
    showToast("success", `Saved view "${view.name}"`);
  }, [filters, groupBy, pageSize, quickFilters, scopeMode, scopeSelection, searchTerm, showToast, sort]);

  const handleApplyView = useCallback(
    (viewId) => {
      setSavedViewId(viewId);
      if (viewId === "default") {
        setSearchTerm("");
        setGroupBy("customer");
        setSort("due_date:asc");
        setPage(1);
        setPageSize(100);
        setQuickFilters(getDefaultQuickFilters(isAdmin));
        setFilters({
          status: DEFAULT_STATUS_SCOPE,
          priority: [],
          dueFrom: null,
          dueTo: null,
          tags: [],
          customerIds: [],
          agentIds: [],
          riskOnly: false,
        });
        setScopeMode(isAdmin ? "all" : "portfolio");
        setScopeSelection(null);
        return;
      }
      const view = savedViews.find((entry) => entry.id === viewId);
      if (!view) {
        return;
      }
      const state = view.state || {};
      setSearchTerm(state.search || "");
      setGroupBy(state.groupBy || "customer");
      setSort(state.sort || "due_date:asc");
      setPageSize(state.pageSize || 100);
      setQuickFilters({ ...getDefaultQuickFilters(isAdmin), ...(state.quickFilters || {}) });
      setFilters({
        status: mergeUnique(state.filters?.status || DEFAULT_STATUS_SCOPE),
        priority: mergeUnique(state.filters?.priority || []),
        dueFrom: state.filters?.dueFrom || null,
        dueTo: state.filters?.dueTo || null,
        tags: mergeUnique(state.filters?.tags || []),
        customerIds: mergeUnique(state.filters?.customerIds || []),
        agentIds: mergeUnique(state.filters?.agentIds || []),
        riskOnly: Boolean(state.filters?.riskOnly),
      });
      setScopeMode(state.scopeMode || (isAdmin ? "all" : "portfolio"));
      setScopeSelection(state.scopeSelection || null);
      setPage(1);
    },
    [isAdmin, savedViews]
  );

  const openDrawer = useCallback((task, tab = "task") => {
    setDrawerTask(task);
    setDrawerTab(tab);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerTask(null);
  }, []);

  const handleMarkDone = useCallback(
    (task) => {
      handleInlineUpdate(task.id, { status: "completed" });
    },
    [handleInlineUpdate]
  );

  const handleSnooze = useCallback(
    (task, days) => {
      const base = task.dueDate ? new Date(task.dueDate) : new Date();
      if (Number.isNaN(base.getTime())) {
        base.setTime(Date.now());
      }
      base.setDate(base.getDate() + days);
      const iso = base.toISOString().split("T")[0];
      handleInlineUpdate(task.id, { dueDate: iso });
      setSnoozeTarget(null);
    },
    [handleInlineUpdate]
  );

  const handlePageChange = useCallback(
    (direction) => {
      setPage((prev) => {
        if (direction === "prev") {
          return Math.max(1, prev - 1);
        }
        return prev + 1;
      });
    },
    []
  );

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const quickFilterConfig = useMemo(
    () => [
      { key: "overdue", label: "Overdue" },
      { key: "today", label: "Today" },
      { key: "thisWeek", label: "This Week" },
      { key: "unassigned", label: "Unassigned" },
      { key: "high", label: "High" },
      { key: "waiting", label: "Waiting" },
    ],
    []
  );

  const columnTemplate = useMemo(() => {
    const segments = [
      "32px",
      "minmax(220px, 1.4fr)",
      "minmax(190px, 1fr)",
      "minmax(180px, 1fr)",
      "minmax(110px, 0.7fr)",
      "minmax(150px, 0.8fr)",
      "minmax(170px, 0.8fr)",
    ];
    if (columnVisibility.risk) segments.push("90px");
    if (columnVisibility.tags) segments.push("minmax(160px, 1fr)");
    if (columnVisibility.updated) segments.push("minmax(140px, 0.7fr)");
    segments.push("64px");
    return segments.join(" ");
  }, [columnVisibility]);
  const renderDesktopContent = () => {
    if (loading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="grid items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <div className="h-4 w-4 rounded bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-16 rounded-full bg-slate-200" />
              <div className="h-5 w-20 rounded-full bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-200" />
              {columnVisibility.risk && <div className="h-4 w-6 rounded bg-slate-200" />}
              {columnVisibility.tags && <div className="flex gap-2"><div className="h-4 w-16 rounded bg-slate-200" /><div className="h-4 w-12 rounded bg-slate-200" /></div>}
              {columnVisibility.updated && <div className="h-4 w-20 rounded bg-slate-200" />}
              <div className="ml-auto flex h-6 w-16 items-center justify-end gap-2">
                <div className="h-6 w-6 rounded-full bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTasks()}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <FiRefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      );
    }

    if (!rows.some((row) => row.type === "task")) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          {isAdmin ? (
            <div className="space-y-3">
              <p>No tasks match your filters.</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p>No pending tasks for your customers.</p>
              <button
                type="button"
                onClick={() => navigate("/customers")}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Create task
              </button>
            </div>
          )}
        </div>
      );
    }

    const visibleRows = rows.slice(desktopVirtual.start, desktopVirtual.end);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className="grid items-center gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
          style={{ gridTemplateColumns: columnTemplate }}
        >
          <div>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={handleToggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div>Task</div>
          <div>Customer</div>
          <div>Assignee</div>
          <div>Priority</div>
          <div>Status</div>
          <div>Due</div>
          {columnVisibility.risk && <div>Risk</div>}
          {columnVisibility.tags && <div>Tags</div>}
          {columnVisibility.updated && <div>Updated</div>}
          <div className="text-right">Actions</div>
        </div>
        <div ref={tableContainerRef} className="max-h-[60vh] overflow-y-auto">
          <div style={{ height: rows.length * DESKTOP_ROW_HEIGHT }}>
            <div style={{ transform: `translateY(${desktopVirtual.paddingTop}px)` }}>
              {visibleRows.map((row) => {
                if (row.type === "group") {
                  const collapsed = collapsedGroups.has(row.group.key);
                  return (
                    <button
                      key={row.group.key}
                      type="button"
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.group.key)) {
                            next.delete(row.group.key);
                          } else {
                            next.add(row.group.key);
                          }
                          persistCollapsedGroups(userId, groupBy, Array.from(next));
                          return next;
                        });
                      }}
                      className="flex w-full items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-left text-sm font-semibold text-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        {collapsed ? <FiChevronRight className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                        <span>{row.group.label || "Group"}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{row.group.count ?? 0}</span>
                    </button>
                  );
                }

                const task = row.task;
                const isSelected = selectedIds.has(task.id);
                const isProcessing = processingIds.has(task.id);
                const assigneeName = task.assigneeName || task.assigneeEmail || "Unassigned";
                const dueState = formatDueState(task, todayStr);
                const priorityStyle = priorityTone(task.priority);

                return (
                  <div
                    key={task.id}
                    className="group grid items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm hover:bg-blue-50/40"
                    style={{ gridTemplateColumns: columnTemplate }}
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelection(task.id)}
                        disabled={isProcessing}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => openDrawer(task)}
                      className="flex flex-col items-start text-left"
                    >
                      <span className="font-semibold text-slate-900">{task.title}</span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">{titleCase(task.type)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDrawer(task, "customer")}
                      className="text-left text-sm text-blue-600 hover:underline"
                    >
                      {task.customerCode ? `${task.customerCode} — ${task.customerName}` : task.customerName || "Customer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineEdit({ taskId: task.id, field: "assignee" })}
                      className="flex items-center gap-2 text-left text-sm text-slate-700"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                        {getInitials(assigneeName)}
                      </span>
                      <span>{assigneeName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineEdit({ taskId: task.id, field: "priority" })}
                      className={`flex items-center gap-2 text-left text-sm ${priorityStyle.text}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${priorityStyle.dot}`} />
                      <span>{titleCase(task.priority)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineEdit({ taskId: task.id, field: "status" })}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(task.status)}`}
                    >
                      {statusLabel(task.status)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlineEdit({ taskId: task.id, field: "due" })}
                      className={`text-left text-sm ${dueState.tone}`}
                    >
                      <div>{formatDate(task.dueDate)}</div>
                      <div className="text-xs text-slate-400">{dueState.label}</div>
                    </button>
                    {columnVisibility.risk && (
                      <div className="text-sm text-rose-600">
                        {task.riskFlags.length > 0 ? (
                          <span title={task.riskFlags.join(", ")} className="inline-flex items-center gap-1">
                            <FiAlertTriangle className="h-4 w-4" />
                            {task.riskFlags.length}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    )}
                    {columnVisibility.tags && (
                      <div className="flex flex-wrap gap-2">
                        {task.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            #{tag}
                          </span>
                        ))}
                        {task.tags.length > 2 && (
                          <span className="text-xs text-slate-400">+{task.tags.length - 2}</span>
                        )}
                        {task.tags.length === 0 && <span className="text-xs text-slate-400">No tags</span>}
                      </div>
                    )}
                    {columnVisibility.updated && (
                      <div className="text-sm text-slate-500">{formatRelativeTime(task.updatedAt)}</div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => handleMarkDone(task)}
                          disabled={isProcessing}
                          className="rounded-full border border-emerald-200 p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                        >
                          <FiCheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openDrawer(task);
                            setDrawerTab("task");
                          }}
                          className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                        >
                          <FiLayers className="h-4 w-4" />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setSnoozeTarget((current) => (current === task.id ? null : task.id))}
                            className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                          >
                            <FiClock className="h-4 w-4" />
                          </button>
                          {snoozeTarget === task.id && (
                            <div className="absolute right-0 z-20 mt-2 w-36 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                              {[1, 3, 7].map((days) => (
                                <button
                                  key={days}
                                  type="button"
                                  onClick={() => handleSnooze(task, days)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                                >
                                  <FiClock className="h-4 w-4" /> Snooze {days}d
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ taskId: task.id, field: "assignee" })}
                          className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                        >
                          <FiUsers className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInlineEdit({ taskId: task.id, field: "more" })}
                        className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                      >
                        <FiMoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    {inlineEdit.taskId === task.id && inlineEdit.field === "status" && (
                      <div className="col-span-full flex items-center gap-2 px-4 pb-3">
                        <select
                          value={task.status}
                          onChange={(event) => {
                            setInlineEdit({ taskId: null, field: null });
                            handleInlineUpdate(task.id, { status: event.target.value });
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ taskId: null, field: null })}
                          className="text-sm text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {inlineEdit.taskId === task.id && inlineEdit.field === "priority" && (
                      <div className="col-span-full flex items-center gap-2 px-4 pb-3">
                        <select
                          value={task.priority}
                          onChange={(event) => {
                            setInlineEdit({ taskId: null, field: null });
                            handleInlineUpdate(task.id, { priority: event.target.value });
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ taskId: null, field: null })}
                          className="text-sm text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {inlineEdit.taskId === task.id && inlineEdit.field === "due" && (
                      <div className="col-span-full flex items-center gap-2 px-4 pb-3">
                        <input
                          type="date"
                          value={task.dueDate || ""}
                          onChange={(event) => {
                            setInlineEdit({ taskId: null, field: null });
                            handleInlineUpdate(task.id, { dueDate: event.target.value || null });
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setInlineEdit({ taskId: null, field: null });
                            handleInlineUpdate(task.id, { dueDate: null });
                          }}
                          className="text-sm text-slate-500"
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {inlineEdit.taskId === task.id && inlineEdit.field === "assignee" && (
                      <div className="col-span-full flex items-center gap-2 px-4 pb-3">
                        <select
                          value={task.assigneeId || ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setInlineEdit({ taskId: null, field: null });
                            handleInlineUpdate(task.id, {
                              assigneeId: value ? value : null,
                              assigneeName:
                                value
                                  ? agents.find((agent) => agent.id === value)?.name || ""
                                  : "Unassigned",
                            });
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setInlineEdit({ taskId: null, field: null })}
                          className="text-sm text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-600">
          <div>
            Showing {(page - 1) * pageSize + 1} –
            {Math.min(page * pageSize, data.total)} of {data.total} tasks
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handlePageChange("prev")}
              disabled={page <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => handlePageChange("next")}
              disabled={page >= totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileContent = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTasks()}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <FiRefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      );
    }

    if (!rows.some((row) => row.type === "task")) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          {isAdmin ? "No tasks match your filters." : "No pending tasks for your customers."}
        </div>
      );
    }

    const visibleRows = rows.slice(mobileVirtual.start, mobileVirtual.end);

    return (
      <div ref={mobileContainerRef} className="max-h-[65vh] overflow-y-auto space-y-3">
        {visibleRows.map((row) => {
          if (row.type === "group") {
            const collapsed = collapsedGroups.has(row.group.key);
            return (
              <button
                key={row.group.key}
                type="button"
                onClick={() => {
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.group.key)) {
                      next.delete(row.group.key);
                    } else {
                      next.add(row.group.key);
                    }
                    persistCollapsedGroups(userId, groupBy, Array.from(next));
                    return next;
                  });
                }}
                className="flex w-full items-center justify-between rounded-full bg-slate-100 px-4 py-2 text-left text-sm font-semibold text-slate-700"
              >
                <span className="flex items-center gap-2">
                  {collapsed ? <FiChevronRight className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                  {row.group.label || "Group"}
                </span>
                <span className="text-xs text-slate-500">{row.group.count ?? 0}</span>
              </button>
            );
          }

          const task = row.task;
          const isSelected = selectedIds.has(task.id);
          const assigneeName = task.assigneeName || task.assigneeEmail || "Unassigned";
          const priorityStyle = priorityTone(task.priority);

          return (
            <div
              key={task.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => openDrawer(task)}
                    className="text-left text-base font-semibold text-slate-900"
                  >
                    {task.title}
                  </button>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClasses(task.status)}`}>
                      {statusLabel(task.status)}
                    </span>
                    <span className="text-xs text-slate-400">{formatRelativeDate(task.dueDate)}</span>
                  </div>
                </div>
                <div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelection(task.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <FiUser className="h-4 w-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setInlineEdit({ taskId: task.id, field: "assignee" })}
                    className="text-left"
                  >
                    {assigneeName}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <FiCalendar className="h-4 w-4 text-slate-400" />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${priorityStyle.dot}`} />
                  <span className={priorityStyle.text}>{titleCase(task.priority)}</span>
                  {task.riskFlags.length > 0 && (
                    <span title={task.riskFlags.join(", ")} className="inline-flex items-center gap-1 text-rose-600">
                      <FiAlertTriangle className="h-4 w-4" />
                      {task.riskFlags.length}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Updated {formatRelativeTime(task.updatedAt)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {task.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    #{tag}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="text-xs text-slate-400">+{task.tags.length - 2}</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkDone(task)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 text-emerald-600"
                  >
                    <FiCheck className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnoozeTarget((current) => (current === task.id ? null : task.id))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                  >
                    <FiClock className="h-4 w-4" />
                  </button>
                  {snoozeTarget === task.id && (
                    <div className="absolute right-4 mt-12 w-32 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                      {[1, 3, 7].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => handleSnooze(task, days)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                        >
                          <FiClock className="h-4 w-4" /> Snooze {days}d
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openDrawer(task)}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-blue-200 text-sm font-semibold text-blue-600"
                >
                  Open
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Scope</label>
                <select
                  value={scopeMode}
                  onChange={(event) => handleScopeChange(event.target.value)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">All customers</option>
                  <option value="agent">By agent</option>
                  <option value="customer">By customer</option>
                </select>
                {scopeMode === "agent" && (
                  <select
                    value={scopeSelection || ""}
                    onChange={(event) => setScopeSelection(event.target.value || null)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">All agents</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
                {scopeMode === "customer" && (
                  <select
                    value={scopeSelection || ""}
                    onChange={(event) => setScopeSelection(event.target.value || null)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">All customers</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.code ? `${customer.code} — ${customer.name}` : customer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                <FiUsers className="h-4 w-4" /> My portfolio
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Search tasks, customers, tags"
                className="w-full rounded-full border border-slate-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <FiFilter className="h-4 w-4" /> Filters
            </button>
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setIsColumnMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Columns <FiChevronDown className="h-4 w-4" />
              </button>
              {isColumnMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  {COLUMN_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 py-1 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={columnVisibility[option.key]}
                        onChange={() =>
                          setColumnVisibility((prev) => {
                            const next = { ...prev, [option.key]: !prev[option.key] };
                            persistColumnVisibility(userId, next);
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickFilterConfig.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => handleToggleQuickFilter(filter.key)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                quickFilters[filter.key]
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter.label}
              {quickFilters[filter.key] && <FiX className="h-3 w-3" />}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Group by</label>
            <select
              value={groupBy}
              onChange={(event) => {
                setGroupBy(event.target.value);
                setPage(1);
              }}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Sort</label>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Page size</label>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {[50, 100, 200, 500].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Saved view</label>
            <select
              value={savedViewId}
              onChange={(event) => handleApplyView(event.target.value)}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="default">Default</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveView}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <FiPlus className="h-4 w-4" /> Save
            </button>
          </div>
        </div>
      </div>

      {useLegacyApi && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Showing a limited task view while the new tasks service is unavailable. Some filters and
              groupings may be reduced.
            </span>
          </div>
          <button
            type="button"
            onClick={handleRetryNewApi}
            className="inline-flex items-center rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 transition hover:bg-amber-100"
          >
            Retry new service
          </button>
        </div>
      )}

      {isDesktop ? renderDesktopContent() : renderMobileContent()}

      <BulkActionBar
        selectedCount={selectedIds.size}
        isDesktop={isDesktop}
        onMarkDone={() => handleBulkAction("mark_done")}
        onReassign={() => setBulkAction({ mode: "reassign", data: null })}
        onSetDue={() => setBulkAction({ mode: "set_due", data: null })}
        onSetStatus={() => setBulkAction({ mode: "set_status", data: null })}
        onAddTag={() => setBulkAction({ mode: "add_tag", data: null })}
        onRemoveTag={() => setBulkAction({ mode: "remove_tag", data: null })}
        onDelete={() => handleBulkAction("delete")}
      />

      <FilterDrawer
        open={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onReset={handleClearFilters}
        statusOptions={STATUS_OPTIONS}
        priorityOptions={PRIORITY_OPTIONS}
        customers={customers}
        agents={agents}
        availableTags={availableTags}
      />

      <TaskDrawer
        open={isDrawerOpen}
        task={drawerTask}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={closeDrawer}
        onUpdate={handleInlineUpdate}
        onMarkDone={handleMarkDone}
        onSnooze={handleSnooze}
        onReassign={(updates) => handleInlineUpdate(drawerTask?.id, updates)}
        agents={agents}
        isProcessing={drawerTask ? processingIds.has(drawerTask.id) : false}
      />

      {bulkAction.mode && (
        <BulkActionDialog
          mode={bulkAction.mode}
          onClose={() => setBulkAction({ mode: null, data: null })}
          onSubmit={(payload) => {
            handleBulkAction(bulkAction.mode, payload);
            setBulkAction({ mode: null, data: null });
          }}
          agents={agents}
        />
      )}
    </div>
  );
}

function BulkActionBar({
  selectedCount,
  onMarkDone,
  onReassign,
  onSetDue,
  onSetStatus,
  onAddTag,
  onRemoveTag,
  onDelete,
  isDesktop = true,
}) {
  if (selectedCount === 0) {
    return null;
  }

  const content = (
    <div
      className={`${
        isDesktop
          ? "fixed inset-x-0 bottom-4 z-30 flex justify-center"
          : "fixed inset-x-0 bottom-0 z-30"
      } pointer-events-none`}
    >
      <div
        className={`pointer-events-auto flex max-w-3xl items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-xl ${
          isDesktop ? "" : "mx-4 mb-4"
        }`}
      >
        <span className="text-sm font-semibold text-slate-700">
          {selectedCount} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkDone}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100"
          >
            <FiCheckCircle className="h-4 w-4" /> Done
          </button>
          <button
            type="button"
            onClick={onReassign}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiUsers className="h-4 w-4" /> Reassign
          </button>
          <button
            type="button"
            onClick={onSetDue}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiCalendar className="h-4 w-4" /> Set due
          </button>
          <button
            type="button"
            onClick={onSetStatus}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiLayers className="h-4 w-4" /> Status
          </button>
          <button
            type="button"
            onClick={onAddTag}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiTag className="h-4 w-4" /> Add tag
          </button>
          <button
            type="button"
            onClick={onRemoveTag}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiTag className="h-4 w-4" /> Remove tag
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <FiTrash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  return createPortal(content, document.body);
}

function FilterDrawer({
  open,
  onClose,
  filters,
  onApply,
  onReset,
  statusOptions,
  priorityOptions,
  customers,
  agents,
  availableTags,
}) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
      setTagInput("");
    }
  }, [filters, open]);

  const handleCheckboxChange = (key, value) => {
    setLocalFilters((prev) => {
      const list = new Set(prev[key] || []);
      if (list.has(value)) {
        list.delete(value);
      } else {
        list.add(value);
      }
      return { ...prev, [key]: Array.from(list) };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onApply(localFilters);
  };

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    setLocalFilters((prev) => ({
      ...prev,
      tags: Array.from(new Set([...(prev.tags || []), value])),
    }));
    setTagInput("");
  };

  if (!open) {
    return null;
  }

  const drawer = (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close filters"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </h3>
            <div className="mt-2 space-y-2">
              {statusOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={localFilters.status?.includes(option.value)}
                    onChange={() => handleCheckboxChange("status", option.value)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priority
            </h3>
            <div className="mt-2 space-y-2">
              {priorityOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={localFilters.priority?.includes(option.value)}
                    onChange={() => handleCheckboxChange("priority", option.value)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due from
              </span>
              <input
                type="date"
                value={localFilters.dueFrom || ""}
                onChange={(event) =>
                  setLocalFilters((prev) => ({ ...prev, dueFrom: event.target.value || null }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due to
              </span>
              <input
                type="date"
                value={localFilters.dueTo || ""}
                onChange={(event) =>
                  setLocalFilters((prev) => ({ ...prev, dueTo: event.target.value || null }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customers
            </h3>
            <select
              multiple
              value={localFilters.customerIds || []}
              onChange={(event) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  customerIds: Array.from(event.target.selectedOptions, (option) => option.value),
                }))
              }
              className="mt-2 h-36 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code ? `${customer.code} — ${customer.name}` : customer.name}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assignees
            </h3>
            <select
              multiple
              value={localFilters.agentIds || []}
              onChange={(event) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  agentIds: Array.from(event.target.selectedOptions, (option) => option.value),
                }))
              }
              className="mt-2 h-36 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tags
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(localFilters.tags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  #{tag}
                  <button
                    type="button"
                    onClick={() =>
                      setLocalFilters((prev) => ({
                        ...prev,
                        tags: (prev.tags || []).filter((entry) => entry !== tag),
                      }))
                    }
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="Add tag"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Add
              </button>
            </div>
            {availableTags.length > 0 && (
              <div className="mt-3 text-xs text-slate-500">
                Suggested: {availableTags.slice(0, 10).join(", ")}
              </div>
            )}
          </section>

          <section className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(localFilters.riskOnly)}
                onChange={(event) =>
                  setLocalFilters((prev) => ({ ...prev, riskOnly: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Risk flags only
            </label>
            <button
              type="button"
              onClick={onReset}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Clear all
            </button>
          </section>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );

  if (typeof document === "undefined") {
    return drawer;
  }

  return createPortal(drawer, document.body);
}

function TaskDrawer({
  open,
  task,
  activeTab,
  onTabChange,
  onClose,
  onUpdate,
  onMarkDone,
  onSnooze,
  onReassign,
  agents,
  isProcessing,
}) {
  const [notes, setNotes] = useState(task?.notes || "");

  useEffect(() => {
    if (open) {
      setNotes(task?.notes || "");
    }
  }, [open, task]);

  if (!open || !task) {
    return null;
  }

  const handleStatusChange = (event) => {
    onUpdate(task.id, { status: event.target.value });
  };

  const handlePriorityChange = (event) => {
    onUpdate(task.id, { priority: event.target.value });
  };

  const handleDueChange = (event) => {
    onUpdate(task.id, { dueDate: event.target.value || null });
  };

  const handleAssigneeChange = (event) => {
    const value = event.target.value;
    const selectedAgent = agents.find((agent) => agent.id === value);
    const updates = {
      assigneeId: value || null,
      assigneeName: selectedAgent ? selectedAgent.name : "Unassigned",
    };
    onReassign(updates);
  };

  const handleSaveNotes = () => {
    onUpdate(task.id, { notes });
  };

  const handleSnoozeDays = (days) => {
    onSnooze(task, days);
  };

  const drawer = (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
            <p className="text-sm text-slate-500">{task.customerName || "Customer"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close task drawer"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-3">
          <button
            type="button"
            onClick={() => onTabChange("task")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              activeTab === "task"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => onTabChange("customer")}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              activeTab === "customer"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Customer
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-700">
          {activeTab === "task" ? (
            <div className="space-y-6">
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(task.status)}`}>
                    {statusLabel(task.status)}
                  </span>
                  <span className="text-slate-500">Due {formatDate(task.dueDate)}</span>
                  <span className="text-slate-500">Priority {titleCase(task.priority)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMarkDone(task)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <FiCheckCircle className="h-4 w-4" /> Mark done
                  </button>
                  {[1, 3, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleSnoozeDays(days)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <FiClock className="h-4 w-4" /> Snooze {days}d
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-600">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </span>
                  <select
                    value={task.status}
                    onChange={handleStatusChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </span>
                  <select
                    value={task.priority}
                    onChange={handlePriorityChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Due date
                  </span>
                  <input
                    type="date"
                    value={task.dueDate || ""}
                    onChange={handleDueChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assignee
                  </span>
                  <select
                    value={task.assigneeId || ""}
                    onChange={handleAssigneeChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {task.tags.length > 0 ? (
                    task.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No tags yet</span>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </h3>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Save notes
                  </button>
                </div>
              </section>

              {task.history && task.history.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    History
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-500">
                    {task.history.map((entry, index) => (
                      <li key={index} className="flex flex-col">
                        <span className="font-medium text-slate-600">{entry.title || entry.action}</span>
                        <span>{entry.timestamp}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer ID
                </h3>
                <p className="mt-1 text-sm text-slate-700">{task.customerCode || "—"}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer name
                </h3>
                <p className="mt-1 text-sm text-slate-700">{task.customerName || "—"}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Primary agent
                </h3>
                <p className="mt-1 text-sm text-slate-700">{task.customerPrimaryAgentName || task.customerPrimaryAgentId || "—"}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </h3>
                <p className="mt-1 text-sm text-slate-700">{task.customerStatus ? titleCase(task.customerStatus) : "—"}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Risk flags
                </h3>
                {task.riskFlags.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-rose-600">
                    {task.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No risk flags</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return drawer;
  }

  return createPortal(drawer, document.body);
}

function BulkActionDialog({ mode, onClose, onSubmit, agents }) {
  const [status, setStatus] = useState("pending");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    setStatus("pending");
    setDue("");
    setAssignee("");
    setTag("");
  }, [mode]);

  if (!mode) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    switch (mode) {
      case "reassign":
        onSubmit({ agent_id: assignee ? Number(assignee) : null });
        break;
      case "set_due":
        onSubmit({ due_on: due || null });
        break;
      case "set_status":
        onSubmit({ status });
        break;
      case "add_tag":
        onSubmit({ tag });
        break;
      case "remove_tag":
        onSubmit({ tag });
        break;
      default:
        onSubmit({});
        break;
    }
  };

  const titleMap = {
    reassign: "Reassign tasks",
    set_due: "Set due date",
    set_status: "Update status",
    add_tag: "Add tag",
    remove_tag: "Remove tag",
  };

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titleMap[mode]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close bulk action"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {mode === "reassign" && (
          <label className="block text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assignee
            </span>
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === "set_due" && (
          <label className="mt-2 block text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Due date
            </span>
            <input
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
        )}

        {mode === "set_status" && (
          <label className="mt-2 block text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {(mode === "add_tag" || mode === "remove_tag") && (
          <label className="mt-2 block text-sm text-slate-600">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tag
            </span>
            <input
              type="text"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </form>
    </div>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
