-- Migration 008: App access — login email on workers, force-change flag on users
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS login_email TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
