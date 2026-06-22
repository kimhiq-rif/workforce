-- Tables the app code already writes to but which were never created:
--   overtime_events  (app/api/overtime/route.ts)
--   corrections      (app/api/corrections/route.ts)
-- Without these, overtime entry and retroactive corrections fail in production.

-- ─── Overtime events ─────────────────────────────────────────────────────────
create table if not exists overtime_events (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references users(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  worker_id         uuid not null references workers(id) on delete cascade,
  session_id        uuid not null,                 -- groups one owner overtime action
  event_date        date not null,
  overtime_end_time time not null,                 -- e.g. 19:30
  overtime_hours    numeric(5,2) not null default 0,
  amount            numeric(10,2),                 -- payment for this worker (null = "remind me later")
  approved_by       uuid references users(id),
  created_at        timestamptz not null default now()
);

alter table overtime_events enable row level security;

create policy "overtime_events_select" on overtime_events for select
  using (owner_id = get_owner_id());
create policy "overtime_events_insert" on overtime_events for insert
  with check (owner_id = get_owner_id());
create policy "overtime_events_update" on overtime_events for update
  using (owner_id = get_owner_id()) with check (owner_id = get_owner_id());
create policy "overtime_events_delete" on overtime_events for delete
  using (owner_id = get_owner_id());

create index if not exists idx_overtime_events_owner_date on overtime_events(owner_id, event_date desc);
create index if not exists idx_overtime_events_site_date on overtime_events(site_id, event_date desc);

-- ─── Corrections (retroactive edits; original never deleted) ──────────────────
create table if not exists corrections (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id) on delete cascade,
  entity_type     text not null,                   -- receipt / attendance / advance / temp_worker / ...
  entity_id       uuid not null,
  field_name      text not null,
  original_value  text,
  corrected_value text,
  reason          text not null,
  corrected_by    uuid references users(id),
  corrected_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table corrections enable row level security;

create policy "corrections_select" on corrections for select
  using (owner_id = get_owner_id());
create policy "corrections_insert" on corrections for insert
  with check (owner_id = get_owner_id());

create index if not exists idx_corrections_owner_date on corrections(owner_id, corrected_at desc);
create index if not exists idx_corrections_entity on corrections(entity_type, entity_id);
