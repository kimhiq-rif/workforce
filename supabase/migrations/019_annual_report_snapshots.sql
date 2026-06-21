-- Annual and half-year report snapshots.
-- Stores the generated "big document" payload so final reports can be frozen.

create table if not exists annual_report_snapshots (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references users(id) on delete cascade,
  report_mode text not null check (report_mode in ('annual', 'half-year')),
  report_year int not null,
  report_half int check (report_half in (1, 2)),
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  data jsonb not null,
  pdf_url text,
  created_at timestamptz not null default now(),
  unique(owner_id, report_mode, report_year, report_half)
);

alter table annual_report_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_report_snapshots'
      and policyname = 'annual_report_snapshots_select'
  ) then
    create policy "annual_report_snapshots_select"
      on annual_report_snapshots for select
      using (
        owner_id = get_owner_id()
        or exists (
          select 1 from users
          where auth_id = auth.uid()
            and users.role = 'technical_admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_report_snapshots'
      and policyname = 'annual_report_snapshots_insert'
  ) then
    create policy "annual_report_snapshots_insert"
      on annual_report_snapshots for insert
      with check (owner_id = get_owner_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_report_snapshots'
      and policyname = 'annual_report_snapshots_update'
  ) then
    create policy "annual_report_snapshots_update"
      on annual_report_snapshots for update
      using (owner_id = get_owner_id())
      with check (owner_id = get_owner_id());
  end if;
end $$;

create index if not exists idx_annual_report_snapshots_owner_period
  on annual_report_snapshots(owner_id, report_year desc, report_mode, report_half);
