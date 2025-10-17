import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiEdit3, FiTrash2 } from "react-icons/fi";

import LoanForm from "../components/LoanForm";
import LoanDrawer from "../components/LoanDrawer";
import CustomerTabs from "../components/CustomerTabs";
import FloatingAddButton from "../components/FloatingAddButton";
import TaskList from "../components/TaskList";
import NoteList from "../components/NoteList";
import LoanList from "../components/LoanList";
import DocumentList from "../components/DocumentList";
import CustomerDeleteModal from "../components/CustomerDeleteModal.jsx";
import { AuthContext } from "../context/AuthContext";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { uploadCustomerDocuments } from "../services/documents";

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

function statusBadgeClasses(status) {
  if (!status) return "bg-gray-100 text-gray-700";
  const normalized = status.toLowerCase();
  if (["ok", "approved", "active"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["failed", "inactive", "closed"].includes(normalized)) {
    return "bg-red-100 text-red-700";
  }
  if (["pending", "processing", "new"].includes(normalized)) {
    return "bg-yellow-100 text-yellow-700";
  }
  return "bg-blue-100 text-blue-700";
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("tasks");

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
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesRefreshing, setNotesRefreshing] = useState(false);
  const [notesFetchError, setNotesFetchError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskListError, setTaskListError] = useState("");
  const [taskFormError, setTaskFormError] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    due_on: "",
    remind_on: "",
    notes: "",
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
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
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [documentSuccess, setDocumentSuccess] = useState("");
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const documentInputRef = useRef(null);

  const customerRecordId = customer?.id ?? null;
  const dropboxProvisioningStatus =
    dropboxLink?.customer?.dropboxProvisioningStatus ??
    customer?.dropboxProvisioningStatus ??
    "pending";

  const tabs = useMemo(
    () => [
      { id: "tasks", label: "Tasks" },
      { id: "notes", label: "Notes" },
      { id: "loans", label: "Loans" },
      { id: "documents", label: "Documents" },
      { id: "details", label: "Details" },
    ],
    []
  );

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
      .then((response) => setStatuses(Array.isArray(response.data) ? response.data : []))
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
    setNotesRefreshing(true);
    setNotesFetchError("");
    try {
      const response = await api.get(`/api/customers/${id}/notes`);
      setNotes(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Couldn't load notes right now.";
      setNotes([]);
      setNotesFetchError(message);
    } finally {
      setNotesRefreshing(false);
    }
  }, [id]);

  const refreshTasks = useCallback(async () => {
    setTaskLoading(true);
    setTaskListError("");
    try {
      const response = await api.get(`/api/customers/${id}/tasks`);
      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to load tasks";
      setTaskListError(message);
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
        dropboxLink?.customer?.dropboxFolderPath ?? customer.dropboxFolderPath ?? "",
      primary_agent_id: customer.primary_agent_id ? String(customer.primary_agent_id) : "",
    });
    setDetailsError("");
    setDetailsSuccess("");
    setEditingDetails(true);
    setActiveTab("details");
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
          detailsForm.primary_agent_id === "" ? "" : Number(detailsForm.primary_agent_id);
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

  const openTaskModal = useCallback(() => {
    setTaskForm({ title: "", due_on: "", remind_on: "", notes: "" });
    setEditingTaskId(null);
    setTaskFormError("");
    setTaskModalOpen(true);
  }, []);

  const handleTaskChange = (event) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitTask = async (event) => {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      setTaskFormError("Title is required");
      return;
    }
    setTaskSaving(true);
    setTaskFormError("");
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
      setTaskModalOpen(false);
      setTaskForm({ title: "", due_on: "", remind_on: "", notes: "" });
      setEditingTaskId(null);
      await refreshTasks();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save task";
      setTaskFormError(message);
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
    setTaskFormError("");
    setTaskModalOpen(true);
  };

  const cancelTaskEditing = () => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setTaskForm({ title: "", due_on: "", remind_on: "", notes: "" });
    setTaskFormError("");
  };

  const markTaskCompleted = async (taskId) => {
    setCompletingTaskId(taskId);
    setTaskFormError("");
    try {
      await api.patch(`/api/tasks/${taskId}`, { status: "completed" });
      await refreshTasks();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to complete task";
      showToast("error", message);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!noteInput.trim()) {
      setNoteError("Note is required");
      return;
    }
    setNotesSaving(true);
    setNoteError("");
    setNotesFetchError("");
    try {
      const response = await api.post(`/api/customers/${id}/notes`, { note: noteInput.trim() });
      setNotes((prev) => [response.data, ...prev]);
      setNoteInput("");
      setNoteModalOpen(false);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Unable to save note";
      setNoteError(message);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleRetryNotes = useCallback(() => {
    refreshNotes();
  }, [refreshNotes]);

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

  const loansView = useMemo(() => {
    return loans.map((loan) => ({
      id: loan.id,
      bank: loan.bank?.name || loan.bank_name || "—",
      status: loan.status || "—",
      aging: typeof loan.aging_days === "number" ? loan.aging_days : 0,
      applied: formatNumber(loan.applied_amount),
      approved: formatNumber(loan.approved_amount),
      roi:
        loan.rate_of_interest === null || typeof loan.rate_of_interest === "undefined"
          ? "—"
          : `${loan.rate_of_interest}%`,
      updated: formatDate(loan.updated_at || loan.created_at),
    }));
  }, [loans]);

  const openDocuments = () => {
    navigate(`/documents?customer_id=${id}`);
  };

  const handleFileChange = (event) => {
    setDocumentError("");
    setDocumentSuccess("");
    if (event.target.files && !event.target.files.length) {
      setDocumentError("Select at least one file");
    }
  };

  const handleUploadDocuments = async (event) => {
    event.preventDefault();
    const files = documentInputRef.current?.files ? Array.from(documentInputRef.current.files) : [];
    if (!files.length) {
      setDocumentError("Select at least one file");
      return;
    }
    setUploadingDocuments(true);
    setDocumentError("");
    try {
      await uploadCustomerDocuments(customer.id, files, {
        path:
          dropboxLink?.customer?.dropboxFolderPath || customer.dropboxFolderPath || undefined,
      });
      setDocumentSuccess("Upload complete");
      setDocumentModalOpen(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }
      showToast("success", "Upload complete");
      await fetchDropboxLink();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Upload failed";
      setDocumentError(message);
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleFabClick = () => {
    switch (activeTab) {
      case "tasks":
        openTaskModal();
        break;
      case "notes":
        setNoteInput("");
        setNoteError("");
        setNoteModalOpen(true);
        break;
      case "loans":
        setLoanModalOpen(true);
        break;
      case "documents":
        setDocumentError("");
        setDocumentSuccess("");
        setDocumentModalOpen(true);
        break;
      case "details":
        if (canEditCustomer) {
          beginEditingDetails();
        }
        break;
      default:
        break;
    }
  };

  const dropboxPath = dropboxLink?.customer?.dropboxFolderPath || customer?.dropboxFolderPath;
  const dropboxStatus = dropboxProvisioningStatus.toLowerCase();
  const dropboxLastError =
    dropboxLink?.customer?.dropboxLastError ?? customer?.dropboxLastError ?? "";
  const dropboxBannerMessage = useMemo(() => {
    if (dropboxStatus === "failed") {
      return (
        dropboxLastError || "Dropbox setup failed. Retry the provisioning to refresh access."
      );
    }
    if (dropboxStatus === "pending") {
      return "Dropbox link is being provisioned. You can retry if needed.";
    }
    if (dropboxStatus === "ok") {
      return "Dropbox folder is ready.";
    }
    return "Dropbox link is setting up.";
  }, [dropboxLastError, dropboxStatus]);

  if (loading) {
    return <p className="px-4 py-8 text-sm text-gray-600">Loading customer…</p>;
  }

  if (error) {
    return <p className="px-4 py-8 text-sm text-red-600">{error}</p>;
  }

  if (!customer) {
    return <p className="px-4 py-8 text-sm text-gray-600">Customer not found.</p>;
  }

  const notesView = notes.map((item) => ({
    id: item.id,
    author: item.author?.name || item.author?.email || "Unknown",
    timestamp: formatDate(item.created_at),
    body: item.note,
  }));

  const headerStatus = customer.status || "Pending";

  const quickActions = [
    { id: "tasks", label: "+ Task", onClick: openTaskModal },
    { id: "notes", label: "+ Note", onClick: () => setNoteModalOpen(true) },
    { id: "loans", label: "+ Loan", onClick: () => setLoanModalOpen(true) },
    { id: "documents", label: "+ File", onClick: () => setDocumentModalOpen(true) },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
            aria-label="Go back"
          >
            <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {customer.customer_id}
              </p>
              <h1 className="truncate text-lg font-semibold text-gray-900">{customer.name}</h1>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(
                headerStatus
              )}`}
            >
              {headerStatus}
            </span>
          </div>
        </div>
        <div className="border-t border-gray-100 bg-white">
          <div className="mx-auto flex max-w-screen-md items-center gap-2 overflow-x-auto px-4 py-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className="inline-flex flex-shrink-0 items-center rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <CustomerTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <main className="mx-auto mt-4 flex max-w-screen-md flex-col gap-6 px-4">
        {activeTab === "tasks" && (
          <section className="space-y-3">
            <div className="p-3 rounded-lg bg-white text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">Tasks</h2>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  className="inline-flex items-center rounded-full border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50"
                >
                  Apply template
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Track every follow-up in a compact view. Use the + button to add a new task.
              </p>
            </div>
            <TaskList
              tasks={tasks}
              loading={taskLoading}
              error={taskListError}
              onRetry={refreshTasks}
              onEdit={handleEditTask}
              onComplete={markTaskCompleted}
              completingTaskId={completingTaskId}
              formatDate={formatDate}
            />
          </section>
        )}

        {activeTab === "notes" && (
          <section className="space-y-3">
            <div className="p-3 rounded-lg bg-white text-sm shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Notes</h2>
              <p className="mt-1 text-xs text-gray-500">
                Leave quick context for yourself or teammates. Recent notes appear first.
              </p>
            </div>
            <NoteList
              notes={notesView}
              loading={notesRefreshing}
              error={notesFetchError}
              onRetry={handleRetryNotes}
            />
          </section>
        )}

        {activeTab === "loans" && (
          <section className="space-y-3">
            <div className="p-3 rounded-lg bg-white text-sm shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Loans</h2>
              <p className="mt-1 text-xs text-gray-500">
                Tap any loan to view details or update its status.
              </p>
            </div>
            <LoanList loans={loansView} onSelect={setLoanDrawerId} />
          </section>
        )}

        {activeTab === "documents" && (
          <section className="space-y-3">
            <div className="p-3 rounded-lg bg-white text-sm shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Documents</h2>
              <p className="mt-1 text-xs text-gray-500">
                Manage uploads without leaving the customer view. Use the + button to upload files.
              </p>
            </div>
            <DocumentList
              path={dropboxPath || ""}
              status={dropboxProvisioningStatus}
              message={dropboxRetryError || dropboxRetryMessage || dropboxBannerMessage}
              onOpenExplorer={openDocuments}
              onRetry={dropboxStatus === "ok" ? undefined : retryDropboxProvisioning}
              retrying={dropboxActionLoading}
            />
          </section>
        )}

        {activeTab === "details" && (
          <section className="space-y-3">
            <div className="p-3 rounded-lg bg-white text-sm shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Customer Details</h2>
                  <p className="mt-1 text-xs text-gray-500">Review and edit contact information.</p>
                </div>
                {canEditCustomer && !editingDetails && (
                  <button
                    type="button"
                    onClick={beginEditingDetails}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                  >
                    <FiEdit3 className="h-4 w-4" aria-hidden="true" /> Edit
                  </button>
                )}
              </div>
            </div>
            {detailsSuccess && !editingDetails && (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                {detailsSuccess}
              </p>
            )}
            {editingDetails ? (
              <form onSubmit={submitDetails} className="space-y-3">
                {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
                <div className="grid grid-cols-1 gap-3">
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
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</span>
                    <textarea
                      name="address"
                      rows={3}
                      value={detailsForm.address}
                      onChange={handleDetailsChange}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
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
                    <label className="flex flex-col gap-1">
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
                <div className="flex flex-col gap-2 sm:flex-row">
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
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                  <p className="text-base text-gray-900">{customer.status}</p>
                </div>
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Flat No.</p>
                  <p className="text-base text-gray-900">{customer.flat_no || "—"}</p>
                </div>
                {isAdmin && (
                  <div className="p-3 rounded-lg bg-white shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Primary agent</p>
                    <p className="text-base text-gray-900">
                      {customer.primaryAgent?.name || customer.primaryAgent?.email || "Unassigned"}
                    </p>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                  <p>{customer.email || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
                  <p>{customer.phone || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Address</p>
                  <p>{customer.address || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dropbox folder</p>
                  <p className="break-all font-mono text-xs text-gray-600">
                    {dropboxPath || "Folder will be created on demand"}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {canEditCustomer && (
                <button
                  type="button"
                  onClick={beginEditingDetails}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900"
                >
                  <FiEdit3 className="h-4 w-4" aria-hidden="true" /> Edit details
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenDeleteModal}
                  className="inline-flex items-center gap-1 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                >
                  <FiTrash2 className="h-4 w-4" aria-hidden="true" /> Delete customer
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      <FloatingAddButton
        label={`Add ${activeTab === "details" ? "details" : activeTab.slice(0, -1)}`}
        onClick={handleFabClick}
      />

      {taskModalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-gray-900/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTaskId ? "Edit task" : "Add task"}
                </h3>
                <p className="text-sm text-gray-500">Keep teammates aligned with quick action items.</p>
              </div>
              <button
                type="button"
                onClick={cancelTaskEditing}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            {taskFormError && <p className="mb-3 text-sm text-red-600">{taskFormError}</p>}
            <form onSubmit={submitTask} className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</span>
                <input
                  name="title"
                  value={taskForm.title}
                  onChange={handleTaskChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Follow up with customer"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due date</span>
                  <input
                    type="date"
                    name="due_on"
                    value={taskForm.due_on}
                    onChange={handleTaskChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remind on</span>
                  <input
                    type="date"
                    name="remind_on"
                    value={taskForm.remind_on}
                    onChange={handleTaskChange}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
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
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelTaskEditing}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSaving}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {taskSaving ? "Saving…" : editingTaskId ? "Update Task" : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {noteModalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-gray-900/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add note</h3>
                <p className="text-sm text-gray-500">Share quick updates or context with the team.</p>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            {noteError && <p className="mb-3 text-sm text-red-600">{noteError}</p>}
            <form onSubmit={addNote} className="space-y-3">
              <textarea
                value={noteInput}
                onChange={(event) => setNoteInput(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a note for this customer"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={notesSaving}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-green-600 px-6 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {notesSaving ? "Saving…" : "Add Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loanModalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-gray-900/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add loan</h3>
                <p className="text-sm text-gray-500">Capture loan applications linked to this customer.</p>
              </div>
              <button
                type="button"
                onClick={() => setLoanModalOpen(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <LoanForm
                onSuccess={() => {
                  setLoanModalOpen(false);
                  refreshLoans();
                }}
                initialCustomerId={customer.id}
                disableCustomerSelection
                customerName={`${customer.customer_id} — ${customer.name}`}
                showSuccessAlert={false}
              />
            </div>
          </div>
        </div>
      )}

      {documentModalOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-gray-900/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload documents</h3>
                <p className="text-sm text-gray-500">Files keep their original names in Dropbox.</p>
              </div>
              <button
                type="button"
                onClick={() => setDocumentModalOpen(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            {documentError && <p className="mb-2 text-sm text-red-600">{documentError}</p>}
            {documentSuccess && <p className="mb-2 text-sm text-green-600">{documentSuccess}</p>}
            <form onSubmit={handleUploadDocuments} className="space-y-3">
              <input
                ref={documentInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDocumentModalOpen(false)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDocuments}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {uploadingDocuments ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                onClick={() => setTemplateModalOpen(false)}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </header>
            <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Template</span>
                <select
                  value={templateSelection.templateId}
                  onChange={(event) =>
                    setTemplateSelection((prev) => ({
                      ...prev,
                      templateId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a template…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assignee</span>
                <select
                  value={templateSelection.assigneeMode}
                  onChange={(event) =>
                    setTemplateSelection((prev) => ({
                      ...prev,
                      assigneeMode: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="default">Keep template assignee</option>
                  <option value="self">Assign to me</option>
                </select>
              </label>
              {templateError && <p className="text-sm text-red-600">{templateError}</p>}
              {templateMessage && <p className="text-sm text-green-600">{templateMessage}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-gray-300 px-6 text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:text-gray-900 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={templateLoading}
                  onClick={async () => {
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
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {templateLoading ? "Applying…" : "Apply template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loanDrawerId && (
        <LoanDrawer loanId={loanDrawerId} onClose={() => setLoanDrawerId(null)} />
      )}

      {deleteModalOpen && (
        <CustomerDeleteModal
          isOpen={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          customer={customer}
          onDeleted={handleCustomerDeleted}
        />
      )}
    </div>
  );
}
