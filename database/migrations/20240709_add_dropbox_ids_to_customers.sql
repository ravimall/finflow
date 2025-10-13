ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS dropbox_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS dropbox_shared_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS dropbox_folder_path TEXT;
