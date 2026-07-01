-- Migration 036: No-phone worker companion pairing
-- A worker without a phone is paired to a companion worker whose phone verifies both check-ins.
-- Run manually in Supabase SQL Editor.

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS has_no_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS companion_worker_id uuid REFERENCES workers(id) ON DELETE SET NULL;

-- Index for reverse lookup: "who is this worker the companion of?"
CREATE INDEX IF NOT EXISTS workers_companion_worker_id_idx ON workers(companion_worker_id);

-- Constraint: a worker cannot be their own companion
ALTER TABLE workers
  ADD CONSTRAINT workers_no_self_companion CHECK (companion_worker_id IS DISTINCT FROM id);

-- Constraint: only a worker flagged has_no_phone may have a companion
-- (prevents orphaned companion links on workers that have phones)
ALTER TABLE workers
  ADD CONSTRAINT workers_companion_requires_no_phone CHECK (
    companion_worker_id IS NULL OR has_no_phone = true
  );
