-- Driver cash float: tracks cash given by owner to driver managers
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS driver_cash_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  driver_user_id uuid NOT NULL,   -- references users.id (the driver manager's profile)
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  notes text,
  given_by uuid,                  -- owner's users.id
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_cash_entries_owner_idx ON driver_cash_entries(owner_id);
CREATE INDEX IF NOT EXISTS driver_cash_entries_driver_idx ON driver_cash_entries(driver_user_id);

ALTER TABLE driver_cash_entries ENABLE ROW LEVEL SECURITY;

-- Owner and their field/driver managers can all see entries for that owner
CREATE POLICY "owner_access_cash" ON driver_cash_entries
  FOR ALL USING (owner_id = get_owner_id());
