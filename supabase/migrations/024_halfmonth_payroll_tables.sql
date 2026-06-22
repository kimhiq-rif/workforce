-- Half-month payroll support tables.
-- advance_payments feeds the payroll deductions.
-- halfmonth_report_snapshots freezes generated report payloads.

create table if not exists advance_payments (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references users(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  payment_date date not null,
  amount numeric(10, 2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table advance_payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advance_payments'
      and policyname = 'advance_payments_select'
  ) then
    create policy "advance_payments_select"
      on advance_payments for select
      using (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advance_payments'
      and policyname = 'advance_payments_insert'
  ) then
    create policy "advance_payments_insert"
      on advance_payments for insert
      with check (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advance_payments'
      and policyname = 'advance_payments_update'
  ) then
    create policy "advance_payments_update"
      on advance_payments for update
      using (owner_id = get_owner_id())
      with check (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advance_payments'
      and policyname = 'advance_payments_delete'
  ) then
    create policy "advance_payments_delete"
      on advance_payments for delete
      using (owner_id = get_owner_id());
  end if;
end $$;

create index if not exists idx_advance_payments_owner_date
  on advance_payments(owner_id, payment_date desc);

create index if not exists idx_advance_payments_worker_date
  on advance_payments(worker_id, payment_date desc);

create table if not exists halfmonth_report_snapshots (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  total_workers int not null default 0,
  total_net_pay numeric(12, 2) not null default 0,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique(owner_id, period_start, period_end)
);

alter table halfmonth_report_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'halfmonth_report_snapshots'
      and policyname = 'halfmonth_report_snapshots_select'
  ) then
    create policy "halfmonth_report_snapshots_select"
      on halfmonth_report_snapshots for select
      using (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'halfmonth_report_snapshots'
      and policyname = 'halfmonth_report_snapshots_insert'
  ) then
    create policy "halfmonth_report_snapshots_insert"
      on halfmonth_report_snapshots for insert
      with check (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'halfmonth_report_snapshots'
      and policyname = 'halfmonth_report_snapshots_update'
  ) then
    create policy "halfmonth_report_snapshots_update"
      on halfmonth_report_snapshots for update
      using (owner_id = get_owner_id())
      with check (owner_id = get_owner_id());
  end if;
end $$;

create index if not exists idx_halfmonth_report_snapshots_owner_period
  on halfmonth_report_snapshots(owner_id, period_end desc);
