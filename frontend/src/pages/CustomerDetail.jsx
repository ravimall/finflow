import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiBell, FiCheckCircle, FiEdit3, FiPlus, FiTrash2 } from "react-icons/fi";
import LoanForm from "../components/LoanForm";
import LoanDrawer from "../components/LoanDrawer";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api.js";
import CustomerDeleteModal from "../components/CustomerDeleteModal.jsx";
import { useToast } from "../context/ToastContext.jsx";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return "—";
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return value;
  }
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(number);
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const { showToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [dropboxLink, setDropboxLink] = useState(null);
  const [dropboxRetryMessage, setDropboxRetryMessage] = useState("");
  const [dropboxRetryError, setDropboxRetryError] = useState("");
  const [dropboxActionLoading, setDropboxActionLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSuccess, setDetailsSuccess] = useState("");
  const [detailsForm, setDetailsForm] = useState({
    name: "",
    status: "",
    phone: "",
    email: "",
    address: "",
    flat_no: "",
    dropboxFolderPath: "",
    primary_agent_id: "",
  });
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteError, setNoteError] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    due_on: "",
    remind_on: "",
    notes: "",
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSelection, setTemplateSelection] = useState({
    templateId: "",
    assigneeMode: "default",
  });
  const [templateError, setTemplateError] = useState("");
  const [templateMessage, setTemplateMessage] = useState("");
  const [loans, setLoans] = useState([]);
  const [loanDrawerId, setLoanDrawerId] = useState(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const customerRecordId = customer?.id ?? null;
  const dropboxProvisioningStatus =
    dropboxLink?.customer?.dropboxProvisioningStatus ??
    customer?.dropboxProvisioningStatus ??
    "pending";

  const fetchDropboxLink = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/dropbox-link`);
      setDropboxLink(response.data);
      if (response.data?.customer) {
        setCustomer((prev) => {
          if (!prev) {
            return response.data.customer;
          }
          return { ...prev, ...response.data.customer };
        });
      }
    } catch (err) {
      setDropboxLink(null);
    }
  }, [id]);

  useEffect(() => {
    api
      .get("/api/config/statuses", { params: { type: "customer" } })
      .then((response) =>
        setStatuses(Array.isArray(response.data) ? response.data : [])
      )
      .catch(() => setStatuses([]));
  }, []);

  const refreshLoans = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/loans`);
      setLoans(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setLoans([]);
    }
  }, [id]);

  const refreshNotes = useCallback(async () => {
    try {
      const response = await api.get(`/api/customers/${id}/notes`);
      setNotes(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setNotes([]);
    }
  }, [id]);

  const refreshTasks = useCallback(async () => {
    setTaskLoading(true);
    setTaskError("");
    try {
      const response = await api.get(`/api/customers/${id}/tasks`);
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load tasks";
      setTaskError(message);
      setTasks([]);
    } finally {
      setTaskLoading(false);
    }
  }, [id]);

  const fetchTemplates = useCallback(async () => {
    setTemplateLoading(true);
    setTemplateError("");
    try {
      const response = await api.get("/api/task-templates", { params: { is_active: true } });
      setTemplates(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load templates";
      setTemplateError(message);
      setTemplates([]);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const refreshAgents = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/api/users", { params: { role: "agent" } });
      setAgents(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setAgents([]);
    }
  }, [isAdmin]);

  const canEditCustomer = useMemo(() => {
    if (!customer || !user) {
      return false;
    }
    if (user.role === "admin") {
      return true;
    }
    return customer.primary_agent_id === user.id;
  }, [customer, user]);

  const beginEditingDetails = useCallback(() => {
    if (!customer) return;

    setDetailsForm({
      name: customer.name || "",
      status: customer.status || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      flat_no: customer.flat_no || "",
      dropboxFolderPath:
        dropboxLink?.customer?.dropboxFolderPath ??
        customer.dropboxFolderPath ??
        "",
      primary_agent_id: customer.primary_agent_id
        ? String(customer.primary_agent_id)
        : "",
    });
    setDetailsError("");
    setDetailsSuccess("");
    setEditingDetails(true);
  }, [customer, dropboxLink]);

  const cancelDetailsEditing = useCallback(() => {
    setEditingDetails(false);
    setDetailsSaving(false);
    setDetailsError("");
  }, []);

  const handleDetailsChange = (event) => {
    const { name, value } = event.target;
    setDetailsForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitDetails = async (event) => {
    event.preventDefault();
    if (!customer) return;

    const trimmedName = detailsForm.name.trim();
    if (!trimmedName) {
      setDetailsError("Name is required");
      return;
    }

    setDetailsSaving(true);
    setDetailsError("");

    try {
      const payload = {
        name: trimmedName,
        status: detailsForm.status || undefined,
        phone: (detailsForm.phone || "").trim(),
        email: (detailsForm.email || "").trim(),
        address: (detailsForm.address || "").trim(),
        flat_no: (detailsForm.flat_no || "").trim(),
      };

      if (!payload.status) {
        delete payload.status;
      }

      const trimmedDropboxPath = (detailsForm.dropboxFolderPath || "").trim();
      if (trimmedDropboxPath) {
        payload.dropboxFolderPath = trimmedDropboxPath;
      }

      if (isAdmin) {
        payload.primary_agent_id =
          detailsForm.primary_agent_id === ""
            ? ""
            : Number(detailsForm.primary_agent_id);
      }

      const response = await api.patch(`/api/customers/${customer.id}`, payload);
      const updatedCustomer = response.data?.customer ?? customer;

      let nextPrimaryAgent = updatedCustomer.primaryAgent ?? customer.primaryAgent ?? null;
      if (isAdmin) {
        if (detailsForm.primary_agent_id === "") {
          nextPrimaryAgent = null;
        } else {
          const selectedAgent = agents.find(
            (agent) => String(agent.id) === detailsForm.primary_agent_id
          );
          if (selectedAgent) {
            nextPrimaryAgent = selectedAgent;
          }
        }
      }

      setCustomer((prev) => ({
        ...prev,
        ...updatedCustomer,
        primaryAgent: nextPrimaryAgent || null,
      }));

      setDropboxLink((prev) => {
        if (!prev) {
          return prev;
        }
        const nextCustomer = {
          ...(prev.customer ?? {}),
          dropboxFolderPath:
            updatedCustomer.dropboxFolderPath ?? prev.customer?.dropboxFolderPath ?? null,
        };
        return { ...prev, customer: nextCustomer };
      });

      setDetailsSuccess(response.data?.message || "Customer updated successfully");
      setEditingDetails(false);
    } catch (err) {
      const validationMessage = Array.isArray(err.response?.data?.errors)
        ? err.response.data.errors[0]?.msg
        : null;
      const message =
        validationMessage || err.response?.data?.error || err.message || "Unable to update customer";
      setDetailsError(message);
    } finally {
      setDetailsSaving(false);
    }
  };

  const retryDropboxProvisioning = useCallback(async () => {
    if (!customerRecordId) return;
    setDropboxActionLoading(true);
    setDropboxRetryMessage("");
    setDropboxRetryError("");
    try {
      const response = await api.post(
        `/api/customers/${customerRecordId}/provision-dropbox`
      );
      if (response.data?.customer) {
        setCustomer((prev) => ({ ...prev, ...response.data.customer }));
      }
      setDropboxRetryMessage(
        "Dropbox provisioning has been enqueued. This may take up to a minute."
      );
      await fetchDropboxLink();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.message ||
        "Unable to trigger Dropbox provisioning";
      setDropboxRetryError(message);
    } finally {
      setDropboxActionLoading(false);
    }
  }, [customerRecordId, fetchDropboxLink]);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [customerRes] = await Promise.all([api.get(`/api/customers/${id}`)]);
      setCustomer(customerRes.data);
      await Promise.all([
        fetchDropboxLink(),
        refreshNotes(),
        refreshTasks(),
        refreshLoans(),
        refreshAgents(),
      ]);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load customer";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchDropboxLink, id, refreshAgents, refreshLoans, refreshNotes, refreshTasks]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    if (dropboxProvisioningStatus === "ok") {
      setDropboxRetryMessage("");
      setDropboxRetryError("");
      setDropboxActionLoading(false);
    }
  }, [dropboxProvisioningStatus]);

  useEffect(() => {
    if (templateModalOpen) {
      fetchTemplates();
      setTemplateMessage("");
      setTemplateError("");
    }
  }, [fetchTemplates, templateModalOpen]);

  const addNote = async () => {
    if (!noteInput.trim()) {
      setNoteError("Note is required");
      return;
    }
    setNotesLoading(true);
    setNoteError("");
    try {
      const response = await api.post(`/api/customers/${id}/notes`, { note: noteInput.trim() });
      setNotes((prev) => [response.data, ...prev]);
      setNoteInput("");
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save note";
      setNoteError(message);
    } finally {
      setNotesLoading(false);
    }
  };

  const notesView = useMemo(() => {
    return notes.map((item) => ({
      id: item.id,
      author: item.author?.name || item.author?.email || "Unknown",
      timestamp: formatDate(item.created_at),
      note: item.note,
    }));
  }, [notes]);

  const loansView = useMemo(() => {
    return loans.map((loan) => ({
      id: loan.id,
      bank: loan.bank?.name || loan.bank_name || "—",
      status: loan.status || "—",
      aging: typeof loan.aging_days === "number" ? loan.aging_days : 0,
      applied: formatNumber(loan.applied_amount),
      approved: formatNumber(loan.approved_amount),
      roi: loan.rate_of_interest === null || typeof loan.rate_of_interest === "undefined"
        ? "—"
        : `${loan.rate_of_interest}%`,
      updated: formatDate(loan.updated_at || loan.created_at),
    }));
  }, [loans]);

  const openDocuments = () => {
    navigate(`/documents?customer_id=${id}`);
  };

  const resetTaskForm = useCallback(() => {
    setTaskForm({ title: "", due_on: "", remind_on: "", notes: "" });
    setEditingTaskId(null);
    setTaskError("");
  }, []);

  const handleTaskChange = (event) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitTask = async (event) => {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      setTaskError("Title is required");
      return;
    }
    setTaskSaving(true);
    setTaskError("");
    try {
      if (editingTaskId) {
        await api.patch(`/api/tasks/${editingTaskId}`, {
          title: taskForm.title.trim(),
          notes: taskForm.notes || "",
          due_on: taskForm.due_on ? taskForm.due_on : null,
          remind_on: taskForm.remind_on ? taskForm.remind_on : null,
        });
      } else {
        const payload = {
          title: taskForm.title.trim(),
        };
        if (taskForm.notes.trim()) {
          payload.notes = taskForm.notes.trim();
        }
        if (taskForm.due_on) {
          payload.due_on = taskForm.due_on;
        }
        if (taskForm.remind_on) {
          payload.remind_on = taskForm.remind_on;
        }
        await api.post(`/api/customers/${id}/tasks`, payload);
      }
      resetTaskForm();
      await refreshTasks();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save task";
      setTaskError(message);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || "",
      due_on: toInputDate(task.due_on),
      remind_on: toInputDate(task.remind_on),
      notes: task.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelTaskEditing = () => {
    resetTaskForm();
  };

  const markTaskCompleted = async (taskId) => {
    setCompletingTaskId(taskId);
    setTaskError("");
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "completed" });
      await refreshTasks();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to complete task";
      setTaskError(message);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleOpenTemplateModal = () => {
    setTemplateModalOpen(true);
    setTemplateSelection({ templateId: "", assigneeMode: "default" });
  };

  const handleCloseTemplateModal = () => {
    setTemplateModalOpen(false);
  };

  const applyTemplate = async (event) => {
    event.preventDefault();
    if (!templateSelection.templateId) {
      setTemplateError("Select a template to apply");
      return;
    }

    setTemplateLoading(true);
    setTemplateError("");
    setTemplateMessage("");

    try {
      const payload = { template_id: templateSelection.templateId };
      if (templateSelection.assigneeMode === "self" && user?.id) {
        payload.assignee_id = user.id;
      }
      const response = await api.post(
        `/api/customers/${id}/tasks/templates/apply`,
        payload
      );
      const created = Array.isArray(response.data?.created_task_ids)
        ? response.data.created_task_ids.length
        : 0;
      const skipped = Array.isArray(response.data?.skipped_titles)
        ? response.data.skipped_titles.length
        : 0;
      setTemplateMessage(
        `Created ${created} task${created === 1 ? "" : "s"}; skipped ${skipped}.`
      );
      await refreshTasks();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to apply template";
      setTemplateError(message);
    } finally {
      setTemplateLoading(false);
    }
  };

  if (loading) {
    return <p>Loading customer…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!customer) {
    return <p className="text-sm text-gray-600">Customer not found.</p>;
  }

  const dropboxPath = dropboxLink?.customer?.dropboxFolderPath || customer.dropboxFolderPath;
  const dropboxStatus = dropboxProvisioningStatus.toLowerCase();
  const isDropboxReady = dropboxStatus === "ok";
  const dropboxLastError =
    dropboxLink?.customer?.dropboxLastError ?? customer.dropboxLastError ?? "";
  const shouldShowDropboxBanner = dropboxStatus !== "ok";
  let dropboxBannerMessage = "Dropbox link is setting up.";
  if (dropboxStatus === "failed") {
    dropboxBannerMessage = dropboxLastError
      ? `Dropbox setup failed: ${dropboxLastError}`
      : "Dropbox setup failed. Retry the provisioning to refresh access.";
  } else if (dropboxStatus === "pending") {
    dropboxBannerMessage = "Dropbox link is being provisioned. You can retry if needed.";
  }
  const dropboxBannerClasses =
    dropboxStatus === "failed"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const shouldShowRetryButton = dropboxStatus !== "ok";
  const handleOpenDeleteModal = useCallback(() => {
    setDeleteModalOpen(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
  }, []);

  const handleCustomerDeleted = useCallback(
    ({ dropboxDeleted }) => {
      showToast(
        "success",
        dropboxDeleted
          ? "Customer and Dropbox folder deleted."
          : "Customer and related data deleted."
      );
      navigate("/customers");
    },
    [navigate, showToast]
  );

  return (
    <div className="space-y-8 pb-6">
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="font-mono text-xs text-gray-500">{customer.customer_id}</p>
            <p className="text-xs text-gray-500 break-all">
              Dropbox folder: {dropboxPath || "Not yet created"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {canEditCustomer && !editingDetails && (
              <button
                type="button"
                onClick={beginEditingDetails}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 sm:w-auto"
              >
                <FiEdit3 aria-hidden="true" /> Edit details
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenDeleteModal}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 sm:w-auto"
              >
                <FiTrash2 aria-hidden="true" /> Delete customer
              </button>
            )}
            <button
              type="button"
              onClick={openDocuments}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              📁 View Files
            </button>
          </div>
        </header>

        {shouldShowDropboxBanner && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${dropboxBannerClasses}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex-1">{dropboxBannerMessage}</p>
              {shouldShowRetryButton && (
                <button
                  type="button"
                  onClick={retryDropboxProvisioning}
                  disabled={dropboxActionLoading}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-current px-4 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {dropboxActionLoading ? "Retrying…" : "Retry Dropbox setup"}
                </button>
              )}
            </div>
            {dropboxRetryMessage && (
              <p className="mt-2 text-xs font-medium text-green-700">{dropboxRetryMessage}</p>
            )}
            {dropboxRetryError && (
              <p className="mt-2 text-xs font-medium text-red-700">{dropboxRetryError}</p>
            )}
          </div>
        )}

        {detailsSuccess && !editingDetails && (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
            {detailsSuccess}
          </p>
        )}

        {editingDetails ? (
          <form onSubmit={submitDetails} className="space-y-4">
            {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</span>
                <input
                  name="name"
                  value={detailsForm.name}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</span>
                <select
                  name="status"
                  value={detailsForm.status}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!statuses.length}
                >
                  {statuses.length === 0 && (
                    <option value={detailsForm.status || ""}>
                      {detailsForm.status || "Loading statuses…"}
                    </option>
                  )}
                  {statuses.map((status) => (
                    <option key={status.id} value={status.name}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</span>
                <input
                  name="phone"
                  value={detailsForm.phone}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</span>
                <input
                  name="email"
                  type="email"
                  value={detailsForm.email}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Flat No.</span>
                <input
                  name="flat_no"
                  value={detailsForm.flat_no}
                  onChange={handleDetailsChange}
                  maxLength={50}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                <textarea
                  name="address"
                  rows={3}
                  value={detailsForm.address}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dropbox folder path</span>
                <input
                  name="dropboxFolderPath"
                  value={detailsForm.dropboxFolderPath}
                  onChange={handleDetailsChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/Apps/FinFlow/customer-folder"
                />
              </label>
              {isAdmin && (
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Primary agent</span>
                  <select
                    name="primary_agent_id"
                    value={detailsForm.primary_agent_id}
                    onChange={handleDetailsChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={detailsSaving}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {detailsSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={cancelDetailsEditing}
                disabled={detailsSaving}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
              <p className="text-base text-gray-900">{customer.status}</p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Flat No.</p>
              <p className="text-base text-gray-900">{customer.flat_no || "—"}</p>
            </div>
            {isAdmin && (
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Primary agent</p>
                <p className="text-base text-gray-900">
                  {customer.primaryAgent?.name || customer.primaryAgent?.email || "Unassigned"}
                </p>
              </div>
            )}
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
              <p>{customer.email || "—"}</p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
              <p>{customer.phone || "—"}</p>
            </div>
            <div className="md:col-span-2 space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</p>
              <p>{customer.address || "—"}</p>
            </div>
            <div className="md:col-span-2 space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dropbox folder</p>
              <p className="break-all font-mono text-xs text-gray-600">
                {dropboxPath || "Folder will be created on demand"}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Notes</h2>
        </header>
        <div className="space-y-2">
          <textarea
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add a note for this customer"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={addNote}
              disabled={notesLoading}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {notesLoading ? "Saving…" : "Add Note"}
            </button>
            {noteError && <span className="text-xs text-red-600">{noteError}</span>}
          </div>
        </div>
        <div className="space-y-3">
          {notesView.length === 0 ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            notesView.map((item) => (
              <article key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <header className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{item.author}</span>
                  <time>{item.timestamp}</time>
                </header>
                <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{item.note}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
            <p className="text-sm text-gray-500">Track follow-ups and reminders.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenTemplateModal}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-blue-600 px-4 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <FiPlus aria-hidden="true" />
              Apply Template
            </button>
          </div>
        </header>

        <form onSubmit={submitTask} className="space-y-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="task-title" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Title
              </label>
              <input
                id="task-title"
                name="title"
                value={taskForm.title}
                onChange={handleTaskChange}
                placeholder="Collect income proof"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due on</span>
                <input
                  type="date"
                  name="due_on"
                  value={taskForm.due_on}
                  onChange={handleTaskChange}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remind on</span>
                <input
                  type="date"
                  name="remind_on"
                  value={taskForm.remind_on}
                  onChange={handleTaskChange}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</span>
            <textarea
              name="notes"
              rows={3}
              value={taskForm.notes}
              onChange={handleTaskChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional context for the assignee"
            />
          </label>
          {taskError && <p className="text-xs font-medium text-red-600">{taskError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={taskSaving}
              className="inline-flex h-10 items-center justify-center rounded-full bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {taskSaving ? "Saving…" : editingTaskId ? "Update Task" : "Add Task"}
            </button>
            {editingTaskId && (
              <button
                type="button"
                onClick={cancelTaskEditing}
                className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {taskLoading ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              Loading tasks…
            </p>
          ) : tasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No tasks yet. Create your first action above.
            </p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        {task.status !== "pending" && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                            {task.status}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>Due {formatDate(task.due_on)}</span>
                        {task.remind_on && (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <FiBell aria-hidden="true" />
                            Remind {formatDate(task.remind_on)}
                          </span>
                        )}
                        {task.assignee && (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            Assigned to {task.assignee.name || task.assignee.email}
                          </span>
                        )}
                      </div>
                      {task.notes ? (
                        <p className="text-xs text-gray-600 whitespace-pre-line">{task.notes}</p>
                      ) : null}
                    </div>
                    {task.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditTask(task)}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
                        >
                          <FiEdit3 aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => markTaskCompleted(task.id)}
                          disabled={completingTaskId === task.id}
                          className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <FiCheckCircle aria-hidden="true" /> Done
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Loans</h2>
            <p className="text-sm text-gray-500">
              Manage every loan linked to this customer.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowLoanForm((prev) => !prev)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              {showLoanForm ? "Close" : "Add New Loan"}
            </button>
          </div>
        </header>

        {showLoanForm && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <LoanForm
              onSuccess={() => {
                setShowLoanForm(false);
                refreshLoans();
              }}
              initialCustomerId={customer.id}
              disableCustomerSelection
              customerName={`${customer.customer_id} — ${customer.name}`}
              showSuccessAlert={false}
            />
          </div>
        )}

        {loansView.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No loans recorded for this customer.
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Bank</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applied</th>
                      <th className="px-4 py-3">Approved</th>
                      <th className="px-4 py-3">ROI</th>
                      <th className="px-4 py-3">Last updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loansView.map((loan) => (
                      <tr
                        key={loan.id}
                        className="cursor-pointer transition hover:bg-blue-50/60"
                        onClick={() => setLoanDrawerId(loan.id)}
                      >
                        <td className="px-4 py-3">{loan.bank}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-800">{loan.status}</span>
                            <span className="text-xs text-gray-500">Aging: {loan.aging} days in {loan.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{loan.applied}</td>
                        <td className="px-4 py-3">{loan.approved}</td>
                        <td className="px-4 py-3">{loan.roi}</td>
                        <td className="px-4 py-3">{loan.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {loansView.map((loan) => (
                <article
                  key={loan.id}
                  onClick={() => setLoanDrawerId(loan.id)}
                  className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{loan.bank}</h3>
                      <p className="text-xs text-gray-500">Updated {loan.updated}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {loan.status}
                    </span>
                  </header>
                  <p className="mt-2 text-xs font-medium text-gray-500">Aging: {loan.aging} days in {loan.status}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Applied</dt>
                      <dd className="text-gray-800">{loan.applied}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Approved</dt>
                      <dd className="text-gray-800">{loan.approved}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">ROI</dt>
                      <dd className="text-gray-800">{loan.roi}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {templateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Apply task template</h3>
                <p className="text-sm text-gray-500">Create a checklist in one click.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseTemplateModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300"
              >
                ×
              </button>
            </header>
            <form onSubmit={applyTemplate} className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Template</span>
                <select
                  value={templateSelection.templateId}
                  onChange={(event) =>
                    setTemplateSelection((prev) => ({
                      ...prev,
                      templateId: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>
                    {templateLoading ? "Loading templates…" : "Select a template"}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assignee</span>
                <select
                  value={templateSelection.assigneeMode}
                  onChange={(event) =>
                    setTemplateSelection((prev) => ({
                      ...prev,
                      assigneeMode: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="default">Default (customer owner)</option>
                  <option value="self">Assign to me</option>
                </select>
              </label>
              {templateError && <p className="text-xs font-medium text-red-600">{templateError}</p>}
              {templateMessage && <p className="text-xs font-medium text-emerald-600">{templateMessage}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 px-4 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={templateLoading}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {templateLoading ? "Applying…" : "Apply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LoanDrawer
        loanId={loanDrawerId}
        open={Boolean(loanDrawerId)}
        onClose={() => setLoanDrawerId(null)}
        onSaved={refreshLoans}
      />
      {isAdmin && (
        <CustomerDeleteModal
          open={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          customer={customer}
          onDeleted={handleCustomerDeleted}
        />
      )}
    </div>
  );
}

