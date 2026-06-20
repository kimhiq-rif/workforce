-- Migration 007: Passkeys (WebAuthn biometric login)
CREATE TABLE IF NOT EXISTS passkeys (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT    UNIQUE NOT NULL,
  public_key    TEXT    NOT NULL,
  counter       BIGINT  DEFAULT 0 NOT NULL,
  device_name   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_passkeys" ON passkeys
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
