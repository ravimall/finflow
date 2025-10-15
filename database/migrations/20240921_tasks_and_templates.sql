-- 20240921_tasks_and_templates.sql
-- FinFlow Phase 2 schema changes for tasks, templates, and loan aging

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS stage_started_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_status_change_on timestamptz NULL;

UPDATE loans
SET stage_started_at = COALESCE(last_status_change_on, updated_at, created_at)
WHERE stage_started_at IS NULL;

CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  offset_days int NOT NULL DEFAULT 0,
  notes text,
  default_assignee_role text CHECK (default_assignee_role IN ('admin','agent')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id int NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assignee_id int REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  due_on date,
  remind_on date,
  notes text,
  template_id uuid REFERENCES task_templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tasks_customer_pending ON tasks (customer_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_pending ON tasks (assignee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_pending_remind_on
ON tasks (remind_on) WHERE status = 'pending';

