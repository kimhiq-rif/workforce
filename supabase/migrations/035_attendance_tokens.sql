-- Migration 035: attendance_tokens table + workers.phone_verified
-- Enables self-check-in flow via single-use links sent to workers

-- Single-use check-in tokens (one per worker per day)
CREATE TABLE attendance_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text        UNIQUE NOT NULL,
  worker_id   uuid        NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  owner_id    uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendance_tokens_token_idx    ON attendance_tokens(token);
CREATE INDEX attendance_tokens_worker_idx   ON attendance_tokens(worker_id, created_at DESC);
CREATE INDEX attendance_tokens_owner_idx    ON attendance_tokens(owner_id,  created_at DESC);

-- Phone-verified flag on workers (prerequisite for generating a token)
ALTER TABLE workers ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- RLS: tokens are readable by anyone with the token value (checked in API, not via RLS)
-- Service client (bypasses RLS) is used in all checkin API routes.
ALTER TABLE attendance_tokens ENABLE ROW LEVEL SECURITY;

-- Owner can see all tokens for their workers
CREATE POLICY "owner_read_own_tokens" ON attendance_tokens
  FOR SELECT USING (owner_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- Only service role writes tokens (API routes use serviceClient)
CREATE POLICY "service_insert_tokens" ON attendance_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_update_tokens" ON attendance_tokens
  FOR UPDATE USING (true);
