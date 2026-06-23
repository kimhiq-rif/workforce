-- Codifies the site_transfer_events table, which already exists in the live DB
-- (created manually) but had no migration. The app (SiteDetailClient,
-- AttendanceReportFlow) and reports (daily-report, halfmonth-report) all read/write
-- it, so a migration is required for fresh/staging builds to work.
-- Schema mirrors production exactly (introspected via PostgREST). Idempotent:
-- safe to run against the existing prod DB (create table if not exists).

create table if not exists site_transfer_events (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references users(id) on delete cascade,
  worker_id      uuid not null references workers(id) on delete cascade,
  from_site_id   uuid not null references sites(id) on delete cascade,
  to_site_id     uuid not null references sites(id) on delete cascade,
  event_date     date not null,
  transfer_time  time not null,
  source         text not null,                 -- where the transfer was triggered
  performed_by   uuid not null references users(id),
  notes          text,
  created_at     timestamptz not null default now()
);

alter table site_transfer_events enable row level security;

-- Owner-scoped access (server routes use serviceClient and bypass RLS; these
-- policies secure any client-side access). Drop-then-create keeps it idempotent.
drop policy if exists "site_transfer_events_select" on site_transfer_events;
drop policy if exists "site_transfer_events_insert" on site_transfer_events;
drop policy if exists "site_transfer_events_update" on site_transfer_events;
drop policy if exists "site_transfer_events_delete" on site_transfer_events;

create policy "site_transfer_events_select" on site_transfer_events for select
  using (owner_id = get_owner_id());
create policy "site_transfer_events_insert" on site_transfer_events for insert
  with check (owner_id = get_owner_id());
create policy "site_transfer_events_update" on site_transfer_events for update
  using (owner_id = get_owner_id()) with check (owner_id = get_owner_id());
create policy "site_transfer_events_delete" on site_transfer_events for delete
  using (owner_id = get_owner_id());

-- Indexes for the report queries (owner + date, per-site lookups).
create index if not exists idx_site_transfer_events_owner_date on site_transfer_events(owner_id, event_date desc);
create index if not exists idx_site_transfer_events_to_site on site_transfer_events(to_site_id, event_date desc);
create index if not exists idx_site_transfer_events_worker on site_transfer_events(worker_id, event_date desc);
