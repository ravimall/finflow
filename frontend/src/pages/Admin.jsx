import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

function StatusList({ title, items, onRename, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState("");

  const startEdit = (item) => {
    setEditing(item.id);
    setValue(item.name);
  };

  const cancel = () => {
    setEditing(null);
    setValue("");
  };

  return (
    <section className="space-y-3">
      {title ? <h3 className="text-lg font-semibold text-gray-900 md:text-xl">{title}</h3> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3"
          >
            {editing === item.id ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
                    onClick={() => {
                      onRename(item.id, value);
                      cancel();
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100"
                    onClick={cancel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-700 md:text-base">{item.name}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-blue-200 px-4 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50"
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 px-4 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:bg-red-50"
                    onClick={() => onDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            No values configured.
          </li>
        )}
      </ul>
    </section>
  );
}

function AddItemForm({ label, onSubmit, placeholder }) {
  const [value, setValue] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
      >
        Add {label}
      </button>
    </form>
  );
}

function TemplateItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    title: item.title,
    offset_days: item.offset_days ?? 0,
    notes: item.notes ?? "",
    default_assignee_role: item.default_assignee_role ?? "",
    sort_order: item.sort_order ?? 0,
  }));

  useEffect(() => {
    setForm({
      title: item.title,
      offset_days: item.offset_days ?? 0,
      notes: item.notes ?? "",
      default_assignee_role: item.default_assignee_role ?? "",
      sort_order: item.sort_order ?? 0,
    });
  }, [
    item.title,
    item.offset_days,
    item.notes,
    item.default_assignee_role,
    item.sort_order,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      offset_days: Number.parseInt(form.offset_days, 10) || 0,
      notes: form.notes.trim() ? form.notes.trim() : null,
      default_assignee_role: form.default_assignee_role || null,
      sort_order:
        form.sort_order === "" || Number.isNaN(Number.parseInt(form.sort_order, 10))
          ? undefined
          : Number.parseInt(form.sort_order, 10),
    };

    const success = await onUpdate(item.id, payload);
    if (success) {
      setEditing(false);
    }
  };

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Due in (days)
              </span>
              <input
                type="number"
                value={form.offset_days}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, offset_days: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Default assignee
              </span>
              <select
                value={form.default_assignee_role}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    default_assignee_role: event.target.value,
                  }))
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keep assignee chosen when applying</option>
                <option value="admin">Assign to Admin</option>
                <option value="agent">Assign to Customer's Agent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sort order
              </span>
              <input
                type="number"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sort_order: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notes (optional)
            </span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
            >
              Save item
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              <span>
                Due in <span className="font-semibold">{item.offset_days}</span> day
                {item.offset_days === 1 ? "" : "s"}
              </span>
              {item.default_assignee_role ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                  Default: {item.default_assignee_role === "admin" ? "Admin" : "Agent"}
                </span>
              ) : null}
              {typeof item.sort_order === "number" ? (
                <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                  Order {item.sort_order}
                </span>
              ) : null}
            </div>
            {item.notes ? <p className="text-sm text-gray-600">{item.notes}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-blue-200 px-4 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 px-4 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function TemplateCard({
  template,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    name: template.name,
    description: template.description ?? "",
    is_active: template.is_active,
  }));
  const [itemForm, setItemForm] = useState({
    title: "",
    offset_days: 0,
    notes: "",
    default_assignee_role: "",
    sort_order: template.items?.length ?? 0,
  });

  useEffect(() => {
    setForm({
      name: template.name,
      description: template.description ?? "",
      is_active: template.is_active,
    });
  }, [template.name, template.description, template.is_active]);

  useEffect(() => {
    setItemForm((prev) => ({
      ...prev,
      sort_order: template.items?.length ?? prev.sort_order ?? 0,
    }));
  }, [template.items?.length]);

  const handleTemplateSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const success = await onUpdateTemplate(template.id, {
      name: form.name.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      is_active: form.is_active,
    });

    if (success) {
      setEditing(false);
    }
  };

  const handleAddItem = async (event) => {
    event.preventDefault();
    if (!itemForm.title.trim()) return;

    const payload = {
      title: itemForm.title.trim(),
      offset_days:
        itemForm.offset_days === ""
          ? 0
          : Number.parseInt(itemForm.offset_days, 10) || 0,
    };

    if (itemForm.notes.trim()) {
      payload.notes = itemForm.notes.trim();
    }

    if (itemForm.default_assignee_role) {
      payload.default_assignee_role = itemForm.default_assignee_role;
    }

    if (itemForm.sort_order !== "" && !Number.isNaN(Number.parseInt(itemForm.sort_order, 10))) {
      payload.sort_order = Number.parseInt(itemForm.sort_order, 10);
    }

    const success = await onAddItem(template.id, payload);
    if (success) {
      setItemForm({
        title: "",
        offset_days: 0,
        notes: "",
        default_assignee_role: "",
        sort_order: (template.items?.length ?? 0) + 1,
      });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {editing ? (
          <form onSubmit={handleTemplateSubmit} className="flex-1 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Template name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </span>
                <select
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: event.target.value === "active",
                    }))
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Description (optional)
              </span>
              <textarea
                value={form.description}
                rows={3}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
              >
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  template.is_active
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {template.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {template.description ? (
              <p className="text-sm text-gray-600">{template.description}</p>
            ) : (
              <p className="text-sm text-gray-500">No description provided.</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-blue-200 px-4 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:bg-blue-50"
            >
              Edit details
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              onUpdateTemplate(template.id, { is_active: !template.is_active })
            }
            className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-semibold uppercase tracking-wide text-gray-600 transition hover:bg-gray-100"
          >
            Mark {template.is_active ? "inactive" : "active"}
          </button>
          <button
            type="button"
            onClick={() => onDeleteTemplate(template.id)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-red-200 px-4 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:bg-red-50"
          >
            Delete template
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Checklist items
        </h4>
        <ul className="space-y-3">
          {template.items?.length ? (
            template.items.map((item) => (
              <TemplateItemRow
                key={item.id}
                item={item}
                onUpdate={(itemId, payload) => onUpdateItem(template.id, itemId, payload)}
                onDelete={(itemId) => onDeleteItem(template.id, itemId)}
              />
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No checklist items yet.
            </li>
          )}
        </ul>

        <form onSubmit={handleAddItem} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <h5 className="mb-3 text-sm font-semibold text-gray-700">Add checklist item</h5>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Title
              </span>
              <input
                value={itemForm.title}
                onChange={(event) =>
                  setItemForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Due in (days)
              </span>
              <input
                type="number"
                value={itemForm.offset_days}
                onChange={(event) =>
                  setItemForm((prev) => ({
                    ...prev,
                    offset_days: event.target.value,
                  }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Default assignee
              </span>
              <select
                value={itemForm.default_assignee_role}
                onChange={(event) =>
                  setItemForm((prev) => ({
                    ...prev,
                    default_assignee_role: event.target.value,
                  }))
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keep assignee chosen when applying</option>
                <option value="admin">Assign to Admin</option>
                <option value="agent">Assign to Customer's Agent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sort order
              </span>
              <input
                type="number"
                value={itemForm.sort_order}
                onChange={(event) =>
                  setItemForm((prev) => ({ ...prev, sort_order: event.target.value }))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notes (optional)
            </span>
            <textarea
              value={itemForm.notes}
              onChange={(event) =>
                setItemForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
            >
              Add item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewTemplateForm({ onCreate }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      is_active: form.is_active,
    };

    if (form.description.trim()) {
      payload.description = form.description.trim();
    }

    const success = await onCreate(payload);
    if (success) {
      setForm({ name: "", description: "", is_active: true });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">Create a task template</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Template name
          </span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. New Booking Checklist"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Status
          </span>
          <select
            value={form.is_active ? "active" : "inactive"}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                is_active: event.target.value === "active",
              }))
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Description (optional)
        </span>
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
          rows={3}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Short summary of what this template covers"
        />
      </label>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
        >
          Create template
        </button>
      </div>
    </form>
  );
}

export default function Admin() {
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [loanStatuses, setLoanStatuses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    setError("");
    Promise.all([
      api.get("/api/admin/config/statuses", { params: { type: "customer" } }),
      api.get("/api/admin/config/statuses", { params: { type: "loan" } }),
      api.get("/api/admin/config/banks"),
      api.get("/api/task-templates", { params: { include_items: true } }),
    ])
      .then(([customerRes, loanRes, bankRes, templateRes]) => {
        setCustomerStatuses(customerRes.data);
        setLoanStatuses(loanRes.data);
        setBanks(bankRes.data);
        const templateList = Array.isArray(templateRes.data)
          ? templateRes.data.map((template) => ({
              ...template,
              items: Array.isArray(template.items)
                ? [...template.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                : [],
            }))
          : [];
        setTemplates(templateList);
      })
      .catch((err) => setError(err.response?.data?.error || "Unable to load configuration"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddStatus = async (type, name) => {
    try {
      await api.post("/api/admin/config/statuses", { type, name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add status");
    }
  };

  const handleRenameStatus = async (id, name) => {
    try {
      await api.put(`/api/admin/config/statuses/${id}`, { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update status");
    }
  };

  const handleDeleteStatus = async (id) => {
    if (!window.confirm("Delete this status?")) return;
    try {
      await api.delete(`/api/admin/config/statuses/${id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete status");
    }
  };

  const handleAddBank = async (name) => {
    try {
      await api.post("/api/admin/config/banks", { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add bank");
    }
  };

  const handleRenameBank = async (id, name) => {
    try {
      await api.put(`/api/admin/config/banks/${id}`, { name });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update bank");
    }
  };

  const handleDeleteBank = async (id) => {
    if (!window.confirm("Delete this bank?")) return;
    try {
      await api.delete(`/api/admin/config/banks/${id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete bank");
    }
  };

  const handleCreateTemplate = async (payload) => {
    try {
      await api.post("/api/task-templates", payload);
      refresh();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create template");
      return false;
    }
  };

  const handleUpdateTemplate = async (id, updates) => {
    try {
      await api.patch(`/api/task-templates/${id}`, updates);
      refresh();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update template");
      return false;
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.delete(`/api/task-templates/${id}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete template");
    }
  };

  const handleAddTemplateItem = async (templateId, payload) => {
    try {
      await api.post(`/api/task-templates/${templateId}/items`, payload);
      refresh();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add template item");
      return false;
    }
  };

  const handleUpdateTemplateItem = async (templateId, itemId, payload) => {
    try {
      await api.patch(`/api/task-templates/${templateId}/items/${itemId}`, payload);
      refresh();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update template item");
      return false;
    }
  };

  const handleDeleteTemplateItem = async (templateId, itemId) => {
    if (!window.confirm("Delete this checklist item?")) return;
    try {
      await api.delete(`/api/task-templates/${templateId}/items/${itemId}`);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete template item");
    }
  };

  return (
    <div className="space-y-8 pb-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Configuration</h1>
        <p className="text-sm text-gray-600 md:text-base">Manage statuses and banks used throughout FinFlow.</p>
      </header>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <StatusList
            title="Customer statuses"
            items={customerStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("customer", name)} placeholder="New customer status" />
        </div>
        <div className="space-y-5">
          <StatusList
            title="Loan statuses"
            items={loanStatuses}
            onRename={handleRenameStatus}
            onDelete={handleDeleteStatus}
          />
          <AddItemForm label="status" onSubmit={(name) => handleAddStatus("loan", name)} placeholder="New loan status" />
        </div>
      </div>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-gray-900">Banks</h2>
        <StatusList title="" items={banks} onRename={handleRenameBank} onDelete={handleDeleteBank} />
        <AddItemForm label="bank" onSubmit={handleAddBank} placeholder="New bank name" />
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold text-gray-900">Task templates</h2>
        <p className="text-sm text-gray-600 md:text-base">
          Define reusable checklists that can be applied to a customer from the Tasks tab.
        </p>
        <NewTemplateForm onCreate={handleCreateTemplate} />
        <div className="space-y-4">
          {templates.length ? (
            templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUpdateTemplate={handleUpdateTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onAddItem={handleAddTemplateItem}
                onUpdateItem={handleUpdateTemplateItem}
                onDeleteItem={handleDeleteTemplateItem}
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
              No task templates yet. Create one to get started.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

