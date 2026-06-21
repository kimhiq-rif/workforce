-- Migration 013: Daily report snapshots
-- Stores the generated 17:00 daily report payload and summary totals.

create table if not exists daily_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  report_date date not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  total_labor_cost numeric(12,2) not null default 0,
  total_expenses numeric(12,2) not null default 0,
  total_present int not null default 0,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(owner_id, report_date)
);

alter table daily_report_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_report_snapshots'
      and policyname = 'daily_report_snapshots_select'
  ) then
    create policy "daily_report_snapshots_select"
      on daily_report_snapshots for select
      using (owner_id = get_owner_id());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_report_snapshots'
      and policyname = 'daily_report_snapshots_insert'
  ) then
    create policy "daily_report_snapshots_insert"
      on daily_report_snapshots for insert
      with check (owner_id = get_owner_id());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_report_snapshots'
      and policyname = 'daily_report_snapshots_update'
  ) then
    create policy "daily_report_snapshots_update"
      on daily_report_snapshots for update
      using (owner_id = get_owner_id())
      with check (owner_id = get_owner_id());
  end if;
end $$;

create index if not exists idx_daily_report_snapshots_owner_date
  on daily_report_snapshots(owner_id, report_date desc);
