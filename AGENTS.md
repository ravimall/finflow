# AGENTS.md — FinFlow

Operational guide for AI coding agents working in this repository. Follow these rules to ship safe, traceable changes that match FinFlow’s architecture and current constraints.

---

## 0) TL;DR Guardrails

- **Never** rename or prefix filenames on Dropbox uploads. Keep **original names**.
- **Do not** create Dropbox **shared links** automatically.
- **Handle failing endpoints gracefully** in UI (notably: `GET /api/customers/:id/notes`).
- Add the **Flat No.** field end-to-end (DB → API → UI) and make **customer data editable** by **Admin** and the **assigned agent** only.
- **No horizontal scrolling** in the mobile Documents view; add responsive menu collapse.
- Keep **folder path** persisted in DB; never auto-null it during unrelated updates.

---

## 1) Stack & Structure

- **Frontend**: React (Vite/CRA) or Next.js (confirm in repo), Tailwind/Headless UI (existing patterns)
- **Backend**: Node.js + Express
- **DB**: PostgreSQL (Render/Supabase)
- **Infra**: Render
- **External**: Dropbox API

**Common paths** (adjust to actual repo layout):
- `/frontend/` — App UI (customers, loans, documents, tasks)
- `/backend/` — Express API (routes, controllers, services, models)
- `/scripts/` — ad-hoc helpers/migrations
- `/docs/` — specs, decisions, and runbooks

---

## 2) Domain Modules & Rules

### 2.1 Customers
**Required fields**: `customer_id`, `name`, `phone`, `email`, `address`, `status`, `primary_agent_id`, `dropbox_folder_path`, **`flat_no` (NEW)**, timestamps.

**Actions**
- Create customer: agents can create; **do not** ask for `flat_no` at creation (optional).  
- Update customer: **Admin** or **assigned agent** may update **all fields**, including `flat_no`, address, status, email/phone, `dropbox_folder_path` (when explicitly changed).
- **Permissions**: 
  - Admin: full edit
  - Assigned agent: full edit for their customers
  - Others: read-only

**UI**
- Customer Details page must show **Flat No.** (editable inline or via modal) and a general **Edit** action that exposes all fields.
- Show a clear audit of last updated time and user.

**API**
- `GET /api/customers/:id`
- `PATCH /api/customers/:id` → validate role & assignment before write.
- Input validation: phone/email formats, length limits, `status` must be one of configured statuses.

**DB**
- Add column if missing:
  ```sql
  ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS flat_no TEXT;
  ```
- Add row-level checks in service layer for update rights.

---

### 2.2 Customer Notes
**Endpoint**: `GET /api/customers/:id/notes`

**Known issue**: Intermittent **500** causing UI crash on Customer Details.

**Agent rules**
- Backend:
  - Return **200 + []** on “no notes” or “not found” (don’t 500).
  - Log server errors; never leak stack to client.
- Frontend:
  - Wrap fetch in try/catch; on error, show a **non-blocking toast** and a **soft empty-state** (“No notes yet”).
  - Component must not crash even if notes API fails. Guard against `undefined`.

**Other**
- Add `POST /api/customers/:id/notes` with payload validation; sanitize inputs.

---

### 2.3 Loans (Customer context)
- Customer Details → Loans list (table)
- “Add Loan” inline section toggled by `showLoanForm`.
- After successful add: `setShowLoanForm(false)` + `refreshLoans()`.
- Empty state text: “No loans recorded for this customer.”

**Tests**
- Loan form: required fields, success flow, error toasts.
- Loans list: rendering, empty state, refresh behavior.

---

### 2.4 Documents (Dropbox integration)

**Requirements**
- **Preserve original filenames**. **Do not** prefix timestamps/IDs.
- **Do not** auto-create Dropbox shared links. Remove/disable that path.
- Persist `dropbox_folder_path` on the **customer**; never reset to `NULL` on unrelated edits.

**Known issue**
- Mobile view has **horizontal scrolling**. Fix with responsive layout and a burger menu when space is tight.

**Frontend**
- File list: responsive table → stacked rows on small screens.
- Menu: collapse into a three-line **floating menu** (hamburger) when not enough width.
- Avoid wide, fixed-width columns; use wrapping and ellipsis.

**Backend**
- Upload handler:
  - Use original `file.name`
  - No shared link creation calls
- Folder path:
  - Read from `customers.dropbox_folder_path`
  - If empty, create customer folder (per policy) and **save path once**; do not set `NULL` on later updates unless explicitly requested.

**Logs reference (for context)**
- Past error: “Dropbox shared link creation failed … 400” → feature removed.

---

### 2.5 Tasks
- My Tasks page: **show all pending tasks grouped by customer** (no “Today” tab).
- Task templates (e.g., “Loan Docs Checklist”): simple server-side templates expanding into task lists on assign.
- Reminders: basic datetime reminders (no push infra); UI shows due highlights.

---

## 3) Error Hotfix Playbooks

### 3.1 CustomerDetail crash on notes fetch
- **Backend**: Ensure `GET /api/customers/:id/notes` never throws; return `[]` on no data.
- **Frontend**:
  - Wrap `await api.get(.../notes)` in try/catch.
  - On error: `toast.error('Couldn’t load notes');` and render empty state card.
  - Add boundary around CustomerDetail to avoid unhandled state explosions.

### 3.2 Documents page “Cannot access 'Mn' before initialization”
- Likely a hoisted var/const ordering or circular import in a built chunk.
- Action: identify module initializing `Mn` prior to assignment; split the module or invert import dependency. Add regression test on CI build.

### 3.3 Dropbox folder path set to NULL
- Check update path for customers; make sure PATCH merges only provided fields.
- Add unit test: “Updating status does **not** null `dropbox_folder_path`.”

---

## 4) API Contracts (source of truth)

> Adjust file paths to actual code. If routes differ, update here and in `docs/`.

- **Customers**
  - `GET /api/customers?query=...&page=...`
  - `GET /api/customers/:id`
  - `PATCH /api/customers/:id` (Admin or assigned agent)
  - `POST /api/customers` (Agent allowed; `flat_no` optional)

- **Notes**
  - `GET /api/customers/:id/notes` → `200 []` on empty
  - `POST /api/customers/:id/notes` → validates, sanitizes

- **Loans**
  - `GET /api/customers/:id/loans`
  - `POST /api/customers/:id/loans`

- **Documents**
  - `POST /api/customers/:id/documents/upload`  
    - Uses Dropbox; keeps original filename; no shared links
  - `GET /api/customers/:id/documents`  
    - Lists files via Dropbox path

**Errors**
- Use problem+json or `{ message, code }`
- 4xx: validation/permission; 5xx: unexpected only

---

## 5) DB & Migrations

### 5.1 Customers
```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS flat_no TEXT,
  ADD COLUMN IF NOT EXISTS dropbox_folder_path TEXT;
```

### 5.2 Notes
```sql
CREATE TABLE IF NOT EXISTS customer_notes (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
```

**Rules**
- Never drop columns in production without a data migration plan and backup.
- All migrations must be **idempotent** and checked into VCS.

---

## 6) AuthZ (Who can edit what)

- **Admin**: full read/write on all customer and loan fields; can set `dropbox_folder_path`.
- **Assigned Agent**: read/write on their customers and loans; can set `flat_no`, contact fields, status, `dropbox_folder_path`.
- **Other Agents**: read-only across the board.

**Implementation**
- Add middleware or service checks before update operations.
- Enforce at both API layer and the UI (disable form controls if not allowed).

---

## 7) Frontend Standards

- **Error handling**: never let a failed fetch crash a page.
- **Forms**: optimistic UI only when server is reliable; otherwise show spinner + confirm toast.
- **Mobile**:
  - Replace horizontal scrolls with stacked layouts below `sm` breakpoint.
  - Move overflow menu actions into a hamburger if navbar wraps.
- **Tables**:
  - Use `overflow-x-auto` only as a last resort; prefer fluid columns, wrapping text, ellipsis.

---

## 8) Dropbox Integration Notes

- **Filename**: use `originalFile.name` as the stored Dropbox file name (no timestamp prefixes).
- **Shared links**: disabled by default; call only when a specific ticket requires it.
- **Folder path**:
  - If `customers.dropbox_folder_path` is set, always use it.
  - If not set and the upload flow mandates creating one, create and **persist once**.
  - Never set to `NULL` unless a user explicitly clears it.

**Testing**
- Unit: upload service keeps filename intact.
- Integration: upload followed by list returns the uploaded name.
- Regression: updating unrelated customer fields does not touch `dropbox_folder_path`.

---

## 9) Coding Standards

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- **Branches**: `feature/<ticket-id>-<short-name>` or `fix/<ticket-id>-<short-name>`.
- **PRs**: include summary, screenshots (UI), request/response samples (API), and test notes.
- **Lint/Format**: ESLint + Prettier must pass pre-commit.
- **Type safety**: Prefer explicit types in APIs and service boundaries.

---

## 10) Test Matrix (what to cover)

- **Backend**
  - Customers: create/update permissions, `flat_no` persistence, non-destructive PATCH
  - Notes: `GET` empty → `[]`, error path returns `5xx` only on real exceptions
  - Documents: filename preserved, no shared link side-effects
- **Frontend**
  - CustomerDetail: notes failure → non-blocking toast + stable UI
  - Loans: add flow hides form + refreshes list
  - Documents mobile: no horizontal scroll, burger menu appears on narrow width

---

## 11) PR Checklist (Agent must tick)

- [ ] Linked issue/ticket
- [ ] Lint & tests pass locally (attach output)
- [ ] Backward compatible (or migration documented)
- [ ] Screenshots / network logs for fixes
- [ ] ENV/migrations updated (if any)
- [ ] Mobile behavior verified (where applicable)

---

## 12) ENV Keys (documented; do not hard-code)

```
# Backend
PORT=
DATABASE_URL=
NODE_ENV=
DROPBOX_ACCESS_TOKEN=

# Frontend
VITE_API_BASE_URL=
```

> Add `.env.example` entries if missing. Never commit real secrets.

---

## 13) Escalation & Ambiguity

If requirements are unclear:
1) Open a Draft PR titled “RFC: <topic>”  
2) Add a **Questions** section with concrete options.  
3) Do not modify public API behavior until approved.

---

## 14) Known Tickets / Context Snapshots

- **CustomerDetail notes crash**: make UI resilient; backend returns `[]` on empty.
- **Dropbox upload**: remove shared link creation; keep original filenames; fix folder path persistence.
- **Flat No.**: add field end-to-end; editable by Admin and assigned agent.
- **Documents (mobile)**: responsive, compact; hamburger menu when space constrained.
- **Tasks**: show **all pending tasks grouped by customer**; no “Today” tab.
