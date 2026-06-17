-- Workforce DB Schema
-- Region: ap-southeast-2 (Sydney) — closest to Koh Samui
-- All timestamps stored in UTC, displayed as Asia/Bangkok (UTC+7)

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────
create type user_role as enum ('owner', 'field_manager', 'technical_admin');

create type site_status as enum (
  'live', 'finished', 'rain', 'day_off', 'half_day', 'waiting', 'review'
);

create type wage_reason as enum (
  'full_day',
  'half_day_morning_departure',
  'half_day_afternoon_arrival',
  'half_day_rain',
  'half_day_owner_decision',
  'no_pay_rain_before_attendance',
  'no_pay_day_off',
  'pending_owner_decision'
);

create type wage_decision as enum (
  'full_day', 'half_day', 'none', 'pending'
);

create type receipt_status as enum (
  'pending_qr', 'pending_payment', 'paid', 'needs_review'
);

create type attendance_status as enum (
  'on_site', 'late', 'missing', 'half_day_am', 'half_day_pm', 'day_off', 'rain'
);

-- ─── Users (owners + field managers) ─────────────────────────────────────────
create table users (
  id            uuid primary key default uuid_generate_v4(),
  auth_id       uuid unique references auth.users(id) on delete cascade,
  owner_id      uuid,                          -- null for owners themselves
  role          user_role not null default 'field_manager',
  name_th       text not null,
  name_en       text not null,
  phone         text,
  admin_code_hash text,                        -- bcrypt hash of PIN, only for owners
  language_mode text not null default 'th_en', -- th_en | th_only | en_only
  session_timeout_hours int not null default 1, -- 1 for owner, 8 for FM
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Owner self-reference
alter table users add constraint fk_owner foreign key (owner_id) references users(id);

-- ─── Trusted devices ──────────────────────────────────────────────────────────
create table trusted_devices (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  device_hash   text not null,               -- sha256(user-agent + ip-range + pwa-id)
  device_label  text,
  approved_at   timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- ─── Push subscriptions ───────────────────────────────────────────────────────
create table push_subscriptions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- ─── Sites ────────────────────────────────────────────────────────────────────
create table sites (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references users(id) on delete cascade,
  name_th       text not null,
  name_en       text not null,
  location_th   text,
  location_en   text,
  status        site_status not null default 'waiting',
  manager_id    uuid references users(id),
  lat           double precision,
  lng           double precision,
  photo_url     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Workers ──────────────────────────────────────────────────────────────────
create table workers (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references users(id) on delete cascade,
  name_th       text not null,
  name_en       text not null,
  role_th       text,                          -- e.g. ช่างก่อสร้าง
  role_en       text,                          -- e.g. Construction worker
  daily_wage    numeric(10,2) not null default 600,
  is_temporary  boolean not null default false,
  assigned_site_id uuid references sites(id),
  photo_url     text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Attendance events ────────────────────────────────────────────────────────
create table attendance_events (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references users(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  worker_id       uuid not null references workers(id) on delete cascade,
  reported_by     uuid references users(id),  -- field manager who took the photo
  event_date      date not null,              -- Bangkok date of the work day
  arrival_time    time,                        -- null if missing
  photo_url       text,                        -- signed URL to R2/Supabase storage
  photo_lat       double precision,
  photo_lng       double precision,
  status          attendance_status not null default 'on_site',
  is_late         boolean not null default false,
  after_cutoff    boolean not null default false, -- true if event was after rain/half-day cutoff
  wage_reason     wage_reason,
  wage_amount     numeric(10,2),               -- calculated wage for this event
  notes           text,
  created_at      timestamptz not null default now()
);

-- ─── Site day status events ───────────────────────────────────────────────────
-- Records Rain / Half Day / Day Off decisions and their wage outcomes
create table site_day_status_events (
  id                          uuid primary key default uuid_generate_v4(),
  owner_id                    uuid not null references users(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  event_date                  date not null,
  status                      site_status not null,    -- rain / day_off / half_day
  set_by                      uuid not null references users(id),
  set_at                      timestamptz not null default now(),
  set_before_attendance       boolean not null default false,
  rain_end_at                 timestamptz,             -- if rain was cancelled
  wage_decision               wage_decision not null default 'pending',
  wage_reason                 wage_reason,
  wage_decided_at             timestamptz,
  wage_decided_by             uuid references users(id),
  cutoff_time                 time,                    -- actual cutoff time applied
  attendance_count_at_change  int not null default 0,  -- workers reported when status was set
  affected_worker_ids         uuid[],
  notes                       text,
  created_at                  timestamptz not null default now(),
  unique(site_id, event_date, status)
);

-- ─── Suppliers ────────────────────────────────────────────────────────────────
create table suppliers (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references users(id) on delete cascade,
  name_th       text not null,
  name_en       text not null,
  logo_initials text,
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Receipts ─────────────────────────────────────────────────────────────────
create table receipts (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references users(id) on delete cascade,
  site_id         uuid references sites(id),
  supplier_id     uuid references suppliers(id),
  receipt_number  text not null,                    -- e.g. RC-20250518-001
  amount          numeric(10,2),
  status          receipt_status not null default 'pending_qr',
  qr_value        text,                             -- decoded QR payload
  qr_image_url    text,                             -- clean QR image in storage
  source_photo_url text,                            -- original capture (backup)
  scanned_by      uuid references users(id),        -- driver who scanned
  scanned_at      timestamptz,
  paid_at         timestamptz,
  paid_by         uuid references users(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Advances (worker salary advances) ────────────────────────────────────────
create table advances (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references users(id) on delete cascade,
  worker_id     uuid not null references workers(id) on delete cascade,
  site_id       uuid references sites(id),
  amount        numeric(10,2) not null,
  created_by    uuid references users(id),
  notes         text,
  created_at    timestamptz not null default now()
);

-- ─── Workday settings ─────────────────────────────────────────────────────────
create table workday_settings (
  id                  uuid primary key default uuid_generate_v4(),
  owner_id            uuid not null unique references users(id) on delete cascade,
  attendance_opens    time not null default '07:00',
  workday_start       time not null default '08:00',
  workday_end         time not null default '17:00',
  daily_reset         time not null default '00:00',    -- locked, always 00:00
  timezone            text not null default 'Asia/Bangkok', -- locked
  updated_at          timestamptz not null default now()
);

-- ─── Audit log ────────────────────────────────────────────────────────────────
create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid references users(id),
  actor_id      uuid references users(id),
  action        text not null,               -- login / logout / code_change / rain_set / etc.
  target_type   text,                        -- site / worker / receipt / user
  target_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  device_hash   text,
  ip_address    text,
  created_at    timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table users enable row level security;
alter table sites enable row level security;
alter table workers enable row level security;
alter table attendance_events enable row level security;
alter table site_day_status_events enable row level security;
alter table suppliers enable row level security;
alter table receipts enable row level security;
alter table advances enable row level security;
alter table workday_settings enable row level security;
alter table audit_log enable row level security;
alter table push_subscriptions enable row level security;
alter table trusted_devices enable row level security;

-- Helper: get current user's owner_id (or own id if owner)
create or replace function get_owner_id() returns uuid
  language sql stable
  as $$
    select coalesce(
      (select owner_id from users where auth_id = auth.uid()),
      (select id from users where auth_id = auth.uid() and role = 'owner')
    );
  $$;

-- Users: owners see themselves + their managers
create policy "users_select" on users for select
  using (
    auth.uid() is not null and (
      auth_id = auth.uid() or
      owner_id = (select id from users where auth_id = auth.uid())
    )
  );

create policy "users_update_own" on users for update
  using (auth_id = auth.uid());

-- Sites: scoped to owner
create policy "sites_select" on sites for select
  using (owner_id = get_owner_id());

create policy "sites_insert" on sites for insert
  with check (owner_id = get_owner_id());

create policy "sites_update" on sites for update
  using (owner_id = get_owner_id());

create policy "sites_delete" on sites for delete
  using (owner_id = get_owner_id());

-- Workers: scoped to owner
create policy "workers_select" on workers for select
  using (owner_id = get_owner_id());

create policy "workers_insert" on workers for insert
  with check (owner_id = get_owner_id());

create policy "workers_update" on workers for update
  using (owner_id = get_owner_id());

-- Attendance events: scoped to owner
create policy "attendance_select" on attendance_events for select
  using (owner_id = get_owner_id());

create policy "attendance_insert" on attendance_events for insert
  with check (owner_id = get_owner_id());

create policy "attendance_update" on attendance_events for update
  using (owner_id = get_owner_id());

-- Site day status events: scoped to owner
create policy "site_day_status_select" on site_day_status_events for select
  using (owner_id = get_owner_id());

create policy "site_day_status_insert" on site_day_status_events for insert
  with check (owner_id = get_owner_id());

create policy "site_day_status_update" on site_day_status_events for update
  using (owner_id = get_owner_id());

-- Suppliers: scoped to owner
create policy "suppliers_select" on suppliers for select
  using (owner_id = get_owner_id());

create policy "suppliers_insert" on suppliers for insert
  with check (owner_id = get_owner_id());

-- Receipts: scoped to owner
create policy "receipts_select" on receipts for select
  using (owner_id = get_owner_id());

create policy "receipts_insert" on receipts for insert
  with check (owner_id = get_owner_id());

create policy "receipts_update" on receipts for update
  using (owner_id = get_owner_id());

-- Advances: scoped to owner
create policy "advances_select" on advances for select
  using (owner_id = get_owner_id());

create policy "advances_insert" on advances for insert
  with check (owner_id = get_owner_id());

-- Workday settings: owner only
create policy "workday_select" on workday_settings for select
  using (owner_id = get_owner_id());

create policy "workday_upsert" on workday_settings for all
  using (owner_id = get_owner_id())
  with check (owner_id = get_owner_id());

-- Audit log: owner reads, system writes (via service role)
create policy "audit_select" on audit_log for select
  using (owner_id = get_owner_id());

-- Push subscriptions: user sees their own
create policy "push_select" on push_subscriptions for select
  using (user_id = (select id from users where auth_id = auth.uid()));

create policy "push_insert" on push_subscriptions for insert
  with check (user_id = (select id from users where auth_id = auth.uid()));

create policy "push_delete" on push_subscriptions for delete
  using (user_id = (select id from users where auth_id = auth.uid()));

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index idx_sites_owner on sites(owner_id);
create index idx_workers_owner on workers(owner_id);
create index idx_workers_site on workers(assigned_site_id);
create index idx_attendance_site_date on attendance_events(site_id, event_date);
create index idx_attendance_worker_date on attendance_events(worker_id, event_date);
create index idx_attendance_owner on attendance_events(owner_id);
create index idx_site_day_status_site_date on site_day_status_events(site_id, event_date);
create index idx_receipts_owner on receipts(owner_id);
create index idx_receipts_status on receipts(owner_id, status);
create index idx_audit_owner on audit_log(owner_id, created_at desc);

-- ─── Functions ────────────────────────────────────────────────────────────────

-- Calculate severity score for a daily report
create or replace function calculate_severity_score(
  p_labor_amount numeric,
  p_supplier_amount numeric,
  p_labor_count int,
  p_supplier_count int
) returns int language plpgsql as $$
declare
  total_amount numeric;
  total_events int;
  labor_score numeric;
  supplier_score numeric;
  score int;
begin
  total_amount := p_labor_amount + p_supplier_amount;
  total_events := p_labor_count + p_supplier_count;

  if total_amount = 0 or total_events = 0 then
    return 0;
  end if;

  -- Labor: higher score if it dominates by amount (70% weight) + frequency (30% weight)
  labor_score :=
    (p_labor_amount / total_amount * 70) +
    (p_labor_count::numeric / total_events * 30);

  supplier_score :=
    (p_supplier_amount / total_amount * 70) +
    (p_supplier_count::numeric / total_events * 30);

  -- Return the highest category's score (0-100)
  score := round(greatest(labor_score, supplier_score));
  return score;
end;
$$;

-- Determine wage for attendance event based on arrival time and site day status
create or replace function compute_wage_reason(
  p_arrival_time time,
  p_site_status site_status,
  p_workday_start time default '08:00',
  p_half_day_cutoff time default '12:00',
  p_afternoon_grace time default '12:30'
) returns wage_reason language plpgsql as $$
begin
  -- Rain / Day Off before attendance = no pay
  if p_site_status in ('rain', 'day_off') then
    return 'no_pay_day_off';
  end if;

  if p_arrival_time is null then
    return null; -- missing, no wage
  end if;

  -- Afternoon arrival (12:00 - 12:30) = half day afternoon
  if p_arrival_time >= p_half_day_cutoff and p_arrival_time <= p_afternoon_grace then
    return 'half_day_afternoon_arrival';
  end if;

  -- Normal arrival = full day (late flag handled separately)
  return 'full_day';
end;
$$;

-- Updated_at trigger
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_users_updated_at before update on users
  for each row execute procedure update_updated_at_column();

create trigger update_sites_updated_at before update on sites
  for each row execute procedure update_updated_at_column();

create trigger update_workers_updated_at before update on workers
  for each row execute procedure update_updated_at_column();

create trigger update_receipts_updated_at before update on receipts
  for each row execute procedure update_updated_at_column();
