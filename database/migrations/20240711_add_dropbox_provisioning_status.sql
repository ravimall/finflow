ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS dropbox_provisioning_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dropbox_last_error TEXT;

UPDATE customers
   SET dropbox_provisioning_status = COALESCE(dropbox_provisioning_status, 'pending')
 WHERE dropbox_provisioning_status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_agents_customer_agent
    ON customer_agents (customer_id, agent_id);
