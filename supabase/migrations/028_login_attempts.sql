-- Server-side login lockout state for app sign-in attempts.
-- This is intentionally keyed by normalized email before an app user exists.

create table if not exists login_attempts (
  normalized_email text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_attempts_failed_count_nonnegative check (failed_count >= 0)
);

alter table login_attempts enable row level security;

drop policy if exists "login_attempts_service_only" on login_attempts;

create policy "login_attempts_service_only"
  on login_attempts
  for all
  using (false)
  with check (false);

create index if not exists idx_login_attempts_locked_until
  on login_attempts(locked_until)
  where locked_until is not null;
